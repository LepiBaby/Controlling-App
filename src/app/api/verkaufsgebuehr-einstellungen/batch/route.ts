import { NextResponse } from 'next/server'
import { z } from 'zod'
import { requireAuth } from '@/lib/supabase-server'

const putSchema = z.object({
  sales_plattform_id: z.string().uuid(),
  verkaufsgebuehr_prozent: z.number().min(0).nullable(),
})

export async function PUT(request: Request) {
  const { user, supabase, error } = await requireAuth()
  if (error) return error

  const body = await request.json().catch(() => null)
  const parsed = putSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })
  }

  const { sales_plattform_id, verkaufsgebuehr_prozent } = parsed.data

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
    verkaufsgebuehr_prozent: verkaufsgebuehr_prozent ?? null,
    user_id: user!.id,
    updated_at: new Date().toISOString(),
  }))

  const { data, error: dbErr } = await supabase
    .from('verkaufsgebuehr_einstellungen')
    .upsert(rows, { onConflict: 'sales_plattform_id,produkt_id,user_id' })
    .select('id, sales_plattform_id, produkt_id, verkaufsgebuehr_prozent')

  if (dbErr) {
    return NextResponse.json({ error: dbErr.message }, { status: 500 })
  }

  return NextResponse.json(data ?? [])
}
