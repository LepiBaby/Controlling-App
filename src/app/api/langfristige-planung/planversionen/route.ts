import { NextResponse } from 'next/server'
import { z } from 'zod'
import { requireAuth } from '@/lib/supabase-server'
import { ensureInvestitionenSnapshot } from '@/lib/langfristige-investitionen-snapshot'

// Auth-geschützte, pro-Planversion dynamische Route — nie statisch generieren.
// Überspringt den in Next 16 instabilen Static-Path-Pass (Worker-Crash).
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
    .from('langfristige_planversionen')
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
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Bitte gib einen Namen mit 1–100 Zeichen an.' },
      { status: 400 },
    )
  }

  // Leerer Name nach dem Trimmen (z.B. nur Leerzeichen)
  if (parsed.data.name.length === 0) {
    return NextResponse.json({ error: 'Der Name darf nicht leer sein.' }, { status: 400 })
  }

  const { data, error: dbErr } = await supabase
    .from('langfristige_planversionen')
    .insert({ name: parsed.data.name, user_id: user!.id })
    .select(SELECT_COLS)
    .single()

  if (dbErr) {
    if (dbErr.code === DUPLICATE_CODE) {
      return NextResponse.json(
        { error: 'Eine Planversion mit diesem Namen existiert bereits.' },
        { status: 409 },
      )
    }
    return NextResponse.json({ error: dbErr.message }, { status: 500 })
  }

  // Investitionen-Reiter direkt mit den festen Produktinvestitions-Übergruppen
  // (Snapshot aus dem globalen KPI-Modell) befüllen. Fehler hier dürfen das
  // Anlegen der Version nicht scheitern lassen (GET seedet andernfalls lazy nach).
  try {
    await ensureInvestitionenSnapshot(supabase, user!.id, data.id)
  } catch {
    // bewusst geschluckt — Lazy-Seeding beim ersten GET fängt das ab
  }

  return NextResponse.json(data, { status: 201 })
}
