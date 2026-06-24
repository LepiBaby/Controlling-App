import { NextResponse } from 'next/server'
import { z } from 'zod'
import { requireAuth } from '@/lib/supabase-server'

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

const GRUPPIERUNG_VALUES = ['woechentlich', 'monatlich', 'quartalsweise'] as const

const putSchema = z.object({
  sales_plattform_id: z.string().uuid(),
  gruppierung: z.enum(GRUPPIERUNG_VALUES).optional(),
  naechste_zahlung_basis_kw: z.number().int().min(1).max(53).nullable().optional(),
  naechste_zahlung_basis_jahr: z.number().int().min(2024).nullable().optional(),
  zahlungsziel_tage: z.number().int().min(0).max(365).nullable().optional(),
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
    .from('marketing_plattform_einstellungen')
    .select('id, sales_plattform_id, gruppierung, naechste_zahlung_basis_kw, naechste_zahlung_basis_jahr, zahlungsziel_tage')
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
  const parsed = putSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })
  }

  const { sales_plattform_id, gruppierung, naechste_zahlung_basis_kw, naechste_zahlung_basis_jahr, zahlungsziel_tage } = parsed.data

  const updatePayload: Record<string, unknown> = {
    sales_plattform_id,
    user_id: user!.id,
    updated_at: new Date().toISOString(),
  }
  if (gruppierung !== undefined) updatePayload.gruppierung = gruppierung
  if (naechste_zahlung_basis_kw !== undefined) updatePayload.naechste_zahlung_basis_kw = naechste_zahlung_basis_kw
  if (naechste_zahlung_basis_jahr !== undefined) updatePayload.naechste_zahlung_basis_jahr = naechste_zahlung_basis_jahr
  if (zahlungsziel_tage !== undefined) updatePayload.zahlungsziel_tage = zahlungsziel_tage

  const { data, error: dbErr } = await supabase
    .from('marketing_plattform_einstellungen')
    .upsert(updatePayload, { onConflict: 'user_id,sales_plattform_id' })
    .select('id, sales_plattform_id, gruppierung, naechste_zahlung_basis_kw, naechste_zahlung_basis_jahr, zahlungsziel_tage')
    .single()

  if (dbErr || !data) {
    return NextResponse.json({ error: dbErr?.message ?? 'Upsert fehlgeschlagen' }, { status: 500 })
  }

  return NextResponse.json(data)
}
