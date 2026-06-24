import { NextResponse } from 'next/server'
import { z } from 'zod'
import { requireAuth } from '@/lib/supabase-server'
import { ensureLangfristigeVersion } from '@/lib/langfristige-version'

// Auth-geschützte, pro-Planversion dynamische Route — nie statisch generieren.
export const dynamic = 'force-dynamic'

// PROJ-101: Einzelne Kapitalbedarf-/Finanzierungs-Zeile ändern/löschen.
//  • PATCH: Betrag (bei festen Zeilen = Override; NULL = Reset auf Auto-Wert),
//           Bezeichnung/FK-Detailfelder (nur manuelle Zeilen), Reihenfolge.
//  • DELETE: nur manuelle Zeilen — die drei festen Zeilen sind nicht löschbar.

const SELECT_COLS =
  'id, bereich, zeilen_art, bezeichnung, betrag, zinssatz, laufzeit_jahre, tilgungsfrei_jahre, sort_order, is_system'

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

const patchSchema = z.object({
  bezeichnung: z.string().min(1).max(100).transform(s => s.trim()).optional(),
  betrag: z.number().finite().nullable().optional(),
  zinssatz: z.number().finite().nullable().optional(),
  laufzeit_jahre: z.number().int().min(0).max(100).nullable().optional(),
  tilgungsfrei_jahre: z.number().int().min(0).max(100).nullable().optional(),
  sort_order: z.number().int().min(0).optional(),
})

interface RouteContext {
  params: Promise<{ versionId: string; id: string }>
}

export async function PATCH(request: Request, { params }: RouteContext) {
  const { user, supabase, error } = await requireAuth()
  if (error) return error

  const { versionId, id } = await params
  const versionError = await ensureLangfristigeVersion(supabase, user!.id, versionId)
  if (versionError) return versionError
  if (!UUID_REGEX.test(id)) {
    return NextResponse.json({ error: 'Ungültige ID' }, { status: 400 })
  }

  const body = await request.json().catch(() => null)
  const parsed = patchSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: 'Ungültige Eingabe.' }, { status: 400 })
  }
  const patch = parsed.data

  // Bestehende Zeile (versions- & nutzergebunden) laden.
  const { data: existing, error: findErr } = await supabase
    .from('langfristige_kapitalbedarf_finanzierung')
    .select('id, bereich, zeilen_art, is_system')
    .eq('user_id', user!.id)
    .eq('plan_version_id', versionId)
    .eq('id', id)
    .maybeSingle()
  if (findErr) return NextResponse.json({ error: findErr.message }, { status: 500 })
  if (!existing) return NextResponse.json({ error: 'Zeile nicht gefunden' }, { status: 404 })

  const update: Record<string, unknown> = { updated_at: new Date().toISOString() }

  // Betrag: bei festen Zeilen ein Override (NULL = Reset auf Auto-Wert), bei manuellen der Wert.
  if (patch.betrag !== undefined) update.betrag = patch.betrag
  if (patch.sort_order !== undefined) update.sort_order = patch.sort_order

  // Bezeichnung + FK-Detailfelder nur für MANUELLE Zeilen erlauben.
  if (existing.is_system) {
    if (patch.bezeichnung !== undefined) {
      return NextResponse.json({ error: 'Die Bezeichnung fester Zeilen kann nicht geändert werden.' }, { status: 403 })
    }
  } else {
    if (patch.bezeichnung !== undefined) update.bezeichnung = patch.bezeichnung
    // FK-Detailfelder nur bei Fremdkapital-Zeilen.
    if (existing.bereich === 'fremdkapital') {
      if (patch.zinssatz !== undefined) update.zinssatz = patch.zinssatz
      if (patch.laufzeit_jahre !== undefined) update.laufzeit_jahre = patch.laufzeit_jahre
      if (patch.tilgungsfrei_jahre !== undefined) update.tilgungsfrei_jahre = patch.tilgungsfrei_jahre
    }
  }

  const { data, error: dbErr } = await supabase
    .from('langfristige_kapitalbedarf_finanzierung')
    .update(update)
    .eq('user_id', user!.id)
    .eq('plan_version_id', versionId)
    .eq('id', id)
    .select(SELECT_COLS)
    .maybeSingle()

  if (dbErr) return NextResponse.json({ error: dbErr.message }, { status: 500 })
  if (!data) return NextResponse.json({ error: 'Zeile nicht gefunden' }, { status: 404 })
  return NextResponse.json(data)
}

export async function DELETE(_request: Request, { params }: RouteContext) {
  const { user, supabase, error } = await requireAuth()
  if (error) return error

  const { versionId, id } = await params
  const versionError = await ensureLangfristigeVersion(supabase, user!.id, versionId)
  if (versionError) return versionError
  if (!UUID_REGEX.test(id)) {
    return NextResponse.json({ error: 'Ungültige ID' }, { status: 400 })
  }

  const { data: existing, error: findErr } = await supabase
    .from('langfristige_kapitalbedarf_finanzierung')
    .select('id, is_system')
    .eq('user_id', user!.id)
    .eq('plan_version_id', versionId)
    .eq('id', id)
    .maybeSingle()
  if (findErr) return NextResponse.json({ error: findErr.message }, { status: 500 })
  if (!existing) return NextResponse.json({ error: 'Zeile nicht gefunden' }, { status: 404 })

  // Die drei festen Kapitalbedarf-Zeilen sind nicht löschbar.
  if (existing.is_system) {
    return NextResponse.json({ error: 'Feste Zeilen können nicht gelöscht werden.' }, { status: 403 })
  }

  const { error: dbErr } = await supabase
    .from('langfristige_kapitalbedarf_finanzierung')
    .delete()
    .eq('user_id', user!.id)
    .eq('plan_version_id', versionId)
    .eq('id', id)

  if (dbErr) return NextResponse.json({ error: dbErr.message }, { status: 500 })
  return NextResponse.json({ success: true })
}
