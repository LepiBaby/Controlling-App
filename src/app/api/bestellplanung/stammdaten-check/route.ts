import { NextResponse } from 'next/server'
import { requireAuth } from '@/lib/supabase-server'

export async function GET() {
  const { user, supabase, error } = await requireAuth()
  if (error) return error

  // Basis: Produkte mit aktiver Berechnungsart in den Absatzeinstellungen (nicht 'keine')
  const { data: einstellungenRows } = await supabase
    .from('absatz_einstellungen')
    .select('produkt_id')
    .eq('user_id', user!.id)
    .neq('berechnungsart', 'keine')
    .limit(500)

  const produktIds = [...new Set(
    ((einstellungenRows ?? []) as Array<{ produkt_id: string }>).map(r => r.produkt_id)
  )]

  if (produktIds.length === 0) {
    return NextResponse.json({
      ok: false,
      fehler: ['Keine Produkte mit aktiver Berechnungsart in den Absatzeinstellungen gefunden.'],
    })
  }

  // Alle Stammdaten-Checks parallel
  const [
    produktNamesRes,
    lieferzeitRes,
    bestandsRes,
    moqRes,
    containerRes,
    containerGlobalRes,
    herstellerRes,
  ] = await Promise.all([
    supabase
      .from('kpi_categories')
      .select('id, name')
      .in('id', produktIds)
      .limit(500),
    supabase
      .from('produktinformationen_lieferzeit')
      .select('produkt_id')
      .eq('user_id', user!.id)
      .in('produkt_id', produktIds)
      .limit(500),
    supabase
      .from('produktinformationen_bestandsverwaltung')
      .select('produkt_id')
      .eq('user_id', user!.id)
      .in('produkt_id', produktIds)
      .limit(500),
    supabase
      .from('produktinformationen_moq')
      .select('produkt_id')
      .eq('user_id', user!.id)
      .in('produkt_id', produktIds)
      .limit(500),
    supabase
      .from('produktinformationen_containerkapazitaet')
      .select('produkt_id')
      .eq('user_id', user!.id)
      .in('produkt_id', produktIds)
      .limit(500),
    supabase
      .from('produktinformationen_container_global')
      .select('volumen_20dc, volumen_40hq')
      .eq('user_id', user!.id)
      .maybeSingle(),
    supabase
      .from('produktinformationen_hersteller_zuordnung')
      .select('produkt_id')
      .eq('user_id', user!.id)
      .in('produkt_id', produktIds)
      .limit(500),
  ])

  const produktNameMap = new Map(
    ((produktNamesRes.data ?? []) as Array<{ id: string; name: string }>).map(p => [p.id, p.name])
  )

  function namen(ids: string[]) {
    return ids.map(id => produktNameMap.get(id) ?? id).join(', ')
  }

  const fehler: string[] = []

  const mitLieferzeit = new Set(
    ((lieferzeitRes.data ?? []) as Array<{ produkt_id: string }>).map(r => r.produkt_id)
  )
  const ohneLieferzeit = produktIds.filter(id => !mitLieferzeit.has(id))
  if (ohneLieferzeit.length > 0) fehler.push(`Lieferzeit fehlt für: ${namen(ohneLieferzeit)}`)

  const mitBestand = new Set(
    ((bestandsRes.data ?? []) as Array<{ produkt_id: string }>).map(r => r.produkt_id)
  )
  const ohneBestand = produktIds.filter(id => !mitBestand.has(id))
  if (ohneBestand.length > 0) fehler.push(`Bestandsverwaltung fehlt für: ${namen(ohneBestand)}`)

  const mitMoq = new Set(
    ((moqRes.data ?? []) as Array<{ produkt_id: string }>).map(r => r.produkt_id)
  )
  const ohneMoq = produktIds.filter(id => !mitMoq.has(id))
  if (ohneMoq.length > 0) fehler.push(`MOQ fehlt für: ${namen(ohneMoq)}`)

  const mitContainer = new Set(
    ((containerRes.data ?? []) as Array<{ produkt_id: string }>).map(r => r.produkt_id)
  )
  const ohneContainer = produktIds.filter(id => !mitContainer.has(id))
  if (ohneContainer.length > 0) fehler.push(`Containerkapazität fehlt für: ${namen(ohneContainer)}`)

  const globalData = containerGlobalRes.data as { volumen_20dc: number | null; volumen_40hq: number | null } | null
  if (!globalData?.volumen_20dc && !globalData?.volumen_40hq) {
    fehler.push('Globale Containervolumen (20DC / 40HQ) nicht hinterlegt')
  }

  const mitHersteller = new Set(
    ((herstellerRes.data ?? []) as Array<{ produkt_id: string }>).map(r => r.produkt_id)
  )
  const ohneHersteller = produktIds.filter(id => !mitHersteller.has(id))
  if (ohneHersteller.length > 0) fehler.push(`Hersteller-Zuordnung fehlt für: ${namen(ohneHersteller)}`)

  return NextResponse.json({ ok: fehler.length === 0, fehler })
}
