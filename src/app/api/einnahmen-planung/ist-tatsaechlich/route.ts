import { NextResponse } from 'next/server'
import { requireAuth } from '@/lib/supabase-server'
import { fetchAllRows } from '@/lib/supabase-paginate'

// ─── ISO week helpers ─────────────────────────────────────────────────────────

/** Returns the Monday of the given ISO week as a UTC Date. */
function isoWeekMonday(year: number, week: number): Date {
  // Jan 4 is always in ISO week 1
  const jan4 = new Date(Date.UTC(year, 0, 4))
  const jan4Day = jan4.getUTCDay() || 7 // Mon=1 … Sun=7
  return new Date(jan4.getTime() - (jan4Day - 1) * 86400000 + (week - 1) * 7 * 86400000)
}

function getISOWeekInfo(dateStr: string): { year: number; week: number } {
  const d = new Date(dateStr + 'T00:00:00Z')
  // Thursday of the same week determines the ISO year
  const thu = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate() + (4 - (d.getUTCDay() || 7))))
  const yearStart = new Date(Date.UTC(thu.getUTCFullYear(), 0, 1))
  const week = Math.ceil(((thu.getTime() - yearStart.getTime()) / 86400000 + 1) / 7)
  return { year: thu.getUTCFullYear(), week }
}

// ─── GET /api/einnahmen-planung/ist-tatsaechlich ──────────────────────────────
//
// Returns actual income per leaf KPI category per ISO calendar week.
// Data source: einnahmen_transaktionen filtered by zahlungsdatum (cash-basis,
// identical to the Liquiditätsreport logic in PROJ-29).
//
// Query params (all required):
//   von_kw   INTEGER 1–53
//   von_jahr INTEGER ≥ 2020
//   bis_kw   INTEGER 1–53
//   bis_jahr INTEGER ≥ 2020
//
// Response: { kategorie_id, kw_year, kw_number, betrag }[]
//   kategorie_id = gruppe_id ?? kategorie_id from einnahmen_transaktionen
//   (gruppe_id is the L2 sub-category when present; falls back to L1 kategorie_id)
//
// Additionally, for every transaction carrying a sales_plattform_id, a second
// aggregate row keyed by that platform id is emitted. This lets the Produktverkäufe
// platform sub-rows (Amazon/Otto/…) display their Ist-Tatsächlich breakdown — the
// data exists in the source (sales_plattform_id) but has no KPI sub-category to key on.
// Platform UUIDs never collide with category UUIDs and are only looked up by the
// PV platform rows, so the extra entries are inert for all other rows.

export async function GET(request: Request) {
  const { supabase, error } = await requireAuth()
  if (error) return error

  const { searchParams } = new URL(request.url)
  const vonKw   = parseInt(searchParams.get('von_kw')   ?? '', 10)
  const vonJahr = parseInt(searchParams.get('von_jahr') ?? '', 10)
  const bisKw   = parseInt(searchParams.get('bis_kw')   ?? '', 10)
  const bisJahr = parseInt(searchParams.get('bis_jahr') ?? '', 10)

  if (
    !vonKw || !vonJahr || !bisKw || !bisJahr ||
    vonKw < 1 || vonKw > 53 || vonJahr < 2020 ||
    bisKw < 1 || bisKw > 53 || bisJahr < 2020
  ) {
    return NextResponse.json(
      { error: 'von_kw, von_jahr, bis_kw, bis_jahr sind erforderlich und müssen gültig sein (KW 1–53, Jahr ≥ 2020)' },
      { status: 400 }
    )
  }

  // Build date range: from Monday of von_kw to Sunday of bis_kw (exclusive next Monday)
  const startDate = isoWeekMonday(vonJahr, vonKw)
  const endDate   = new Date(isoWeekMonday(bisJahr, bisKw).getTime() + 7 * 86400000) // exclusive
  const startStr  = startDate.toISOString().slice(0, 10)
  const endStr    = endDate.toISOString().slice(0, 10)

  const { data, error: dbErr } = await fetchAllRows((from, to) =>
    supabase
      .from('einnahmen_transaktionen')
      .select('kategorie_id, gruppe_id, sales_plattform_id, zahlungsdatum, betrag')
      .gte('zahlungsdatum', startStr)
      .lt('zahlungsdatum', endStr)
      .order('id', { ascending: true })
      .range(from, to))

  if (dbErr) return NextResponse.json({ error: dbErr.message }, { status: 500 })

  // Aggregate by leaf category (gruppe_id if set, else kategorie_id) × ISO week,
  // and additionally by sales_plattform_id × ISO week for the PV platform breakdown.
  const aggregated = new Map<string, number>()
  for (const row of data ?? []) {
    if (!row.zahlungsdatum) continue
    const { year, week } = getISOWeekInfo(row.zahlungsdatum as string)
    const betrag = Number(row.betrag)

    const leafId = (row.gruppe_id as string | null) ?? (row.kategorie_id as string | null)
    if (leafId) {
      const key = `${leafId}:${year}:${week}`
      aggregated.set(key, (aggregated.get(key) ?? 0) + betrag)
    }

    // Per-platform aggregate so Produktverkäufe platform sub-rows can show Ist-Tatsächlich
    const plattformId = row.sales_plattform_id as string | null
    if (plattformId) {
      const pKey = `${plattformId}:${year}:${week}`
      aggregated.set(pKey, (aggregated.get(pKey) ?? 0) + betrag)
    }
  }

  const result = Array.from(aggregated.entries()).map(([key, betrag]) => {
    const parts = key.split(':')
    return {
      kategorie_id: parts[0],
      kw_year:      Number(parts[1]),
      kw_number:    Number(parts[2]),
      betrag:       Math.round(betrag * 100) / 100,
    }
  })

  return NextResponse.json(result)
}
