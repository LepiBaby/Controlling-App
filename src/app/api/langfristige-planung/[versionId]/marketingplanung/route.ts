import { NextResponse } from 'next/server'
import { z } from 'zod'
import { requireAuth } from '@/lib/supabase-server'
import { ensureLangfristigeVersion } from '@/lib/langfristige-version'
import { fetchAllRows } from '@/lib/supabase-paginate'

// Auth-geschützte, pro-Planversion dynamische Route — nie statisch generieren.
// Überspringt den in Next 16 instabilen Static-Path-Pass (Worker-Crash).
export const dynamic = 'force-dynamic'

// PROJ-85: Versionsgebundene Marketing-Planung — Marketingkosten-%-Werte je
// Zellkoordinate (Marketingkanal × Produkt × Monat). Keine historische
// Vorbelegung; alle Werte werden manuell gepflegt. Absatz/VK/Budget werden NICHT
// gespeichert (immer abgeleitet).

const SELECT_COLS = 'marketingkanal_id, produkt_id, jahr, monat, marketingkosten_pct'

// Eine einzelne Zelle (Marketingkanal × Produkt × Monat).
const cellSchema = z.object({
  marketingkanal_id: z.string().uuid(),
  produkt_id: z.string().uuid(),
  jahr: z.number().int().min(2000).max(2100),
  monat: z.number().int().min(1).max(12),
  marketingkosten_pct: z.number().min(0).max(100).nullable().optional(),
})

// PUT akzeptiert eine Einzelzelle ODER ein Bündel { cells: [...] } (Massen-Anpassung).
const putSchema = z.union([
  cellSchema,
  z.object({ cells: z.array(cellSchema).min(1).max(2000) }),
])

interface RouteContext {
  params: Promise<{ versionId: string }>
}

// Prüft, dass alle referenzierten IDs zur Version & korrekten Art gehören.
// Eine Abfrage je Art (unabhängig von der Zellanzahl). Liefert eine Fehler-Response
// oder null (= ok).
async function ensureKategorien(
  supabase: Awaited<ReturnType<typeof requireAuth>>['supabase'],
  userId: string,
  versionId: string,
  art: string,
  ids: string[],
  bezeichnung: string,
): Promise<Response | null> {
  if (ids.length === 0) return null
  const { data, error } = await supabase
    .from('langfristige_kpi_kategorien')
    .select('id')
    .eq('user_id', userId)
    .eq('plan_version_id', versionId)
    .eq('art', art)
    .in('id', ids)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  const gefunden = new Set((data ?? []).map((r: { id: string }) => r.id))
  if (gefunden.size !== ids.length) {
    return NextResponse.json(
      { error: `${bezeichnung} gehört nicht zu dieser Version.` },
      { status: 400 },
    )
  }
  return null
}

export async function GET(_request: Request, { params }: RouteContext) {
  const { user, supabase, error } = await requireAuth()
  if (error) return error

  const { versionId } = await params
  const versionError = await ensureLangfristigeVersion(supabase, user!.id, versionId)
  if (versionError) return versionError

  const { data, error: dbErr } = await fetchAllRows((from, to) =>
    supabase
      .from('langfristige_marketing_planung')
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

  // Referenzierte Kanäle/Produkte müssen zur Version & korrekten Art gehören.
  const kanalIds = [...new Set(cells.map(c => c.marketingkanal_id))]
  const produktIds = [...new Set(cells.map(c => c.produkt_id))]

  const kanalError = await ensureKategorien(
    supabase, user!.id, versionId, 'lp_marketingkanal', kanalIds, 'Marketingkanal',
  )
  if (kanalError) return kanalError

  const produktError = await ensureKategorien(
    supabase, user!.id, versionId, 'lp_produkt', produktIds, 'Produkt',
  )
  if (produktError) return produktError

  const rows = cells.map(c => ({
    user_id: user!.id,
    plan_version_id: versionId,
    marketingkanal_id: c.marketingkanal_id,
    produkt_id: c.produkt_id,
    jahr: c.jahr,
    monat: c.monat,
    marketingkosten_pct: c.marketingkosten_pct ?? null,
    updated_at: new Date().toISOString(),
  }))

  const { data, error: dbErr } = await supabase
    .from('langfristige_marketing_planung')
    .upsert(rows, { onConflict: 'plan_version_id,marketingkanal_id,produkt_id,jahr,monat' })
    .select(SELECT_COLS)

  if (dbErr) return NextResponse.json({ error: dbErr.message }, { status: 500 })
  return NextResponse.json(data ?? [])
}
