import { NextResponse } from 'next/server'
import { z } from 'zod'
import { requireAuth } from '@/lib/supabase-server'

const rowSchema = z.object({
  sku_id: z.string().uuid(),
  produkt_id: z.string().uuid(),
  sales_plattform_id: z.string().uuid(),
  kw_year: z.number().int().min(2020).max(2100),
  kw_number: z.number().int().min(1).max(53),
  absatz_manuell: z.number().min(0),
})

const bodySchema = z.object({
  rows: z.array(rowSchema).max(2000),
})

// Inserts default (average) values for weeks without manual input.
// Uses ignoreDuplicates so existing manual values are never overwritten.
export async function POST(request: Request) {
  const { user, supabase, error } = await requireAuth()
  if (error) return error

  const raw = await request.json().catch(() => null)
  const parsed = bodySchema.safeParse(raw)
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })
  }

  const { rows } = parsed.data
  if (rows.length === 0) return NextResponse.json({ count: 0 })

  const { error: dbErr } = await supabase
    .from('absatz_planung')
    .upsert(
      rows.map(r => ({
        user_id: user!.id,
        sku_id: r.sku_id,
        produkt_id: r.produkt_id,
        sales_plattform_id: r.sales_plattform_id,
        kw_year: r.kw_year,
        kw_number: r.kw_number,
        absatz_manuell: r.absatz_manuell,
        ist_manuell: false,
        updated_at: new Date().toISOString(),
      })),
      { onConflict: 'user_id,produkt_id,sales_plattform_id,kw_year,kw_number,sku_id' },
    )

  if (dbErr) return NextResponse.json({ error: dbErr.message }, { status: 500 })
  return NextResponse.json({ count: rows.length })
}
