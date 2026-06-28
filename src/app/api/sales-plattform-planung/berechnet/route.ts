import { NextResponse } from 'next/server'
import { requireAuth } from '@/lib/supabase-server'
import { fetchAllRows } from '@/lib/supabase-paginate'

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
interface RetourenEinstellung { sales_plattform_id: string; produkt_id: string; berechnungsart: string; rueckversandkosten_euro_netto: number | null; retourenhandling_kosten_euro_netto: number | null; erstattung_verkaufsgebuehr_prozent: number | null }
interface RetourenAllgemeinProduktEinstellung { produkt_id: string; berechnungsart: string }
interface VkGebEinstellung { sales_plattform_id: string; produkt_id: string; verkaufsgebuehr_prozent: number | null }
interface MarketingPlanungRow { produkt_id: string; kategorie_id: string; kw_year: number; kw_number: number; marketingkosten_pct_manuell: number | null }
interface MarketingEinstellung extends GewichtungEinstellung { kategorie_id: string; produkt_id: string; berechnungsart: string }
interface UmsatzTransRow { produkt_id: string; sales_plattform_id: string; leistungsdatum: string; betrag: number; kategorie_id: string }
interface AusgabenTransRow { produkt_id: string; kategorie_id: string; leistungsdatum: string; betrag_netto: number }
interface SendungRow { plattform_id: string; menge: number }
interface BestandRow { sku_id: string; datum: string; bestand_sendungen: SendungRow[] }

// ─── Handler ──────────────────────────────────────────────────────────────────

export async function GET() {
  const { user, supabase, error } = await requireAuth()
  if (error) return error

  // 1. Load grundeinstellungen + kpi_categories
  const [grundResult, katsResult] = await Promise.all([
    supabase.from('grundeinstellungen').select('planungshorizont_wochen').eq('user_id', user!.id).maybeSingle(),
    fetchAllRows((from, to) => supabase.from('kpi_categories').select('id, name, parent_id, type, ist_abzugsposten, level').order('id', { ascending: true }).range(from, to)),
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

  // Root category IDs for UST rate lookup
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

  // 4. Load all needed data in parallel
  const histStartStr = toDateOnly(addDays(today, -90))
  const planYears = [...new Set(planungswochen.map(w => w.year))]
  const marketingKatIdsArr = [...marketingKatIds]

  const [
    absatzPlanResult, absatzEinstResult, bestandResult,
    retourenEinstResult, retourenPlattResult, retourenAllgemeinResult, vkGebResult,
    marketingPlanResult, marketingEinstResult,
    umsatzTransResult, marketingAusgResult, ustResult,
    auszahlungsMarketingResult, mktKatPlattResult, ustEbeneResult,
  ] = await Promise.all([
    fetchAllRows((from, to) => supabase.from('absatz_planung')
      .select('sku_id, produkt_id, sales_plattform_id, kw_year, kw_number, absatz_manuell, effektiver_vk_manuell')
      .eq('user_id', user!.id).in('kw_year', planYears).order('id', { ascending: true }).range(from, to)),
    supabase.from('absatz_einstellungen')
      .select('sales_plattform_id, produkt_id, berechnungsart, gewichtung_erstes_drittel, gewichtung_zweites_drittel, gewichtung_drittes_drittel')
      .eq('user_id', user!.id).neq('berechnungsart', 'keine').limit(500),
    skus.length > 0
      ? fetchAllRows((from, to) => supabase.from('bestand_transaktionen')
          .select('sku_id, datum, bestand_sendungen(plattform_id, menge)')
          .gte('datum', histStartStr).lt('datum', todayStr).in('sku_id', skus.map(s => s.id)).order('id', { ascending: true }).range(from, to))
      : Promise.resolve({ data: [], error: null }),
    supabase.from('retouren_einstellungen')
      .select('sales_plattform_id, produkt_id, berechnungsart, rueckversandkosten_euro_netto, retourenhandling_kosten_euro_netto, erstattung_verkaufsgebuehr_prozent')
      .eq('user_id', user!.id).limit(500),
    Promise.resolve({ data: [], error: null }), // retouren_plattform_einstellungen no longer used
    supabase.from('retouren_allgemein_produkt_einstellungen')
      .select('produkt_id, berechnungsart')
      .eq('user_id', user!.id).limit(500),
    supabase.from('verkaufsgebuehr_einstellungen')
      .select('sales_plattform_id, produkt_id, verkaufsgebuehr_prozent')
      .eq('user_id', user!.id).limit(500),
    fetchAllRows((from, to) => supabase.from('marketing_planung')
      .select('produkt_id, kategorie_id, kw_year, kw_number, marketingkosten_pct_manuell')
      .eq('user_id', user!.id).in('kw_year', planYears).order('id', { ascending: true }).range(from, to)),
    supabase.from('marketing_einstellungen')
      .select('kategorie_id, produkt_id, berechnungsart, gewichtung_erstes_drittel, gewichtung_zweites_drittel, gewichtung_drittes_drittel')
      .eq('user_id', user!.id).neq('berechnungsart', 'keine').limit(500),
    fetchAllRows((from, to) => supabase.from('umsatz_transaktionen')
      .select('produkt_id, sales_plattform_id, leistungsdatum, betrag, kategorie_id')
      .gte('leistungsdatum', histStartStr).lt('leistungsdatum', todayStr)
      .not('produkt_id', 'is', null).not('sales_plattform_id', 'is', null).order('id', { ascending: true }).range(from, to)),
    marketingKatIdsArr.length > 0
      ? fetchAllRows((from, to) => supabase.from('ausgaben_kosten_transaktionen')
          .select('produkt_id, kategorie_id, leistungsdatum, betrag_netto')
          .gte('leistungsdatum', histStartStr).lt('leistungsdatum', todayStr)
          .in('kategorie_id', marketingKatIdsArr).in('relevanz', ['rentabilitaet', 'beides'])
          .not('produkt_id', 'is', null).order('id', { ascending: true }).range(from, to))
      : Promise.resolve({ data: [], error: null }),
    supabase.from('ust_kategorie_saetze')
      .select('kategorie_id, ebene, ust_satz')
      .eq('user_id', user!.id)
      .limit(1000),
    supabase.from('auszahlungs_marketing_gruppen')
      .select('kpi_kategorie_id')
      .eq('user_id', user!.id)
      .limit(500),
    supabase.from('marketing_kategorie_einstellungen')
      .select('kategorie_id, sales_plattform_id')
      .eq('user_id', user!.id)
      .limit(100),
    supabase.from('ust_l1_ebene_auswahl')
      .select('kategorie_id, ebene')
      .eq('user_id', user!.id)
      .limit(500),
  ])

  for (const r of [absatzPlanResult, absatzEinstResult, retourenEinstResult, retourenPlattResult, retourenAllgemeinResult, vkGebResult, marketingPlanResult, marketingEinstResult, umsatzTransResult]) {
    if ('error' in r && r.error) return NextResponse.json({ error: r.error.message }, { status: 500 })
  }
  if (bestandResult.error) return NextResponse.json({ error: bestandResult.error.message }, { status: 500 })
  if (marketingAusgResult.error) return NextResponse.json({ error: marketingAusgResult.error.message }, { status: 500 })

  const inkludierteMarketingKatIds = new Set<string>(
    ((auszahlungsMarketingResult.data ?? []) as { kpi_kategorie_id: string }[]).map(r => r.kpi_kategorie_id)
  )

  const kategoriePlattformMktMap = new Map<string, string | null>()
  for (const e of (mktKatPlattResult.data ?? []) as { kategorie_id: string; sales_plattform_id: string | null }[]) {
    kategoriePlattformMktMap.set(e.kategorie_id, e.sales_plattform_id ?? null)
  }

  const ustRateMap = new Map<string, number>()
  for (const row of (ustResult.data ?? []) as { kategorie_id: string; ebene: number; ust_satz: number | null }[]) {
    if (row.ust_satz != null) ustRateMap.set(`${row.kategorie_id}:${row.ebene}`, Number(row.ust_satz))
  }
  const ustEbeneMap = new Map<string, 1 | 2>()
  for (const r of (ustEbeneResult.data ?? []) as { kategorie_id: string; ebene: number }[]) {
    ustEbeneMap.set(r.kategorie_id, r.ebene as 1 | 2)
  }

  function getUstMultiplier(specificId: string | null, parentId: string | null): number {
    if (parentId) {
      const ebene = ustEbeneMap.get(parentId) ?? 1  // default: Gesamt (ebene=1)
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
  const umsatzFuerMktByProdukt = new Map<string, { datum: string; betrag: number }[]>()
  const umsatzFuerMktByProduktPlattform = new Map<string, { datum: string; betrag: number }[]>()
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
      const entry = { datum: row.leistungsdatum, betrag: isRabatt ? -Number(row.betrag) : Number(row.betrag) }
      if (!umsatzFuerMktByProdukt.has(row.produkt_id)) umsatzFuerMktByProdukt.set(row.produkt_id, [])
      umsatzFuerMktByProdukt.get(row.produkt_id)!.push(entry)
      if (!umsatzFuerMktByProduktPlattform.has(key)) umsatzFuerMktByProduktPlattform.set(key, [])
      umsatzFuerMktByProduktPlattform.get(key)!.push(entry)
    }
  }

  const retourenEinstMap = new Map<string, RetourenEinstellung>()
  for (const e of (retourenEinstResult.data ?? []) as RetourenEinstellung[]) {
    retourenEinstMap.set(`${e.produkt_id}:${e.sales_plattform_id}`, e)
  }

  // Allgemeine Berechnungsart je Produkt (plattformunabhängig)
  const retourenAllgemeinMap = new Map<string, string>()
  for (const e of (retourenAllgemeinResult.data ?? []) as RetourenAllgemeinProduktEinstellung[]) {
    retourenAllgemeinMap.set(e.produkt_id, e.berechnungsart)
  }

  const vkGebProzentMap = new Map<string, number | null>()
  for (const e of (vkGebResult.data ?? []) as VkGebEinstellung[]) {
    vkGebProzentMap.set(`${e.produkt_id}:${e.sales_plattform_id}`, e.verkaufsgebuehr_prozent)
  }

  const marketingManualMap = new Map<string, number>()
  for (const m of (marketingPlanResult.data ?? []) as MarketingPlanungRow[]) {
    if (m.marketingkosten_pct_manuell != null) {
      marketingManualMap.set(`${m.produkt_id}:${m.kategorie_id}:${m.kw_year}:${m.kw_number}`, Number(m.marketingkosten_pct_manuell))
    }
  }

  const marketingEinstMap = new Map<string, MarketingEinstellung>()
  const marketingKombisByProdukt = new Map<string, string[]>()
  for (const e of (marketingEinstResult.data ?? []) as MarketingEinstellung[]) {
    marketingEinstMap.set(`${e.produkt_id}:${e.kategorie_id}`, e)
    if (!marketingKombisByProdukt.has(e.produkt_id)) marketingKombisByProdukt.set(e.produkt_id, [])
    marketingKombisByProdukt.get(e.produkt_id)!.push(e.kategorie_id)
  }

  const mktAusgByKombi = new Map<string, { datum: string; betrag_netto: number }[]>()
  for (const row of (marketingAusgResult.data ?? []) as AusgabenTransRow[]) {
    if (!row.produkt_id || !row.kategorie_id) continue
    const key = `${row.produkt_id}:${row.kategorie_id}`
    if (!mktAusgByKombi.has(key)) mktAusgByKombi.set(key, [])
    mktAusgByKombi.get(key)!.push({ datum: row.leistungsdatum, betrag_netto: Number(row.betrag_netto) })
  }

  // ── 6. Precompute retourenquote and marketing pct per produkt×plattform ──

  // Die letzten 7 Tage werden bei Retourenquoten-Berechnungen ausgeblendet,
  // da aktuelle Retouren oft mit Verzögerung erfasst werden.
  const quoteEndStr = toDateOnly(addDays(today, -7))

  // Retourenquote: Berechnungsart kommt jetzt aus der allgemeinen Produkteinstellung (plattformunabhängig)
  const retourenquoteCache = new Map<string, number>()
  function getRetourenquote(produktId: string, plattformId: string): number {
    const cacheKey = `${produktId}:${plattformId}`
    if (retourenquoteCache.has(cacheKey)) return retourenquoteCache.get(cacheKey)!
    const berechnungsart = retourenAllgemeinMap.get(produktId) ?? 'keine'
    if (berechnungsart === 'keine') { retourenquoteCache.set(cacheKey, 0); return 0 }
    const periodDays = getPeriodDays(berechnungsart)
    const startStr = toDateOnly(addDays(today, -periodDays - 7))
    const kombiKey = `${produktId}:${plattformId}`
    const brutto = (bruttoByKombi.get(kombiKey) ?? []).filter(r => r.datum >= startStr && r.datum < quoteEndStr)
    const rueck = (rueckByKombi.get(kombiKey) ?? []).filter(r => r.datum >= startStr && r.datum < quoteEndStr)
    const sumBrutto = brutto.reduce((a, r) => a + r.betrag, 0)
    const sumRueck = rueck.reduce((a, r) => a + r.betrag, 0)
    const quote = sumBrutto > 0 ? sumRueck / sumBrutto : 0
    retourenquoteCache.set(cacheKey, quote)
    return quote
  }

  // Rückerstattungsquote: ebenfalls allgemeine Berechnungsart
  const rueckQuoteCache = new Map<string, number>()
  function getRueckerstattungsQuote(produktId: string, plattformId: string): number {
    const cacheKey = `${produktId}:${plattformId}`
    if (rueckQuoteCache.has(cacheKey)) return rueckQuoteCache.get(cacheKey)!
    const berechnungsart = retourenAllgemeinMap.get(produktId) ?? 'keine'
    if (berechnungsart === 'keine') { rueckQuoteCache.set(cacheKey, 0); return 0 }
    const periodDays = getPeriodDays(berechnungsart)
    const startStr = toDateOnly(addDays(today, -periodDays - 7))
    const kombiKey = `${produktId}:${plattformId}`
    const brutto = (bruttoByKombi.get(kombiKey) ?? []).filter(r => r.datum >= startStr && r.datum < quoteEndStr)
    const rueck = (rueckByKombi.get(kombiKey) ?? []).filter(r => r.datum >= startStr && r.datum < quoteEndStr)
    const sumBrutto = brutto.reduce((a, r) => a + r.betrag, 0)
    const sumRueck = rueck.reduce((a, r) => a + r.betrag, 0)
    const quote = sumBrutto > 0 ? sumRueck / sumBrutto : 0
    rueckQuoteCache.set(cacheKey, quote)
    return quote
  }

  const marketingPctCache = new Map<string, number>()
  function getMarketingHistorischPct(produktId: string, kategorieId: string): number {
    const key = `${produktId}:${kategorieId}`
    if (marketingPctCache.has(key)) return marketingPctCache.get(key)!
    const einst = marketingEinstMap.get(key)
    if (!einst) { marketingPctCache.set(key, 0); return 0 }
    const periodDays = getPeriodDays(einst.berechnungsart)
    const periodStart = addDays(today, -periodDays)
    const startStr = toDateOnly(periodStart)
    const ausgaben = (mktAusgByKombi.get(key) ?? []).filter(r => r.datum >= startStr && r.datum < todayStr)
    const plattformIdForMkt = kategoriePlattformMktMap.get(kategorieId) ?? null
    const umsatzRows = plattformIdForMkt
      ? (umsatzFuerMktByProduktPlattform.get(`${produktId}:${plattformIdForMkt}`) ?? []).filter(r => r.datum >= startStr && r.datum < todayStr)
      : (umsatzFuerMktByProdukt.get(produktId) ?? []).filter(r => r.datum >= startStr && r.datum < todayStr)
    let pct: number
    if (einst.berechnungsart.startsWith('gewichtet_')) {
      const third = periodDays / 3
      const t1 = startStr
      const t2 = toDateOnly(addDays(periodStart, third))
      const t3 = toDateOnly(addDays(periodStart, third * 2))
      const sumA = (s: string, e: string) => ausgaben.filter(r => r.datum >= s && r.datum < e).reduce((a, r) => a + r.betrag_netto, 0)
      const sumU = (s: string, e: string) => umsatzRows.filter(r => r.datum >= s && r.datum < e).reduce((a, r) => a + r.betrag, 0)
      const a1 = sumA(t1, t2); const a2 = sumA(t2, t3); const a3 = sumA(t3, todayStr)
      const u1 = sumU(t1, t2); const u2 = sumU(t2, t3); const u3 = sumU(t3, todayStr)
      const p1 = u1 === 0 ? 0 : (a1 / u1) * 100
      const p2 = u2 === 0 ? 0 : (a2 / u2) * 100
      const p3 = u3 === 0 ? 0 : (a3 / u3) * 100
      const w1 = einst.gewichtung_erstes_drittel; const w2 = einst.gewichtung_zweites_drittel; const w3 = einst.gewichtung_drittes_drittel
      if (w1 != null && w2 != null && w3 != null) {
        pct = Math.round(((w1 * p1 + w2 * p2 + w3 * p3) / 100) * 100) / 100
      } else {
        const totalA = a1 + a2 + a3; const totalU = u1 + u2 + u3
        pct = totalU === 0 ? 0 : Math.round((totalA / totalU) * 100 * 100) / 100
      }
    } else {
      const sumAusg = ausgaben.reduce((a, r) => a + r.betrag_netto, 0)
      const sumUmsatz = umsatzRows.reduce((a, r) => a + r.betrag, 0)
      pct = sumUmsatz > 0 ? Math.round((sumAusg / sumUmsatz) * 100 * 100) / 100 : 0
    }
    marketingPctCache.set(key, pct)
    return pct
  }

  // ── 7. Compute values for each kw × plattform × produkt ──────────────────

  interface ResultRow { kategorie: string; produkt_id: string; sales_plattform_id: string; kw_year: number; kw_number: number; wert: number }
  const results: ResultRow[] = []
  const bruttoumsatzByProdKw = new Map<string, number>()
  const bruttoumsatzByProdPlattKw = new Map<string, number>()

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

        const prodKwAccKey = `${prd.id}:${kw.year}:${kw.week}`
        bruttoumsatzByProdKw.set(prodKwAccKey, (bruttoumsatzByProdKw.get(prodKwAccKey) ?? 0) + bruttoumsatz)
        bruttoumsatzByProdPlattKw.set(`${prd.id}:${plt.id}:${kw.year}:${kw.week}`, bruttoumsatz)

        const retourenquote = getRetourenquote(prd.id, plt.id)
        const rueckQuote = getRueckerstattungsQuote(prd.id, plt.id)

        if (rueckQuote > 0) {
          results.push({
            kategorie: 'rueckerstattungen',
            produkt_id: prd.id, sales_plattform_id: plt.id, kw_year: kw.year, kw_number: kw.week,
            wert: Math.round(rueckQuote * bruttoumsatz * 100) / 100,
          })
        }

        const vkGebProzent = vkGebProzentMap.get(`${prd.id}:${plt.id}`) ?? null
        const erstattungPct = retourenEinstMap.get(`${prd.id}:${plt.id}`)?.erstattung_verkaufsgebuehr_prozent ?? null
        const erstattungFraction = erstattungPct != null ? Number(erstattungPct) / 100 : 0
        if (vkGebProzent != null && vkGebProzent > 0) {
          const vkGeb = bruttoumsatz * (vkGebProzent / 100)
            - bruttoumsatz * retourenquote * erstattungFraction
          if (vkGeb !== 0) {
            results.push({
              kategorie: 'verkaufsgebuehr',
              produkt_id: prd.id, sales_plattform_id: plt.id, kw_year: kw.year, kw_number: kw.week,
              wert: Math.round(vkGeb * getUstMultiplier(vkGebRootId, vertriebParentId) * 100) / 100,
            })
          }
        }

        const retourenEinst = retourenEinstMap.get(`${prd.id}:${plt.id}`)
        const allgBerechnungsart = retourenAllgemeinMap.get(prd.id) ?? 'keine'
        if (allgBerechnungsart !== 'keine' && retourenquote > 0) {
          const rueckversand = Number(retourenEinst?.rueckversandkosten_euro_netto ?? 0)
          const retourenKosten = retourenquote * productAbsatz * rueckversand
          if (retourenKosten !== 0) {
            results.push({
              kategorie: 'retouren',
              produkt_id: prd.id, sales_plattform_id: plt.id, kw_year: kw.year, kw_number: kw.week,
              wert: Math.round(retourenKosten * getUstMultiplier(retourenRootId, vertriebParentId) * 100) / 100,
            })
          }
        }

      }
    }
  }

  // Marketing rows: per produkt × marketing_kategorie × kw (not per sales platform)
  for (const kw of planungswochen) {
    for (const prd of produkte) {
      const katIds = (marketingKombisByProdukt.get(prd.id) ?? []).filter(id => inkludierteMarketingKatIds.has(id))
      for (const katId of katIds) {
        const plattformId = kategoriePlattformMktMap.get(katId) ?? null
        const base = plattformId
          ? (bruttoumsatzByProdPlattKw.get(`${prd.id}:${plattformId}:${kw.year}:${kw.week}`) ?? 0)
          : (bruttoumsatzByProdKw.get(`${prd.id}:${kw.year}:${kw.week}`) ?? 0)
        if (base === 0) continue
        const manualVal = marketingManualMap.get(`${prd.id}:${katId}:${kw.year}:${kw.week}`)
        const pct = manualVal != null ? manualVal : getMarketingHistorischPct(prd.id, katId)
        if (pct > 0) {
          results.push({
            kategorie: 'marketing',
            produkt_id: prd.id,
            sales_plattform_id: katId,
            kw_year: kw.year,
            kw_number: kw.week,
            wert: Math.round(base * (pct / 100) * getUstMultiplier(katId, marketingL1Id) * 100) / 100,
          })
        }
      }
    }
  }

  return NextResponse.json(results)
}
