import { NextResponse } from 'next/server'
import { z } from 'zod'
import { requireAuth } from '@/lib/supabase-server'

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/

const putSchema = z.object({
  kpi_kategorie_id: z.string().uuid().nullable().optional(),
  datum: z.string().regex(DATE_RE).optional(),
  nettobetrag: z.number().min(0).optional(),
  begruendung: z.string().nullable().optional(),
})

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string; kostenId: string }> },
) {
  const { user, supabase, error } = await requireAuth()
  if (error) return error

  const { id, kostenId } = await params

  // Verify bestellung belongs to user and is in 'plan' status
  const { data: bestellung, error: bErr } = await supabase
    .from('bestellungen')
    .select('id, status')
    .eq('id', id)
    .eq('user_id', user!.id)
    .maybeSingle()

  if (bErr || !bestellung) return NextResponse.json({ error: 'Nicht gefunden' }, { status: 404 })
  if (bestellung.status !== 'plan') {
    return NextResponse.json({ error: 'Kosten können nur bei Planbestellungen bearbeitet werden' }, { status: 403 })
  }

  const body = await request.json().catch(() => null)
  const parsed = putSchema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })

  const d = parsed.data
  const update: Record<string, unknown> = {}
  if ('kpi_kategorie_id' in d) update.kpi_kategorie_id = d.kpi_kategorie_id ?? null
  if (d.datum !== undefined) update.datum = d.datum
  if (d.nettobetrag !== undefined) update.nettobetrag = d.nettobetrag
  if ('begruendung' in d) update.begruendung = d.begruendung ?? null

  if (Object.keys(update).length === 0) {
    return NextResponse.json({ error: 'Keine Felder zum Aktualisieren' }, { status: 400 })
  }

  const { data: updated, error: uErr } = await supabase
    .from('bestellungen_kosten')
    .update(update)
    .eq('id', kostenId)
    .eq('bestellung_id', id)
    .eq('user_id', user!.id)
    .select('id, kpi_kategorie_id, datum, nettobetrag, begruendung, ist_automatisch, created_at')
    .single()

  if (uErr || !updated) return NextResponse.json({ error: uErr?.message ?? 'Nicht gefunden' }, { status: uErr ? 500 : 404 })

  let kpi_kategorie_name: string | null = null
  if (updated.kpi_kategorie_id) {
    const { data: cat } = await supabase
      .from('kpi_categories')
      .select('name')
      .eq('id', updated.kpi_kategorie_id)
      .maybeSingle()
    kpi_kategorie_name = (cat as { name: string } | null)?.name ?? null
  }

  return NextResponse.json({ ...updated, kpi_kategorie_name })
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string; kostenId: string }> },
) {
  const { user, supabase, error } = await requireAuth()
  if (error) return error

  const { id, kostenId } = await params

  const { error: dErr } = await supabase
    .from('bestellungen_kosten')
    .delete()
    .eq('id', kostenId)
    .eq('bestellung_id', id)
    .eq('user_id', user!.id)

  if (dErr) return NextResponse.json({ error: dErr.message }, { status: 500 })

  return NextResponse.json({ success: true })
}
