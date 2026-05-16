import { NextResponse } from 'next/server'
import { z } from 'zod'
import { requireAuth } from '@/lib/supabase-server'

const postSchema = z.object({
  name: z.string().min(1).max(100),
  type: z.enum(['position', 'summe', 'umsatzsteuer']),
})

async function assemblePositionen(supabase: Awaited<ReturnType<typeof import('@/lib/supabase-server').createSupabaseServerClient>>, userId: string) {
  const { data: positions, error: posErr } = await supabase
    .from('report_positionen')
    .select('id, name, type, sort_order, investitionsbezogen, in_deckungsbeitragsreport, in_break_even_report')
    .eq('user_id', userId)
    .order('sort_order', { ascending: true })

  if (posErr) throw new Error(posErr.message)
  if (!positions || positions.length === 0) return []

  const positionIds = positions.map(p => p.id)

  const [{ data: kategorien, error: katErr }, { data: summeRefs, error: sumErr }] = await Promise.all([
    supabase
      .from('report_position_kategorien')
      .select('id, report_position_id, kpi_category_id, kpi_categories(id, name, type)')
      .in('report_position_id', positionIds),
    supabase
      .from('report_summe_positionen')
      .select('id, report_position_id, referenced_position_id')
      .in('report_position_id', positionIds),
  ])

  if (katErr) throw new Error(katErr.message)
  if (sumErr) throw new Error(sumErr.message)

  const positionNamesById = Object.fromEntries(positions.map(p => [p.id, p.name]))

  return positions.map(p => ({
    id: p.id,
    name: p.name,
    type: p.type,
    sort_order: p.sort_order,
    investitionsbezogen: p.investitionsbezogen ?? false,
    in_deckungsbeitragsreport: p.in_deckungsbeitragsreport ?? false,
    in_break_even_report: p.in_break_even_report ?? false,
    kategorien: (kategorien ?? [])
      .filter(k => k.report_position_id === p.id)
      .map(k => ({
        id: k.id,
        kpi_category_id: k.kpi_category_id,
        kpi_category: k.kpi_categories as unknown as { id: string; name: string; type: string },
      })),
    summe_positionen: (summeRefs ?? [])
      .filter(s => s.report_position_id === p.id)
      .map(s => ({
        id: s.id,
        referenced_position_id: s.referenced_position_id,
        referenced_position: {
          id: s.referenced_position_id,
          name: positionNamesById[s.referenced_position_id] ?? '',
        },
      })),
  }))
}

export async function GET() {
  const { user, supabase, error } = await requireAuth()
  if (error) return error

  try {
    const data = await assemblePositionen(supabase, user!.id)
    return NextResponse.json(data)
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 })
  }
}

export async function POST(request: Request) {
  const { user, supabase, error } = await requireAuth()
  if (error) return error

  const body = await request.json().catch(() => null)
  const parsed = postSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })
  }

  const { name, type } = parsed.data

  const { data: maxRow } = await supabase
    .from('report_positionen')
    .select('sort_order')
    .eq('user_id', user!.id)
    .order('sort_order', { ascending: false })
    .limit(1)
    .maybeSingle()

  const sort_order = maxRow ? maxRow.sort_order + 1 : 0

  const { data: created, error: insErr } = await supabase
    .from('report_positionen')
    .insert({ name, type, sort_order, user_id: user!.id })
    .select('id, name, type, sort_order, investitionsbezogen, in_deckungsbeitragsreport, in_break_even_report')
    .single()

  if (insErr || !created) {
    return NextResponse.json({ error: insErr?.message ?? 'Insert failed' }, { status: 500 })
  }

  return NextResponse.json({
    id: created.id,
    name: created.name,
    type: created.type,
    sort_order: created.sort_order,
    investitionsbezogen: created.investitionsbezogen ?? false,
    in_deckungsbeitragsreport: created.in_deckungsbeitragsreport ?? false,
    in_break_even_report: created.in_break_even_report ?? false,
    kategorien: [],
    summe_positionen: [],
  })
}
