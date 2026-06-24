import { NextResponse } from 'next/server'
import { z } from 'zod'
import { requireAuth } from '@/lib/supabase-server'

const UpsertSchema = z.object({
  produkt_id: z.string().uuid(),
  pufferzeit_tage: z.number().int().min(0).nullable().optional(),
  produktionszeit_tage: z.number().int().min(0).nullable().optional(),
  zwischenzeit_tage: z.number().int().min(0).nullable().optional(),
  shipping_zeit_tage: z.number().int().min(0).nullable().optional(),
  entladungszeit_tage: z.number().int().min(0).nullable().optional(),
})

export async function GET() {
  const { user, supabase, error } = await requireAuth()
  if (error) return error

  const { data, error: dbErr } = await supabase
    .from('produktinformationen_lieferzeit')
    .select('id, produkt_id, pufferzeit_tage, produktionszeit_tage, zwischenzeit_tage, shipping_zeit_tage, entladungszeit_tage')
    .eq('user_id', user!.id)
    .limit(500)

  if (dbErr) return NextResponse.json({ error: dbErr.message }, { status: 500 })

  return NextResponse.json(data ?? [])
}

export async function PUT(request: Request) {
  const { user, supabase, error } = await requireAuth()
  if (error) return error

  const body = await request.json().catch(() => null)
  const parsed = UpsertSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })
  }

  const { data, error: dbErr } = await supabase
    .from('produktinformationen_lieferzeit')
    .upsert(
      {
        user_id: user!.id,
        produkt_id: parsed.data.produkt_id,
        pufferzeit_tage: parsed.data.pufferzeit_tage ?? null,
        produktionszeit_tage: parsed.data.produktionszeit_tage ?? null,
        zwischenzeit_tage: parsed.data.zwischenzeit_tage ?? null,
        shipping_zeit_tage: parsed.data.shipping_zeit_tage ?? null,
        entladungszeit_tage: parsed.data.entladungszeit_tage ?? null,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'user_id,produkt_id' }
    )
    .select('id, produkt_id, pufferzeit_tage, produktionszeit_tage, zwischenzeit_tage, shipping_zeit_tage, entladungszeit_tage')
    .single()

  if (dbErr || !data) {
    return NextResponse.json({ error: dbErr?.message ?? 'Upsert fehlgeschlagen' }, { status: 500 })
  }

  return NextResponse.json(data)
}
