import { NextResponse } from 'next/server'
import { requireAuth } from '@/lib/supabase-server'
import { enrichBestellungen } from '../../_utils'

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/
const DATE_FIELDS = [
  'bestelldatum', 'produktionsstart_datum', 'produktionsende_datum',
  'shippingdatum', 'ankunftsdatum', 'verfuegbarkeitsdatum', 'abgeschlossen_am',
] as const

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { user, supabase, error } = await requireAuth()
  if (error) return error

  const { id } = await params

  const { data: row, error: dbErr } = await supabase
    .from('bestellungen')
    .select('id, status, bestelldatum, produktionsstart_datum, produktionsende_datum, shippingdatum, ankunftsdatum, verfuegbarkeitsdatum, abgeschlossen_am, notizen, created_at, updated_at')
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
    update.status = body.status
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
        menge_praktisch: typeof sm.menge_praktisch === 'number' ? sm.menge_praktisch : 0,
        begruendung_anpassung: typeof sm.begruendung_anpassung === 'string' ? sm.begruendung_anpassung : null,
      }, { onConflict: 'bestellung_id,sku_id' })
    }
  }

  const { data: row, error: fetchErr } = await supabase
    .from('bestellungen')
    .select('id, status, bestelldatum, produktionsstart_datum, produktionsende_datum, shippingdatum, ankunftsdatum, verfuegbarkeitsdatum, abgeschlossen_am, notizen, created_at, updated_at')
    .eq('id', id)
    .eq('user_id', user!.id)
    .single()

  if (fetchErr || !row) return NextResponse.json({ error: 'Nicht gefunden' }, { status: 404 })

  const [enriched] = await enrichBestellungen(supabase, [row])
  return NextResponse.json(enriched)
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { user, supabase, error } = await requireAuth()
  if (error) return error

  const { id } = await params

  const { error: deleteErr } = await supabase
    .from('bestellungen')
    .delete()
    .eq('id', id)
    .eq('user_id', user!.id)

  if (deleteErr) return NextResponse.json({ error: deleteErr.message }, { status: 500 })

  return NextResponse.json({ success: true })
}
