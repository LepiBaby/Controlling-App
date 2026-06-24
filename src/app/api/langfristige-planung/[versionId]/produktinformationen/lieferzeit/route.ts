import { NextResponse } from 'next/server'
import { z } from 'zod'
import { requireAuth } from '@/lib/supabase-server'
import { ensureLangfristigeVersion } from '@/lib/langfristige-version'

// Auth-geschützte, pro-Planversion dynamische Route — nie statisch generieren.
// Überspringt den in Next 16 instabilen Static-Path-Pass (Worker-Crash).
export const dynamic = 'force-dynamic'

// PROJ-77: Lieferzeiten je Produkt (versionsgebunden).

const TABLE = 'langfristige_produktinformationen_lieferzeit'
const COLS =
  'id, produkt_id, pufferzeit_tage, produktionszeit_tage, zwischenzeit_tage, shipping_zeit_tage, entladungszeit_tage'

const UpsertSchema = z.object({
  produkt_id: z.string().uuid(),
  pufferzeit_tage: z.number().int().min(0).nullable().optional(),
  produktionszeit_tage: z.number().int().min(0).nullable().optional(),
  zwischenzeit_tage: z.number().int().min(0).nullable().optional(),
  shipping_zeit_tage: z.number().int().min(0).nullable().optional(),
  entladungszeit_tage: z.number().int().min(0).nullable().optional(),
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
    .limit(500)

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
        produkt_id: parsed.data.produkt_id,
        pufferzeit_tage: parsed.data.pufferzeit_tage ?? null,
        produktionszeit_tage: parsed.data.produktionszeit_tage ?? null,
        zwischenzeit_tage: parsed.data.zwischenzeit_tage ?? null,
        shipping_zeit_tage: parsed.data.shipping_zeit_tage ?? null,
        entladungszeit_tage: parsed.data.entladungszeit_tage ?? null,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'plan_version_id,produkt_id' }
    )
    .select(COLS)
    .single()

  if (dbErr || !data) {
    return NextResponse.json({ error: dbErr?.message ?? 'Upsert fehlgeschlagen' }, { status: 500 })
  }

  return NextResponse.json(data)
}
