import { NextResponse } from 'next/server'
import { z } from 'zod'
import { requireAuth } from '@/lib/supabase-server'

// ─── Schema ───────────────────────────────────────────────────────────────────

const itemSchema = z.object({
  kategorie_id: z.string().uuid(),
  ebene: z.union([z.literal(1), z.literal(2)]),
  ust_satz: z.number().min(0).max(100).nullable(),
})

const postSchema = z.array(itemSchema).min(1).max(500)

// ─── GET ──────────────────────────────────────────────────────────────────────

export async function GET() {
  const { user, supabase, error } = await requireAuth()
  if (error) return error

  const { data, error: dbErr } = await supabase
    .from('ust_kategorie_saetze')
    .select('kategorie_id, ebene, ust_satz')
    .eq('user_id', user!.id)
    .limit(1000)

  if (dbErr) {
    return NextResponse.json({ error: dbErr.message }, { status: 500 })
  }

  return NextResponse.json(data ?? [])
}

// ─── POST (batch upsert) ──────────────────────────────────────────────────────

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
    ust_satz: item.ust_satz,
    updated_at: new Date().toISOString(),
  }))

  const { data, error: dbErr } = await supabase
    .from('ust_kategorie_saetze')
    .upsert(rows, { onConflict: 'user_id,kategorie_id,ebene' })
    .select('kategorie_id, ebene, ust_satz')

  if (dbErr) {
    return NextResponse.json({ error: dbErr.message }, { status: 500 })
  }

  return NextResponse.json(data ?? [])
}
