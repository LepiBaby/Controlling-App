import { NextResponse } from 'next/server'
import { requireAuth } from '@/lib/supabase-server'
import { ensureLangfristigeVersion } from '@/lib/langfristige-version'
import { computeLagerbestandVerlauf } from '@/lib/langfristige-bestelllauf-algorithmus'
import { ladeVersionsDaten, ladeMonatsAbsatz } from '../_utils'

// Auth-geschützte, pro-Planversion dynamische Route — nie statisch generieren.
// Überspringt den in Next 16 instabilen Static-Path-Pass (Worker-Crash).
export const dynamic = 'force-dynamic'

// PROJ-86: Monatsbasierter Lagerbestandsverlauf je Produkt (für das Chart).

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

interface RouteContext {
  params: Promise<{ versionId: string }>
}

export async function GET(request: Request, { params }: RouteContext) {
  const { user, supabase, error } = await requireAuth()
  if (error) return error

  const { versionId } = await params
  const versionError = await ensureLangfristigeVersion(supabase, user!.id, versionId)
  if (versionError) return versionError

  const produktId = new URL(request.url).searchParams.get('produkt_id')
  if (!produktId || !UUID_REGEX.test(produktId)) {
    return NextResponse.json({ error: 'Ungültige produkt_id' }, { status: 400 })
  }

  try {
    const { startMonat, horizontMonate, produkte, bestehende } = await ladeVersionsDaten(
      supabase,
      user!.id,
      versionId,
    )

    const produkt = produkte.find((p) => p.produkt_id === produktId)
    if (!produkt) {
      return NextResponse.json({ error: 'Produkt nicht gefunden' }, { status: 404 })
    }

    // Reale Monatswerte aus der Absatzplanung — für die Chart-/Tabellenanzeige.
    const monatsAbsatzMap = await ladeMonatsAbsatz(supabase, user!.id, versionId, produktId)

    const { monate, start_label } = computeLagerbestandVerlauf(
      produkt,
      bestehende,
      startMonat,
      horizontMonate,
      monatsAbsatzMap,
    )

    const hatAbsatz = [...monatsAbsatzMap.values()].some((v) => v > 0)
    const hinweis = !hatAbsatz
      ? 'Keine geplanten Absatzzahlen für dieses Produkt in der Absatzplanung.'
      : null

    return NextResponse.json({ produkt_id: produktId, start_label, monate, hinweis })
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Laden fehlgeschlagen' },
      { status: 500 },
    )
  }
}
