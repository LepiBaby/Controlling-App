import { NextResponse } from 'next/server'
import { z } from 'zod'
import { requireAuth } from '@/lib/supabase-server'

const putSchema = z.object({
  gruppierung: z.enum(['woechentlich', 'monatlich', 'quartalsweise']).optional(),
  zahlungsziel_tage: z.number().int().min(0).nullable().optional(),
})

export async function GET(_request: Request) {
  const { user, supabase, error } = await requireAuth()
  if (error) return error

  const { data, error: dbErr } = await supabase
    .from('versandausgaben_allgemein_einstellungen')
    .select('gruppierung, zahlungsziel_tage')
    .eq('user_id', user!.id)
    .maybeSingle()

  if (dbErr) {
    return NextResponse.json({ error: dbErr.message }, { status: 500 })
  }

  return NextResponse.json(data ?? null)
}

export async function PUT(request: Request) {
  const { user, supabase, error } = await requireAuth()
  if (error) return error

  const body = await request.json().catch(() => null)
  if (!body || typeof body !== 'object') {
    return NextResponse.json({ error: 'Ungültiger JSON-Body' }, { status: 400 })
  }

  const parsed = putSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })
  }

  if (Object.keys(parsed.data).length === 0) {
    return NextResponse.json({ error: 'Mindestens ein Feld muss angegeben werden' }, { status: 400 })
  }

  // Fetch current values to merge (preserves fields not included in patch)
  const { data: current } = await supabase
    .from('versandausgaben_allgemein_einstellungen')
    .select('gruppierung, zahlungsziel_tage')
    .eq('user_id', user!.id)
    .maybeSingle()

  const merged = {
    gruppierung: parsed.data.gruppierung ?? current?.gruppierung ?? 'monatlich',
    zahlungsziel_tage:
      'zahlungsziel_tage' in body
        ? (parsed.data.zahlungsziel_tage ?? null)
        : (current?.zahlungsziel_tage ?? null),
  }

  const { data, error: dbErr } = await supabase
    .from('versandausgaben_allgemein_einstellungen')
    .upsert(
      {
        user_id: user!.id,
        ...merged,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'user_id' }
    )
    .select('gruppierung, zahlungsziel_tage')
    .single()

  if (dbErr || !data) {
    return NextResponse.json({ error: dbErr?.message ?? 'Upsert fehlgeschlagen' }, { status: 500 })
  }

  return NextResponse.json(data)
}
