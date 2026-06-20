import { NextResponse } from 'next/server'
import { z } from 'zod'
import { requireAuth } from '@/lib/supabase-server'

const SELECT_COLS = 'id, plan_version_id, art, parent_id, name, level, sort_order'
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

const patchSchema = z.object({
  name: z.string().min(1).max(100).transform((s) => s.trim()).optional(),
  sort_order: z.number().int().min(0).optional(),
  parent_id: z.string().uuid().nullable().optional(),
  level: z.union([z.literal(1), z.literal(2)]).optional(),
})

interface RouteContext {
  params: Promise<{ versionId: string; id: string }>
}

async function ensureVersion(
  supabase: Awaited<ReturnType<typeof requireAuth>>['supabase'],
  userId: string,
  versionId: string,
): Promise<Response | null> {
  if (!UUID_REGEX.test(versionId)) {
    return NextResponse.json({ error: 'Ungültige Versions-ID' }, { status: 400 })
  }
  const { data, error } = await supabase
    .from('langfristige_planversionen')
    .select('id')
    .eq('user_id', userId)
    .eq('id', versionId)
    .maybeSingle()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  if (!data) return NextResponse.json({ error: 'Planversion nicht gefunden' }, { status: 404 })
  return null
}

export async function PATCH(request: Request, { params }: RouteContext) {
  const { user, supabase, error } = await requireAuth()
  if (error) return error

  const { versionId, id } = await params
  const versionError = await ensureVersion(supabase, user!.id, versionId)
  if (versionError) return versionError
  if (!UUID_REGEX.test(id)) {
    return NextResponse.json({ error: 'Ungültige ID' }, { status: 400 })
  }

  const body = await request.json().catch(() => null)
  const parsed = patchSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: 'Ungültige Eingabe.' }, { status: 400 })
  }
  const patch = parsed.data
  if (patch.name !== undefined && patch.name.length === 0) {
    return NextResponse.json({ error: 'Der Name darf nicht leer sein.' }, { status: 400 })
  }

  // Bestehenden Eintrag (versions- & nutzergebunden) laden — liefert auch die Art
  const { data: existing, error: findErr } = await supabase
    .from('langfristige_kpi_kategorien')
    .select('id, art, level')
    .eq('user_id', user!.id)
    .eq('plan_version_id', versionId)
    .eq('id', id)
    .maybeSingle()
  if (findErr) return NextResponse.json({ error: findErr.message }, { status: 500 })
  if (!existing) return NextResponse.json({ error: 'Eintrag nicht gefunden' }, { status: 404 })

  // Beim Umhängen: Ebene/Eltern müssen konsistent sein
  if (patch.parent_id !== undefined || patch.level !== undefined) {
    const newParent = patch.parent_id !== undefined ? patch.parent_id : null
    const newLevel = patch.level ?? existing.level
    if (newLevel === 1 && newParent !== null) {
      return NextResponse.json({ error: 'Eine Gruppe (Ebene 1) darf keinen Elternknoten haben.' }, { status: 400 })
    }
    if (newLevel === 2 && newParent === null) {
      return NextResponse.json({ error: 'Eine Untergruppe (Ebene 2) benötigt eine übergeordnete Gruppe.' }, { status: 400 })
    }
    if (newParent !== null) {
      if (newParent === id) {
        return NextResponse.json({ error: 'Ein Eintrag kann nicht sich selbst übergeordnet sein.' }, { status: 400 })
      }
      const { data: parent, error: parentErr } = await supabase
        .from('langfristige_kpi_kategorien')
        .select('id, level')
        .eq('user_id', user!.id)
        .eq('plan_version_id', versionId)
        .eq('art', existing.art)
        .eq('id', newParent)
        .maybeSingle()
      if (parentErr) return NextResponse.json({ error: parentErr.message }, { status: 500 })
      if (!parent || parent.level !== 1) {
        return NextResponse.json({ error: 'Ungültige übergeordnete Gruppe.' }, { status: 400 })
      }
    }
  }

  const update: Record<string, unknown> = { updated_at: new Date().toISOString() }
  if (patch.name !== undefined) update.name = patch.name
  if (patch.sort_order !== undefined) update.sort_order = patch.sort_order
  if (patch.parent_id !== undefined) update.parent_id = patch.parent_id
  if (patch.level !== undefined) update.level = patch.level

  const { data, error: dbErr } = await supabase
    .from('langfristige_kpi_kategorien')
    .update(update)
    .eq('user_id', user!.id)
    .eq('plan_version_id', versionId)
    .eq('id', id)
    .select(SELECT_COLS)
    .maybeSingle()

  if (dbErr) return NextResponse.json({ error: dbErr.message }, { status: 500 })
  if (!data) return NextResponse.json({ error: 'Eintrag nicht gefunden' }, { status: 404 })
  return NextResponse.json(data)
}

export async function DELETE(_request: Request, { params }: RouteContext) {
  const { user, supabase, error } = await requireAuth()
  if (error) return error

  const { versionId, id } = await params
  const versionError = await ensureVersion(supabase, user!.id, versionId)
  if (versionError) return versionError
  if (!UUID_REGEX.test(id)) {
    return NextResponse.json({ error: 'Ungültige ID' }, { status: 400 })
  }

  // Existenz + Eigentum prüfen, damit fremde/unbekannte IDs sauber 404 liefern
  const { data: existing, error: findErr } = await supabase
    .from('langfristige_kpi_kategorien')
    .select('id')
    .eq('user_id', user!.id)
    .eq('plan_version_id', versionId)
    .eq('id', id)
    .maybeSingle()
  if (findErr) return NextResponse.json({ error: findErr.message }, { status: 500 })
  if (!existing) return NextResponse.json({ error: 'Eintrag nicht gefunden' }, { status: 404 })

  // Untergruppen werden über die self-FK (ON DELETE CASCADE) automatisch mitgelöscht
  const { error: dbErr } = await supabase
    .from('langfristige_kpi_kategorien')
    .delete()
    .eq('user_id', user!.id)
    .eq('plan_version_id', versionId)
    .eq('id', id)

  if (dbErr) return NextResponse.json({ error: dbErr.message }, { status: 500 })
  return NextResponse.json({ success: true })
}
