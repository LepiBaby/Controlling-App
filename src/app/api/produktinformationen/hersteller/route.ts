import { NextResponse } from 'next/server'
import { z } from 'zod'
import { requireAuth } from '@/lib/supabase-server'

const CreateSchema = z.object({
  name: z.string().min(1),
})

export async function GET() {
  const { user, supabase, error } = await requireAuth()
  if (error) return error

  const { data, error: dbErr } = await supabase
    .from('produktinformationen_hersteller')
    .select('id, name')
    .eq('user_id', user!.id)
    .order('name')
    .limit(500)

  if (dbErr) return NextResponse.json({ error: dbErr.message }, { status: 500 })

  return NextResponse.json(data ?? [])
}

export async function POST(request: Request) {
  const { user, supabase, error } = await requireAuth()
  if (error) return error

  const body = await request.json().catch(() => null)
  const parsed = CreateSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })
  }

  const { data, error: dbErr } = await supabase
    .from('produktinformationen_hersteller')
    .insert({ user_id: user!.id, name: parsed.data.name.trim() })
    .select('id, name')
    .single()

  if (dbErr) {
    if (dbErr.code === '23505') {
      return NextResponse.json({ error: 'Hersteller existiert bereits' }, { status: 409 })
    }
    return NextResponse.json({ error: dbErr.message }, { status: 500 })
  }

  return NextResponse.json(data, { status: 201 })
}
