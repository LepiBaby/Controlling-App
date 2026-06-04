import { NextResponse } from 'next/server'
import { z } from 'zod'
import { requireAuth } from '@/lib/supabase-server'

const UpsertSchema = z.object({
  produkt_id: z.string().uuid(),
  vor_produktion_pct: z.number().min(0).max(100).nullable().optional(),
  nach_produktion_pct: z.number().min(0).max(100).nullable().optional(),
  nach_ankunft_pct: z.number().min(0).max(100).nullable().optional(),
  zahlungsziel_vor_produktion_tage: z.number().int().min(0).nullable().optional(),
  zahlungsziel_nach_produktion_tage: z.number().int().min(0).nullable().optional(),
  zahlungsziel_nach_ankunft_tage: z.number().int().min(0).nullable().optional(),
})

export async function GET() {
  const { user, supabase, error } = await requireAuth()
  if (error) return error

  const { data, error: dbErr } = await supabase
    .from('produktinformationen_zahlungskonditionen')
    .select('id, produkt_id, vor_produktion_pct, nach_produktion_pct, nach_ankunft_pct, zahlungsziel_vor_produktion_tage, zahlungsziel_nach_produktion_tage, zahlungsziel_nach_ankunft_tage')
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
    .from('produktinformationen_zahlungskonditionen')
    .upsert(
      {
        user_id: user!.id,
        produkt_id: parsed.data.produkt_id,
        vor_produktion_pct: parsed.data.vor_produktion_pct ?? null,
        nach_produktion_pct: parsed.data.nach_produktion_pct ?? null,
        nach_ankunft_pct: parsed.data.nach_ankunft_pct ?? null,
        zahlungsziel_vor_produktion_tage: parsed.data.zahlungsziel_vor_produktion_tage ?? null,
        zahlungsziel_nach_produktion_tage: parsed.data.zahlungsziel_nach_produktion_tage ?? null,
        zahlungsziel_nach_ankunft_tage: parsed.data.zahlungsziel_nach_ankunft_tage ?? null,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'user_id,produkt_id' }
    )
    .select('id, produkt_id, vor_produktion_pct, nach_produktion_pct, nach_ankunft_pct, zahlungsziel_vor_produktion_tage, zahlungsziel_nach_produktion_tage, zahlungsziel_nach_ankunft_tage')
    .single()

  if (dbErr || !data) {
    return NextResponse.json({ error: dbErr?.message ?? 'Upsert fehlgeschlagen' }, { status: 500 })
  }

  return NextResponse.json(data)
}
