import { NextResponse } from 'next/server'
import { z } from 'zod'
import { requireAuth } from '@/lib/supabase-server'

const sendungSchema = z.object({
  plattform_id: z.string().uuid('Ungültige Plattform-ID'),
  menge:        z.number().int('Menge muss eine ganze Zahl sein').min(0, 'Menge darf nicht negativ sein'),
})

const createSchema = z.object({
  sku_id:             z.string().uuid('Ungültige SKU-ID'),
  produkt_id:         z.string().uuid('Ungültige Produkt-ID'),
  datum:              z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Ungültiges Datumsformat (YYYY-MM-DD)'),
  anfangsbestand:     z.number().int().min(0, 'Darf nicht negativ sein'),
  einlagerungen:      z.number().int().min(0, 'Darf nicht negativ sein').default(0),
  anpassungen_positiv: z.number().int().min(0, 'Darf nicht negativ sein').default(0),
  anpassungen_negativ: z.number().int().min(0, 'Darf nicht negativ sein').default(0),
  warenverluste:      z.number().int().min(0, 'Darf nicht negativ sein').default(0),
  sendungen_manuell:  z.number().int().min(0, 'Darf nicht negativ sein').default(0),
  sendungen:          z.array(sendungSchema).default([]),
})

export async function GET(request: Request) {
  const { supabase, error } = await requireAuth()
  if (error) return error

  const { searchParams } = new URL(request.url)
  const skuId = searchParams.get('sku_id')

  if (!skuId) {
    return NextResponse.json({ error: 'sku_id ist erforderlich' }, { status: 400 })
  }

  const query = supabase
    .from('bestand_transaktionen')
    .select('*, sendungen:bestand_sendungen(*)')
    .eq('sku_id', skuId)
    .order('datum', { ascending: false })

  const { data, error: dbError } = await query

  if (dbError) return NextResponse.json({ error: dbError.message }, { status: 500 })

  return NextResponse.json({ data: data ?? [] })
}

export async function POST(request: Request) {
  const { supabase, error } = await requireAuth()
  if (error) return error

  const body = await request.json()
  const parsed = createSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })
  }

  const {
    sku_id, produkt_id, datum,
    anfangsbestand, einlagerungen, anpassungen_positiv,
    anpassungen_negativ, warenverluste, sendungen_manuell,
    sendungen,
  } = parsed.data

  // Unique check: one entry per (sku_id, datum)
  const { data: existing, error: checkError } = await supabase
    .from('bestand_transaktionen')
    .select('id')
    .eq('sku_id', sku_id)
    .eq('datum', datum)
    .limit(1)

  if (checkError) return NextResponse.json({ error: checkError.message }, { status: 500 })

  if (existing && existing.length > 0) {
    return NextResponse.json(
      { error: 'Für dieses Datum existiert bereits ein Eintrag für diese SKU' },
      { status: 409 },
    )
  }

  // Insert Transaktion
  const { data: transaktion, error: insertError } = await supabase
    .from('bestand_transaktionen')
    .insert({
      sku_id, produkt_id, datum,
      anfangsbestand, einlagerungen, anpassungen_positiv,
      anpassungen_negativ, warenverluste, sendungen_manuell,
    })
    .select()
    .single()

  if (insertError || !transaktion) {
    return NextResponse.json({ error: insertError?.message ?? 'Fehler beim Anlegen' }, { status: 500 })
  }

  // Insert Sendungen — nur Plattformen mit Menge > 0. 0-Zeilen würden später das
  // Löschen der Plattform blockieren (bestand_sendungen.plattform_id ist NOT NULL).
  const sendungenToInsert = sendungen.filter(s => s.menge > 0)
  if (sendungenToInsert.length > 0) {
    const { error: sendungenError } = await supabase
      .from('bestand_sendungen')
      .insert(sendungenToInsert.map(s => ({
        transaktion_id: transaktion.id,
        plattform_id:   s.plattform_id,
        menge:          s.menge,
      })))

    if (sendungenError) {
      return NextResponse.json({ error: sendungenError.message }, { status: 500 })
    }
  }

  return NextResponse.json({ ...transaktion, sendungen }, { status: 201 })
}
