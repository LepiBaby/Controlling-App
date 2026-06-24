import { NextResponse } from 'next/server'
import { z } from 'zod'
import { requireAuth } from '@/lib/supabase-server'

const putSchema = z.object({
  produkt_id: z.string().uuid(),
  kategorie_id: z.string().uuid(),
  kw_year: z.number().int().min(2020).max(2100),
  kw_number: z.number().int().min(1).max(53),
  marketingkosten_pct_manuell: z.number().min(0).max(100).nullable().optional(),
  ist_manuell: z.boolean().optional(),
})

export async function GET() {
  const { user, supabase, error } = await requireAuth()
  if (error) return error

  const { data, error: dbErr } = await supabase
    .from('marketing_planung')
    .select('produkt_id, kategorie_id, kw_year, kw_number, marketingkosten_pct_manuell, ist_manuell')
    .eq('user_id', user!.id)
    .limit(2000)

  if (dbErr) return NextResponse.json({ error: dbErr.message }, { status: 500 })
  return NextResponse.json(data ?? [])
}

export async function PUT(request: Request) {
  const { user, supabase, error } = await requireAuth()
  if (error) return error

  const body = await request.json().catch(() => null)
  const parsed = putSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })
  }

  const {
    produkt_id,
    kategorie_id,
    kw_year,
    kw_number,
    marketingkosten_pct_manuell = null,
    ist_manuell = true,
  } = parsed.data

  // If pct is null, delete the row (cell reverts to historical value)
  if (marketingkosten_pct_manuell === null || marketingkosten_pct_manuell === undefined) {
    const { error: delErr } = await supabase
      .from('marketing_planung')
      .delete()
      .eq('user_id', user!.id)
      .eq('produkt_id', produkt_id)
      .eq('kategorie_id', kategorie_id)
      .eq('kw_year', kw_year)
      .eq('kw_number', kw_number)

    if (delErr) return NextResponse.json({ error: delErr.message }, { status: 500 })
    return NextResponse.json({ success: true })
  }

  const { data, error: dbErr } = await supabase
    .from('marketing_planung')
    .upsert(
      {
        user_id: user!.id,
        produkt_id,
        kategorie_id,
        kw_year,
        kw_number,
        marketingkosten_pct_manuell,
        ist_manuell,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'user_id,produkt_id,kategorie_id,kw_year,kw_number' },
    )
    .select('produkt_id, kategorie_id, kw_year, kw_number, marketingkosten_pct_manuell, ist_manuell')
    .single()

  if (dbErr || !data) {
    return NextResponse.json({ error: dbErr?.message ?? 'Upsert fehlgeschlagen' }, { status: 500 })
  }

  return NextResponse.json(data)
}

export async function DELETE() {
  const { user, supabase, error } = await requireAuth()
  if (error) return error

  const { error: dbErr } = await supabase
    .from('marketing_planung')
    .delete()
    .eq('user_id', user!.id)

  if (dbErr) return NextResponse.json({ error: dbErr.message }, { status: 500 })
  return NextResponse.json({ success: true })
}
