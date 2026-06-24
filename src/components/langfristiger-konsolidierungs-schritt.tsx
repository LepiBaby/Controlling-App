'use client'

import { useState, useEffect, useMemo, useCallback } from 'react'
import { Loader2, Merge, Undo2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import type { Bestellung, KonsolidierungsPartner } from '@/hooks/use-bestellungen'
import type { NeuePlanbestellung, ProduktStammdaten } from '@/hooks/use-langfristiger-bestelllauf'
import { KonsolidierungsKarte, type KarteData } from '@/components/konsolidierungs-karte'
import {
  berechneKonsolidierung,
  type KonsolidierungsBestellungErgebnis,
} from '@/lib/konsolidierungs-algorithmus'
import {
  type WizardKonsolidierungsGruppe,
  type WizardKonsolidierungsSnapshot,
} from '@/components/konsolidierungs-schritt'

// PROJ-86: Versionsgebundene Variante des Konsolidierungs-Schritts der
// LANGFRISTIGEN Planung.
//
// Faithful fork of `KonsolidierungsSchritt` (kurzfristig) — identische UI/UX und
// identisches produziertes `WizardKonsolidierungsGruppe`-Shape, damit
// `handleAnwenden` im Dialog unverändert weiterläuft. Der einzige fachliche
// Unterschied:
//   • Bestehende Bestellungen werden vom VERSIONSGEBUNDENEN Endpunkt geladen
//     (`/api/langfristige-planung/${versionId}/bestellplanung/bestellungen`),
//     NICHT vom kurzfristigen `/api/bestellplanung/bestellungen?status=plan`.
//   • Das LP-Bestellungs-Shape ist auf Produktebene (kein `sku_mengen`-Array,
//     kein `konsolidierungsgruppe_id`). Es wird hier auf die für Karte/Algorithmus
//     benötigte Form gemappt: jede Bestellung = ein Produkt mit genau EINEM
//     sku_menge ({ sku_id: produkt_id, sku_name: produkt_name, menge_praktisch }).
//   • Bestehende Konsolidierungsgruppen werden aus den paarweisen `konsolidiert_mit`-
//     Verknüpfungen als zusammenhängende Komponenten abgeleitet; pro Komponente
//     wird eine stabile Repräsentanten-ID (kleinste Mitglieds-ID) als „Gruppen-ID"
//     für das spätere Auflösen (DELETE) gemeldet.

// Karten/Algorithmus arbeiten mit den kurzfristigen Typen. Wir re-exportieren
// das Wizard-Gruppen-Shape, damit der Dialog identisch importieren kann.
export type { WizardKonsolidierungsGruppe } from '@/components/konsolidierungs-schritt'

// ─── Long-term Bestellung shape (from the version-bound endpoint) ─────────────

interface LangfristigKonsolidiertMit {
  bestellung_id: string
  produkt_name: string
  containerart: string | null
}

interface LangfristigeBestellung {
  id: string
  produkt_id: string
  produkt_name: string
  bestelldatum: string | null
  produktionsstart_datum: string | null
  produktionsende_datum: string | null
  shippingdatum: string | null
  ankunftsdatum: string | null
  verfuegbarkeitsdatum: string | null
  menge_theoretisch: number | null
  menge_praktisch: number
  begruendung: string | null
  herkunft: 'algorithmus' | 'manuell' | null
  manuell_geaendert: boolean
  anzahl_20dc: number | null
  anzahl_40hq: number | null
  notizen: string | null
  konsolidiert_mit: LangfristigKonsolidiertMit[]
  created_at: string
  updated_at: string
}

interface HerstellerGruppe {
  hersteller_id: string | null
  hersteller_name: string
  karten: KarteData[]
}

// ─── Mapping: LP-Bestellung → kurzfristiges `Bestellung`-Shape ────────────────
//
// Auf Produktebene: ein synthetisches `Bestellung` mit genau einem produkt- und
// einem sku-Eintrag, damit Karte/Detail-Ansicht unverändert rendern.

function toBestellungShape(b: LangfristigeBestellung): Bestellung {
  const konsolidierungspartner: KonsolidierungsPartner[] = (b.konsolidiert_mit ?? []).map(p => ({
    bestellung_id: p.bestellung_id,
    produkt_namen: p.produkt_name ? [p.produkt_name] : [],
    bestelldatum: null,
    anzahl_40hq: 0,
    anzahl_20dc: 0,
    container_anteil: null,
  }))

  return {
    id: b.id,
    status: 'plan',
    herkunft: b.herkunft ?? null,
    containerart: null,
    anzahl_40hq: b.anzahl_40hq ?? 0,
    anzahl_20dc: b.anzahl_20dc ?? 0,
    bestelldatum: b.bestelldatum,
    produktionsstart_datum: b.produktionsstart_datum,
    produktionsende_datum: b.produktionsende_datum,
    shippingdatum: b.shippingdatum,
    ankunftsdatum: b.ankunftsdatum,
    verfuegbarkeitsdatum: b.verfuegbarkeitsdatum,
    produktionsstart_datum_ist: null,
    produktionsende_datum_ist: null,
    shippingdatum_ist: null,
    ankunftsdatum_ist: null,
    verfuegbarkeitsdatum_ist: null,
    abgeschlossen_am: null,
    notizen: b.notizen,
    created_at: b.created_at,
    updated_at: b.updated_at,
    produkte: [{ id: b.produkt_id, produkt_id: b.produkt_id, produkt_name: b.produkt_name }],
    sku_mengen: [
      {
        id: b.produkt_id,
        sku_id: b.produkt_id,
        sku_name: b.produkt_name,
        menge_theoretisch: b.menge_theoretisch,
        menge_nach_moq: null,
        menge_praktisch: b.menge_praktisch,
        begruendung_anpassung: b.begruendung,
        is_trigger: false,
      },
    ],
    konsolidierungsgruppe_id: null,
    konsolidierungspartner,
    container_anteil: null,
    snapshot_vor_konsolidierung: null,
  }
}

// Connected components over the pairwise `konsolidiert_mit` links → representative
// group id per component (smallest member id, stable & usable for DELETE).
function ableiteGruppenRepraesentanten(bestellungen: LangfristigeBestellung[]): string[] {
  const parent = new Map<string, string>()
  const find = (x: string): string => {
    let r = x
    while (parent.get(r) !== r) r = parent.get(r)!
    // path compression
    let c = x
    while (parent.get(c) !== r) {
      const next = parent.get(c)!
      parent.set(c, r)
      c = next
    }
    return r
  }
  const union = (a: string, b: string) => {
    const ra = find(a)
    const rb = find(b)
    if (ra === rb) return
    // keep the lexicographically smaller id as root for a stable representative
    if (ra < rb) parent.set(rb, ra)
    else parent.set(ra, rb)
  }

  for (const b of bestellungen) parent.set(b.id, b.id)
  for (const b of bestellungen) {
    for (const p of b.konsolidiert_mit ?? []) {
      if (!parent.has(p.bestellung_id)) parent.set(p.bestellung_id, p.bestellung_id)
      union(b.id, p.bestellung_id)
    }
  }

  // Only components with ≥ 2 members count as a consolidation group.
  const membersByRoot = new Map<string, string[]>()
  for (const b of bestellungen) {
    const r = find(b.id)
    if (!membersByRoot.has(r)) membersByRoot.set(r, [])
    membersByRoot.get(r)!.push(b.id)
  }
  const repraesentanten: string[] = []
  for (const [root, members] of membersByRoot) {
    if (members.length >= 2) repraesentanten.push(root)
  }
  return repraesentanten
}

// ─── Helpers (mirrors KonsolidierungsSchritt, produkt-level) ──────────────────

function buildKarteData(
  bestellung: Bestellung,
  stammdatenById: Map<string, ProduktStammdaten>,
  ergebnis: KonsolidierungsBestellungErgebnis | null,
): KarteData {
  const produktId = bestellung.produkte[0]?.produkt_id ?? ''
  const stamm = stammdatenById.get(produktId)
  const stueckvolumen_m3 = stamm ? stamm.stueckvolumen_m3 : null

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
    produktionsstartDatum: ergebnis?.neues_produktionsstart_datum ?? bestellung.produktionsstart_datum ?? null,
    produktionsendeDatum: ergebnis?.neues_produktionsende_datum ?? bestellung.produktionsende_datum,
    shippingdatum: ergebnis?.neues_shippingdatum ?? bestellung.shippingdatum,
    ankunftsdatum: ergebnis?.neues_ankunftsdatum ?? bestellung.ankunftsdatum ?? null,
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
    produktionsstartDatum: ergebnis?.neues_produktionsstart_datum ?? b.produktionsstart_datum ?? null,
    produktionsendeDatum: ergebnis?.neues_produktionsende_datum ?? b.produktionsende_datum,
    shippingdatum: ergebnis?.neues_shippingdatum ?? b.shippingdatum,
    ankunftsdatum: ergebnis?.neues_ankunftsdatum ?? b.ankunftsdatum ?? null,
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

interface LangfristigerKonsolidierungsSchrittProps {
  versionId: string
  neueBestellungen: NeuePlanbestellung[]
  ausgewaehlteNeueIds: Set<string>
  stammdaten: ProduktStammdaten[]
  containerGlobal: { volumen_20dc: number | null; volumen_40hq: number | null }
  onGruppenChange: (gruppen: WizardKonsolidierungsGruppe[]) => void
  onBestehendeGruppenIds?: (ids: string[]) => void
}

export function LangfristigerKonsolidierungsSchritt({
  versionId,
  neueBestellungen,
  ausgewaehlteNeueIds,
  stammdaten,
  containerGlobal,
  onGruppenChange,
  onBestehendeGruppenIds,
}: LangfristigerKonsolidierungsSchrittProps) {
  const [existierendeBestellungen, setExistierendeBestellungen] = useState<Bestellung[]>([])
  const [ladeFehler, setLadeFehler] = useState<string | null>(null)
  const [ladeBestellungen, setLadeBestellungen] = useState(true)

  const [ausgewaehlt, setAusgewaehlt] = useState<Set<string>>(new Set())
  const [gruppen, setGruppen] = useState<WizardKonsolidierungsGruppe[]>([])

  // Fetch existing plan orders from the VERSION-BOUND endpoint
  useEffect(() => {
    setLadeBestellungen(true)
    fetch(`/api/langfristige-planung/${versionId}/bestellplanung/bestellungen`)
      .then(r => {
        if (!r.ok) throw new Error(`API-Fehler (${r.status})`)
        return r.json()
      })
      .then((data: LangfristigeBestellung[]) => {
        // Nur MANUELL angelegte (laufende) Bestellungen kommen als bestehende
        // Konsolidierungskandidaten infrage — Algorithmus-Bestellungen werden beim
        // Anwenden neu kalkuliert/ersetzt und dürfen hier nicht erscheinen.
        const roh = (data ?? []).filter((b) => b.herkunft === 'manuell')
        setExistierendeBestellungen(roh.map(toBestellungShape))
        onBestehendeGruppenIds?.(ableiteGruppenRepraesentanten(roh))
        setLadeBestellungen(false)
      })
      .catch(() => {
        setLadeFehler('Planbestellungen konnten nicht geladen werden.')
        setLadeBestellungen(false)
      })
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [versionId])

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

    // Capture pre-consolidation state for each member so the snapshot is correct
    const snapshots: Record<string, WizardKonsolidierungsSnapshot> = {}
    for (const k of selectedKarten) {
      if (k.isTemp) {
        const nb = neueBestellungen.find(b => b.temp_id === k.id)
        snapshots[k.id] = {
          bestelldatum: nb?.bestelldatum ?? null,
          produktionsstart_datum: nb?.produktionsstart_datum ?? null,
          produktionsende_datum: nb?.produktionsende_datum ?? null,
          shippingdatum: nb?.shippingdatum ?? null,
          ankunftsdatum: nb?.ankunftsdatum ?? null,
          verfuegbarkeitsdatum: nb?.verfuegbarkeitsdatum ?? null,
          anzahl_40hq: (nb?.container ?? []).filter(c => c === '40HQ').length,
          anzahl_20dc: (nb?.container ?? []).filter(c => c === '20DC').length,
          sku_mengen: nb?.sku_mengen.map(s => ({
            sku_id: s.sku_id,
            menge_praktisch: s.menge_praktisch,
            begruendung_anpassung: s.begruendung_anpassung,
          })) ?? [],
        }
      } else {
        const b = k.bestellungData!
        snapshots[k.id] = {
          bestelldatum: b.bestelldatum,
          produktionsstart_datum: b.produktionsstart_datum ?? null,
          produktionsende_datum: b.produktionsende_datum,
          shippingdatum: b.shippingdatum,
          ankunftsdatum: b.ankunftsdatum ?? null,
          verfuegbarkeitsdatum: b.verfuegbarkeitsdatum,
          anzahl_40hq: b.anzahl_40hq,
          anzahl_20dc: b.anzahl_20dc,
          sku_mengen: b.sku_mengen.map(s => ({
            sku_id: s.sku_id,
            menge_praktisch: s.menge_praktisch,
            begruendung_anpassung: s.begruendung_anpassung,
          })),
        }
      }
    }

    const neueGruppe: WizardKonsolidierungsGruppe = {
      temp_gruppe_id: crypto.randomUUID(),
      mitglieder_ids: ausgewaehlteListe,
      ergebnisse: ergebnis.bestellungen,
      hinweis: ergebnis.hinweis,
      snapshots,
    }

    // Remove any existing gruppen that contain selected members
    const filtered = gruppen.filter(g => !g.mitglieder_ids.some(id => ausgewaehlt.has(id)))
    const updated = [...filtered, neueGruppe]
    setGruppen(updated)
    onGruppenChange(updated)
    setAusgewaehlt(new Set())
  }, [koennenKonsolidiert, alleKarten, ausgewaehlt, ausgewaehlteListe, neueBestellungen, stammdatenById, containerGlobal, gruppen, onGruppenChange])

  const handleMengeChange = useCallback((karteId: string, skuId: string, neueMenge: number) => {
    const updated = gruppen.map(g => {
      if (!g.mitglieder_ids.includes(karteId)) return g
      return {
        ...g,
        ergebnisse: g.ergebnisse.map(e => {
          if (e.bestellung_id !== karteId) return e
          return {
            ...e,
            neue_sku_mengen: e.neue_sku_mengen.map(s =>
              s.sku_id === skuId ? { ...s, neue_menge_praktisch: neueMenge } : s
            ),
          }
        }),
      }
    })
    setGruppen(updated)
    onGruppenChange(updated)
  }, [gruppen, onGruppenChange])

  const handleAufheben = useCallback(() => {
    const gruppeId = gruppenIdById.get(ausgewaehlteListe[0])
    const updated = gruppen.filter(g => g.temp_gruppe_id !== gruppeId)
    setGruppen(updated)
    onGruppenChange(updated)
    setAusgewaehlt(new Set())
  }, [gruppen, gruppenIdById, ausgewaehlteListe, onGruppenChange])

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
      <div className="space-y-5 pr-1">
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
                      onMengeChange={karte.konsolidierungsErgebnis ? (skuId, menge) => handleMengeChange(karte.id, skuId, menge) : undefined}
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
