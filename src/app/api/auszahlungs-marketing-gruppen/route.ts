import { NextResponse } from 'next/server'
import { z } from 'zod'
import { requireAuth } from '@/lib/supabase-server'

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

const putSchema = z.object({
  sales_plattform_id: z.string().uuid(),
  kpi_kategorie_id: z.string().uuid(),
  inkludiert: z.boolean(),
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
    .from('auszahlungs_marketing_gruppen')
    .select('kpi_kategorie_id, inkludiert')
    .eq('user_id', user!.id)
    .eq('sales_plattform_id', plattformId)

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

  const { sales_plattform_id, kpi_kategorie_id, inkludiert } = parsed.data

  const { data, error: dbErr } = await supabase
    .from('auszahlungs_marketing_gruppen')
    .upsert(
      {
        sales_plattform_id,
        kpi_kategorie_id,
        inkludiert,
        user_id: user!.id,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'sales_plattform_id,kpi_kategorie_id,user_id' }
    )
    .select('kpi_kategorie_id, inkludiert')
    .single()

  if (dbErr || !data) {
    return NextResponse.json({ error: dbErr?.message ?? 'Upsert fehlgeschlagen' }, { status: 500 })
  }

  return NextResponse.json(data)
}

export async function DELETE(request: Request) {
  const { user, supabase, error } = await requireAuth()
  if (error) return error

  const { searchParams } = new URL(request.url)
  const plattformId = searchParams.get('plattform_id')
  const kategorieId = searchParams.get('kpi_kategorie_id')

  if (!plattformId || !kategorieId) {
    return NextResponse.json({ error: 'plattform_id und kpi_kategorie_id sind erforderlich' }, { status: 400 })
  }

  if (!UUID_REGEX.test(plattformId) || !UUID_REGEX.test(kategorieId)) {
    return NextResponse.json({ error: 'Ungültige IDs' }, { status: 400 })
  }

  const { error: dbErr } = await supabase
    .from('auszahlungs_marketing_gruppen')
    .delete()
    .eq('user_id', user!.id)
    .eq('sales_plattform_id', plattformId)
    .eq('kpi_kategorie_id', kategorieId)

  if (dbErr) {
    return NextResponse.json({ error: dbErr.message }, { status: 500 })
  }

  return NextResponse.json({ success: true })
}
