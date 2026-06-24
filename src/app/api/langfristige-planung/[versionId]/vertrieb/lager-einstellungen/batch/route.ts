// PROJ-78: Lager-Bulk „Alle Produkte gleichsetzen" (versions-/nutzergebunden).
// Setzt denselben €/m³/Monat-Wert für alle Produkte der Planversion auf einmal.
import { NextResponse } from 'next/server'
import { z } from 'zod'
import { requireAuth } from '@/lib/supabase-server'
import { ensureVersion, kategorieGehoert, type RouteContext } from '../../_utils'

// Auth-geschützte, pro-Planversion dynamische Route — nie statisch generieren.
// Überspringt den in Next 16 instabilen Static-Path-Pass (Worker-Crash).
export const dynamic = 'force-dynamic'

const putSchema = z.object({
  sales_plattform_id: z.string().uuid(),
  lagerkosten_euro_m3_monat: z.number().min(0).nullable(),
})

export async function PUT(request: Request, { params }: RouteContext) {
  const { user, supabase, error } = await requireAuth()
  if (error) return error
  const { versionId } = await params

  const body = await request.json().catch(() => null)
  const parsed = putSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })
  }

  const verr = await ensureVersion(supabase, user!.id, versionId)
  if (verr) return verr

  const { sales_plattform_id, lagerkosten_euro_m3_monat } = parsed.data

  if (!(await kategorieGehoert(supabase, user!.id, versionId, sales_plattform_id, 'lp_sales_plattform'))) {
    return NextResponse.json({ error: 'Sales Plattform gehört nicht zu dieser Version.' }, { status: 400 })
  }

  // Alle Produkte (lp_produkt) dieser Version laden.
  const { data: produkte, error: prodErr } = await supabase
    .from('langfristige_kpi_kategorien')
    .select('id')
    .eq('user_id', user!.id)
    .eq('plan_version_id', versionId)
    .eq('art', 'lp_produkt')
    .limit(1000)
  if (prodErr) return NextResponse.json({ error: prodErr.message }, { status: 500 })

  if (!produkte || produkte.length === 0) {
    return NextResponse.json([], { status: 200 })
  }

  const now = new Date().toISOString()
  const rows = produkte.map(p => ({
    user_id: user!.id,
    plan_version_id: versionId,
    sales_plattform_id,
    produkt_id: p.id,
    lagerkosten_euro_m3_monat,
    updated_at: now,
  }))

  const { data, error: dbErr } = await supabase
    .from('langfristige_lager_einstellungen')
    .upsert(rows, { onConflict: 'plan_version_id,sales_plattform_id,produkt_id,user_id' })
    .select('sales_plattform_id, produkt_id, lagerkosten_euro_m3_monat')
  if (dbErr) return NextResponse.json({ error: dbErr.message }, { status: 500 })

  return NextResponse.json(data ?? [])
}
