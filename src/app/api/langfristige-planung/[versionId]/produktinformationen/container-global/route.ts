import { NextResponse } from 'next/server'
import { z } from 'zod'
import { requireAuth } from '@/lib/supabase-server'
import { ensureLangfristigeVersion } from '@/lib/langfristige-version'

// Auth-geschützte, pro-Planversion dynamische Route — nie statisch generieren.
// Überspringt den in Next 16 instabilen Static-Path-Pass (Worker-Crash).
export const dynamic = 'force-dynamic'

// PROJ-77: Container-Maximalvolumen (global pro Planversion).

const TABLE = 'langfristige_produktinformationen_container_global'
const COLS = 'id, volumen_20dc, volumen_40hq'

const UpsertSchema = z.object({
  volumen_20dc: z.number().positive().nullable().optional(),
  volumen_40hq: z.number().positive().nullable().optional(),
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

  const { data, error: dbErr } = await supabase
    .from(TABLE)
    .select(COLS)
    .eq('user_id', user!.id)
    .eq('plan_version_id', versionId)
    .maybeSingle()

  if (dbErr) return NextResponse.json({ error: dbErr.message }, { status: 500 })

  return NextResponse.json(data ?? null)
}

export async function PUT(request: Request, { params }: RouteContext) {
  const { user, supabase, error } = await requireAuth()
  if (error) return error

  const { versionId } = await params
  const versionError = await ensureLangfristigeVersion(supabase, user!.id, versionId)
  if (versionError) return versionError

  const body = await request.json().catch(() => null)
  const parsed = UpsertSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })
  }

  const { data, error: dbErr } = await supabase
    .from(TABLE)
    .upsert(
      {
        user_id: user!.id,
        plan_version_id: versionId,
        volumen_20dc: parsed.data.volumen_20dc ?? null,
        volumen_40hq: parsed.data.volumen_40hq ?? null,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'plan_version_id' }
    )
    .select(COLS)
    .single()

  if (dbErr || !data) {
    return NextResponse.json({ error: dbErr?.message ?? 'Upsert fehlgeschlagen' }, { status: 500 })
  }

  return NextResponse.json(data)
}
