import { NextResponse } from 'next/server'
import { z } from 'zod'
import { requireAuth } from '@/lib/supabase-server'
import { ensureLangfristigeVersion } from '@/lib/langfristige-version'

// Auth-geschützte, pro-Planversion dynamische Route — nie statisch generieren.
// Überspringt den in Next 16 instabilen Static-Path-Pass (Worker-Crash).
export const dynamic = 'force-dynamic'

// PROJ-77: Zahlungskonditionen je Produkt (versionsgebunden).

const TABLE = 'langfristige_produktinformationen_zahlungskonditionen'
const COLS =
  'id, produkt_id, vor_produktion_pct, nach_produktion_pct, nach_ankunft_pct, zahlungsziel_vor_produktion_tage, zahlungsziel_nach_produktion_tage, zahlungsziel_nach_ankunft_tage'

const UpsertSchema = z.object({
  produkt_id: z.string().uuid(),
  vor_produktion_pct: z.number().min(0).max(100).nullable().optional(),
  nach_produktion_pct: z.number().min(0).max(100).nullable().optional(),
  nach_ankunft_pct: z.number().min(0).max(100).nullable().optional(),
  zahlungsziel_vor_produktion_tage: z.number().int().min(0).nullable().optional(),
  zahlungsziel_nach_produktion_tage: z.number().int().min(0).nullable().optional(),
  zahlungsziel_nach_ankunft_tage: z.number().int().min(0).nullable().optional(),
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

  // Wenn alle drei %-Werte gesetzt sind, muss die Summe 100 ergeben (wie PROJ-59).
  const { vor_produktion_pct: v, nach_produktion_pct: n, nach_ankunft_pct: a } = parsed.data
  if (v != null && n != null && a != null && Math.abs(v + n + a - 100) > 0.01) {
    return NextResponse.json(
      { error: 'Die Summe der Prozentwerte muss 100 ergeben.' },
      { status: 400 }
    )
  }

  const { data, error: dbErr } = await supabase
    .from(TABLE)
    .upsert(
      {
        user_id: user!.id,
        plan_version_id: versionId,
        produkt_id: parsed.data.produkt_id,
        vor_produktion_pct: parsed.data.vor_produktion_pct ?? null,
        nach_produktion_pct: parsed.data.nach_produktion_pct ?? null,
        nach_ankunft_pct: parsed.data.nach_ankunft_pct ?? null,
        zahlungsziel_vor_produktion_tage: parsed.data.zahlungsziel_vor_produktion_tage ?? null,
        zahlungsziel_nach_produktion_tage: parsed.data.zahlungsziel_nach_produktion_tage ?? null,
        zahlungsziel_nach_ankunft_tage: parsed.data.zahlungsziel_nach_ankunft_tage ?? null,
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
