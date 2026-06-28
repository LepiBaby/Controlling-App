import { NextResponse } from 'next/server'
import { z } from 'zod'
import { requireAuth } from '@/lib/supabase-server'
import { fetchAllRows } from '@/lib/supabase-paginate'

// ─── Schema ───────────────────────────────────────────────────────────────────

const querySchema = z.object({
  von: z.string().regex(/^\d{4}-\d{2}$/, 'von muss im Format YYYY-MM sein'),
  bis: z.string().regex(/^\d{4}-\d{2}$/, 'bis muss im Format YYYY-MM sein'),
  granularitaet: z.enum(['monat', 'quartal', 'jahr']).default('monat'),
  produkt_ids: z.string().optional(),
  plattform_ids: z.string().optional(),
})

type Granularitaet = 'monat' | 'quartal' | 'jahr'

// ─── Perioden-Utilities ───────────────────────────────────────────────────────

function monthEnd(yyyyMM: string): string {
  const [y, m] = yyyyMM.split('-').map(Number)
  return `${yyyyMM}-${String(new Date(y, m, 0).getDate()).padStart(2, '0')}`
}

function dateToPeriod(date: string, gran: Granularitaet): string {
  const [year, month] = date.split('-')
  if (gran === 'monat') return `${year}-${month}`
  if (gran === 'quartal') return `${year}-Q${Math.ceil(parseInt(month, 10) / 3)}`
  return year
}

function generatePerioden(von: string, bis: string, gran: Granularitaet): string[] {
  const perioden: string[] = []
  const seen = new Set<string>()
  const [vonY, vonM] = von.split('-').map(Number)
  const [bisY, bisM] = bis.split('-').map(Number)
  let y = vonY, m = vonM
  while (y < bisY || (y === bisY && m <= bisM)) {
    const key = dateToPeriod(`${y}-${String(m).padStart(2, '0')}-01`, gran)
    if (!seen.has(key)) { seen.add(key); perioden.push(key) }
    m++
    if (m > 12) { m = 1; y++ }
  }
  return perioden
}

// ─── Route ────────────────────────────────────────────────────────────────────

type SendungRow = { plattform_id: string; menge: number }
type TransaktionRow = {
  produkt_id: string | null
  datum: string
  sendungen_manuell: number
  sendungen: SendungRow[]
}

export async function GET(request: Request) {
  const { supabase, error } = await requireAuth()
  if (error) return error

  const { searchParams } = new URL(request.url)
  const parsed = querySchema.safeParse({
    von: searchParams.get('von') ?? undefined,
    bis: searchParams.get('bis') ?? undefined,
    granularitaet: searchParams.get('granularitaet') ?? undefined,
    produkt_ids: searchParams.get('produkt_ids') ?? undefined,
    plattform_ids: searchParams.get('plattform_ids') ?? undefined,
  })

  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })
  }

  const { von, bis, granularitaet } = parsed.data

  if (von > bis) {
    return NextResponse.json({ error: 'von muss vor oder gleich bis liegen' }, { status: 400 })
  }

  const produkt_ids = parsed.data.produkt_ids
    ? parsed.data.produkt_ids.split(',').filter(Boolean)
    : []
  const plattform_ids = parsed.data.plattform_ids
    ? parsed.data.plattform_ids.split(',').filter(Boolean)
    : []

  const vonDate = `${von}-01`
  const bisDate = monthEnd(bis)
  const perioden = generatePerioden(von, bis, granularitaet)

  // Stage 1: bestand_transaktionen (mit nested bestand_sendungen) — paginiert,
  // damit über lange Zeiträume keine Zeilen am PostgREST-Limit verloren gehen.
  const buildTransQuery = (from: number, to: number) => {
    let q = supabase
      .from('bestand_transaktionen')
      .select('produkt_id, datum, sendungen_manuell, sendungen:bestand_sendungen(plattform_id, menge)')
      .gte('datum', vonDate)
      .lte('datum', bisDate)
    if (produkt_ids.length > 0) q = q.in('produkt_id', produkt_ids)
    return q.order('id', { ascending: true }).range(from, to)
  }

  // Stage 2+3 parallel: Produkt- und Plattform-Namen laden
  const [
    { data: transaktionen, error: transError },
    { data: produktKats, error: katError },
    { data: plattformKats, error: pltError },
  ] = await Promise.all([
    fetchAllRows<TransaktionRow>(buildTransQuery),
    supabase
      .from('kpi_categories')
      .select('id, name, sort_order')
      .eq('type', 'produkte')
      .eq('level', 1)
      .order('sort_order', { ascending: true }),
    supabase
      .from('kpi_categories')
      .select('id, name, sort_order')
      .eq('type', 'sales_plattformen')
      .eq('level', 1)
      .order('sort_order', { ascending: true }),
  ])

  if (transError) return NextResponse.json({ error: transError.message }, { status: 500 })
  if (katError)   return NextResponse.json({ error: katError.message },   { status: 500 })
  if (pltError)   return NextResponse.json({ error: pltError.message },   { status: 500 })

  // ─── Aggregation ──────────────────────────────────────────────────────────

  // Gesamtmenge je Periode
  const gesamtAcc = new Map<string, number>()
  // Gesamtmenge je Produkt je Periode
  const produktAcc = new Map<string, Map<string, number>>()
  // Plattform-Menge je Produkt je Plattform je Periode
  const pltProduktAcc = new Map<string, Map<string, Map<string, number>>>()
  // Manuell je Produkt je Periode
  const manuellProduktAcc = new Map<string, Map<string, number>>()

  for (const tx of (transaktionen as TransaktionRow[] ?? [])) {
    const period = dateToPeriod(tx.datum, granularitaet)
    if (!perioden.includes(period)) continue

    const filteredSendungen = (tx.sendungen ?? [])
      .filter(s => plattform_ids.length === 0 || plattform_ids.includes(s.plattform_id))

    const plattformMenge = filteredSendungen.reduce((sum, s) => sum + s.menge, 0)
    const total = plattformMenge + tx.sendungen_manuell

    // Gesamt
    gesamtAcc.set(period, (gesamtAcc.get(period) ?? 0) + total)

    if (!tx.produkt_id) continue

    // Produkt-Gesamt
    if (!produktAcc.has(tx.produkt_id)) produktAcc.set(tx.produkt_id, new Map())
    const pm = produktAcc.get(tx.produkt_id)!
    pm.set(period, (pm.get(period) ?? 0) + total)

    // Je Plattform
    for (const s of filteredSendungen) {
      if (s.menge === 0) continue
      if (!pltProduktAcc.has(tx.produkt_id)) pltProduktAcc.set(tx.produkt_id, new Map())
      const prodPltMap = pltProduktAcc.get(tx.produkt_id)!
      if (!prodPltMap.has(s.plattform_id)) prodPltMap.set(s.plattform_id, new Map())
      const pMap = prodPltMap.get(s.plattform_id)!
      pMap.set(period, (pMap.get(period) ?? 0) + s.menge)
    }

    // Manuell
    if (tx.sendungen_manuell > 0) {
      if (!manuellProduktAcc.has(tx.produkt_id)) manuellProduktAcc.set(tx.produkt_id, new Map())
      const mMap = manuellProduktAcc.get(tx.produkt_id)!
      mMap.set(period, (mMap.get(period) ?? 0) + tx.sendungen_manuell)
    }
  }

  // ─── Response aufbauen ────────────────────────────────────────────────────

  const gesamt = Object.fromEntries(perioden.map(p => [p, gesamtAcc.get(p) ?? 0]))

  const produkte = (produktKats ?? [])
    .filter(k => produktAcc.has(k.id))
    .map(k => {
      const pm = produktAcc.get(k.id)!
      const prodPltMap = pltProduktAcc.get(k.id)

      // Plattform-Unterzeilen (nur Plattformen mit mind. einer Sendung für dieses Produkt)
      const plattformen: Array<{ id: string; name: string; values: Record<string, number> }> = []

      for (const plt of (plattformKats ?? [])) {
        const pltMap = prodPltMap?.get(plt.id)
        if (!pltMap) continue
        plattformen.push({
          id: plt.id,
          name: plt.name,
          values: Object.fromEntries(perioden.map(p => [p, pltMap.get(p) ?? 0])),
        })
      }

      // Manuell-Unterzeile (nur wenn mind. eine Buchung vorhanden)
      const manuellMap = manuellProduktAcc.get(k.id)
      if (manuellMap) {
        plattformen.push({
          id: '__manuell__',
          name: 'Manuell',
          values: Object.fromEntries(perioden.map(p => [p, manuellMap.get(p) ?? 0])),
        })
      }

      return {
        id: k.id,
        name: k.name,
        sort_order: k.sort_order,
        values: Object.fromEntries(perioden.map(p => [p, pm.get(p) ?? 0])),
        plattformen,
      }
    })

  return NextResponse.json({ perioden, gesamt, produkte })
}
