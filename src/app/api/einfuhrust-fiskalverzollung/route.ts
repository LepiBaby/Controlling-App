import { NextResponse } from 'next/server'
import { z } from 'zod'
import { requireAuth } from '@/lib/supabase-server'

const putSchema = z.object({
  produkt_id: z.string().uuid(),
  fiskalverzollung: z.boolean(),
})

export async function GET() {
  const { user, supabase, error } = await requireAuth()
  if (error) return error

  const { data, error: dbErr } = await supabase
    .from('einfuhrust_fiskalverzollung')
    .select('produkt_id, fiskalverzollung')
    .eq('user_id', user!.id)
    .limit(500)

  if (dbErr) return NextResponse.json({ error: dbErr.message }, { status: 500 })

  return NextResponse.json(data ?? [])
}

export async function PUT(request: Request) {
  const { user, supabase, error } = await requireAuth()
  if (error) return error

  const body = await request.json().catch(() => null)
  const parsed = putSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })
  }

  const { produkt_id, fiskalverzollung } = parsed.data

  const { data, error: dbErr } = await supabase
    .from('einfuhrust_fiskalverzollung')
    .upsert(
      { user_id: user!.id, produkt_id, fiskalverzollung, updated_at: new Date().toISOString() },
      { onConflict: 'user_id,produkt_id' }
    )
    .select('produkt_id, fiskalverzollung')
    .single()

  if (dbErr || !data) {
    return NextResponse.json({ error: dbErr?.message ?? 'Upsert fehlgeschlagen' }, { status: 500 })
  }

  return NextResponse.json(data)
}
