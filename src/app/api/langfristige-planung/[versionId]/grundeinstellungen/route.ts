import { NextResponse } from 'next/server'
import { z } from 'zod'
import { requireAuth } from '@/lib/supabase-server'

// Auth-geschützte, pro-Planversion dynamische Route — nie statisch generieren.
// Überspringt den in Next 16 instabilen Static-Path-Pass (Worker-Crash).
export const dynamic = 'force-dynamic'

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

const DEFAULT_PLANUNGSHORIZONT_MONATE = 12

const SELECT_COLS =
  'startmonat_monat, startmonat_jahr, startkontostand, planungshorizont_monate, planungshorizont_absatz_monate'

const putSchema = z
  .object({
    startmonat_monat: z.number().int().min(1).max(12).optional(),
    startmonat_jahr: z.number().int().min(2000).max(2100).optional(),
    startkontostand: z.number().finite().optional(),
    planungshorizont_monate: z.number().int().min(1).max(120).optional(),
    planungshorizont_absatz_monate: z.number().int().min(1).max(120).nullable().optional(),
  })
  .refine(
    d =>
      d.startmonat_monat !== undefined ||
      d.startmonat_jahr !== undefined ||
      d.startkontostand !== undefined ||
      d.planungshorizont_monate !== undefined ||
      d.planungshorizont_absatz_monate !== undefined,
    { message: 'Mindestens ein Feld erforderlich' },
  )

interface RouteContext {
  params: Promise<{ versionId: string }>
}

function currentMonthDefaults() {
  const now = new Date()
  return { monat: now.getMonth() + 1, jahr: now.getFullYear() }
}

export async function GET(_request: Request, { params }: RouteContext) {
  const { user, supabase, error } = await requireAuth()
  if (error) return error

  const { versionId } = await params
  if (!UUID_REGEX.test(versionId)) {
    return NextResponse.json({ error: 'Ungültige ID' }, { status: 400 })
  }

  // Versionszugehörigkeit prüfen (Defense-in-Depth zur RLS)
  const { data: version, error: versionErr } = await supabase
    .from('langfristige_planversionen')
    .select('id')
    .eq('user_id', user!.id)
    .eq('id', versionId)
    .maybeSingle()

  if (versionErr) return NextResponse.json({ error: versionErr.message }, { status: 500 })
  if (!version) return NextResponse.json({ error: 'Planversion nicht gefunden' }, { status: 404 })

  const { data, error: dbErr } = await supabase
    .from('langfristige_grundeinstellungen')
    .select(SELECT_COLS)
    .eq('user_id', user!.id)
    .eq('plan_version_id', versionId)
    .maybeSingle()

  if (dbErr) return NextResponse.json({ error: dbErr.message }, { status: 500 })

  if (!data) {
    const { monat, jahr } = currentMonthDefaults()
    return NextResponse.json({
      startmonat_monat: monat,
      startmonat_jahr: jahr,
      startkontostand: 0,
      planungshorizont_monate: DEFAULT_PLANUNGSHORIZONT_MONATE,
      planungshorizont_absatz_monate: null,
    })
  }

  return NextResponse.json(data)
}

export async function PUT(request: Request, { params }: RouteContext) {
  const { user, supabase, error } = await requireAuth()
  if (error) return error

  const { versionId } = await params
  if (!UUID_REGEX.test(versionId)) {
    return NextResponse.json({ error: 'Ungültige ID' }, { status: 400 })
  }

  const body = await request.json().catch(() => null)
  const parsed = putSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })
  }

  // Versionszugehörigkeit prüfen (Defense-in-Depth zur RLS)
  const { data: version, error: versionErr } = await supabase
    .from('langfristige_planversionen')
    .select('id')
    .eq('user_id', user!.id)
    .eq('id', versionId)
    .maybeSingle()

  if (versionErr) return NextResponse.json({ error: versionErr.message }, { status: 500 })
  if (!version) return NextResponse.json({ error: 'Planversion nicht gefunden' }, { status: 404 })

  // Bestehenden Eintrag laden, damit Teilmengen-Updates die Pflichtfelder nicht
  // verlieren; existiert noch keiner, gelten die Standardwerte als Basis.
  const { data: existing, error: existingErr } = await supabase
    .from('langfristige_grundeinstellungen')
    .select(SELECT_COLS)
    .eq('user_id', user!.id)
    .eq('plan_version_id', versionId)
    .maybeSingle()

  if (existingErr) return NextResponse.json({ error: existingErr.message }, { status: 500 })

  const defaults = currentMonthDefaults()
  const base = existing ?? {
    startmonat_monat: defaults.monat,
    startmonat_jahr: defaults.jahr,
    startkontostand: 0,
    planungshorizont_monate: DEFAULT_PLANUNGSHORIZONT_MONATE,
    planungshorizont_absatz_monate: null,
  }

  const merged = {
    user_id: user!.id,
    plan_version_id: versionId,
    startmonat_monat: parsed.data.startmonat_monat ?? base.startmonat_monat,
    startmonat_jahr: parsed.data.startmonat_jahr ?? base.startmonat_jahr,
    startkontostand: parsed.data.startkontostand ?? base.startkontostand,
    planungshorizont_monate: parsed.data.planungshorizont_monate ?? base.planungshorizont_monate,
    planungshorizont_absatz_monate:
      parsed.data.planungshorizont_absatz_monate !== undefined
        ? parsed.data.planungshorizont_absatz_monate
        : base.planungshorizont_absatz_monate,
    updated_at: new Date().toISOString(),
  }

  const { data, error: dbErr } = await supabase
    .from('langfristige_grundeinstellungen')
    .upsert(merged, { onConflict: 'plan_version_id' })
    .select(SELECT_COLS)
    .single()

  if (dbErr || !data) {
    return NextResponse.json({ error: dbErr?.message ?? 'Upsert fehlgeschlagen' }, { status: 500 })
  }

  return NextResponse.json(data)
}
