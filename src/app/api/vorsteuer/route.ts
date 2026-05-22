import { NextResponse } from 'next/server'
import { requireAuth } from '@/lib/supabase-server'

export async function GET(request: Request) {
  const { supabase, error } = await requireAuth()
  if (error) return error

  const { searchParams } = new URL(request.url)
  const page           = Math.max(1, parseInt(searchParams.get('page') ?? '1', 10))
  const pageSizeParam   = parseInt(searchParams.get('pageSize') ?? '50', 10)
  const pageSize        = pageSizeParam > 0 ? pageSizeParam : 0
  const sortColumn     = searchParams.get('sortColumn') === 'betrag_brutto' ? 'betrag_brutto' : 'leistungsdatum'
  const sortAsc        = searchParams.get('sortDirection') === 'asc'
  const von            = searchParams.get('von')
  const bis            = searchParams.get('bis')
  const kategorieIds   = searchParams.get('kategorie_ids')?.split(',').filter(Boolean) ?? []
  const gruppeIds      = searchParams.get('gruppe_ids')?.split(',').filter(Boolean) ?? []
  const untergruppeIds = searchParams.get('untergruppe_ids')?.split(',').filter(Boolean) ?? []

  let query = supabase
    .from('ausgaben_kosten_transaktionen')
    .select('id, leistungsdatum, betrag_brutto, betrag_netto, ust_satz, ust_betrag, kategorie_id, gruppe_id, untergruppe_id', { count: 'exact' })
    .gt('ust_betrag', 0)
    .order(sortColumn, { ascending: sortAsc })

  if (pageSize > 0) {
    const from = (page - 1) * pageSize
    query = query.range(from, from + pageSize - 1)
  }

  if (von)                   query = query.gte('leistungsdatum', von)
  if (bis)                   query = query.lte('leistungsdatum', bis)
  if (kategorieIds.length)   query = query.in('kategorie_id', kategorieIds)
  if (gruppeIds.length)      query = query.in('gruppe_id', gruppeIds)
  if (untergruppeIds.length) query = query.in('untergruppe_id', untergruppeIds)

  const { data, error: dbError, count } = await query
  if (dbError) return NextResponse.json({ error: dbError.message }, { status: 500 })

  return NextResponse.json({
    data:  data ?? [],
    total: count ?? 0,
  })
}
