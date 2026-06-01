import { NextResponse } from 'next/server'
import { z } from 'zod'
import { requireAuth } from '@/lib/supabase-server'

const BERECHNUNGSARTEN = [
  'mittelwert_14', 'mittelwert_30', 'mittelwert_60', 'mittelwert_90',
  'gewichtet_30', 'gewichtet_60', 'gewichtet_90', 'keine',
] as const

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

const putSchema = z.object({
  sales_plattform_id: z.string().uuid(),
  produkt_id: z.string().uuid(),
  berechnungsart: z.enum(BERECHNUNGSARTEN),
  gewichtung_erstes_drittel: z.number().int().min(0).max(100).nullable().optional(),
  gewichtung_zweites_drittel: z.number().int().min(0).max(100).nullable().optional(),
  gewichtung_drittes_drittel: z.number().int().min(0).max(100).nullable().optional(),
}).superRefine((data, ctx) => {
  if (!data.berechnungsart.startsWith('gewichtet_')) return

  const w1 = data.gewichtung_erstes_drittel
  const w2 = data.gewichtung_zweites_drittel
  const w3 = data.gewichtung_drittes_drittel

  if (w1 != null && w2 != null && w3 != null && w1 + w2 + w3 !== 100) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'Die Gewichtung muss in der Summe 100 % ergeben.',
      path: ['gewichtung_drittes_drittel'],
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
    .from('absatz_einstellungen')
    .select(
      'id, sales_plattform_id, produkt_id, berechnungsart, gewichtung_erstes_drittel, gewichtung_zweites_drittel, gewichtung_drittes_drittel'
    )
    .eq('user_id', user!.id)
    .eq('sales_plattform_id', plattformId)
    .limit(500)

  if (dbErr) {
    return NextResponse.json({ error: dbErr.message }, { status: 500 })
  }

  return NextResponse.json(data ?? [])
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
    produkt_id,
    berechnungsart,
    gewichtung_erstes_drittel = null,
    gewichtung_zweites_drittel = null,
    gewichtung_drittes_drittel = null,
  } = parsed.data

  const isGewichtet = berechnungsart.startsWith('gewichtet_')

  const { data, error: dbErr } = await supabase
    .from('absatz_einstellungen')
    .upsert(
      {
        sales_plattform_id,
        produkt_id,
        berechnungsart,
        gewichtung_erstes_drittel: isGewichtet ? (gewichtung_erstes_drittel ?? null) : null,
        gewichtung_zweites_drittel: isGewichtet ? (gewichtung_zweites_drittel ?? null) : null,
        gewichtung_drittes_drittel: isGewichtet ? (gewichtung_drittes_drittel ?? null) : null,
        user_id: user!.id,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'sales_plattform_id,produkt_id,user_id' }
    )
    .select(
      'id, sales_plattform_id, produkt_id, berechnungsart, gewichtung_erstes_drittel, gewichtung_zweites_drittel, gewichtung_drittes_drittel'
    )
    .single()

  if (dbErr || !data) {
    return NextResponse.json({ error: dbErr?.message ?? 'Upsert fehlgeschlagen' }, { status: 500 })
  }

  return NextResponse.json(data)
}
