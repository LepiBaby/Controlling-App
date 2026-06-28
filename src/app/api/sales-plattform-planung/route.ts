import { NextResponse } from 'next/server'
import { z } from 'zod'
import { requireAuth } from '@/lib/supabase-server'
import { fetchAllRows } from '@/lib/supabase-paginate'

const putSchema = z.object({
  kategorie: z.enum(['bruttoumsatz', 'rueckerstattungen', 'verkaufsgebuehr', 'retouren', 'marketing']),
  produkt_id: z.string().uuid(),
  sales_plattform_id: z.string().uuid(),
  kw_year: z.number().int().min(2020).max(2100),
  kw_number: z.number().int().min(1).max(53),
  wert_manuell: z.number().nullable(),
})

export async function GET() {
  const { user, supabase, error } = await requireAuth()
  if (error) return error

  const { data, error: dbErr } = await fetchAllRows((from, to) =>
    supabase
      .from('sales_plattform_planung')
      .select('id, kategorie, produkt_id, sales_plattform_id, kw_year, kw_number, wert_manuell')
      .eq('user_id', user!.id)
      .order('id', { ascending: true })
      .range(from, to)
  )

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

  const { kategorie, produkt_id, sales_plattform_id, kw_year, kw_number, wert_manuell } = parsed.data

  if (wert_manuell === null) {
    const { error: delErr } = await supabase
      .from('sales_plattform_planung')
      .delete()
      .eq('user_id', user!.id)
      .eq('kategorie', kategorie)
      .eq('produkt_id', produkt_id)
      .eq('sales_plattform_id', sales_plattform_id)
      .eq('kw_year', kw_year)
      .eq('kw_number', kw_number)

    if (delErr) return NextResponse.json({ error: delErr.message }, { status: 500 })
    return NextResponse.json({ success: true })
  }

  const { data, error: dbErr } = await supabase
    .from('sales_plattform_planung')
    .upsert(
      {
        user_id: user!.id,
        kategorie,
        produkt_id,
        sales_plattform_id,
        kw_year,
        kw_number,
        wert_manuell,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'user_id,kategorie,produkt_id,sales_plattform_id,kw_year,kw_number' },
    )
    .select('id, kategorie, produkt_id, sales_plattform_id, kw_year, kw_number, wert_manuell')
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
    .from('sales_plattform_planung')
    .delete()
    .eq('user_id', user!.id)

  if (dbErr) return NextResponse.json({ error: dbErr.message }, { status: 500 })
  return NextResponse.json({ success: true })
}
