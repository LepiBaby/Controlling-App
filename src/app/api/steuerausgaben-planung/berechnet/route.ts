import { NextResponse } from 'next/server'
import { requireAuth } from '@/lib/supabase-server'
import { fetchAllRows } from '@/lib/supabase-paginate'

// ─── ISO week helpers ──────────────────────────────────────────────────────────

function getISOWeekMonday(year: number, week: number): Date {
  const jan4 = new Date(Date.UTC(year, 0, 4))
  const jan4Day = jan4.getUTCDay() || 7
  const week1Monday = new Date(jan4.getTime() - (jan4Day - 1) * 86400000)
  return new Date(week1Monday.getTime() + (week - 1) * 7 * 86400000)
}

function getISOWeekInfo(d: Date): { year: number; week: number } {
  const thu = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate() + (4 - (d.getUTCDay() || 7))))
  const yearStart = new Date(Date.UTC(thu.getUTCFullYear(), 0, 1))
  const week = Math.ceil(((thu.getTime() - yearStart.getTime()) / 86400000 + 1) / 7)
  return { year: thu.getUTCFullYear(), week }
}

function addDays(d: Date, n: number): Date {
  return new Date(d.getTime() + n * 86400000)
}

function toDateOnly(d: Date): string {
  return d.toISOString().slice(0, 10)
}

// ─── Tax helpers ───────────────────────────────────────────────────────────────

// Calendar month (1–12) that a KW belongs to, based on the Thursday of the week.
function getMonthForKw(isoYear: number, isoWeek: number): { calYear: number; month: number } {
  const monday = getISOWeekMonday(isoYear, isoWeek)
  const thu = new Date(monday.getTime() + 3 * 86400000)
  return { calYear: thu.getUTCFullYear(), month: thu.getUTCMonth() + 1 }
}

function getQuarterForMonth(month: number): number {
  return Math.ceil(month / 3)
}

// First KW after a calendar month end, shifted by verschiebungTage.
// month is 1-based (1=Jan, 12=Dec). Date.UTC treats month as 0-based,
// so passing `month` directly gives the first day of the NEXT month.
function paymentKwForMonth(calYear: number, month: number, verschiebungTage: number): { year: number; week: number } {
  const firstOfNext = new Date(Date.UTC(calYear, month, 1))
  return getISOWeekInfo(addDays(firstOfNext, verschiebungTage))
}

// First KW after a quarter end, shifted by verschiebungTage.
function paymentKwForQuarter(calYear: number, quarter: number, verschiebungTage: number): { year: number; week: number } {
  const endMonth = quarter * 3 // 3, 6, 9, or 12 (1-based)
  const nYear = endMonth === 12 ? calYear + 1 : calYear
  const nMonth = endMonth % 12 // 0 for December (wraps to January next year)
  return getISOWeekInfo(addDays(new Date(Date.UTC(nYear, nMonth, 1)), verschiebungTage))
}

// Extract Vorsteuer portion from a GROSS (Brutto) amount.
function extractVorsteuer(brutto: number, ustSatz: number): number {
  if (ustSatz <= 0 || brutto === 0) return 0
  return brutto * ustSatz / (100 + ustSatz)
}

// Zahllast from a NET amount.
function calcZahllast(netto: number, ustSatz: number): number {
  if (ustSatz <= 0 || netto === 0) return 0
  return netto * ustSatz / 100
}

// ─── Route ─────────────────────────────────────────────────────────────────────

export async function GET(request: Request) {
  const { user, supabase, error } = await requireAuth()
  if (error) return error

  const { searchParams } = new URL(request.url)
  const vonKw = parseInt(searchParams.get('von_kw') ?? '', 10)
  const vonJahr = parseInt(searchParams.get('von_jahr') ?? '', 10)
  const bisKw = parseInt(searchParams.get('bis_kw') ?? '', 10)
  const bisJahr = parseInt(searchParams.get('bis_jahr') ?? '', 10)
  const ersteZukunftKw = parseInt(searchParams.get('erste_zukunftskw') ?? '', 10)
  const ersteZukunftJahr = parseInt(searchParams.get('erste_zukunftsjahr') ?? '', 10)
  const hatZukunftsgrenze = !isNaN(ersteZukunftKw) && !isNaN(ersteZukunftJahr)
  const zukunftsGrenzeIdx = hatZukunftsgrenze ? ersteZukunftJahr * 54 + ersteZukunftKw : 0

  if ([vonKw, vonJahr, bisKw, bisJahr].some(n => isNaN(n))) {
    return NextResponse.json(
      { error: 'von_kw, von_jahr, bis_kw, bis_jahr sind erforderlich' },
      { status: 400 },
    )
  }

  const firstMonday = getISOWeekMonday(vonJahr, vonKw)
  const lastMonday = getISOWeekMonday(bisJahr, bisKw)
  const endDate = toDateOnly(new Date(lastMonday.getTime() + 6 * 86400000))
  const bestellStartDate = toDateOnly(addDays(firstMonday, -120))
  const today = new Date()
  today.setUTCHours(0, 0, 0, 0)
  const todayStr = toDateOnly(today)
  const histStart = toDateOnly(addDays(today, -97)) // 90-day window + 7-day recency offset

  // ── Load all data in parallel ─────────────────────────────────────────────────

  const [
    ustEinstRes,
    ustSaetzeRes,
    bestellungenRes,
    bestellKostenRes,
    bestellProdukteRes,
    fiskalRes,
    einnahmenRes,
    umsatzausgabenRes,
    operativeRes,
    produktinvestRes,
    finanzierungsRes,
    kpiCatsRes,
    absatzPlanungRes,
    vkGebEinstRes,
    salesPlattPlanungRes,
    ustL1EbeneRes,
    produktKatsRes,
    einnahmenL1Res,
    operFixkostenRes,
    finEinstRes,
    versandPlattRes,
    lagerPlattRes,
    retourenEinstRes,
    kulanzPlattRes,
    retourenEinstDetailRes,
    retourenAllgemeinProdRes,
    umsatzKatsRes,
    umsatzTransRes,
    marketingPlanRes,
    auszahlungsMktRes,
    mktKatPlattRes,
    steuerManuellRes,
    kostenGlobalRes,
    wareBestelldatumRes,
  ] = await Promise.all([
    supabase
      .from('ust_einstellungen')
      .select('einfuhrust_satz, einfuhrust_zahlungsziel_tage, zahlungsfrequenz, zahlungsverschiebung_tage')
      .eq('user_id', user!.id)
      .single(),

    supabase
      .from('ust_kategorie_saetze')
      .select('kategorie_id, ebene, ust_satz')
      .eq('user_id', user!.id)
      .limit(1000),

    supabase
      .from('bestellungen')
      .select('id, status, ankunftsdatum, ankunftsdatum_ist, bestelldatum')
      .eq('user_id', user!.id)
      .in('status', ['plan', 'laufend'])
      .not('ankunftsdatum', 'is', null)
      .or(`ankunftsdatum.gte.${bestellStartDate},ankunftsdatum_ist.gte.${bestellStartDate}`)
      .or(`ankunftsdatum.lte.${endDate},ankunftsdatum_ist.lte.${endDate}`)
      .limit(500),

    fetchAllRows((from, to) =>
      supabase
        .from('bestellungen_kosten')
        .select('bestellung_id, kpi_kategorie_id, nettobetrag')
        .eq('user_id', user!.id)
        .order('id', { ascending: true })
        .range(from, to),
    ),

    fetchAllRows((from, to) =>
      supabase
        .from('bestellungen_produkte')
        .select('bestellung_id, produkt_id')
        .eq('user_id', user!.id)
        .order('id', { ascending: true })
        .range(from, to),
    ),

    supabase
      .from('einfuhrust_fiskalverzollung')
      .select('produkt_id, fiskalverzollung')
      .eq('user_id', user!.id)
      .limit(200),

    fetchAllRows((from, to) =>
      supabase
        .from('einnahmen_planung')
        .select('kategorie_id, kw_year, kw_number, betrag_manuell')
        .eq('user_id', user!.id)
        .gte('kw_year', vonJahr - 1)
        .lte('kw_year', bisJahr + 1)
        .order('id', { ascending: true })
        .range(from, to),
    ),

    fetchAllRows((from, to) =>
      supabase
        .from('umsatzausgaben_planung')
        .select('kategorie_id, kw_year, kw_number, betrag_manuell, ist_berechnet')
        .eq('user_id', user!.id)
        .gte('kw_year', vonJahr - 1)
        .lte('kw_year', bisJahr + 1)
        .order('id', { ascending: true })
        .range(from, to),
    ),

    fetchAllRows((from, to) =>
      supabase
        .from('operative_planung')
        .select('kategorie_id, kw_year, kw_number, betrag_manuell, ist_berechnet')
        .eq('user_id', user!.id)
        .gte('kw_year', vonJahr - 1)
        .lte('kw_year', bisJahr + 1)
        .order('id', { ascending: true })
        .range(from, to),
    ),

    fetchAllRows((from, to) =>
      supabase
        .from('produktinvestitions_planung')
        .select('kategorie_id, kw_year, kw_number, betrag_manuell')
        .eq('user_id', user!.id)
        .gte('kw_year', vonJahr - 1)
        .lte('kw_year', bisJahr + 1)
        .order('id', { ascending: true })
        .range(from, to),
    ),

    fetchAllRows((from, to) =>
      supabase
        .from('finanzierungs_planung')
        .select('kategorie_id, kw_year, kw_number, betrag_manuell, ist_berechnet')
        .eq('user_id', user!.id)
        .gte('kw_year', vonJahr - 1)
        .lte('kw_year', bisJahr + 1)
        .order('id', { ascending: true })
        .range(from, to),
    ),

    supabase
      .from('kpi_categories')
      .select('id, name, parent_id')
      .eq('type', 'ausgaben_kosten')
      .limit(500),

    fetchAllRows((from, to) =>
      supabase
        .from('absatz_planung')
        .select('sku_id, produkt_id, sales_plattform_id, kw_year, kw_number, absatz_manuell, effektiver_vk_manuell')
        .eq('user_id', user!.id)
        .gte('kw_year', vonJahr)
        .lte('kw_year', bisJahr)
        .order('id', { ascending: true })
        .range(from, to),
    ),

    supabase
      .from('verkaufsgebuehr_einstellungen')
      .select('sales_plattform_id, produkt_id, verkaufsgebuehr_prozent')
      .eq('user_id', user!.id)
      .limit(500),

    fetchAllRows((from, to) =>
      supabase
        .from('sales_plattform_planung')
        .select('produkt_id, sales_plattform_id, kategorie, kw_year, kw_number, wert_manuell')
        .eq('user_id', user!.id)
        .in('kategorie', ['rueckerstattungen', 'rabatte', 'bruttoumsatz', 'verkaufsgebuehr', 'retouren', 'marketing'])
        .gte('kw_year', vonJahr)
        .lte('kw_year', bisJahr)
        .order('id', { ascending: true })
        .range(from, to),
    ),

    supabase
      .from('ust_l1_ebene_auswahl')
      .select('kategorie_id, ebene')
      .eq('user_id', user!.id)
      .limit(500),

    supabase
      .from('kpi_categories')
      .select('id, name, parent_id, level')
      .eq('type', 'produkte')
      .limit(1000),

    supabase
      .from('kpi_categories')
      .select('id, name, parent_id')
      .eq('type', 'einnahmen')
      .limit(100),

    supabase
      .from('operative_fixkosten_einstellungen')
      .select('kategorie_id, untergruppe_id, zahlungsziel_tage, ust_satz')
      .eq('user_id', user!.id)
      .eq('aktiv', true)
      .limit(500),

    supabase
      .from('finanzierungs_einstellungen')
      .select('kategorie_id, zahlungsziel_tage, ust_satz')
      .eq('user_id', user!.id)
      .limit(500),

    supabase
      .from('versandausgaben_plattform_einstellungen')
      .select('zahlungsziel_tage')
      .eq('user_id', user!.id)
      .limit(100),

    supabase
      .from('lagerausgaben_plattform_einstellungen')
      .select('zahlungsziel_tage')
      .eq('user_id', user!.id)
      .limit(100),

    supabase
      .from('retouren_allgemein_einstellungen')
      .select('zahlungsziel_tage')
      .eq('user_id', user!.id)
      .limit(1),

    supabase
      .from('ersatzteile_kulanz_plattform_einstellungen')
      .select('zahlungsziel_tage')
      .eq('user_id', user!.id)
      .limit(100),

    // B1 Retourenkosten: per product×platform settings
    supabase
      .from('retouren_einstellungen')
      .select('sales_plattform_id, produkt_id, rueckversandkosten_euro_netto, erstattung_verkaufsgebuehr_prozent')
      .eq('user_id', user!.id)
      .limit(500),

    // B1 Retourenkosten: berechnungsart per product
    supabase
      .from('retouren_allgemein_produkt_einstellungen')
      .select('produkt_id, berechnungsart')
      .eq('user_id', user!.id)
      .limit(500),

    // B1 Retourenkosten: identify bruttoumsatz vs. rueckerstattungs categories
    supabase
      .from('kpi_categories')
      .select('id, name, ist_abzugsposten, parent_id')
      .eq('type', 'umsatz')
      .limit(500),

    // B1 Retourenkosten: historical umsatz transactions for retourenquote
    fetchAllRows((from, to) =>
      supabase
        .from('umsatz_transaktionen')
        .select('produkt_id, sales_plattform_id, leistungsdatum, betrag, kategorie_id')
        .gte('leistungsdatum', histStart)
        .lt('leistungsdatum', todayStr)
        .not('produkt_id', 'is', null)
        .not('sales_plattform_id', 'is', null)
        .order('id', { ascending: true })
        .range(from, to),
    ),

    // B1 Marketingkosten: planned marketing percentages
    fetchAllRows((from, to) =>
      supabase
        .from('marketing_planung')
        .select('produkt_id, kategorie_id, kw_year, kw_number, marketingkosten_pct_manuell')
        .eq('user_id', user!.id)
        .gte('kw_year', vonJahr)
        .lte('kw_year', bisJahr)
        .order('id', { ascending: true })
        .range(from, to),
    ),

    // B1 Marketingkosten: which marketing categories are included
    supabase
      .from('auszahlungs_marketing_gruppen')
      .select('kpi_kategorie_id')
      .eq('user_id', user!.id)
      .limit(500),

    // B1 Marketingkosten: platform assignment per marketing category
    supabase
      .from('marketing_kategorie_einstellungen')
      .select('kategorie_id, sales_plattform_id, zahlungsziel_tage')
      .eq('user_id', user!.id)
      .limit(100),

    // B6: manuell eingetragene Einfuhrumsatzsteuer (ist_berechnet=false) für Vorsteuer-Abzug
    fetchAllRows((from, to) =>
      supabase
        .from('steuerausgaben_planung')
        .select('kategorie_id, kw_year, kw_number, betrag_manuell')
        .eq('user_id', user!.id)
        .eq('ist_berechnet', false)
        .gte('kw_year', vonJahr - 1)
        .lte('kw_year', bisJahr + 1)
        .order('id', { ascending: true })
        .range(from, to),
    ),

    // B2 Produktkosten Zahlungsziele (Shipping, Inspektion, Einlagerung, Zoll)
    supabase
      .from('produktinformationen_kosten_global')
      .select('shipping_zahlungsziel_tage, inspektion_zahlungsziel_tage, einlagerung_zahlungsziel_tage, zoll_zahlungsziel_tage')
      .eq('user_id', user!.id)
      .maybeSingle(),

    // B2 Ware: Bestellungen nach Bestelldatum (getrennt von ankunftsdatum-Filter)
    supabase
      .from('bestellungen')
      .select('id, bestelldatum')
      .eq('user_id', user!.id)
      .in('status', ['plan', 'laufend'])
      .not('bestelldatum', 'is', null)
      .gte('bestelldatum', `${vonJahr - 1}-01-01`)
      .lte('bestelldatum', `${bisJahr + 1}-12-31`)
      .limit(500),
  ])

  // Any error (incl. PGRST116 = no row found) means no settings → return empty
  if (ustEinstRes.error) {
    return NextResponse.json({ data: [] })
  }

  type UstEinst = {
    einfuhrust_satz: number | null
    einfuhrust_zahlungsziel_tage: number | null
    zahlungsfrequenz: string | null
    zahlungsverschiebung_tage: number | null
  }
  const einst = (ustEinstRes.data ?? null) as UstEinst | null

  // Find Einfuhrumsatzsteuer and Umsatzsteuer categories by name within the Steuern subtree
  type KpiCat = { id: string; name: string; parent_id: string | null }
  const kpiCats = (kpiCatsRes.data ?? []) as KpiCat[]
  const steuernRoot = kpiCats.find(k => k.name.trim().toLowerCase() === 'steuern')
  const steuernSubtreeIds = new Set<string>()
  if (steuernRoot) {
    const toVisit = [steuernRoot.id]
    while (toVisit.length) {
      const id = toVisit.pop()!
      steuernSubtreeIds.add(id)
      for (const k of kpiCats) {
        if (k.parent_id === id && !steuernSubtreeIds.has(k.id)) toVisit.push(k.id)
      }
    }
  }
  const findByName = (name: string) =>
    kpiCats.find(k => steuernSubtreeIds.has(k.id) && k.name.trim().toLowerCase() === name)?.id ?? null

  // Only Ware, Shipping and Zoll count as base amount for Einfuhrumsatzsteuer
  const einfuhrBasisNames = new Set(['ware', 'shipping', 'zoll'])
  const einfuhrBasisIds = new Set(
    kpiCats.filter(k => einfuhrBasisNames.has(k.name.trim().toLowerCase())).map(k => k.id)
  )

  // UST rate lookup: (kategorie_id, ebene) → ust_satz
  const ustRateMap = new Map<string, number>()  // key: `${katId}:${ebene}`
  for (const row of ustSaetzeRes.data ?? []) {
    const katId = row.kategorie_id as string
    const satz = Number(row.ust_satz ?? 0)
    const ebene = Number(row.ebene ?? 1)
    ustRateMap.set(`${katId}:${ebene}`, satz)
  }

  // User's Gesamt/Aufgeteilt selection per L1 category (loaded for all usages, not just A1)
  const ustEbeneByKat = new Map<string, 1 | 2>()
  for (const r of (ustL1EbeneRes.data ?? []) as { kategorie_id: string; ebene: number }[]) {
    ustEbeneByKat.set(r.kategorie_id, r.ebene as 1 | 2)
  }

  // Result accumulator: "katId:year:week" → entry
  const result = new Map<string, { kategorie_id: string; kw_year: number; kw_number: number; wert: number }>()

  function addToResult(katId: string, kwYear: number, kwNum: number, wert: number) {
    if (!katId || wert === 0) return
    const kwMonday = getISOWeekMonday(kwYear, kwNum)
    if (kwMonday < firstMonday || kwMonday > lastMonday) return
    const key = `${katId}:${kwYear}:${kwNum}`
    if (!result.has(key)) result.set(key, { kategorie_id: katId, kw_year: kwYear, kw_number: kwNum, wert: 0 })
    result.get(key)!.wert += wert
  }

  // ── Past/future helper ────────────────────────────────────────────────────────
  function isPastKw(year: number, week: number): boolean {
    if (!hatZukunftsgrenze) return false
    return year * 54 + week < zukunftsGrenzeIdx
  }

  // ── Actual transaction data for past KWs ──────────────────────────────────────
  const pastStartDate = toDateOnly(firstMonday)
  const futureFirstMonday = hatZukunftsgrenze
    ? getISOWeekMonday(ersteZukunftJahr, ersteZukunftKw)
    : null
  const pastEndDate = futureFirstMonday ? toDateOnly(addDays(futureFirstMonday, -1)) : null

  type EinnahmenActualRow = { kategorie_id: string | null; gruppe_id: string | null; zahlungsdatum: string; betrag: number }
  type UmsatzActualRow = { produkt_id: string | null; kategorie_id: string; leistungsdatum: string; betrag: number }
  type AusgabenUstRow = { kategorie_id: string | null; gruppe_id: string | null; untergruppe_id: string | null; leistungsdatum: string; ust_betrag: number; relevanz: string | null }
  type EinfuhrActualRow = { gruppe_id: string | null; kategorie_id: string | null; untergruppe_id: string | null; leistungsdatum: string; betrag_brutto: number }

  let einnahmenActualRows: EinnahmenActualRow[] = []
  let umsatzActualRows: UmsatzActualRow[] = []
  let ausgabenUstRows: AusgabenUstRow[] = []
  let einfuhrActualRows: EinfuhrActualRow[] = []

  if (hatZukunftsgrenze && pastEndDate) {
    const [einnahmenActualRes, umsatzActualRes, ausgabenUstRes, einfuhrActualRes] = await Promise.all([
      fetchAllRows((from, to) =>
        supabase
          .from('einnahmen_transaktionen')
          .select('kategorie_id, gruppe_id, zahlungsdatum, betrag')
          .gte('zahlungsdatum', pastStartDate)
          .lte('zahlungsdatum', pastEndDate)
          .order('id', { ascending: true })
          .range(from, to),
      ),
      fetchAllRows((from, to) =>
        supabase
          .from('umsatz_transaktionen')
          .select('produkt_id, kategorie_id, leistungsdatum, betrag')
          .not('produkt_id', 'is', null)
          .gte('leistungsdatum', pastStartDate)
          .lte('leistungsdatum', pastEndDate)
          .order('id', { ascending: true })
          .range(from, to),
      ),
      fetchAllRows((from, to) =>
        supabase
          .from('ausgaben_kosten_transaktionen')
          .select('kategorie_id, gruppe_id, untergruppe_id, leistungsdatum, ust_betrag, relevanz')
          .not('leistungsdatum', 'is', null)
          .gt('ust_betrag', 0)
          .gte('leistungsdatum', pastStartDate)
          .lte('leistungsdatum', pastEndDate)
          .order('id', { ascending: true })
          .range(from, to),
      ),
      fetchAllRows((from, to) =>
        supabase
          .from('ausgaben_kosten_transaktionen')
          .select('gruppe_id, kategorie_id, untergruppe_id, leistungsdatum, betrag_brutto')
          .not('leistungsdatum', 'is', null)
          .gt('betrag_brutto', 0)
          .gte('leistungsdatum', pastStartDate)
          .lte('leistungsdatum', pastEndDate)
          .order('id', { ascending: true })
          .range(from, to),
      ),
    ])
    einnahmenActualRows = (einnahmenActualRes.data ?? []) as EinnahmenActualRow[]
    umsatzActualRows = (umsatzActualRes.data ?? []) as UmsatzActualRow[]
    ausgabenUstRows = (ausgabenUstRes.data ?? []) as AusgabenUstRow[]
    einfuhrActualRows = (einfuhrActualRes.data ?? []) as EinfuhrActualRow[]
  }

  // Map umsatz-kategorie → ist_abzugsposten (for A1 actual)
  const umsatzKatIsAbzugMap = new Map<string, boolean>()
  for (const k of (umsatzKatsRes.data ?? []) as { id: string; ist_abzugsposten: boolean }[]) {
    umsatzKatIsAbzugMap.set(k.id, k.ist_abzugsposten)
  }

  // ── Part 1: Einfuhrumsatzsteuer ───────────────────────────────────────────────

  // Collected entries are also used in B6 (Part 2) to deduct in the prior KW.
  const einfuhrEntries: Array<{ kwYear: number; kwNum: number; betrag: number }> = []
  // Einfuhrumsatzsteuer je Produkt × Zahlungs-KW (für die Aufschlüsselung "nach Produkt").
  // Deckt den gesamten Bereich ab (Vergangenheit + Zukunft) → dient Soll- und Ist-Plan-Spalten.
  // key: `${produktId|'__none__'}:${kwYear}:${kwNum}`
  const einfuhrProduktPerKw = new Map<string, number>()

  const einfuhrKatId = findByName('einfuhrumsatzsteuer')
  const einfuhrSatz = Number(einst?.einfuhrust_satz ?? 0)
  const einfuhrZahlungsziel = Number(einst?.einfuhrust_zahlungsziel_tage ?? 0)

  if (einfuhrKatId && einfuhrSatz > 0) {
    const kostenByBestellung = new Map<string, number>()
    for (const k of bestellKostenRes.data ?? []) {
      const katId = k.kpi_kategorie_id as string | null
      if (!katId || !einfuhrBasisIds.has(katId)) continue
      const id = k.bestellung_id as string
      kostenByBestellung.set(id, (kostenByBestellung.get(id) ?? 0) + Number(k.nettobetrag ?? 0))
    }

    const produktByBestellung = new Map<string, string>()
    for (const p of bestellProdukteRes.data ?? []) {
      produktByBestellung.set(p.bestellung_id as string, p.produkt_id as string)
    }

    const fiskalSet = new Set<string>()
    for (const f of fiskalRes.data ?? []) {
      if (f.fiskalverzollung) fiskalSet.add(f.produkt_id as string)
    }

    for (const b of bestellungenRes.data ?? []) {
      const bId = b.id as string
      const effAnkunft = (b.ankunftsdatum_ist ?? b.ankunftsdatum) as string | null
      if (!effAnkunft) continue

      const produktId = produktByBestellung.get(bId)
      if (produktId && fiskalSet.has(produktId)) continue

      const basisBetrag = kostenByBestellung.get(bId) ?? 0
      if (basisBetrag <= 0) continue

      const ankunft = new Date(effAnkunft + 'T00:00:00Z')
      const zahlungsdatum = addDays(ankunft, einfuhrZahlungsziel)
      const { year: kwYear, week: kwNum } = getISOWeekInfo(zahlungsdatum)

      const einfuhrBetrag = basisBetrag * einfuhrSatz / 100
      einfuhrEntries.push({ kwYear, kwNum, betrag: einfuhrBetrag })
      addToResult(einfuhrKatId, kwYear, kwNum, einfuhrBetrag)

      // Produkt-Aufschlüsselung nur innerhalb des angefragten Bereichs sammeln
      // (mirror of addToResult's range filter, damit Kinder zur Summe passen).
      const kwMonday = getISOWeekMonday(kwYear, kwNum)
      if (kwMonday >= firstMonday && kwMonday <= lastMonday) {
        const pKey = `${produktId ?? '__none__'}:${kwYear}:${kwNum}`
        einfuhrProduktPerKw.set(pKey, (einfuhrProduktPerKw.get(pKey) ?? 0) + einfuhrBetrag)
      }
    }
  }

  // ── Part 2: Umsatzsteuer (income UST − expense Vorsteuer, grouped by period) ──

  const ustKatId = findByName('umsatzsteuer')
  const zahlungsfrequenz = (einst?.zahlungsfrequenz ?? 'monatlich') as string
  const verschiebungTage = Number(einst?.zahlungsverschiebung_tage ?? 0)

  // Aufschlüsselung der Umsatzsteuer in ihre Komponenten (nur Soll/Zukunft):
  // output (Umsatzsteuer/Zahllast, positiv), vorsteuer (B1–B5, negativ),
  // einfuhr (Einfuhrumsatzsteuer-Abzug B6, negativ). Summe = Netto-UST.
  const umsatzsteuerKomponentenBreakdown: Array<{
    komponente: 'output' | 'vorsteuer' | 'einfuhr'; kw_year: number; kw_number: number; wert: number
  }> = []

  if (ustKatId) {
    // Net UST per KW: positive = Zahllast, negative = Erstattung/Vorsteuer
    const netUstPerKw = new Map<string, number>()
    // Komponenten je KW (output/vorsteuer/einfuhr); Summe = netUstPerKw
    type UstKomponente = 'output' | 'vorsteuer' | 'einfuhr'
    const komponentenPerKw = new Map<string, { output: number; vorsteuer: number; einfuhr: number }>()

    function addNetUst(kwYear: number, kwNum: number, delta: number, komponente: UstKomponente) {
      const key = `${kwYear}:${kwNum}`
      netUstPerKw.set(key, (netUstPerKw.get(key) ?? 0) + delta)
      let comp = komponentenPerKw.get(key)
      if (!comp) { comp = { output: 0, vorsteuer: 0, einfuhr: 0 }; komponentenPerKw.set(key, comp) }
      comp[komponente] += delta
    }

    // ── A1 / B1: Sales Plattform Planung ─────────────────────────────────────

    // Build SKU → product and product → parent maps (using dedicated produkte categories query)
    type ProduktKat = { id: string; name: string; parent_id: string | null; level: number }
    const produktKats = (produktKatsRes.data ?? []) as ProduktKat[]

    const skusByProdukt = new Map<string, string[]>()
    const produktParentMap = new Map<string, string>()
    for (const k of produktKats) {
      if (k.level === 2 && k.parent_id) {
        if (!skusByProdukt.has(k.parent_id)) skusByProdukt.set(k.parent_id, [])
        skusByProdukt.get(k.parent_id)!.push(k.id)
      }
      if (k.level === 1 && k.parent_id) produktParentMap.set(k.id, k.parent_id)
    }

    // Fallback UST rate: when a product has no parent in the produkte hierarchy,
    // use the "Produktverkäufe" einnahmen L1 Gesamt rate (if configured as ebene=1).
    type EinnahmenKat = { id: string; name: string; parent_id: string | null }
    const einnahmenKats = (einnahmenL1Res.data ?? []) as EinnahmenKat[]
    const produktverkaufeL1 = einnahmenKats.find(k => {
      if (k.parent_id !== null) return false
      const n = k.name.toLowerCase()
      return n.includes('produktverkäufe') || n.includes('produktverkaufe')
    })
    // Produktverkäufe subtree to exclude from A2 (already handled in A1)
    const prodVerkaufeSubtreeIds = new Set<string>()
    if (produktverkaufeL1) {
      const toVisitPv = [produktverkaufeL1.id]
      while (toVisitPv.length) {
        const id = toVisitPv.pop()!
        prodVerkaufeSubtreeIds.add(id)
        for (const k of einnahmenKats) {
          if (k.parent_id === id && !prodVerkaufeSubtreeIds.has(k.id)) toVisitPv.push(k.id)
        }
      }
    }

    // Combined parent map (einnahmen + ausgaben_kosten) for L1-ancestor lookup
    const ustCatParentMap = new Map<string, string>()
    for (const k of einnahmenKats) {
      if (k.parent_id) ustCatParentMap.set(k.id, k.parent_id)
    }
    for (const k of kpiCats) {
      if ((k as { parent_id?: string | null }).parent_id) ustCatParentMap.set(k.id, (k as { parent_id: string }).parent_id)
    }

    // Walk up to root (L1) of any category
    const findL1Ancestor = (katId: string): string => {
      let id = katId
      while (ustCatParentMap.has(id)) id = ustCatParentMap.get(id)!
      return id
    }

    // UST rate for any einnahmen or ausgaben_kosten category:
    // Respect the L1 ancestor's Gesamt/Aufgeteilt selection.
    const getUstSatz = (katId: string): number => {
      const l1Id = findL1Ancestor(katId)
      const selectedEbene = ustEbeneByKat.get(l1Id) ?? 1
      if (selectedEbene === 1) return ustRateMap.get(`${l1Id}:1`) ?? 0
      return ustRateMap.get(`${katId}:2`) ?? 0
    }

    // UST rate for a Produktverkäufe product:
    // If the user chose "Gesamt" for Produktverkäufe → one rate for all products (L1 rate).
    // If "Aufgeteilt" → per-product rate stored in ust_kategorie_saetze (type='produkte' category).
    function getUstSatzForProdukt(produktId: string): number {
      if (!produktverkaufeL1) return 0
      const ebene = ustEbeneByKat.get(produktverkaufeL1.id) ?? 1
      if (ebene === 1) {
        return ustRateMap.get(`${produktverkaufeL1.id}:1`) ?? 0
      }
      // Aufgeteilt: per-product rate (stored at ebene=1 in ust_kategorie_saetze for the produkte category)
      return ustRateMap.get(`${produktId}:1`) ?? ustRateMap.get(`${produktId}:2`) ?? 0
    }

    // Absatz per SKU + VK per product (from absatz_planung)
    const absatzBySkuPlattKw = new Map<string, number>()
    const vkByProdPlattKw = new Map<string, number>()
    for (const row of (absatzPlanungRes.data ?? []) as {
      sku_id: string | null; produkt_id: string; sales_plattform_id: string
      kw_year: number; kw_number: number; absatz_manuell: number | null; effektiver_vk_manuell: number | null
    }[]) {
      if (row.sku_id != null && row.absatz_manuell != null) {
        absatzBySkuPlattKw.set(`${row.sku_id}:${row.sales_plattform_id}:${row.kw_year}:${row.kw_number}`, Number(row.absatz_manuell))
      }
      if (row.sku_id == null && row.effektiver_vk_manuell != null) {
        vkByProdPlattKw.set(`${row.produkt_id}:${row.sales_plattform_id}:${row.kw_year}:${row.kw_number}`, Number(row.effektiver_vk_manuell))
      }
    }

    // Manual rueckerstattungen/rabatte per product×kw (platform-agnostic sum)
    // Manual bruttoumsatz overrides per product×platform×kw
    const rueckByProdKw = new Map<string, number>()
    const bruttoManualByProdPlattKw = new Map<string, number>()
    // Manuelle Soll-Overrides der B1-Positionen aus der Sales Plattform Planung.
    // Diese Werte sind BRUTTO (netto × (1 + UST/100), vgl. getUstMultiplier in der SPP-berechnet-Route),
    // daher wird die enthaltene Vorsteuer per extractVorsteuer() herausgerechnet.
    // verkaufsgebuehr/retouren: key = produkt:plattform:jahr:woche
    // marketing: in der SPP steht in sales_plattform_id die Marketing-kategorie_id → key = produkt:katId:jahr:woche
    const vkGebOverrideByProdPlattKw = new Map<string, number>()
    const retourenOverrideByProdPlattKw = new Map<string, number>()
    const marketingOverrideByProdKatKw = new Map<string, number>()
    for (const row of (salesPlattPlanungRes.data ?? []) as {
      produkt_id: string; sales_plattform_id: string | null; kategorie: string
      kw_year: number; kw_number: number; wert_manuell: number | null
    }[]) {
      if (row.wert_manuell == null) continue
      if (row.kategorie === 'rueckerstattungen' || row.kategorie === 'rabatte') {
        const key = `${row.produkt_id}:${row.kw_year}:${row.kw_number}`
        rueckByProdKw.set(key, (rueckByProdKw.get(key) ?? 0) + Number(row.wert_manuell))
      } else if (row.kategorie === 'bruttoumsatz' && row.sales_plattform_id) {
        bruttoManualByProdPlattKw.set(
          `${row.produkt_id}:${row.sales_plattform_id}:${row.kw_year}:${row.kw_number}`,
          Number(row.wert_manuell),
        )
      } else if (row.kategorie === 'verkaufsgebuehr' && row.sales_plattform_id) {
        vkGebOverrideByProdPlattKw.set(
          `${row.produkt_id}:${row.sales_plattform_id}:${row.kw_year}:${row.kw_number}`,
          Number(row.wert_manuell),
        )
      } else if (row.kategorie === 'retouren' && row.sales_plattform_id) {
        retourenOverrideByProdPlattKw.set(
          `${row.produkt_id}:${row.sales_plattform_id}:${row.kw_year}:${row.kw_number}`,
          Number(row.wert_manuell),
        )
      } else if (row.kategorie === 'marketing' && row.sales_plattform_id) {
        marketingOverrideByProdKatKw.set(
          `${row.produkt_id}:${row.sales_plattform_id}:${row.kw_year}:${row.kw_number}`,
          Number(row.wert_manuell),
        )
      }
    }

    // VK Gebühr rate per product × platform
    const vkGebProzentMap = new Map<string, number>()
    for (const row of (vkGebEinstRes.data ?? []) as { sales_plattform_id: string; produkt_id: string; verkaufsgebuehr_prozent: number | null }[]) {
      if (row.verkaufsgebuehr_prozent != null) {
        vkGebProzentMap.set(`${row.produkt_id}:${row.sales_plattform_id}`, Number(row.verkaufsgebuehr_prozent))
      }
    }

    // Find Verkaufsgebühr category for B1 UST rate (kpiCats = ausgaben_kosten only)
    let vkGebKatId: string | null = null
    for (const k of kpiCats) {
      if (vkGebKatId === null) {
        const n = k.name.toLowerCase()
        if (n.includes('verkaufsgebühr') || n.includes('verkaufsgebuehr')) vkGebKatId = k.id
      }
    }
    const vkGebUst = vkGebKatId ? getUstSatz(vkGebKatId) : 0

    // Compute bruttoumsatz per product × kw and per product × platform × kw
    const bruttoumsatzByProdKw = new Map<string, number>()
    const bruttoumsatzByProdPlattKw = new Map<string, number>()

    for (const [vkKey, vk] of vkByProdPlattKw) {
      if (vk === 0) continue
      const colonIdx1 = vkKey.indexOf(':')
      const rest1 = vkKey.slice(colonIdx1 + 1)
      const colonIdx2 = rest1.indexOf(':')
      const prodId = vkKey.slice(0, colonIdx1)
      const plattId = rest1.slice(0, colonIdx2)
      const rest2 = rest1.slice(colonIdx2 + 1)
      const colonIdx3 = rest2.indexOf(':')
      const kwY = Number(rest2.slice(0, colonIdx3))
      const kwN = Number(rest2.slice(colonIdx3 + 1))

      if (isPastKw(kwY, kwN)) continue // past KWs use actual transaction data

      const manualBrutto = bruttoManualByProdPlattKw.get(`${prodId}:${plattId}:${kwY}:${kwN}`)
      let brutto: number
      if (manualBrutto != null) {
        brutto = manualBrutto
      } else {
        const skus = skusByProdukt.get(prodId) ?? []
        let totalAbsatz = 0
        for (const skuId of skus) {
          const absatz = absatzBySkuPlattKw.get(`${skuId}:${plattId}:${kwY}:${kwN}`)
          if (absatz != null) totalAbsatz += absatz
        }
        if (totalAbsatz === 0) continue
        brutto = totalAbsatz * vk
      }
      if (brutto === 0) continue

      bruttoumsatzByProdPlattKw.set(`${prodId}:${plattId}:${kwY}:${kwN}`, (bruttoumsatzByProdPlattKw.get(`${prodId}:${plattId}:${kwY}:${kwN}`) ?? 0) + brutto)
      bruttoumsatzByProdKw.set(`${prodId}:${kwY}:${kwN}`, (bruttoumsatzByProdKw.get(`${prodId}:${kwY}:${kwN}`) ?? 0) + brutto)
    }

    // Computed Rückerstattungen fallback for A1: if no manual entry exists in
    // sales_plattform_planung for a product×KW, use the historical Rückerstattungsquote
    // (same logic as Sales Plattform Planung berechnet route) so the Zahllast stays
    // consistent with the values the user sees in the Sales Plattform Planung UI.
    type UmsatzKatA1 = { id: string; name: string | null; ist_abzugsposten: boolean }
    const umsatzKatListA1 = (umsatzKatsRes.data ?? []) as UmsatzKatA1[]
    const bruttoKatIdsA1 = new Set<string>()
    const rueckKatIdsA1 = new Set<string>()
    for (const k of umsatzKatListA1) {
      if (!k.ist_abzugsposten) bruttoKatIdsA1.add(k.id)
      else if (k.name?.toLowerCase().includes('rückerstattung')) rueckKatIdsA1.add(k.id)
    }

    const retourenAllgemeinMapA1 = new Map<string, string>()
    for (const r of (retourenAllgemeinProdRes.data ?? []) as { produkt_id: string; berechnungsart: string }[]) {
      retourenAllgemeinMapA1.set(r.produkt_id, r.berechnungsart)
    }

    function getPeriodDaysA1(art: string): number {
      if (art.endsWith('_7')) return 7
      if (art.endsWith('_14')) return 14
      if (art.endsWith('_30')) return 30
      if (art.endsWith('_60')) return 60
      if (art.endsWith('_90')) return 90
      return 30
    }

    type UmsatzTransA1 = { produkt_id: string; sales_plattform_id: string; leistungsdatum: string; betrag: number | string; kategorie_id: string }
    const umsatzTransListA1 = (umsatzTransRes.data ?? []) as UmsatzTransA1[]
    const quoteEndA1 = toDateOnly(addDays(today, -7))

    function computeRueckQuoteA1(prodId: string, plattId: string, periodDays: number): number {
      const periodStart = toDateOnly(addDays(today, -periodDays - 7))
      let sumBrutto = 0
      let sumRueck = 0
      for (const t of umsatzTransListA1) {
        if (t.produkt_id !== prodId || t.sales_plattform_id !== plattId) continue
        if (t.leistungsdatum < periodStart || t.leistungsdatum >= quoteEndA1) continue
        const betrag = Number(t.betrag)
        if (bruttoKatIdsA1.has(t.kategorie_id)) sumBrutto += betrag
        else if (rueckKatIdsA1.has(t.kategorie_id)) sumRueck += betrag
      }
      return sumBrutto > 0 ? sumRueck / sumBrutto : 0
    }

    const computedRueckByProdKw = new Map<string, number>()
    for (const [ppkKey, brutto] of bruttoumsatzByProdPlattKw) {
      const c1 = ppkKey.indexOf(':')
      const r1 = ppkKey.slice(c1 + 1)
      const c2 = r1.indexOf(':')
      const prodId = ppkKey.slice(0, c1)
      const plattId = r1.slice(0, c2)
      const r2 = r1.slice(c2 + 1)
      const c3 = r2.indexOf(':')
      const kwY = Number(r2.slice(0, c3))
      const kwN = Number(r2.slice(c3 + 1))

      const art = retourenAllgemeinMapA1.get(prodId) ?? 'keine'
      if (art === 'keine') continue

      const rueckQuote = computeRueckQuoteA1(prodId, plattId, getPeriodDaysA1(art))
      if (rueckQuote <= 0) continue

      const computedRueck = Math.round(rueckQuote * brutto * 100) / 100
      const prodKwKey = `${prodId}:${kwY}:${kwN}`
      computedRueckByProdKw.set(prodKwKey, (computedRueckByProdKw.get(prodKwKey) ?? 0) + computedRueck)
    }

    // A1: Zahllast from Produktverkäufe (bruttoumsatz - rueckerstattungen)
    for (const [pkKey, brutto] of bruttoumsatzByProdKw) {
      const colonIdx = pkKey.indexOf(':')
      const prodId = pkKey.slice(0, colonIdx)
      const rest = pkKey.slice(colonIdx + 1)
      const colonIdx2 = rest.indexOf(':')
      const kwY = Number(rest.slice(0, colonIdx2))
      const kwN = Number(rest.slice(colonIdx2 + 1))

      const rueck = rueckByProdKw.has(pkKey)
        ? (rueckByProdKw.get(pkKey) ?? 0)
        : (computedRueckByProdKw.get(pkKey) ?? 0)
      const nettoumsatz = brutto - rueck
      if (nettoumsatz <= 0) continue

      const ust = getUstSatzForProdukt(prodId)
      if (ust <= 0) continue

      addNetUst(kwY, kwN, extractVorsteuer(nettoumsatz, ust), 'output')
    }

    // B1 shared setup: Retourenquote classification — only Rückerstattungen, matching SPP route
    type UmsatzKat = { id: string; name: string | null; ist_abzugsposten: boolean; parent_id: string | null }
    const umsatzKatListB1 = (umsatzKatsRes.data ?? []) as UmsatzKat[]
    const bruttoUmsatzKatIds = new Set<string>()
    const rueckerstattungsKatIds = new Set<string>()
    for (const k of umsatzKatListB1) {
      if (!k.ist_abzugsposten) bruttoUmsatzKatIds.add(k.id)
      else if (k.name?.toLowerCase().includes('rückerstattung')) rueckerstattungsKatIds.add(k.id)
    }

    const retourenAllgemeinProdMapB1 = new Map<string, string>()
    for (const r of (retourenAllgemeinProdRes.data ?? []) as { produkt_id: string; berechnungsart: string }[]) {
      retourenAllgemeinProdMapB1.set(r.produkt_id, r.berechnungsart)
    }

    const umsatzTransDataB1 = (umsatzTransRes.data ?? []) as UmsatzTransA1[]

    function getPeriodDaysForBerechnungsart(art: string): number {
      if (art.endsWith('_7')) return 7
      if (art.endsWith('_14')) return 14
      if (art.endsWith('_30')) return 30
      if (art.endsWith('_60')) return 60
      if (art.endsWith('_90')) return 90
      return 30
    }

    function computeRetourenquote(prodId: string, plattId: string, periodDays: number): number {
      const periodStart = toDateOnly(addDays(today, -periodDays - 7))
      const quoteEnd = toDateOnly(addDays(today, -7))
      let sumBrutto = 0
      let sumRueck = 0
      for (const t of umsatzTransDataB1) {
        if (t.produkt_id !== prodId || t.sales_plattform_id !== plattId) continue
        if (t.leistungsdatum < periodStart || t.leistungsdatum >= quoteEnd) continue
        const betrag = Number(t.betrag)
        if (bruttoUmsatzKatIds.has(t.kategorie_id)) sumBrutto += betrag
        else if (rueckerstattungsKatIds.has(t.kategorie_id)) sumRueck += Math.abs(betrag)
      }
      return sumBrutto > 0 ? sumRueck / sumBrutto : 0
    }

    type RetourenEinstDetail = { sales_plattform_id: string; produkt_id: string; rueckversandkosten_euro_netto: number | null; erstattung_verkaufsgebuehr_prozent: number | null }
    const retourenEinstDetailData = (retourenEinstDetailRes.data ?? []) as RetourenEinstDetail[]
    const erstattungFractionMap = new Map<string, number>()
    for (const r of retourenEinstDetailData) {
      const frac = r.erstattung_verkaufsgebuehr_prozent != null ? Number(r.erstattung_verkaufsgebuehr_prozent) / 100 : 0
      erstattungFractionMap.set(`${r.produkt_id}:${r.sales_plattform_id}`, frac)
    }

    // B1: Vorsteuer from Verkaufsgebühr (with erstattung_verkaufsgebuehr deduction, matching SPP route)
    if (vkGebUst > 0) {
      for (const [ppkKey, brutto] of bruttoumsatzByProdPlattKw) {
        const colonIdx1 = ppkKey.indexOf(':')
        const rest1 = ppkKey.slice(colonIdx1 + 1)
        const colonIdx2 = rest1.indexOf(':')
        const prodId = ppkKey.slice(0, colonIdx1)
        const plattId = rest1.slice(0, colonIdx2)
        const rest2 = rest1.slice(colonIdx2 + 1)
        const colonIdx3 = rest2.indexOf(':')
        const kwY = Number(rest2.slice(0, colonIdx3))
        const kwN = Number(rest2.slice(colonIdx3 + 1))

        // Manueller Soll-Override hat Vorrang → wird unten separat verarbeitet
        if (vkGebOverrideByProdPlattKw.has(`${prodId}:${plattId}:${kwY}:${kwN}`)) continue

        const vkGebProzent = vkGebProzentMap.get(`${prodId}:${plattId}`)
        if (!vkGebProzent || vkGebProzent === 0) continue

        const erstattungFraction = erstattungFractionMap.get(`${prodId}:${plattId}`) ?? 0
        let vkGebNetto = brutto * vkGebProzent / 100
        if (erstattungFraction > 0) {
          const berechnungsart = retourenAllgemeinProdMapB1.get(prodId) ?? 'keine'
          if (berechnungsart !== 'keine') {
            const periodDays = getPeriodDaysForBerechnungsart(berechnungsart)
            const retourenquote = computeRetourenquote(prodId, plattId, periodDays)
            vkGebNetto -= brutto * retourenquote * erstattungFraction
          }
        }

        addNetUst(kwY, kwN, -calcZahllast(vkGebNetto, vkGebUst), 'vorsteuer')
      }
    }

    // B1: manuelle Soll-Overrides der Verkaufsgebühr (Bruttowert → enthaltene Vorsteuer)
    for (const [key, brutto] of vkGebOverrideByProdPlattKw) {
      const parts = key.split(':')
      const kwY = Number(parts[2]); const kwN = Number(parts[3])
      if (isPastKw(kwY, kwN)) continue // Vergangenheit nutzt Ist-Transaktionen
      addNetUst(kwY, kwN, -extractVorsteuer(brutto, vkGebUst), 'vorsteuer')
    }

    // B1 extension: Retourenkosten Vorsteuer
    let retourenKatId: string | null = null
    for (const k of kpiCats) {
      if (retourenKatId === null && k.name.trim().toLowerCase() === 'retouren') retourenKatId = k.id
    }
    const retourenUst = retourenKatId ? getUstSatz(retourenKatId) : 0

    if (retourenUst > 0) {
      const retourenEinstDetailMap = new Map<string, number>()
      for (const r of retourenEinstDetailData) {
        retourenEinstDetailMap.set(`${r.produkt_id}:${r.sales_plattform_id}`, Number(r.rueckversandkosten_euro_netto ?? 0))
      }

      for (const [ppkKey, brutto] of bruttoumsatzByProdPlattKw) {
        if (brutto === 0) continue
        const colonIdx1 = ppkKey.indexOf(':')
        const rest1 = ppkKey.slice(colonIdx1 + 1)
        const colonIdx2 = rest1.indexOf(':')
        const prodId = ppkKey.slice(0, colonIdx1)
        const plattId = rest1.slice(0, colonIdx2)
        const rest2 = rest1.slice(colonIdx2 + 1)
        const colonIdx3 = rest2.indexOf(':')
        const kwY = Number(rest2.slice(0, colonIdx3))
        const kwN = Number(rest2.slice(colonIdx3 + 1))

        // Manueller Soll-Override hat Vorrang → wird unten separat verarbeitet
        if (retourenOverrideByProdPlattKw.has(`${prodId}:${plattId}:${kwY}:${kwN}`)) continue

        const berechnungsart = retourenAllgemeinProdMapB1.get(prodId) ?? 'keine'
        if (berechnungsart === 'keine') continue

        const rueckversand = retourenEinstDetailMap.get(`${prodId}:${plattId}`) ?? 0
        if (rueckversand <= 0) continue

        const periodDays = getPeriodDaysForBerechnungsart(berechnungsart)
        const retourenquote = computeRetourenquote(prodId, plattId, periodDays)
        if (retourenquote <= 0) continue

        const skus = skusByProdukt.get(prodId) ?? []
        let totalAbsatz = 0
        for (const skuId of skus) {
          totalAbsatz += absatzBySkuPlattKw.get(`${skuId}:${plattId}:${kwY}:${kwN}`) ?? 0
        }
        if (totalAbsatz <= 0) continue

        const retourenKostenNetto = retourenquote * totalAbsatz * rueckversand
        addNetUst(kwY, kwN, -calcZahllast(retourenKostenNetto, retourenUst), 'vorsteuer')
      }
    }

    // B1: manuelle Soll-Overrides der Retourenkosten (Bruttowert → enthaltene Vorsteuer)
    for (const [key, brutto] of retourenOverrideByProdPlattKw) {
      const parts = key.split(':')
      const kwY = Number(parts[2]); const kwN = Number(parts[3])
      if (isPastKw(kwY, kwN)) continue // Vergangenheit nutzt Ist-Transaktionen
      addNetUst(kwY, kwN, -extractVorsteuer(brutto, retourenUst), 'vorsteuer')
    }

    // B1 extension: Marketingkosten Vorsteuer (planned values from marketing_planung)
    const mktL1 = kpiCats.find(k => k.parent_id === null && k.name.toLowerCase() === 'marketing')
    const mktL1Id = mktL1?.id ?? null

    const inkludierteMarketingKatIds = new Set<string>(
      ((auszahlungsMktRes.data ?? []) as { kpi_kategorie_id: string }[]).map(r => r.kpi_kategorie_id)
    )
    const mktKatPlattMap = new Map<string, string | null>()
    for (const e of (mktKatPlattRes.data ?? []) as { kategorie_id: string; sales_plattform_id: string | null }[]) {
      mktKatPlattMap.set(e.kategorie_id, e.sales_plattform_id ?? null)
    }

    for (const row of (marketingPlanRes.data ?? []) as {
      produkt_id: string; kategorie_id: string; kw_year: number; kw_number: number; marketingkosten_pct_manuell: number | null
    }[]) {
      if (isPastKw(row.kw_year, row.kw_number)) continue // past KWs use actual transaction data
      if (row.marketingkosten_pct_manuell == null) continue
      if (!inkludierteMarketingKatIds.has(row.kategorie_id)) continue
      // Manueller Soll-Override hat Vorrang → wird unten separat verarbeitet
      if (marketingOverrideByProdKatKw.has(`${row.produkt_id}:${row.kategorie_id}:${row.kw_year}:${row.kw_number}`)) continue
      const pct = Number(row.marketingkosten_pct_manuell)
      if (pct <= 0) continue

      const plattId = mktKatPlattMap.get(row.kategorie_id) ?? null
      const brutto = plattId
        ? (bruttoumsatzByProdPlattKw.get(`${row.produkt_id}:${plattId}:${row.kw_year}:${row.kw_number}`) ?? 0)
        : (bruttoumsatzByProdKw.get(`${row.produkt_id}:${row.kw_year}:${row.kw_number}`) ?? 0)
      if (brutto <= 0) continue

      const mktKostenNetto = brutto * pct / 100
      // UST rate: per subcategory (Aufgeteilt) or fallback to Marketing L1 (Gesamt)
      const mktUst = getUstSatz(row.kategorie_id) || (mktL1Id ? getUstSatz(mktL1Id) : 0)
      if (mktUst <= 0) continue

      addNetUst(row.kw_year, row.kw_number, -calcZahllast(mktKostenNetto, mktUst), 'vorsteuer')
    }

    // B1: manuelle Soll-Overrides der Marketingkosten (Bruttowert → enthaltene Vorsteuer)
    // In der SPP steht die Marketing-kategorie_id im Feld sales_plattform_id → key = produkt:katId:jahr:woche
    for (const [key, brutto] of marketingOverrideByProdKatKw) {
      const parts = key.split(':')
      const katId = parts[1]
      const kwY = Number(parts[2]); const kwN = Number(parts[3])
      if (isPastKw(kwY, kwN)) continue // Vergangenheit nutzt Ist-Transaktionen
      if (!inkludierteMarketingKatIds.has(katId)) continue
      const mktUst = getUstSatz(katId) || (mktL1Id ? getUstSatz(mktL1Id) : 0)
      addNetUst(kwY, kwN, -extractVorsteuer(brutto, mktUst), 'vorsteuer')
    }

    // A2 — Einnahmenplanung Zahllast (alle außer Produktverkäufe — wird in A1 erfasst)
    // Only process proper einnahmen-type categories; skips platform-breakdown entries
    // (type=sales_plattformen) that produktverkaeufe-berechnet persists per platform.
    const einnahmenKatIds = new Set(einnahmenKats.map((k: EinnahmenKat) => k.id))
    for (const row of einnahmenRes.data ?? []) {
      if (isPastKw(row.kw_year as number, row.kw_number as number)) continue // past KWs use actual transaction data
      if (!einnahmenKatIds.has(row.kategorie_id as string)) continue
      if (prodVerkaufeSubtreeIds.has(row.kategorie_id as string)) continue
      const satz = getUstSatz(row.kategorie_id as string)
      const brutto = Number(row.betrag_manuell ?? 0)
      addNetUst(row.kw_year as number, row.kw_number as number, extractVorsteuer(brutto, satz), 'output')
    }

    // B2 — Umsatzausgaben Vorsteuer (Marketing ausgeschlossen; Vertrieb mit Zahlungsziel-Rückrechnung)

    // Identify Marketing subtree to exclude (no double-counting with marketing_planung)
    const kpiL1Ids = new Set(kpiCats.filter(k => k.parent_id === null).map(k => k.id))
    const mktSubtreeIds = new Set<string>()
    if (mktL1Id) {
      const toVisitMkt = [mktL1Id]
      while (toVisitMkt.length) {
        const id = toVisitMkt.pop()!
        mktSubtreeIds.add(id)
        for (const k of kpiCats) {
          if (k.parent_id === id && !mktSubtreeIds.has(k.id)) toVisitMkt.push(k.id)
        }
      }
    }

    // Zahlungsziel per Kategorie-Typ für Rückrechnung auf Ursprungs-KW
    const firstZt = (arr: unknown[]) =>
      Number((arr as { zahlungsziel_tage: number | null }[]).find(r => r.zahlungsziel_tage != null)?.zahlungsziel_tage ?? 0)
    const versandZt = firstZt(versandPlattRes.data ?? [])
    const lagerZt = firstZt(lagerPlattRes.data ?? [])
    const retourenZt = Number(((retourenEinstRes.data ?? []) as { zahlungsziel_tage: number | null }[])[0]?.zahlungsziel_tage ?? 0)
    const kulanzZt = firstZt(kulanzPlattRes.data ?? [])

    // Produktkosten Zahlungsziele aus produktinformationen_kosten_global
    type KostenGlobal = { shipping_zahlungsziel_tage: number | null; inspektion_zahlungsziel_tage: number | null; einlagerung_zahlungsziel_tage: number | null; zoll_zahlungsziel_tage: number | null }
    const kostenGlobal = (kostenGlobalRes as { data: KostenGlobal | null }).data
    const shippingZt = Number(kostenGlobal?.shipping_zahlungsziel_tage ?? 0)
    const inspektionZt = Number(kostenGlobal?.inspektion_zahlungsziel_tage ?? 0)
    const einlagerungZt = Number(kostenGlobal?.einlagerung_zahlungsziel_tage ?? 0)
    const zollZt = Number(kostenGlobal?.zoll_zahlungsziel_tage ?? 0)

    // Ware-Kategorie-ID: wird separat via Bestelldatum verarbeitet (nicht aus umsatzausgaben_planung)
    const wareKatId = kpiCats.find(k => k.name.trim().toLowerCase() === 'ware')?.id ?? null

    // Map: L2-Kategorie-ID → Zahlungsziel-Tage für Rückrechnung
    // Reihenfolge beachten: 'einlagerung' vor 'lager' prüfen (String-Überschneidung)
    const umsatzZahlungszielByKat = new Map<string, number>()
    for (const k of kpiCats) {
      if (!k.parent_id || !kpiL1Ids.has(k.parent_id)) continue // only direct L2 children
      const n = k.name.toLowerCase()
      if (n.includes('versand')) umsatzZahlungszielByKat.set(k.id, versandZt)
      else if (n.includes('einlagerung')) umsatzZahlungszielByKat.set(k.id, einlagerungZt)
      else if (n.includes('lager')) umsatzZahlungszielByKat.set(k.id, lagerZt)
      else if (n.includes('retouren')) umsatzZahlungszielByKat.set(k.id, retourenZt)
      else if (n.includes('ersatz') || n.includes('kulanz')) umsatzZahlungszielByKat.set(k.id, kulanzZt)
      else if (n.includes('shipping')) umsatzZahlungszielByKat.set(k.id, shippingZt)
      else if (n.includes('inspektion')) umsatzZahlungszielByKat.set(k.id, inspektionZt)
      else if (n.includes('zoll')) umsatzZahlungszielByKat.set(k.id, zollZt)
    }

    // Marketing-Zahlungsziele für nicht in Auszahlungseinstellungen zugeordnete Kategorien
    for (const e of (mktKatPlattRes.data ?? []) as { kategorie_id: string; zahlungsziel_tage: number | null }[]) {
      if (!inkludierteMarketingKatIds.has(e.kategorie_id)) {
        umsatzZahlungszielByKat.set(e.kategorie_id, Number(e.zahlungsziel_tage ?? 0))
      }
    }

    for (const row of umsatzausgabenRes.data ?? []) {
      if (isPastKw(row.kw_year as number, row.kw_number as number)) continue // past KWs use actual transaction data
      const katId = row.kategorie_id as string
      // Marketing: nur ausschließen wenn in Auszahlungseinstellungen (dann in B1 verarbeitet)
      if (mktSubtreeIds.has(katId) && inkludierteMarketingKatIds.has(katId)) continue
      // Ware (ist_berechnet): wird direkt via Bestelldatum separat verarbeitet
      if (wareKatId && katId === wareKatId && row.ist_berechnet === true) continue
      const satz = getUstSatz(katId)
      const brutto = Number(row.betrag_manuell ?? 0)
      let kwY = row.kw_year as number
      let kwN = row.kw_number as number
      const zt = umsatzZahlungszielByKat.get(katId) ?? 0
      if (zt > 0) {
        const orig = getISOWeekInfo(addDays(getISOWeekMonday(kwY, kwN), -zt))
        kwY = orig.year
        kwN = orig.week
      }
      addNetUst(kwY, kwN, -extractVorsteuer(brutto, satz), 'vorsteuer')
    }

    // B2 Ware — direkt via Bestelldatum (korrekt unabhängig vom UST-Satz)
    if (wareKatId) {
      const wareUstSatz = getUstSatz(wareKatId)
      if (wareUstSatz > 0) {
        const wareBestelldatumById = new Map<string, string>()
        for (const b of (wareBestelldatumRes as { data: { id: string; bestelldatum: string | null }[] | null }).data ?? []) {
          if (b.bestelldatum) wareBestelldatumById.set(b.id, b.bestelldatum)
        }
        for (const k of (bestellKostenRes.data ?? []) as { bestellung_id: string; kpi_kategorie_id: string; nettobetrag: number | null }[]) {
          if (k.kpi_kategorie_id !== wareKatId) continue
          const bestelldatum = wareBestelldatumById.get(k.bestellung_id)
          if (!bestelldatum) continue
          const { year: kwY, week: kwN } = getISOWeekInfo(new Date(bestelldatum + 'T00:00:00Z'))
          if (isPastKw(kwY, kwN)) continue
          const netto = Number(k.nettobetrag ?? 0)
          if (netto <= 0) continue
          addNetUst(kwY, kwN, -calcZahllast(netto, wareUstSatz), 'vorsteuer')
        }
      }
    }

    // B3 — Operative Ausgaben Vorsteuer (Zahlungsziel-Rückrechnung für ist_berechnet=true)

    // Hierarchische UST-Suche: eigener Satz → übergeordnete Gruppe → weitere Eltern → 0
    const kpiCatParentMap = new Map<string, string>()
    for (const k of kpiCats) {
      if (k.parent_id) kpiCatParentMap.set(k.id, k.parent_id)
    }
    function getUstSatzHierarchisch(katId: string): number {
      const l1Id = findL1Ancestor(katId)
      const selectedEbene = ustEbeneByKat.get(l1Id) ?? 1
      if (selectedEbene === 1) return ustRateMap.get(`${l1Id}:1`) ?? 0
      // Aufgeteilt: walk up from katId looking for ebene=2 rates
      let id: string | undefined = katId
      while (id) {
        const rate = ustRateMap.get(`${id}:2`)
        if (rate != null) return rate
        id = kpiCatParentMap.get(id)
      }
      return 0
    }

    const operZahlungszielByKat = new Map<string, number>()
    const operUstSatzByKat = new Map<string, number>()
    for (const row of (operFixkostenRes.data ?? []) as { kategorie_id: string; untergruppe_id: string | null; zahlungsziel_tage: number | null; ust_satz: string | null }[]) {
      const effKatId = row.untergruppe_id ?? row.kategorie_id
      operZahlungszielByKat.set(effKatId, Number(row.zahlungsziel_tage ?? 0))
      if (row.ust_satz != null) operUstSatzByKat.set(effKatId, Number(row.ust_satz))
    }
    for (const row of operativeRes.data ?? []) {
      if (isPastKw(row.kw_year as number, row.kw_number as number)) continue // past KWs use actual transaction data
      const brutto = Number(row.betrag_manuell ?? 0)
      let kwY = row.kw_year as number
      let kwN = row.kw_number as number
      const ztB3 = operZahlungszielByKat.get(row.kategorie_id as string) ?? 0
      if (ztB3 > 0) {
        const orig = getISOWeekInfo(addDays(getISOWeekMonday(kwY, kwN), -ztB3))
        kwY = orig.year
        kwN = orig.week
      }
      const satz = row.ist_berechnet === true
        ? (operUstSatzByKat.get(row.kategorie_id as string) ?? getUstSatzHierarchisch(row.kategorie_id as string))
        : getUstSatzHierarchisch(row.kategorie_id as string)
      addNetUst(kwY, kwN, -extractVorsteuer(brutto, satz), 'vorsteuer')
    }

    // B4 — Produktinvestitionsausgaben Vorsteuer (no zahlungsziel shift needed)
    for (const row of produktinvestRes.data ?? []) {
      if (isPastKw(row.kw_year as number, row.kw_number as number)) continue // past KWs use actual transaction data
      const satz = getUstSatzHierarchisch(row.kategorie_id as string)
      const brutto = Number(row.betrag_manuell ?? 0)
      addNetUst(row.kw_year as number, row.kw_number as number, -extractVorsteuer(brutto, satz), 'vorsteuer')
    }

    // B5 — Finanzierungsausgaben Vorsteuer (Zahlungsziel-Rückrechnung für ist_berechnet=true)
    const finZahlungszielByKat = new Map<string, number>()
    const finUstSatzByKat = new Map<string, number>()
    for (const row of (finEinstRes.data ?? []) as { kategorie_id: string; zahlungsziel_tage: number | null; ust_satz: string | null }[]) {
      finZahlungszielByKat.set(row.kategorie_id, Number(row.zahlungsziel_tage ?? 0))
      if (row.ust_satz != null) finUstSatzByKat.set(row.kategorie_id, Number(row.ust_satz))
    }
    for (const row of finanzierungsRes.data ?? []) {
      if (isPastKw(row.kw_year as number, row.kw_number as number)) continue // past KWs use actual transaction data
      const brutto = Number(row.betrag_manuell ?? 0)
      let kwY = row.kw_year as number
      let kwN = row.kw_number as number
      const ztB5 = finZahlungszielByKat.get(row.kategorie_id as string) ?? 0
      if (ztB5 > 0) {
        const orig = getISOWeekInfo(addDays(getISOWeekMonday(kwY, kwN), -ztB5))
        kwY = orig.year
        kwN = orig.week
      }
      const satz = row.ist_berechnet === true
        ? (finUstSatzByKat.get(row.kategorie_id as string) ?? getUstSatz(row.kategorie_id as string))
        : getUstSatz(row.kategorie_id as string)
      addNetUst(kwY, kwN, -extractVorsteuer(brutto, satz), 'vorsteuer')
    }

    // B6 — Einfuhrumsatzsteuer-Abzug in der Ankunftswoche (= Zahlungsziel-KW minus Zahlungsziel-Tage)
    for (const { kwYear, kwNum, betrag } of einfuhrEntries) {
      if (isPastKw(kwYear, kwNum)) continue // Vergangenheit: Ist-Tatsächlich-Transaktionen werden unten verwendet
      const { year: prevY, week: prevW } = getISOWeekInfo(addDays(getISOWeekMonday(kwYear, kwNum), -einfuhrZahlungsziel))
      addNetUst(prevY, prevW, -betrag, 'einfuhr')
    }
    // B6 (Manuell) — manuell eingetragene Einfuhrumsatzsteuer als Vorsteuer abziehen (nur Zukunft)
    if (einfuhrKatId) {
      for (const row of steuerManuellRes.data ?? []) {
        if ((row.kategorie_id as string) !== einfuhrKatId) continue
        if (isPastKw(row.kw_year as number, row.kw_number as number)) continue // Vergangenheit: Ist-Tatsächlich verwendet
        const betrag = Number(row.betrag_manuell ?? 0)
        if (betrag <= 0) continue
        const { year: prevY, week: prevW } = getISOWeekInfo(
          addDays(getISOWeekMonday(row.kw_year as number, row.kw_number as number), -einfuhrZahlungsziel)
        )
        addNetUst(prevY, prevW, -betrag, 'einfuhr')
      }
    }
    // B6 (Ist-Tatsächlich) — tatsächlich gebuchte Einfuhrumsatzsteuer aus ausgaben_kosten_transaktionen
    // Kein Zahlungsziel-Rückrechnung: der Betrag fällt direkt in die KW des Leistungsdatums
    if (einfuhrKatId) {
      for (const row of einfuhrActualRows) {
        if (!row.leistungsdatum) continue
        const isEinfuhr = row.gruppe_id === einfuhrKatId || row.kategorie_id === einfuhrKatId || row.untergruppe_id === einfuhrKatId
        if (!isEinfuhr) continue
        const betrag = Number(row.betrag_brutto ?? 0)
        if (betrag <= 0) continue
        const { year, week } = getISOWeekInfo(new Date(row.leistungsdatum + 'T00:00:00Z'))
        if (!isPastKw(year, week)) continue
        addNetUst(year, week, -betrag, 'einfuhr')
      }
    }

    // ── Actual past KW data (replaces A1/A2/B1–B5 planning data for past weeks) ──

    // A1 actual: UST-Zahllast aus echten umsatz_transaktionen
    for (const row of umsatzActualRows) {
      if (!row.produkt_id || !row.leistungsdatum) continue
      const { year, week } = getISOWeekInfo(new Date(row.leistungsdatum + 'T00:00:00Z'))
      if (!isPastKw(year, week)) continue
      const ust = getUstSatzForProdukt(row.produkt_id)
      if (ust <= 0) continue
      const isAbzug = umsatzKatIsAbzugMap.get(row.kategorie_id) ?? false
      const betrag = isAbzug ? -Number(row.betrag) : Number(row.betrag)
      addNetUst(year, week, extractVorsteuer(betrag, ust), 'output')
    }

    // A2 actual: UST-Zahllast aus echten einnahmen_transaktionen (ohne Produktverkäufe)
    for (const row of einnahmenActualRows) {
      if (!row.zahlungsdatum) continue
      const effectiveKatId = (row.gruppe_id && einnahmenKatIds.has(row.gruppe_id))
        ? row.gruppe_id
        : (row.kategorie_id && einnahmenKatIds.has(row.kategorie_id) ? row.kategorie_id : null)
      if (!effectiveKatId) continue
      if (prodVerkaufeSubtreeIds.has(effectiveKatId)) continue
      const { year, week } = getISOWeekInfo(new Date(row.zahlungsdatum + 'T00:00:00Z'))
      if (!isPastKw(year, week)) continue
      const satz = getUstSatz(effectiveKatId)
      addNetUst(year, week, extractVorsteuer(Number(row.betrag), satz), 'output')
    }

    // B actual: Vorsteuer aus echten ausgaben_kosten_transaktionen (B1–B5)
    for (const row of ausgabenUstRows) {
      if (!row.leistungsdatum || !row.ust_betrag) continue
      const betrag = Number(row.ust_betrag)
      if (betrag <= 0) continue
      const relevanz = row.relevanz ?? null
      const isEinfuhr = einfuhrKatId != null && (row.gruppe_id === einfuhrKatId || row.kategorie_id === einfuhrKatId || row.untergruppe_id === einfuhrKatId)
      const isRentab = relevanz === 'rentabilitaet' || relevanz === 'beides'
      const isEinfuhrLiquid = isEinfuhr && relevanz === 'liquiditaet'
      if (!isRentab && !isEinfuhrLiquid) continue
      const { year, week } = getISOWeekInfo(new Date(row.leistungsdatum + 'T00:00:00Z'))
      if (!isPastKw(year, week)) continue
      addNetUst(year, week, -betrag, 'vorsteuer')
    }

    // Group by month or quarter and assign to payment KW.
    // Netto und Komponenten teilen dieselbe Ursprungs-KW → gemeinsame Gruppierung,
    // damit die Komponenten-Aufschlüsselung exakt zum angezeigten Netto-Wert aufsummiert.
    const paymentKwFor = (yr: number, wk: number): { year: number; week: number } => {
      const { calYear, month } = getMonthForKw(yr, wk)
      return zahlungsfrequenz === 'quartalsweise'
        ? paymentKwForQuarter(calYear, getQuarterForMonth(month), verschiebungTage)
        : paymentKwForMonth(calYear, month, verschiebungTage)
    }

    const netByPayment = new Map<string, number>()
    const kompByPayment = new Map<string, { output: number; vorsteuer: number; einfuhr: number }>()
    for (const [kwKey, net] of netUstPerKw) {
      const [yr, wk] = kwKey.split(':').map(Number)
      const { year, week } = paymentKwFor(yr, wk)
      const pKey = `${year}:${week}`
      netByPayment.set(pKey, (netByPayment.get(pKey) ?? 0) + net)
      const comp = komponentenPerKw.get(kwKey)
      if (comp) {
        let agg = kompByPayment.get(pKey)
        if (!agg) { agg = { output: 0, vorsteuer: 0, einfuhr: 0 }; kompByPayment.set(pKey, agg) }
        agg.output += comp.output
        agg.vorsteuer += comp.vorsteuer
        agg.einfuhr += comp.einfuhr
      }
    }

    for (const [pKey, total] of netByPayment) {
      if (total === 0) continue
      const [kwYear, kwNum] = pKey.split(':').map(Number)
      addToResult(ustKatId, kwYear, kwNum, total)
    }

    // Komponenten-Aufschlüsselung nur für Soll-Zahlungswochen (Zukunft) und im Bereich
    for (const [pKey, agg] of kompByPayment) {
      const [kwYear, kwNum] = pKey.split(':').map(Number)
      if (hatZukunftsgrenze && kwYear * 54 + kwNum < zukunftsGrenzeIdx) continue
      const m = getISOWeekMonday(kwYear, kwNum)
      if (m < firstMonday || m > lastMonday) continue
      const push = (komponente: 'output' | 'vorsteuer' | 'einfuhr', wert: number) => {
        if (Math.abs(wert) < 0.005) return
        umsatzsteuerKomponentenBreakdown.push({
          komponente, kw_year: kwYear, kw_number: kwNum, wert: Math.round(wert * 100) / 100,
        })
      }
      push('output', agg.output)
      push('vorsteuer', agg.vorsteuer)
      push('einfuhr', agg.einfuhr)
    }
  }

  // ── Build response data ───────────────────────────────────────────────────────

  const data = [...result.values()].map(r => ({
    kategorie_id: r.kategorie_id,
    kw_year: r.kw_year,
    kw_number: r.kw_number,
    wert: Math.round(r.wert * 100) / 100,
  }))

  // Einfuhrumsatzsteuer-Aufschlüsselung je Produkt (gesamter Bereich → Soll + Ist-Plan)
  const einfuhrProdukteBreakdown = [...einfuhrProduktPerKw.entries()]
    .map(([key, wert]) => {
      const lastColon = key.lastIndexOf(':')
      const secondLast = key.lastIndexOf(':', lastColon - 1)
      const produktRaw = key.slice(0, secondLast)
      return {
        produkt_id: produktRaw === '__none__' ? null : produktRaw,
        kw_year: Number(key.slice(secondLast + 1, lastColon)),
        kw_number: Number(key.slice(lastColon + 1)),
        wert: Math.round(wert * 100) / 100,
      }
    })
    .filter(e => e.wert !== 0)

  // ── Persist future-KW Soll values as ist_berechnet=true (Ist-Plan anchor) ─────

  if (hatZukunftsgrenze) {
    const now = new Date().toISOString()
    const saveRows: Array<{
      user_id: string; kategorie_id: string; kw_year: number; kw_number: number
      betrag_manuell: number; ist_berechnet: boolean; updated_at: string
    }> = []

    for (const r of result.values()) {
      if (r.kw_year * 54 + r.kw_number < zukunftsGrenzeIdx) continue
      saveRows.push({
        user_id: user!.id,
        kategorie_id: r.kategorie_id,
        kw_year: r.kw_year,
        kw_number: r.kw_number,
        betrag_manuell: Math.round(r.wert * 100) / 100,
        ist_berechnet: true,
        updated_at: now,
      })
    }

    const { data: existingRows } = await fetchAllRows((from, to) =>
      supabase
        .from('steuerausgaben_planung')
        .select('kategorie_id, kw_year, kw_number, ist_berechnet')
        .eq('user_id', user!.id)
        .or(`kw_year.gt.${ersteZukunftJahr},and(kw_year.eq.${ersteZukunftJahr},kw_number.gte.${ersteZukunftKw})`)
        .order('id', { ascending: true })
        .range(from, to),
    )

    const manualKeys = new Set<string>()
    for (const r of existingRows ?? []) {
      if (r.ist_berechnet === false) {
        manualKeys.add(`${r.kategorie_id}:${r.kw_year}:${r.kw_number}`)
      }
    }

    await supabase.from('steuerausgaben_planung')
      .delete()
      .eq('user_id', user!.id)
      .eq('ist_berechnet', true)
      .or(`kw_year.gt.${ersteZukunftJahr},and(kw_year.eq.${ersteZukunftJahr},kw_number.gte.${ersteZukunftKw})`)

    const toUpsert = saveRows.filter(
      r => !manualKeys.has(`${r.kategorie_id}:${r.kw_year}:${r.kw_number}`)
    )
    if (toUpsert.length > 0) {
      await supabase.from('steuerausgaben_planung').upsert(toUpsert, {
        onConflict: 'user_id,kategorie_id,kw_year,kw_number',
        ignoreDuplicates: false,
      })
    }
  }

  return NextResponse.json({
    data,
    breakdown: {
      einfuhr_produkte: einfuhrProdukteBreakdown,
      umsatzsteuer_komponenten: umsatzsteuerKomponentenBreakdown,
    },
  })
}
