import { NextResponse } from 'next/server'
import { z } from 'zod'
import { requireAuth } from '@/lib/supabase-server'
import { ensureLangfristigeVersion } from '@/lib/langfristige-version'
import { fetchAllRows } from '@/lib/supabase-paginate'

// Auth-geschützte, pro-Planversion dynamische Route — nie statisch generieren.
// Überspringt den in Next 16 instabilen Static-Path-Pass (Worker-Crash).
export const dynamic = 'force-dynamic'

// PROJ-93: Manuelle Überschreibungen der Steuerausgaben-Planung (Langfristige Planung).
// GET liefert alle gespeicherten manuellen Werte der Version, PUT macht einen Upsert
// einer einzelnen Zelle (betrag_manuell = null löscht den Eintrag → einzelnes
// Zurücksetzen), DELETE löscht alle manuellen Werte + Notizen der Version (globaler
// Reset). Alles ist nutzer- und versionsgebunden.
//
// kategorie_id ist eine globale Leaf-Kategorie unter dem „Steuern"-Knoten
// (kpi_categories). Auto-berechnete Werte (Einfuhr-USt + Umsatzsteuer) werden NIE
// hier gespeichert — ein vorhandener Eintrag = manuell. betrag_manuell DARF NEGATIV
// sein (Umsatzsteuer-Erstattung).

const SELECT_COLS = 'kategorie_id, jahr, monat, betrag_manuell'
const ONCONFLICT = 'plan_version_id,kategorie_id,jahr,monat'
const NOTIZEN_SEITE = 'steuerausgaben'

const putSchema = z.object({
  kategorie_id: z.string().uuid(),
  jahr: z.number().int().min(2000).max(2100),
  monat: z.number().int().min(1).max(12),
  betrag_manuell: z.number().nullable().optional(),
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

  const { data, error: dbErr } = await fetchAllRows((from, to) =>
    supabase
      .from('langfristige_steuerausgaben_planung')
      .select(SELECT_COLS)
      .eq('user_id', user!.id)
      .eq('plan_version_id', versionId)
      .order('id', { ascending: true })
      .range(from, to),
  )

  if (dbErr) return NextResponse.json({ error: dbErr.message }, { status: 500 })
  return NextResponse.json(data ?? [])
}

export async function PUT(request: Request, { params }: RouteContext) {
  const { user, supabase, error } = await requireAuth()
  if (error) return error

  const { versionId } = await params

  // Eingaben zuerst validieren (günstiger als ein DB-Roundtrip), danach Eigentum.
  const body = await request.json().catch(() => null)
  const parsed = putSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })
  }

  const versionError = await ensureLangfristigeVersion(supabase, user!.id, versionId)
  if (versionError) return versionError

  const { kategorie_id, jahr, monat, betrag_manuell = null } = parsed.data

  // betrag_manuell = null → Eintrag entfernen (Zelle zeigt wieder berechnet/leer).
  if (betrag_manuell === null) {
    const { error: delErr } = await supabase
      .from('langfristige_steuerausgaben_planung')
      .delete()
      .eq('user_id', user!.id)
      .eq('plan_version_id', versionId)
      .eq('kategorie_id', kategorie_id)
      .eq('jahr', jahr)
      .eq('monat', monat)
    if (delErr) return NextResponse.json({ error: delErr.message }, { status: 500 })
    return NextResponse.json({ ok: true })
  }

  const { data, error: dbErr } = await supabase
    .from('langfristige_steuerausgaben_planung')
    .upsert(
      {
        user_id: user!.id,
        plan_version_id: versionId,
        kategorie_id,
        jahr,
        monat,
        betrag_manuell,
        updated_at: new Date().toISOString(),
      },
      { onConflict: ONCONFLICT },
    )
    .select(SELECT_COLS)
    .single()

  if (dbErr || !data) {
    return NextResponse.json({ error: dbErr?.message ?? 'Upsert fehlgeschlagen' }, { status: 500 })
  }
  return NextResponse.json(data)
}

export async function DELETE(_request: Request, { params }: RouteContext) {
  const { user, supabase, error } = await requireAuth()
  if (error) return error

  const { versionId } = await params
  const versionError = await ensureLangfristigeVersion(supabase, user!.id, versionId)
  if (versionError) return versionError

  const { error: dbErr } = await supabase
    .from('langfristige_steuerausgaben_planung')
    .delete()
    .eq('user_id', user!.id)
    .eq('plan_version_id', versionId)
  if (dbErr) return NextResponse.json({ error: dbErr.message }, { status: 500 })

  // Zugehörige Zellen-Notizen dieser Seite ebenfalls entfernen.
  const { error: notizErr } = await supabase
    .from('langfristige_planung_notizen')
    .delete()
    .eq('user_id', user!.id)
    .eq('plan_version_id', versionId)
    .eq('seite', NOTIZEN_SEITE)
  if (notizErr) return NextResponse.json({ error: notizErr.message }, { status: 500 })

  return NextResponse.json({ ok: true })
}
