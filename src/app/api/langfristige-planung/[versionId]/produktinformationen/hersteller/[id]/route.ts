import { NextResponse } from 'next/server'
import { z } from 'zod'
import { requireAuth } from '@/lib/supabase-server'
import { ensureLangfristigeVersion } from '@/lib/langfristige-version'

// Auth-geschützte, pro-Planversion dynamische Route — nie statisch generieren.
// Überspringt den in Next 16 instabilen Static-Path-Pass (Worker-Crash).
export const dynamic = 'force-dynamic'

// PROJ-77: Einzelnen Hersteller einer Planversion umbenennen/löschen.

const TABLE = 'langfristige_produktinformationen_hersteller'

const RenameSchema = z.object({
  name: z.string().min(1),
})

interface RouteContext {
  params: Promise<{ versionId: string; id: string }>
}

export async function PATCH(request: Request, { params }: RouteContext) {
  const { user, supabase, error } = await requireAuth()
  if (error) return error

  const { versionId, id } = await params
  const versionError = await ensureLangfristigeVersion(supabase, user!.id, versionId)
  if (versionError) return versionError

  const body = await request.json().catch(() => null)
  const parsed = RenameSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })
  }
  const name = parsed.data.name.trim()
  if (name.length === 0) {
    return NextResponse.json({ error: 'Name darf nicht leer sein' }, { status: 400 })
  }

  const { data, error: dbErr } = await supabase
    .from(TABLE)
    .update({ name, updated_at: new Date().toISOString() })
    .eq('id', id)
    .eq('user_id', user!.id)
    .eq('plan_version_id', versionId)
    .select('id, name')
    .maybeSingle()

  if (dbErr) {
    if (dbErr.code === '23505') {
      return NextResponse.json({ error: 'Hersteller existiert bereits' }, { status: 409 })
    }
    return NextResponse.json({ error: dbErr.message }, { status: 500 })
  }
  if (!data) return NextResponse.json({ error: 'Hersteller nicht gefunden' }, { status: 404 })

  return NextResponse.json(data)
}

export async function DELETE(_request: Request, { params }: RouteContext) {
  const { user, supabase, error } = await requireAuth()
  if (error) return error

  const { versionId, id } = await params
  const versionError = await ensureLangfristigeVersion(supabase, user!.id, versionId)
  if (versionError) return versionError

  const { error: dbErr } = await supabase
    .from(TABLE)
    .delete()
    .eq('id', id)
    .eq('user_id', user!.id)
    .eq('plan_version_id', versionId)

  if (dbErr) return NextResponse.json({ error: dbErr.message }, { status: 500 })

  return new NextResponse(null, { status: 204 })
}
