import { NextResponse } from 'next/server'
import { requireAuth } from '@/lib/supabase-server'
import { fetchAllRows } from '@/lib/supabase-paginate'

function getISOWeekMonday(year: number, week: number): Date {
  const jan4 = new Date(Date.UTC(year, 0, 4))
  const jan4Day = jan4.getUTCDay() || 7
  const week1Monday = new Date(jan4.getTime() - (jan4Day - 1) * 86400000)
  return new Date(week1Monday.getTime() + (week - 1) * 7 * 86400000)
}

function toDateOnly(d: Date): string {
  return d.toISOString().slice(0, 10)
}

function getISOWeekInfo(d: Date): { year: number; week: number } {
  const thu = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate() + (4 - (d.getUTCDay() || 7))))
  const yearStart = new Date(Date.UTC(thu.getUTCFullYear(), 0, 1))
  const week = Math.ceil(((thu.getTime() - yearStart.getTime()) / 86400000 + 1) / 7)
  return { year: thu.getUTCFullYear(), week }
}

export async function GET(request: Request) {
  const { supabase, error } = await requireAuth()
  if (error) return error

  const { searchParams } = new URL(request.url)
  const vonKw = parseInt(searchParams.get('von_kw') ?? '', 10)
  const vonJahr = parseInt(searchParams.get('von_jahr') ?? '', 10)
  const bisKw = parseInt(searchParams.get('bis_kw') ?? '', 10)
  const bisJahr = parseInt(searchParams.get('bis_jahr') ?? '', 10)

  if ([vonKw, vonJahr, bisKw, bisJahr].some(n => isNaN(n))) {
    return NextResponse.json(
      { error: 'von_kw, von_jahr, bis_kw, bis_jahr sind erforderlich' },
      { status: 400 },
    )
  }

  const startDate = toDateOnly(getISOWeekMonday(vonJahr, vonKw))
  const endMonday = getISOWeekMonday(bisJahr, bisKw)
  const endDate = toDateOnly(new Date(endMonday.getTime() + 6 * 86400000))

  // ausgaben_kosten_transaktionen:
  //   gruppe_id    = L1 operative category (e.g. "Miete")
  //   untergruppe_id = L2 operative subcategory (e.g. "Miete Lager"), usually null
  // Effective leaf category = untergruppe_id if set, else gruppe_id
  const { data, error: dbErr } = await fetchAllRows((from, to) =>
    supabase
      .from('ausgaben_kosten_transaktionen')
      .select('gruppe_id, untergruppe_id, zahlungsdatum, betrag_brutto')
      .not('gruppe_id', 'is', null)
      .not('zahlungsdatum', 'is', null)
      .in('relevanz', ['liquiditaet', 'beides'])
      .gte('zahlungsdatum', startDate)
      .lte('zahlungsdatum', endDate)
      .order('id', { ascending: true })
      .range(from, to),
  )

  if (dbErr) return NextResponse.json({ error: dbErr.message }, { status: 500 })

  const agg = new Map<
    string,
    { kategorie_id: string; kw_year: number; kw_number: number; betrag: number }
  >()

  for (const row of data ?? []) {
    const { gruppe_id, untergruppe_id, zahlungsdatum, betrag_brutto } = row as {
      gruppe_id: string | null
      untergruppe_id: string | null
      zahlungsdatum: string
      betrag_brutto: number | null
    }
    if (!gruppe_id || !zahlungsdatum || betrag_brutto == null) continue

    const effKatId = untergruppe_id ?? gruppe_id
    const d = new Date(zahlungsdatum + 'T00:00:00Z')
    const { year, week } = getISOWeekInfo(d)
    const key = `${effKatId}:${year}:${week}`

    if (!agg.has(key)) {
      agg.set(key, { kategorie_id: effKatId, kw_year: year, kw_number: week, betrag: 0 })
    }
    agg.get(key)!.betrag += Number(betrag_brutto)
  }

  const result = [...agg.values()].map(r => ({
    kategorie_id: r.kategorie_id,
    kw_year: r.kw_year,
    kw_number: r.kw_number,
    betrag: Math.round(r.betrag * 100) / 100,
  }))

  return NextResponse.json({ data: result })
}
