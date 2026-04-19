import { NextResponse } from 'next/server'
import { z } from 'zod'
import { requireAuth } from '@/lib/supabase-server'

const wertSchema = z.object({
  kategorie_id: z.string().uuid('Ungültige Kategorie-ID'),
  wert: z.number().min(0, 'Wert darf nicht negativ sein'),
})

const createSchema = z.object({
  produkt_id:  z.string().uuid('Ungültige Produkt-ID'),
  gueltig_von: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Ungültiges Datumsformat (YYYY-MM-DD)'),
  gueltig_bis: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Ungültiges Datumsformat (YYYY-MM-DD)').nullable().optional(),
  werte:       z.array(wertSchema),
}).refine(d => !d.gueltig_bis || d.gueltig_bis >= d.gueltig_von, {
  message: 'Gültig bis muss nach oder gleich Gültig von liegen',
  path: ['gueltig_bis'],
})

export async function GET(request: Request) {
  const { supabase, error } = await requireAuth()
  if (error) return error

  const { searchParams } = new URL(request.url)
  const produktId = searchParams.get('produkt_id')

  if (!produktId) {
    return NextResponse.json({ error: 'produkt_id ist erforderlich' }, { status: 400 })
  }

  const { data, error: dbError } = await supabase
    .from('produktkosten_zeitraeume')
    .select('*, werte:produktkosten_werte(*)')
    .eq('produkt_id', produktId)
    .order('gueltig_von', { ascending: true })

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

  const { produkt_id, gueltig_von, gueltig_bis, werte } = parsed.data

  // Overlap check — handles nullable gueltig_bis on both sides
  const overlapBase = supabase
    .from('produktkosten_zeitraeume')
    .select('id, gueltig_von, gueltig_bis')
    .eq('produkt_id', produkt_id)
    .or(`gueltig_bis.gte.${gueltig_von},gueltig_bis.is.null`)

  const { data: overlapping, error: overlapError } = gueltig_bis
    ? await overlapBase.lte('gueltig_von', gueltig_bis)
    : await overlapBase

  if (overlapError) return NextResponse.json({ error: overlapError.message }, { status: 500 })

  if (overlapping && overlapping.length > 0) {
    const c = overlapping[0]
    return NextResponse.json({
      error: `Dieser Zeitraum überschneidet sich mit einem bestehenden Eintrag (${c.gueltig_von} – ${c.gueltig_bis})`,
    }, { status: 409 })
  }

  // Insert Zeitraum
  const { data: zeitraum, error: insertError } = await supabase
    .from('produktkosten_zeitraeume')
    .insert({ produkt_id, gueltig_von, gueltig_bis })
    .select()
    .single()

  if (insertError || !zeitraum) {
    return NextResponse.json({ error: insertError?.message ?? 'Fehler beim Anlegen' }, { status: 500 })
  }

  // Insert Werte
  if (werte.length > 0) {
    const { error: werteError } = await supabase
      .from('produktkosten_werte')
      .insert(werte.map(w => ({ zeitraum_id: zeitraum.id, kategorie_id: w.kategorie_id, wert: w.wert })))

    if (werteError) {
      return NextResponse.json({ error: werteError.message }, { status: 500 })
    }
  }

  return NextResponse.json({ ...zeitraum, werte }, { status: 201 })
}
