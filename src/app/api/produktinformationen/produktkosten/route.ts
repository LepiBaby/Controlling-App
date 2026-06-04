import { NextResponse } from 'next/server'
import { z } from 'zod'
import { requireAuth } from '@/lib/supabase-server'

const UpsertSchema = z.object({
  produkt_id: z.string().uuid(),
  warenkosten: z.number().min(0).nullable().optional(),
  zollsatz_pct: z.number().min(0).max(100).nullable().optional(),
})

export async function GET() {
  const { user, supabase, error } = await requireAuth()
  if (error) return error

  const { data, error: dbErr } = await supabase
    .from('produktinformationen_produktkosten')
    .select('id, produkt_id, warenkosten, zollsatz_pct')
    .eq('user_id', user!.id)
    .limit(500)

  if (dbErr) return NextResponse.json({ error: dbErr.message }, { status: 500 })

  return NextResponse.json(data ?? [])
}

export async function PUT(request: Request) {
  const { user, supabase, error } = await requireAuth()
  if (error) return error

  const body = await request.json().catch(() => null)
  const parsed = UpsertSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })
  }

  const { data, error: dbErr } = await supabase
    .from('produktinformationen_produktkosten')
    .upsert(
      {
        user_id: user!.id,
        produkt_id: parsed.data.produkt_id,
        warenkosten: parsed.data.warenkosten ?? null,
        zollsatz_pct: parsed.data.zollsatz_pct ?? null,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'user_id,produkt_id' }
    )
    .select('id, produkt_id, warenkosten, zollsatz_pct')
    .single()

  if (dbErr || !data) {
    return NextResponse.json({ error: dbErr?.message ?? 'Upsert fehlgeschlagen' }, { status: 500 })
  }

  return NextResponse.json(data)
}
