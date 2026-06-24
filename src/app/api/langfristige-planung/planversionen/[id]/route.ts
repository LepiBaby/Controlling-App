import { NextResponse } from 'next/server'
import { z } from 'zod'
import { requireAuth } from '@/lib/supabase-server'

// Auth-geschützte, pro-Planversion dynamische Route — nie statisch generieren.
// Überspringt den in Next 16 instabilen Static-Path-Pass (Worker-Crash).
export const dynamic = 'force-dynamic'

const SELECT_COLS = 'id, name, created_at, updated_at'
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const DUPLICATE_CODE = '23505'

const patchSchema = z.object({
  name: z.string().min(1).max(100).transform((s) => s.trim()),
})

interface RouteContext {
  params: Promise<{ id: string }>
}

export async function GET(_request: Request, { params }: RouteContext) {
  const { user, supabase, error } = await requireAuth()
  if (error) return error

  const { id } = await params
  if (!UUID_REGEX.test(id)) {
    return NextResponse.json({ error: 'Ungültige ID' }, { status: 400 })
  }

  const { data, error: dbErr } = await supabase
    .from('langfristige_planversionen')
    .select(SELECT_COLS)
    .eq('user_id', user!.id)
    .eq('id', id)
    .maybeSingle()

  if (dbErr) return NextResponse.json({ error: dbErr.message }, { status: 500 })
  if (!data) return NextResponse.json({ error: 'Planversion nicht gefunden' }, { status: 404 })
  return NextResponse.json(data)
}

export async function PATCH(request: Request, { params }: RouteContext) {
  const { user, supabase, error } = await requireAuth()
  if (error) return error

  const { id } = await params
  if (!UUID_REGEX.test(id)) {
    return NextResponse.json({ error: 'Ungültige ID' }, { status: 400 })
  }

  const body = await request.json().catch(() => null)
  const parsed = patchSchema.safeParse(body)
  if (!parsed.success || parsed.data.name.length === 0) {
    return NextResponse.json(
      { error: 'Bitte gib einen Namen mit 1–100 Zeichen an.' },
      { status: 400 },
    )
  }

  const { data, error: dbErr } = await supabase
    .from('langfristige_planversionen')
    .update({ name: parsed.data.name, updated_at: new Date().toISOString() })
    .eq('user_id', user!.id)
    .eq('id', id)
    .select(SELECT_COLS)
    .maybeSingle()

  if (dbErr) {
    if (dbErr.code === DUPLICATE_CODE) {
      return NextResponse.json(
        { error: 'Eine Planversion mit diesem Namen existiert bereits.' },
        { status: 409 },
      )
    }
    return NextResponse.json({ error: dbErr.message }, { status: 500 })
  }
  if (!data) return NextResponse.json({ error: 'Planversion nicht gefunden' }, { status: 404 })
  return NextResponse.json(data)
}

export async function DELETE(_request: Request, { params }: RouteContext) {
  const { user, supabase, error } = await requireAuth()
  if (error) return error

  const { id } = await params
  if (!UUID_REGEX.test(id)) {
    return NextResponse.json({ error: 'Ungültige ID' }, { status: 400 })
  }

  // Existenz + Eigentum prüfen, damit fremde/unbekannte IDs sauber 404 liefern
  const { data: existing, error: findErr } = await supabase
    .from('langfristige_planversionen')
    .select('id')
    .eq('user_id', user!.id)
    .eq('id', id)
    .maybeSingle()

  if (findErr) return NextResponse.json({ error: findErr.message }, { status: 500 })
  if (!existing) return NextResponse.json({ error: 'Planversion nicht gefunden' }, { status: 404 })

  const { error: dbErr } = await supabase
    .from('langfristige_planversionen')
    .delete()
    .eq('user_id', user!.id)
    .eq('id', id)

  if (dbErr) return NextResponse.json({ error: dbErr.message }, { status: 500 })
  return NextResponse.json({ success: true })
}
