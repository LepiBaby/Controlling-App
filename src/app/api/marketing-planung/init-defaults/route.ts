import { NextResponse } from 'next/server'
import { z } from 'zod'
import { requireAuth } from '@/lib/supabase-server'

const rowSchema = z.object({
  produkt_id: z.string().uuid(),
  kategorie_id: z.string().uuid(),
  kw_year: z.number().int().min(2020).max(2100),
  kw_number: z.number().int().min(1).max(53),
  marketingkosten_pct_manuell: z.number().min(0).max(100),
})

const bodySchema = z.object({
  rows: z.array(rowSchema).max(5000),
})

// Upserts frozen historical marketing pct values (ist_manuell=false).
// Manual values (ist_manuell=true) are filtered out by the hook before calling this.
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
    .from('marketing_planung')
    .upsert(
      rows.map(r => ({
        user_id: user!.id,
        produkt_id: r.produkt_id,
        kategorie_id: r.kategorie_id,
        kw_year: r.kw_year,
        kw_number: r.kw_number,
        marketingkosten_pct_manuell: r.marketingkosten_pct_manuell,
        ist_manuell: false,
        updated_at: new Date().toISOString(),
      })),
      { onConflict: 'user_id,produkt_id,kategorie_id,kw_year,kw_number' },
    )

  if (dbErr) return NextResponse.json({ error: dbErr.message }, { status: 500 })
  return NextResponse.json({ count: rows.length })
}
