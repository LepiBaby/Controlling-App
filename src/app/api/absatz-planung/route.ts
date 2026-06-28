import { NextResponse } from 'next/server'
import { z } from 'zod'
import { requireAuth } from '@/lib/supabase-server'
import { fetchAllRows } from '@/lib/supabase-paginate'

const putSchema = z.object({
  sku_id: z.string().uuid().nullable().optional(),
  produkt_id: z.string().uuid(),
  sales_plattform_id: z.string().uuid(),
  kw_year: z.number().int().min(2020).max(2100),
  kw_number: z.number().int().min(1).max(53),
  absatz_manuell: z.number().min(0).nullable().optional(),
  effektiver_vk_manuell: z.number().min(0).nullable().optional(),
  ist_manuell: z.boolean().optional(),
})

export async function GET() {
  const { user, supabase, error } = await requireAuth()
  if (error) return error

  const { data, error: dbErr } = await fetchAllRows((from, to) =>
    supabase
      .from('absatz_planung')
      .select('sku_id, produkt_id, sales_plattform_id, kw_year, kw_number, absatz_manuell, effektiver_vk_manuell, ist_manuell')
      .eq('user_id', user!.id)
      .order('id', { ascending: true })
      .range(from, to))

  if (dbErr) return NextResponse.json({ error: dbErr.message }, { status: 500 })
  return NextResponse.json({ data: data ?? [] })
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
    sku_id = null,
    produkt_id,
    sales_plattform_id,
    kw_year,
    kw_number,
    absatz_manuell = null,
    effektiver_vk_manuell = null,
    ist_manuell = true,
  } = parsed.data

  const { data, error: dbErr } = await supabase
    .from('absatz_planung')
    .upsert(
      {
        user_id: user!.id,
        sku_id: sku_id ?? null,
        produkt_id,
        sales_plattform_id,
        kw_year,
        kw_number,
        absatz_manuell: absatz_manuell ?? null,
        effektiver_vk_manuell: effektiver_vk_manuell ?? null,
        ist_manuell,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'user_id,produkt_id,sales_plattform_id,kw_year,kw_number,sku_id' },
    )
    .select('sku_id, produkt_id, sales_plattform_id, kw_year, kw_number, absatz_manuell, effektiver_vk_manuell, ist_manuell')
    .single()

  if (dbErr || !data) {
    return NextResponse.json({ error: dbErr?.message ?? 'Upsert fehlgeschlagen' }, { status: 500 })
  }

  return NextResponse.json(data)
}

export async function DELETE(request: Request) {
  const { user, supabase, error } = await requireAuth()
  if (error) return error

  const { searchParams } = new URL(request.url)
  const field = searchParams.get('field')

  if (field === 'absatz') {
    // Null out absatz_manuell for all SKU rows (sku_id IS NOT NULL), keep VK rows
    const { error: updateErr } = await supabase
      .from('absatz_planung')
      .update({ absatz_manuell: null, updated_at: new Date().toISOString() })
      .eq('user_id', user!.id)
      .not('sku_id', 'is', null)

    if (updateErr) return NextResponse.json({ error: updateErr.message }, { status: 500 })

    // Clean up SKU rows where absatz_manuell is now null
    const { error: deleteErr } = await supabase
      .from('absatz_planung')
      .delete()
      .eq('user_id', user!.id)
      .not('sku_id', 'is', null)
      .is('absatz_manuell', null)

    if (deleteErr) return NextResponse.json({ error: deleteErr.message }, { status: 500 })
    return NextResponse.json({ success: true })
  }

  const { error: dbErr } = await supabase
    .from('absatz_planung')
    .delete()
    .eq('user_id', user!.id)

  if (dbErr) return NextResponse.json({ error: dbErr.message }, { status: 500 })
  return NextResponse.json({ success: true })
}
