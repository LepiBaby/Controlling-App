import { NextResponse } from 'next/server'
import { z } from 'zod'
import { requireAuth } from '@/lib/supabase-server'

const UpsertSchema = z.object({
  volumen_20dc: z.number().positive().nullable().optional(),
  volumen_40dc: z.number().positive().nullable().optional(),
  volumen_40hq: z.number().positive().nullable().optional(),
})

export async function GET() {
  const { user, supabase, error } = await requireAuth()
  if (error) return error

  const { data, error: dbErr } = await supabase
    .from('produktinformationen_container_global')
    .select('id, volumen_20dc, volumen_40dc, volumen_40hq')
    .eq('user_id', user!.id)
    .maybeSingle()

  if (dbErr) return NextResponse.json({ error: dbErr.message }, { status: 500 })

  return NextResponse.json(data ?? null)
}

export async function PUT(request: Request) {
  const { user, supabase, error } = await requireAuth()
  if (error) return error

  const body = await request.json().catch(() => null)
  const parsed = UpsertSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })
  }

  const { data, error: dbErr } = await supabase
    .from('produktinformationen_container_global')
    .upsert(
      {
        user_id: user!.id,
        volumen_20dc: parsed.data.volumen_20dc ?? null,
        volumen_40dc: parsed.data.volumen_40dc ?? null,
        volumen_40hq: parsed.data.volumen_40hq ?? null,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'user_id' }
    )
    .select('id, volumen_20dc, volumen_40dc, volumen_40hq')
    .single()

  if (dbErr || !data) {
    return NextResponse.json({ error: dbErr?.message ?? 'Upsert fehlgeschlagen' }, { status: 500 })
  }

  return NextResponse.json(data)
}
