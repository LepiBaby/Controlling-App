import { NextResponse } from 'next/server'
import { requireAuth } from '@/lib/supabase-server'

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
    return NextResponse.json({ error: 'von_kw, von_jahr, bis_kw, bis_jahr sind erforderlich' }, { status: 400 })
  }

  const startDate = toDateOnly(getISOWeekMonday(vonJahr, vonKw))
  const endMonday = getISOWeekMonday(bisJahr, bisKw)
  const endDate = toDateOnly(new Date(endMonday.getTime() + 6 * 86400000))

  const { data, error: dbErr } = await supabase
    .from('ausgaben_kosten_transaktionen')
    .select('untergruppe_id, produkt_id, zahlungsdatum, betrag_netto')
    .not('untergruppe_id', 'is', null)
    .not('zahlungsdatum', 'is', null)
    .gte('zahlungsdatum', startDate)
    .lte('zahlungsdatum', endDate)
    .limit(20000)

  if (dbErr) return NextResponse.json({ error: dbErr.message }, { status: 500 })

  // Aggregate by (untergruppe_id, produkt_id, kw_year, kw_number)
  const agg = new Map<string, { untergruppe_id: string; produkt_id: string | null; kw_year: number; kw_number: number; betrag: number }>()

  for (const row of data ?? []) {
    const { untergruppe_id, produkt_id, zahlungsdatum, betrag_netto } = row as {
      untergruppe_id: string
      produkt_id: string | null
      zahlungsdatum: string
      betrag_netto: number | null
    }
    if (!untergruppe_id || !zahlungsdatum || betrag_netto == null) continue

    const d = new Date(zahlungsdatum + 'T00:00:00Z')
    const { year, week } = getISOWeekInfo(d)
    const key = `${untergruppe_id}:${produkt_id ?? ''}:${year}:${week}`

    if (!agg.has(key)) {
      agg.set(key, { untergruppe_id, produkt_id: produkt_id ?? null, kw_year: year, kw_number: week, betrag: 0 })
    }
    agg.get(key)!.betrag += Number(betrag_netto)
  }

  const result = [...agg.values()].map(r => ({
    kategorie_id: r.untergruppe_id,
    produkt_id: r.produkt_id,
    kw_year: r.kw_year,
    kw_number: r.kw_number,
    betrag: Math.round(r.betrag * 100) / 100,
  }))

  return NextResponse.json({ data: result })
}
