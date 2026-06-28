import { NextResponse } from 'next/server'
import { requireAuth } from '@/lib/supabase-server'
import { fetchAllRows } from '@/lib/supabase-paginate'

// ─── Types ────────────────────────────────────────────────────────────────────

interface AbsatzEinstellung {
  sales_plattform_id: string
  produkt_id: string
  berechnungsart: string
  gewichtung_erstes_drittel: number | null
  gewichtung_zweites_drittel: number | null
  gewichtung_drittes_drittel: number | null
}

interface Sendung {
  plattform_id: string
  menge: number
}

interface Transaktion {
  produkt_id: string
  datum: string
  bestand_sendungen: Sendung[]
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

// Calculates tagesdurchschnitt (daily average) for a given set of entries + einstellung.
// entries: all sendungen for this (produkt, plattform) combination in the full 90-day window
// periodDays: number of days in the calculation period (14/30/60/90)
// today: midnight UTC of today (period end is exclusive of today)
function calcTagesdurchschnitt(
  entries: { datum: string; menge: number }[],
  periodDays: number,
  einstellung: AbsatzEinstellung,
  today: Date,
): number {
  const periodStart = addDays(today, -periodDays) // inclusive start

  if (einstellung.berechnungsart.startsWith('gewichtet_')) {
    return calcGewichtet(entries, periodDays, einstellung, periodStart, today)
  }

  // Simple mittelwert: SUM(menge) / periodDays (using all days in period, even empty ones)
  const total = entries
    .filter(e => e.datum >= toDateOnly(periodStart) && e.datum < toDateOnly(today))
    .reduce((sum, e) => sum + e.menge, 0)

  return Math.round((total / periodDays) * 100) / 100
}

function calcGewichtet(
  entries: { datum: string; menge: number }[],
  periodDays: number,
  einstellung: AbsatzEinstellung,
  periodStart: Date,
  today: Date,
): number {
  const thirdLength = periodDays / 3 // guaranteed integer (30/60/90 ÷ 3)

  const t1Start = toDateOnly(periodStart)
  const t2Start = toDateOnly(addDays(periodStart, thirdLength))
  const t3Start = toDateOnly(addDays(periodStart, thirdLength * 2))
  const todayStr = toDateOnly(today)

  const sum1 = entries
    .filter(e => e.datum >= t1Start && e.datum < t2Start)
    .reduce((s, e) => s + e.menge, 0)
  const sum2 = entries
    .filter(e => e.datum >= t2Start && e.datum < t3Start)
    .reduce((s, e) => s + e.menge, 0)
  const sum3 = entries
    .filter(e => e.datum >= t3Start && e.datum < todayStr)
    .reduce((s, e) => s + e.menge, 0)

  const avg1 = sum1 / thirdLength
  const avg2 = sum2 / thirdLength
  const avg3 = sum3 / thirdLength

  const w1 = einstellung.gewichtung_erstes_drittel
  const w2 = einstellung.gewichtung_zweites_drittel
  const w3 = einstellung.gewichtung_drittes_drittel

  // Fallback to simple average if weights are incomplete
  if (w1 == null || w2 == null || w3 == null) {
    const total = sum1 + sum2 + sum3
    return Math.round((total / periodDays) * 100) / 100
  }

  const result = (w1 * avg1 + w2 * avg2 + w3 * avg3) / 100
  return Math.round(result * 100) / 100
}

// ─── Handler ──────────────────────────────────────────────────────────────────

export async function GET() {
  const { user, supabase, error } = await requireAuth()
  if (error) return error

  // 1. Load all active einstellungen (berechnungsart != 'keine')
  const { data: einstellungen, error: eErr } = await supabase
    .from('absatz_einstellungen')
    .select(
      'sales_plattform_id, produkt_id, berechnungsart, gewichtung_erstes_drittel, gewichtung_zweites_drittel, gewichtung_drittes_drittel',
    )
    .eq('user_id', user!.id)
    .neq('berechnungsart', 'keine')
    .limit(500)

  if (eErr) return NextResponse.json({ error: eErr.message }, { status: 500 })
  if (!einstellungen?.length) return NextResponse.json({ data: [] })

  // 2. Load sendungen for the last 90 days (max period) for relevant products
  const today = new Date()
  today.setUTCHours(0, 0, 0, 0)
  const ninetyDaysAgo = addDays(today, -90)
  const startDateStr = toDateOnly(ninetyDaysAgo)
  const todayStr = toDateOnly(today)

  const productIds = [...new Set(einstellungen.map(e => e.produkt_id))]

  const { data: transaktionen, error: tErr } = await fetchAllRows((from, to) =>
    supabase
      .from('bestand_transaktionen')
      .select('produkt_id, datum, bestand_sendungen(plattform_id, menge)')
      .gte('datum', startDateStr)
      .lt('datum', todayStr)
      .in('produkt_id', productIds)
      .order('id', { ascending: true })
      .range(from, to))

  if (tErr) return NextResponse.json({ error: tErr.message }, { status: 500 })

  // 3. Build lookup map: "produkt_id:plattform_id" → [{datum, menge}]
  const dataByKombi = new Map<string, { datum: string; menge: number }[]>()
  for (const t of (transaktionen ?? []) as Transaktion[]) {
    for (const s of t.bestand_sendungen ?? []) {
      const key = `${t.produkt_id}:${s.plattform_id}`
      if (!dataByKombi.has(key)) dataByKombi.set(key, [])
      dataByKombi.get(key)!.push({ datum: t.datum, menge: s.menge })
    }
  }

  // 4. Compute tagesdurchschnitt for each einstellung
  const results = einstellungen.map((e: AbsatzEinstellung) => {
    const key = `${e.produkt_id}:${e.sales_plattform_id}`
    const entries = dataByKombi.get(key) ?? []
    const periodDays = getPeriodDays(e.berechnungsart)
    const tagesdurchschnitt = calcTagesdurchschnitt(entries, periodDays, e, today)

    return {
      produkt_id: e.produkt_id,
      sales_plattform_id: e.sales_plattform_id,
      tagesdurchschnitt,
    }
  })

  return NextResponse.json({ data: results })
}
