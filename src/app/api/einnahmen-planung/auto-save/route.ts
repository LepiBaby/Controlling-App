import { NextResponse } from 'next/server'
import { z } from 'zod'
import { requireAuth } from '@/lib/supabase-server'

const entrySchema = z.object({
  kategorie_id: z.string().uuid(),
  kw_year: z.number().int().min(2020).max(2100),
  kw_number: z.number().int().min(1).max(53),
  betrag_manuell: z.number().min(0),
})

const bodySchema = z.object({
  entries: z.array(entrySchema).min(1).max(500),
})

// Insert-only (ignoreDuplicates: true) — never overwrites manually set or previously auto-saved values
export async function POST(request: Request) {
  const { user, supabase, error } = await requireAuth()
  if (error) return error

  const body = await request.json().catch(() => null)
  const parsed = bodySchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })
  }

  const rows = parsed.data.entries.map(e => ({
    user_id: user!.id,
    kategorie_id: e.kategorie_id,
    kw_year: e.kw_year,
    kw_number: e.kw_number,
    betrag_manuell: e.betrag_manuell,
    updated_at: new Date().toISOString(),
  }))

  const { error: dbErr } = await supabase
    .from('einnahmen_planung')
    .upsert(rows, {
      onConflict: 'user_id,kategorie_id,kw_year,kw_number',
      ignoreDuplicates: false,
    })

  if (dbErr) return NextResponse.json({ error: dbErr.message }, { status: 500 })

  return NextResponse.json({ ok: true, saved: rows.length })
}
