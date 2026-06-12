import { NextResponse } from 'next/server'
import { z } from 'zod'
import { requireAuth } from '@/lib/supabase-server'

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/
const dateOrNull = z.string().regex(DATE_RE).nullable()

const snapshotSchema = z.object({
  bestelldatum: dateOrNull,
  produktionsstart_datum: dateOrNull,
  produktionsende_datum: dateOrNull,
  shippingdatum: dateOrNull,
  ankunftsdatum: dateOrNull,
  verfuegbarkeitsdatum: dateOrNull,
  anzahl_40hq: z.number().int().min(0),
  anzahl_20dc: z.number().int().min(0),
  sku_mengen: z.array(z.object({
    sku_id: z.string().uuid(),
    menge_praktisch: z.number().int().min(0),
    begruendung_anpassung: z.string().nullable(),
  })),
})

const aenderungSchema = z.object({
  bestellung_id: z.string().uuid(),
  neue_daten: z.object({
    bestelldatum: dateOrNull,
    produktionsstart_datum: dateOrNull,
    produktionsende_datum: dateOrNull,
    shippingdatum: dateOrNull,
    ankunftsdatum: dateOrNull,
    verfuegbarkeitsdatum: dateOrNull,
  }),
  neue_sku_mengen: z.array(z.object({
    sku_id: z.string().uuid(),
    menge_praktisch: z.number().int().min(0),
    begruendung_anpassung: z.string(),
  })),
  container_anteil: z.record(z.string(), z.number()),
  snapshot_vor_konsolidierung: snapshotSchema,
})

const postSchema = z.object({
  bestellung_ids: z.array(z.string().uuid()).min(2),
  aenderungen: z.array(aenderungSchema).min(1),
})

export async function POST(request: Request) {
  const { user, supabase, error } = await requireAuth()
  if (error) return error

  const body = await request.json().catch(() => null)
  const parsed = postSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })
  }

  const { bestellung_ids, aenderungen } = parsed.data

  // Verify all bestellungen belong to user
  const { data: bestellungenCheck, error: checkErr } = await supabase
    .from('bestellungen')
    .select('id')
    .in('id', bestellung_ids)
    .eq('user_id', user!.id)

  if (checkErr) return NextResponse.json({ error: checkErr.message }, { status: 500 })
  if ((bestellungenCheck ?? []).length !== bestellung_ids.length) {
    return NextResponse.json({ error: 'Eine oder mehrere Bestellungen nicht gefunden' }, { status: 404 })
  }

  // Check none already in a group
  const { data: existingMitglieder } = await supabase
    .from('bestellungen_konsolidierungsmitglieder')
    .select('bestellung_id, gruppe_id')
    .in('bestellung_id', bestellung_ids)
    .eq('user_id', user!.id)

  if ((existingMitglieder ?? []).length > 0) {
    return NextResponse.json(
      { error: 'Eine oder mehrere Bestellungen sind bereits in einer Konsolidierungsgruppe' },
      { status: 409 }
    )
  }

  // Create group
  const { data: gruppe, error: gruppeErr } = await supabase
    .from('bestellungen_konsolidierungsgruppen')
    .insert({ user_id: user!.id })
    .select('id')
    .single()

  if (gruppeErr || !gruppe) {
    return NextResponse.json({ error: gruppeErr?.message ?? 'Gruppe konnte nicht erstellt werden' }, { status: 500 })
  }

  const gruppe_id = gruppe.id

  // Apply changes and create member rows for each bestellung
  for (const ae of aenderungen) {
    // Update dates on the bestellung
    const { error: updateErr } = await supabase
      .from('bestellungen')
      .update({
        bestelldatum: ae.neue_daten.bestelldatum,
        produktionsstart_datum: ae.neue_daten.produktionsstart_datum,
        produktionsende_datum: ae.neue_daten.produktionsende_datum,
        shippingdatum: ae.neue_daten.shippingdatum,
        ankunftsdatum: ae.neue_daten.ankunftsdatum,
        verfuegbarkeitsdatum: ae.neue_daten.verfuegbarkeitsdatum,
        updated_at: new Date().toISOString(),
      })
      .eq('id', ae.bestellung_id)
      .eq('user_id', user!.id)

    if (updateErr) {
      // Rollback group (members not yet committed fully, but cleanup)
      await supabase.from('bestellungen_konsolidierungsgruppen').delete().eq('id', gruppe_id)
      return NextResponse.json({ error: updateErr.message }, { status: 500 })
    }

    // Update SKU mengen
    for (const sm of ae.neue_sku_mengen) {
      await supabase.from('bestellungen_sku_mengen').upsert({
        bestellung_id: ae.bestellung_id,
        user_id: user!.id,
        sku_id: sm.sku_id,
        menge_praktisch: sm.menge_praktisch,
        begruendung_anpassung: sm.begruendung_anpassung,
      }, { onConflict: 'bestellung_id,sku_id' })
    }

    // Insert member row with snapshot
    const { error: mitgliedErr } = await supabase
      .from('bestellungen_konsolidierungsmitglieder')
      .insert({
        gruppe_id,
        bestellung_id: ae.bestellung_id,
        user_id: user!.id,
        container_anteil: ae.container_anteil,
        snapshot_vor_konsolidierung: ae.snapshot_vor_konsolidierung,
      })

    if (mitgliedErr) {
      await supabase.from('bestellungen_konsolidierungsgruppen').delete().eq('id', gruppe_id)
      return NextResponse.json({ error: mitgliedErr.message }, { status: 500 })
    }
  }

  return NextResponse.json({ gruppe_id, success: true }, { status: 201 })
}
