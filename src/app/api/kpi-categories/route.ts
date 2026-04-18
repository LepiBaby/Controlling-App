import { NextResponse } from 'next/server'
import { z } from 'zod'
import { requireAuth } from '@/lib/supabase-server'

const VALID_TYPES = ['umsatz', 'einnahmen', 'ausgaben_kosten', 'sales_plattformen', 'produkte'] as const
const FLAT_TYPES: Array<typeof VALID_TYPES[number]> = ['sales_plattformen', 'produkte']

const createSchema = z.object({
  type: z.enum(VALID_TYPES),
  name: z.string().min(1).max(100).transform(s => s.trim()),
  parent_id: z.string().uuid().nullable(),
  level: z.union([z.literal(1), z.literal(2), z.literal(3)]),
  sort_order: z.number().int().min(0).optional().default(0),
})

export async function GET(request: Request) {
  const { user, supabase, error } = await requireAuth()
  if (error) return error

  const { searchParams } = new URL(request.url)
  const type = searchParams.get('type')

  if (!type || !VALID_TYPES.includes(type as typeof VALID_TYPES[number])) {
    return NextResponse.json({ error: 'Invalid type parameter' }, { status: 400 })
  }

  const { data, error: dbError } = await supabase
    .from('kpi_categories')
    .select('*')
    .eq('type', type)
    .order('sort_order', { ascending: true })

  if (dbError) return NextResponse.json({ error: dbError.message }, { status: 500 })
  return NextResponse.json(data)
}

export async function POST(request: Request) {
  const { user, supabase, error } = await requireAuth()
  if (error) return error

  const body = await request.json()
  const parsed = createSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })
  }

  const { type, name, parent_id, level, sort_order } = parsed.data

  // Flat types only allow level 1 with no parent
  if (FLAT_TYPES.includes(type) && (level !== 1 || parent_id !== null)) {
    return NextResponse.json({ error: 'Dieser Typ unterstützt nur Hauptkategorien (Ebene 1).' }, { status: 400 })
  }

  // Check duplicate name at same level within same parent
  const { data: existing } = await supabase
    .from('kpi_categories')
    .select('id')
    .eq('type', type)
    .eq('name', name)
    .is('parent_id', parent_id)
    .limit(1)

  if (existing && existing.length > 0) {
    return NextResponse.json({ error: 'Name bereits vorhanden auf dieser Ebene.' }, { status: 409 })
  }

  const { data, error: dbError } = await supabase
    .from('kpi_categories')
    .insert({ type, name, parent_id, level, sort_order })
    .select()
    .single()

  if (dbError) return NextResponse.json({ error: dbError.message }, { status: 500 })
  return NextResponse.json(data, { status: 201 })
}
