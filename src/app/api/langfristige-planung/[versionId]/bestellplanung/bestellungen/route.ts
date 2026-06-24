import { NextResponse } from 'next/server'
import { z } from 'zod'
import { requireAuth } from '@/lib/supabase-server'
import { ensureLangfristigeVersion } from '@/lib/langfristige-version'
import { ladeBestellungen } from '../_utils'

// Auth-geschützte, pro-Planversion dynamische Route — nie statisch generieren.
// Überspringt den in Next 16 instabilen Static-Path-Pass (Worker-Crash).
export const dynamic = 'force-dynamic'

// PROJ-86: Bestellungen der Langfristigen Planung (versionsgebunden, Produktebene).
// Keine operative Status-Unterscheidung — alle Bestellungen gemeinsam.

const dateStr = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/)
  .nullable()
  .optional()

const CreateSchema = z.object({
  produkt_id: z.string().uuid(),
  bestelldatum: dateStr,
  produktionsstart_datum: dateStr,
  produktionsende_datum: dateStr,
  shippingdatum: dateStr,
  ankunftsdatum: dateStr,
  verfuegbarkeitsdatum: dateStr,
  menge_theoretisch: z.number().int().min(0).nullable().optional(),
  menge_praktisch: z.number().int().min(0).optional(),
  begruendung: z.string().max(2000).nullable().optional(),
  anzahl_20dc: z.number().int().min(0).optional(),
  anzahl_40hq: z.number().int().min(0).optional(),
  notizen: z.string().max(2000).nullable().optional(),
})

interface RouteContext {
  params: Promise<{ versionId: string }>
}

export async function GET(_request: Request, { params }: RouteContext) {
  const { user, supabase, error } = await requireAuth()
  if (error) return error

  const { versionId } = await params
  const versionError = await ensureLangfristigeVersion(supabase, user!.id, versionId)
  if (versionError) return versionError

  try {
    const data = await ladeBestellungen(supabase, user!.id, versionId)
    return NextResponse.json(data)
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Laden fehlgeschlagen' },
      { status: 500 },
    )
  }
}

export async function POST(request: Request, { params }: RouteContext) {
  const { user, supabase, error } = await requireAuth()
  if (error) return error

  const { versionId } = await params
  const versionError = await ensureLangfristigeVersion(supabase, user!.id, versionId)
  if (versionError) return versionError

  const body = await request.json().catch(() => null)
  const parsed = CreateSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })
  }

  const { data, error: dbErr } = await supabase
    .from('langfristige_bestellungen')
    .insert({
      user_id: user!.id,
      plan_version_id: versionId,
      produkt_id: parsed.data.produkt_id,
      bestelldatum: parsed.data.bestelldatum ?? null,
      produktionsstart_datum: parsed.data.produktionsstart_datum ?? null,
      produktionsende_datum: parsed.data.produktionsende_datum ?? null,
      shippingdatum: parsed.data.shippingdatum ?? null,
      ankunftsdatum: parsed.data.ankunftsdatum ?? null,
      verfuegbarkeitsdatum: parsed.data.verfuegbarkeitsdatum ?? null,
      menge_theoretisch: parsed.data.menge_theoretisch ?? null,
      menge_praktisch: parsed.data.menge_praktisch ?? 0,
      begruendung: parsed.data.begruendung ?? null,
      herkunft: 'manuell',
      anzahl_20dc: parsed.data.anzahl_20dc ?? 0,
      anzahl_40hq: parsed.data.anzahl_40hq ?? 0,
      notizen: parsed.data.notizen ?? null,
    })
    .select('id')
    .single()

  if (dbErr || !data) {
    return NextResponse.json({ error: dbErr?.message ?? 'Anlegen fehlgeschlagen' }, { status: 500 })
  }

  return NextResponse.json({ id: data.id }, { status: 201 })
}
