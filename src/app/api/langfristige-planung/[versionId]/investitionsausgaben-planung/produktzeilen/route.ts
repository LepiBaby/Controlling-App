import { NextResponse } from 'next/server'
import { z } from 'zod'
import { requireAuth } from '@/lib/supabase-server'
import { ensureLangfristigeVersion } from '@/lib/langfristige-version'
import { fetchAllRows } from '@/lib/supabase-paginate'

// Auth-geschützte, pro-Planversion dynamische Route — nie statisch generieren.
export const dynamic = 'force-dynamic'

// PROJ-105: Manuell hinzugefügte Produktzeilen je Investitions-Untergruppe der
// Langfristigen Planung. Standardmäßig zeigt die Investitionsausgaben-Planung nur
// als Investition markierte Produkte (kpi_kategorien.ist_investition); hierüber
// kann der Nutzer je Untergruppe zusätzliche Produkte als Zeile ergänzen.
// GET liefert alle Zeilen der Version, PUT fügt eine (kategorie_id, produkt_id)
// hinzu (idempotent), DELETE entfernt eine. Nutzer- und versionsgebunden.

const SELECT_COLS = 'kategorie_id, produkt_id'
const ONCONFLICT = 'plan_version_id,kategorie_id,produkt_id'

const bodySchema = z.object({
  kategorie_id: z.string().uuid(),
  produkt_id: z.string().uuid(),
})

interface RouteContext {
  params: Promise<{ versionId: string }>
}

export async function GET(_request: Request, { params }: RouteContext) {
  const { user, supabase, error } = await requireAuth()
  if (error) return error

  const { versionId } = await params
  const versionError = await ensureLangfristigeVersion(supabase, user!.id, versionId)
  if (versionError) return versionError

  const { data, error: dbErr } = await fetchAllRows((from, to) =>
    supabase
      .from('langfristige_investitionsausgaben_produktzeilen')
      .select(SELECT_COLS)
      .eq('user_id', user!.id)
      .eq('plan_version_id', versionId)
      .order('id', { ascending: true })
      .range(from, to),
  )

  if (dbErr) return NextResponse.json({ error: dbErr.message }, { status: 500 })
  return NextResponse.json(data ?? [])
}

export async function PUT(request: Request, { params }: RouteContext) {
  const { user, supabase, error } = await requireAuth()
  if (error) return error

  const { versionId } = await params

  const body = await request.json().catch(() => null)
  const parsed = bodySchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })
  }

  const versionError = await ensureLangfristigeVersion(supabase, user!.id, versionId)
  if (versionError) return versionError

  const { kategorie_id, produkt_id } = parsed.data

  const { data, error: dbErr } = await supabase
    .from('langfristige_investitionsausgaben_produktzeilen')
    .upsert(
      { user_id: user!.id, plan_version_id: versionId, kategorie_id, produkt_id },
      { onConflict: ONCONFLICT, ignoreDuplicates: true },
    )
    .select(SELECT_COLS)
    .maybeSingle()

  if (dbErr) return NextResponse.json({ error: dbErr.message }, { status: 500 })
  return NextResponse.json(data ?? { kategorie_id, produkt_id })
}

export async function DELETE(request: Request, { params }: RouteContext) {
  const { user, supabase, error } = await requireAuth()
  if (error) return error

  const { versionId } = await params

  const body = await request.json().catch(() => null)
  const parsed = bodySchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })
  }

  const versionError = await ensureLangfristigeVersion(supabase, user!.id, versionId)
  if (versionError) return versionError

  const { kategorie_id, produkt_id } = parsed.data

  const { error: dbErr } = await supabase
    .from('langfristige_investitionsausgaben_produktzeilen')
    .delete()
    .eq('user_id', user!.id)
    .eq('plan_version_id', versionId)
    .eq('kategorie_id', kategorie_id)
    .eq('produkt_id', produkt_id)

  if (dbErr) return NextResponse.json({ error: dbErr.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
