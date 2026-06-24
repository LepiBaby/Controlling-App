import { NextResponse } from 'next/server'
import { z } from 'zod'
import { requireAuth } from '@/lib/supabase-server'

const NULL_PROD = '00000000-0000-0000-0000-000000000000'

const putSchema = z.object({
  kategorie_id: z.string().uuid(),
  produkt_id: z.string().uuid().nullable().optional(),
  kw_year: z.number().int().min(2020).max(2100),
  kw_number: z.number().int().min(1).max(53),
  betrag_manuell: z.number().min(0).nullable(),
})

function toNullProd(id: string | null | undefined): string {
  return id ?? NULL_PROD
}

function fromNullProd(id: string): string | null {
  return id === NULL_PROD ? null : id
}

export async function GET() {
  const { user, supabase, error } = await requireAuth()
  if (error) return error

  const { data, error: dbErr } = await supabase
    .from('umsatzausgaben_planung')
    .select('kategorie_id, produkt_id, kw_year, kw_number, betrag_manuell, ist_berechnet')
    .eq('user_id', user!.id)
    .limit(10000)

  if (dbErr) return NextResponse.json({ error: dbErr.message }, { status: 500 })

  const result = (data ?? []).map(r => ({
    ...r,
    produkt_id: fromNullProd(r.produkt_id),
  }))

  return NextResponse.json({ data: result })
}

export async function PUT(request: Request) {
  const { user, supabase, error } = await requireAuth()
  if (error) return error

  const body = await request.json().catch(() => null)
  const parsed = putSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })
  }

  const { kategorie_id, produkt_id, kw_year, kw_number, betrag_manuell } = parsed.data
  const prodId = toNullProd(produkt_id)

  if (betrag_manuell === null) {
    await supabase
      .from('umsatzausgaben_planung')
      .delete()
      .eq('user_id', user!.id)
      .eq('kategorie_id', kategorie_id)
      .eq('produkt_id', prodId)
      .eq('kw_year', kw_year)
      .eq('kw_number', kw_number)
    return NextResponse.json({ ok: true })
  }

  const { data, error: dbErr } = await supabase
    .from('umsatzausgaben_planung')
    .upsert(
      {
        user_id: user!.id,
        kategorie_id,
        produkt_id: prodId,
        kw_year,
        kw_number,
        betrag_manuell,
        ist_berechnet: false,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'user_id,kategorie_id,produkt_id,kw_year,kw_number' },
    )
    .select('kategorie_id, produkt_id, kw_year, kw_number, betrag_manuell, ist_berechnet')
    .single()

  if (dbErr || !data) {
    return NextResponse.json({ error: dbErr?.message ?? 'Upsert fehlgeschlagen' }, { status: 500 })
  }

  return NextResponse.json({ ...data, produkt_id: fromNullProd(data.produkt_id) })
}

export async function DELETE(req?: Request) {
  const { user, supabase, error } = await requireAuth()
  if (error) return error

  const searchParams = req ? new URL(req.url).searchParams : new URLSearchParams()
  const abYear = searchParams.get('ab_kw_year')
  const abWeek = searchParams.get('ab_kw_number')

  if (abYear && abWeek) {
    const yr = Number(abYear)
    const wk = Number(abWeek)
    const { error: e1 } = await supabase.from('umsatzausgaben_planung').delete()
      .eq('user_id', user!.id).gt('kw_year', yr)
    const { error: e2 } = await supabase.from('umsatzausgaben_planung').delete()
      .eq('user_id', user!.id).eq('kw_year', yr).gte('kw_number', wk)
    if (e1 || e2) return NextResponse.json({ error: (e1 ?? e2)!.message }, { status: 500 })
  } else {
    const { error: dbErr } = await supabase.from('umsatzausgaben_planung').delete().eq('user_id', user!.id)
    if (dbErr) return NextResponse.json({ error: dbErr.message }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}
