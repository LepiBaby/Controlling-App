import { NextResponse } from 'next/server'
import { z } from 'zod'
import { requireAuth } from '@/lib/supabase-server'

// Auth-geschützte, pro-Planversion dynamische Route — nie statisch generieren.
// Überspringt den in Next 16 instabilen Static-Path-Pass (Worker-Crash).
export const dynamic = 'force-dynamic'

// PROJ-79: Versionsgebundene Verkaufsgebühr-Einstellungen (Langfristige Planung).
// GET liefert alle gepflegten Produkt-Werte einer Plattform in dieser Version,
// PUT macht einen Upsert eines einzelnen Plattform-Produkt-Werts. Alle Zugriffe
// sind nutzer- und versionsgebunden (Defense-in-Depth zur RLS).

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

const SELECT_COLS = 'id, sales_plattform_id, produkt_id, verkaufsgebuehr_prozent'

const putSchema = z.object({
  sales_plattform_id: z.string().uuid(),
  produkt_id: z.string().uuid(),
  verkaufsgebuehr_prozent: z.number().min(0).nullable().optional(),
})

interface RouteContext {
  params: Promise<{ versionId: string }>
}

// Prüft, dass die Planversion existiert UND dem eingeloggten Nutzer gehört.
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

// Prüft, dass eine Kategorie zur Version & erwarteten Art gehört.
async function gehoertZurVersion(
  supabase: Awaited<ReturnType<typeof requireAuth>>['supabase'],
  userId: string,
  versionId: string,
  kategorieId: string,
  art: 'lp_sales_plattform' | 'lp_produkt',
): Promise<boolean> {
  const { data } = await supabase
    .from('langfristige_kpi_kategorien')
    .select('id')
    .eq('user_id', userId)
    .eq('plan_version_id', versionId)
    .eq('art', art)
    .eq('id', kategorieId)
    .maybeSingle()
  return !!data
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

  const { data, error: dbErr } = await supabase
    .from('langfristige_verkaufsgebuehr_einstellungen')
    .select(SELECT_COLS)
    .eq('user_id', user!.id)
    .eq('plan_version_id', versionId)
    .eq('sales_plattform_id', plattformId)
    .limit(1000)

  if (dbErr) return NextResponse.json({ error: dbErr.message }, { status: 500 })
  return NextResponse.json(data ?? [])
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

  const { sales_plattform_id, produkt_id, verkaufsgebuehr_prozent = null } = parsed.data

  // Plattform & Produkt müssen zur Version und korrekten Art gehören.
  const plattformOk = await gehoertZurVersion(
    supabase, user!.id, versionId, sales_plattform_id, 'lp_sales_plattform',
  )
  if (!plattformOk) {
    return NextResponse.json({ error: 'Sales Plattform gehört nicht zu dieser Version.' }, { status: 400 })
  }
  const produktOk = await gehoertZurVersion(
    supabase, user!.id, versionId, produkt_id, 'lp_produkt',
  )
  if (!produktOk) {
    return NextResponse.json({ error: 'Produkt gehört nicht zu dieser Version.' }, { status: 400 })
  }

  const { data, error: dbErr } = await supabase
    .from('langfristige_verkaufsgebuehr_einstellungen')
    .upsert(
      {
        user_id: user!.id,
        plan_version_id: versionId,
        sales_plattform_id,
        produkt_id,
        verkaufsgebuehr_prozent: verkaufsgebuehr_prozent ?? null,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'plan_version_id,sales_plattform_id,produkt_id,user_id' },
    )
    .select(SELECT_COLS)
    .single()

  if (dbErr || !data) {
    return NextResponse.json({ error: dbErr?.message ?? 'Upsert fehlgeschlagen' }, { status: 500 })
  }

  return NextResponse.json(data)
}
