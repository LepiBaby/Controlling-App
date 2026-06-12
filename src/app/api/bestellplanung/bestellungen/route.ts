import { NextResponse } from 'next/server'
import { z } from 'zod'
import { requireAuth } from '@/lib/supabase-server'
import { enrichBestellungen } from '../_utils'

const STATUS_VALUES = ['plan', 'laufend', 'abgeschlossen'] as const

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/
const dateOrNull = z.string().regex(DATE_RE).nullable().optional()

const postSchema = z.object({
  status: z.enum(STATUS_VALUES).default('plan'),
  herkunft: z.enum(['algorithmus', 'manuell']).default('algorithmus'),
  containerart: z.enum(['20DC', '40DC', '40HQ']).nullable().optional(),
  anzahl_40hq: z.number().int().min(0).default(0),
  anzahl_20dc: z.number().int().min(0).default(0),
  bestelldatum: dateOrNull,
  produktionsstart_datum: dateOrNull,
  produktionsende_datum: dateOrNull,
  shippingdatum: dateOrNull,
  ankunftsdatum: dateOrNull,
  verfuegbarkeitsdatum: dateOrNull,
  notizen: z.string().nullable().optional(),
  produkt_ids: z.array(z.string().uuid()).min(1),
  sku_mengen: z.array(z.object({
    sku_id: z.string().uuid(),
    menge_theoretisch: z.number().int().min(0).nullable().optional(),
    menge_praktisch: z.number().int().min(0),
    begruendung_anpassung: z.string().nullable().optional(),
  })).default([]),
})

export async function GET(request: Request) {
  const { user, supabase, error } = await requireAuth()
  if (error) return error

  const { searchParams } = new URL(request.url)
  const statusParam = searchParams.get('status')

  if (!statusParam || !STATUS_VALUES.includes(statusParam as typeof STATUS_VALUES[number])) {
    return NextResponse.json({ error: 'Ungültiger Status' }, { status: 400 })
  }

  const { data: baseRows, error: dbErr } = await supabase
    .from('bestellungen')
    .select('id, status, herkunft, containerart, anzahl_40hq, anzahl_20dc, bestelldatum, produktionsstart_datum, produktionsende_datum, shippingdatum, ankunftsdatum, verfuegbarkeitsdatum, produktionsstart_datum_ist, produktionsende_datum_ist, shippingdatum_ist, ankunftsdatum_ist, verfuegbarkeitsdatum_ist, abgeschlossen_am, notizen, created_at, updated_at')
    .eq('user_id', user!.id)
    .eq('status', statusParam)
    .order('bestelldatum', { ascending: true, nullsFirst: false })
    .limit(200)

  if (dbErr) return NextResponse.json({ error: dbErr.message }, { status: 500 })

  const enriched = await enrichBestellungen(supabase, baseRows ?? [])
  return NextResponse.json(enriched)
}

export async function POST(request: Request) {
  const { user, supabase, error } = await requireAuth()
  if (error) return error

  const body = await request.json().catch(() => null)
  const parsed = postSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })
  }

  const d = parsed.data

  const { data: bestellung, error: insertErr } = await supabase
    .from('bestellungen')
    .insert({
      user_id: user!.id,
      status: d.status,
      herkunft: d.herkunft,
      containerart: d.containerart ?? null,
      anzahl_40hq: d.anzahl_40hq,
      anzahl_20dc: d.anzahl_20dc,
      bestelldatum: d.bestelldatum ?? null,
      produktionsstart_datum: d.produktionsstart_datum ?? null,
      produktionsende_datum: d.produktionsende_datum ?? null,
      shippingdatum: d.shippingdatum ?? null,
      ankunftsdatum: d.ankunftsdatum ?? null,
      verfuegbarkeitsdatum: d.verfuegbarkeitsdatum ?? null,
      notizen: d.notizen ?? null,
    })
    .select('id, status, herkunft, containerart, anzahl_40hq, anzahl_20dc, bestelldatum, produktionsstart_datum, produktionsende_datum, shippingdatum, ankunftsdatum, verfuegbarkeitsdatum, produktionsstart_datum_ist, produktionsende_datum_ist, shippingdatum_ist, ankunftsdatum_ist, verfuegbarkeitsdatum_ist, abgeschlossen_am, notizen, created_at, updated_at')
    .single()

  if (insertErr || !bestellung) {
    return NextResponse.json({ error: insertErr?.message ?? 'Erstellen fehlgeschlagen' }, { status: 500 })
  }

  const bid = bestellung.id

  if (d.produkt_ids.length > 0) {
    await supabase.from('bestellungen_produkte').insert(
      d.produkt_ids.map(pid => ({ bestellung_id: bid, produkt_id: pid, user_id: user!.id }))
    )
  }

  if (d.sku_mengen.length > 0) {
    await supabase.from('bestellungen_sku_mengen').insert(
      d.sku_mengen.map(sm => ({
        bestellung_id: bid,
        user_id: user!.id,
        sku_id: sm.sku_id,
        menge_theoretisch: sm.menge_theoretisch ?? null,
        menge_praktisch: sm.menge_praktisch,
        begruendung_anpassung: sm.begruendung_anpassung ?? null,
      }))
    )
  }

  const [enriched] = await enrichBestellungen(supabase, [bestellung])
  return NextResponse.json(enriched, { status: 201 })
}
