import { NextResponse } from 'next/server'
import { z } from 'zod'
import { requireAuth } from '@/lib/supabase-server'

// Auth-geschützte, dynamische Route — nie statisch generieren (Next 16 Static-Path-Pass instabil).
export const dynamic = 'force-dynamic'

const SELECT_COLS = 'id, name, created_at, updated_at'

const createSchema = z.object({
  name: z.string().min(1).max(100).transform((s) => s.trim()),
})

// Postgres unique-violation -> Name bereits vergeben
const DUPLICATE_CODE = '23505'

export async function GET() {
  const { user, supabase, error } = await requireAuth()
  if (error) return error

  const { data, error: dbErr } = await supabase
    .from('langfristige_planversion_ordner')
    .select(SELECT_COLS)
    .eq('user_id', user!.id)
    .order('name', { ascending: true })
    .limit(500)

  if (dbErr) return NextResponse.json({ error: dbErr.message }, { status: 500 })
  return NextResponse.json(data ?? [])
}

export async function POST(request: Request) {
  const { user, supabase, error } = await requireAuth()
  if (error) return error

  const body = await request.json().catch(() => null)
  const parsed = createSchema.safeParse(body)
  if (!parsed.success || parsed.data.name.length === 0) {
    return NextResponse.json(
      { error: 'Bitte gib einen Namen mit 1–100 Zeichen an.' },
      { status: 400 },
    )
  }

  const { data, error: dbErr } = await supabase
    .from('langfristige_planversion_ordner')
    .insert({ name: parsed.data.name, user_id: user!.id })
    .select(SELECT_COLS)
    .single()

  if (dbErr) {
    if (dbErr.code === DUPLICATE_CODE) {
      return NextResponse.json(
        { error: 'Ein Ordner mit diesem Namen existiert bereits.' },
        { status: 409 },
      )
    }
    return NextResponse.json({ error: dbErr.message }, { status: 500 })
  }

  return NextResponse.json(data, { status: 201 })
}
