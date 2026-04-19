import { NextResponse } from 'next/server'
import { z } from 'zod'
import { requireAuth } from '@/lib/supabase-server'

interface RouteContext {
  params: Promise<{ id: string }>
}

const patchSchema = z.object({
  leistungsdatum:              z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  zahlungsdatum:               z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().optional(),
  betrag_brutto:               z.number().positive().optional(),
  ust_satz:                    z.enum(['19', '7', '0', 'individuell']).optional(),
  ust_betrag:                  z.number().min(0).optional(),
  kategorie_id:                z.string().uuid().optional(),
  gruppe_id:                   z.string().uuid().nullable().optional(),
  untergruppe_id:              z.string().uuid().nullable().optional(),
  sales_plattform_id:          z.string().uuid().nullable().optional(),
  produkt_id:                  z.string().uuid().nullable().optional(),
  beschreibung:                z.string().max(1000).nullable().optional(),
  relevanz:                    z.enum(['rentabilitaet', 'liquiditaet', 'beides']).optional(),
  abschreibung:                z.enum(['3_jahre', '5_jahre', '7_jahre', '10_jahre']).nullable().optional(),
})

function computeUstBetrag(brutto: number, ustSatz: string, ustBetragManual: number): number {
  if (ustSatz === '19') return Math.round(brutto * 19 / 119 * 100) / 100
  if (ustSatz === '7')  return Math.round(brutto * 7  / 107 * 100) / 100
  if (ustSatz === '0')  return 0
  return ustBetragManual
}

export async function PATCH(request: Request, { params }: RouteContext) {
  const { supabase, error } = await requireAuth()
  if (error) return error

  const { id } = await params
  const body = await request.json()
  const parsed = patchSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })
  }

  if (Object.keys(parsed.data).length === 0) {
    return NextResponse.json({ error: 'Keine Felder zum Aktualisieren' }, { status: 400 })
  }

  const d = parsed.data
  const updates: Record<string, unknown> = { ...d }

  // Recalculate netto if brutto or ust fields are being updated
  if (d.betrag_brutto !== undefined || d.ust_satz !== undefined || d.ust_betrag !== undefined) {
    // Fetch current row to fill in any missing fields for calculation
    const { data: current, error: fetchError } = await supabase
      .from('ausgaben_kosten_transaktionen')
      .select('betrag_brutto, ust_satz, ust_betrag')
      .eq('id', id)
      .single()

    if (fetchError || !current) {
      return NextResponse.json({ error: 'Nicht gefunden' }, { status: 404 })
    }

    const brutto   = d.betrag_brutto ?? Number(current.betrag_brutto)
    const ustSatz  = d.ust_satz ?? current.ust_satz
    const ustBetragManual = d.ust_betrag ?? Number(current.ust_betrag)

    const ustBetrag  = computeUstBetrag(brutto, ustSatz, ustBetragManual)
    const betragNetto = Math.round((brutto - ustBetrag) * 100) / 100

    if (betragNetto < 0) {
      return NextResponse.json({ error: 'USt-Betrag darf den Bruttobetrag nicht überschreiten' }, { status: 400 })
    }

    updates.ust_betrag   = ustBetrag
    updates.betrag_netto = betragNetto
  }

  const { data, error: dbError } = await supabase
    .from('ausgaben_kosten_transaktionen')
    .update(updates)
    .eq('id', id)
    .select()
    .single()

  if (dbError) return NextResponse.json({ error: dbError.message }, { status: 500 })
  if (!data) return NextResponse.json({ error: 'Nicht gefunden' }, { status: 404 })
  return NextResponse.json(data)
}

export async function DELETE(request: Request, { params }: RouteContext) {
  const { supabase, error } = await requireAuth()
  if (error) return error

  const { id } = await params

  const { error: dbError } = await supabase
    .from('ausgaben_kosten_transaktionen')
    .delete()
    .eq('id', id)

  if (dbError) return NextResponse.json({ error: dbError.message }, { status: 500 })
  return new Response(null, { status: 204 })
}
