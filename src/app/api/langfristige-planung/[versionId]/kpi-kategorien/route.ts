import { NextResponse } from 'next/server'
import { z } from 'zod'
import { requireAuth } from '@/lib/supabase-server'

const SELECT_COLS = 'id, plan_version_id, art, parent_id, name, level, sort_order'
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

const VALID_ARTEN = ['lp_sales_plattform', 'lp_produkt', 'lp_marketingkanal', 'lp_investition'] as const
type Art = (typeof VALID_ARTEN)[number]
// Flache Arten: nur Ebene 1, kein Elternknoten. Nur Investitionen erlauben Gruppe (1) → Untergruppe (2).
const FLAT_ARTEN: Art[] = ['lp_sales_plattform', 'lp_produkt', 'lp_marketingkanal']

const createSchema = z.object({
  art: z.enum(VALID_ARTEN),
  name: z.string().min(1).max(100).transform((s) => s.trim()),
  parent_id: z.string().uuid().nullable(),
  level: z.union([z.literal(1), z.literal(2)]),
  sort_order: z.number().int().min(0).optional().default(0),
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
  const art = searchParams.get('art')
  if (!art || !VALID_ARTEN.includes(art as Art)) {
    return NextResponse.json({ error: 'Ungültiger art-Parameter' }, { status: 400 })
  }

  const { data, error: dbErr } = await supabase
    .from('langfristige_kpi_kategorien')
    .select(SELECT_COLS)
    .eq('user_id', user!.id)
    .eq('plan_version_id', versionId)
    .eq('art', art)
    .order('sort_order', { ascending: true })
    .limit(1000)

  if (dbErr) return NextResponse.json({ error: dbErr.message }, { status: 500 })
  return NextResponse.json(data ?? [])
}

export async function POST(request: Request, { params }: RouteContext) {
  const { user, supabase, error } = await requireAuth()
  if (error) return error

  const { versionId } = await params
  const versionError = await ensureVersion(supabase, user!.id, versionId)
  if (versionError) return versionError

  const body = await request.json().catch(() => null)
  const parsed = createSchema.safeParse(body)
  if (!parsed.success || parsed.data.name.length === 0) {
    return NextResponse.json({ error: 'Bitte gib einen Namen mit 1–100 Zeichen an.' }, { status: 400 })
  }

  const { art, name, parent_id, level, sort_order } = parsed.data

  // Flache Arten: nur Ebene 1 ohne Elternknoten
  if (FLAT_ARTEN.includes(art) && (level !== 1 || parent_id !== null)) {
    return NextResponse.json({ error: 'Diese Art unterstützt nur eine flache Liste (Ebene 1).' }, { status: 400 })
  }
  // Ebenen-/Eltern-Konsistenz
  if (level === 1 && parent_id !== null) {
    return NextResponse.json({ error: 'Eine Gruppe (Ebene 1) darf keinen Elternknoten haben.' }, { status: 400 })
  }
  if (level === 2 && parent_id === null) {
    return NextResponse.json({ error: 'Eine Untergruppe (Ebene 2) benötigt eine übergeordnete Gruppe.' }, { status: 400 })
  }

  // Elternknoten validieren: gleiche Version, gleiche Art, Ebene 1
  if (parent_id !== null) {
    const { data: parent, error: parentErr } = await supabase
      .from('langfristige_kpi_kategorien')
      .select('id, level')
      .eq('user_id', user!.id)
      .eq('plan_version_id', versionId)
      .eq('art', art)
      .eq('id', parent_id)
      .maybeSingle()
    if (parentErr) return NextResponse.json({ error: parentErr.message }, { status: 500 })
    if (!parent || parent.level !== 1) {
      return NextResponse.json({ error: 'Ungültige übergeordnete Gruppe.' }, { status: 400 })
    }
  }

  // Doppelten Namen auf derselben Ebene/im selben Elternknoten ablehnen (wie globale Verwaltung)
  let dupQuery = supabase
    .from('langfristige_kpi_kategorien')
    .select('id')
    .eq('user_id', user!.id)
    .eq('plan_version_id', versionId)
    .eq('art', art)
    .eq('name', name)
  dupQuery = parent_id === null ? dupQuery.is('parent_id', null) : dupQuery.eq('parent_id', parent_id)
  const { data: existing } = await dupQuery.limit(1)
  if (existing && existing.length > 0) {
    return NextResponse.json({ error: 'Name bereits vorhanden auf dieser Ebene.' }, { status: 409 })
  }

  const { data, error: dbErr } = await supabase
    .from('langfristige_kpi_kategorien')
    .insert({ user_id: user!.id, plan_version_id: versionId, art, name, parent_id, level, sort_order })
    .select(SELECT_COLS)
    .single()

  if (dbErr) return NextResponse.json({ error: dbErr.message }, { status: 500 })
  return NextResponse.json(data, { status: 201 })
}
