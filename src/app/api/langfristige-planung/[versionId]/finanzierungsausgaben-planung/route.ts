import { NextResponse } from 'next/server'
import { z } from 'zod'
import { requireAuth } from '@/lib/supabase-server'
import { ensureLangfristigeVersion } from '@/lib/langfristige-version'
import { fetchAllRows } from '@/lib/supabase-paginate'

// Auth-geschützte, pro-Planversion dynamische Route — nie statisch generieren.
// Überspringt den in Next 16 instabilen Static-Path-Pass (Worker-Crash).
export const dynamic = 'force-dynamic'

// PROJ-90: Versionsgebundene Finanzierungsausgaben-Planung — Betrag je Zellkoordinate
// (globale Finanzierung-Leaf-Kategorie × Monat). Keine historische Vorbelegung; alle
// Werte werden manuell gepflegt. Die Kategoriestruktur stammt aus dem globalen
// KPI-Modell, die Werte sind pro Planversion + Nutzer isoliert. Direkte Spiegelung
// der Operativekosten-Planung-Route (PROJ-88), nur mit anderer Zieltabelle.

const SELECT_COLS = 'kategorie_id, jahr, monat, betrag'

// Eine einzelne Zelle (Kategorie × Monat).
const cellSchema = z.object({
  kategorie_id: z.string().uuid(),
  jahr: z.number().int().min(2000).max(2100),
  monat: z.number().int().min(1).max(12),
  betrag: z.number().min(0).nullable().optional(),
})

// PUT akzeptiert eine Einzelzelle ODER ein Bündel { cells: [...] } (Massen-Anpassung).
const putSchema = z.union([
  cellSchema,
  z.object({ cells: z.array(cellSchema).min(1).max(2000) }),
])

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
      .from('langfristige_finanzierungsausgaben_planung')
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
  const versionError = await ensureLangfristigeVersion(supabase, user!.id, versionId)
  if (versionError) return versionError

  const body = await request.json().catch(() => null)
  const parsed = putSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })
  }

  const cells = 'cells' in parsed.data ? parsed.data.cells : [parsed.data]

  const rows = cells.map(c => ({
    user_id: user!.id,
    plan_version_id: versionId,
    kategorie_id: c.kategorie_id,
    jahr: c.jahr,
    monat: c.monat,
    betrag: c.betrag ?? null,
    updated_at: new Date().toISOString(),
  }))

  const { data, error: dbErr } = await supabase
    .from('langfristige_finanzierungsausgaben_planung')
    .upsert(rows, { onConflict: 'plan_version_id,kategorie_id,jahr,monat' })
    .select(SELECT_COLS)

  if (dbErr) return NextResponse.json({ error: dbErr.message }, { status: 500 })
  return NextResponse.json(data ?? [])
}
