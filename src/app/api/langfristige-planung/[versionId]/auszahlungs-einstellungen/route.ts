import { NextResponse } from 'next/server'
import { z } from 'zod'
import { requireAuth } from '@/lib/supabase-server'

// Auth-geschützte, pro-Planversion dynamische Route — nie statisch generieren.
// Überspringt den in Next 16 instabilen Static-Path-Pass (Worker-Crash).
export const dynamic = 'force-dynamic'

// PROJ-76: Versionsgebundene Auszahlungseinstellungen (Langfristige Planung).
// GET liefert die Einstellung einer Plattform inkl. zugeordneter Marketingkanäle,
// PUT macht einen Upsert der Skalarfelder und gleicht die Marketingkanal-
// Zuordnungen ab. Alle Zugriffe sind nutzer- und versionsgebunden.

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

const EINSTELLUNG_COLS =
  'sales_plattform_id, auszahlungsrhythmus, erster_auszahlung_monat, erster_auszahlung_jahr, verschiebung_monate'

const RHYTHMUS_VALUES = ['monatlich', 'alle_zwei_monate', 'quartalsweise'] as const

const putSchema = z
  .object({
    sales_plattform_id: z.string().uuid(),
    auszahlungsrhythmus: z.enum(RHYTHMUS_VALUES).default('monatlich'),
    erster_auszahlung_monat: z.number().int().min(1).max(12).nullable().default(null),
    erster_auszahlung_jahr: z.number().int().min(2000).max(2100).nullable().default(null),
    verschiebung_monate: z.number().int().min(0).max(60).default(0),
    marketingkanal_ids: z.array(z.string().uuid()).default([]),
  })
  .superRefine((data, ctx) => {
    const monatSet = data.erster_auszahlung_monat !== null
    const jahrSet = data.erster_auszahlung_jahr !== null
    if (monatSet !== jahrSet) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'erster_auszahlung_monat und erster_auszahlung_jahr müssen gemeinsam gesetzt oder beide null sein.',
        path: ['erster_auszahlung_monat'],
      })
    }
  })

interface RouteContext {
  params: Promise<{ versionId: string }>
}

// Prüft, dass die Planversion existiert UND dem eingeloggten Nutzer gehört.
// Liefert eine fertige Fehler-Response oder null (= ok).
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

export async function GET(request: Request, { params }: RouteContext) {
  const { user, supabase, error } = await requireAuth()
  if (error) return error

  const { versionId } = await params
  const versionError = await ensureVersion(supabase, user!.id, versionId)
  if (versionError) return versionError

  const { searchParams } = new URL(request.url)
  const plattformId = searchParams.get('plattform_id')
  if (!plattformId) {
    return NextResponse.json({ error: 'plattform_id ist erforderlich' }, { status: 400 })
  }
  if (!UUID_REGEX.test(plattformId)) {
    return NextResponse.json({ error: 'Ungültige plattform_id' }, { status: 400 })
  }

  const { data: einstellung, error: dbErr } = await supabase
    .from('langfristige_auszahlungs_einstellungen')
    .select(EINSTELLUNG_COLS)
    .eq('user_id', user!.id)
    .eq('plan_version_id', versionId)
    .eq('sales_plattform_id', plattformId)
    .maybeSingle()

  if (dbErr) return NextResponse.json({ error: dbErr.message }, { status: 500 })

  const { data: kanaele, error: kErr } = await supabase
    .from('langfristige_auszahlungs_marketingkanaele')
    .select('marketingkanal_id')
    .eq('user_id', user!.id)
    .eq('plan_version_id', versionId)
    .eq('sales_plattform_id', plattformId)
    .limit(1000)

  if (kErr) return NextResponse.json({ error: kErr.message }, { status: 500 })

  const marketingkanal_ids = (kanaele ?? []).map(k => k.marketingkanal_id)

  // Noch kein Eintrag und keine Kanäle: null (Frontend zeigt Standardwerte).
  if (!einstellung && marketingkanal_ids.length === 0) {
    return NextResponse.json(null)
  }

  return NextResponse.json({
    sales_plattform_id: plattformId,
    auszahlungsrhythmus: einstellung?.auszahlungsrhythmus ?? 'monatlich',
    erster_auszahlung_monat: einstellung?.erster_auszahlung_monat ?? null,
    erster_auszahlung_jahr: einstellung?.erster_auszahlung_jahr ?? null,
    verschiebung_monate: einstellung?.verschiebung_monate ?? 0,
    marketingkanal_ids,
  })
}

export async function PUT(request: Request, { params }: RouteContext) {
  const { user, supabase, error } = await requireAuth()
  if (error) return error

  const { versionId } = await params

  // Eingaben zuerst validieren (günstiger als ein DB-Roundtrip), danach Eigentum.
  const body = await request.json().catch(() => null)
  const parsed = putSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })
  }

  const versionError = await ensureVersion(supabase, user!.id, versionId)
  if (versionError) return versionError

  const {
    sales_plattform_id,
    auszahlungsrhythmus,
    erster_auszahlung_monat,
    erster_auszahlung_jahr,
    verschiebung_monate,
    marketingkanal_ids,
  } = parsed.data

  // Plattform muss zur Version & Art lp_sales_plattform gehören.
  const { data: plattform, error: pErr } = await supabase
    .from('langfristige_kpi_kategorien')
    .select('id')
    .eq('user_id', user!.id)
    .eq('plan_version_id', versionId)
    .eq('art', 'lp_sales_plattform')
    .eq('id', sales_plattform_id)
    .maybeSingle()
  if (pErr) return NextResponse.json({ error: pErr.message }, { status: 500 })
  if (!plattform) {
    return NextResponse.json({ error: 'Sales Plattform gehört nicht zu dieser Version.' }, { status: 400 })
  }

  // Alle gewählten Marketingkanäle müssen zur Version & Art lp_marketingkanal gehören.
  const uniqueKanalIds = [...new Set(marketingkanal_ids)]
  if (uniqueKanalIds.length > 0) {
    const { data: gueltige, error: mErr } = await supabase
      .from('langfristige_kpi_kategorien')
      .select('id')
      .eq('user_id', user!.id)
      .eq('plan_version_id', versionId)
      .eq('art', 'lp_marketingkanal')
      .in('id', uniqueKanalIds)
      .limit(1000)
    if (mErr) return NextResponse.json({ error: mErr.message }, { status: 500 })
    if ((gueltige?.length ?? 0) !== uniqueKanalIds.length) {
      return NextResponse.json(
        { error: 'Mindestens ein Marketingkanal gehört nicht zu dieser Version.' },
        { status: 400 },
      )
    }
  }

  // Skalarfelder upserten.
  const { data: einstellung, error: dbErr } = await supabase
    .from('langfristige_auszahlungs_einstellungen')
    .upsert(
      {
        user_id: user!.id,
        plan_version_id: versionId,
        sales_plattform_id,
        auszahlungsrhythmus,
        erster_auszahlung_monat,
        erster_auszahlung_jahr,
        verschiebung_monate,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'plan_version_id,sales_plattform_id,user_id' },
    )
    .select(EINSTELLUNG_COLS)
    .single()

  if (dbErr || !einstellung) {
    return NextResponse.json({ error: dbErr?.message ?? 'Upsert fehlgeschlagen' }, { status: 500 })
  }

  // Marketingkanäle abgleichen: zunächst alle für diese Plattform löschen, dann neu setzen.
  const { error: delErr } = await supabase
    .from('langfristige_auszahlungs_marketingkanaele')
    .delete()
    .eq('user_id', user!.id)
    .eq('plan_version_id', versionId)
    .eq('sales_plattform_id', sales_plattform_id)
  if (delErr) return NextResponse.json({ error: delErr.message }, { status: 500 })

  if (uniqueKanalIds.length > 0) {
    const rows = uniqueKanalIds.map(kanalId => ({
      user_id: user!.id,
      plan_version_id: versionId,
      sales_plattform_id,
      marketingkanal_id: kanalId,
    }))
    const { error: insErr } = await supabase
      .from('langfristige_auszahlungs_marketingkanaele')
      .insert(rows)
    if (insErr) return NextResponse.json({ error: insErr.message }, { status: 500 })
  }

  return NextResponse.json({
    sales_plattform_id: einstellung.sales_plattform_id,
    auszahlungsrhythmus: einstellung.auszahlungsrhythmus,
    erster_auszahlung_monat: einstellung.erster_auszahlung_monat,
    erster_auszahlung_jahr: einstellung.erster_auszahlung_jahr,
    verschiebung_monate: einstellung.verschiebung_monate,
    marketingkanal_ids: uniqueKanalIds,
  })
}
