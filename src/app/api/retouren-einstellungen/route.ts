import { NextResponse } from 'next/server'
import { z } from 'zod'
import { requireAuth } from '@/lib/supabase-server'

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

const putSchema = z.object({
  sales_plattform_id: z.string().uuid(),
  produkt_id: z.string().uuid(),
  berechnungsart: z
    .enum(['keine', 'mittelwert_14', 'mittelwert_30', 'mittelwert_60', 'mittelwert_90'])
    .optional(),
  rueckversandkosten_euro_netto: z.number().min(0).nullable().optional(),
  retourenhandling_kosten_euro_netto: z.number().min(0).nullable().optional(),
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
    .from('retouren_einstellungen')
    .select(
      'id, sales_plattform_id, produkt_id, berechnungsart, rueckversandkosten_euro_netto, retourenhandling_kosten_euro_netto'
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
    berechnungsart = 'keine',
    rueckversandkosten_euro_netto = null,
    retourenhandling_kosten_euro_netto = null,
  } = parsed.data

  const { data, error: dbErr } = await supabase
    .from('retouren_einstellungen')
    .upsert(
      {
        sales_plattform_id,
        produkt_id,
        berechnungsart,
        rueckversandkosten_euro_netto: rueckversandkosten_euro_netto ?? null,
        retourenhandling_kosten_euro_netto: retourenhandling_kosten_euro_netto ?? null,
        user_id: user!.id,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'sales_plattform_id,produkt_id,user_id' }
    )
    .select(
      'id, sales_plattform_id, produkt_id, berechnungsart, rueckversandkosten_euro_netto, retourenhandling_kosten_euro_netto'
    )
    .single()

  if (dbErr || !data) {
    return NextResponse.json({ error: dbErr?.message ?? 'Upsert fehlgeschlagen' }, { status: 500 })
  }

  return NextResponse.json(data)
}
