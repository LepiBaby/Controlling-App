import { NextResponse } from 'next/server'
import { z } from 'zod'
import { requireAuth } from '@/lib/supabase-server'
import { ensureLangfristigeVersion } from '@/lib/langfristige-version'

// Auth-geschützte, pro-Planversion dynamische Route — nie statisch generieren.
// Überspringt den in Next 16 instabilen Static-Path-Pass (Worker-Crash).
export const dynamic = 'force-dynamic'

// PROJ-86: Einzelne Bestellung lesen / aktualisieren / löschen (versionsgebunden).

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

const dateStr = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/)
  .nullable()
  .optional()

const UpdateSchema = z.object({
  bestelldatum: dateStr,
  produktionsstart_datum: dateStr,
  produktionsende_datum: dateStr,
  shippingdatum: dateStr,
  ankunftsdatum: dateStr,
  verfuegbarkeitsdatum: dateStr,
  menge_theoretisch: z.number().int().min(0).nullable().optional(),
  menge_praktisch: z.number().int().min(0).optional(),
  begruendung: z.string().max(2000).nullable().optional(),
  anzahl_20dc: z.number().int().min(0).optional(),
  anzahl_40hq: z.number().int().min(0).optional(),
  notizen: z.string().max(2000).nullable().optional(),
  manuell_geaendert: z.boolean().optional(),
  ist_erstbestellung: z.boolean().optional(),
})

const SELECT_COLS =
  'id, produkt_id, bestelldatum, produktionsstart_datum, produktionsende_datum, shippingdatum, ankunftsdatum, verfuegbarkeitsdatum, menge_theoretisch, menge_nach_moq, menge_vor_konsolidierung, menge_praktisch, begruendung, herkunft, manuell_geaendert, ist_erstbestellung, anzahl_20dc, anzahl_40hq, container_anteil, notizen, created_at, updated_at'

interface RouteContext {
  params: Promise<{ versionId: string; id: string }>
}

export async function GET(_request: Request, { params }: RouteContext) {
  const { user, supabase, error } = await requireAuth()
  if (error) return error

  const { versionId, id } = await params
  const versionError = await ensureLangfristigeVersion(supabase, user!.id, versionId)
  if (versionError) return versionError
  if (!UUID_REGEX.test(id)) {
    return NextResponse.json({ error: 'Ungültige ID' }, { status: 400 })
  }

  const { data, error: dbErr } = await supabase
    .from('langfristige_bestellungen')
    .select(SELECT_COLS)
    .eq('user_id', user!.id)
    .eq('plan_version_id', versionId)
    .eq('id', id)
    .maybeSingle()

  if (dbErr) return NextResponse.json({ error: dbErr.message }, { status: 500 })
  if (!data) return NextResponse.json({ error: 'Bestellung nicht gefunden' }, { status: 404 })
  return NextResponse.json(data)
}

export async function PUT(request: Request, { params }: RouteContext) {
  const { user, supabase, error } = await requireAuth()
  if (error) return error

  const { versionId, id } = await params
  const versionError = await ensureLangfristigeVersion(supabase, user!.id, versionId)
  if (versionError) return versionError
  if (!UUID_REGEX.test(id)) {
    return NextResponse.json({ error: 'Ungültige ID' }, { status: 400 })
  }

  const body = await request.json().catch(() => null)
  const parsed = UpdateSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })
  }

  const patch: Record<string, unknown> = { updated_at: new Date().toISOString() }
  for (const [k, v] of Object.entries(parsed.data)) {
    if (v !== undefined) patch[k] = v
  }

  const { data, error: dbErr } = await supabase
    .from('langfristige_bestellungen')
    .update(patch)
    .eq('user_id', user!.id)
    .eq('plan_version_id', versionId)
    .eq('id', id)
    .select(SELECT_COLS)
    .maybeSingle()

  if (dbErr) return NextResponse.json({ error: dbErr.message }, { status: 500 })
  if (!data) return NextResponse.json({ error: 'Bestellung nicht gefunden' }, { status: 404 })
  return NextResponse.json(data)
}

export async function DELETE(_request: Request, { params }: RouteContext) {
  const { user, supabase, error } = await requireAuth()
  if (error) return error

  const { versionId, id } = await params
  const versionError = await ensureLangfristigeVersion(supabase, user!.id, versionId)
  if (versionError) return versionError
  if (!UUID_REGEX.test(id)) {
    return NextResponse.json({ error: 'Ungültige ID' }, { status: 400 })
  }

  const { error: dbErr } = await supabase
    .from('langfristige_bestellungen')
    .delete()
    .eq('user_id', user!.id)
    .eq('plan_version_id', versionId)
    .eq('id', id)

  if (dbErr) return NextResponse.json({ error: dbErr.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
