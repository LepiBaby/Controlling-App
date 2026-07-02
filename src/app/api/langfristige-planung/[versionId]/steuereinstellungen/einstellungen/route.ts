import { NextResponse } from 'next/server'
import { z } from 'zod'
import { requireAuth } from '@/lib/supabase-server'
import { ensureLangfristigeVersion } from '@/lib/langfristige-version'

// Auth-geschützte, pro-Planversion dynamische Route — nie statisch generieren.
// Überspringt den in Next 16 instabilen Static-Path-Pass (Worker-Crash).
export const dynamic = 'force-dynamic'

// PROJ-83: Grundeinstellungen + Einfuhr-USt-Kopffelder (1 Eintrag pro Planversion).

const TABLE = 'langfristige_ust_einstellungen'
// DB-Spalten der langfristigen Planung sind in GANZEN MONATEN (…_monate). Der mit der
// kurzfristigen Planung geteilte Hook/Typ (useUstEinstellungen) führt die Werte weiter
// unter den Schlüsseln …_tage — der Zahlenwert ist hier jedoch in Monaten. Nur das
// UI-Label unterscheidet die Einheit (Steuermaske schaltet im Versions-Modus auf
// „Monate"). Die Umrechnung Tage↔Monate ist damit auf diese Route begrenzt.
const DB_COLS =
  'zahlungsfrequenz, zahlungsverschiebung_monate, einfuhrust_zahlungsziel_monate, einfuhrust_satz, ust_satz_pflegeebene'

interface DbRow {
  zahlungsfrequenz: 'monatlich' | 'quartalsweise'
  zahlungsverschiebung_monate: number
  einfuhrust_zahlungsziel_monate: number
  einfuhrust_satz: number
  ust_satz_pflegeebene: 1 | 2
}

// DB-Zeile (…_monate) → geteilte API-Form (…_tage-Schlüssel, Wert in Monaten).
function toApi(row: DbRow) {
  return {
    zahlungsfrequenz: row.zahlungsfrequenz,
    zahlungsverschiebung_tage: row.zahlungsverschiebung_monate,
    einfuhrust_zahlungsziel_tage: row.einfuhrust_zahlungsziel_monate,
    einfuhrust_satz: row.einfuhrust_satz,
    ust_satz_pflegeebene: row.ust_satz_pflegeebene,
  }
}

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
    .select(DB_COLS)
    .eq('user_id', user!.id)
    .eq('plan_version_id', versionId)
    .maybeSingle()

  if (dbErr) return NextResponse.json({ error: dbErr.message }, { status: 500 })

  return NextResponse.json(data ? toApi(data as unknown as DbRow) : DEFAULTS)
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

  // API-Patch (…_tage-Schlüssel, Wert in Monaten) → DB-Spalten (…_monate).
  const p = parsed.data
  const dbPatch: Record<string, unknown> = {}
  if (p.zahlungsfrequenz !== undefined) dbPatch.zahlungsfrequenz = p.zahlungsfrequenz
  if (p.zahlungsverschiebung_tage !== undefined) dbPatch.zahlungsverschiebung_monate = p.zahlungsverschiebung_tage
  if (p.einfuhrust_zahlungsziel_tage !== undefined) dbPatch.einfuhrust_zahlungsziel_monate = p.einfuhrust_zahlungsziel_tage
  if (p.einfuhrust_satz !== undefined) dbPatch.einfuhrust_satz = p.einfuhrust_satz
  if (p.ust_satz_pflegeebene !== undefined) dbPatch.ust_satz_pflegeebene = p.ust_satz_pflegeebene

  const { data, error: dbErr } = await supabase
    .from(TABLE)
    .upsert(
      {
        ...dbPatch,
        user_id: user!.id,
        plan_version_id: versionId,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'plan_version_id' }
    )
    .select(DB_COLS)
    .single()

  if (dbErr || !data) {
    return NextResponse.json({ error: dbErr?.message ?? 'Upsert fehlgeschlagen' }, { status: 500 })
  }

  return NextResponse.json(toApi(data as unknown as DbRow))
}
