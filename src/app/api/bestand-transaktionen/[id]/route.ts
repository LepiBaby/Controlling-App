import { NextResponse } from 'next/server'
import { z } from 'zod'
import { requireAuth } from '@/lib/supabase-server'

interface RouteContext {
  params: Promise<{ id: string }>
}

const sendungSchema = z.object({
  plattform_id: z.string().uuid('Ungültige Plattform-ID'),
  menge:        z.number().int('Menge muss eine ganze Zahl sein').min(0, 'Menge darf nicht negativ sein'),
})

const patchSchema = z.object({
  datum:               z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Ungültiges Datumsformat (YYYY-MM-DD)'),
  anfangsbestand:      z.number().int().min(0, 'Darf nicht negativ sein'),
  einlagerungen:       z.number().int().min(0, 'Darf nicht negativ sein').default(0),
  anpassungen_positiv: z.number().int().min(0, 'Darf nicht negativ sein').default(0),
  anpassungen_negativ: z.number().int().min(0, 'Darf nicht negativ sein').default(0),
  warenverluste:       z.number().int().min(0, 'Darf nicht negativ sein').default(0),
  sendungen_manuell:   z.number().int().min(0, 'Darf nicht negativ sein').default(0),
  sendungen:           z.array(sendungSchema).default([]),
})

export async function PATCH(request: Request, { params }: RouteContext) {
  const { supabase, error } = await requireAuth()
  if (error) return error

  const { id } = await params
  const body = await request.json()
  const parsed = patchSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })
  }

  const {
    datum, anfangsbestand, einlagerungen, anpassungen_positiv,
    anpassungen_negativ, warenverluste, sendungen_manuell, sendungen,
  } = parsed.data

  // Fetch current row to get sku_id for duplicate check
  const { data: current, error: fetchError } = await supabase
    .from('bestand_transaktionen')
    .select('id, sku_id')
    .eq('id', id)
    .single()

  if (fetchError || !current) {
    return NextResponse.json({ error: 'Nicht gefunden' }, { status: 404 })
  }

  // Unique check: no other entry for same (sku_id, datum), excluding self
  const { data: conflict, error: checkError } = await supabase
    .from('bestand_transaktionen')
    .select('id')
    .eq('sku_id', current.sku_id)
    .eq('datum', datum)
    .neq('id', id)
    .limit(1)

  if (checkError) return NextResponse.json({ error: checkError.message }, { status: 500 })

  if (conflict && conflict.length > 0) {
    return NextResponse.json(
      { error: 'Für dieses Datum existiert bereits ein Eintrag für diese SKU' },
      { status: 409 },
    )
  }

  // Update Transaktion header
  const { data: updated, error: updateError } = await supabase
    .from('bestand_transaktionen')
    .update({
      datum, anfangsbestand, einlagerungen, anpassungen_positiv,
      anpassungen_negativ, warenverluste, sendungen_manuell,
    })
    .eq('id', id)
    .select()
    .single()

  if (updateError || !updated) {
    return NextResponse.json({ error: updateError?.message ?? 'Fehler beim Aktualisieren' }, { status: 500 })
  }

  // Replace Sendungen: delete existing, insert new
  const { error: deleteError } = await supabase
    .from('bestand_sendungen')
    .delete()
    .eq('transaktion_id', id)

  if (deleteError) return NextResponse.json({ error: deleteError.message }, { status: 500 })

  if (sendungen.length > 0) {
    const { error: insertError } = await supabase
      .from('bestand_sendungen')
      .insert(sendungen.map(s => ({
        transaktion_id: id,
        plattform_id:   s.plattform_id,
        menge:          s.menge,
      })))

    if (insertError) return NextResponse.json({ error: insertError.message }, { status: 500 })
  }

  return NextResponse.json({ ...updated, sendungen })
}

export async function DELETE(request: Request, { params }: RouteContext) {
  const { supabase, error } = await requireAuth()
  if (error) return error

  const { id } = await params

  const { error: dbError } = await supabase
    .from('bestand_transaktionen')
    .delete()
    .eq('id', id)

  if (dbError) return NextResponse.json({ error: dbError.message }, { status: 500 })
  return new Response(null, { status: 204 })
}
