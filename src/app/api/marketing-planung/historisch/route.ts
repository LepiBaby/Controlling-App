import { NextResponse } from 'next/server'
import { requireAuth } from '@/lib/supabase-server'

// ─── Types ────────────────────────────────────────────────────────────────────

interface MarketingEinstellung {
  kategorie_id: string
  produkt_id: string
  berechnungsart: string
  gewichtung_erstes_drittel: number | null
  gewichtung_zweites_drittel: number | null
  gewichtung_drittes_drittel: number | null
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function getPeriodDays(berechnungsart: string): number {
  if (berechnungsart.endsWith('_7')) return 7
  if (berechnungsart.endsWith('_14')) return 14
  if (berechnungsart.endsWith('_30')) return 30
  if (berechnungsart.endsWith('_60')) return 60
  if (berechnungsart.endsWith('_90')) return 90
  return 30
}

function toDateOnly(d: Date): string {
  return d.toISOString().slice(0, 10)
}

function addDays(d: Date, n: number): Date {
  return new Date(d.getTime() + n * 86_400_000)
}

function calcPctMittelwert(
  ausgaben: { datum: string; betrag_netto: number }[],
  umsatz: { datum: string; betrag: number }[],
  periodStart: Date,
  today: Date,
): number {
  const startStr = toDateOnly(periodStart)
  const endStr = toDateOnly(today)

  const sumAusg = ausgaben
    .filter(e => e.datum >= startStr && e.datum < endStr)
    .reduce((s, e) => s + e.betrag_netto, 0)

  const sumUmsatz = umsatz
    .filter(e => e.datum >= startStr && e.datum < endStr)
    .reduce((s, e) => s + e.betrag, 0)

  if (sumUmsatz === 0) return 0
  return Math.round((sumAusg / sumUmsatz) * 100 * 100) / 100
}

function calcPctGewichtet(
  ausgaben: { datum: string; betrag_netto: number }[],
  umsatz: { datum: string; betrag: number }[],
  periodDays: number,
  einstellung: MarketingEinstellung,
  periodStart: Date,
  today: Date,
): number {
  const thirdLength = periodDays / 3

  const t1Start = toDateOnly(periodStart)
  const t2Start = toDateOnly(addDays(periodStart, thirdLength))
  const t3Start = toDateOnly(addDays(periodStart, thirdLength * 2))
  const todayStr = toDateOnly(today)

  const sumAusgaben = (start: string, end: string) =>
    ausgaben.filter(e => e.datum >= start && e.datum < end).reduce((s, e) => s + e.betrag_netto, 0)

  const sumUmsatzPeriod = (start: string, end: string) =>
    umsatz.filter(e => e.datum >= start && e.datum < end).reduce((s, e) => s + e.betrag, 0)

  const ausg1 = sumAusgaben(t1Start, t2Start)
  const ausg2 = sumAusgaben(t2Start, t3Start)
  const ausg3 = sumAusgaben(t3Start, todayStr)
  const ums1  = sumUmsatzPeriod(t1Start, t2Start)
  const ums2  = sumUmsatzPeriod(t2Start, t3Start)
  const ums3  = sumUmsatzPeriod(t3Start, todayStr)

  const pct1 = ums1 === 0 ? 0 : (ausg1 / ums1) * 100
  const pct2 = ums2 === 0 ? 0 : (ausg2 / ums2) * 100
  const pct3 = ums3 === 0 ? 0 : (ausg3 / ums3) * 100

  const w1 = einstellung.gewichtung_erstes_drittel
  const w2 = einstellung.gewichtung_zweites_drittel
  const w3 = einstellung.gewichtung_drittes_drittel

  if (w1 == null || w2 == null || w3 == null) {
    const totalAusg = ausg1 + ausg2 + ausg3
    const totalUms  = ums1 + ums2 + ums3
    if (totalUms === 0) return 0
    return Math.round((totalAusg / totalUms) * 100 * 100) / 100
  }

  const result = (w1 * pct1 + w2 * pct2 + w3 * pct3) / 100
  return Math.round(result * 100) / 100
}

function calcRawSums(
  ausgaben: { datum: string; betrag_netto: number }[],
  umsatz: { datum: string; betrag: number }[],
  periodStart: Date,
  today: Date,
): { sum_ausgaben_eur: number; sum_umsatz_netto_eur: number } {
  const startStr = toDateOnly(periodStart)
  const endStr   = toDateOnly(today)
  const sum_ausgaben_eur     = ausgaben.filter(e => e.datum >= startStr && e.datum < endStr).reduce((s, e) => s + e.betrag_netto, 0)
  const sum_umsatz_netto_eur = umsatz.filter(e => e.datum >= startStr && e.datum < endStr).reduce((s, e) => s + e.betrag, 0)
  return { sum_ausgaben_eur, sum_umsatz_netto_eur }
}

// ─── Handler ──────────────────────────────────────────────────────────────────

export async function GET() {
  const { user, supabase, error } = await requireAuth()
  if (error) return error

  // 1. Load all active marketing einstellungen (now keyed by kategorie_id)
  const { data: einstellungen, error: eErr } = await supabase
    .from('marketing_einstellungen')
    .select(
      'kategorie_id, produkt_id, berechnungsart, gewichtung_erstes_drittel, gewichtung_zweites_drittel, gewichtung_drittes_drittel',
    )
    .eq('user_id', user!.id)
    .neq('berechnungsart', 'keine')
    .limit(500)

  if (eErr) return NextResponse.json({ error: eErr.message }, { status: 500 })
  if (!einstellungen?.length) return NextResponse.json([])

  // 2. Load Marketing-Untergruppen (level-2 children of the "Marketing" ausgaben_kosten category)
  //    and Rabatte/Abzugsposten categories for umsatz denominator
  const [marketingParentRes, rabatteKatsRes, abzugspostenKatsRes] = await Promise.all([
    supabase
      .from('kpi_categories')
      .select('id')
      .eq('type', 'ausgaben_kosten')
      .ilike('name', 'marketing')
      .eq('level', 1)
      .limit(5),
    supabase
      .from('kpi_categories')
      .select('id')
      .ilike('name', 'rabatt%')
      .limit(50),
    supabase
      .from('kpi_categories')
      .select('id')
      .eq('ist_abzugsposten', true)
      .limit(200),
  ])

  const marketingParentIds = (marketingParentRes.data ?? []).map((k: { id: string }) => k.id)
  const rabatteIds         = new Set((rabatteKatsRes.data ?? []).map((k: { id: string }) => k.id))
  const abzugspostenIds    = new Set((abzugspostenKatsRes.data ?? []).map((k: { id: string }) => k.id))

  // Load all level-2 Untergruppen under Marketing
  let untergruppIds: Set<string> = new Set()
  if (marketingParentIds.length > 0) {
    const { data: unterGruppenData } = await supabase
      .from('kpi_categories')
      .select('id')
      .in('parent_id', marketingParentIds)
      .limit(100)
    untergruppIds = new Set((unterGruppenData ?? []).map((k: { id: string }) => k.id))
  }

  // The Untergruppen we care about = those referenced in active einstellungen
  const relevanteKategorieIds = [...new Set(einstellungen.map((e: MarketingEinstellung) => e.kategorie_id))]
  const produktIds             = [...new Set(einstellungen.map((e: MarketingEinstellung) => e.produkt_id))]

  if (relevanteKategorieIds.length === 0 || produktIds.length === 0) {
    return NextResponse.json([])
  }

  // 3. Date range: last 90 days
  const today = new Date()
  today.setUTCHours(0, 0, 0, 0)
  const ninetyDaysAgo = addDays(today, -90)
  const startDateStr  = toDateOnly(ninetyDaysAgo)
  const todayStr      = toDateOnly(today)

  // 4. Load ausgaben, umsatz and platform assignments in parallel
  const [ausgabenRes, umsatzRes, katEinstRes] = await Promise.all([
    // Ausgaben — gefiltert nach Marketingkanal (gruppe_id = level-2 Untergruppe)
    supabase
      .from('ausgaben_kosten_transaktionen')
      .select('produkt_id, gruppe_id, leistungsdatum, betrag_netto')
      .gte('leistungsdatum', startDateStr)
      .lt('leistungsdatum', todayStr)
      .in('produkt_id', produktIds)
      .in('gruppe_id', relevanteKategorieIds)
      .in('relevanz', ['rentabilitaet', 'beides'])
      .limit(20000),

    // Umsatz — inkl. sales_plattform_id für plattformspezifischen Nenner
    supabase
      .from('umsatz_transaktionen')
      .select('produkt_id, sales_plattform_id, leistungsdatum, betrag, kategorie_id')
      .gte('leistungsdatum', startDateStr)
      .lt('leistungsdatum', todayStr)
      .in('produkt_id', produktIds)
      .limit(20000),

    // Sales-Plattform-Zuordnung je Marketingkanal
    supabase
      .from('marketing_kategorie_einstellungen')
      .select('kategorie_id, sales_plattform_id')
      .eq('user_id', user!.id)
      .in('kategorie_id', relevanteKategorieIds)
      .limit(100),
  ])

  if (ausgabenRes.error) return NextResponse.json({ error: ausgabenRes.error.message }, { status: 500 })
  if (umsatzRes.error)   return NextResponse.json({ error: umsatzRes.error.message },   { status: 500 })

  // 5. Build lookup maps

  // Kategorie → zugeordnete Sales-Plattform
  const kategoriePlattformMap = new Map<string, string | null>()
  for (const e of (katEinstRes.data ?? []) as { kategorie_id: string; sales_plattform_id: string | null }[]) {
    kategoriePlattformMap.set(e.kategorie_id, e.sales_plattform_id ?? null)
  }

  // Ausgaben: key = "produkt_id:gruppe_id"
  const ausgabenByKombi = new Map<string, { datum: string; betrag_netto: number }[]>()
  for (const row of (ausgabenRes.data ?? []) as { produkt_id: string; gruppe_id: string; leistungsdatum: string; betrag_netto: number }[]) {
    if (!row.produkt_id || !row.gruppe_id) continue
    const key = `${row.produkt_id}:${row.gruppe_id}`
    if (!ausgabenByKombi.has(key)) ausgabenByKombi.set(key, [])
    ausgabenByKombi.get(key)!.push({ datum: row.leistungsdatum, betrag_netto: Number(row.betrag_netto) })
  }

  // Umsatz: key = "produkt_id:sales_plattform_id" UND Fallback key = "produkt_id" (alle Plattformen)
  // Bruttoumsatz − Rabatte; reine Abzugsposten (Rückerstattungen) werden ignoriert
  const umsatzByPlattform = new Map<string, { datum: string; betrag: number }[]>()
  const umsatzByProdukt   = new Map<string, { datum: string; betrag: number }[]>()

  for (const row of (umsatzRes.data ?? []) as { produkt_id: string; sales_plattform_id: string | null; leistungsdatum: string; betrag: number; kategorie_id: string }[]) {
    if (!row.produkt_id) continue
    const isAbzugsposten = abzugspostenIds.has(row.kategorie_id)
    const isRabatt       = rabatteIds.has(row.kategorie_id)
    if (isAbzugsposten && !isRabatt) continue
    const betrag = isRabatt ? -Number(row.betrag) : Number(row.betrag)
    const entry  = { datum: row.leistungsdatum, betrag }

    // Plattform-spezifisch
    if (row.sales_plattform_id) {
      const plattKey = `${row.produkt_id}:${row.sales_plattform_id}`
      if (!umsatzByPlattform.has(plattKey)) umsatzByPlattform.set(plattKey, [])
      umsatzByPlattform.get(plattKey)!.push(entry)
    }

    // Gesamt-Fallback (alle Plattformen)
    if (!umsatzByProdukt.has(row.produkt_id)) umsatzByProdukt.set(row.produkt_id, [])
    umsatzByProdukt.get(row.produkt_id)!.push(entry)
  }

  // 6. Calculate % for each einstellung
  const results = einstellungen.map((e: MarketingEinstellung) => {
    const ausgKey      = `${e.produkt_id}:${e.kategorie_id}`
    const ausgaben     = ausgabenByKombi.get(ausgKey) ?? []
    const plattformId  = kategoriePlattformMap.get(e.kategorie_id) ?? null
    const umsatz       = plattformId
      ? (umsatzByPlattform.get(`${e.produkt_id}:${plattformId}`) ?? [])
      : (umsatzByProdukt.get(e.produkt_id) ?? [])
    const periodDays  = getPeriodDays(e.berechnungsart)
    const periodStart = addDays(today, -periodDays)

    let marketingkosten_pct: number

    if (e.berechnungsart.startsWith('gewichtet_')) {
      marketingkosten_pct = calcPctGewichtet(ausgaben, umsatz, periodDays, e, periodStart, today)
    } else {
      marketingkosten_pct = calcPctMittelwert(ausgaben, umsatz, periodStart, today)
    }

    const { sum_ausgaben_eur, sum_umsatz_netto_eur } = calcRawSums(ausgaben, umsatz, periodStart, today)

    return {
      produkt_id: e.produkt_id,
      kategorie_id: e.kategorie_id,
      marketingkosten_pct,
      sum_ausgaben_eur,
      sum_umsatz_netto_eur,
    }
  })

  return NextResponse.json(results)
}
