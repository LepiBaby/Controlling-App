import { NextResponse } from 'next/server'
import { z } from 'zod'
import { requireAuth } from '@/lib/supabase-server'
import { ensureLangfristigeVersion } from '@/lib/langfristige-version'

// Auth-geschützte, pro-Planversion dynamische Route — nie statisch generieren.
// Überspringt den in Next 16 instabilen Static-Path-Pass (Worker-Crash).
export const dynamic = 'force-dynamic'

// PROJ-83: Grundeinstellungen + Einfuhr-USt-Kopffelder (1 Eintrag pro Planversion).

const TABLE = 'langfristige_ust_einstellungen'
const COLS =
  'zahlungsfrequenz, zahlungsverschiebung_tage, einfuhrust_zahlungsziel_tage, einfuhrust_satz, ust_satz_pflegeebene'

const putSchema = z.object({
  zahlungsfrequenz: z.enum(['monatlich', 'quartalsweise']).optional(),
  zahlungsverschiebung_tage: z.number().int().min(0).optional(),
  einfuhrust_zahlungsziel_tage: z.number().int().min(0).optional(),
  einfuhrust_satz: z.number().min(0).max(100).optional(),
  ust_satz_pflegeebene: z.union([z.literal(1), z.literal(2)]).optional(),
})

const DEFAULTS = {
  zahlungsfrequenz: 'monatlich' as const,
  zahlungsverschiebung_tage: 0,
  einfuhrust_zahlungsziel_tage: 0,
  einfuhrust_satz: 0,
  ust_satz_pflegeebene: 1 as const,
}

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

  return NextResponse.json(data ?? DEFAULTS)
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
  if (Object.keys(parsed.data).length === 0) {
    return NextResponse.json({ error: 'Keine Felder zum Speichern angegeben.' }, { status: 400 })
  }

  const { data, error: dbErr } = await supabase
    .from(TABLE)
    .upsert(
      {
        ...parsed.data,
        user_id: user!.id,
        plan_version_id: versionId,
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
