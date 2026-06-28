import { NextResponse } from 'next/server'
import { z } from 'zod'
import { requireAuth } from '@/lib/supabase-server'
import { fetchAllRows } from '@/lib/supabase-paginate'

const putSchema = z.object({
  seite: z.string().min(1).max(100),
  zellen_schluessel: z.string().min(1).max(500),
  notiz_text: z.string().min(1),
})

export async function GET(request: Request) {
  const { supabase, error } = await requireAuth()
  if (error) return error

  const { searchParams } = new URL(request.url)
  const seite = searchParams.get('seite')

  if (!seite) {
    return NextResponse.json({ error: 'seite ist erforderlich' }, { status: 400 })
  }

  const { data, error: dbErr } = await fetchAllRows<{ zellen_schluessel: string; notiz_text: string }>((from, to) =>
    supabase
      .from('planung_notizen')
      .select('zellen_schluessel, notiz_text')
      .eq('seite', seite)
      .order('id', { ascending: true })
      .range(from, to)
  )

  if (dbErr) return NextResponse.json({ error: dbErr.message }, { status: 500 })
  return NextResponse.json({ data: data ?? [] })
}

export async function PUT(request: Request) {
  const { supabase, error } = await requireAuth()
  if (error) return error

  const body = await request.json().catch(() => null)
  const parsed = putSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })
  }

  const { seite, zellen_schluessel, notiz_text } = parsed.data

  const { data, error: dbErr } = await supabase
    .from('planung_notizen')
    .upsert(
      {
        seite,
        zellen_schluessel,
        notiz_text,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'seite,zellen_schluessel' },
    )
    .select('zellen_schluessel, notiz_text')
    .single()

  if (dbErr || !data) {
    return NextResponse.json({ error: dbErr?.message ?? 'Upsert fehlgeschlagen' }, { status: 500 })
  }

  return NextResponse.json(data)
}

export async function DELETE(request: Request) {
  const { supabase, error } = await requireAuth()
  if (error) return error

  const { searchParams } = new URL(request.url)
  const seite = searchParams.get('seite')
  const zellenSchluessel = searchParams.get('zellen_schluessel')

  if (!seite) {
    return NextResponse.json({ error: 'seite ist erforderlich' }, { status: 400 })
  }

  if (zellenSchluessel) {
    // Delete single notiz
    const { error: dbErr } = await supabase
      .from('planung_notizen')
      .delete()
      .eq('seite', seite)
      .eq('zellen_schluessel', zellenSchluessel)
    if (dbErr) return NextResponse.json({ error: dbErr.message }, { status: 500 })
  } else {
    // Delete all notizen for this seite (RLS ensures only own rows are affected)
    const { error: dbErr } = await supabase
      .from('planung_notizen')
      .delete()
      .eq('seite', seite)
    if (dbErr) return NextResponse.json({ error: dbErr.message }, { status: 500 })
  }

  return NextResponse.json({ success: true })
}
