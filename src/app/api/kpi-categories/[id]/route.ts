import { NextResponse } from 'next/server'
import { z } from 'zod'
import { requireAuth } from '@/lib/supabase-server'

const patchSchema = z.object({
  name: z.string().min(1).max(100).transform(s => s.trim()).optional(),
  sort_order: z.number().int().min(0).optional(),
  parent_id: z.string().uuid().nullable().optional(),
  level: z.union([z.literal(1), z.literal(2), z.literal(3)]).optional(),
  sales_plattform_enabled: z.boolean().optional(),
  produkt_enabled: z.boolean().optional(),
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

  // Check for linked transactions (future: PROJ-3/4/5 tables)
  // For now: no transaction tables exist yet, so linked_count is always 0
  // When transaction tables are added, add checks here before deleting

  const { error: dbError } = await supabase
    .from('kpi_categories')
    .delete()
    .eq('id', id)

  if (dbError) return NextResponse.json({ error: dbError.message }, { status: 500 })
  return new Response(null, { status: 204 })
}
