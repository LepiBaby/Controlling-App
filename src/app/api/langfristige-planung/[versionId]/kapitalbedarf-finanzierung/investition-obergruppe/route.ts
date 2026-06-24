import { NextResponse } from 'next/server'
import { z } from 'zod'
import { requireAuth } from '@/lib/supabase-server'
import { ensureLangfristigeVersion } from '@/lib/langfristige-version'

// Auth-geschützte, pro-Planversion dynamische Route — nie statisch generieren.
export const dynamic = 'force-dynamic'

// PROJ-101: Override-Wert einer Investitionen-Obergruppe (Unterwert) setzen/zurücksetzen.
// Upsert je (Version × Obergruppe-Kategorie = quelle_id):
//   • betrag = Zahl → Override anlegen/aktualisieren (sticht den berechneten Auto-Wert)
//   • betrag = null → vorhandenen Override löschen (zurück zum Auto-Wert)
// Die Investitionen-Gesamtzeile selbst ist nicht editierbar; sie summiert die Unterwerte.

const SELECT_COLS =
  'id, bereich, zeilen_art, bezeichnung, betrag, zinssatz, laufzeit_jahre, tilgungsfrei_jahre, sort_order, is_system, quelle_id'

const putSchema = z.object({
  quelle_id: z.string().uuid(),
  bezeichnung: z.string().min(1).max(100).transform(s => s.trim()),
  betrag: z.number().finite().nullable(),
})

interface RouteContext {
  params: Promise<{ versionId: string }>
}

export async function PUT(request: Request, { params }: RouteContext) {
  const { user, supabase, error } = await requireAuth()
  if (error) return error

  const { versionId } = await params
  const versionError = await ensureLangfristigeVersion(supabase, user!.id, versionId)
  if (versionError) return versionError

  const body = await request.json().catch(() => null)
  const parsed = putSchema.safeParse(body)
  if (!parsed.success || parsed.data.bezeichnung.length === 0) {
    return NextResponse.json({ error: 'Ungültige Eingabe.' }, { status: 400 })
  }
  const { quelle_id, bezeichnung, betrag } = parsed.data

  // Vorhandenen Override für diese Obergruppe suchen.
  const { data: existing, error: findErr } = await supabase
    .from('langfristige_kapitalbedarf_finanzierung')
    .select('id')
    .eq('user_id', user!.id)
    .eq('plan_version_id', versionId)
    .eq('zeilen_art', 'investition_obergruppe')
    .eq('quelle_id', quelle_id)
    .maybeSingle()
  if (findErr) return NextResponse.json({ error: findErr.message }, { status: 500 })

  // betrag = null → Override entfernen (zurück zum Auto-Wert).
  if (betrag === null) {
    if (existing) {
      const { error: delErr } = await supabase
        .from('langfristige_kapitalbedarf_finanzierung')
        .delete()
        .eq('user_id', user!.id)
        .eq('plan_version_id', versionId)
        .eq('id', existing.id)
      if (delErr) return NextResponse.json({ error: delErr.message }, { status: 500 })
    }
    return NextResponse.json({ success: true, betrag: null })
  }

  // betrag gesetzt → Override aktualisieren oder neu anlegen.
  if (existing) {
    const { data, error: upErr } = await supabase
      .from('langfristige_kapitalbedarf_finanzierung')
      .update({ betrag, bezeichnung, updated_at: new Date().toISOString() })
      .eq('user_id', user!.id)
      .eq('plan_version_id', versionId)
      .eq('id', existing.id)
      .select(SELECT_COLS)
      .single()
    if (upErr) return NextResponse.json({ error: upErr.message }, { status: 500 })
    return NextResponse.json(data)
  }

  const { data, error: insErr } = await supabase
    .from('langfristige_kapitalbedarf_finanzierung')
    .insert({
      user_id: user!.id,
      plan_version_id: versionId,
      bereich: 'kapitalbedarf',
      zeilen_art: 'investition_obergruppe',
      bezeichnung,
      betrag,
      quelle_id,
      sort_order: 0,
      is_system: true,
    })
    .select(SELECT_COLS)
    .single()
  if (insErr) return NextResponse.json({ error: insErr.message }, { status: 500 })
  return NextResponse.json(data, { status: 201 })
}
