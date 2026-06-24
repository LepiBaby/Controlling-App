import { NextResponse } from 'next/server'
import { z } from 'zod'
import { requireAuth } from '@/lib/supabase-server'
import { ensureLangfristigeVersion } from '@/lib/langfristige-version'

// Auth-geschützte, pro-Planversion dynamische Route — nie statisch generieren.
// Überspringt den in Next 16 instabilen Static-Path-Pass (Worker-Crash).
export const dynamic = 'force-dynamic'

// PROJ-84: Versionsgebundene Zellen-Notizen für Planungsseiten der Langfristigen
// Planung. Seitenübergreifend (Feld `seite`), je Planversion isoliert.

const putSchema = z.object({
  seite: z.string().min(1).max(100),
  zellen_schluessel: z.string().min(1).max(500),
  notiz_text: z.string().min(1),
})

interface RouteContext {
  params: Promise<{ versionId: string }>
}

export async function GET(request: Request, { params }: RouteContext) {
  const { user, supabase, error } = await requireAuth()
  if (error) return error

  const { versionId } = await params
  const versionError = await ensureLangfristigeVersion(supabase, user!.id, versionId)
  if (versionError) return versionError

  const { searchParams } = new URL(request.url)
  const seite = searchParams.get('seite')
  if (!seite) {
    return NextResponse.json({ error: 'seite ist erforderlich' }, { status: 400 })
  }

  const { data, error: dbErr } = await supabase
    .from('langfristige_planung_notizen')
    .select('zellen_schluessel, notiz_text')
    .eq('user_id', user!.id)
    .eq('plan_version_id', versionId)
    .eq('seite', seite)
    .limit(10000)

  if (dbErr) return NextResponse.json({ error: dbErr.message }, { status: 500 })
  return NextResponse.json({ data: data ?? [] })
}

export async function PUT(request: Request, { params }: RouteContext) {
  const { user, supabase, error } = await requireAuth()
  if (error) return error

  const { versionId } = await params
  const versionError = await ensureLangfristigeVersion(supabase, user!.id, versionId)
  if (versionError) return versionError

  const body = await request.json().catch(() => null)
  const parsed = putSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })
  }

  const { seite, zellen_schluessel, notiz_text } = parsed.data

  const { data, error: dbErr } = await supabase
    .from('langfristige_planung_notizen')
    .upsert(
      {
        user_id: user!.id,
        plan_version_id: versionId,
        seite,
        zellen_schluessel,
        notiz_text,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'plan_version_id,seite,zellen_schluessel' },
    )
    .select('zellen_schluessel, notiz_text')
    .single()

  if (dbErr || !data) {
    return NextResponse.json({ error: dbErr?.message ?? 'Upsert fehlgeschlagen' }, { status: 500 })
  }

  return NextResponse.json(data)
}

export async function DELETE(request: Request, { params }: RouteContext) {
  const { user, supabase, error } = await requireAuth()
  if (error) return error

  const { versionId } = await params
  const versionError = await ensureLangfristigeVersion(supabase, user!.id, versionId)
  if (versionError) return versionError

  const { searchParams } = new URL(request.url)
  const seite = searchParams.get('seite')
  const zellenSchluessel = searchParams.get('zellen_schluessel')

  if (!seite) {
    return NextResponse.json({ error: 'seite ist erforderlich' }, { status: 400 })
  }

  let query = supabase
    .from('langfristige_planung_notizen')
    .delete()
    .eq('user_id', user!.id)
    .eq('plan_version_id', versionId)
    .eq('seite', seite)

  // Mit zellen_schluessel: nur eine Notiz; ohne: alle Notizen der Seite (in dieser Version)
  if (zellenSchluessel) {
    query = query.eq('zellen_schluessel', zellenSchluessel)
  }

  const { error: dbErr } = await query
  if (dbErr) return NextResponse.json({ error: dbErr.message }, { status: 500 })

  return NextResponse.json({ success: true })
}
