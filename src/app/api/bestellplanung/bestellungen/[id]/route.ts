import { NextResponse } from 'next/server'
import { requireAuth } from '@/lib/supabase-server'
import { enrichBestellungen } from '../../_utils'

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/
const DATE_FIELDS = [
  'bestelldatum', 'produktionsstart_datum', 'produktionsende_datum',
  'shippingdatum', 'ankunftsdatum', 'verfuegbarkeitsdatum', 'abgeschlossen_am',
  'produktionsstart_datum_ist', 'produktionsende_datum_ist',
  'shippingdatum_ist', 'ankunftsdatum_ist', 'verfuegbarkeitsdatum_ist',
] as const

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { user, supabase, error } = await requireAuth()
  if (error) return error

  const { id } = await params

  const { data: row, error: dbErr } = await supabase
    .from('bestellungen')
    .select('id, status, herkunft, containerart, anzahl_40hq, anzahl_20dc, bestelldatum, produktionsstart_datum, produktionsende_datum, shippingdatum, ankunftsdatum, verfuegbarkeitsdatum, produktionsstart_datum_ist, produktionsende_datum_ist, shippingdatum_ist, ankunftsdatum_ist, verfuegbarkeitsdatum_ist, abgeschlossen_am, notizen, created_at, updated_at')
    .eq('id', id)
    .eq('user_id', user!.id)
    .single()

  if (dbErr || !row) return NextResponse.json({ error: 'Nicht gefunden' }, { status: 404 })

  const [enriched] = await enrichBestellungen(supabase, [row])
  return NextResponse.json(enriched)
}

export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { user, supabase, error } = await requireAuth()
  if (error) return error

  const { id } = await params
  const body = await request.json().catch(() => null)
  if (!body || typeof body !== 'object') {
    return NextResponse.json({ error: 'Ungültige Anfrage' }, { status: 400 })
  }

  const update: Record<string, unknown> = { updated_at: new Date().toISOString() }

  if ('status' in body && ['plan', 'laufend', 'abgeschlossen'].includes(body.status as string)) {
    const newStatus = body.status as string
    if (newStatus === 'laufend' || newStatus === 'abgeschlossen') {
      const { data: mitglied } = await supabase
        .from('bestellungen_konsolidierungsmitglieder')
        .select('gruppe_id')
        .eq('bestellung_id', id)
        .eq('user_id', user!.id)
        .maybeSingle()
      if (mitglied) {
        return NextResponse.json(
          { error: 'in_gruppe', konsolidierungsgruppe_id: mitglied.gruppe_id },
          { status: 409 }
        )
      }
    }
    update.status = newStatus
  }
  for (const field of DATE_FIELDS) {
    if (field in body) {
      const v = body[field]
      if (v === null || (typeof v === 'string' && DATE_RE.test(v))) update[field] = v
    }
  }
  if ('notizen' in body) {
    if (body.notizen === null || typeof body.notizen === 'string') update.notizen = body.notizen
  }
  if ('containerart' in body) {
    const CONTAINERARTEN = ['20DC', '40DC', '40HQ']
    if (body.containerart === null || CONTAINERARTEN.includes(body.containerart as string)) {
      update.containerart = body.containerart
    }
  }
  if ('anzahl_40hq' in body && typeof body.anzahl_40hq === 'number' && Number.isInteger(body.anzahl_40hq) && body.anzahl_40hq >= 0) {
    update.anzahl_40hq = body.anzahl_40hq
  }
  if ('anzahl_20dc' in body && typeof body.anzahl_20dc === 'number' && Number.isInteger(body.anzahl_20dc) && body.anzahl_20dc >= 0) {
    update.anzahl_20dc = body.anzahl_20dc
  }

  const { error: updateErr } = await supabase
    .from('bestellungen')
    .update(update)
    .eq('id', id)
    .eq('user_id', user!.id)

  if (updateErr) return NextResponse.json({ error: updateErr.message }, { status: 500 })

  if (Array.isArray(body.sku_mengen) && body.sku_mengen.length > 0) {
    for (const sm of body.sku_mengen as Array<Record<string, unknown>>) {
      if (typeof sm.sku_id !== 'string') continue
      await supabase.from('bestellungen_sku_mengen').upsert({
        bestellung_id: id,
        user_id: user!.id,
        sku_id: sm.sku_id,
        menge_theoretisch: typeof sm.menge_theoretisch === 'number' ? sm.menge_theoretisch : null,
        menge_nach_moq: typeof sm.menge_nach_moq === 'number' ? sm.menge_nach_moq : null,
        menge_praktisch: typeof sm.menge_praktisch === 'number' ? sm.menge_praktisch : 0,
        begruendung_anpassung: typeof sm.begruendung_anpassung === 'string' ? sm.begruendung_anpassung : null,
      }, { onConflict: 'bestellung_id,sku_id' })
    }
  }

  const { data: row, error: fetchErr } = await supabase
    .from('bestellungen')
    .select('id, status, herkunft, containerart, anzahl_40hq, anzahl_20dc, bestelldatum, produktionsstart_datum, produktionsende_datum, shippingdatum, ankunftsdatum, verfuegbarkeitsdatum, produktionsstart_datum_ist, produktionsende_datum_ist, shippingdatum_ist, ankunftsdatum_ist, verfuegbarkeitsdatum_ist, abgeschlossen_am, notizen, created_at, updated_at')
    .eq('id', id)
    .eq('user_id', user!.id)
    .single()

  if (fetchErr || !row) return NextResponse.json({ error: 'Nicht gefunden' }, { status: 404 })

  const [enriched] = await enrichBestellungen(supabase, [row])
  return NextResponse.json(enriched)
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  console.log('[DELETE] handler reached')
  try {
    const { user, supabase, error } = await requireAuth()
    if (error) return error

    const { id } = await params

    const { error: deleteErr } = await supabase
      .from('bestellungen')
      .delete()
      .eq('id', id)
      .eq('user_id', user!.id)

    if (deleteErr) {
      console.error('[DELETE /api/bestellplanung/bestellungen/:id] Supabase error:', deleteErr)
      return NextResponse.json({ error: deleteErr.message }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error('[DELETE /api/bestellplanung/bestellungen/:id] unhandled error:', err)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
