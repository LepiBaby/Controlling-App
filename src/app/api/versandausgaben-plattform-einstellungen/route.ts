import { NextResponse } from 'next/server'
import { z } from 'zod'
import { requireAuth } from '@/lib/supabase-server'

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

const putSchema = z.object({
  sales_plattform_id: z.string().uuid(),
  gruppierung: z.enum(['woechentlich', 'monatlich', 'quartalsweise']).optional(),
  zahlungsziel_tage: z.number().int().min(0).nullable().optional(),
})

export async function GET(request: Request) {
  const { user, supabase, error } = await requireAuth()
  if (error) return error

  const { searchParams } = new URL(request.url)
  const plattformId = searchParams.get('plattform_id')

  if (!plattformId) {
    return NextResponse.json({ error: 'plattform_id ist erforderlich' }, { status: 400 })
  }

  if (!UUID_REGEX.test(plattformId)) {
    return NextResponse.json({ error: 'Ungültige plattform_id' }, { status: 400 })
  }

  const { data, error: dbErr } = await supabase
    .from('versandausgaben_plattform_einstellungen')
    .select('gruppierung, zahlungsziel_tage')
    .eq('user_id', user!.id)
    .eq('sales_plattform_id', plattformId)
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

  const { sales_plattform_id, ...patch } = parsed.data

  if (Object.keys(patch).length === 0) {
    return NextResponse.json({ error: 'Mindestens ein Feld muss angegeben werden' }, { status: 400 })
  }

  // Fetch current values to merge (partial updates)
  const { data: current } = await supabase
    .from('versandausgaben_plattform_einstellungen')
    .select('gruppierung, zahlungsziel_tage')
    .eq('user_id', user!.id)
    .eq('sales_plattform_id', sales_plattform_id)
    .maybeSingle()

  const merged = {
    gruppierung: patch.gruppierung ?? current?.gruppierung ?? 'monatlich',
    zahlungsziel_tage:
      'zahlungsziel_tage' in body
        ? (patch.zahlungsziel_tage ?? null)
        : (current?.zahlungsziel_tage ?? null),
  }

  const { data, error: dbErr } = await supabase
    .from('versandausgaben_plattform_einstellungen')
    .upsert(
      {
        sales_plattform_id,
        user_id: user!.id,
        ...merged,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'sales_plattform_id,user_id' }
    )
    .select('gruppierung, zahlungsziel_tage')
    .single()

  if (dbErr || !data) {
    return NextResponse.json({ error: dbErr?.message ?? 'Upsert fehlgeschlagen' }, { status: 500 })
  }

  return NextResponse.json(data)
}
