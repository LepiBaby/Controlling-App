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
    return NextResponse.json(
      { error: 'von_kw, von_jahr, bis_kw, bis_jahr sind erforderlich' },
      { status: 400 },
    )
  }

  const startDate = toDateOnly(getISOWeekMonday(vonJahr, vonKw))
  const endMonday = getISOWeekMonday(bisJahr, bisKw)
  const endDate = toDateOnly(new Date(endMonday.getTime() + 6 * 86400000))

  // Identische Logik wie Liquiditätsreport (PROJ-29): zahlungsdatum + relevanz liquiditaet/beides.
  // Frontend filters to the "Steuern" subtree of KPI categories.
  // Zusätzlich produkt_id für die Einfuhrumsatzsteuer-Aufschlüsselung je Produkt.
  const [{ data, error: dbErr }, kpiCatsRes] = await Promise.all([
    supabase
      .from('ausgaben_kosten_transaktionen')
      .select('gruppe_id, untergruppe_id, produkt_id, zahlungsdatum, betrag_brutto')
      .not('gruppe_id', 'is', null)
      .not('zahlungsdatum', 'is', null)
      .in('relevanz', ['liquiditaet', 'beides'])
      .gte('zahlungsdatum', startDate)
      .lte('zahlungsdatum', endDate)
      .limit(20000),
    supabase
      .from('kpi_categories')
      .select('id, name, parent_id')
      .eq('type', 'ausgaben_kosten')
      .limit(500),
  ])

  if (dbErr) return NextResponse.json({ error: dbErr.message }, { status: 500 })

  // Einfuhrumsatzsteuer-Kategorie im "Steuern"-Subtree finden
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
  const einfuhrKatId = kpiCats.find(
    k => steuernSubtreeIds.has(k.id) && k.name.trim().toLowerCase() === 'einfuhrumsatzsteuer',
  )?.id ?? null

  const agg = new Map<
    string,
    { kategorie_id: string; kw_year: number; kw_number: number; betrag: number }
  >()
  // Einfuhrumsatzsteuer je Produkt × KW (key: `${produktId|'__none__'}:${year}:${week}`)
  const einfuhrProdukt = new Map<string, number>()

  for (const row of data ?? []) {
    const { gruppe_id, untergruppe_id, produkt_id, zahlungsdatum, betrag_brutto } = row as {
      gruppe_id: string | null
      untergruppe_id: string | null
      produkt_id: string | null
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

    if (einfuhrKatId && effKatId === einfuhrKatId) {
      const pKey = `${produkt_id ?? '__none__'}:${year}:${week}`
      einfuhrProdukt.set(pKey, (einfuhrProdukt.get(pKey) ?? 0) + Number(betrag_brutto))
    }
  }

  const result = [...agg.values()].map(r => ({
    kategorie_id: r.kategorie_id,
    kw_year: r.kw_year,
    kw_number: r.kw_number,
    betrag: Math.round(r.betrag * 100) / 100,
  }))

  const einfuhrProdukteBreakdown = [...einfuhrProdukt.entries()]
    .map(([key, betrag]) => {
      const lastColon = key.lastIndexOf(':')
      const secondLast = key.lastIndexOf(':', lastColon - 1)
      const produktRaw = key.slice(0, secondLast)
      return {
        produkt_id: produktRaw === '__none__' ? null : produktRaw,
        kw_year: Number(key.slice(secondLast + 1, lastColon)),
        kw_number: Number(key.slice(lastColon + 1)),
        betrag: Math.round(betrag * 100) / 100,
      }
    })
    .filter(e => e.betrag !== 0)

  return NextResponse.json({
    data: result,
    breakdown: { einfuhr_produkte: einfuhrProdukteBreakdown },
  })
}
