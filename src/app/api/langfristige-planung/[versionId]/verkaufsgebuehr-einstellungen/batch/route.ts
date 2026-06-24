import { NextResponse } from 'next/server'
import { z } from 'zod'
import { requireAuth } from '@/lib/supabase-server'

// Auth-geschützte, pro-Planversion dynamische Route — nie statisch generieren.
// Überspringt den in Next 16 instabilen Static-Path-Pass (Worker-Crash).
export const dynamic = 'force-dynamic'

// PROJ-79: „Alle Produkte gleichsetzen" für eine Plattform einer Planversion.
// Setzt denselben Verkaufsgebühr-Wert für alle Produkte (lp_produkt, Ebene 1)
// der Version. Nutzer- und versionsgebunden (Defense-in-Depth zur RLS).

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

const SELECT_COLS = 'id, sales_plattform_id, produkt_id, verkaufsgebuehr_prozent'

const putSchema = z.object({
  sales_plattform_id: z.string().uuid(),
  verkaufsgebuehr_prozent: z.number().min(0).nullable(),
})

interface RouteContext {
  params: Promise<{ versionId: string }>
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

export async function PUT(request: Request, { params }: RouteContext) {
  const { user, supabase, error } = await requireAuth()
  if (error) return error

  const { versionId } = await params

  const body = await request.json().catch(() => null)
  const parsed = putSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })
  }

  const versionError = await ensureVersion(supabase, user!.id, versionId)
  if (versionError) return versionError

  const { sales_plattform_id, verkaufsgebuehr_prozent } = parsed.data

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

  // Alle Produkte (Ebene 1) dieser Version laden.
  const { data: produkte, error: produkteErr } = await supabase
    .from('langfristige_kpi_kategorien')
    .select('id')
    .eq('user_id', user!.id)
    .eq('plan_version_id', versionId)
    .eq('art', 'lp_produkt')
    .eq('level', 1)
    .limit(1000)

  if (produkteErr) return NextResponse.json({ error: produkteErr.message }, { status: 500 })
  if (!produkte || produkte.length === 0) {
    return NextResponse.json([], { status: 200 })
  }

  const rows = produkte.map(p => ({
    user_id: user!.id,
    plan_version_id: versionId,
    sales_plattform_id,
    produkt_id: p.id,
    verkaufsgebuehr_prozent: verkaufsgebuehr_prozent ?? null,
    updated_at: new Date().toISOString(),
  }))

  const { data, error: dbErr } = await supabase
    .from('langfristige_verkaufsgebuehr_einstellungen')
    .upsert(rows, { onConflict: 'plan_version_id,sales_plattform_id,produkt_id,user_id' })
    .select(SELECT_COLS)

  if (dbErr) return NextResponse.json({ error: dbErr.message }, { status: 500 })
  return NextResponse.json(data ?? [])
}
