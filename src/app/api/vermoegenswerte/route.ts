import { NextResponse } from 'next/server'
import { z } from 'zod'
import { requireAuth } from '@/lib/supabase-server'

const lagerwertSchema = z.object({
  produkt_id: z.string().uuid('Ungültige Produkt-ID'),
  lagerwert:  z.number().min(0, 'Lagerwert darf nicht negativ sein'),
})

const transitwertSchema = z.object({
  produkt_id:              z.string().uuid('Ungültige Produkt-ID'),
  ausgaben_transaktion_id: z.string().uuid().nullable().optional(),
  transitwert:             z.number().min(0, 'Transitwert darf nicht negativ sein'),
})

const forderungSchema = z.object({
  plattform_id: z.string().uuid().nullable(),
  betrag:       z.number().min(0, 'Betrag darf nicht negativ sein'),
})

const createSchema = z.object({
  datum:                     z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Ungültiges Datumsformat (YYYY-MM-DD)'),
  lagerwerte:                z.array(lagerwertSchema),
  transitwerte:              z.array(transitwertSchema),
  verbindlichkeiten_llv:     z.number().min(0),
  verbindlichkeiten_sonstige: z.number().min(0),
  darlehensvb:               z.number().min(0),
  forderungen:               z.array(forderungSchema),
  steuersaldo_typ:           z.enum(['forderung', 'verbindlichkeit']).nullable(),
  steuersaldo:               z.number().min(0).nullable(),
  steuersaldo_von:           z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable(),
  steuersaldo_bis:           z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable(),
  cash_bestand:              z.number(),
  anlagevermoegen:           z.number().min(0),
})

export async function GET() {
  const { supabase, error } = await requireAuth()
  if (error) return error

  const { data, error: dbError } = await supabase
    .from('vermoegenswarte_snapshots')
    .select(`
      *,
      lagerwerte:vermoegenswarte_lagerwerte(*),
      transitwerte:vermoegenswarte_transitwerte(*),
      forderungen:vermoegenswarte_forderungen(*)
    `)
    .order('datum', { ascending: false })

  if (dbError) return NextResponse.json({ error: dbError.message }, { status: 500 })

  return NextResponse.json(data ?? [])
}

export async function POST(request: Request) {
  const { supabase, error } = await requireAuth()
  if (error) return error

  const body = await request.json()
  const parsed = createSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })
  }

  const d = parsed.data

  // Check for duplicate datum
  const { data: existing } = await supabase
    .from('vermoegenswarte_snapshots')
    .select('id')
    .eq('datum', d.datum)
    .maybeSingle()

  if (existing) {
    return NextResponse.json(
      { error: `Es existiert bereits ein Snapshot für das Datum ${d.datum}.` },
      { status: 409 }
    )
  }

  // Insert snapshot
  const { data: snapshot, error: snapErr } = await supabase
    .from('vermoegenswarte_snapshots')
    .insert({
      datum:                     d.datum,
      verbindlichkeiten_llv:     d.verbindlichkeiten_llv,
      verbindlichkeiten_sonstige: d.verbindlichkeiten_sonstige,
      darlehensvb:               d.darlehensvb,
      steuersaldo_typ:           d.steuersaldo_typ,
      steuersaldo:               d.steuersaldo,
      steuersaldo_von:           d.steuersaldo_von,
      steuersaldo_bis:           d.steuersaldo_bis,
      cash_bestand:              d.cash_bestand,
      anlagevermoegen:           d.anlagevermoegen,
    })
    .select('id')
    .single()

  if (snapErr) return NextResponse.json({ error: snapErr.message }, { status: 500 })

  const snapshotId = snapshot.id

  // Insert lagerwerte
  if (d.lagerwerte.length > 0) {
    const { error: lwErr } = await supabase
      .from('vermoegenswarte_lagerwerte')
      .insert(d.lagerwerte.map((l) => ({ snapshot_id: snapshotId, produkt_id: l.produkt_id, lagerwert: l.lagerwert })))
    if (lwErr) return NextResponse.json({ error: lwErr.message }, { status: 500 })
  }

  // Insert transitwerte
  if (d.transitwerte.length > 0) {
    const { error: twErr } = await supabase
      .from('vermoegenswarte_transitwerte')
      .insert(d.transitwerte.map((t) => ({
        snapshot_id:             snapshotId,
        produkt_id:              t.produkt_id,
        ausgaben_transaktion_id: t.ausgaben_transaktion_id ?? null,
        transitwert:             t.transitwert,
      })))
    if (twErr) return NextResponse.json({ error: twErr.message }, { status: 500 })
  }

  // Insert forderungen
  if (d.forderungen.length > 0) {
    const { error: fErr } = await supabase
      .from('vermoegenswarte_forderungen')
      .insert(d.forderungen.map((f) => ({ snapshot_id: snapshotId, plattform_id: f.plattform_id, betrag: f.betrag })))
    if (fErr) return NextResponse.json({ error: fErr.message }, { status: 500 })
  }

  return NextResponse.json({ id: snapshotId }, { status: 201 })
}
