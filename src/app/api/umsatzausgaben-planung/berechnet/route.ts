import { NextResponse } from 'next/server'
import { requireAuth } from '@/lib/supabase-server'

// ─── ISO week helpers ──────────────────────────────────────────────────────────

function getISOWeekMonday(year: number, week: number): Date {
  const jan4 = new Date(Date.UTC(year, 0, 4))
  const jan4Day = jan4.getUTCDay() || 7
  const week1Mon = new Date(jan4.getTime() - (jan4Day - 1) * 86400000)
  return new Date(week1Mon.getTime() + (week - 1) * 7 * 86400000)
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

// ─── Zahlungsziel shift ────────────────────────────────────────────────────────

function getGruppierungWochen(g: string | null): number {
  switch (g) {
    case 'woechentlich': return 1
    case 'alle_zwei_wochen': return 2
    case 'monatlich': return 4
    case 'quartalsweise': return 12
    case 'halbjaehrlich': return 26
    case 'jaehrlich': return 52
    default: return 0
  }
}

function shiftToPaymentWeek(
  sourceYear: number,
  sourceWeek: number,
  zahlungszielTage: number | null,
  gruppierung: string | null,
  basisKw: number | null,
  basisJahr: number | null,
): { year: number; week: number } {
  const zielTage = zahlungszielTage ?? 0
  const zielWochen = Math.ceil(zielTage / 7)
  const sourceMonday = getISOWeekMonday(sourceYear, sourceWeek)
  const shiftedMonday = new Date(sourceMonday.getTime() + zielWochen * 7 * 86400000)

  const R = getGruppierungWochen(gruppierung)
  if (R === 0 || !basisKw || !basisJahr) return getISOWeekInfo(shiftedMonday)

  const basisMonday = getISOWeekMonday(basisJahr, basisKw)
  const shiftedMs = shiftedMonday.getTime()
  const basisMs = basisMonday.getTime()

  if (shiftedMs <= basisMs) return getISOWeekInfo(basisMonday)

  const weeksDiff = (shiftedMs - basisMs) / (7 * 86400000)
  const n = Math.ceil(weeksDiff / R)
  return getISOWeekInfo(new Date(basisMs + n * R * 7 * 86400000))
}

// ─── Types ─────────────────────────────────────────────────────────────────────

interface KatRow { id: string; name: string; parent_id: string | null; type: string; ist_abzugsposten: boolean; level: number }
interface AbsatzPlanRow { produkt_id: string; sales_plattform_id: string; kw_year: number; kw_number: number; absatz_manuell: number | null; effektiver_vk_manuell: number | null; sku_id: string | null }
interface AbsatzEinstRow { sales_plattform_id: string; produkt_id: string; berechnungsart: string; gewichtung_erstes_drittel: number | null; gewichtung_zweites_drittel: number | null; gewichtung_drittes_drittel: number | null }
interface BestandRow { sku_id: string; datum: string; bestand_sendungen: { plattform_id: string; menge: number }[] }
interface VersandEinstRow { sales_plattform_id: string; produkt_id: string; versandgebuehr_spediteur: number | null; versandgebuehr_3pl: number | null }
interface VersandPlattRow { sales_plattform_id: string; zahlungsziel_tage: number | null; gruppierung: string | null; naechste_zahlung_basis_kw: number | null; naechste_zahlung_basis_jahr: number | null }
interface LagerEinstRow { sales_plattform_id: string; produkt_id: string; lagerkosten_euro_m3: number | null }
interface LagerPlattRow { sales_plattform_id: string; zahlungsziel_tage: number | null; gruppierung: string | null; naechste_zahlung_basis_kw: number | null; naechste_zahlung_basis_jahr: number | null }
interface ContainerRow { produkt_id: string; laenge_cm: number | null; breite_cm: number | null; hoehe_cm: number | null }
interface RetourenAllgProdRow { produkt_id: string; berechnungsart: string; retourenhandling_kosten_euro_netto: number | null }
interface RetourenAllgEinstRow { zahlungsziel_tage: number | null; gruppierung: string | null; naechste_zahlung_basis_kw: number | null; naechste_zahlung_basis_jahr: number | null }
interface KulanzEinstRow { sales_plattform_id: string; produkt_id: string; quote_prozent: number | null; produktkosten_pro_stueck_euro_netto: number | null; versandkosten_pro_stueck_euro_netto: number | null }
interface KulanzPlattRow { sales_plattform_id: string; zahlungsziel_tage: number | null; gruppierung: string | null; naechste_zahlung_basis_kw: number | null; naechste_zahlung_basis_jahr: number | null }
interface MktPlanRow { produkt_id: string; kategorie_id: string; kw_year: number; kw_number: number; marketingkosten_pct_manuell: number | null }
interface MktKatEinstRow { kategorie_id: string; zahlungsziel_tage: number | null; gruppierung: string | null; naechste_zahlung_basis_kw: number | null; naechste_zahlung_basis_jahr: number | null }
interface BestellungRow { id: string; status: string; bestelldatum: string | null; ankunftsdatum: string | null; ankunftsdatum_ist: string | null }
interface BestellProduktRow { bestellung_id: string; produkt_id: string }
interface BestellKostRow { bestellung_id: string; kpi_kategorie_id: string; datum: string | null; nettobetrag: number }
interface UstRow { kategorie_id: string; ebene: number; ust_satz: number | null }

// ─── Handler ──────────────────────────────────────────────────────────────────

export async function GET(request: Request) {
  const { user, supabase, error } = await requireAuth()
  if (error) return error

  const { searchParams } = new URL(request.url)
  const vonKw = parseInt(searchParams.get('von_kw') ?? '', 10)
  const vonJahr = parseInt(searchParams.get('von_jahr') ?? '', 10)
  const bisKw = parseInt(searchParams.get('bis_kw') ?? '', 10)
  const bisJahr = parseInt(searchParams.get('bis_jahr') ?? '', 10)

  if ([vonKw, vonJahr, bisKw, bisJahr].some(n => isNaN(n))) {
    return NextResponse.json({ error: 'von_kw, von_jahr, bis_kw, bis_jahr sind erforderlich' }, { status: 400 })
  }

  // 1. Build planning weeks + date range
  const planWeeks: { year: number; week: number }[] = []
  const vonMonday = getISOWeekMonday(vonJahr, vonKw)
  const bisMonday = getISOWeekMonday(bisJahr, bisKw)
  let cur = new Date(vonMonday)
  while (cur.getTime() <= bisMonday.getTime()) {
    planWeeks.push(getISOWeekInfo(cur))
    cur = addDays(cur, 7)
  }
  if (planWeeks.length === 0) return NextResponse.json({ data: [] })

  const vonMondayMs = vonMonday.getTime()
  const bisMondayMs = bisMonday.getTime()

  function inRange(year: number, week: number): boolean {
    const m = getISOWeekMonday(year, week).getTime()
    return m >= vonMondayMs && m <= bisMondayMs
  }

  const today = new Date()
  today.setUTCHours(0, 0, 0, 0)
  const todayStr = toDateOnly(today)
  const histStartStr = toDateOnly(addDays(today, -90))
  const quoteEndStr = toDateOnly(addDays(today, -7))

  const planYears = [...new Set(planWeeks.map(w => w.year))]
  const startDateStr = toDateOnly(vonMonday)
  const endDateStr = toDateOnly(addDays(bisMonday, 6))

  // 2. Load kpi_categories
  const katsResult = await supabase
    .from('kpi_categories')
    .select('id, name, parent_id, type, ist_abzugsposten, level')
    .limit(2000)

  if (katsResult.error) return NextResponse.json({ error: katsResult.error.message }, { status: 500 })

  const kats = (katsResult.data ?? []) as KatRow[]

  const childrenMap = new Map<string, string[]>()
  for (const k of kats) {
    if (k.parent_id) {
      if (!childrenMap.has(k.parent_id)) childrenMap.set(k.parent_id, [])
      childrenMap.get(k.parent_id)!.push(k.id)
    }
  }

  // Identify relevant L1 category IDs
  let vertriebL1Id: string | null = null
  let marketingL1Id: string | null = null
  let bruttoUmsatzIds = new Set<string>()
  let rueckerstattungsIds = new Set<string>()

  const versandL2Id: string[] = []
  const lagerL2Id: string[] = []
  const retourenL2Id: string[] = []
  const kulanzL2Id: string[] = []
  const marketingL2Ids: string[] = []

  for (const k of kats) {
    if (k.type !== 'ausgaben_kosten') {
      if (k.type === 'umsatz' && !k.ist_abzugsposten && k.level === 1) {
        function addDesc(id: string, set: Set<string>) {
          set.add(id)
          for (const c of childrenMap.get(id) ?? []) addDesc(c, set)
        }
        addDesc(k.id, bruttoUmsatzIds)
      }
      if (k.type === 'umsatz' && k.ist_abzugsposten && k.name.toLowerCase().includes('rückerstattung')) {
        function addDesc2(id: string, set: Set<string>) {
          set.add(id)
          for (const c of childrenMap.get(id) ?? []) addDesc2(c, set)
        }
        addDesc2(k.id, rueckerstattungsIds)
      }
      continue
    }
    const n = k.name.toLowerCase()
    if (k.level === 1 && (n.includes('vertrieb'))) vertriebL1Id = k.id
    if (k.level === 1 && n === 'marketing') marketingL1Id = k.id
    if (k.level === 2 && n.includes('versand')) versandL2Id.push(k.id)
    if (k.level === 2 && n.includes('lager')) lagerL2Id.push(k.id)
    if (k.level === 2 && n.includes('retouren')) retourenL2Id.push(k.id)
    if (k.level === 2 && (n.includes('ersatz') || n.includes('kulanz'))) kulanzL2Id.push(k.id)
    if (k.level === 2 && k.parent_id === marketingL1Id) marketingL2Ids.push(k.id)
  }

  const produkte = kats.filter(k => k.type === 'produkte' && k.level === 1)
  const plattformen = kats.filter(k => k.type === 'sales_plattformen')
  const skus = kats.filter(k => k.type === 'produkte' && k.level === 2)
  const skusByProdukt = new Map<string, string[]>()
  for (const s of skus) {
    if (!s.parent_id) continue
    if (!skusByProdukt.has(s.parent_id)) skusByProdukt.set(s.parent_id, [])
    skusByProdukt.get(s.parent_id)!.push(s.id)
  }

  if (produkte.length === 0) return NextResponse.json({ data: [] })

  // 3. Load all data in parallel
  const [
    absatzPlanRes, absatzEinstRes, bestandRes,
    versandEinstRes, versandPlattRes,
    lagerEinstRes, lagerPlattRes, containerRes,
    retourenAllgProdRes, retourenAllgEinstRes,
    kulanzEinstRes, kulanzPlattRes,
    mktPlanRes, mktKatEinstRes, auszahlungsMktRes,
    bestellungenRes, bestellProdRes, bestellKostRes,
    ustRes, umsatzTransRes,
  ] = await Promise.all([
    supabase.from('absatz_planung')
      .select('produkt_id, sales_plattform_id, kw_year, kw_number, absatz_manuell, effektiver_vk_manuell, sku_id')
      .eq('user_id', user!.id).in('kw_year', planYears).limit(10000),
    supabase.from('absatz_einstellungen')
      .select('sales_plattform_id, produkt_id, berechnungsart, gewichtung_erstes_drittel, gewichtung_zweites_drittel, gewichtung_drittes_drittel')
      .eq('user_id', user!.id).neq('berechnungsart', 'keine').limit(500),
    skus.length > 0
      ? supabase.from('bestand_transaktionen')
          .select('sku_id, datum, bestand_sendungen(plattform_id, menge)')
          .gte('datum', histStartStr).lt('datum', todayStr)
          .in('sku_id', skus.map(s => s.id)).limit(10000)
      : Promise.resolve({ data: [], error: null }),
    supabase.from('versandausgaben_einstellungen')
      .select('sales_plattform_id, produkt_id, versandgebuehr_spediteur, versandgebuehr_3pl')
      .eq('user_id', user!.id).limit(500),
    supabase.from('versandausgaben_plattform_einstellungen')
      .select('sales_plattform_id, zahlungsziel_tage, gruppierung, naechste_zahlung_basis_kw, naechste_zahlung_basis_jahr')
      .eq('user_id', user!.id).limit(100),
    supabase.from('lagerausgaben_einstellungen')
      .select('sales_plattform_id, produkt_id, lagerkosten_euro_m3')
      .eq('user_id', user!.id).limit(500),
    supabase.from('lagerausgaben_plattform_einstellungen')
      .select('sales_plattform_id, zahlungsziel_tage, gruppierung, naechste_zahlung_basis_kw, naechste_zahlung_basis_jahr')
      .eq('user_id', user!.id).limit(100),
    supabase.from('produktinformationen_containerkapazitaet')
      .select('produkt_id, laenge_cm, breite_cm, hoehe_cm')
      .eq('user_id', user!.id).limit(200),
    supabase.from('retouren_allgemein_produkt_einstellungen')
      .select('produkt_id, berechnungsart, retourenhandling_kosten_euro_netto')
      .eq('user_id', user!.id).limit(200),
    supabase.from('retouren_allgemein_einstellungen')
      .select('zahlungsziel_tage, gruppierung, naechste_zahlung_basis_kw, naechste_zahlung_basis_jahr')
      .eq('user_id', user!.id).maybeSingle(),
    supabase.from('ersatzteile_kulanz_einstellungen')
      .select('sales_plattform_id, produkt_id, quote_prozent, produktkosten_pro_stueck_euro_netto, versandkosten_pro_stueck_euro_netto')
      .eq('user_id', user!.id).limit(500),
    supabase.from('ersatzteile_kulanz_plattform_einstellungen')
      .select('sales_plattform_id, zahlungsziel_tage, gruppierung, naechste_zahlung_basis_kw, naechste_zahlung_basis_jahr')
      .eq('user_id', user!.id).limit(100),
    supabase.from('marketing_planung')
      .select('produkt_id, kategorie_id, kw_year, kw_number, marketingkosten_pct_manuell')
      .eq('user_id', user!.id).in('kw_year', planYears).limit(5000),
    supabase.from('marketing_kategorie_einstellungen')
      .select('kategorie_id, zahlungsziel_tage, gruppierung, naechste_zahlung_basis_kw, naechste_zahlung_basis_jahr')
      .eq('user_id', user!.id).limit(100),
    supabase.from('auszahlungs_marketing_gruppen')
      .select('kpi_kategorie_id, inkludiert')
      .eq('user_id', user!.id).limit(500),
    supabase.from('bestellungen')
      .select('id, status, bestelldatum, ankunftsdatum, ankunftsdatum_ist')
      .eq('user_id', user!.id).in('status', ['plan', 'laufend']).limit(500),
    supabase.from('bestellungen_produkte')
      .select('bestellung_id, produkt_id')
      .eq('user_id', user!.id).limit(5000),
    supabase.from('bestellungen_kosten')
      .select('bestellung_id, kpi_kategorie_id, datum, nettobetrag')
      .eq('user_id', user!.id).limit(10000),
    supabase.from('ust_kategorie_saetze')
      .select('kategorie_id, ebene, ust_satz')
      .eq('user_id', user!.id).limit(1000),
    supabase.from('umsatz_transaktionen')
      .select('produkt_id, kategorie_id, leistungsdatum, betrag')
      .gte('leistungsdatum', histStartStr).lt('leistungsdatum', todayStr)
      .not('produkt_id', 'is', null).limit(30000),
  ])

  // ── 4. Build lookup maps ─────────────────────────────────────────────────────

  // UST
  const ustRateMap = new Map<string, number>()
  for (const r of (ustRes.data ?? []) as UstRow[]) {
    if (r.ust_satz != null) ustRateMap.set(`${r.kategorie_id}:${r.ebene}`, Number(r.ust_satz))
  }
  function getUstMultiplier(specificId: string | null, parentId: string | null): number {
    if (specificId) { const r2 = ustRateMap.get(`${specificId}:2`); if (r2 != null) return 1 + r2 / 100 }
    if (parentId) { const r1 = ustRateMap.get(`${parentId}:1`); if (r1 != null) return 1 + r1 / 100 }
    if (specificId) { const r1 = ustRateMap.get(`${specificId}:1`); if (r1 != null) return 1 + r1 / 100 }
    return 1
  }

  // Marketing: which L2 cat IDs are assigned to platforms (→ exclude from Umsatzausgaben)
  const mktInPlatformSet = new Set<string>(
    ((auszahlungsMktRes.data ?? []) as { kpi_kategorie_id: string; inkludiert: boolean }[])
      .filter(r => r.inkludiert).map(r => r.kpi_kategorie_id)
  )
  const unassignedMktL2Ids = marketingL2Ids.filter(id => !mktInPlatformSet.has(id))

  // Absatz: manual plan entries
  const absatzManualMap = new Map<string, number>()   // plattId:prodId:year:week → absatz
  const vkManualMap = new Map<string, number>()         // plattId:prodId:year:week → vk
  for (const r of (absatzPlanRes.data ?? []) as AbsatzPlanRow[]) {
    if (r.absatz_manuell != null) {
      absatzManualMap.set(`${r.sales_plattform_id}:${r.produkt_id}:${r.kw_year}:${r.kw_number}`, Number(r.absatz_manuell))
    }
    if (r.sku_id == null && r.effektiver_vk_manuell != null) {
      vkManualMap.set(`${r.sales_plattform_id}:${r.produkt_id}:${r.kw_year}:${r.kw_number}`, Number(r.effektiver_vk_manuell))
    }
  }

  // Bestand for auto-absatz
  const bestandBySkuPlatt = new Map<string, { datum: string; menge: number }[]>()
  for (const t of (bestandRes.data ?? []) as BestandRow[]) {
    for (const s of t.bestand_sendungen ?? []) {
      const key = `${t.sku_id}:${s.plattform_id}`
      if (!bestandBySkuPlatt.has(key)) bestandBySkuPlatt.set(key, [])
      bestandBySkuPlatt.get(key)!.push({ datum: t.datum, menge: Number(s.menge) })
    }
  }

  const absatzEinstMap = new Map<string, AbsatzEinstRow>()
  for (const e of (absatzEinstRes.data ?? []) as AbsatzEinstRow[]) {
    absatzEinstMap.set(`${e.produkt_id}:${e.sales_plattform_id}`, e)
  }

  function calcAutoAbsatz(produktId: string, plattformId: string): number {
    const skuIds = skusByProdukt.get(produktId) ?? []
    if (skuIds.length === 0) return 0
    const einst = absatzEinstMap.get(`${produktId}:${plattformId}`)
    const berechnungsart = einst?.berechnungsart ?? 'mittelwert_30'
    const periodDays = getPeriodDays(berechnungsart)
    const periodStart = addDays(today, -periodDays)
    const startStr = toDateOnly(periodStart)
    let total = 0
    for (const skuId of skuIds) {
      const entries = bestandBySkuPlatt.get(`${skuId}:${plattformId}`) ?? []
      if (berechnungsart.startsWith('gewichtet_') && einst) {
        const third = periodDays / 3
        const t1 = toDateOnly(periodStart)
        const t2 = toDateOnly(addDays(periodStart, third))
        const t3 = toDateOnly(addDays(periodStart, third * 2))
        const s1 = entries.filter(e => e.datum >= t1 && e.datum < t2).reduce((a, e) => a + e.menge, 0)
        const s2 = entries.filter(e => e.datum >= t2 && e.datum < t3).reduce((a, e) => a + e.menge, 0)
        const s3 = entries.filter(e => e.datum >= t3 && e.datum < todayStr).reduce((a, e) => a + e.menge, 0)
        const { gewichtung_erstes_drittel: w1, gewichtung_zweites_drittel: w2, gewichtung_drittes_drittel: w3 } = einst
        if (w1 != null && w2 != null && w3 != null) {
          total += Math.round(((w1 * (s1 / third) + w2 * (s2 / third) + w3 * (s3 / third)) / 100) * 100) / 100
        } else {
          total += Math.round(((s1 + s2 + s3) / periodDays) * 100) / 100
        }
      } else {
        const sum = entries.filter(e => e.datum >= startStr && e.datum < todayStr).reduce((a, e) => a + e.menge, 0)
        total += Math.round((sum / periodDays) * 100) / 100
      }
    }
    return total * 7  // daily → weekly
  }

  function getAbsatz(plattId: string, prodId: string, year: number, week: number): number {
    const manual = absatzManualMap.get(`${plattId}:${prodId}:${year}:${week}`)
    if (manual != null) return manual
    return calcAutoAbsatz(prodId, plattId)
  }

  function getVk(plattId: string, prodId: string, year: number, week: number): number {
    return vkManualMap.get(`${plattId}:${prodId}:${year}:${week}`) ?? 0
  }

  // Versandausgaben settings
  const versandEinstMap = new Map<string, VersandEinstRow>()
  for (const r of (versandEinstRes.data ?? []) as VersandEinstRow[]) {
    versandEinstMap.set(`${r.sales_plattform_id}:${r.produkt_id}`, r)
  }
  const versandPlattMap = new Map<string, VersandPlattRow>()
  for (const r of (versandPlattRes.data ?? []) as VersandPlattRow[]) {
    versandPlattMap.set(r.sales_plattform_id, r)
  }

  // Lagerausgaben settings
  const lagerEinstMap = new Map<string, LagerEinstRow>()
  for (const r of (lagerEinstRes.data ?? []) as LagerEinstRow[]) {
    lagerEinstMap.set(`${r.sales_plattform_id}:${r.produkt_id}`, r)
  }
  const lagerPlattMap = new Map<string, LagerPlattRow>()
  for (const r of (lagerPlattRes.data ?? []) as LagerPlattRow[]) {
    lagerPlattMap.set(r.sales_plattform_id, r)
  }

  // Container M3 per product
  const m3ByProd = new Map<string, number>()
  for (const r of (containerRes.data ?? []) as ContainerRow[]) {
    const l = Number(r.laenge_cm ?? 0)
    const b = Number(r.breite_cm ?? 0)
    const h = Number(r.hoehe_cm ?? 0)
    if (l > 0 && b > 0 && h > 0) m3ByProd.set(r.produkt_id, (l * b * h) / 1_000_000)
  }

  // Retouren settings
  const retourenAllgProdMap = new Map<string, RetourenAllgProdRow>()
  for (const r of (retourenAllgProdRes.data ?? []) as RetourenAllgProdRow[]) {
    retourenAllgProdMap.set(r.produkt_id, r)
  }
  const retourenAllgEinst = retourenAllgEinstRes.data as RetourenAllgEinstRow | null

  // Ersatzteile/Kulanz settings
  const kulanzEinstMap = new Map<string, KulanzEinstRow>()
  for (const r of (kulanzEinstRes.data ?? []) as KulanzEinstRow[]) {
    kulanzEinstMap.set(`${r.sales_plattform_id}:${r.produkt_id}`, r)
  }
  const kulanzPlattMap = new Map<string, KulanzPlattRow>()
  for (const r of (kulanzPlattRes.data ?? []) as KulanzPlattRow[]) {
    kulanzPlattMap.set(r.sales_plattform_id, r)
  }

  // Marketing plan pct
  const mktPlanMap = new Map<string, number>()
  for (const r of (mktPlanRes.data ?? []) as MktPlanRow[]) {
    if (r.marketingkosten_pct_manuell != null) {
      mktPlanMap.set(`${r.produkt_id}:${r.kategorie_id}:${r.kw_year}:${r.kw_number}`, Number(r.marketingkosten_pct_manuell))
    }
  }
  const mktKatEinstMap = new Map<string, MktKatEinstRow>()
  for (const r of (mktKatEinstRes.data ?? []) as MktKatEinstRow[]) {
    mktKatEinstMap.set(r.kategorie_id, r)
  }

  // Historical umsatz for retourenquote (product-level, across all platforms)
  const bruttoByProd = new Map<string, { datum: string; betrag: number }[]>()
  const rueckByProd = new Map<string, { datum: string; betrag: number }[]>()
  for (const r of (umsatzTransRes.data ?? []) as { produkt_id: string; kategorie_id: string; leistungsdatum: string; betrag: number }[]) {
    if (!r.produkt_id) continue
    if (bruttoUmsatzIds.has(r.kategorie_id)) {
      if (!bruttoByProd.has(r.produkt_id)) bruttoByProd.set(r.produkt_id, [])
      bruttoByProd.get(r.produkt_id)!.push({ datum: r.leistungsdatum, betrag: Number(r.betrag) })
    } else if (rueckerstattungsIds.has(r.kategorie_id)) {
      if (!rueckByProd.has(r.produkt_id)) rueckByProd.set(r.produkt_id, [])
      rueckByProd.get(r.produkt_id)!.push({ datum: r.leistungsdatum, betrag: Number(r.betrag) })
    }
  }

  const retourenquoteCache = new Map<string, number>()
  function getRetourenquote(prodId: string): number {
    if (retourenquoteCache.has(prodId)) return retourenquoteCache.get(prodId)!
    const einst = retourenAllgProdMap.get(prodId)
    if (!einst || einst.berechnungsart === 'keine') { retourenquoteCache.set(prodId, 0); return 0 }
    const periodDays = getPeriodDays(einst.berechnungsart)
    const startStr = toDateOnly(addDays(today, -periodDays - 7))
    const brutto = (bruttoByProd.get(prodId) ?? []).filter(r => r.datum >= startStr && r.datum < quoteEndStr)
    const rueck = (rueckByProd.get(prodId) ?? []).filter(r => r.datum >= startStr && r.datum < quoteEndStr)
    const sumBrutto = brutto.reduce((a, r) => a + r.betrag, 0)
    const sumRueck = rueck.reduce((a, r) => a + r.betrag, 0)
    const q = sumBrutto > 0 ? sumRueck / sumBrutto : 0
    retourenquoteCache.set(prodId, q)
    return q
  }

  // Bestellungen for Produktausgaben
  const bestellungMap = new Map<string, BestellungRow>()
  for (const r of (bestellungenRes.data ?? []) as BestellungRow[]) {
    bestellungMap.set(r.id, r)
  }
  const bestellProdByBest = new Map<string, string[]>()
  for (const r of (bestellProdRes.data ?? []) as BestellProduktRow[]) {
    if (!bestellProdByBest.has(r.bestellung_id)) bestellProdByBest.set(r.bestellung_id, [])
    bestellProdByBest.get(r.bestellung_id)!.push(r.produkt_id)
  }

  // ── 5. Accumulate results ────────────────────────────────────────────────────

  // key: `${kategorie_id}:${produkt_id}:${year}:${week}` → wert
  const resultMap = new Map<string, number>()

  function addWert(katId: string, prodId: string, year: number, week: number, val: number) {
    if (!inRange(year, week) || val <= 0) return
    const key = `${katId}:${prodId}:${year}:${week}`
    resultMap.set(key, (resultMap.get(key) ?? 0) + val)
  }

  // ── 5a. Produktausgaben ──────────────────────────────────────────────────────
  for (const [bestId, bestellung] of bestellungMap) {
    const prodIds = bestellProdByBest.get(bestId) ?? []
    if (prodIds.length === 0) continue
    const kosten = (bestellKostRes.data ?? []) as BestellKostRow[]
    for (const k of kosten) {
      if (k.bestellung_id !== bestId) continue
      const datumStr = k.datum
        ?? bestellung.ankunftsdatum_ist
        ?? bestellung.ankunftsdatum
        ?? bestellung.bestelldatum
      if (!datumStr) continue
      const d = new Date(datumStr + 'T00:00:00Z')
      const { year, week } = getISOWeekInfo(d)
      if (!inRange(year, week)) continue
      const perProd = Number(k.nettobetrag) / prodIds.length
      for (const prodId of prodIds) {
        addWert(k.kpi_kategorie_id, prodId, year, week, perProd)
      }
    }
  }

  // ── 5b–5e. Vertriebsausgaben (Versand, Lager, Retouren, Kulanz) ─────────────
  const versandL2 = versandL2Id[0] ?? null
  const lagerL2 = lagerL2Id[0] ?? null
  const retourenL2 = retourenL2Id[0] ?? null
  const kulanzL2 = kulanzL2Id[0] ?? null

  for (const platt of plattformen) {
    const vPlatt = versandPlattMap.get(platt.id)
    const lPlatt = lagerPlattMap.get(platt.id)
    const kPlatt = kulanzPlattMap.get(platt.id)

    for (const prod of produkte) {
      const vEinst = versandEinstMap.get(`${platt.id}:${prod.id}`)
      const lEinst = lagerEinstMap.get(`${platt.id}:${prod.id}`)
      const kEinst = kulanzEinstMap.get(`${platt.id}:${prod.id}`)
      const m3 = m3ByProd.get(prod.id) ?? 0

      const versandKosten = vEinst
        ? (Number(vEinst.versandgebuehr_spediteur ?? 0) + Number(vEinst.versandgebuehr_3pl ?? 0))
        : 0
      const lagerKosten = lEinst ? Number(lEinst.lagerkosten_euro_m3 ?? 0) : 0
      const kulanzQuote = kEinst ? Number(kEinst.quote_prozent ?? 0) / 100 : 0
      const kulanzKosten = kEinst
        ? (Number(kEinst.produktkosten_pro_stueck_euro_netto ?? 0) + Number(kEinst.versandkosten_pro_stueck_euro_netto ?? 0))
        : 0

      for (const { year, week } of planWeeks) {
        const absatz = getAbsatz(platt.id, prod.id, year, week)
        if (absatz <= 0) continue

        // Versandausgaben
        if (versandL2 && versandKosten > 0 && vPlatt) {
          const rawVersand = absatz * versandKosten
          const pw = shiftToPaymentWeek(year, week, vPlatt.zahlungsziel_tage, vPlatt.gruppierung, vPlatt.naechste_zahlung_basis_kw, vPlatt.naechste_zahlung_basis_jahr)
          const ust = getUstMultiplier(versandL2, vertriebL1Id)
          addWert(versandL2, prod.id, pw.year, pw.week, rawVersand * ust)
        }

        // Lagerausgaben
        if (lagerL2 && lagerKosten > 0 && m3 > 0 && lPlatt) {
          const rawLager = absatz * lagerKosten * m3
          const pw = shiftToPaymentWeek(year, week, lPlatt.zahlungsziel_tage, lPlatt.gruppierung, lPlatt.naechste_zahlung_basis_kw, lPlatt.naechste_zahlung_basis_jahr)
          const ust = getUstMultiplier(lagerL2, vertriebL1Id)
          addWert(lagerL2, prod.id, pw.year, pw.week, rawLager * ust)
        }

        // Ersatzteile/Kulanz
        if (kulanzL2 && kulanzQuote > 0 && kulanzKosten > 0 && kPlatt) {
          const rawKulanz = absatz * kulanzQuote * kulanzKosten
          const pw = shiftToPaymentWeek(year, week, kPlatt.zahlungsziel_tage, kPlatt.gruppierung, kPlatt.naechste_zahlung_basis_kw, kPlatt.naechste_zahlung_basis_jahr)
          const ust = getUstMultiplier(kulanzL2, vertriebL1Id)
          addWert(kulanzL2, prod.id, pw.year, pw.week, rawKulanz * ust)
        }
      }
    }
  }

  // Retourenausgaben (platform-agnostic zahlungsziel)
  if (retourenL2 && retourenAllgEinst) {
    for (const prod of produkte) {
      const retEinst = retourenAllgProdMap.get(prod.id)
      if (!retEinst) continue
      const quote = getRetourenquote(prod.id)
      const handlingKosten = Number(retEinst.retourenhandling_kosten_euro_netto ?? 0)
      if (quote <= 0 || handlingKosten <= 0) continue

      for (const { year, week } of planWeeks) {
        // Total absatz across all platforms
        let totalAbsatz = 0
        for (const platt of plattformen) {
          totalAbsatz += getAbsatz(platt.id, prod.id, year, week)
        }
        if (totalAbsatz <= 0) continue

        const rawRetouren = quote * totalAbsatz * handlingKosten
        const pw = shiftToPaymentWeek(year, week, retourenAllgEinst.zahlungsziel_tage, retourenAllgEinst.gruppierung, retourenAllgEinst.naechste_zahlung_basis_kw, retourenAllgEinst.naechste_zahlung_basis_jahr)
        const ust = getUstMultiplier(retourenL2, vertriebL1Id)
        addWert(retourenL2, prod.id, pw.year, pw.week, rawRetouren * ust)
      }
    }
  }

  // ── 5f. Marketingausgaben ────────────────────────────────────────────────────
  for (const mktKatId of unassignedMktL2Ids) {
    const mktKatEinst = mktKatEinstMap.get(mktKatId)
    for (const prod of produkte) {
      for (const { year, week } of planWeeks) {
        const pct = mktPlanMap.get(`${prod.id}:${mktKatId}:${year}:${week}`) ?? 0
        if (pct <= 0) continue

        // Total base (absatz × vk) across all platforms
        let base = 0
        for (const platt of plattformen) {
          base += getAbsatz(platt.id, prod.id, year, week) * getVk(platt.id, prod.id, year, week)
        }
        if (base <= 0) continue

        const rawMkt = (pct / 100) * base
        const pw = mktKatEinst
          ? shiftToPaymentWeek(year, week, mktKatEinst.zahlungsziel_tage, mktKatEinst.gruppierung, mktKatEinst.naechste_zahlung_basis_kw, mktKatEinst.naechste_zahlung_basis_jahr)
          : { year, week }
        const ust = getUstMultiplier(mktKatId, marketingL1Id)
        addWert(mktKatId, prod.id, pw.year, pw.week, rawMkt * ust)
      }
    }
  }

  // ── 6. Build response ────────────────────────────────────────────────────────
  const result = []
  for (const [key, wert] of resultMap) {
    const [katId, prodId, yearStr, weekStr] = key.split(':')
    result.push({
      kategorie_id: katId,
      produkt_id: prodId,
      kw_year: parseInt(yearStr, 10),
      kw_number: parseInt(weekStr, 10),
      wert: Math.round(wert * 100) / 100,
    })
  }

  return NextResponse.json({ data: result })
}
