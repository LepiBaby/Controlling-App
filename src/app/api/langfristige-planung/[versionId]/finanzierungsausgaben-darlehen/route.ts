import { NextResponse } from 'next/server'
import { requireAuth } from '@/lib/supabase-server'
import { ensureLangfristigeVersion } from '@/lib/langfristige-version'
import { DARLEHEN_COLS, darlehenSchema } from '@/lib/langfristige-finanzierungsausgaben-effektiv'

// Auth-geschützte, pro-Planversion dynamische Route — nie statisch generieren.
export const dynamic = 'force-dynamic'

// PROJ-107: Finanzierungen (Darlehen) der Finanzierungsausgaben Planung.
//  • GET: alle Finanzierungen der Version (sortiert)
//  • POST: neue Finanzierung (manuell oder aus Kapitalbedarf & Finanzierung übernommen)

interface RouteContext {
  params: Promise<{ versionId: string }>
}

export async function GET(_request: Request, { params }: RouteContext) {
  const { user, supabase, error } = await requireAuth()
  if (error) return error

  const { versionId } = await params
  const versionError = await ensureLangfristigeVersion(supabase, user!.id, versionId)
  if (versionError) return versionError

  const { data, error: dbErr } = await supabase
    .from('langfristige_finanzierungsausgaben_darlehen')
    .select(DARLEHEN_COLS)
    .eq('user_id', user!.id)
    .eq('plan_version_id', versionId)
    .order('sort_order', { ascending: true })
    .order('created_at', { ascending: true })
    .limit(500)

  if (dbErr) return NextResponse.json({ error: dbErr.message }, { status: 500 })
  return NextResponse.json(data ?? [])
}

export async function POST(request: Request, { params }: RouteContext) {
  const { user, supabase, error } = await requireAuth()
  if (error) return error

  const { versionId } = await params
  const versionError = await ensureLangfristigeVersion(supabase, user!.id, versionId)
  if (versionError) return versionError

  const body = await request.json().catch(() => null)
  const parsed = darlehenSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? 'Ungültige Eingabe.' }, { status: 400 })
  }

  const { data: last } = await supabase
    .from('langfristige_finanzierungsausgaben_darlehen')
    .select('sort_order')
    .eq('user_id', user!.id)
    .eq('plan_version_id', versionId)
    .order('sort_order', { ascending: false })
    .limit(1)
    .maybeSingle()

  const { data, error: dbErr } = await supabase
    .from('langfristige_finanzierungsausgaben_darlehen')
    .insert({
      ...parsed.data,
      quelle_kbf_id: parsed.data.quelle_kbf_id ?? null,
      user_id: user!.id,
      plan_version_id: versionId,
      sort_order: (last?.sort_order ?? -1) + 1,
    })
    .select(DARLEHEN_COLS)
    .single()

  if (dbErr) return NextResponse.json({ error: dbErr.message }, { status: 500 })
  return NextResponse.json(data, { status: 201 })
}
