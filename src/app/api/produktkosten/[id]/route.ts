import { NextResponse } from 'next/server'
import { z } from 'zod'
import { requireAuth } from '@/lib/supabase-server'

interface RouteContext {
  params: Promise<{ id: string }>
}

const wertSchema = z.object({
  kategorie_id: z.string().uuid('Ungültige Kategorie-ID'),
  wert: z.number().min(0, 'Wert darf nicht negativ sein'),
})

const patchSchema = z.object({
  gueltig_von: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Ungültiges Datumsformat (YYYY-MM-DD)'),
  gueltig_bis: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Ungültiges Datumsformat (YYYY-MM-DD)').nullable().optional(),
  werte:       z.array(wertSchema),
}).refine(d => !d.gueltig_bis || d.gueltig_bis >= d.gueltig_von, {
  message: 'Gültig bis muss nach oder gleich Gültig von liegen',
  path: ['gueltig_bis'],
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

  const { gueltig_von, gueltig_bis, werte } = parsed.data

  // Fetch current row to get produkt_id for overlap check
  const { data: current, error: fetchError } = await supabase
    .from('produktkosten_zeitraeume')
    .select('id, produkt_id')
    .eq('id', id)
    .single()

  if (fetchError || !current) {
    return NextResponse.json({ error: 'Nicht gefunden' }, { status: 404 })
  }

  // Overlap check (excluding self) — handles nullable gueltig_bis on both sides
  const overlapBase = supabase
    .from('produktkosten_zeitraeume')
    .select('id, gueltig_von, gueltig_bis')
    .eq('produkt_id', current.produkt_id)
    .neq('id', id)
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

  // Update Zeitraum header
  const { data: updated, error: updateError } = await supabase
    .from('produktkosten_zeitraeume')
    .update({ gueltig_von, gueltig_bis })
    .eq('id', id)
    .select()
    .single()

  if (updateError || !updated) {
    return NextResponse.json({ error: updateError?.message ?? 'Fehler beim Aktualisieren' }, { status: 500 })
  }

  // Replace Werte: delete existing, insert new
  const { error: deleteError } = await supabase
    .from('produktkosten_werte')
    .delete()
    .eq('zeitraum_id', id)

  if (deleteError) return NextResponse.json({ error: deleteError.message }, { status: 500 })

  if (werte.length > 0) {
    const { error: insertError } = await supabase
      .from('produktkosten_werte')
      .insert(werte.map(w => ({ zeitraum_id: id, kategorie_id: w.kategorie_id, wert: w.wert })))

    if (insertError) return NextResponse.json({ error: insertError.message }, { status: 500 })
  }

  return NextResponse.json({ ...updated, werte })
}

export async function DELETE(request: Request, { params }: RouteContext) {
  const { supabase, error } = await requireAuth()
  if (error) return error

  const { id } = await params

  const { error: dbError } = await supabase
    .from('produktkosten_zeitraeume')
    .delete()
    .eq('id', id)

  if (dbError) return NextResponse.json({ error: dbError.message }, { status: 500 })
  return new Response(null, { status: 204 })
}
