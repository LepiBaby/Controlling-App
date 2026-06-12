import { NextResponse } from 'next/server'
import { z } from 'zod'
import { requireAuth } from '@/lib/supabase-server'
import { generiereUndSpeichereBestellkosten } from '../../../_utils'

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/

const postSchema = z.object({
  kpi_kategorie_id: z.string().uuid().nullable().optional(),
  datum: z.string().regex(DATE_RE),
  nettobetrag: z.number().min(0),
  begruendung: z.string().nullable().optional(),
})

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { user, supabase, error } = await requireAuth()
  if (error) return error

  const { id } = await params

  // Load bestellung with fields needed for cost regeneration
  const { data: bestellung, error: bErr } = await supabase
    .from('bestellungen')
    .select('id, bestelldatum, produktionsende_datum, shippingdatum, ankunftsdatum, verfuegbarkeitsdatum, anzahl_40hq, anzahl_20dc')
    .eq('id', id)
    .eq('user_id', user!.id)
    .maybeSingle()

  if (bErr || !bestellung) return NextResponse.json({ error: 'Nicht gefunden' }, { status: 404 })

  // Load produkt_ids for this bestellung
  const { data: produkteRows } = await supabase
    .from('bestellungen_produkte')
    .select('produkt_id')
    .eq('bestellung_id', id)

  const produkt_ids = (produkteRows ?? []).map((p: { produkt_id: string }) => p.produkt_id)

  // Regenerate auto costs from current Stammdaten on every load
  const b = bestellung as {
    id: string; bestelldatum: string | null; produktionsende_datum: string | null
    shippingdatum: string | null; ankunftsdatum: string | null; verfuegbarkeitsdatum: string | null
    anzahl_40hq: number; anzahl_20dc: number
  }
  await generiereUndSpeichereBestellkosten(supabase, user!.id, [{
    id: b.id,
    bestelldatum: b.bestelldatum,
    produktionsende_datum: b.produktionsende_datum,
    shippingdatum: b.shippingdatum,
    ankunftsdatum: b.ankunftsdatum,
    verfuegbarkeitsdatum: b.verfuegbarkeitsdatum,
    anzahl_40hq: b.anzahl_40hq,
    anzahl_20dc: b.anzahl_20dc,
    produkt_ids,
    sku_mengen: [],
  }])

  const { data: kosten, error: kErr } = await supabase
    .from('bestellungen_kosten')
    .select('id, kpi_kategorie_id, datum, nettobetrag, begruendung, ist_automatisch, created_at')
    .eq('bestellung_id', id)
    .eq('user_id', user!.id)
    .order('datum', { ascending: true })
    .limit(200)

  if (kErr) return NextResponse.json({ error: kErr.message }, { status: 500 })

  const kostenRows = kosten ?? []

  // Resolve category names
  const catIds = [...new Set(kostenRows.map(k => k.kpi_kategorie_id).filter(Boolean) as string[])]
  let catNameMap = new Map<string, string>()
  if (catIds.length > 0) {
    const { data: cats } = await supabase
      .from('kpi_categories')
      .select('id, name')
      .in('id', catIds)
    for (const c of (cats ?? []) as Array<{ id: string; name: string }>) {
      catNameMap.set(c.id, c.name)
    }
  }

  const result = kostenRows.map(k => ({
    ...k,
    kpi_kategorie_name: k.kpi_kategorie_id ? (catNameMap.get(k.kpi_kategorie_id) ?? null) : null,
  }))

  return NextResponse.json(result)
}

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { user, supabase, error } = await requireAuth()
  if (error) return error

  const { id } = await params

  // Verify bestellung exists and belongs to user with status 'plan'
  const { data: bestellung, error: bErr } = await supabase
    .from('bestellungen')
    .select('id, status')
    .eq('id', id)
    .eq('user_id', user!.id)
    .maybeSingle()

  if (bErr || !bestellung) return NextResponse.json({ error: 'Nicht gefunden' }, { status: 404 })
  if (bestellung.status !== 'plan') {
    return NextResponse.json({ error: 'Kosten können nur bei Planbestellungen manuell angelegt werden' }, { status: 403 })
  }

  const body = await request.json().catch(() => null)
  const parsed = postSchema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })

  const d = parsed.data

  const { data: inserted, error: iErr } = await supabase
    .from('bestellungen_kosten')
    .insert({
      bestellung_id: id,
      user_id: user!.id,
      kpi_kategorie_id: d.kpi_kategorie_id ?? null,
      datum: d.datum,
      nettobetrag: d.nettobetrag,
      begruendung: d.begruendung ?? null,
      ist_automatisch: false,
    })
    .select('id, kpi_kategorie_id, datum, nettobetrag, begruendung, ist_automatisch, created_at')
    .single()

  if (iErr || !inserted) return NextResponse.json({ error: iErr?.message ?? 'Erstellen fehlgeschlagen' }, { status: 500 })

  let kpi_kategorie_name: string | null = null
  if (inserted.kpi_kategorie_id) {
    const { data: cat } = await supabase
      .from('kpi_categories')
      .select('name')
      .eq('id', inserted.kpi_kategorie_id)
      .maybeSingle()
    kpi_kategorie_name = (cat as { name: string } | null)?.name ?? null
  }

  return NextResponse.json({ ...inserted, kpi_kategorie_name }, { status: 201 })
}
