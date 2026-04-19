import { NextResponse } from 'next/server'
import { z } from 'zod'
import { requireAuth } from '@/lib/supabase-server'

interface RouteContext {
  params: Promise<{ id: string }>
}

const patchSchema = z.object({
  zahlungsdatum:      z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  betrag:             z.number().positive().optional(),
  kategorie_id:       z.string().uuid().optional(),
  gruppe_id:          z.string().uuid().nullable().optional(),
  untergruppe_id:     z.string().uuid().nullable().optional(),
  sales_plattform_id: z.string().uuid().nullable().optional(),
  produkt_id:         z.string().uuid().nullable().optional(),
  beschreibung:       z.string().max(1000).nullable().optional(),
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

  if (Object.keys(parsed.data).length === 0) {
    return NextResponse.json({ error: 'Keine Felder zum Aktualisieren' }, { status: 400 })
  }

  const { data, error: dbError } = await supabase
    .from('einnahmen_transaktionen')
    .update(parsed.data)
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
    .from('einnahmen_transaktionen')
    .delete()
    .eq('id', id)

  if (dbError) return NextResponse.json({ error: dbError.message }, { status: 500 })
  return new Response(null, { status: 204 })
}
