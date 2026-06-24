import { NextResponse } from 'next/server'
import { z } from 'zod'
import { requireAuth } from '@/lib/supabase-server'

// ─── Schema ───────────────────────────────────────────────────────────────────

const putSchema = z.object({
  zahlungsfrequenz: z.enum(['monatlich', 'quartalsweise']).optional(),
  zahlungsverschiebung_tage: z.number().int().min(0).optional(),
  einfuhrust_zahlungsziel_tage: z.number().int().min(0).optional(),
  einfuhrust_satz: z.number().min(0).max(100).optional(),
  ust_satz_pflegeebene: z.union([z.literal(1), z.literal(2)]).optional(),
})

const DEFAULTS = {
  zahlungsfrequenz: 'monatlich' as const,
  zahlungsverschiebung_tage: 0,
  einfuhrust_zahlungsziel_tage: 0,
  einfuhrust_satz: 0,
  ust_satz_pflegeebene: 1 as const,
}

// ─── GET ──────────────────────────────────────────────────────────────────────

export async function GET() {
  const { user, supabase, error } = await requireAuth()
  if (error) return error

  const { data, error: dbErr } = await supabase
    .from('ust_einstellungen')
    .select(
      'zahlungsfrequenz, zahlungsverschiebung_tage, einfuhrust_zahlungsziel_tage, einfuhrust_satz, ust_satz_pflegeebene'
    )
    .eq('user_id', user!.id)
    .maybeSingle()

  if (dbErr) {
    return NextResponse.json({ error: dbErr.message }, { status: 500 })
  }

  return NextResponse.json(data ?? DEFAULTS)
}

// ─── PUT ──────────────────────────────────────────────────────────────────────

export async function PUT(request: Request) {
  const { user, supabase, error } = await requireAuth()
  if (error) return error

  const body = await request.json().catch(() => null)
  const parsed = putSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })
  }

  if (Object.keys(parsed.data).length === 0) {
    return NextResponse.json({ error: 'Keine Felder zum Speichern angegeben.' }, { status: 400 })
  }

  const patch = parsed.data

  const { data, error: dbErr } = await supabase
    .from('ust_einstellungen')
    .upsert(
      {
        ...patch,
        user_id: user!.id,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'user_id' }
    )
    .select(
      'zahlungsfrequenz, zahlungsverschiebung_tage, einfuhrust_zahlungsziel_tage, einfuhrust_satz, ust_satz_pflegeebene'
    )
    .single()

  if (dbErr || !data) {
    return NextResponse.json({ error: dbErr?.message ?? 'Upsert fehlgeschlagen' }, { status: 500 })
  }

  return NextResponse.json(data)
}
