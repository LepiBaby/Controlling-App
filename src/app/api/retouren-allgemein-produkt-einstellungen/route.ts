import { NextResponse } from 'next/server'
import { z } from 'zod'
import { requireAuth } from '@/lib/supabase-server'

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

const putSchema = z.object({
  produkt_id: z.string().uuid(),
  berechnungsart: z
    .enum(['keine', 'mittelwert_7', 'mittelwert_14', 'mittelwert_30', 'mittelwert_60', 'mittelwert_90'])
    .optional(),
  retourenhandling_kosten_euro_netto: z.number().min(0).nullable().optional(),
})

export async function GET(request: Request) {
  const { user, supabase, error } = await requireAuth()
  if (error) return error

  const { searchParams } = new URL(request.url)
  const produktId = searchParams.get('produkt_id')

  const query = supabase
    .from('retouren_allgemein_produkt_einstellungen')
    .select('id, produkt_id, berechnungsart, retourenhandling_kosten_euro_netto')
    .eq('user_id', user!.id)

  if (produktId) {
    if (!UUID_REGEX.test(produktId)) {
      return NextResponse.json({ error: 'Ungültige produkt_id' }, { status: 400 })
    }
    query.eq('produkt_id', produktId)
  }

  const { data, error: dbErr } = await query.limit(500)

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
    produkt_id,
    berechnungsart = 'keine',
    retourenhandling_kosten_euro_netto = null,
  } = parsed.data

  const { data, error: dbErr } = await supabase
    .from('retouren_allgemein_produkt_einstellungen')
    .upsert(
      {
        user_id: user!.id,
        produkt_id,
        berechnungsart,
        retourenhandling_kosten_euro_netto: retourenhandling_kosten_euro_netto ?? null,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'user_id,produkt_id' }
    )
    .select('id, produkt_id, berechnungsart, retourenhandling_kosten_euro_netto')
    .single()

  if (dbErr || !data) {
    return NextResponse.json({ error: dbErr?.message ?? 'Upsert fehlgeschlagen' }, { status: 500 })
  }

  return NextResponse.json(data)
}
