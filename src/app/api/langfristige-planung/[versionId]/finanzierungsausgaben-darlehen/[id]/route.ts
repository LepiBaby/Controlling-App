import { NextResponse } from 'next/server'
import { requireAuth } from '@/lib/supabase-server'
import { ensureLangfristigeVersion } from '@/lib/langfristige-version'
import { DARLEHEN_COLS, darlehenSchema } from '@/lib/langfristige-finanzierungsausgaben-effektiv'

// Auth-geschützte, pro-Planversion dynamische Route — nie statisch generieren.
export const dynamic = 'force-dynamic'

// PROJ-107: Einzelne Finanzierung bearbeiten (PUT, vollständiger Datensatz) / löschen.

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

interface RouteContext {
  params: Promise<{ versionId: string; id: string }>
}

export async function PUT(request: Request, { params }: RouteContext) {
  const { user, supabase, error } = await requireAuth()
  if (error) return error

  const { versionId, id } = await params
  const versionError = await ensureLangfristigeVersion(supabase, user!.id, versionId)
  if (versionError) return versionError
  if (!UUID_REGEX.test(id)) return NextResponse.json({ error: 'Ungültige ID' }, { status: 400 })

  const body = await request.json().catch(() => null)
  const parsed = darlehenSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? 'Ungültige Eingabe.' }, { status: 400 })
  }

  const { data, error: dbErr } = await supabase
    .from('langfristige_finanzierungsausgaben_darlehen')
    .update({ ...parsed.data, quelle_kbf_id: parsed.data.quelle_kbf_id ?? null, updated_at: new Date().toISOString() })
    .eq('user_id', user!.id)
    .eq('plan_version_id', versionId)
    .eq('id', id)
    .select(DARLEHEN_COLS)
    .maybeSingle()

  if (dbErr) return NextResponse.json({ error: dbErr.message }, { status: 500 })
  if (!data) return NextResponse.json({ error: 'Finanzierung nicht gefunden' }, { status: 404 })
  return NextResponse.json(data)
}

export async function DELETE(_request: Request, { params }: RouteContext) {
  const { user, supabase, error } = await requireAuth()
  if (error) return error

  const { versionId, id } = await params
  const versionError = await ensureLangfristigeVersion(supabase, user!.id, versionId)
  if (versionError) return versionError
  if (!UUID_REGEX.test(id)) return NextResponse.json({ error: 'Ungültige ID' }, { status: 400 })

  const { data, error: dbErr } = await supabase
    .from('langfristige_finanzierungsausgaben_darlehen')
    .delete()
    .eq('user_id', user!.id)
    .eq('plan_version_id', versionId)
    .eq('id', id)
    .select('id')
    .maybeSingle()

  if (dbErr) return NextResponse.json({ error: dbErr.message }, { status: 500 })
  if (!data) return NextResponse.json({ error: 'Finanzierung nicht gefunden' }, { status: 404 })
  return NextResponse.json({ success: true })
}
