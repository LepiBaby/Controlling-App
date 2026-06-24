import { NextResponse } from 'next/server'
import { z } from 'zod'
import { requireAuth } from '@/lib/supabase-server'

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

const RHYTHMUS_VALUES = [
  'woechentlich',
  'alle_zwei_wochen',
  'alle_drei_wochen',
  'alle_vier_wochen',
] as const

const putSchema = z
  .object({
    sales_plattform_id: z.string().uuid(),
    auszahlungsrhythmus: z.enum(RHYTHMUS_VALUES),
    naechste_auszahlung_basis_kw: z.number().int().min(1).max(53).nullable(),
    naechste_auszahlung_basis_jahr: z.number().int().min(2024).nullable(),
    verschiebung_wochen: z.number().int().min(0).max(52).default(0),
    retouren_inkludiert: z.boolean(),
  })
  .superRefine((data, ctx) => {
    const kwSet = data.naechste_auszahlung_basis_kw !== null
    const jahrSet = data.naechste_auszahlung_basis_jahr !== null
    if (kwSet !== jahrSet) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'naechste_auszahlung_basis_kw und basis_jahr müssen gemeinsam gesetzt oder beide null sein.',
        path: ['naechste_auszahlung_basis_kw'],
      })
    }
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
    .from('auszahlungs_einstellungen')
    .select(
      'sales_plattform_id, auszahlungsrhythmus, naechste_auszahlung_basis_kw, naechste_auszahlung_basis_jahr, verschiebung_wochen, retouren_inkludiert'
    )
    .eq('user_id', user!.id)
    .eq('sales_plattform_id', plattformId)
    .maybeSingle()

  if (dbErr) {
    return NextResponse.json({ error: dbErr.message }, { status: 500 })
  }

  return NextResponse.json(data)
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
    sales_plattform_id,
    auszahlungsrhythmus,
    naechste_auszahlung_basis_kw,
    naechste_auszahlung_basis_jahr,
    verschiebung_wochen,
    retouren_inkludiert,
  } = parsed.data

  const { data, error: dbErr } = await supabase
    .from('auszahlungs_einstellungen')
    .upsert(
      {
        sales_plattform_id,
        auszahlungsrhythmus,
        naechste_auszahlung_basis_kw,
        naechste_auszahlung_basis_jahr,
        verschiebung_wochen,
        retouren_inkludiert,
        user_id: user!.id,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'sales_plattform_id,user_id' }
    )
    .select(
      'sales_plattform_id, auszahlungsrhythmus, naechste_auszahlung_basis_kw, naechste_auszahlung_basis_jahr, verschiebung_wochen, retouren_inkludiert'
    )
    .single()

  if (dbErr || !data) {
    return NextResponse.json({ error: dbErr?.message ?? 'Upsert fehlgeschlagen' }, { status: 500 })
  }

  return NextResponse.json(data)
}
