'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import type { KpiCategory } from '@/hooks/use-kpi-categories'
import { DEFAULT_PLANUNGSHORIZONT_MONATE } from '@/hooks/use-langfristige-grundeinstellungen'
import {
  buildPlanungsmonate,
  zellKey,
  type PlanungsMonat,
} from '@/hooks/use-langfristige-absatzplanung'

// PROJ-85: Versionsgebundene Marketing-Planung der Langfristigen Planung.
// Lädt Startmonat + ALLGEMEINEN Planungshorizont (Grundeinstellungen), Marketing-
// kanäle/Plattformen/Produkte (KPI-Modell der Version), die Kanal→Plattform-
// Zuordnung (Marketing-Einstellungen), die Absatz-/VK-Stützwerte (Absatzplanung)
// sowie die manuell eingegebenen Marketingkosten-%-Werte. Es gibt KEINE historische
// Vorbelegung — leere Zellen bleiben leer.

// ─── Typen ──────────────────────────────────────────────────────────────────

interface AbsatzplanungRecord {
  sales_plattform_id: string
  produkt_id: string
  jahr: number
  monat: number
  absatz: number | null
  effektiver_vk: number | null
}

interface MarketingplanungRecord {
  marketingkanal_id: string
  produkt_id: string
  jahr: number
  monat: number
  marketingkosten_pct: number | null
}

interface LangfristigeKategorieRecord {
  id: string
  name: string
  sort_order: number
}

interface MarketingEinstellungRecord {
  marketingkanal_id: string
  sales_plattform_id: string | null
}

// ─── Schlüssel-Helfer ─────────────────────────────────────────────────────────

// Vollständiger Selektions-/Notiz-Schlüssel für eine %-Zelle (Kanal × Produkt × Monat).
export function pctCellKey(
  kanalId: string,
  produktId: string,
  year: number,
  month: number,
): string {
  return `${zellKey(kanalId, produktId, year, month)}:pct`
}

// ─── Batch-Eintrag (für Massen-Anpassung) ──────────────────────────────────────

export interface MarketingplanungBatchCell {
  kanalId: string
  produktId: string
  monat: PlanungsMonat
  value: number | null
}

// ─── Berechnungs-Helfer ─────────────────────────────────────────────────────────

// Brutto-Umsatz = Absatz × Effektiver VK. Leer, wenn VK fehlt.
export function computeBruttoUmsatz(absatz: number | null, vk: number | null): number | null {
  if (vk === null) return null
  return (absatz ?? 0) * vk
}

// Marketingbudget = Brutto-Umsatz × (% / 100). Leer, wenn Brutto-Umsatz oder % fehlt.
export function computeBudget(brutto: number | null, pct: number | null): number | null {
  if (brutto === null || pct === null) return null
  return brutto * (pct / 100)
}

// ─── Hook ───────────────────────────────────────────────────────────────────

export function useLangfristigeMarketingplanung(versionId: string) {
  const [monate, setMonate] = useState<PlanungsMonat[]>([])
  const [marketingkanaele, setMarketingkanaele] = useState<KpiCategory[]>([])
  const [plattformen, setPlattformen] = useState<KpiCategory[]>([])
  const [produkte, setProdukte] = useState<KpiCategory[]>([])
  // Kanal-ID → Sales-Plattform-ID (oder null = "Keine")
  const [kanalPlattform, setKanalPlattform] = useState<Map<string, string | null>>(new Map())
  // Stützwerte aus der Absatzplanung, keyed mit zellKey(plattformId, produktId, ...)
  const [absatzMap, setAbsatzMap] = useState<Map<string, number>>(new Map())
  const [vkMap, setVkMap] = useState<Map<string, number>>(new Map())
  // Manuelle %-Werte, keyed mit zellKey(kanalId, produktId, ...)
  const [pctMap, setPctMap] = useState<Map<string, number>>(new Map())
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const valuesPath = `/api/langfristige-planung/${versionId}/marketingplanung`

  useEffect(() => {
    if (!versionId) return
    let aktiv = true
    setLoading(true)
    setError(null)

    async function load() {
      try {
        const [grundRes, kanalRes, plattformRes, produktRes, absatzRes, pctRes] =
          await Promise.all([
            fetch(`/api/langfristige-planung/${versionId}/grundeinstellungen`),
            fetch(`/api/langfristige-planung/${versionId}/kpi-kategorien?art=lp_marketingkanal`),
            fetch(`/api/langfristige-planung/${versionId}/kpi-kategorien?art=lp_sales_plattform`),
            fetch(`/api/langfristige-planung/${versionId}/kpi-kategorien?art=lp_produkt`),
            fetch(`/api/langfristige-planung/${versionId}/absatzplanung`),
            fetch(valuesPath),
          ])

        if (
          !grundRes.ok ||
          !kanalRes.ok ||
          !plattformRes.ok ||
          !produktRes.ok ||
          !absatzRes.ok ||
          !pctRes.ok
        ) {
          throw new Error('load failed')
        }

        const grund = await grundRes.json()
        const kanalData: LangfristigeKategorieRecord[] = await kanalRes.json()
        const plattformData: LangfristigeKategorieRecord[] = await plattformRes.json()
        const produktData: LangfristigeKategorieRecord[] = await produktRes.json()
        const absatzData: AbsatzplanungRecord[] = await absatzRes.json()
        const pctData: MarketingplanungRecord[] = await pctRes.json()
        if (!aktiv) return

        // Monatsfenster aus ALLGEMEINEM Horizont (nicht Absatz-Horizont).
        const horizont = grund.planungshorizont_monate ?? DEFAULT_PLANUNGSHORIZONT_MONATE
        setMonate(buildPlanungsmonate(grund.startmonat_monat, grund.startmonat_jahr, horizont))

        const sortByOrder = (a: LangfristigeKategorieRecord, b: LangfristigeKategorieRecord) =>
          a.sort_order - b.sort_order
        const kanaele = kanalData.slice().sort(sortByOrder)
        setMarketingkanaele(kanaele.map(toKpiLike))
        setPlattformen(plattformData.slice().sort(sortByOrder).map(toKpiLike))
        setProdukte(produktData.slice().sort(sortByOrder).map(toKpiLike))

        // Absatz-/VK-Stützwerte (je Plattform × Produkt × Monat).
        const aMap = new Map<string, number>()
        const vMap = new Map<string, number>()
        for (const r of absatzData) {
          const k = zellKey(r.sales_plattform_id, r.produkt_id, r.jahr, r.monat)
          if (r.absatz !== null && r.absatz !== undefined) aMap.set(k, r.absatz)
          if (r.effektiver_vk !== null && r.effektiver_vk !== undefined) vMap.set(k, r.effektiver_vk)
        }
        setAbsatzMap(aMap)
        setVkMap(vMap)

        // Manuelle %-Werte (je Kanal × Produkt × Monat).
        const pMap = new Map<string, number>()
        for (const r of pctData) {
          if (r.marketingkosten_pct !== null && r.marketingkosten_pct !== undefined) {
            pMap.set(zellKey(r.marketingkanal_id, r.produkt_id, r.jahr, r.monat), r.marketingkosten_pct)
          }
        }
        setPctMap(pMap)

        // Kanal → Plattform-Zuordnung: pro Kanal aus den Marketing-Einstellungen laden.
        const mappingResults = await Promise.all(
          kanaele.map(k =>
            fetch(
              `/api/langfristige-planung/${versionId}/marketing-einstellungen?marketingkanal_id=${k.id}`,
            )
              .then(r => (r.ok ? r.json() : null))
              .catch(() => null),
          ),
        )
        if (!aktiv) return
        const mMap = new Map<string, string | null>()
        kanaele.forEach((k, i) => {
          const einstellung = mappingResults[i] as MarketingEinstellungRecord | null
          mMap.set(k.id, einstellung?.sales_plattform_id ?? null)
        })
        setKanalPlattform(mMap)

        setLoading(false)
      } catch {
        if (!aktiv) return
        setError('Fehler beim Laden der Marketing-Planung.')
        setLoading(false)
      }
    }

    load()
    return () => {
      aktiv = false
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [versionId])

  // ─── Selektoren ──────────────────────────────────────────────────────────────

  const getKanalPlattform = useCallback(
    (kanalId: string): string | null => kanalPlattform.get(kanalId) ?? null,
    [kanalPlattform],
  )

  // Stützwerte direkt je Sales-Plattform (für die obere Plattform-Aggregation).
  const getAbsatzByPlattform = useCallback(
    (plattformId: string, produktId: string, monat: PlanungsMonat): number | null =>
      absatzMap.get(zellKey(plattformId, produktId, monat.year, monat.month)) ?? null,
    [absatzMap],
  )

  const getVKByPlattform = useCallback(
    (plattformId: string, produktId: string, monat: PlanungsMonat): number | null =>
      vkMap.get(zellKey(plattformId, produktId, monat.year, monat.month)) ?? null,
    [vkMap],
  )

  // Absatz/VK für einen Kanal = Wert der ihm zugeordneten Plattform.
  const getAbsatz = useCallback(
    (kanalId: string, produktId: string, monat: PlanungsMonat): number | null => {
      const plattformId = kanalPlattform.get(kanalId)
      if (!plattformId) return null
      return getAbsatzByPlattform(plattformId, produktId, monat)
    },
    [kanalPlattform, getAbsatzByPlattform],
  )

  const getVK = useCallback(
    (kanalId: string, produktId: string, monat: PlanungsMonat): number | null => {
      const plattformId = kanalPlattform.get(kanalId)
      if (!plattformId) return null
      return getVKByPlattform(plattformId, produktId, monat)
    },
    [kanalPlattform, getVKByPlattform],
  )

  const getPct = useCallback(
    (kanalId: string, produktId: string, monat: PlanungsMonat): number | null =>
      pctMap.get(zellKey(kanalId, produktId, monat.year, monat.month)) ?? null,
    [pctMap],
  )

  const getBudget = useCallback(
    (kanalId: string, produktId: string, monat: PlanungsMonat): number | null => {
      const brutto = computeBruttoUmsatz(
        getAbsatz(kanalId, produktId, monat),
        getVK(kanalId, produktId, monat),
      )
      return computeBudget(brutto, getPct(kanalId, produktId, monat))
    },
    [getAbsatz, getVK, getPct],
  )

  // ─── Persistenz (nur %-Werte) ──────────────────────────────────────────────────

  async function putCells(cells: MarketingplanungRecord[]): Promise<void> {
    const res = await fetch(valuesPath, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(cells.length === 1 ? cells[0] : { cells }),
    })
    if (!res.ok) throw new Error('Speichern fehlgeschlagen')
  }

  const applyLocal = useCallback(
    (kanalId: string, produktId: string, monat: PlanungsMonat, value: number | null) => {
      const k = zellKey(kanalId, produktId, monat.year, monat.month)
      setPctMap(prev => {
        const next = new Map(prev)
        if (value === null) next.delete(k)
        else next.set(k, value)
        return next
      })
    },
    [],
  )

  const upsertCell = useCallback(
    async (
      kanalId: string,
      produktId: string,
      monat: PlanungsMonat,
      value: number | null,
    ): Promise<void> => {
      const k = zellKey(kanalId, produktId, monat.year, monat.month)
      const prev = pctMap.get(k)
      applyLocal(kanalId, produktId, monat, value)
      try {
        await putCells([
          {
            marketingkanal_id: kanalId,
            produkt_id: produktId,
            jahr: monat.year,
            monat: monat.month,
            marketingkosten_pct: value,
          },
        ])
      } catch (e) {
        setPctMap(prevMap => {
          const next = new Map(prevMap)
          if (prev === undefined) next.delete(k)
          else next.set(k, prev)
          return next
        })
        throw e
      }
    },
    [pctMap, applyLocal],
  )

  const upsertBatch = useCallback(
    async (cells: MarketingplanungBatchCell[]): Promise<void> => {
      if (cells.length === 0) return
      const snapshot = new Map(pctMap)

      const records: MarketingplanungRecord[] = cells.map(c => {
        applyLocal(c.kanalId, c.produktId, c.monat, c.value)
        return {
          marketingkanal_id: c.kanalId,
          produkt_id: c.produktId,
          jahr: c.monat.year,
          monat: c.monat.month,
          marketingkosten_pct: c.value,
        }
      })

      try {
        await putCells(records)
      } catch (e) {
        setPctMap(snapshot)
        throw e
      }
    },
    [pctMap, applyLocal],
  )

  const sortedKanaele = useMemo(() => marketingkanaele, [marketingkanaele])
  const sortedPlattformen = useMemo(() => plattformen, [plattformen])
  const sortedProdukte = useMemo(() => produkte, [produkte])

  return {
    monate,
    marketingkanaele: sortedKanaele,
    plattformen: sortedPlattformen,
    produkte: sortedProdukte,
    loading,
    error,
    getKanalPlattform,
    getAbsatz,
    getVK,
    getAbsatzByPlattform,
    getVKByPlattform,
    getPct,
    getBudget,
    upsertCell,
    upsertBatch,
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
