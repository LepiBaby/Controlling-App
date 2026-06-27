import { NextResponse } from 'next/server'
import { z } from 'zod'
import { requireAuth } from '@/lib/supabase-server'

const patchSchema = z.object({
  name: z.string().min(1).max(100).transform(s => s.trim()).optional(),
  sku_code: z.string().min(1).max(100).transform(s => s.trim()).optional(),
  sort_order: z.number().int().min(0).optional(),
  parent_id: z.string().uuid().nullable().optional(),
  level: z.union([z.literal(1), z.literal(2), z.literal(3)]).optional(),
  sales_plattform_enabled: z.boolean().optional(),
  produkt_enabled: z.boolean().optional(),
  kosten_label: z.string().max(100).nullable().optional(),
  ausgaben_label: z.string().max(100).nullable().optional(),
  ist_abzugsposten: z.boolean().optional(),
  ust_satz: z.number().min(0).max(100).nullable().optional(),
  exclude_from_rentabilitaet: z.boolean().optional(),
})

interface RouteContext {
  params: Promise<{ id: string }>
}

export async function PATCH(request: Request, { params }: RouteContext) {
  const { user, supabase, error } = await requireAuth()
  if (error) return error

  const { id } = await params
  const body = await request.json()
  const parsed = patchSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })
  }

  if (Object.keys(parsed.data).length === 0) {
    return NextResponse.json({ error: 'No fields to update' }, { status: 400 })
  }

  const { data, error: dbError } = await supabase
    .from('kpi_categories')
    .update(parsed.data)
    .eq('id', id)
    .select()
    .single()

  if (dbError) return NextResponse.json({ error: dbError.message }, { status: 500 })
  if (!data) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  return NextResponse.json(data)
}

export async function DELETE(request: Request, { params }: RouteContext) {
  const { user, supabase, error } = await requireAuth()
  if (error) return error

  const { id } = await params

  // Sales-Plattformen sind in bestand_sendungen.plattform_id per NOT-NULL-Spalte
  // referenziert (FK ist ON DELETE SET NULL, was an der NOT-NULL-Sperre scheitern
  // würde). Statt eines kryptischen DB-Fehlers blockieren wir das Löschen sauber,
  // solange noch Sendungen verknüpft sind.
  const { count: sendungenCount, error: countError } = await supabase
    .from('bestand_sendungen')
    .select('id', { count: 'exact', head: true })
    .eq('plattform_id', id)

  if (countError) return NextResponse.json({ error: countError.message }, { status: 500 })
  if (sendungenCount && sendungenCount > 0) {
    return NextResponse.json(
      {
        error: `Diese Plattform kann nicht gelöscht werden, da ihr noch ${sendungenCount} ${
          sendungenCount === 1 ? 'Sendung' : 'Sendungen'
        } in der Bestandsverwaltung zugeordnet ${sendungenCount === 1 ? 'ist' : 'sind'}. ` +
          'Bitte ordne die betroffenen Sendungen zuerst einer anderen Plattform zu oder lösche sie.',
      },
      { status: 409 },
    )
  }

  const { error: dbError } = await supabase
    .from('kpi_categories')
    .delete()
    .eq('id', id)

  if (dbError) return NextResponse.json({ error: dbError.message }, { status: 500 })
  return new Response(null, { status: 204 })
}
