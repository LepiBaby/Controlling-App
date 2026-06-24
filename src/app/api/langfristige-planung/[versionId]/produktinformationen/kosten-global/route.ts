import { NextResponse } from 'next/server'
import { z } from 'zod'
import { requireAuth } from '@/lib/supabase-server'
import { ensureLangfristigeVersion } from '@/lib/langfristige-version'

// Auth-geschützte, pro-Planversion dynamische Route — nie statisch generieren.
// Überspringt den in Next 16 instabilen Static-Path-Pass (Worker-Crash).
export const dynamic = 'force-dynamic'

// PROJ-77: Globale Kosten- und Zahlungsziel-Einstellungen (pro Planversion).

const TABLE = 'langfristige_produktinformationen_kosten_global'
const COLS =
  'id, shipping_kosten_20dc, shipping_kosten_40hq, shipping_zahlungsziel_tage, inspektion_kosten_20dc, inspektion_kosten_40hq, inspektion_zahlungsziel_tage, einlagerung_kosten_20dc, einlagerung_kosten_40hq, einlagerung_zahlungsziel_tage, zoll_zahlungsziel_tage'

const UpsertSchema = z.object({
  shipping_kosten_20dc: z.number().min(0).nullable().optional(),
  shipping_kosten_40hq: z.number().min(0).nullable().optional(),
  shipping_zahlungsziel_tage: z.number().int().min(0).nullable().optional(),
  inspektion_kosten_20dc: z.number().min(0).nullable().optional(),
  inspektion_kosten_40hq: z.number().min(0).nullable().optional(),
  inspektion_zahlungsziel_tage: z.number().int().min(0).nullable().optional(),
  einlagerung_kosten_20dc: z.number().min(0).nullable().optional(),
  einlagerung_kosten_40hq: z.number().min(0).nullable().optional(),
  einlagerung_zahlungsziel_tage: z.number().int().min(0).nullable().optional(),
  zoll_zahlungsziel_tage: z.number().int().min(0).nullable().optional(),
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
        shipping_kosten_20dc: parsed.data.shipping_kosten_20dc ?? null,
        shipping_kosten_40hq: parsed.data.shipping_kosten_40hq ?? null,
        shipping_zahlungsziel_tage: parsed.data.shipping_zahlungsziel_tage ?? null,
        inspektion_kosten_20dc: parsed.data.inspektion_kosten_20dc ?? null,
        inspektion_kosten_40hq: parsed.data.inspektion_kosten_40hq ?? null,
        inspektion_zahlungsziel_tage: parsed.data.inspektion_zahlungsziel_tage ?? null,
        einlagerung_kosten_20dc: parsed.data.einlagerung_kosten_20dc ?? null,
        einlagerung_kosten_40hq: parsed.data.einlagerung_kosten_40hq ?? null,
        einlagerung_zahlungsziel_tage: parsed.data.einlagerung_zahlungsziel_tage ?? null,
        zoll_zahlungsziel_tage: parsed.data.zoll_zahlungsziel_tage ?? null,
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
