import { NextResponse } from 'next/server'
import { requireAuth } from '@/lib/supabase-server'
import { fetchAllRows } from '@/lib/supabase-paginate'
import { ensureLangfristigeVersion } from '@/lib/langfristige-version'

// Auth-geschützte, pro-Planversion dynamische Route — nie statisch generieren.
// Überspringt den in Next 16 instabilen Static-Path-Pass (Worker-Crash).
export const dynamic = 'force-dynamic'

// PROJ-87: Berechnete Werte der Sales-Plattform-Planung (Langfristige Planung).
// Spiegelt die kurzfristige /sales-plattform-planung/berechnet-Logik (PROJ-66),
// aber:
//   • monatsbasiert (Startmonat − 3 … + allgemeiner Horizont) statt KW,
//   • KEINE Ist-Transaktionen — Bruttoumsatz kommt direkt aus der Absatzplanung,
//   • Retourenquote ist der manuell gepflegte Wert (Vertrieb → Retouren → Allgemein),
//   • alle Einstellungen stammen aus DIESER Planversion.
// USt wird — wie kurzfristig — als Aufschlag auf die Kostenkategorien angewendet;
// die Parent-/Root-Kategorien (Verkaufsgebühr, Retouren, Marketing) stammen aus dem
// globalen KPI-Modell (kpi_categories), die Sätze/Ebenen aus der Version.

const DEFAULT_PLANUNGSHORIZONT_MONATE = 12

interface RouteContext {
  params: Promise<{ versionId: string }>
}

interface KatRow { id: string; name: string; parent_id: string | null; type: string; level: number }
interface KpiKat { id: string }
interface AbsatzRow { sales_plattform_id: string; produkt_id: string; jahr: number; monat: number; absatz: number | null; effektiver_vk: number | null }
interface RetourenAllgRow { produkt_id: string; retourenquote_prozent: number | null }
interface RetourenRow { sales_plattform_id: string; produkt_id: string; erstattung_verkaufsgebuehr_prozent: number | null; rueckversandkosten_euro_netto: number | null }
interface VkGebRow { sales_plattform_id: string; produkt_id: string; verkaufsgebuehr_prozent: number | null }
interface MarketingPlanRow { marketingkanal_id: string; produkt_id: string; jahr: number; monat: number; marketingkosten_pct: number | null }
interface MarketingEinstRow { marketingkanal_id: string; sales_plattform_id: string | null }
interface AuszahlungsKanalRow { marketingkanal_id: string }
interface UstSatzRow { kategorie_id: string; ebene: number; ust_satz: number | null }

function round2(x: number): number {
  return Math.round(x * 100) / 100
}

interface Monat { jahr: number; monat: number }

function buildMonate(startMonat: number, startJahr: number, horizont: number): Monat[] {
  const total = horizont + 3
  let y = startJahr
  let m = startMonat - 3
  while (m <= 0) { m += 12; y -= 1 }
  const months: Monat[] = []
  for (let i = 0; i < total; i++) {
    months.push({ jahr: y, monat: m })
    m += 1
    if (m > 12) { m = 1; y += 1 }
  }
  return months
}

export async function GET(_request: Request, { params }: RouteContext) {
  const { user, supabase, error } = await requireAuth()
  if (error) return error

  const { versionId } = await params
  const versionError = await ensureLangfristigeVersion(supabase, user!.id, versionId)
  if (versionError) return versionError

  // 1. Grundeinstellungen + globales KPI-Modell (für USt-Parent-Kategorien)
  const [grundResult, katsResult] = await Promise.all([
    supabase
      .from('langfristige_grundeinstellungen')
      .select('startmonat_monat, startmonat_jahr, planungshorizont_monate')
      .eq('user_id', user!.id)
      .eq('plan_version_id', versionId)
      .maybeSingle(),
    fetchAllRows((from, to) => supabase.from('kpi_categories').select('id, name, parent_id, type, level').order('id', { ascending: true }).range(from, to)),
  ])

  if (katsResult.error) return NextResponse.json({ error: katsResult.error.message }, { status: 500 })

  const grund = grundResult.data
  const now = new Date()
  const startMonat = grund?.startmonat_monat ?? now.getMonth() + 1
  const startJahr = grund?.startmonat_jahr ?? now.getFullYear()
  const horizont = grund?.planungshorizont_monate ?? DEFAULT_PLANUNGSHORIZONT_MONATE
  const monate = buildMonate(startMonat, startJahr, horizont)
  const monatSet = new Set(monate.map(m => `${m.jahr}:${m.monat}`))
  const planJahre = [...new Set(monate.map(m => m.jahr))]

  // USt-Parent-/Root-Kategorien aus dem globalen KPI-Modell auflösen (wie kurzfristig).
  const kats = (katsResult.data ?? []) as KatRow[]
  let vkGebRootId: string | null = null
  let vertriebParentId: string | null = null
  let retourenRootId: string | null = null
  let marketingL1Id: string | null = null
  for (const k of kats) {
    if (k.type !== 'ausgaben_kosten') continue
    const n = k.name.toLowerCase()
    if ((n.includes('verkaufsgebühr') || n.includes('verkaufsgebuehr')) && vkGebRootId === null) {
      vkGebRootId = k.id
      if (k.parent_id) {
        const par = kats.find(p => p.id === k.parent_id)
        if (par && par.level === 1) vertriebParentId = k.parent_id
      }
    }
    if (n === 'retouren' && retourenRootId === null) retourenRootId = k.id
    if (n === 'marketing' && k.level === 1 && marketingL1Id === null) marketingL1Id = k.id
  }

  // 2. Stammdaten + Einstellungen dieser Version (parallel)
  const [
    plattResult, prodResult,
    absatzResult, retourenAllgResult, retourenResult, vkGebResult,
    marketingPlanResult, marketingEinstResult, auszahlungsResult,
    ustSatzResult, ustEbeneResult,
  ] = await Promise.all([
    supabase.from('langfristige_kpi_kategorien').select('id').eq('user_id', user!.id).eq('plan_version_id', versionId).eq('art', 'lp_sales_plattform').limit(500),
    supabase.from('langfristige_kpi_kategorien').select('id').eq('user_id', user!.id).eq('plan_version_id', versionId).eq('art', 'lp_produkt').limit(500),
    fetchAllRows((from, to) => supabase.from('langfristige_absatz_planung').select('sales_plattform_id, produkt_id, jahr, monat, absatz, effektiver_vk').eq('user_id', user!.id).eq('plan_version_id', versionId).in('jahr', planJahre).order('id', { ascending: true }).range(from, to)),
    supabase.from('langfristige_retouren_allgemein_produkt_einstellungen').select('produkt_id, retourenquote_prozent').eq('user_id', user!.id).eq('plan_version_id', versionId).limit(500),
    fetchAllRows((from, to) => supabase.from('langfristige_retouren_einstellungen').select('sales_plattform_id, produkt_id, erstattung_verkaufsgebuehr_prozent, rueckversandkosten_euro_netto').eq('user_id', user!.id).eq('plan_version_id', versionId).order('id', { ascending: true }).range(from, to)),
    fetchAllRows((from, to) => supabase.from('langfristige_verkaufsgebuehr_einstellungen').select('sales_plattform_id, produkt_id, verkaufsgebuehr_prozent').eq('user_id', user!.id).eq('plan_version_id', versionId).order('id', { ascending: true }).range(from, to)),
    fetchAllRows((from, to) => supabase.from('langfristige_marketing_planung').select('marketingkanal_id, produkt_id, jahr, monat, marketingkosten_pct').eq('user_id', user!.id).eq('plan_version_id', versionId).in('jahr', planJahre).order('id', { ascending: true }).range(from, to)),
    supabase.from('langfristige_marketing_einstellungen').select('marketingkanal_id, sales_plattform_id').eq('user_id', user!.id).eq('plan_version_id', versionId).limit(500),
    supabase.from('langfristige_auszahlungs_marketingkanaele').select('marketingkanal_id').eq('user_id', user!.id).eq('plan_version_id', versionId).limit(1000),
    supabase.from('langfristige_ust_kategorie_saetze').select('kategorie_id, ebene, ust_satz').eq('user_id', user!.id).eq('plan_version_id', versionId).limit(1000),
    supabase.from('langfristige_ust_ebene_auswahl').select('kategorie_id, ebene').eq('user_id', user!.id).eq('plan_version_id', versionId).limit(500),
  ])

  for (const r of [plattResult, prodResult, absatzResult, retourenAllgResult, retourenResult, vkGebResult, marketingPlanResult, marketingEinstResult, auszahlungsResult, ustSatzResult, ustEbeneResult]) {
    if (r.error) return NextResponse.json({ error: r.error.message }, { status: 500 })
  }

  const plattformen = (plattResult.data ?? []) as KpiKat[]
  const produkte = (prodResult.data ?? []) as KpiKat[]
  if (plattformen.length === 0 || produkte.length === 0) return NextResponse.json([])

  // ── Lookup-Maps aufbauen ──────────────────────────────────────────────────

  // Absatz/VK je Plattform×Produkt×Monat
  const absatzMap = new Map<string, { absatz: number; vk: number | null }>()
  for (const r of (absatzResult.data ?? []) as AbsatzRow[]) {
    absatzMap.set(`${r.sales_plattform_id}:${r.produkt_id}:${r.jahr}:${r.monat}`, {
      absatz: r.absatz != null ? Number(r.absatz) : 0,
      vk: r.effektiver_vk != null ? Number(r.effektiver_vk) : null,
    })
  }

  // Retourenquote je Produkt (manuell, plattformunabhängig)
  const retourenquoteMap = new Map<string, number>()
  for (const r of (retourenAllgResult.data ?? []) as RetourenAllgRow[]) {
    retourenquoteMap.set(r.produkt_id, r.retourenquote_prozent != null ? Number(r.retourenquote_prozent) / 100 : 0)
  }

  // Retouren-Plattform-Werte je Produkt×Plattform
  const retourenMap = new Map<string, { erstattungPct: number | null; rueckversand: number }>()
  for (const r of (retourenResult.data ?? []) as RetourenRow[]) {
    retourenMap.set(`${r.produkt_id}:${r.sales_plattform_id}`, {
      erstattungPct: r.erstattung_verkaufsgebuehr_prozent != null ? Number(r.erstattung_verkaufsgebuehr_prozent) : null,
      rueckversand: r.rueckversandkosten_euro_netto != null ? Number(r.rueckversandkosten_euro_netto) : 0,
    })
  }

  // Verkaufsgebühr% je Produkt×Plattform
  const vkGebMap = new Map<string, number | null>()
  for (const r of (vkGebResult.data ?? []) as VkGebRow[]) {
    vkGebMap.set(`${r.produkt_id}:${r.sales_plattform_id}`, r.verkaufsgebuehr_prozent != null ? Number(r.verkaufsgebuehr_prozent) : null)
  }

  // Marketing-%-Sätze je Kanal×Produkt×Monat
  const marketingPctMap = new Map<string, number>()
  for (const r of (marketingPlanResult.data ?? []) as MarketingPlanRow[]) {
    if (r.marketingkosten_pct != null) {
      marketingPctMap.set(`${r.marketingkanal_id}:${r.produkt_id}:${r.jahr}:${r.monat}`, Number(r.marketingkosten_pct))
    }
  }

  // Kanal → Plattform (für die Bruttoumsatz-Basis)
  const kanalPlattform = new Map<string, string | null>()
  for (const r of (marketingEinstResult.data ?? []) as MarketingEinstRow[]) {
    kanalPlattform.set(r.marketingkanal_id, r.sales_plattform_id ?? null)
  }

  // In den Auszahlungseinstellungen zugeordnete (= berücksichtigte) Marketingkanäle
  const inkludierteKanaele = new Set<string>(
    ((auszahlungsResult.data ?? []) as AuszahlungsKanalRow[]).map(r => r.marketingkanal_id),
  )

  // USt-Sätze + Ebenen-Auswahl
  const ustRateMap = new Map<string, number>()
  for (const r of (ustSatzResult.data ?? []) as UstSatzRow[]) {
    if (r.ust_satz != null) ustRateMap.set(`${r.kategorie_id}:${r.ebene}`, Number(r.ust_satz))
  }
  const ustEbeneMap = new Map<string, 1 | 2>()
  for (const r of (ustEbeneResult.data ?? []) as { kategorie_id: string; ebene: number }[]) {
    ustEbeneMap.set(r.kategorie_id, r.ebene as 1 | 2)
  }

  function getUstMultiplier(specificId: string | null, parentId: string | null): number {
    if (parentId) {
      const ebene = ustEbeneMap.get(parentId) ?? 1 // default: Gesamt (ebene=1)
      if (ebene === 1) {
        const r = ustRateMap.get(`${parentId}:1`)
        if (r != null) return 1 + r / 100
      } else if (specificId) {
        const r = ustRateMap.get(`${specificId}:2`)
        if (r != null) return 1 + r / 100
      }
    }
    if (specificId) {
      const r2 = ustRateMap.get(`${specificId}:2`)
      if (r2 != null) return 1 + r2 / 100
      const r1 = ustRateMap.get(`${specificId}:1`)
      if (r1 != null) return 1 + r1 / 100
    }
    return 1
  }

  const vkGebUst = getUstMultiplier(vkGebRootId, vertriebParentId)
  const retourenUst = getUstMultiplier(retourenRootId, vertriebParentId)

  // ── Berechnung je Plattform × Produkt × Monat ─────────────────────────────

  interface ResultRow { kategorie: string; produkt_id: string; sales_plattform_id: string; jahr: number; monat: number; wert: number }
  const results: ResultRow[] = []
  // Bruttoumsatz-Akkumulatoren für die Marketing-Basis
  const bruttoByProdPlattMonat = new Map<string, number>()
  const bruttoByProdMonat = new Map<string, number>()

  for (const plt of plattformen) {
    for (const prd of produkte) {
      for (const mon of monate) {
        const ap = absatzMap.get(`${plt.id}:${prd.id}:${mon.jahr}:${mon.monat}`)
        const vk = ap?.vk ?? null
        if (vk == null || vk === 0) continue
        const absatz = ap?.absatz ?? 0
        const bruttoumsatz = round2(absatz * vk)
        if (bruttoumsatz === 0) continue

        results.push({ kategorie: 'bruttoumsatz', produkt_id: prd.id, sales_plattform_id: plt.id, jahr: mon.jahr, monat: mon.monat, wert: bruttoumsatz })
        bruttoByProdPlattMonat.set(`${prd.id}:${plt.id}:${mon.jahr}:${mon.monat}`, bruttoumsatz)
        const prodMonatKey = `${prd.id}:${mon.jahr}:${mon.monat}`
        bruttoByProdMonat.set(prodMonatKey, (bruttoByProdMonat.get(prodMonatKey) ?? 0) + bruttoumsatz)

        const retourenquote = retourenquoteMap.get(prd.id) ?? 0

        // Rückerstattungen
        if (retourenquote > 0) {
          results.push({ kategorie: 'rueckerstattungen', produkt_id: prd.id, sales_plattform_id: plt.id, jahr: mon.jahr, monat: mon.monat, wert: round2(retourenquote * bruttoumsatz) })
        }

        // Verkaufsgebühr (USt oben drauf)
        const vkGebProzent = vkGebMap.get(`${prd.id}:${plt.id}`) ?? null
        const retEinst = retourenMap.get(`${prd.id}:${plt.id}`)
        const erstattungFraction = retEinst?.erstattungPct != null ? retEinst.erstattungPct / 100 : 0
        if (vkGebProzent != null && vkGebProzent > 0) {
          const vkGeb = bruttoumsatz * (vkGebProzent / 100) - bruttoumsatz * retourenquote * erstattungFraction
          if (vkGeb !== 0) {
            results.push({ kategorie: 'verkaufsgebuehr', produkt_id: prd.id, sales_plattform_id: plt.id, jahr: mon.jahr, monat: mon.monat, wert: round2(vkGeb * vkGebUst) })
          }
        }

        // Retourenkosten (USt oben drauf)
        const rueckversand = retEinst?.rueckversand ?? 0
        if (retourenquote > 0) {
          const retourenKosten = retourenquote * absatz * rueckversand
          if (retourenKosten !== 0) {
            results.push({ kategorie: 'retouren', produkt_id: prd.id, sales_plattform_id: plt.id, jahr: mon.jahr, monat: mon.monat, wert: round2(retourenKosten * retourenUst) })
          }
        }
      }
    }
  }

  // ── Marketing je Produkt × Marketingkanal × Monat ─────────────────────────
  // Iteriert direkt die gepflegten %-Werte; nur zugeordnete Kanäle & gültige Monate.
  for (const r of (marketingPlanResult.data ?? []) as MarketingPlanRow[]) {
    const kanalId = r.marketingkanal_id
    if (!inkludierteKanaele.has(kanalId)) continue
    if (!monatSet.has(`${r.jahr}:${r.monat}`)) continue
    const pct = marketingPctMap.get(`${kanalId}:${r.produkt_id}:${r.jahr}:${r.monat}`)
    if (pct == null || pct <= 0) continue

    const plattformId = kanalPlattform.get(kanalId) ?? null
    const base = plattformId
      ? (bruttoByProdPlattMonat.get(`${r.produkt_id}:${plattformId}:${r.jahr}:${r.monat}`) ?? 0)
      : (bruttoByProdMonat.get(`${r.produkt_id}:${r.jahr}:${r.monat}`) ?? 0)
    if (base === 0) continue

    const wert = round2(base * (pct / 100) * getUstMultiplier(kanalId, marketingL1Id))
    results.push({ kategorie: 'marketing', produkt_id: r.produkt_id, sales_plattform_id: kanalId, jahr: r.jahr, monat: r.monat, wert })
  }

  return NextResponse.json(results)
}
