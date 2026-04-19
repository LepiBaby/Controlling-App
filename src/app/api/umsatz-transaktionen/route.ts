import { NextResponse } from 'next/server'
import { z } from 'zod'
import { requireAuth } from '@/lib/supabase-server'

const PAGE_SIZE = 50

const createSchema = z.object({
  leistungsdatum:     z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Ungültiges Datumsformat (YYYY-MM-DD)'),
  betrag:             z.number().positive('Betrag muss größer als 0 sein'),
  kategorie_id:       z.string().uuid('Ungültige Kategorie-ID'),
  gruppe_id:          z.string().uuid().nullable().optional(),
  untergruppe_id:     z.string().uuid().nullable().optional(),
  sales_plattform_id: z.string().uuid().nullable().optional(),
  produkt_id:         z.string().uuid().nullable().optional(),
  beschreibung:       z.string().max(1000).nullable().optional(),
})

export async function GET(request: Request) {
  const { supabase, error } = await requireAuth()
  if (error) return error

  const { searchParams } = new URL(request.url)
  const page         = Math.max(1, parseInt(searchParams.get('page') ?? '1', 10))
  const sortColumn   = searchParams.get('sortColumn') === 'betrag' ? 'betrag' : 'leistungsdatum'
  const sortAsc      = searchParams.get('sortDirection') === 'asc'
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
    .from('umsatz_transaktionen')
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

  // Separate query for totalBetrag (sum over all filtered rows, not just current page)
  let sumQuery = supabase
    .from('umsatz_transaktionen')
    .select('betrag')

  if (von)                      sumQuery = sumQuery.gte('leistungsdatum', von)
  if (bis)                      sumQuery = sumQuery.lte('leistungsdatum', bis)
  if (kategorieIds.length)      sumQuery = sumQuery.in('kategorie_id', kategorieIds)
  if (gruppeIds.length)         sumQuery = sumQuery.in('gruppe_id', gruppeIds)
  if (untergruppeIds.length)    sumQuery = sumQuery.in('untergruppe_id', untergruppeIds)
  if (salesPlattformIds.length) sumQuery = sumQuery.in('sales_plattform_id', salesPlattformIds)
  if (produktIds.length)        sumQuery = sumQuery.in('produkt_id', produktIds)

  const { data: sumData, error: sumError } = await sumQuery
  if (sumError) return NextResponse.json({ error: sumError.message }, { status: 500 })

  const totalBetrag = (sumData ?? []).reduce((acc, row) => acc + Number(row.betrag), 0)

  return NextResponse.json({
    data:        data ?? [],
    total:       count ?? 0,
    totalBetrag: Math.round(totalBetrag * 100) / 100,
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

  const { data, error: dbError } = await supabase
    .from('umsatz_transaktionen')
    .insert({
      leistungsdatum:     parsed.data.leistungsdatum,
      betrag:             parsed.data.betrag,
      kategorie_id:       parsed.data.kategorie_id,
      gruppe_id:          parsed.data.gruppe_id ?? null,
      untergruppe_id:     parsed.data.untergruppe_id ?? null,
      sales_plattform_id: parsed.data.sales_plattform_id ?? null,
      produkt_id:         parsed.data.produkt_id ?? null,
      beschreibung:       parsed.data.beschreibung ?? null,
    })
    .select()
    .single()

  if (dbError) return NextResponse.json({ error: dbError.message }, { status: 500 })
  return NextResponse.json(data, { status: 201 })
}
