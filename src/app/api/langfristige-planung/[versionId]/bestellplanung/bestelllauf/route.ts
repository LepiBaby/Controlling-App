import { NextResponse } from 'next/server'
import { requireAuth } from '@/lib/supabase-server'
import { ensureLangfristigeVersion } from '@/lib/langfristige-version'
import { runLangfristigerBestelllauf } from '@/lib/langfristige-bestelllauf-algorithmus'
import { ladeVersionsDaten, ladeStammdaten } from '../_utils'

// Auth-geschützte, pro-Planversion dynamische Route — nie statisch generieren.
// Überspringt den in Next 16 instabilen Static-Path-Pass (Worker-Crash).
export const dynamic = 'force-dynamic'

// PROJ-86: Bestelllauf ausführen (serverseitig). Liest alle versionsgebundenen
// Quellen, ruft die reine Berechnungsfunktion und gibt das Ergebnis zurück —
// schreibt NICHT in die DB.

interface RouteContext {
  params: Promise<{ versionId: string }>
}

export async function POST(_request: Request, { params }: RouteContext) {
  const { user, supabase, error } = await requireAuth()
  if (error) return error

  const { versionId } = await params
  const versionError = await ensureLangfristigeVersion(supabase, user!.id, versionId)
  if (versionError) return versionError

  try {
    const { startMonat, horizontMonate, produkte, bestehende } = await ladeVersionsDaten(
      supabase,
      user!.id,
      versionId,
    )

    const heute = new Date()
    heute.setUTCHours(0, 0, 0, 0)

    const ergebnis = runLangfristigerBestelllauf({
      startMonat,
      horizontMonate,
      heute,
      produkte,
      bestehendeBestellungen: bestehende,
    })

    // Stammdaten + Container-Global (für Wizard-Schritt 3 / Konsolidierung).
    const { produkt_stammdaten, container_global } = await ladeStammdaten(
      supabase,
      user!.id,
      versionId,
      produkte,
    )

    // Konsolidierungspartner an Änderungen anhängen (aus der Paar-Tabelle).
    const aenderungsIds = ergebnis.aenderungen_bestehende.map((a) => a.bestellung_id)
    let aenderungenMitPartner: Array<
      (typeof ergebnis.aenderungen_bestehende)[number] & {
        konsolidierungspartner?: Array<{
          bestellung_id: string
          produkt_namen: string[]
          bestelldatum: string | null
          anzahl_40hq: number
          anzahl_20dc: number
          container_anteil: Record<string, number> | null
        }>
      }
    > = ergebnis.aenderungen_bestehende

    if (aenderungsIds.length > 0) {
      const { data: konsRows } = await supabase
        .from('langfristige_bestellungen_konsolidierungen')
        .select('bestellung_id_1, bestellung_id_2')
        .eq('user_id', user!.id)
        .eq('plan_version_id', versionId)
        .or(
          `bestellung_id_1.in.(${aenderungsIds.join(',')}),bestellung_id_2.in.(${aenderungsIds.join(',')})`,
        )

      const paare = (konsRows ?? []) as Array<{ bestellung_id_1: string; bestellung_id_2: string }>

      if (paare.length > 0) {
        // Partner-Bestellungen (Basisdaten) laden — auch solche, die selbst keine
        // Änderung haben, müssen als Partner darstellbar sein.
        const partnerIds = [
          ...new Set(paare.flatMap((p) => [p.bestellung_id_1, p.bestellung_id_2])),
        ]
        const { data: partnerBest } = await supabase
          .from('langfristige_bestellungen')
          .select('id, produkt_id, bestelldatum, anzahl_20dc, anzahl_40hq')
          .eq('user_id', user!.id)
          .eq('plan_version_id', versionId)
          .in('id', partnerIds)

        const baseById = new Map(
          ((partnerBest ?? []) as Array<{
            id: string
            produkt_id: string
            bestelldatum: string | null
            anzahl_20dc: number | null
            anzahl_40hq: number | null
          }>).map((b) => [b.id, b]),
        )
        const nameById = new Map(produkte.map((p) => [p.produkt_id, p.produkt_name]))

        // Nachbar-IDs je Bestellung sammeln.
        const partnerByBestellung = new Map<string, string[]>()
        for (const pr of paare) {
          if (!partnerByBestellung.has(pr.bestellung_id_1)) partnerByBestellung.set(pr.bestellung_id_1, [])
          if (!partnerByBestellung.has(pr.bestellung_id_2)) partnerByBestellung.set(pr.bestellung_id_2, [])
          partnerByBestellung.get(pr.bestellung_id_1)!.push(pr.bestellung_id_2)
          partnerByBestellung.get(pr.bestellung_id_2)!.push(pr.bestellung_id_1)
        }

        aenderungenMitPartner = ergebnis.aenderungen_bestehende.map((a) => {
          const partnerIdsForA = partnerByBestellung.get(a.bestellung_id)
          if (!partnerIdsForA || partnerIdsForA.length === 0) return a
          const partner = partnerIdsForA.map((pid) => {
            const base = baseById.get(pid)
            const pname = base ? nameById.get(base.produkt_id) ?? '' : ''
            return {
              bestellung_id: pid,
              produkt_namen: pname ? [pname] : [],
              bestelldatum: base?.bestelldatum ?? null,
              anzahl_40hq: base?.anzahl_40hq ?? 0,
              anzahl_20dc: base?.anzahl_20dc ?? 0,
              container_anteil: null as Record<string, number> | null,
            }
          })
          return { ...a, konsolidierungspartner: partner }
        })
      }
    }

    // PROJ-86: Antwort spiegelt das kurzfristige Shape — `neue_planbestellungen`
    // (umbenannt von `neue_bestellungen`) + produkt_stammdaten + container_global.
    return NextResponse.json({
      aenderungen_bestehende: aenderungenMitPartner,
      neue_planbestellungen: ergebnis.neue_bestellungen,
      produkt_stammdaten,
      container_global,
    })
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Bestelllauf fehlgeschlagen' },
      { status: 500 },
    )
  }
}
