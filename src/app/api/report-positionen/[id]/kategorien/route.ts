import { NextResponse } from 'next/server'
import { z } from 'zod'
import { requireAuth } from '@/lib/supabase-server'

const putSchema = z.object({
  kpi_category_ids: z.array(z.string().uuid()),
})

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { user, supabase, error } = await requireAuth()
  if (error) return error

  const { id } = await params

  const body = await request.json().catch(() => null)
  const parsed = putSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })
  }

  // Verify ownership
  const { data: position, error: posErr } = await supabase
    .from('report_positionen')
    .select('id, name, type, sort_order')
    .eq('id', id)
    .eq('user_id', user!.id)
    .single()

  if (posErr || !position) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  // Replace all kategorien
  const { error: delErr } = await supabase
    .from('report_position_kategorien')
    .delete()
    .eq('report_position_id', id)
    .eq('user_id', user!.id)

  if (delErr) {
    return NextResponse.json({ error: delErr.message }, { status: 500 })
  }

  if (parsed.data.kpi_category_ids.length > 0) {
    const rows = parsed.data.kpi_category_ids.map(kpi_category_id => ({
      report_position_id: id,
      kpi_category_id,
      user_id: user!.id,
    }))
    const { error: insErr } = await supabase
      .from('report_position_kategorien')
      .insert(rows)

    if (insErr) {
      return NextResponse.json({ error: insErr.message }, { status: 500 })
    }
  }

  // Return updated position with nested data
  const [{ data: kategorien }, { data: summeRefs }] = await Promise.all([
    supabase
      .from('report_position_kategorien')
      .select('id, kpi_category_id, kpi_categories(id, name, type)')
      .eq('report_position_id', id),
    supabase
      .from('report_summe_positionen')
      .select('id, referenced_position_id, ref:referenced_position_id(id, name)')
      .eq('report_position_id', id),
  ])

  return NextResponse.json({
    id: position.id,
    name: position.name,
    type: position.type,
    sort_order: position.sort_order,
    kategorien: (kategorien ?? []).map(k => ({
      id: k.id,
      kpi_category_id: k.kpi_category_id,
      kpi_category: k.kpi_categories as unknown as { id: string; name: string; type: string },
    })),
    summe_positionen: (summeRefs ?? []).map(s => ({
      id: s.id,
      referenced_position_id: s.referenced_position_id,
      referenced_position: s.ref as unknown as { id: string; name: string },
    })),
  })
}
