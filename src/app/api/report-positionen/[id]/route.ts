import { NextResponse } from 'next/server'
import { z } from 'zod'
import { requireAuth } from '@/lib/supabase-server'

const patchSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  sort_order: z.number().int().min(0).optional(),
  investitionsbezogen: z.boolean().optional(),
  in_deckungsbeitragsreport: z.boolean().optional(),
  in_break_even_report: z.boolean().optional(),
}).refine(d => d.name !== undefined || d.sort_order !== undefined || d.investitionsbezogen !== undefined || d.in_deckungsbeitragsreport !== undefined || d.in_break_even_report !== undefined, {
  message: 'At least one field required',
})

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { user, supabase, error } = await requireAuth()
  if (error) return error

  const { id } = await params

  const body = await request.json().catch(() => null)
  const parsed = patchSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })
  }

  const { data: updated, error: updErr } = await supabase
    .from('report_positionen')
    .update(parsed.data)
    .eq('id', id)
    .eq('user_id', user!.id)
    .select('id, name, type, sort_order, investitionsbezogen, in_deckungsbeitragsreport, in_break_even_report')
    .single()

  if (updErr || !updated) {
    return NextResponse.json({ error: updErr?.message ?? 'Not found' }, { status: 404 })
  }

  return NextResponse.json(updated)
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { user, supabase, error } = await requireAuth()
  if (error) return error

  const { id } = await params

  const { error: delErr } = await supabase
    .from('report_positionen')
    .delete()
    .eq('id', id)
    .eq('user_id', user!.id)

  if (delErr) {
    return NextResponse.json({ error: delErr.message }, { status: 500 })
  }

  return new Response(null, { status: 204 })
}
