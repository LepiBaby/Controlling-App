import { NextResponse } from 'next/server'
import { requireAuth } from '@/lib/supabase-server'

// Auth-geschützte, dynamische Route — nie statisch generieren (Next 16 Static-Path-Pass instabil).
export const dynamic = 'force-dynamic'

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

interface RouteContext {
  params: Promise<{ id: string }>
}

// POST /api/langfristige-planung/planversionen/[id]/duplicate (PROJ-104)
// Legt eine vollständige, unabhängige Kopie der Planversion an. Die eigentliche
// Kopier-Arbeit erledigt die atomare DB-Funktion `duplicate_langfristige_planversion`
// (kopiert alle versionsgebundenen Tabellen, mappt interne Referenzen um, vergibt
// einen eindeutigen Auto-Namen „… (Kopie)" und übernimmt den Ordner des Originals).
export async function POST(_request: Request, { params }: RouteContext) {
  const { supabase, error } = await requireAuth()
  if (error) return error

  const { id } = await params
  if (!UUID_REGEX.test(id)) {
    return NextResponse.json({ error: 'Ungültige ID' }, { status: 400 })
  }

  const { data, error: rpcErr } = await supabase.rpc('duplicate_langfristige_planversion', {
    p_source_id: id,
  })

  if (rpcErr) {
    // Quelle nicht vorhanden / gehört nicht dem Nutzer -> 404 (Funktion wirft P0002)
    if (rpcErr.code === 'P0002' || rpcErr.message?.includes('planversion_not_found')) {
      return NextResponse.json({ error: 'Planversion nicht gefunden' }, { status: 404 })
    }
    return NextResponse.json({ error: rpcErr.message }, { status: 500 })
  }

  return NextResponse.json(data, { status: 201 })
}
