import { NextResponse } from 'next/server'
import { z, type ZodRawShape } from 'zod'
import { requireAuth } from '@/lib/supabase-server'

// PROJ-78: Gemeinsame Bausteine für die versions-/nutzergebundenen
// Vertriebseinstellungs-Endpunkte. Reduziert Duplikat über die neun Bereiche
// (Versand/Lager/Ersatzteile/Retouren) auf wenige Fabriken.

export const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

type SupabaseClient = Awaited<ReturnType<typeof requireAuth>>['supabase']

export interface RouteContext {
  params: Promise<{ versionId: string }>
}

// Prüft, dass die Planversion existiert UND dem Nutzer gehört.
export async function ensureVersion(
  supabase: SupabaseClient,
  userId: string,
  versionId: string,
): Promise<Response | null> {
  if (!UUID_REGEX.test(versionId)) {
    return NextResponse.json({ error: 'Ungültige Versions-ID' }, { status: 400 })
  }
  const { data, error } = await supabase
    .from('langfristige_planversionen')
    .select('id')
    .eq('user_id', userId)
    .eq('id', versionId)
    .maybeSingle()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  if (!data) return NextResponse.json({ error: 'Planversion nicht gefunden' }, { status: 404 })
  return null
}

// Prüft, dass eine Kategorie (Produkt/Plattform) zur Version & Art gehört.
export async function kategorieGehoert(
  supabase: SupabaseClient,
  userId: string,
  versionId: string,
  id: string,
  art: 'lp_sales_plattform' | 'lp_produkt',
): Promise<boolean> {
  const { data } = await supabase
    .from('langfristige_kpi_kategorien')
    .select('id')
    .eq('user_id', userId)
    .eq('plan_version_id', versionId)
    .eq('art', art)
    .eq('id', id)
    .maybeSingle()
  return !!data
}

const zahlungszielSchema = z.number().int().min(0).nullable().optional()
const gruppierungSchema = z.enum(['monatlich', 'quartalsweise']).optional()

interface GruppierungRow {
  gruppierung: 'monatlich' | 'quartalsweise'
  zahlungsziel_tage: number | null
}

const GRUPPIERUNG_DEFAULTS: GruppierungRow = { gruppierung: 'monatlich', zahlungsziel_tage: null }

// --- Fabrik: plattformgebundene Gruppierung (Versand/Lager/Ersatzteile) --------

export function makeGruppierungPlattformRoute(table: string) {
  const putSchema = z
    .object({
      sales_plattform_id: z.string().uuid(),
      gruppierung: gruppierungSchema,
      zahlungsziel_tage: zahlungszielSchema,
    })
    .refine(d => d.gruppierung !== undefined || d.zahlungsziel_tage !== undefined, {
      message: 'Mindestens ein Feld erforderlich',
    })

  async function GET(request: Request, { params }: RouteContext) {
    const { user, supabase, error } = await requireAuth()
    if (error) return error
    const { versionId } = await params
    const verr = await ensureVersion(supabase, user!.id, versionId)
    if (verr) return verr

    const plattformId = new URL(request.url).searchParams.get('plattform_id')
    if (!plattformId || !UUID_REGEX.test(plattformId)) {
      return NextResponse.json({ error: 'Ungültige plattform_id' }, { status: 400 })
    }

    const { data, error: dbErr } = await supabase
      .from(table)
      .select('gruppierung, zahlungsziel_tage')
      .eq('user_id', user!.id)
      .eq('plan_version_id', versionId)
      .eq('sales_plattform_id', plattformId)
      .maybeSingle()
    if (dbErr) return NextResponse.json({ error: dbErr.message }, { status: 500 })
    return NextResponse.json(data ?? null)
  }

  async function PUT(request: Request, { params }: RouteContext) {
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

    if (!(await kategorieGehoert(supabase, user!.id, versionId, parsed.data.sales_plattform_id, 'lp_sales_plattform'))) {
      return NextResponse.json({ error: 'Sales Plattform gehört nicht zu dieser Version.' }, { status: 400 })
    }

    const { data: existing } = await supabase
      .from(table)
      .select('gruppierung, zahlungsziel_tage')
      .eq('user_id', user!.id)
      .eq('plan_version_id', versionId)
      .eq('sales_plattform_id', parsed.data.sales_plattform_id)
      .maybeSingle()

    const base: GruppierungRow = existing ?? GRUPPIERUNG_DEFAULTS
    const merged = {
      user_id: user!.id,
      plan_version_id: versionId,
      sales_plattform_id: parsed.data.sales_plattform_id,
      gruppierung: parsed.data.gruppierung ?? base.gruppierung,
      zahlungsziel_tage:
        parsed.data.zahlungsziel_tage !== undefined ? parsed.data.zahlungsziel_tage : base.zahlungsziel_tage,
      updated_at: new Date().toISOString(),
    }

    const { data, error: dbErr } = await supabase
      .from(table)
      .upsert(merged, { onConflict: 'plan_version_id,sales_plattform_id,user_id' })
      .select('gruppierung, zahlungsziel_tage')
      .single()
    if (dbErr || !data) {
      return NextResponse.json({ error: dbErr?.message ?? 'Upsert fehlgeschlagen' }, { status: 500 })
    }
    return NextResponse.json(data)
  }

  return { GET, PUT }
}

// --- Fabrik: versionsweite Gruppierung (Retouren-Allgemein) --------------------

export function makeGruppierungVersionRoute(table: string) {
  const putSchema = z
    .object({ gruppierung: gruppierungSchema, zahlungsziel_tage: zahlungszielSchema })
    .refine(d => d.gruppierung !== undefined || d.zahlungsziel_tage !== undefined, {
      message: 'Mindestens ein Feld erforderlich',
    })

  async function GET(_request: Request, { params }: RouteContext) {
    const { user, supabase, error } = await requireAuth()
    if (error) return error
    const { versionId } = await params
    const verr = await ensureVersion(supabase, user!.id, versionId)
    if (verr) return verr

    const { data, error: dbErr } = await supabase
      .from(table)
      .select('gruppierung, zahlungsziel_tage')
      .eq('user_id', user!.id)
      .eq('plan_version_id', versionId)
      .maybeSingle()
    if (dbErr) return NextResponse.json({ error: dbErr.message }, { status: 500 })
    return NextResponse.json(data ?? null)
  }

  async function PUT(request: Request, { params }: RouteContext) {
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

    const { data: existing } = await supabase
      .from(table)
      .select('gruppierung, zahlungsziel_tage')
      .eq('user_id', user!.id)
      .eq('plan_version_id', versionId)
      .maybeSingle()

    const base: GruppierungRow = existing ?? GRUPPIERUNG_DEFAULTS
    const merged = {
      user_id: user!.id,
      plan_version_id: versionId,
      gruppierung: parsed.data.gruppierung ?? base.gruppierung,
      zahlungsziel_tage:
        parsed.data.zahlungsziel_tage !== undefined ? parsed.data.zahlungsziel_tage : base.zahlungsziel_tage,
      updated_at: new Date().toISOString(),
    }

    const { data, error: dbErr } = await supabase
      .from(table)
      .upsert(merged, { onConflict: 'plan_version_id,user_id' })
      .select('gruppierung, zahlungsziel_tage')
      .single()
    if (dbErr || !data) {
      return NextResponse.json({ error: dbErr?.message ?? 'Upsert fehlgeschlagen' }, { status: 500 })
    }
    return NextResponse.json(data)
  }

  return { GET, PUT }
}

// --- Fabrik: plattformgebundene Produktwerte (Versand/Lager/Ersatzteile/Retouren) -

export function makeProduktPlattformRoute(opts: {
  table: string
  selectCols: string
  fields: ZodRawShape
}) {
  const putSchema = z.object({
    sales_plattform_id: z.string().uuid(),
    produkt_id: z.string().uuid(),
    ...opts.fields,
  })

  async function GET(request: Request, { params }: RouteContext) {
    const { user, supabase, error } = await requireAuth()
    if (error) return error
    const { versionId } = await params
    const verr = await ensureVersion(supabase, user!.id, versionId)
    if (verr) return verr

    const plattformId = new URL(request.url).searchParams.get('plattform_id')
    if (!plattformId || !UUID_REGEX.test(plattformId)) {
      return NextResponse.json({ error: 'Ungültige plattform_id' }, { status: 400 })
    }

    const { data, error: dbErr } = await supabase
      .from(opts.table)
      .select(opts.selectCols)
      .eq('user_id', user!.id)
      .eq('plan_version_id', versionId)
      .eq('sales_plattform_id', plattformId)
      .limit(1000)
    if (dbErr) return NextResponse.json({ error: dbErr.message }, { status: 500 })
    return NextResponse.json(data ?? [])
  }

  async function PUT(request: Request, { params }: RouteContext) {
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

    if (!(await kategorieGehoert(supabase, user!.id, versionId, parsed.data.sales_plattform_id, 'lp_sales_plattform'))) {
      return NextResponse.json({ error: 'Sales Plattform gehört nicht zu dieser Version.' }, { status: 400 })
    }
    if (!(await kategorieGehoert(supabase, user!.id, versionId, parsed.data.produkt_id, 'lp_produkt'))) {
      return NextResponse.json({ error: 'Produkt gehört nicht zu dieser Version.' }, { status: 400 })
    }

    const row = {
      ...parsed.data,
      user_id: user!.id,
      plan_version_id: versionId,
      updated_at: new Date().toISOString(),
    }

    const { data, error: dbErr } = await supabase
      .from(opts.table)
      .upsert(row, { onConflict: 'plan_version_id,sales_plattform_id,produkt_id,user_id' })
      .select(opts.selectCols)
      .single()
    if (dbErr || !data) {
      return NextResponse.json({ error: dbErr?.message ?? 'Upsert fehlgeschlagen' }, { status: 500 })
    }
    return NextResponse.json(data)
  }

  return { GET, PUT }
}

// --- Fabrik: versionsweite Produktwerte (Retouren-Allgemein-Produkt) -----------

export function makeProduktVersionRoute(opts: {
  table: string
  selectCols: string
  fields: ZodRawShape
}) {
  const putSchema = z.object({
    produkt_id: z.string().uuid(),
    ...opts.fields,
  })

  async function GET(_request: Request, { params }: RouteContext) {
    const { user, supabase, error } = await requireAuth()
    if (error) return error
    const { versionId } = await params
    const verr = await ensureVersion(supabase, user!.id, versionId)
    if (verr) return verr

    const { data, error: dbErr } = await supabase
      .from(opts.table)
      .select(opts.selectCols)
      .eq('user_id', user!.id)
      .eq('plan_version_id', versionId)
      .limit(1000)
    if (dbErr) return NextResponse.json({ error: dbErr.message }, { status: 500 })
    return NextResponse.json(data ?? [])
  }

  async function PUT(request: Request, { params }: RouteContext) {
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

    if (!(await kategorieGehoert(supabase, user!.id, versionId, parsed.data.produkt_id, 'lp_produkt'))) {
      return NextResponse.json({ error: 'Produkt gehört nicht zu dieser Version.' }, { status: 400 })
    }

    const row = {
      ...parsed.data,
      user_id: user!.id,
      plan_version_id: versionId,
      updated_at: new Date().toISOString(),
    }

    const { data, error: dbErr } = await supabase
      .from(opts.table)
      .upsert(row, { onConflict: 'plan_version_id,produkt_id,user_id' })
      .select(opts.selectCols)
      .single()
    if (dbErr || !data) {
      return NextResponse.json({ error: dbErr?.message ?? 'Upsert fehlgeschlagen' }, { status: 500 })
    }
    return NextResponse.json(data)
  }

  return { GET, PUT }
}

// Geld-/Prozent-Feldbausteine für die Fabriken.
export const geldFeld = z.number().min(0).nullable()
export const prozentFeld = z.number().min(0).max(100).nullable()
