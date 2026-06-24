import { NextResponse } from 'next/server'
import { z } from 'zod'
import { requireAuth } from '@/lib/supabase-server'
import { ensureLangfristigeVersion } from '@/lib/langfristige-version'

// Auth-geschützte, pro-Planversion dynamische Route — nie statisch generieren.
// Überspringt den in Next 16 instabilen Static-Path-Pass (Worker-Crash).
export const dynamic = 'force-dynamic'

// PROJ-83: "Gesamt/Aufgeteilt"-Auswahl je (globaler) Oberkategorie, pro Planversion.

const TABLE = 'langfristige_ust_ebene_auswahl'

const postSchema = z.array(
  z.object({
    kategorie_id: z.string().uuid(),
    ebene: z.union([z.literal(1), z.literal(2)]),
  })
).min(1).max(500)

interface RouteContext {
  params: Promise<{ versionId: string }>
}

export async function GET(_request: Request, { params }: RouteContext) {
  const { user, supabase, error } = await requireAuth()
  if (error) return error

  const { versionId } = await params
  const versionError = await ensureLangfristigeVersion(supabase, user!.id, versionId)
  if (versionError) return versionError

  const { data, error: dbErr } = await supabase
    .from(TABLE)
    .select('kategorie_id, ebene')
    .eq('user_id', user!.id)
    .eq('plan_version_id', versionId)
    .limit(500)

  if (dbErr) return NextResponse.json({ error: dbErr.message }, { status: 500 })

  const result: Record<string, 1 | 2> = {}
  for (const row of (data ?? [])) {
    result[row.kategorie_id] = row.ebene as 1 | 2
  }
  return NextResponse.json(result)
}

export async function POST(request: Request, { params }: RouteContext) {
  const { user, supabase, error } = await requireAuth()
  if (error) return error

  const { versionId } = await params
  const versionError = await ensureLangfristigeVersion(supabase, user!.id, versionId)
  if (versionError) return versionError

  const body = await request.json().catch(() => null)
  const parsed = postSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })
  }

  const rows = parsed.data.map(item => ({
    user_id: user!.id,
    plan_version_id: versionId,
    kategorie_id: item.kategorie_id,
    ebene: item.ebene,
    updated_at: new Date().toISOString(),
  }))

  const { error: dbErr } = await supabase
    .from(TABLE)
    .upsert(rows, { onConflict: 'plan_version_id,kategorie_id' })

  if (dbErr) return NextResponse.json({ error: dbErr.message }, { status: 500 })

  return NextResponse.json({ ok: true })
}
