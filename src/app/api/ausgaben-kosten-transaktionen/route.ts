import { NextResponse } from 'next/server'
import { z } from 'zod'
import { requireAuth } from '@/lib/supabase-server'

const PAGE_SIZE = 50

const UST_SAETZE = ['19', '7', '0', 'individuell'] as const

const createSchema = z.object({
  leistungsdatum:              z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Ungültiges Datumsformat (YYYY-MM-DD)'),
  zahlungsdatum:               z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().optional(),
  betrag_brutto:               z.number().positive('Bruttobetrag muss größer als 0 sein'),
  ust_satz:                    z.enum(UST_SAETZE, { message: 'Ungültiger USt-Satz' }),
  ust_betrag:                  z.number().min(0, 'USt-Betrag darf nicht negativ sein'),
  kategorie_id:                z.string().uuid('Ungültige Kategorie-ID'),
  gruppe_id:                   z.string().uuid().nullable().optional(),
  untergruppe_id:              z.string().uuid().nullable().optional(),
  sales_plattform_id:          z.string().uuid().nullable().optional(),
  produkt_id:                  z.string().uuid().nullable().optional(),
  beschreibung:                z.string().max(1000).nullable().optional(),
  relevanz:                    z.enum(['rentabilitaet', 'liquiditaet', 'beides'], { message: 'Ungültige Relevanz' }),
  abschreibung:                z.enum(['3_jahre', '5_jahre', '7_jahre', '10_jahre']).nullable().optional(),
})

function computeNetto(brutto: number, ustSatz: string, ustBetrag: number): number {
  if (ustSatz === '19') return Math.round((brutto - Math.round(brutto * 19 / 119 * 100) / 100) * 100) / 100
  if (ustSatz === '7')  return Math.round((brutto - Math.round(brutto * 7  / 107 * 100) / 100) * 100) / 100
  if (ustSatz === '0')  return brutto
  return Math.round((brutto - ustBetrag) * 100) / 100
}

function computeUstBetrag(brutto: number, ustSatz: string, ustBetragManual: number): number {
  if (ustSatz === '19') return Math.round(brutto * 19 / 119 * 100) / 100
  if (ustSatz === '7')  return Math.round(brutto * 7  / 107 * 100) / 100
  if (ustSatz === '0')  return 0
  return ustBetragManual
}

export async function GET(request: Request) {
  const { supabase, error } = await requireAuth()
  if (error) return error

  const { searchParams } = new URL(request.url)
  const page              = Math.max(1, parseInt(searchParams.get('page') ?? '1', 10))
  const sortColumn        = searchParams.get('sortColumn') === 'betrag_brutto' ? 'betrag_brutto' : 'leistungsdatum'
  const sortAsc           = searchParams.get('sortDirection') === 'asc'
  const von               = searchParams.get('von')
  const bis               = searchParams.get('bis')
  const kategorieIds      = searchParams.get('kategorie_ids')?.split(',').filter(Boolean) ?? []
  const gruppeIds         = searchParams.get('gruppe_ids')?.split(',').filter(Boolean) ?? []
  const untergruppeIds    = searchParams.get('untergruppe_ids')?.split(',').filter(Boolean) ?? []
  const salesPlattformIds = searchParams.get('sales_plattform_ids')?.split(',').filter(Boolean) ?? []
  const produktIds        = searchParams.get('produkt_ids')?.split(',').filter(Boolean) ?? []

  const from = (page - 1) * PAGE_SIZE
  const to   = from + PAGE_SIZE - 1

  let query = supabase
    .from('ausgaben_kosten_transaktionen')
    .select('*', { count: 'exact' })
    .order(sortColumn, { ascending: sortAsc })
    .range(from, to)

  if (von)                      query = query.gte('leistungsdatum', von)
  if (bis)                      query = query.lte('leistungsdatum', bis)
  if (kategorieIds.length)      query = query.in('kategorie_id', kategorieIds)
  if (gruppeIds.length)         query = query.in('gruppe_id', gruppeIds)
  if (untergruppeIds.length)    query = query.in('untergruppe_id', untergruppeIds)
  if (salesPlattformIds.length) query = query.in('sales_plattform_id', salesPlattformIds)
  if (produktIds.length)        query = query.in('produkt_id', produktIds)

  const { data, error: dbError, count } = await query
  if (dbError) return NextResponse.json({ error: dbError.message }, { status: 500 })

  // Separate query for totals over all filtered rows (not just current page)
  let sumQuery = supabase
    .from('ausgaben_kosten_transaktionen')
    .select('betrag_brutto, betrag_netto')

  if (von)                      sumQuery = sumQuery.gte('leistungsdatum', von)
  if (bis)                      sumQuery = sumQuery.lte('leistungsdatum', bis)
  if (kategorieIds.length)      sumQuery = sumQuery.in('kategorie_id', kategorieIds)
  if (gruppeIds.length)         sumQuery = sumQuery.in('gruppe_id', gruppeIds)
  if (untergruppeIds.length)    sumQuery = sumQuery.in('untergruppe_id', untergruppeIds)
  if (salesPlattformIds.length) sumQuery = sumQuery.in('sales_plattform_id', salesPlattformIds)
  if (produktIds.length)        sumQuery = sumQuery.in('produkt_id', produktIds)

  const { data: sumData, error: sumError } = await sumQuery
  if (sumError) return NextResponse.json({ error: sumError.message }, { status: 500 })

  const totalBrutto = Math.round((sumData ?? []).reduce((acc, r) => acc + Number(r.betrag_brutto), 0) * 100) / 100
  const totalNetto  = Math.round((sumData ?? []).reduce((acc, r) => acc + Number(r.betrag_netto), 0) * 100) / 100

  return NextResponse.json({
    data:         data ?? [],
    total:        count ?? 0,
    totalBrutto,
    totalNetto,
  })
}

export async function POST(request: Request) {
  const { supabase, error } = await requireAuth()
  if (error) return error

  const body = await request.json()
  const parsed = createSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })
  }

  const d = parsed.data
  const ustBetrag  = computeUstBetrag(d.betrag_brutto, d.ust_satz, d.ust_betrag)
  const betragNetto = computeNetto(d.betrag_brutto, d.ust_satz, ustBetrag)

  if (betragNetto < 0) {
    return NextResponse.json({ error: 'USt-Betrag darf den Bruttobetrag nicht überschreiten' }, { status: 400 })
  }

  const { data, error: dbError } = await supabase
    .from('ausgaben_kosten_transaktionen')
    .insert({
      leistungsdatum:              d.leistungsdatum,
      zahlungsdatum:               d.zahlungsdatum ?? null,
      betrag_brutto:               d.betrag_brutto,
      betrag_netto:                betragNetto,
      ust_satz:                    d.ust_satz,
      ust_betrag:                  ustBetrag,
      kategorie_id:                d.kategorie_id,
      gruppe_id:                   d.gruppe_id ?? null,
      untergruppe_id:              d.untergruppe_id ?? null,
      sales_plattform_id:          d.sales_plattform_id ?? null,
      produkt_id:                  d.produkt_id ?? null,
      beschreibung:                d.beschreibung ?? null,
      relevanz:                    d.relevanz,
      abschreibung:                d.abschreibung ?? null,
    })
    .select()
    .single()

  if (dbError) return NextResponse.json({ error: dbError.message }, { status: 500 })
  return NextResponse.json(data, { status: 201 })
}
