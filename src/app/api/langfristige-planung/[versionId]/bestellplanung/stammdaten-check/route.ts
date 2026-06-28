import { NextResponse } from 'next/server'
import { requireAuth } from '@/lib/supabase-server'
import { ensureLangfristigeVersion } from '@/lib/langfristige-version'
import { fetchAllRows } from '@/lib/supabase-paginate'

// Auth-geschützte, pro-Planversion dynamische Route — nie statisch generieren.
export const dynamic = 'force-dynamic'

// PROJ-86: Prüft, ob für ALLE Produkte des KPI-Modells dieser Version alle für
// den Bestelllauf benötigten Daten hinterlegt sind. Liefert je Produkt die
// fehlenden Daten (analog zur kurzfristigen Planung).

interface RouteContext {
  params: Promise<{ versionId: string }>
}

export async function GET(_request: Request, { params }: RouteContext) {
  const { user, supabase, error } = await requireAuth()
  if (error) return error

  const { versionId } = await params
  const versionError = await ensureLangfristigeVersion(supabase, user!.id, versionId)
  if (versionError) return versionError

  const userId = user!.id

  // Produkte der Version
  const { data: produktRows } = await supabase
    .from('langfristige_kpi_kategorien')
    .select('id, name')
    .eq('user_id', userId)
    .eq('plan_version_id', versionId)
    .eq('art', 'lp_produkt')
    .eq('level', 1)
    .order('sort_order', { ascending: true })
    .limit(500)

  const produkte = (produktRows ?? []) as Array<{ id: string; name: string }>
  if (produkte.length === 0) {
    return NextResponse.json({
      ok: false,
      fehler: ['Keine Produkte im KPI-Modell dieser Planversion. Bitte zuerst Produkte anlegen.'],
    })
  }
  const [
    absatzRes,
    bestandRes,
    lieferzeitRes,
    bestandsvRes,
    moqRes,
    containerRes,
    herstellerRes,
    containerGlobalRes,
  ] = await Promise.all([
    fetchAllRows((from, to) =>
      supabase
        .from('langfristige_absatz_planung')
        .select('produkt_id')
        .eq('user_id', userId)
        .eq('plan_version_id', versionId)
        .not('absatz', 'is', null)
        .order('id', { ascending: true })
        .range(from, to)
    ),
    supabase
      .from('langfristige_produktinformationen_aktueller_bestand')
      .select('produkt_id, bestand')
      .eq('user_id', userId)
      .eq('plan_version_id', versionId)
      .limit(500),
    supabase
      .from('langfristige_produktinformationen_lieferzeit')
      .select('produkt_id, pufferzeit_tage, produktionszeit_tage, zwischenzeit_tage, shipping_zeit_tage, entladungszeit_tage')
      .eq('user_id', userId)
      .eq('plan_version_id', versionId)
      .limit(500),
    supabase
      .from('langfristige_produktinformationen_bestandsverwaltung')
      .select('produkt_id, sicherheitsbestand, zielreichweite_wochen')
      .eq('user_id', userId)
      .eq('plan_version_id', versionId)
      .limit(500),
    supabase
      .from('langfristige_produktinformationen_moq')
      .select('produkt_id, moq')
      .eq('user_id', userId)
      .eq('plan_version_id', versionId)
      .limit(500),
    supabase
      .from('langfristige_produktinformationen_containerkapazitaet')
      .select('produkt_id, laenge_cm, breite_cm, hoehe_cm')
      .eq('user_id', userId)
      .eq('plan_version_id', versionId)
      .limit(500),
    supabase
      .from('langfristige_produktinformationen_hersteller_zuordnung')
      .select('produkt_id, hersteller_id')
      .eq('user_id', userId)
      .eq('plan_version_id', versionId)
      .limit(500),
    supabase
      .from('langfristige_produktinformationen_container_global')
      .select('volumen_20dc, volumen_40hq')
      .eq('user_id', userId)
      .eq('plan_version_id', versionId)
      .maybeSingle(),
  ])

  const mitAbsatz = new Set(
    ((absatzRes.data ?? []) as Array<{ produkt_id: string }>).map((r) => r.produkt_id),
  )
  const mitBestand = new Set(
    ((bestandRes.data ?? []) as Array<{ produkt_id: string; bestand: number | null }>)
      .filter((r) => r.bestand != null)
      .map((r) => r.produkt_id),
  )
  // Lieferzeit: alle vier Zeit-Bestandteile müssen gesetzt sein (0 ist ein Wert).
  const mitLieferzeit = new Set(
    ((lieferzeitRes.data ?? []) as Array<{
      produkt_id: string
      pufferzeit_tage: number | null
      produktionszeit_tage: number | null
      zwischenzeit_tage: number | null
      shipping_zeit_tage: number | null
      entladungszeit_tage: number | null
    }>)
      .filter(
        (r) =>
          r.pufferzeit_tage != null &&
          r.produktionszeit_tage != null &&
          r.zwischenzeit_tage != null &&
          r.shipping_zeit_tage != null &&
          r.entladungszeit_tage != null,
      )
      .map((r) => r.produkt_id),
  )
  // Bestandsverwaltung: Sicherheitsbestand UND Zielreichweite müssen gesetzt sein.
  const mitBestandsv = new Set(
    ((bestandsvRes.data ?? []) as Array<{ produkt_id: string; sicherheitsbestand: number | null; zielreichweite_wochen: number | null }>)
      .filter((r) => r.sicherheitsbestand != null && r.zielreichweite_wochen != null)
      .map((r) => r.produkt_id),
  )
  // MOQ: Wert muss gesetzt sein.
  const mitMoq = new Set(
    ((moqRes.data ?? []) as Array<{ produkt_id: string; moq: number | null }>)
      .filter((r) => r.moq != null)
      .map((r) => r.produkt_id),
  )
  // Containerkapazität gilt nur als vorhanden, wenn alle drei Paketmaße gesetzt
  // sind (nur dann lässt sich das Stückvolumen berechnen).
  const mitContainer = new Set(
    ((containerRes.data ?? []) as Array<{ produkt_id: string; laenge_cm: number | null; breite_cm: number | null; hoehe_cm: number | null }>)
      .filter((r) => r.laenge_cm != null && r.breite_cm != null && r.hoehe_cm != null)
      .map((r) => r.produkt_id),
  )
  const mitHersteller = new Set(
    ((herstellerRes.data ?? []) as Array<{ produkt_id: string; hersteller_id: string | null }>)
      .filter((r) => r.hersteller_id != null)
      .map((r) => r.produkt_id),
  )

  const fehler: string[] = []

  // Globale Container-Volumina (gelten für alle Produkte): BEIDE müssen gesetzt sein.
  const cg = containerGlobalRes.data as { volumen_20dc: number | null; volumen_40hq: number | null } | null
  const containerGlobalFehlt = !cg || cg.volumen_20dc == null || cg.volumen_40hq == null
  if (containerGlobalFehlt) {
    fehler.push('Container-Maximalvolumen (20DC / 40HQ) — global pro Planversion nicht hinterlegt')
  }

  // Pro Produkt: fehlende Daten sammeln
  for (const p of produkte) {
    const fehlend: string[] = []
    if (!mitAbsatz.has(p.id)) fehlend.push('Absatzplanung')
    if (!mitBestand.has(p.id)) fehlend.push('Aktueller Bestand')
    if (!mitLieferzeit.has(p.id)) fehlend.push('Lieferzeit')
    if (!mitBestandsv.has(p.id)) fehlend.push('Bestandsverwaltung')
    if (!mitMoq.has(p.id)) fehlend.push('MOQ')
    if (!mitContainer.has(p.id)) fehlend.push('Containerkapazität')
    if (!mitHersteller.has(p.id)) fehlend.push('Hersteller')
    if (fehlend.length > 0) {
      fehler.push(`${p.name}: ${fehlend.join(', ')}`)
    }
  }

  return NextResponse.json({ ok: fehler.length === 0, fehler })
}
