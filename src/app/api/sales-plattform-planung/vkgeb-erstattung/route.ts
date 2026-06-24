import { NextResponse } from 'next/server'
import { z } from 'zod'
import { requireAuth } from '@/lib/supabase-server'

const patchSchema = z.object({
  sales_plattform_id: z.string().uuid(),
  produkt_id: z.string().uuid(),
  erstattung_verkaufsgebuehr_prozent: z.number().min(0).max(100),
})

export async function GET() {
  const { user, supabase, error } = await requireAuth()
  if (error) return error

  const { data, error: dbErr } = await supabase
    .from('retouren_einstellungen')
    .select('sales_plattform_id, produkt_id, erstattung_verkaufsgebuehr_prozent')
    .eq('user_id', user!.id)
    .limit(1000)

  if (dbErr) return NextResponse.json({ error: dbErr.message }, { status: 500 })
  return NextResponse.json(data ?? [])
}

export async function PATCH(request: Request) {
  const { user, supabase, error } = await requireAuth()
  if (error) return error

  const body = await request.json().catch(() => null)
  const parsed = patchSchema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })

  const { sales_plattform_id, produkt_id, erstattung_verkaufsgebuehr_prozent } = parsed.data

  const updatedAt = new Date().toISOString()

  // Update existing row without touching berechnungsart or other fields
  const { data: updated, error: updateErr } = await supabase
    .from('retouren_einstellungen')
    .update({ erstattung_verkaufsgebuehr_prozent, updated_at: updatedAt })
    .eq('user_id', user!.id)
    .eq('sales_plattform_id', sales_plattform_id)
    .eq('produkt_id', produkt_id)
    .select('id')

  if (updateErr) return NextResponse.json({ error: updateErr.message }, { status: 500 })

  // If no existing row, create one with safe defaults
  if (!updated || updated.length === 0) {
    const { error: insertErr } = await supabase
      .from('retouren_einstellungen')
      .insert({
        sales_plattform_id,
        produkt_id,
        user_id: user!.id,
        erstattung_verkaufsgebuehr_prozent,
        berechnungsart: 'keine',
      })
    if (insertErr) return NextResponse.json({ error: insertErr.message }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}
