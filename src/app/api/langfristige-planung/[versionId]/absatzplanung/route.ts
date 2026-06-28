import { NextResponse } from 'next/server'
import { z } from 'zod'
import { requireAuth } from '@/lib/supabase-server'
import { ensureLangfristigeVersion } from '@/lib/langfristige-version'
import { fetchAllRows } from '@/lib/supabase-paginate'

// Auth-geschützte, pro-Planversion dynamische Route — nie statisch generieren.
// Überspringt den in Next 16 instabilen Static-Path-Pass (Worker-Crash).
export const dynamic = 'force-dynamic'

// PROJ-84: Versionsgebundene Absatzplanung — Absatz-/VK-Werte je Zellkoordinate.
// Keine historische Vorbelegung; alle Werte werden manuell gepflegt.

const SELECT_COLS = 'sales_plattform_id, produkt_id, jahr, monat, absatz, effektiver_vk'

// Eine einzelne Zelle (Plattform × Produkt × Monat).
const cellSchema = z.object({
  sales_plattform_id: z.string().uuid(),
  produkt_id: z.string().uuid(),
  jahr: z.number().int().min(2000).max(2100),
  monat: z.number().int().min(1).max(12),
  absatz: z.number().min(0).nullable().optional(),
  effektiver_vk: z.number().min(0).nullable().optional(),
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
      .from('langfristige_absatz_planung')
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
    sales_plattform_id: c.sales_plattform_id,
    produkt_id: c.produkt_id,
    jahr: c.jahr,
    monat: c.monat,
    absatz: c.absatz ?? null,
    effektiver_vk: c.effektiver_vk ?? null,
    updated_at: new Date().toISOString(),
  }))

  const { data, error: dbErr } = await supabase
    .from('langfristige_absatz_planung')
    .upsert(rows, { onConflict: 'plan_version_id,sales_plattform_id,produkt_id,jahr,monat' })
    .select(SELECT_COLS)

  if (dbErr) return NextResponse.json({ error: dbErr.message }, { status: 500 })
  return NextResponse.json(data ?? [])
}
