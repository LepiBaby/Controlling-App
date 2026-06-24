import { NextResponse } from 'next/server'
import { z } from 'zod'
import { requireAuth } from '@/lib/supabase-server'

const schema = z.object({
  gruppe_id: z.string().uuid(),
  status: z.enum(['laufend', 'abgeschlossen']),
})

export async function POST(request: Request) {
  const { user, supabase, error } = await requireAuth()
  if (error) return error

  const body = await request.json().catch(() => null)
  const parsed = schema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })
  }

  const { gruppe_id, status } = parsed.data

  // Verify the user owns at least one member of this group
  const { data: mitglieder } = await supabase
    .from('bestellungen_konsolidierungsmitglieder')
    .select('bestellung_id')
    .eq('gruppe_id', gruppe_id)
    .eq('user_id', user!.id)

  if (!mitglieder || mitglieder.length === 0) {
    return NextResponse.json({ error: 'Gruppe nicht gefunden' }, { status: 404 })
  }

  const mitgliederIds = mitglieder.map(m => m.bestellung_id)

  const update: Record<string, unknown> = {
    status,
    updated_at: new Date().toISOString(),
  }
  if (status === 'abgeschlossen') {
    update.abgeschlossen_am = new Date().toISOString().split('T')[0]
  }

  const { error: updateErr } = await supabase
    .from('bestellungen')
    .update(update)
    .in('id', mitgliederIds)
    .eq('user_id', user!.id)

  if (updateErr) {
    return NextResponse.json({ error: updateErr.message }, { status: 500 })
  }

  return NextResponse.json({ success: true, updated: mitgliederIds.length })
}
