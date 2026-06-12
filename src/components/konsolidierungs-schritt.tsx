'use client'

import { useState, useEffect, useMemo, useCallback } from 'react'
import { Loader2, Merge, Undo2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Separator } from '@/components/ui/separator'
import type { Bestellung } from '@/hooks/use-bestellungen'
import type { NeuePlanbestellung, ProduktStammdaten } from '@/hooks/use-planbestelllauf'
import { KonsolidierungsKarte, type KarteData } from '@/components/konsolidierungs-karte'
import {
  berechneKonsolidierung,
  type KonsolidierungsBestellungErgebnis,
} from '@/lib/konsolidierungs-algorithmus'

// ─── Types ────────────────────────────────────────────────────────────────────

/** Local state tracking a consolidation group applied in this wizard session */
export interface WizardKonsolidierungsGruppe {
  temp_gruppe_id: string
  mitglieder_ids: string[]
  ergebnisse: KonsolidierungsBestellungErgebnis[]
  hinweis?: string
}

interface HerstellerGruppe {
  hersteller_id: string | null
  hersteller_name: string
  karten: KarteData[]
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function buildKarteData(
  bestellung: Bestellung,
  stammdatenById: Map<string, ProduktStammdaten>,
  ergebnis: KonsolidierungsBestellungErgebnis | null,
): KarteData {
  const produktId = bestellung.produkte[0]?.produkt_id ?? ''
  const stamm = stammdatenById.get(produktId)

  const stueckvolumen_m3 = stamm
    ? stamm.stueckvolumen_m3
    : null

  let volumen_m3 = 0
  let volumen_moq_m3 = 0
  if (stueckvolumen_m3 !== null) {
    for (const s of bestellung.sku_mengen) {
      volumen_m3 += s.menge_praktisch * stueckvolumen_m3
      volumen_moq_m3 += (s.menge_nach_moq ?? s.menge_praktisch) * stueckvolumen_m3
    }
  }

  const gesamtmenge = bestellung.sku_mengen.reduce((s, m) => s + m.menge_praktisch, 0)

  return {
    id: bestellung.id,
    isTemp: false,
    produktNamen: bestellung.produkte.map(p => p.produkt_name),
    herkunft: bestellung.herkunft ?? null,
    herstellerId: stamm?.hersteller_id ?? null,
    herstellerName: stamm?.hersteller_name ?? null,
    bestelldatum: bestellung.bestelldatum,
    produktionsendeDatum: ergebnis?.neues_produktionsende_datum ?? bestellung.produktionsende_datum,
    shippingdatum: ergebnis?.neues_shippingdatum ?? bestellung.shippingdatum,
    verfuegbarkeitsdatum: ergebnis?.neues_verfuegbarkeitsdatum ?? bestellung.verfuegbarkeitsdatum,
    gesamtmenge,
    anzahl_40hq: bestellung.anzahl_40hq,
    anzahl_20dc: bestellung.anzahl_20dc,
    container_anteil: bestellung.container_anteil,
    konsolidierungsgruppe_id: bestellung.konsolidierungsgruppe_id,
    konsolidierungspartner: bestellung.konsolidierungspartner,
    stueckvolumen_m3,
    volumen_m3,
    volumen_moq_m3,
    konsolidierungsErgebnis: ergebnis,
    bestellungData: bestellung,
    neueBestellungData: null,
  }
}

function buildNeueKarteData(
  b: NeuePlanbestellung,
  stammdatenById: Map<string, ProduktStammdaten>,
  ergebnis: KonsolidierungsBestellungErgebnis | null,
): KarteData {
  const produktId = b.produkt_ids[0] ?? ''
  const stamm = stammdatenById.get(produktId)
  const stueckvolumen_m3 = stamm?.stueckvolumen_m3 ?? null

  let volumen_m3 = 0
  let volumen_moq_m3 = 0
  if (stueckvolumen_m3 !== null) {
    for (const s of b.sku_mengen) {
      volumen_m3 += s.menge_praktisch * stueckvolumen_m3
      volumen_moq_m3 += s.menge_nach_moq * stueckvolumen_m3
    }
  }

  const gesamtmenge = b.sku_mengen.reduce((s, m) => s + m.menge_praktisch, 0)

  return {
    id: b.temp_id,
    isTemp: true,
    produktNamen: b.produkt_namen,
    herkunft: null,
    herstellerId: stamm?.hersteller_id ?? null,
    herstellerName: stamm?.hersteller_name ?? null,
    bestelldatum: ergebnis?.neues_bestelldatum ?? b.bestelldatum,
    produktionsendeDatum: ergebnis?.neues_produktionsende_datum ?? b.produktionsende_datum,
    shippingdatum: ergebnis?.neues_shippingdatum ?? b.shippingdatum,
    verfuegbarkeitsdatum: ergebnis?.neues_verfuegbarkeitsdatum ?? b.verfuegbarkeitsdatum,
    gesamtmenge,
    anzahl_40hq: (b.container ?? []).filter(c => c === '40HQ').length,
    anzahl_20dc: (b.container ?? []).filter(c => c === '20DC').length,
    container_anteil: null,
    konsolidierungsgruppe_id: null,
    konsolidierungspartner: [],
    stueckvolumen_m3,
    volumen_m3,
    volumen_moq_m3,
    konsolidierungsErgebnis: ergebnis,
    bestellungData: null,
    neueBestellungData: b,
  }
}

const GRUPPEN_FARBEN = [
  'border-l-blue-400',
  'border-l-violet-400',
  'border-l-emerald-400',
  'border-l-rose-400',
  'border-l-amber-400',
  'border-l-cyan-400',
]

// ─── Main Component ───────────────────────────────────────────────────────────

interface KonsolidierungsSchrittProps {
  neueBestellungen: NeuePlanbestellung[]
  ausgewaehlteNeueIds: Set<string>
  stammdaten: ProduktStammdaten[]
  containerGlobal: { volumen_20dc: number | null; volumen_40hq: number | null }
  onGruppenChange: (gruppen: WizardKonsolidierungsGruppe[]) => void
}

export function KonsolidierungsSchritt({
  neueBestellungen,
  ausgewaehlteNeueIds,
  stammdaten,
  containerGlobal,
  onGruppenChange,
}: KonsolidierungsSchrittProps) {
  const [existierendeBestellungen, setExistierendeBestellungen] = useState<Bestellung[]>([])
  const [ladeFehler, setLadeFehler] = useState<string | null>(null)
  const [ladeBestellungen, setLadeBestellungen] = useState(true)

  const [ausgewaehlt, setAusgewaehlt] = useState<Set<string>>(new Set())
  const [gruppen, setGruppen] = useState<WizardKonsolidierungsGruppe[]>([])

  // Fetch existing plan orders
  useEffect(() => {
    setLadeBestellungen(true)
    fetch('/api/bestellplanung/bestellungen?status=plan')
      .then(r => r.json())
      .then((data: Bestellung[]) => {
        setExistierendeBestellungen(data ?? [])
        setLadeBestellungen(false)
      })
      .catch(() => {
        setLadeFehler('Planbestellungen konnten nicht geladen werden.')
        setLadeBestellungen(false)
      })
  }, [])

  const stammdatenById = useMemo(() => {
    const map = new Map<string, ProduktStammdaten>()
    for (const s of stammdaten) map.set(s.produkt_id, s)
    return map
  }, [stammdaten])

  // Merge existing + neue into unified karte list
  const alleKarten: KarteData[] = useMemo(() => {
    const selectedNeue = neueBestellungen.filter(b => ausgewaehlteNeueIds.has(b.temp_id))

    const gruppenErgebnisById = new Map<string, KonsolidierungsBestellungErgebnis>()
    for (const g of gruppen) {
      for (const e of g.ergebnisse) gruppenErgebnisById.set(e.bestellung_id, e)
    }

    const existKarten = existierendeBestellungen.map(b =>
      buildKarteData(b, stammdatenById, gruppenErgebnisById.get(b.id) ?? null)
    )
    const neueKarten = selectedNeue.map(b =>
      buildNeueKarteData(b, stammdatenById, gruppenErgebnisById.get(b.temp_id) ?? null)
    )
    return [...existKarten, ...neueKarten]
  }, [existierendeBestellungen, neueBestellungen, ausgewaehlteNeueIds, stammdatenById, gruppen])

  // Group by hersteller, sorted by prod.ende
  const herstellerGruppen: HerstellerGruppe[] = useMemo(() => {
    const map = new Map<string, HerstellerGruppe>()

    for (const k of alleKarten) {
      const key = k.herstellerId ?? '__kein__'
      if (!map.has(key)) {
        map.set(key, {
          hersteller_id: k.herstellerId,
          hersteller_name: k.herstellerName ?? 'Kein Hersteller',
          karten: [],
        })
      }
      map.get(key)!.karten.push(k)
    }

    // Sort karten within each group by prod.ende asc
    for (const g of map.values()) {
      g.karten.sort((a, b) => {
        if (!a.produktionsendeDatum && !b.produktionsendeDatum) return 0
        if (!a.produktionsendeDatum) return 1
        if (!b.produktionsendeDatum) return -1
        return a.produktionsendeDatum.localeCompare(b.produktionsendeDatum)
      })
    }

    // Sort groups: known manufacturers first (alphabetically), then "Kein Hersteller" last
    return Array.from(map.values()).sort((a, b) => {
      if (a.hersteller_id === null && b.hersteller_id !== null) return 1
      if (a.hersteller_id !== null && b.hersteller_id === null) return -1
      return a.hersteller_name.localeCompare(b.hersteller_name)
    })
  }, [alleKarten])

  // Determine which wizard-gruppe a karte belongs to
  const gruppenFarbeById = useMemo(() => {
    const map = new Map<string, string>()
    gruppen.forEach((g, i) => {
      const farbe = GRUPPEN_FARBEN[i % GRUPPEN_FARBEN.length]
      g.mitglieder_ids.forEach(id => map.set(id, farbe))
    })
    return map
  }, [gruppen])

  const gruppenIdById = useMemo(() => {
    const map = new Map<string, string>()
    for (const g of gruppen) {
      for (const id of g.mitglieder_ids) map.set(id, g.temp_gruppe_id)
    }
    return map
  }, [gruppen])

  const toggle = useCallback((id: string) => {
    setAusgewaehlt(prev => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }, [])

  // Analyse current selection
  const ausgewaehlteListe = Array.from(ausgewaehlt)

  // Determine selected herstellerIds
  const selectedHerstellerIds = new Set(
    ausgewaehlteListe.map(id => alleKarten.find(k => k.id === id)?.herstellerId ?? null)
  )
  const eineHersteller = selectedHerstellerIds.size === 1
  const gemischteHersteller = selectedHerstellerIds.size > 1
  const koennenKonsolidiert = ausgewaehlteListe.length >= 2 && eineHersteller

  // Check if all selected are members of the same existing wizard gruppe → show "aufheben"
  const alleAusGleicherGruppe = ausgewaehlteListe.length >= 2 && (() => {
    const gruppeIds = new Set(ausgewaehlteListe.map(id => gruppenIdById.get(id)).filter(Boolean))
    if (gruppeIds.size !== 1) return false
    const [gruppeId] = Array.from(gruppeIds)
    const gruppe = gruppen.find(g => g.temp_gruppe_id === gruppeId)
    if (!gruppe) return false
    return gruppe.mitglieder_ids.length === ausgewaehlteListe.length &&
      ausgewaehlteListe.every(id => gruppe.mitglieder_ids.includes(id))
  })()

  const handleKonsolidieren = useCallback(() => {
    if (!koennenKonsolidiert) return

    const selectedKarten = alleKarten.filter(k => ausgewaehlt.has(k.id))
    const input = selectedKarten.map(k => {
      if (k.isTemp) {
        const neueBestlg = neueBestellungen.find(b => b.temp_id === k.id)
        return {
          bestellung_id: k.id,
          produktionsende_datum: k.produktionsendeDatum,
          sku_mengen: neueBestlg?.sku_mengen.map(s => ({
            sku_id: s.sku_id,
            menge_nach_moq: s.menge_nach_moq,
            menge_praktisch: s.menge_praktisch,
            begruendung_anpassung: s.begruendung_anpassung,
          })) ?? [],
          produkt_ids: neueBestlg?.produkt_ids ?? [],
        }
      }
      return {
        bestellung_id: k.id,
        produktionsende_datum: k.produktionsendeDatum,
        sku_mengen: k.bestellungData?.sku_mengen.map(s => ({
          sku_id: s.sku_id,
          menge_nach_moq: s.menge_nach_moq ?? s.menge_praktisch,
          menge_praktisch: s.menge_praktisch,
          begruendung_anpassung: s.begruendung_anpassung,
        })) ?? [],
        produkt_ids: k.bestellungData?.produkte.map(p => p.produkt_id) ?? [k.id],
      }
    })

    const ergebnis = berechneKonsolidierung(
      input,
      stammdatenById,
      containerGlobal.volumen_20dc ?? 0,
      containerGlobal.volumen_40hq ?? 0,
    )

    const neueGruppe: WizardKonsolidierungsGruppe = {
      temp_gruppe_id: crypto.randomUUID(),
      mitglieder_ids: ausgewaehlteListe,
      ergebnisse: ergebnis.bestellungen,
      hinweis: ergebnis.hinweis,
    }

    setGruppen(prev => {
      // Remove any existing gruppen that contain selected members
      const filtered = prev.filter(g => !g.mitglieder_ids.some(id => ausgewaehlt.has(id)))
      const updated = [...filtered, neueGruppe]
      onGruppenChange(updated)
      return updated
    })
    setAusgewaehlt(new Set())
  }, [koennenKonsolidiert, alleKarten, ausgewaehlt, ausgewaehlteListe, stammdatenById, containerGlobal, onGruppenChange])

  const handleAufheben = useCallback(() => {
    setGruppen(prev => {
      const gruppeId = gruppenIdById.get(ausgewaehlteListe[0])
      const updated = prev.filter(g => g.temp_gruppe_id !== gruppeId)
      onGruppenChange(updated)
      return updated
    })
    setAusgewaehlt(new Set())
  }, [gruppenIdById, ausgewaehlteListe, onGruppenChange])

  if (ladeBestellungen) {
    return (
      <div className="flex items-center justify-center py-12 gap-3">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        <p className="text-sm text-muted-foreground">Planbestellungen werden geladen…</p>
      </div>
    )
  }

  if (ladeFehler) {
    return (
      <div className="rounded-md border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive">
        {ladeFehler}
      </div>
    )
  }

  if (alleKarten.length === 0) {
    return (
      <div className="text-center py-10 text-muted-foreground">
        <p className="text-sm">Keine Planbestellungen vorhanden.</p>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {/* Action bar */}
      <div className="flex items-center justify-between min-h-[32px]">
        <p className="text-xs text-muted-foreground">
          {ausgewaehlteListe.length > 0
            ? `${ausgewaehlteListe.length} ausgewählt`
            : 'Bestellungen per Checkbox wählen, dann konsolidieren'}
        </p>
        <div className="flex items-center gap-2">
          {gemischteHersteller && (
            <p className="text-xs text-amber-600">Nur Bestellungen desselben Herstellers können konsolidiert werden</p>
          )}
          {alleAusGleicherGruppe && (
            <Button size="sm" variant="outline" className="gap-1.5 text-xs h-7" onClick={handleAufheben}>
              <Undo2 className="h-3.5 w-3.5" />
              Konsolidierung aufheben
            </Button>
          )}
          {koennenKonsolidiert && !alleAusGleicherGruppe && (
            <Button size="sm" className="gap-1.5 text-xs h-7" onClick={handleKonsolidieren}>
              <Merge className="h-3.5 w-3.5" />
              Konsolidieren ({ausgewaehlteListe.length})
            </Button>
          )}
        </div>
      </div>

      {/* Hersteller groups */}
      <div className="space-y-5 max-h-[480px] overflow-y-auto pr-1">
        {herstellerGruppen.map((hg) => {
          // Find wizard-gruppen within this hersteller group
          const wizardGruppenInHersteller = gruppen.filter(wg =>
            wg.mitglieder_ids.some(id => hg.karten.some(k => k.id === id))
          )

          return (
            <div key={hg.hersteller_id ?? '__kein__'}>
              <div className="flex items-center gap-2 mb-2">
                <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  {hg.hersteller_name}
                </h3>
                <span className="text-xs text-muted-foreground">({hg.karten.length})</span>
              </div>

              <div className="space-y-2">
                {hg.karten.map((karte) => {
                  const wizardGruppeId = gruppenIdById.get(karte.id)
                  const isInGruppe = !!wizardGruppeId
                  const gruppefarbe = gruppenFarbeById.get(karte.id)

                  return (
                    <KonsolidierungsKarte
                      key={karte.id}
                      karte={karte}
                      ausgewaehlt={ausgewaehlt.has(karte.id)}
                      onToggle={() => toggle(karte.id)}
                      volumen_20dc_m3={containerGlobal.volumen_20dc}
                      volumen_40hq_m3={containerGlobal.volumen_40hq}
                      isInGruppe={isInGruppe}
                      gruppefarbe={gruppefarbe}
                    />
                  )
                })}
              </div>

              {/* Show consolidation group hints */}
              {wizardGruppenInHersteller.map(wg =>
                wg.hinweis ? (
                  <p key={wg.temp_gruppe_id} className="mt-1.5 text-xs text-muted-foreground italic pl-1">
                    {wg.hinweis}
                  </p>
                ) : null
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
