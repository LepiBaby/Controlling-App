import { NextResponse } from 'next/server'
import { z } from 'zod'
import { requireAuth } from '@/lib/supabase-server'
import { ensureLangfristigeVersion } from '@/lib/langfristige-version'
import { ensureKapitalbedarfFinanzierungSeed } from '@/lib/langfristige-kapitalbedarf-finanzierung-seed'
import { fetchAllRows } from '@/lib/supabase-paginate'

// Auth-geschützte, pro-Planversion dynamische Route — nie statisch generieren.
// Überspringt den in Next 16 instabilen Static-Path-Pass (Worker-Crash).
export const dynamic = 'force-dynamic'

// PROJ-101: Kapitalbedarf & Finanzierung (Langfristige Planung).
// Eine gemeinsame, versionsgebundene Tabelle für alle vom Nutzer gepflegten Zeilen
// beider Tabellen. Die Auto-Werte (Investitionen, Betriebsmittelbedarf) werden NICHT
// hier gespeichert; nur ein optionaler Override (betrag) der festen Auto-Zeilen sowie
// alle manuellen/EK/FK-Zeilen.

const SELECT_COLS =
  'id, bereich, zeilen_art, bezeichnung, betrag, zinssatz, laufzeit_jahre, tilgungsfrei_jahre, sort_order, is_system, quelle_id'

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

// Eine MANUELLE Zeile anlegen. Feste Auto-Zeilen werden ausschließlich per Seed erzeugt.
const createSchema = z.object({
  bereich: z.enum(['kapitalbedarf', 'eigenkapital', 'fremdkapital']),
  bezeichnung: z.string().min(1).max(100).transform(s => s.trim()),
  betrag: z.number().finite().nullable().optional(),
  // FK-Detailfelder — rein informativ, nur für bereich='fremdkapital' sinnvoll.
  zinssatz: z.number().finite().nullable().optional(),
  laufzeit_jahre: z.number().int().min(0).max(100).nullable().optional(),
  tilgungsfrei_jahre: z.number().int().min(0).max(100).nullable().optional(),
})

// Reihenfolge mehrerer Zeilen in einem Rutsch aktualisieren.
const reorderSchema = z.object({
  order: z
    .array(z.object({ id: z.string().uuid(), sort_order: z.number().int().min(0) }))
    .min(1)
    .max(500),
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

  // Feste Kapitalbedarf-Zeilen einmalig anlegen (idempotent).
  await ensureKapitalbedarfFinanzierungSeed(supabase, user!.id, versionId)

  const { data, error: dbErr } = await fetchAllRows((from, to) =>
    supabase
      .from('langfristige_kapitalbedarf_finanzierung')
      .select(SELECT_COLS)
      .eq('user_id', user!.id)
      .eq('plan_version_id', versionId)
      .order('bereich', { ascending: true })
      .order('sort_order', { ascending: true })
      .order('id', { ascending: true })
      .range(from, to)
  )

  if (dbErr) return NextResponse.json({ error: dbErr.message }, { status: 500 })
  return NextResponse.json(data ?? [])
}

export async function POST(request: Request, { params }: RouteContext) {
  const { user, supabase, error } = await requireAuth()
  if (error) return error

  const { versionId } = await params
  const versionError = await ensureLangfristigeVersion(supabase, user!.id, versionId)
  if (versionError) return versionError

  const body = await request.json().catch(() => null)
  const parsed = createSchema.safeParse(body)
  if (!parsed.success || parsed.data.bezeichnung.length === 0) {
    return NextResponse.json({ error: 'Bitte gib eine Bezeichnung mit 1–100 Zeichen an.' }, { status: 400 })
  }
  const { bereich, bezeichnung, betrag, zinssatz, laufzeit_jahre, tilgungsfrei_jahre } = parsed.data

  // Neue manuelle Zeile ans Ende ihres Bereichs anhängen.
  const { data: maxRows, error: maxErr } = await supabase
    .from('langfristige_kapitalbedarf_finanzierung')
    .select('sort_order')
    .eq('user_id', user!.id)
    .eq('plan_version_id', versionId)
    .eq('bereich', bereich)
    .order('sort_order', { ascending: false })
    .limit(1)
  if (maxErr) return NextResponse.json({ error: maxErr.message }, { status: 500 })
  const nextSort = (maxRows && maxRows.length > 0 ? (maxRows[0].sort_order as number) : -1) + 1

  // FK-Detailfelder nur bei Fremdkapital übernehmen, sonst neutralisieren.
  const fk = bereich === 'fremdkapital'
  const { data, error: dbErr } = await supabase
    .from('langfristige_kapitalbedarf_finanzierung')
    .insert({
      user_id: user!.id,
      plan_version_id: versionId,
      bereich,
      zeilen_art: 'manuell',
      bezeichnung,
      betrag: betrag ?? null,
      zinssatz: fk ? zinssatz ?? null : null,
      laufzeit_jahre: fk ? laufzeit_jahre ?? null : null,
      tilgungsfrei_jahre: fk ? tilgungsfrei_jahre ?? null : null,
      sort_order: nextSort,
      is_system: false,
    })
    .select(SELECT_COLS)
    .single()

  if (dbErr) return NextResponse.json({ error: dbErr.message }, { status: 500 })
  return NextResponse.json(data, { status: 201 })
}

// Reihenfolge mehrerer Zeilen aktualisieren (Drag/Hoch-Runter). Nur eigene Zeilen.
export async function PUT(request: Request, { params }: RouteContext) {
  const { user, supabase, error } = await requireAuth()
  if (error) return error

  const { versionId } = await params
  const versionError = await ensureLangfristigeVersion(supabase, user!.id, versionId)
  if (versionError) return versionError

  const body = await request.json().catch(() => null)
  const parsed = reorderSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: 'Ungültige Reihenfolge-Daten.' }, { status: 400 })
  }

  // Nur Zeilen aktualisieren, die der Version + dem Nutzer gehören.
  const { data: owned, error: ownErr } = await fetchAllRows<{ id: string }>((from, to) =>
    supabase
      .from('langfristige_kapitalbedarf_finanzierung')
      .select('id')
      .eq('user_id', user!.id)
      .eq('plan_version_id', versionId)
      .order('id', { ascending: true })
      .range(from, to)
  )
  if (ownErr) return NextResponse.json({ error: ownErr.message }, { status: 500 })
  const ownedIds = new Set((owned ?? []).map(r => r.id as string))

  const now = new Date().toISOString()
  for (const item of parsed.data.order) {
    if (!ownedIds.has(item.id)) continue
    const { error: upErr } = await supabase
      .from('langfristige_kapitalbedarf_finanzierung')
      .update({ sort_order: item.sort_order, updated_at: now })
      .eq('user_id', user!.id)
      .eq('plan_version_id', versionId)
      .eq('id', item.id)
    if (upErr) return NextResponse.json({ error: upErr.message }, { status: 500 })
  }

  return NextResponse.json({ success: true })
}
