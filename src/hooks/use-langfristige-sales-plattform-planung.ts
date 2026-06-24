'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import type { KpiCategory } from '@/hooks/use-kpi-categories'
import { DEFAULT_PLANUNGSHORIZONT_MONATE } from '@/hooks/use-langfristige-grundeinstellungen'
import { buildPlanungsmonate, type PlanungsMonat } from '@/hooks/use-langfristige-absatzplanung'
import {
  KATEGORIE_LABELS,
  KATEGORIE_VORZEICHEN,
  type SalesKategorie,
} from '@/hooks/use-sales-plattform-planung'

// PROJ-87: Versionsgebundene Sales-Plattform-Planung der Langfristigen Planung.
// Spiegelt die kurzfristige Sales-Plattform-Planung (PROJ-66), aber:
//   • Monatsspalten statt Kalenderwochen (Startmonat − 3 … + allgemeiner Horizont).
//   • KEINE Ist-Transaktionen → es gibt nur EINE Quelle automatischer Werte
//     (die /berechnet-Route). Grauer Punkt = berechnet, blauer Punkt = manuell.
//   • Alle Einstellungen stammen aus DIESER Planversion.
// Gespeichert wird ausschließlich die manuelle Überschreibung je Zelle.

// Konstanten/Typen aus der kurzfristigen Variante wiederverwenden (identisch).
export { KATEGORIE_LABELS, KATEGORIE_VORZEICHEN }
export type { SalesKategorie, PlanungsMonat }

// ─── Typen ──────────────────────────────────────────────────────────────────

interface ManuellerWertRecord {
  kategorie: SalesKategorie
  produkt_id: string
  sales_plattform_id: string
  jahr: number
  monat: number
  wert_manuell: number
}

interface BerechnetWertRecord {
  kategorie: SalesKategorie
  produkt_id: string
  sales_plattform_id: string
  jahr: number
  monat: number
  wert: number
}

interface LangfristigeKategorieRecord {
  id: string
  name: string
  sort_order: number
}

interface AuszahlungsEinstellungRecord {
  marketingkanal_ids?: string[]
}

// ─── Schlüssel-Helfer ─────────────────────────────────────────────────────────

// Vollständiger Zell-/Selektions-/Notiz-Schlüssel (eindeutig je Zellkoordinate).
// Für Marketing-Zeilen steht in plattformId die Marketingkanal-ID (analog PROJ-66).
export function lsppKey(
  kategorie: SalesKategorie,
  produktId: string,
  plattformId: string,
  year: number,
  month: number,
): string {
  return `lspp:${kategorie}:${produktId}:${plattformId}:${year}:${month}`
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function useLangfristigeSalesPlattformPlanung(versionId: string) {
  const [monate, setMonate] = useState<PlanungsMonat[]>([])
  const [plattformen, setPlattformen] = useState<KpiCategory[]>([])
  const [produkte, setProdukte] = useState<KpiCategory[]>([])
  // Marketingkanal-ID → Name (für Untergruppen-Beschriftung).
  const [marketingKanalNamen, setMarketingKanalNamen] = useState<Map<string, string>>(new Map())
  // key: lsppKey(...) → automatisch berechneter Wert
  const [berechneteWerte, setBerechneteWerte] = useState<Map<string, number>>(new Map())
  // key: lsppKey(...) → manuelle Überschreibung
  const [manuelleWerte, setManuelleWerte] = useState<Map<string, number>>(new Map())
  // Marketingkanal-ID → Namen der Plattformen, die den Kanal in den Auszahlungseinstellungen führen
  const [marketingKatPlattformMap, setMarketingKatPlattformMap] = useState<Map<string, string[]>>(new Map())
  const [marketingZugeordnet, setMarketingZugeordnet] = useState(false)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const manuellPath = `/api/langfristige-planung/${versionId}/sales-plattform-planung`

  useEffect(() => {
    if (!versionId) return
    let aktiv = true
    setLoading(true)
    setError(null)

    async function load() {
      try {
        const [grundRes, plattRes, prodRes, kanalRes, manualRes, calcRes] = await Promise.all([
          fetch(`/api/langfristige-planung/${versionId}/grundeinstellungen`),
          fetch(`/api/langfristige-planung/${versionId}/kpi-kategorien?art=lp_sales_plattform`),
          fetch(`/api/langfristige-planung/${versionId}/kpi-kategorien?art=lp_produkt`),
          fetch(`/api/langfristige-planung/${versionId}/kpi-kategorien?art=lp_marketingkanal`),
          fetch(manuellPath),
          fetch(`${manuellPath}/berechnet`),
        ])

        const grund = grundRes.ok ? await grundRes.json() : {}
        const plattData: LangfristigeKategorieRecord[] = plattRes.ok ? await plattRes.json() : []
        const prodData: LangfristigeKategorieRecord[] = prodRes.ok ? await prodRes.json() : []
        const kanalData: LangfristigeKategorieRecord[] = kanalRes.ok ? await kanalRes.json() : []
        const manualData: ManuellerWertRecord[] = manualRes.ok ? await manualRes.json() : []
        const calcData: BerechnetWertRecord[] = calcRes.ok ? await calcRes.json() : []
        if (!aktiv) return

        // Monatsfenster aus dem ALLGEMEINEN Planungshorizont (Startmonat − 3 … + Horizont).
        const horizont = grund.planungshorizont_monate ?? DEFAULT_PLANUNGSHORIZONT_MONATE
        setMonate(buildPlanungsmonate(grund.startmonat_monat, grund.startmonat_jahr, horizont))

        const sortByOrder = (a: LangfristigeKategorieRecord, b: LangfristigeKategorieRecord) =>
          a.sort_order - b.sort_order
        const plattList = plattData.slice().sort(sortByOrder)
        setPlattformen(plattList.map(toKpiLike))
        setProdukte(prodData.slice().sort(sortByOrder).map(toKpiLike))

        const kanalNamen = new Map<string, string>()
        for (const k of kanalData) kanalNamen.set(k.id, k.name)
        setMarketingKanalNamen(kanalNamen)

        const manualMap = new Map<string, number>()
        for (const m of manualData) {
          manualMap.set(lsppKey(m.kategorie, m.produkt_id, m.sales_plattform_id, m.jahr, m.monat), m.wert_manuell)
        }
        setManuelleWerte(manualMap)

        const calcMap = new Map<string, number>()
        for (const c of calcData) {
          calcMap.set(lsppKey(c.kategorie, c.produkt_id, c.sales_plattform_id, c.jahr, c.monat), c.wert)
        }
        setBerechneteWerte(calcMap)

        // Phase 2: pro Plattform die zugeordneten Marketingkanäle laden, um zu
        // bestimmen, ob/welche Marketingkosten angezeigt werden.
        const auszahlungsResults = await Promise.all(
          plattList.map(plt =>
            fetch(`/api/langfristige-planung/${versionId}/auszahlungs-einstellungen?plattform_id=${plt.id}`)
              .then(r => (r.ok ? r.json() : null))
              .catch(() => null),
          ),
        )
        if (!aktiv) return

        const katPlattMap = new Map<string, string[]>()
        let anyMarketing = false
        plattList.forEach((plt, i) => {
          const einstellung = auszahlungsResults[i] as AuszahlungsEinstellungRecord | null
          const kanalIds = einstellung?.marketingkanal_ids ?? []
          if (kanalIds.length > 0) anyMarketing = true
          for (const kanalId of kanalIds) {
            if (!katPlattMap.has(kanalId)) katPlattMap.set(kanalId, [])
            katPlattMap.get(kanalId)!.push(plt.name)
          }
        })
        setMarketingKatPlattformMap(katPlattMap)
        setMarketingZugeordnet(anyMarketing)

        setLoading(false)
      } catch {
        if (!aktiv) return
        setError('Fehler beim Laden der Sales-Plattform-Planung.')
        setLoading(false)
      }
    }

    load()
    return () => {
      aktiv = false
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [versionId])

  // ─── Abgeleitete Sichtbarkeit ──────────────────────────────────────────────

  const showRetouren = true

  // Marketing nur, wenn mindestens einer Plattform ein Marketingkanal zugeordnet ist
  // UND tatsächlich berechnete/manuelle Marketing-Werte vorliegen.
  const marketingSubIds = useMemo(() => {
    const ids = new Set<string>()
    for (const map of [berechneteWerte, manuelleWerte]) {
      for (const key of map.keys()) {
        const parts = key.split(':')
        if (parts.length === 6 && parts[1] === 'marketing') ids.add(parts[3])
      }
    }
    return ids
  }, [berechneteWerte, manuelleWerte])

  const showMarketing = marketingZugeordnet && marketingSubIds.size > 0

  const marketingUntergruppen = useMemo(
    () => [...marketingSubIds].map(id => ({ id, name: marketingKanalNamen.get(id) ?? id })),
    [marketingSubIds, marketingKanalNamen],
  )

  // key: `${produktId}:${kanalId}` — welche Produkte unter welchem Marketingkanal erscheinen
  const activeMarketingPairs = useMemo(() => {
    const pairs = new Set<string>()
    for (const map of [berechneteWerte, manuelleWerte]) {
      for (const key of map.keys()) {
        const parts = key.split(':')
        if (parts.length === 6 && parts[1] === 'marketing') pairs.add(`${parts[2]}:${parts[3]}`)
      }
    }
    return pairs
  }, [berechneteWerte, manuelleWerte])

  // Plattformen/Produkt-Paare mit Daten (nicht-Marketing-Kategorien)
  const activePlatformIds = useMemo(() => {
    const ids = new Set<string>()
    for (const map of [berechneteWerte, manuelleWerte]) {
      for (const key of map.keys()) {
        const parts = key.split(':')
        if (parts.length === 6 && parts[1] !== 'marketing') ids.add(parts[3])
      }
    }
    return ids
  }, [berechneteWerte, manuelleWerte])

  // key: `${plattformId}:${produktId}`
  const activePairs = useMemo(() => {
    const pairs = new Set<string>()
    for (const map of [berechneteWerte, manuelleWerte]) {
      for (const key of map.keys()) {
        const parts = key.split(':')
        if (parts.length === 6 && parts[1] !== 'marketing') pairs.add(`${parts[3]}:${parts[2]}`)
      }
    }
    return pairs
  }, [berechneteWerte, manuelleWerte])

  // ─── Wert-Selektoren ───────────────────────────────────────────────────────

  const getProduktWert = useCallback(
    (
      kategorie: SalesKategorie,
      produktId: string,
      plattformId: string,
      monat: PlanungsMonat,
    ): { value: number | null; isManual: boolean } => {
      const key = lsppKey(kategorie, produktId, plattformId, monat.year, monat.month)
      const manual = manuelleWerte.get(key)
      if (manual !== undefined) return { value: manual, isManual: true }
      const calc = berechneteWerte.get(key)
      return { value: calc ?? null, isManual: false }
    },
    [manuelleWerte, berechneteWerte],
  )

  const getPlatformWert = useCallback(
    (
      kategorie: SalesKategorie,
      plattformId: string,
      monat: PlanungsMonat,
    ): { value: number | null; isManual: boolean } => {
      let sum = 0
      let hasAny = false
      let anyManual = false
      for (const prd of produkte) {
        const { value, isManual } = getProduktWert(kategorie, prd.id, plattformId, monat)
        if (value !== null) {
          sum += value
          hasAny = true
          if (isManual) anyManual = true
        }
      }
      return { value: hasAny ? sum : null, isManual: anyManual }
    },
    [produkte, getProduktWert],
  )

  const getKategorieWert = useCallback(
    (kategorie: SalesKategorie, monat: PlanungsMonat): { value: number | null; isManual: boolean } => {
      let sum = 0
      let hasAny = false
      let anyManual = false
      // Marketing ist je Marketingkanal gekeyt, nicht je Sales-Plattform.
      const items = kategorie === 'marketing' ? [...marketingSubIds].map(id => ({ id })) : plattformen
      for (const item of items) {
        const { value, isManual } = getPlatformWert(kategorie, item.id, monat)
        if (value !== null) {
          sum += value
          hasAny = true
          if (isManual) anyManual = true
        }
      }
      return { value: hasAny ? sum : null, isManual: anyManual }
    },
    [plattformen, getPlatformWert, marketingSubIds],
  )

  const getSumme = useCallback(
    (monat: PlanungsMonat): number | null => {
      const kategorien: SalesKategorie[] = ['bruttoumsatz', 'rabatte', 'rueckerstattungen', 'verkaufsgebuehr']
      if (showRetouren) kategorien.push('retouren')
      if (showMarketing) kategorien.push('marketing')
      let sum = 0
      let hasAny = false
      for (const kat of kategorien) {
        const { value } = getKategorieWert(kat, monat)
        if (value !== null) {
          sum += value * KATEGORIE_VORZEICHEN[kat]
          hasAny = true
        }
      }
      return hasAny ? sum : null
    },
    [getKategorieWert, showRetouren, showMarketing],
  )

  // ─── Mutationen ────────────────────────────────────────────────────────────

  const upsertWert = useCallback(
    async (
      kategorie: SalesKategorie,
      produktId: string,
      plattformId: string,
      monat: PlanungsMonat,
      value: number | null,
    ): Promise<void> => {
      const key = lsppKey(kategorie, produktId, plattformId, monat.year, monat.month)
      const previous = manuelleWerte.get(key)
      setManuelleWerte(prev => {
        const next = new Map(prev)
        if (value === null) next.delete(key)
        else next.set(key, value)
        return next
      })
      try {
        const res = await fetch(manuellPath, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            kategorie,
            produkt_id: produktId,
            sales_plattform_id: plattformId,
            jahr: monat.year,
            monat: monat.month,
            wert_manuell: value,
          }),
        })
        if (!res.ok) throw new Error()
      } catch {
        setManuelleWerte(prev => {
          const next = new Map(prev)
          if (previous !== undefined) next.set(key, previous)
          else next.delete(key)
          return next
        })
        throw new Error('Speichern fehlgeschlagen')
      }
    },
    [manuelleWerte, manuellPath],
  )

  const resetAll = useCallback(async (): Promise<void> => {
    const snapshot = new Map(manuelleWerte)
    setManuelleWerte(new Map())
    try {
      const res = await fetch(manuellPath, { method: 'DELETE' })
      if (!res.ok) throw new Error()
    } catch {
      setManuelleWerte(snapshot)
      throw new Error('Zurücksetzen fehlgeschlagen')
    }
  }, [manuelleWerte, manuellPath])

  return {
    monate,
    plattformen,
    produkte,
    showRetouren,
    showMarketing,
    activePlatformIds,
    activePairs,
    marketingUntergruppen,
    marketingKatPlattformMap,
    activeMarketingPairs,
    loading,
    error,
    getProduktWert,
    getPlatformWert,
    getKategorieWert,
    getSumme,
    upsertWert,
    resetAll,
  }
}

// Bildet einen Stammdaten-Datensatz auf das von der Tabelle erwartete Minimal-Shape ab.
function toKpiLike(r: LangfristigeKategorieRecord): KpiCategory {
  return {
    id: r.id,
    type: 'lp_produkt',
    parent_id: null,
    name: r.name,
    level: 1,
    sort_order: r.sort_order,
    sku_code: null,
    sales_plattform_enabled: false,
    produkt_enabled: false,
    kosten_label: null,
    ausgaben_label: null,
    ist_abzugsposten: false,
    ust_satz: null,
    exclude_from_rentabilitaet: false,
  }
}
