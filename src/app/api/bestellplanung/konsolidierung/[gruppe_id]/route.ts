import { NextResponse } from 'next/server'
import { requireAuth } from '@/lib/supabase-server'

interface SnapshotSkuMenge {
  sku_id: string
  menge_praktisch: number
  begruendung_anpassung: string | null
}

interface Snapshot {
  bestelldatum: string | null
  produktionsstart_datum: string | null
  produktionsende_datum: string | null
  shippingdatum: string | null
  ankunftsdatum: string | null
  verfuegbarkeitsdatum: string | null
  anzahl_40hq: number
  anzahl_20dc: number
  sku_mengen: SnapshotSkuMenge[]
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ gruppe_id: string }> }
) {
  const { user, supabase, error } = await requireAuth()
  if (error) return error

  const { gruppe_id } = await params
  const { searchParams } = new URL(request.url)
  const dissolveOnly = searchParams.get('dissolve_only') === 'true'

  // Verify group belongs to user
  const { data: gruppe, error: gruppeErr } = await supabase
    .from('bestellungen_konsolidierungsgruppen')
    .select('id')
    .eq('id', gruppe_id)
    .eq('user_id', user!.id)
    .maybeSingle()

  if (gruppeErr) return NextResponse.json({ error: gruppeErr.message }, { status: 500 })
  if (!gruppe) return NextResponse.json({ error: 'Gruppe nicht gefunden' }, { status: 404 })

  // Load all members with snapshots (needed for both full restore and dissolve-only)
  const { data: mitglieder, error: mitgliederErr } = await supabase
    .from('bestellungen_konsolidierungsmitglieder')
    .select('bestellung_id, snapshot_vor_konsolidierung')
    .eq('gruppe_id', gruppe_id)
    .eq('user_id', user!.id)

  if (mitgliederErr) return NextResponse.json({ error: mitgliederErr.message }, { status: 500 })

  for (const m of (mitglieder ?? []) as Array<{ bestellung_id: string; snapshot_vor_konsolidierung: Snapshot }>) {
    const snap = m.snapshot_vor_konsolidierung

    if (dissolveOnly) {
      // Restore only quantities/containers — dates are left as-is so the algorithm can overwrite them
      const { error: restoreErr } = await supabase
        .from('bestellungen')
        .update({
          anzahl_40hq: snap.anzahl_40hq,
          anzahl_20dc: snap.anzahl_20dc,
          updated_at: new Date().toISOString(),
        })
        .eq('id', m.bestellung_id)
        .eq('user_id', user!.id)

      if (restoreErr) return NextResponse.json({ error: restoreErr.message }, { status: 500 })
    } else {
      // Full restore: dates + quantities + containers
      const { error: restoreErr } = await supabase
        .from('bestellungen')
        .update({
          bestelldatum: snap.bestelldatum,
          produktionsstart_datum: snap.produktionsstart_datum,
          produktionsende_datum: snap.produktionsende_datum,
          shippingdatum: snap.shippingdatum,
          ankunftsdatum: snap.ankunftsdatum,
          verfuegbarkeitsdatum: snap.verfuegbarkeitsdatum,
          anzahl_40hq: snap.anzahl_40hq,
          anzahl_20dc: snap.anzahl_20dc,
          updated_at: new Date().toISOString(),
        })
        .eq('id', m.bestellung_id)
        .eq('user_id', user!.id)

      if (restoreErr) return NextResponse.json({ error: restoreErr.message }, { status: 500 })
    }

    // Restore SKU mengen from snapshot (both modes)
    for (const sm of snap.sku_mengen ?? []) {
      await supabase.from('bestellungen_sku_mengen').upsert({
        bestellung_id: m.bestellung_id,
        user_id: user!.id,
        sku_id: sm.sku_id,
        menge_praktisch: sm.menge_praktisch,
        begruendung_anpassung: sm.begruendung_anpassung,
      }, { onConflict: 'bestellung_id,sku_id' })
    }
  }

  // Delete group (CASCADE removes members)
  const { error: deleteErr } = await supabase
    .from('bestellungen_konsolidierungsgruppen')
    .delete()
    .eq('id', gruppe_id)
    .eq('user_id', user!.id)

  if (deleteErr) return NextResponse.json({ error: deleteErr.message }, { status: 500 })

  return NextResponse.json({ success: true })
}
