import { NextResponse } from 'next/server'
import { requireAuth } from '@/lib/supabase-server'
import { ensureLangfristigeVersion } from '@/lib/langfristige-version'

// Auth-geschützte, pro-Planversion dynamische Route — nie statisch generieren.
export const dynamic = 'force-dynamic'

// PROJ-86: Konsolidierung „aufheben".
//
// Da die Paar-Tabelle `langfristige_bestellungen_konsolidierungen` keine echte
// `gruppe_id` besitzt, wird eine Gruppe über ihre paarweisen Verknüpfungen
// repräsentiert. Der Pfad-Parameter `gruppe_id` ist hier die ID EINER Bestellung
// der Gruppe. Aufheben = alle Verknüpfungen entfernen, die diese Bestellung
// transitiv mit ihrer Gruppe verbinden:
//   1. alle Partner der Bestellung ermitteln (Paare, in denen sie vorkommt),
//   2. alle Paare löschen, in denen die Bestellung ODER einer ihrer Partner
//      vorkommt (die gesamte zusammenhängende Gruppe wird aufgelöst).
// Die auf den Bestellungen gespeicherten Mengen/Daten bleiben unverändert
// (kein Snapshot-Zwang in der LP); der nächste Bestelllauf kann sie neu bewerten.

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

interface RouteContext {
  params: Promise<{ versionId: string; gruppe_id: string }>
}

export async function DELETE(_request: Request, { params }: RouteContext) {
  const { user, supabase, error } = await requireAuth()
  if (error) return error

  const { versionId, gruppe_id } = await params
  const versionError = await ensureLangfristigeVersion(supabase, user!.id, versionId)
  if (versionError) return versionError

  if (!UUID_REGEX.test(gruppe_id)) {
    return NextResponse.json({ error: 'Ungültige ID' }, { status: 400 })
  }

  // 1. Partner der Bestellung ermitteln.
  const { data: paare, error: ladeErr } = await supabase
    .from('langfristige_bestellungen_konsolidierungen')
    .select('bestellung_id_1, bestellung_id_2')
    .eq('user_id', user!.id)
    .eq('plan_version_id', versionId)
    .or(`bestellung_id_1.eq.${gruppe_id},bestellung_id_2.eq.${gruppe_id}`)

  if (ladeErr) return NextResponse.json({ error: ladeErr.message }, { status: 500 })

  const gruppenIds = new Set<string>([gruppe_id])
  for (const p of (paare ?? []) as Array<{ bestellung_id_1: string; bestellung_id_2: string }>) {
    gruppenIds.add(p.bestellung_id_1)
    gruppenIds.add(p.bestellung_id_2)
  }
  const idsList = [...gruppenIds]

  // 2. Alle Paare löschen, in denen die Bestellung oder einer ihrer Partner vorkommt.
  const { error: delErr } = await supabase
    .from('langfristige_bestellungen_konsolidierungen')
    .delete()
    .eq('user_id', user!.id)
    .eq('plan_version_id', versionId)
    .or(
      `bestellung_id_1.in.(${idsList.join(',')}),bestellung_id_2.in.(${idsList.join(',')})`,
    )

  if (delErr) return NextResponse.json({ error: delErr.message }, { status: 500 })

  // 3. Konsolidierungs-Anzeigefelder auf den betroffenen Bestellungen zurücksetzen
  //    (anteiliger Container-Share + Vor-Konsolidierungs-Menge), damit die Detail-
  //    ansicht nach dem Auflösen wieder die Einzelwerte zeigt.
  const { error: resetErr } = await supabase
    .from('langfristige_bestellungen')
    .update({ container_anteil: null, menge_vor_konsolidierung: null })
    .eq('user_id', user!.id)
    .eq('plan_version_id', versionId)
    .in('id', idsList)

  if (resetErr) return NextResponse.json({ error: resetErr.message }, { status: 500 })

  return NextResponse.json({ success: true })
}
