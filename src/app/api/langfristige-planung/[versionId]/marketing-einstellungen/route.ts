import { NextResponse } from 'next/server'
import { z } from 'zod'
import { requireAuth } from '@/lib/supabase-server'

// Auth-geschützte, pro-Planversion dynamische Route — nie statisch generieren.
// Überspringt den in Next 16 instabilen Static-Path-Pass (Worker-Crash).
export const dynamic = 'force-dynamic'

// PROJ-80: Versionsgebundene Marketing-Einstellungen (Langfristige Planung).
// GET liefert die Einstellung eines Marketingkanals (Sales Plattform, Gruppierung,
// Zahlungsziel), PUT macht einen Upsert. Alle Zugriffe sind nutzer- und
// versionsgebunden. KEINE Produkt-Tabelle, KEIN Anker, KEINE n:m-Verknüpfung.

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

const EINSTELLUNG_COLS =
  'marketingkanal_id, sales_plattform_id, gruppierung, zahlungsziel_tage'

const GRUPPIERUNG_VALUES = ['monatlich', 'quartalsweise'] as const

const putSchema = z.object({
  marketingkanal_id: z.string().uuid(),
  sales_plattform_id: z.string().uuid().nullable().default(null),
  gruppierung: z.enum(GRUPPIERUNG_VALUES).default('monatlich'),
  zahlungsziel_tage: z.number().int().min(0).nullable().default(null),
})

interface RouteContext {
  params: Promise<{ versionId: string }>
}

// Prüft, dass die Planversion existiert UND dem eingeloggten Nutzer gehört.
// Liefert eine fertige Fehler-Response oder null (= ok).
async function ensureVersion(
  supabase: Awaited<ReturnType<typeof requireAuth>>['supabase'],
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

export async function GET(request: Request, { params }: RouteContext) {
  const { user, supabase, error } = await requireAuth()
  if (error) return error

  const { versionId } = await params
  const versionError = await ensureVersion(supabase, user!.id, versionId)
  if (versionError) return versionError

  const { searchParams } = new URL(request.url)
  const marketingkanalId = searchParams.get('marketingkanal_id')
  if (!marketingkanalId) {
    return NextResponse.json({ error: 'marketingkanal_id ist erforderlich' }, { status: 400 })
  }
  if (!UUID_REGEX.test(marketingkanalId)) {
    return NextResponse.json({ error: 'Ungültige marketingkanal_id' }, { status: 400 })
  }

  const { data: einstellung, error: dbErr } = await supabase
    .from('langfristige_marketing_einstellungen')
    .select(EINSTELLUNG_COLS)
    .eq('user_id', user!.id)
    .eq('plan_version_id', versionId)
    .eq('marketingkanal_id', marketingkanalId)
    .maybeSingle()

  if (dbErr) return NextResponse.json({ error: dbErr.message }, { status: 500 })

  // Noch kein Eintrag: null (Frontend zeigt Standardwerte).
  if (!einstellung) {
    return NextResponse.json(null)
  }

  return NextResponse.json({
    marketingkanal_id: marketingkanalId,
    sales_plattform_id: einstellung.sales_plattform_id ?? null,
    gruppierung: einstellung.gruppierung ?? 'monatlich',
    zahlungsziel_tage: einstellung.zahlungsziel_tage ?? null,
  })
}

export async function PUT(request: Request, { params }: RouteContext) {
  const { user, supabase, error } = await requireAuth()
  if (error) return error

  const { versionId } = await params

  // Eingaben zuerst validieren (günstiger als ein DB-Roundtrip), danach Eigentum.
  const body = await request.json().catch(() => null)
  const parsed = putSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })
  }

  const versionError = await ensureVersion(supabase, user!.id, versionId)
  if (versionError) return versionError

  const { marketingkanal_id, sales_plattform_id, gruppierung, zahlungsziel_tage } =
    parsed.data

  // Marketingkanal muss zur Version & Art lp_marketingkanal gehören.
  const { data: kanal, error: kErr } = await supabase
    .from('langfristige_kpi_kategorien')
    .select('id')
    .eq('user_id', user!.id)
    .eq('plan_version_id', versionId)
    .eq('art', 'lp_marketingkanal')
    .eq('id', marketingkanal_id)
    .maybeSingle()
  if (kErr) return NextResponse.json({ error: kErr.message }, { status: 500 })
  if (!kanal) {
    return NextResponse.json(
      { error: 'Marketingkanal gehört nicht zu dieser Version.' },
      { status: 400 },
    )
  }

  // Falls gesetzt: Sales Plattform muss zur Version & Art lp_sales_plattform gehören.
  if (sales_plattform_id !== null) {
    const { data: plattform, error: pErr } = await supabase
      .from('langfristige_kpi_kategorien')
      .select('id')
      .eq('user_id', user!.id)
      .eq('plan_version_id', versionId)
      .eq('art', 'lp_sales_plattform')
      .eq('id', sales_plattform_id)
      .maybeSingle()
    if (pErr) return NextResponse.json({ error: pErr.message }, { status: 500 })
    if (!plattform) {
      return NextResponse.json(
        { error: 'Sales Plattform gehört nicht zu dieser Version.' },
        { status: 400 },
      )
    }
  }

  const { data: einstellung, error: dbErr } = await supabase
    .from('langfristige_marketing_einstellungen')
    .upsert(
      {
        user_id: user!.id,
        plan_version_id: versionId,
        marketingkanal_id,
        sales_plattform_id,
        gruppierung,
        zahlungsziel_tage,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'plan_version_id,marketingkanal_id,user_id' },
    )
    .select(EINSTELLUNG_COLS)
    .single()

  if (dbErr || !einstellung) {
    return NextResponse.json({ error: dbErr?.message ?? 'Upsert fehlgeschlagen' }, { status: 500 })
  }

  return NextResponse.json({
    marketingkanal_id: einstellung.marketingkanal_id,
    sales_plattform_id: einstellung.sales_plattform_id ?? null,
    gruppierung: einstellung.gruppierung,
    zahlungsziel_tage: einstellung.zahlungsziel_tage ?? null,
  })
}
