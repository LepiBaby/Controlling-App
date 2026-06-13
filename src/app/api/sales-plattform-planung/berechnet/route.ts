import { NextResponse } from 'next/server'
import { requireAuth } from '@/lib/supabase-server'

// ─── ISO week helpers ─────────────────────────────────────────────────────────

function getISOWeekMonday(d: Date): Date {
  const day = d.getUTCDay() || 7
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate() - (day - 1)))
}

function getISOWeekInfo(d: Date): { year: number; week: number } {
  const thu = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate() + (4 - (d.getUTCDay() || 7))))
  const yearStart = new Date(Date.UTC(thu.getUTCFullYear(), 0, 1))
  const week = Math.ceil(((thu.getTime() - yearStart.getTime()) / 86400000 + 1) / 7)
  return { year: thu.getUTCFullYear(), week }
}

function toDateOnly(d: Date): string {
  return d.toISOString().slice(0, 10)
}

function addDays(d: Date, n: number): Date {
  return new Date(d.getTime() + n * 86400000)
}

function getPeriodDays(berechnungsart: string): number {
  if (berechnungsart.endsWith('_7')) return 7
  if (berechnungsart.endsWith('_14')) return 14
  if (berechnungsart.endsWith('_30')) return 30
  if (berechnungsart.endsWith('_60')) return 60
  if (berechnungsart.endsWith('_90')) return 90
  return 30
}

// ─── Types ────────────────────────────────────────────────────────────────────

interface KatRow { id: string; name: string; parent_id: string | null; type: string; ist_abzugsposten: boolean; level: number }
interface GewichtungEinstellung { gewichtung_erstes_drittel: number | null; gewichtung_zweites_drittel: number | null; gewichtung_drittes_drittel: number | null }
interface AbsatzEinstellung extends GewichtungEinstellung { sales_plattform_id: string; produkt_id: string; berechnungsart: string }
interface AbsatzPlanungRow { sku_id: string | null; produkt_id: string; sales_plattform_id: string; kw_year: number; kw_number: number; absatz_manuell: number | null; effektiver_vk_manuell: number | null }
interface RetourenEinstellung { sales_plattform_id: string; produkt_id: string; berechnungsart: string; rueckversandkosten_euro_netto: number | null; retourenhandling_kosten_euro_netto: number | null }
interface RetourenPlattEinstellung { sales_plattform_id: string; erstattung_verkaufsgebuehr_prozent: number | null }
interface VkGebEinstellung { sales_plattform_id: string; produkt_id: string; verkaufsgebuehr_prozent: number | null }
interface MarketingPlanungRow { produkt_id: string; sales_plattform_id: string; kw_year: number; kw_number: number; marketingkosten_pct_manuell: number | null }
interface MarketingEinstellung extends GewichtungEinstellung { sales_plattform_id: string; produkt_id: string; berechnungsart: string }
interface UmsatzTransRow { produkt_id: string; sales_plattform_id: string; leistungsdatum: string; betrag: number; kategorie_id: string }
interface AusgabenTransRow { produkt_id: string; sales_plattform_id: string; leistungsdatum: string; betrag_netto: number }
interface SendungRow { plattform_id: string; menge: number }
interface BestandRow { sku_id: string; datum: string; bestand_sendungen: SendungRow[] }

// ─── Handler ──────────────────────────────────────────────────────────────────

export async function GET() {
  const { user, supabase, error } = await requireAuth()
  if (error) return error

  // 1. Load grundeinstellungen + kpi_categories
  const [grundResult, katsResult] = await Promise.all([
    supabase.from('grundeinstellungen').select('planungshorizont_wochen').eq('user_id', user!.id).maybeSingle(),
    supabase.from('kpi_categories').select('id, name, parent_id, type, ist_abzugsposten, level').limit(2000),
  ])

  if (katsResult.error) return NextResponse.json({ error: katsResult.error.message }, { status: 500 })

  const planungsHorizont = grundResult.data?.planungshorizont_wochen ?? 13
  const kats = (katsResult.data ?? []) as KatRow[]

  // 2. Compute future weeks
  const today = new Date()
  today.setUTCHours(0, 0, 0, 0)
  const todayStr = toDateOnly(today)
  const currentMonday = getISOWeekMonday(today)
  const planungswochen: { year: number; week: number }[] = []
  for (let i = 0; i < planungsHorizont; i++) {
    const monday = new Date(currentMonday.getTime() + i * 7 * 86400000)
    planungswochen.push(getISOWeekInfo(monday))
  }
  if (planungswochen.length === 0) return NextResponse.json([])

  // 3. Build category sets
  const childrenMap = new Map<string, string[]>()
  for (const k of kats) {
    if (k.parent_id) {
      if (!childrenMap.has(k.parent_id)) childrenMap.set(k.parent_id, [])
      childrenMap.get(k.parent_id)!.push(k.id)
    }
  }
  function getDescendants(rootId: string): Set<string> {
    const result = new Set<string>([rootId])
    const queue = [rootId]
    while (queue.length > 0) {
      const curr = queue.shift()!
      for (const child of childrenMap.get(curr) ?? []) { result.add(child); queue.push(child) }
    }
    return result
  }

  const bruttoUmsatzIds = new Set<string>()
  const rueckerstattungsIds = new Set<string>()
  const rabatteIds = new Set<string>()
  const marketingKatIds = new Set<string>()
  for (const k of kats) {
    if (k.type === 'umsatz' && !k.ist_abzugsposten && k.level === 1) {
      for (const id of getDescendants(k.id)) bruttoUmsatzIds.add(id)
    }
    if (k.type === 'umsatz' && k.ist_abzugsposten && k.name.toLowerCase().includes('rückerstattung')) {
      for (const id of getDescendants(k.id)) rueckerstattungsIds.add(id)
    }
    if (k.type === 'umsatz' && k.ist_abzugsposten && k.name.toLowerCase().startsWith('rabatt')) {
      for (const id of getDescendants(k.id)) rabatteIds.add(id)
    }
    if (k.type === 'ausgaben_kosten' && k.name.toLowerCase() === 'marketing' && k.level === 1) {
      for (const id of getDescendants(k.id)) marketingKatIds.add(id)
    }
  }

  const plattformen = kats.filter(k => k.type === 'sales_plattformen')
  const produkte = kats.filter(k => k.type === 'produkte' && k.level === 1)
  const skus = kats.filter(k => k.type === 'produkte' && k.level === 2)
  if (plattformen.length === 0 || produkte.length === 0) return NextResponse.json([])

  const skusByProdukt = new Map<string, string[]>()
  for (const s of skus) {
    if (!s.parent_id) continue
    if (!skusByProdukt.has(s.parent_id)) skusByProdukt.set(s.parent_id, [])
    skusByProdukt.get(s.parent_id)!.push(s.id)
  }

  // 4. Load all needed data in parallel
  const histStartStr = toDateOnly(addDays(today, -90))
  const planYears = [...new Set(planungswochen.map(w => w.year))]
  const marketingKatIdsArr = [...marketingKatIds]

  const [
    absatzPlanResult, absatzEinstResult, bestandResult,
    retourenEinstResult, retourenPlattResult, vkGebResult,
    marketingPlanResult, marketingEinstResult,
    umsatzTransResult, marketingAusgResult,
  ] = await Promise.all([
    supabase.from('absatz_planung')
      .select('sku_id, produkt_id, sales_plattform_id, kw_year, kw_number, absatz_manuell, effektiver_vk_manuell')
      .eq('user_id', user!.id).in('kw_year', planYears).limit(10000),
    supabase.from('absatz_einstellungen')
      .select('sales_plattform_id, produkt_id, berechnungsart, gewichtung_erstes_drittel, gewichtung_zweites_drittel, gewichtung_drittes_drittel')
      .eq('user_id', user!.id).neq('berechnungsart', 'keine').limit(500),
    skus.length > 0
      ? supabase.from('bestand_transaktionen')
          .select('sku_id, datum, bestand_sendungen(plattform_id, menge)')
          .gte('datum', histStartStr).lt('datum', todayStr).in('sku_id', skus.map(s => s.id)).limit(10000)
      : Promise.resolve({ data: [], error: null }),
    supabase.from('retouren_einstellungen')
      .select('sales_plattform_id, produkt_id, berechnungsart, rueckversandkosten_euro_netto, retourenhandling_kosten_euro_netto')
      .eq('user_id', user!.id).limit(500),
    supabase.from('retouren_plattform_einstellungen')
      .select('sales_plattform_id, erstattung_verkaufsgebuehr_prozent')
      .eq('user_id', user!.id).limit(100),
    supabase.from('verkaufsgebuehr_einstellungen')
      .select('sales_plattform_id, produkt_id, verkaufsgebuehr_prozent')
      .eq('user_id', user!.id).limit(500),
    supabase.from('marketing_planung')
      .select('produkt_id, sales_plattform_id, kw_year, kw_number, marketingkosten_pct_manuell')
      .eq('user_id', user!.id).in('kw_year', planYears).limit(2000),
    supabase.from('marketing_einstellungen')
      .select('sales_plattform_id, produkt_id, berechnungsart, gewichtung_erstes_drittel, gewichtung_zweites_drittel, gewichtung_drittes_drittel')
      .eq('user_id', user!.id).neq('berechnungsart', 'keine').limit(500),
    supabase.from('umsatz_transaktionen')
      .select('produkt_id, sales_plattform_id, leistungsdatum, betrag, kategorie_id')
      .gte('leistungsdatum', histStartStr).lt('leistungsdatum', todayStr)
      .not('produkt_id', 'is', null).not('sales_plattform_id', 'is', null).limit(30000),
    marketingKatIdsArr.length > 0
      ? supabase.from('ausgaben_kosten_transaktionen')
          .select('produkt_id, sales_plattform_id, leistungsdatum, betrag_netto')
          .gte('leistungsdatum', histStartStr).lt('leistungsdatum', todayStr)
          .in('kategorie_id', marketingKatIdsArr).eq('relevanz', 'rentabilitaet')
          .not('produkt_id', 'is', null).not('sales_plattform_id', 'is', null).limit(20000)
      : Promise.resolve({ data: [], error: null }),
  ])

  for (const r of [absatzPlanResult, absatzEinstResult, retourenEinstResult, retourenPlattResult, vkGebResult, marketingPlanResult, marketingEinstResult, umsatzTransResult]) {
    if ('error' in r && r.error) return NextResponse.json({ error: r.error.message }, { status: 500 })
  }
  if (bestandResult.error) return NextResponse.json({ error: bestandResult.error.message }, { status: 500 })
  if (marketingAusgResult.error) return NextResponse.json({ error: marketingAusgResult.error.message }, { status: 500 })

  // ── 5. Build lookup maps ────────────────────────────────────────────────

  // Absatz SKU: "skuId:plattId:year:week" → absatz_manuell
  const absatzSkuMap = new Map<string, number>()
  // VK per produkt×plattform×kw: "prodId:plattId:year:week" → effektiver_vk_manuell
  const vkPlanMap = new Map<string, number>()
  for (const row of (absatzPlanResult.data ?? []) as AbsatzPlanungRow[]) {
    if (row.sku_id != null && row.absatz_manuell != null) {
      absatzSkuMap.set(`${row.sku_id}:${row.sales_plattform_id}:${row.kw_year}:${row.kw_number}`, Number(row.absatz_manuell))
    }
    if (row.sku_id == null && row.effektiver_vk_manuell != null) {
      vkPlanMap.set(`${row.produkt_id}:${row.sales_plattform_id}:${row.kw_year}:${row.kw_number}`, Number(row.effektiver_vk_manuell))
    }
  }

  // Bestand by "skuId:plattId" → [{datum, menge}]
  const bestandBySkuPlatt = new Map<string, { datum: string; menge: number }[]>()
  for (const t of (bestandResult.data ?? []) as BestandRow[]) {
    for (const s of t.bestand_sendungen ?? []) {
      const key = `${t.sku_id}:${s.plattform_id}`
      if (!bestandBySkuPlatt.has(key)) bestandBySkuPlatt.set(key, [])
      bestandBySkuPlatt.get(key)!.push({ datum: t.datum, menge: Number(s.menge) })
    }
  }

  const absatzEinstMap = new Map<string, AbsatzEinstellung>()
  for (const e of (absatzEinstResult.data ?? []) as AbsatzEinstellung[]) {
    absatzEinstMap.set(`${e.produkt_id}:${e.sales_plattform_id}`, e)
  }

  function calcTagesdurchschnitt(skuId: string, plattformId: string, produktId: string): number {
    const einst = absatzEinstMap.get(`${produktId}:${plattformId}`)
    const berechnungsart = einst?.berechnungsart ?? 'mittelwert_30'
    const periodDays = getPeriodDays(berechnungsart)
    const periodStart = addDays(today, -periodDays)
    const startStr = toDateOnly(periodStart)
    const entries = bestandBySkuPlatt.get(`${skuId}:${plattformId}`) ?? []

    if (berechnungsart.startsWith('gewichtet_') && einst) {
      const third = periodDays / 3
      const t1 = toDateOnly(periodStart)
      const t2 = toDateOnly(addDays(periodStart, third))
      const t3 = toDateOnly(addDays(periodStart, third * 2))
      const s1 = entries.filter(e => e.datum >= t1 && e.datum < t2).reduce((a, e) => a + e.menge, 0)
      const s2 = entries.filter(e => e.datum >= t2 && e.datum < t3).reduce((a, e) => a + e.menge, 0)
      const s3 = entries.filter(e => e.datum >= t3 && e.datum < todayStr).reduce((a, e) => a + e.menge, 0)
      const w1 = einst.gewichtung_erstes_drittel
      const w2 = einst.gewichtung_zweites_drittel
      const w3 = einst.gewichtung_drittes_drittel
      if (w1 != null && w2 != null && w3 != null) {
        return Math.round(((w1 * (s1 / third) + w2 * (s2 / third) + w3 * (s3 / third)) / 100) * 100) / 100
      }
      return Math.round(((s1 + s2 + s3) / periodDays) * 100) / 100
    }
    const total = entries.filter(e => e.datum >= startStr && e.datum < todayStr).reduce((a, e) => a + e.menge, 0)
    return Math.round((total / periodDays) * 100) / 100
  }

  // Umsatz trans by "prodId:plattId"
  const bruttoByKombi = new Map<string, { datum: string; betrag: number }[]>()
  const rueckByKombi = new Map<string, { datum: string; betrag: number }[]>()
  const umsatzFuerMktByKombi = new Map<string, { datum: string; betrag: number }[]>()
  for (const row of (umsatzTransResult.data ?? []) as UmsatzTransRow[]) {
    if (!row.produkt_id || !row.sales_plattform_id) continue
    const key = `${row.produkt_id}:${row.sales_plattform_id}`
    const isAbzug = !bruttoUmsatzIds.has(row.kategorie_id)
    const isRabatt = rabatteIds.has(row.kategorie_id)
    if (bruttoUmsatzIds.has(row.kategorie_id)) {
      if (!bruttoByKombi.has(key)) bruttoByKombi.set(key, [])
      bruttoByKombi.get(key)!.push({ datum: row.leistungsdatum, betrag: Number(row.betrag) })
    } else if (rueckerstattungsIds.has(row.kategorie_id)) {
      if (!rueckByKombi.has(key)) rueckByKombi.set(key, [])
      rueckByKombi.get(key)!.push({ datum: row.leistungsdatum, betrag: Number(row.betrag) })
    }
    if (!isAbzug || isRabatt) {
      if (!umsatzFuerMktByKombi.has(key)) umsatzFuerMktByKombi.set(key, [])
      umsatzFuerMktByKombi.get(key)!.push({ datum: row.leistungsdatum, betrag: isRabatt ? -Number(row.betrag) : Number(row.betrag) })
    }
  }

  const retourenEinstMap = new Map<string, RetourenEinstellung>()
  for (const e of (retourenEinstResult.data ?? []) as RetourenEinstellung[]) {
    retourenEinstMap.set(`${e.produkt_id}:${e.sales_plattform_id}`, e)
  }

  const erstattungPctMap = new Map<string, number | null>()
  for (const e of (retourenPlattResult.data ?? []) as RetourenPlattEinstellung[]) {
    erstattungPctMap.set(e.sales_plattform_id, e.erstattung_verkaufsgebuehr_prozent)
  }

  const vkGebProzentMap = new Map<string, number | null>()
  for (const e of (vkGebResult.data ?? []) as VkGebEinstellung[]) {
    vkGebProzentMap.set(`${e.produkt_id}:${e.sales_plattform_id}`, e.verkaufsgebuehr_prozent)
  }

  const marketingManualMap = new Map<string, number>()
  for (const m of (marketingPlanResult.data ?? []) as MarketingPlanungRow[]) {
    if (m.marketingkosten_pct_manuell != null) {
      marketingManualMap.set(`${m.produkt_id}:${m.sales_plattform_id}:${m.kw_year}:${m.kw_number}`, Number(m.marketingkosten_pct_manuell))
    }
  }

  const marketingEinstMap = new Map<string, MarketingEinstellung>()
  for (const e of (marketingEinstResult.data ?? []) as MarketingEinstellung[]) {
    marketingEinstMap.set(`${e.produkt_id}:${e.sales_plattform_id}`, e)
  }

  const mktAusgByKombi = new Map<string, { datum: string; betrag_netto: number }[]>()
  for (const row of (marketingAusgResult.data ?? []) as AusgabenTransRow[]) {
    if (!row.produkt_id || !row.sales_plattform_id) continue
    const key = `${row.produkt_id}:${row.sales_plattform_id}`
    if (!mktAusgByKombi.has(key)) mktAusgByKombi.set(key, [])
    mktAusgByKombi.get(key)!.push({ datum: row.leistungsdatum, betrag_netto: Number(row.betrag_netto) })
  }

  // ── 6. Precompute retourenquote and marketing pct per produkt×plattform ──

  const retourenquoteCache = new Map<string, number>()
  function getRetourenquote(produktId: string, plattformId: string): number {
    const key = `${produktId}:${plattformId}`
    if (retourenquoteCache.has(key)) return retourenquoteCache.get(key)!
    const einst = retourenEinstMap.get(key)
    if (!einst || einst.berechnungsart === 'keine') { retourenquoteCache.set(key, 0); return 0 }
    const periodDays = getPeriodDays(einst.berechnungsart)
    const startStr = toDateOnly(addDays(today, -periodDays))
    const brutto = (bruttoByKombi.get(key) ?? []).filter(r => r.datum >= startStr && r.datum < todayStr)
    const rueck = (rueckByKombi.get(key) ?? []).filter(r => r.datum >= startStr && r.datum < todayStr)
    const sumBrutto = brutto.reduce((a, r) => a + r.betrag, 0)
    const sumRueck = rueck.reduce((a, r) => a + r.betrag, 0)
    const quote = sumBrutto > 0 ? sumRueck / sumBrutto : 0
    retourenquoteCache.set(key, quote)
    return quote
  }

  const marketingPctCache = new Map<string, number>()
  function getMarketingHistorischPct(produktId: string, plattformId: string): number {
    const key = `${produktId}:${plattformId}`
    if (marketingPctCache.has(key)) return marketingPctCache.get(key)!
    const einst = marketingEinstMap.get(key)
    if (!einst) { marketingPctCache.set(key, 0); return 0 }
    const periodDays = getPeriodDays(einst.berechnungsart)
    const startStr = toDateOnly(addDays(today, -periodDays))
    const ausgaben = (mktAusgByKombi.get(key) ?? []).filter(r => r.datum >= startStr && r.datum < todayStr)
    const umsatzRows = (umsatzFuerMktByKombi.get(key) ?? []).filter(r => r.datum >= startStr && r.datum < todayStr)
    const sumAusg = ausgaben.reduce((a, r) => a + r.betrag_netto, 0)
    const sumUmsatz = umsatzRows.reduce((a, r) => a + r.betrag, 0)
    const pct = sumUmsatz > 0 ? Math.round((sumAusg / sumUmsatz) * 100 * 100) / 100 : 0
    marketingPctCache.set(key, pct)
    return pct
  }

  // ── 7. Compute values for each kw × plattform × produkt ──────────────────

  interface ResultRow { kategorie: string; produkt_id: string; sales_plattform_id: string; kw_year: number; kw_number: number; wert: number }
  const results: ResultRow[] = []

  for (const kw of planungswochen) {
    for (const plt of plattformen) {
      for (const prd of produkte) {
        // VK for this kw×produkt×plattform (product-level)
        const vk = vkPlanMap.get(`${prd.id}:${plt.id}:${kw.year}:${kw.week}`) ?? null
        if (vk == null || vk === 0) continue

        // Product absatz = sum of SKU absatz
        const productSkus = skusByProdukt.get(prd.id) ?? []
        let productAbsatz = 0
        for (const skuId of productSkus) {
          const manual = absatzSkuMap.get(`${skuId}:${plt.id}:${kw.year}:${kw.week}`)
          productAbsatz += manual != null ? manual : calcTagesdurchschnitt(skuId, plt.id, prd.id) * 7
        }

        const bruttoumsatz = Math.round(productAbsatz * vk * 100) / 100
        if (bruttoumsatz === 0) continue

        results.push({ kategorie: 'bruttoumsatz', produkt_id: prd.id, sales_plattform_id: plt.id, kw_year: kw.year, kw_number: kw.week, wert: bruttoumsatz })

        const retourenquote = getRetourenquote(prd.id, plt.id)

        if (retourenquote > 0) {
          results.push({
            kategorie: 'rueckerstattungen',
            produkt_id: prd.id, sales_plattform_id: plt.id, kw_year: kw.year, kw_number: kw.week,
            wert: Math.round(retourenquote * bruttoumsatz * 100) / 100,
          })
        }

        const vkGebProzent = vkGebProzentMap.get(`${prd.id}:${plt.id}`) ?? null
        if (vkGebProzent != null && vkGebProzent > 0) {
          results.push({
            kategorie: 'verkaufsgebuehr',
            produkt_id: prd.id, sales_plattform_id: plt.id, kw_year: kw.year, kw_number: kw.week,
            wert: Math.round(bruttoumsatz * (vkGebProzent / 100) * 100) / 100,
          })
        }

        const retourenEinst = retourenEinstMap.get(`${prd.id}:${plt.id}`)
        if (retourenEinst && retourenEinst.berechnungsart !== 'keine' && retourenquote > 0) {
          const rueckversand = Number(retourenEinst.rueckversandkosten_euro_netto ?? 0)
          const handling = Number(retourenEinst.retourenhandling_kosten_euro_netto ?? 0)
          const erstattungPct = erstattungPctMap.get(plt.id) ?? null
          const erstattungFraction = erstattungPct != null ? Number(erstattungPct) / 100 : 0
          const retourenKosten = retourenquote * productAbsatz * (rueckversand + handling)
            - bruttoumsatz * retourenquote * erstattungFraction
          if (retourenKosten !== 0) {
            results.push({
              kategorie: 'retouren',
              produkt_id: prd.id, sales_plattform_id: plt.id, kw_year: kw.year, kw_number: kw.week,
              wert: Math.round(retourenKosten * 100) / 100,
            })
          }
        }

        const marketingManual = marketingManualMap.get(`${prd.id}:${plt.id}:${kw.year}:${kw.week}`)
        const marketingPct = marketingManual != null ? marketingManual : getMarketingHistorischPct(prd.id, plt.id)
        if (marketingPct > 0) {
          results.push({
            kategorie: 'marketing',
            produkt_id: prd.id, sales_plattform_id: plt.id, kw_year: kw.year, kw_number: kw.week,
            wert: Math.round(bruttoumsatz * (marketingPct / 100) * 100) / 100,
          })
        }
      }
    }
  }

  return NextResponse.json(results)
}
