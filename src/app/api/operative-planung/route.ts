import { NextResponse } from 'next/server'
import { z } from 'zod'
import { requireAuth } from '@/lib/supabase-server'
import { fetchAllRows } from '@/lib/supabase-paginate'

const putSchema = z.object({
  kategorie_id: z.string().uuid(),
  kw_year: z.number().int().min(2020).max(2100),
  kw_number: z.number().int().min(1).max(53),
  betrag_manuell: z.number().min(0).nullable().optional(),
})

export async function GET() {
  const { user, supabase, error } = await requireAuth()
  if (error) return error

  const { data, error: dbErr } = await fetchAllRows((from, to) =>
    supabase
      .from('operative_planung')
      .select('kategorie_id, kw_year, kw_number, betrag_manuell, ist_berechnet')
      .eq('user_id', user!.id)
      .order('id', { ascending: true })
      .range(from, to),
  )

  if (dbErr) return NextResponse.json({ error: dbErr.message }, { status: 500 })
  return NextResponse.json(data ?? [])
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
    const { error: e1 } = await supabase.from('operative_planung').delete()
      .eq('user_id', user!.id).gt('kw_year', yr)
    const { error: e2 } = await supabase.from('operative_planung').delete()
      .eq('user_id', user!.id).eq('kw_year', yr).gte('kw_number', wk)
    if (e1 || e2) return NextResponse.json({ error: (e1 ?? e2)!.message }, { status: 500 })
  } else {
    const { error: dbErr } = await supabase.from('operative_planung').delete().eq('user_id', user!.id)
    if (dbErr) return NextResponse.json({ error: dbErr.message }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}

export async function PUT(request: Request) {
  const { user, supabase, error } = await requireAuth()
  if (error) return error

  const body = await request.json().catch(() => null)
  const parsed = putSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })
  }

  const { kategorie_id, kw_year, kw_number, betrag_manuell = null } = parsed.data

  // null means "clear this cell" → delete the entry
  if (betrag_manuell === null) {
    const { error: dbErr } = await supabase
      .from('operative_planung')
      .delete()
      .eq('user_id', user!.id)
      .eq('kategorie_id', kategorie_id)
      .eq('kw_year', kw_year)
      .eq('kw_number', kw_number)

    if (dbErr) return NextResponse.json({ error: dbErr.message }, { status: 500 })
    return NextResponse.json({ deleted: true })
  }

  const { data, error: dbErr } = await supabase
    .from('operative_planung')
    .upsert(
      {
        user_id: user!.id,
        kategorie_id,
        kw_year,
        kw_number,
        betrag_manuell,
        ist_berechnet: false,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'user_id,kategorie_id,kw_year,kw_number' },
    )
    .select('kategorie_id, kw_year, kw_number, betrag_manuell')
    .single()

  if (dbErr || !data) {
    return NextResponse.json({ error: dbErr?.message ?? 'Upsert fehlgeschlagen' }, { status: 500 })
  }

  return NextResponse.json(data)
}
