import { NextResponse } from 'next/server'
import { z } from 'zod'
import { requireAuth } from '@/lib/supabase-server'

const postSchema = z.array(
  z.object({
    kategorie_id: z.string().uuid(),
    ebene: z.union([z.literal(1), z.literal(2)]),
  })
).min(1).max(500)

export async function GET() {
  const { user, supabase, error } = await requireAuth()
  if (error) return error

  const { data, error: dbErr } = await supabase
    .from('ust_l1_ebene_auswahl')
    .select('kategorie_id, ebene')
    .eq('user_id', user!.id)
    .limit(500)

  if (dbErr) return NextResponse.json({ error: dbErr.message }, { status: 500 })

  const result: Record<string, 1 | 2> = {}
  for (const row of (data ?? [])) {
    result[row.kategorie_id] = row.ebene as 1 | 2
  }
  return NextResponse.json(result)
}

export async function POST(request: Request) {
  const { user, supabase, error } = await requireAuth()
  if (error) return error

  const body = await request.json().catch(() => null)
  const parsed = postSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })
  }

  const rows = parsed.data.map(item => ({
    user_id: user!.id,
    kategorie_id: item.kategorie_id,
    ebene: item.ebene,
  }))

  const { error: dbErr } = await supabase
    .from('ust_l1_ebene_auswahl')
    .upsert(rows, { onConflict: 'user_id,kategorie_id' })

  if (dbErr) return NextResponse.json({ error: dbErr.message }, { status: 500 })

  return NextResponse.json({ ok: true })
}
