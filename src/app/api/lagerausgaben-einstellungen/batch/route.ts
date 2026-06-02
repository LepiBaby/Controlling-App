import { NextResponse } from 'next/server'
import { z } from 'zod'
import { requireAuth } from '@/lib/supabase-server'

const putSchema = z.object({
  sales_plattform_id: z.string().uuid(),
  lagerkosten_euro_m3: z.number().min(0).nullable(),
})

export async function PUT(request: Request) {
  const { user, supabase, error } = await requireAuth()
  if (error) return error

  const body = await request.json().catch(() => null)
  const parsed = putSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })
  }

  const { sales_plattform_id, lagerkosten_euro_m3 } = parsed.data

  // Fetch all products from kpi_categories
  const { data: produkte, error: produkteErr } = await supabase
    .from('kpi_categories')
    .select('id')
    .eq('type', 'produkte')
    .eq('level', 1)
    .limit(500)

  if (produkteErr) {
    return NextResponse.json({ error: produkteErr.message }, { status: 500 })
  }

  if (!produkte || produkte.length === 0) {
    return NextResponse.json([], { status: 200 })
  }

  const rows = produkte.map(p => ({
    sales_plattform_id,
    produkt_id: p.id,
    lagerkosten_euro_m3: lagerkosten_euro_m3 ?? null,
    user_id: user!.id,
    updated_at: new Date().toISOString(),
  }))

  const { data, error: dbErr } = await supabase
    .from('lagerausgaben_einstellungen')
    .upsert(rows, { onConflict: 'sales_plattform_id,produkt_id,user_id' })
    .select('id, sales_plattform_id, produkt_id, lagerkosten_euro_m3')

  if (dbErr) {
    return NextResponse.json({ error: dbErr.message }, { status: 500 })
  }

  return NextResponse.json(data ?? [])
}
