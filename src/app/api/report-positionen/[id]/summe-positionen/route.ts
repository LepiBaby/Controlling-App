import { NextResponse } from 'next/server'
import { z } from 'zod'
import { requireAuth } from '@/lib/supabase-server'

const putSchema = z.object({
  referenced_position_ids: z.array(z.string().uuid()),
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

  // Verify ownership and type
  const { data: position, error: posErr } = await supabase
    .from('report_positionen')
    .select('id, name, type, sort_order')
    .eq('id', id)
    .eq('user_id', user!.id)
    .single()

  if (posErr || !position) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  // Replace all summe references
  const { error: delErr } = await supabase
    .from('report_summe_positionen')
    .delete()
    .eq('report_position_id', id)
    .eq('user_id', user!.id)

  if (delErr) {
    return NextResponse.json({ error: delErr.message }, { status: 500 })
  }

  if (parsed.data.referenced_position_ids.length > 0) {
    const rows = parsed.data.referenced_position_ids.map(referenced_position_id => ({
      report_position_id: id,
      referenced_position_id,
      user_id: user!.id,
    }))
    const { error: insErr } = await supabase
      .from('report_summe_positionen')
      .insert(rows)

    if (insErr) {
      return NextResponse.json({ error: insErr.message }, { status: 500 })
    }
  }

  // Fetch referenced position names
  const { data: summeRefs } = await supabase
    .from('report_summe_positionen')
    .select('id, referenced_position_id')
    .eq('report_position_id', id)

  let refNames: Record<string, string> = {}
  if (summeRefs && summeRefs.length > 0) {
    const refIds = summeRefs.map(s => s.referenced_position_id)
    const { data: refPositions } = await supabase
      .from('report_positionen')
      .select('id, name')
      .in('id', refIds)
    refNames = Object.fromEntries((refPositions ?? []).map(p => [p.id, p.name]))
  }

  return NextResponse.json({
    id: position.id,
    name: position.name,
    type: position.type,
    sort_order: position.sort_order,
    kategorien: [],
    summe_positionen: (summeRefs ?? []).map(s => ({
      id: s.id,
      referenced_position_id: s.referenced_position_id,
      referenced_position: {
        id: s.referenced_position_id,
        name: refNames[s.referenced_position_id] ?? '',
      },
    })),
  })
}
