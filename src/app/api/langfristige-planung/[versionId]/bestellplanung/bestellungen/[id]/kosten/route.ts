import { NextResponse } from 'next/server'
import { z } from 'zod'
import { requireAuth } from '@/lib/supabase-server'
import { ensureLangfristigeVersion } from '@/lib/langfristige-version'
import { generiereUndSpeichereLangfristigeBestellkosten } from './_kosten-utils'

// Auth-geschützte, pro-Planversion dynamische Route — nie statisch generieren.
export const dynamic = 'force-dynamic'

// PROJ-86: Bestellkosten je Bestellung (Langfristige Planung). Beim Laden werden
// die Auto-Kosten aus den Produktinformationen DIESER Version neu generiert
// (wie kurzfristig PROJ-64). Manuelle Einträge können angelegt werden.

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/

const postSchema = z.object({
  kpi_kategorie_id: z.string().uuid().nullable().optional(),
  datum: z.string().regex(DATE_RE),
  nettobetrag: z.number().min(0),
  begruendung: z.string().nullable().optional(),
})

interface RouteContext {
  params: Promise<{ versionId: string; id: string }>
}

async function resolveKategorieNamen(
  supabase: Awaited<ReturnType<typeof requireAuth>>['supabase'],
  rows: Array<{ kpi_kategorie_id: string | null }>,
): Promise<Map<string, string>> {
  const catIds = [...new Set(rows.map((k) => k.kpi_kategorie_id).filter(Boolean) as string[])]
  const map = new Map<string, string>()
  if (catIds.length === 0) return map
  const { data: cats } = await supabase.from('kpi_categories').select('id, name').in('id', catIds)
  for (const c of (cats ?? []) as Array<{ id: string; name: string }>) map.set(c.id, c.name)
  return map
}

export async function GET(_request: Request, { params }: RouteContext) {
  const { user, supabase, error } = await requireAuth()
  if (error) return error

  const { versionId, id } = await params
  const versionError = await ensureLangfristigeVersion(supabase, user!.id, versionId)
  if (versionError) return versionError
  if (!UUID_REGEX.test(id)) {
    return NextResponse.json({ error: 'Ungültige ID' }, { status: 400 })
  }

  // Bestellung mit den für die Kostengenerierung nötigen Feldern laden.
  const { data: bestellung, error: bErr } = await supabase
    .from('langfristige_bestellungen')
    .select(
      'id, produkt_id, menge_praktisch, bestelldatum, produktionsende_datum, shippingdatum, ankunftsdatum, verfuegbarkeitsdatum, anzahl_20dc, anzahl_40hq, container_anteil',
    )
    .eq('user_id', user!.id)
    .eq('plan_version_id', versionId)
    .eq('id', id)
    .maybeSingle()

  if (bErr) return NextResponse.json({ error: bErr.message }, { status: 500 })
  if (!bestellung) return NextResponse.json({ error: 'Bestellung nicht gefunden' }, { status: 404 })

  const b = bestellung as {
    id: string
    produkt_id: string
    menge_praktisch: number
    bestelldatum: string | null
    produktionsende_datum: string | null
    shippingdatum: string | null
    ankunftsdatum: string | null
    verfuegbarkeitsdatum: string | null
    anzahl_20dc: number | null
    anzahl_40hq: number | null
    container_anteil: Record<string, number> | null
  }

  // Auto-Kosten aus den aktuellen Versions-Einstellungen neu generieren.
  await generiereUndSpeichereLangfristigeBestellkosten(supabase, user!.id, versionId, [
    {
      id: b.id,
      produkt_id: b.produkt_id,
      menge_praktisch: b.menge_praktisch,
      bestelldatum: b.bestelldatum,
      produktionsende_datum: b.produktionsende_datum,
      shippingdatum: b.shippingdatum,
      ankunftsdatum: b.ankunftsdatum,
      verfuegbarkeitsdatum: b.verfuegbarkeitsdatum,
      anzahl_40hq: b.anzahl_40hq ?? 0,
      anzahl_20dc: b.anzahl_20dc ?? 0,
      container_anteil: b.container_anteil,
    },
  ])

  const { data: kosten, error: kErr } = await supabase
    .from('langfristige_bestellungen_kosten')
    .select('id, kpi_kategorie_id, datum, nettobetrag, begruendung, ist_automatisch, created_at')
    .eq('user_id', user!.id)
    .eq('plan_version_id', versionId)
    .eq('bestellung_id', id)
    .order('datum', { ascending: true })
    .limit(500)

  if (kErr) return NextResponse.json({ error: kErr.message }, { status: 500 })

  const rows = (kosten ?? []) as Array<{ kpi_kategorie_id: string | null }>
  const catMap = await resolveKategorieNamen(supabase, rows)
  const result = (kosten ?? []).map((k) => ({
    ...k,
    kpi_kategorie_name: k.kpi_kategorie_id ? catMap.get(k.kpi_kategorie_id) ?? null : null,
  }))

  return NextResponse.json(result)
}

export async function POST(request: Request, { params }: RouteContext) {
  const { user, supabase, error } = await requireAuth()
  if (error) return error

  const { versionId, id } = await params
  const versionError = await ensureLangfristigeVersion(supabase, user!.id, versionId)
  if (versionError) return versionError
  if (!UUID_REGEX.test(id)) {
    return NextResponse.json({ error: 'Ungültige ID' }, { status: 400 })
  }

  // Bestellung muss zur Version & zum Nutzer gehören (keine Status-Prüfung — in der
  // LP sind alle Bestellungen gleichberechtigt bearbeitbar).
  const { data: bestellung, error: bErr } = await supabase
    .from('langfristige_bestellungen')
    .select('id')
    .eq('id', id)
    .eq('user_id', user!.id)
    .eq('plan_version_id', versionId)
    .maybeSingle()
  if (bErr) return NextResponse.json({ error: bErr.message }, { status: 500 })
  if (!bestellung) return NextResponse.json({ error: 'Bestellung nicht gefunden' }, { status: 404 })

  const body = await request.json().catch(() => null)
  const parsed = postSchema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })
  const d = parsed.data

  const { data: inserted, error: iErr } = await supabase
    .from('langfristige_bestellungen_kosten')
    .insert({
      bestellung_id: id,
      user_id: user!.id,
      plan_version_id: versionId,
      kpi_kategorie_id: d.kpi_kategorie_id ?? null,
      datum: d.datum,
      nettobetrag: d.nettobetrag,
      begruendung: d.begruendung ?? null,
      ist_automatisch: false,
    })
    .select('id, kpi_kategorie_id, datum, nettobetrag, begruendung, ist_automatisch, created_at')
    .single()

  if (iErr || !inserted) {
    return NextResponse.json({ error: iErr?.message ?? 'Erstellen fehlgeschlagen' }, { status: 500 })
  }

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
