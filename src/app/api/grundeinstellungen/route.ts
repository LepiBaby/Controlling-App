import { NextResponse } from 'next/server'
import { z } from 'zod'
import { requireAuth } from '@/lib/supabase-server'

const DEFAULT_PLANUNGSHORIZONT = 13
const DEFAULT_VERGANGENHEITSHORIZONT = 13

const putSchema = z
  .object({
    planungshorizont_wochen: z.number().int().min(1).max(52).optional(),
    planungshorizont_absatz_wochen: z.number().int().min(1).max(52).nullable().optional(),
    vergangenheitshorizont_wochen: z.number().int().min(1).max(52).optional(),
  })
  .refine(
    d =>
      d.planungshorizont_wochen !== undefined ||
      d.planungshorizont_absatz_wochen !== undefined ||
      d.vergangenheitshorizont_wochen !== undefined,
    { message: 'Mindestens ein Feld erforderlich' },
  )

export async function GET() {
  const { user, supabase, error } = await requireAuth()
  if (error) return error

  const { data, error: dbErr } = await supabase
    .from('grundeinstellungen')
    .select('planungshorizont_wochen, planungshorizont_absatz_wochen, vergangenheitshorizont_wochen')
    .eq('user_id', user!.id)
    .maybeSingle()

  if (dbErr) {
    return NextResponse.json({ error: dbErr.message }, { status: 500 })
  }

  return NextResponse.json({
    planungshorizont_wochen: data?.planungshorizont_wochen ?? DEFAULT_PLANUNGSHORIZONT,
    planungshorizont_absatz_wochen: data?.planungshorizont_absatz_wochen ?? null,
    vergangenheitshorizont_wochen: data?.vergangenheitshorizont_wochen ?? DEFAULT_VERGANGENHEITSHORIZONT,
  })
}

export async function PUT(request: Request) {
  const { user, supabase, error } = await requireAuth()
  if (error) return error

  const body = await request.json().catch(() => null)
  const parsed = putSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })
  }

  const fields: Record<string, unknown> = { user_id: user!.id }
  if (parsed.data.planungshorizont_wochen !== undefined) {
    fields.planungshorizont_wochen = parsed.data.planungshorizont_wochen
  }
  if (parsed.data.planungshorizont_absatz_wochen !== undefined) {
    fields.planungshorizont_absatz_wochen = parsed.data.planungshorizont_absatz_wochen
  }
  if (parsed.data.vergangenheitshorizont_wochen !== undefined) {
    fields.vergangenheitshorizont_wochen = parsed.data.vergangenheitshorizont_wochen
  }

  const { data, error: dbErr } = await supabase
    .from('grundeinstellungen')
    .upsert(fields, { onConflict: 'user_id' })
    .select('planungshorizont_wochen, planungshorizont_absatz_wochen, vergangenheitshorizont_wochen')
    .single()

  if (dbErr || !data) {
    return NextResponse.json({ error: dbErr?.message ?? 'Upsert fehlgeschlagen' }, { status: 500 })
  }

  return NextResponse.json({
    planungshorizont_wochen: data.planungshorizont_wochen,
    planungshorizont_absatz_wochen: data.planungshorizont_absatz_wochen,
    vergangenheitshorizont_wochen: data.vergangenheitshorizont_wochen,
  })
}
