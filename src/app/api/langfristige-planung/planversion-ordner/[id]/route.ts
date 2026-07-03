import { NextResponse } from 'next/server'
import { z } from 'zod'
import { requireAuth } from '@/lib/supabase-server'

// Auth-geschützte, dynamische Route — nie statisch generieren (Next 16 Static-Path-Pass instabil).
export const dynamic = 'force-dynamic'

const SELECT_COLS = 'id, name, created_at, updated_at'
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const DUPLICATE_CODE = '23505'
// Foreign-key violation (Ordner noch von einer Planversion referenziert)
const FK_VIOLATION_CODE = '23503'

const patchSchema = z.object({
  name: z.string().min(1).max(100).transform((s) => s.trim()),
})

interface RouteContext {
  params: Promise<{ id: string }>
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
    .from('langfristige_planversion_ordner')
    .update({ name: parsed.data.name, updated_at: new Date().toISOString() })
    .eq('user_id', user!.id)
    .eq('id', id)
    .select(SELECT_COLS)
    .maybeSingle()

  if (dbErr) {
    if (dbErr.code === DUPLICATE_CODE) {
      return NextResponse.json(
        { error: 'Ein Ordner mit diesem Namen existiert bereits.' },
        { status: 409 },
      )
    }
    return NextResponse.json({ error: dbErr.message }, { status: 500 })
  }
  if (!data) return NextResponse.json({ error: 'Ordner nicht gefunden' }, { status: 404 })
  return NextResponse.json(data)
}

export async function DELETE(_request: Request, { params }: RouteContext) {
  const { user, supabase, error } = await requireAuth()
  if (error) return error

  const { id } = await params
  if (!UUID_REGEX.test(id)) {
    return NextResponse.json({ error: 'Ungültige ID' }, { status: 400 })
  }

  // Existenz + Eigentum prüfen, damit fremde/unbekannte IDs sauber 404 liefern.
  const { data: existing, error: findErr } = await supabase
    .from('langfristige_planversion_ordner')
    .select('id')
    .eq('user_id', user!.id)
    .eq('id', id)
    .maybeSingle()

  if (findErr) return NextResponse.json({ error: findErr.message }, { status: 500 })
  if (!existing) return NextResponse.json({ error: 'Ordner nicht gefunden' }, { status: 404 })

  // Fachliche Prüfung: Ordner darf nur gelöscht werden, wenn er leer ist.
  const { count, error: countErr } = await supabase
    .from('langfristige_planversionen')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', user!.id)
    .eq('ordner_id', id)

  if (countErr) return NextResponse.json({ error: countErr.message }, { status: 500 })
  if ((count ?? 0) > 0) {
    return NextResponse.json(
      {
        error:
          'Dieser Ordner enthält noch Planversionen. Verschiebe oder lösche sie zuerst, dann kann der Ordner gelöscht werden.',
      },
      { status: 409 },
    )
  }

  const { error: dbErr } = await supabase
    .from('langfristige_planversion_ordner')
    .delete()
    .eq('user_id', user!.id)
    .eq('id', id)

  if (dbErr) {
    // Backstop: DB-seitige RESTRICT-Sperre (Race zwischen Count und Delete).
    if (dbErr.code === FK_VIOLATION_CODE) {
      return NextResponse.json(
        {
          error:
            'Dieser Ordner enthält noch Planversionen. Verschiebe oder lösche sie zuerst, dann kann der Ordner gelöscht werden.',
        },
        { status: 409 },
      )
    }
    return NextResponse.json({ error: dbErr.message }, { status: 500 })
  }
  return NextResponse.json({ success: true })
}
