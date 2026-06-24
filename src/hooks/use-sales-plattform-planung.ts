'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import { subWeeks, startOfISOWeek, getISOWeek, getISOWeekYear } from 'date-fns'
import type { PlanungsWoche } from '@/hooks/use-absatzplanung'
import { berechnePlanungswochen } from '@/hooks/use-absatzplanung'
import type { KpiCategory } from '@/hooks/use-kpi-categories'

// ─── Types ────────────────────────────────────────────────────────────────────

export type SalesKategorie =
  | 'bruttoumsatz'
  | 'rabatte'
  | 'rueckerstattungen'
  | 'verkaufsgebuehr'
  | 'retouren'
  | 'marketing'

export const SALES_KATEGORIEN: SalesKategorie[] = [
  'bruttoumsatz',
  'rueckerstattungen',
  'verkaufsgebuehr',
  'retouren',
  'marketing',
]

export const KATEGORIE_LABELS: Record<SalesKategorie, string> = {
  bruttoumsatz: 'Bruttoumsatz',
  rabatte: 'Rabatte',
  rueckerstattungen: 'Rückerstattungen',
  verkaufsgebuehr: 'Verkaufsgebühr',
  retouren: 'Retourenkosten',
  marketing: 'Marketingkosten',
}

// +1 = in DB gespeicherter Wert ist positiv und bleibt positiv für Anzeige/Summe
// -1 = in DB gespeicherter Wert ist positiv, wird aber als Abzugsposten negativ dargestellt
export const KATEGORIE_VORZEICHEN: Record<SalesKategorie, 1 | -1> = {
  bruttoumsatz: 1,
  rabatte: -1,
  rueckerstattungen: -1,
  verkaufsgebuehr: -1,
  retouren: -1,
  marketing: -1,
}

export interface SalesManuellerWert {
  id?: string
  kategorie: SalesKategorie
  produkt_id: string
  sales_plattform_id: string
  kw_year: number
  kw_number: number
  wert_manuell: number
}

export interface SalesHistorischWert {
  kategorie: SalesKategorie
  produkt_id: string
  sales_plattform_id: string
  kw_year: number
  kw_number: number
  wert: number
}

// ─── Key helpers ─────────────────────────────────────────────────────────────

export function sppKey(
  kategorie: SalesKategorie,
  produktId: string,
  plattformId: string,
  year: number,
  week: number,
): string {
  return `spp:${kategorie}:${produktId}:${plattformId}:${year}:${week}`
}

function berechneVergangenheitswochen(horizont: number): PlanungsWoche[] {
  const today = new Date()
  const result: PlanungsWoche[] = []
  for (let i = horizont; i >= 1; i--) {
    const d = startOfISOWeek(subWeeks(today, i))
    const week = getISOWeek(d)
    const year = getISOWeekYear(d)
    result.push({
      year,
      week,
      label: `KW${String(week).padStart(2, '0')} / ${year}`,
    })
  }
  return result
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function useSalesPlattformPlanung() {
  const [planungshorizont, setPlanungshorizont] = useState(13)
  const [vergangenheitshorizont, setVergangenheitshorizont] = useState(13)
  const [plattformen, setPlattformen] = useState<KpiCategory[]>([])
  const [produkte, setProdukte] = useState<KpiCategory[]>([])
  // key: plattformId → { retouren: boolean; marketing: boolean }
  const [aktiveFlags, setAktiveFlags] = useState<Map<string, { retouren: boolean; marketing: boolean }>>(new Map())
  // key: sppKey(...) → value from transactions
  const [historischeWerte, setHistorischeWerte] = useState<Map<string, number>>(new Map())
  // key: sppKey(...) → calculated future value
  const [berechneteWerte, setBerechneteWerte] = useState<Map<string, number>>(new Map())
  // key: sppKey(...) → manual override value
  const [manuelleWerte, setManuelleWerte] = useState<Map<string, number>>(new Map())
  // id → name map for ausgaben_kosten categories (for marketing sub-category names)
  const [ausgabenKatMap, setAusgabenKatMap] = useState<Map<string, string>>(new Map())
  // kpi_kategorie_id → platform names assigned in Auszahlungseinstellungen
  const [marketingKatPlattformMap, setMarketingKatPlattformMap] = useState<Map<string, string[]>>(new Map())
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [isRefreshing, setIsRefreshing] = useState(false)

  const vergangenheitswochen = useMemo(
    () => berechneVergangenheitswochen(vergangenheitshorizont),
    [vergangenheitshorizont],
  )

  const planungswochen = useMemo(
    () => berechnePlanungswochen(planungshorizont),
    [planungshorizont],
  )

  const alleWochen = useMemo(
    () => [...vergangenheitswochen, ...planungswochen],
    [vergangenheitswochen, planungswochen],
  )

  const vergangenheitSet = useMemo(() => {
    const s = new Set<string>()
    for (const w of vergangenheitswochen) s.add(`${w.year}:${w.week}`)
    return s
  }, [vergangenheitswochen])

  useEffect(() => {
    setLoading(true)
    setError(null)

    Promise.all([
      fetch('/api/grundeinstellungen').then(r => (r.ok ? r.json() : {})),
      fetch('/api/kpi-categories?type=sales_plattformen').then(r => (r.ok ? r.json() : [])),
      fetch('/api/kpi-categories?type=produkte').then(r => (r.ok ? r.json() : [])),
      fetch('/api/sales-plattform-planung').then(r => (r.ok ? r.json() : [])),
      fetch('/api/sales-plattform-planung/historisch').then(r => (r.ok ? r.json() : [])),
      fetch('/api/sales-plattform-planung/berechnet').then(r => (r.ok ? r.json() : [])),
      fetch('/api/kpi-categories?type=ausgaben_kosten').then(r => (r.ok ? r.json() : [])),
    ])
      .then(([grundDataRaw, plattRaw, prodRaw, manualRaw, histRaw, calcRaw, ausgKatRaw]) => {
        const grundData = grundDataRaw as { planungshorizont_wochen?: number; vergangenheitshorizont_wochen?: number } | null
        setPlanungshorizont(grundData?.planungshorizont_wochen ?? 13)
        setVergangenheitshorizont(grundData?.vergangenheitshorizont_wochen ?? 13)

        const plattList = (Array.isArray(plattRaw) ? plattRaw : []) as KpiCategory[]
        const allProdukte = (Array.isArray(prodRaw) ? prodRaw : []) as KpiCategory[]
        setPlattformen(plattList)
        setProdukte(allProdukte.filter(c => c.level === 1))

        const manualMap = new Map<string, number>()
        for (const m of (Array.isArray(manualRaw) ? manualRaw : (manualRaw?.data ?? [])) as SalesManuellerWert[]) {
          manualMap.set(sppKey(m.kategorie, m.produkt_id, m.sales_plattform_id, m.kw_year, m.kw_number), m.wert_manuell)
        }
        setManuelleWerte(manualMap)

        const histMap = new Map<string, number>()
        for (const h of (Array.isArray(histRaw) ? histRaw : (histRaw?.data ?? [])) as SalesHistorischWert[]) {
          histMap.set(sppKey(h.kategorie, h.produkt_id, h.sales_plattform_id, h.kw_year, h.kw_number), h.wert)
        }
        setHistorischeWerte(histMap)

        const calcMap = new Map<string, number>()
        for (const c of (Array.isArray(calcRaw) ? calcRaw : (calcRaw?.data ?? [])) as SalesHistorischWert[]) {
          calcMap.set(sppKey(c.kategorie, c.produkt_id, c.sales_plattform_id, c.kw_year, c.kw_number), c.wert)
        }
        setBerechneteWerte(calcMap)

        const ausgKatMapLocal = new Map<string, string>()
        for (const k of (Array.isArray(ausgKatRaw) ? ausgKatRaw : []) as { id: string; name: string }[]) {
          ausgKatMapLocal.set(k.id, k.name)
        }
        setAusgabenKatMap(ausgKatMapLocal)

        return Promise.all(
          plattList.map(plt =>
            Promise.all([
              fetch(`/api/auszahlungs-einstellungen?plattform_id=${plt.id}`).then(r =>
                r.ok ? r.json() : null,
              ),
              fetch(`/api/auszahlungs-marketing-gruppen?plattform_id=${plt.id}`).then(r =>
                r.ok ? r.json() : [],
              ),
            ]).then(([einstellung, marketingGruppen]) => ({ plt, einstellung, marketingGruppen }))
          ),
        )
      })
      .then(results => {
        const flagMap = new Map<string, { retouren: boolean; marketing: boolean }>()
        const katPlattMap = new Map<string, string[]>()
        for (const { plt, einstellung, marketingGruppen } of results) {
          const retouren = einstellung ? !!einstellung.retouren_inkludiert : false
          const marketing = Array.isArray(marketingGruppen) && marketingGruppen.length > 0
          flagMap.set(plt.id, { retouren, marketing })
          for (const g of (Array.isArray(marketingGruppen) ? marketingGruppen : []) as { kpi_kategorie_id: string }[]) {
            if (!katPlattMap.has(g.kpi_kategorie_id)) katPlattMap.set(g.kpi_kategorie_id, [])
            katPlattMap.get(g.kpi_kategorie_id)!.push(plt.name)
          }
        }
        setAktiveFlags(flagMap)
        setMarketingKatPlattformMap(katPlattMap)
        setLoading(false)
      })
      .catch(() => {
        setError('Fehler beim Laden der Sales Plattform Planung.')
        setLoading(false)
      })
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // ─── Derived flags ────────────────────────────────────────────────────────

  const showRetouren = true

  const showMarketing = useMemo(() => {
    for (const flags of aktiveFlags.values()) {
      if (flags.marketing) return true
    }
    return false
  }, [aktiveFlags])

  // ─── Marketing sub-category IDs (derived from data keys) ─────────────────

  const marketingSubIds = useMemo(() => {
    const ids = new Set<string>()
    for (const map of [historischeWerte, berechneteWerte, manuelleWerte]) {
      for (const key of map.keys()) {
        const parts = key.split(':')
        if (parts.length === 6 && parts[1] === 'marketing') ids.add(parts[3])
      }
    }
    return ids
  }, [historischeWerte, berechneteWerte, manuelleWerte])

  const marketingUntergruppen = useMemo(
    () => [...marketingSubIds].map(id => ({ id, name: ausgabenKatMap.get(id) ?? id })),
    [marketingSubIds, ausgabenKatMap],
  )

  // key: `${produktId}:${untergruppeId}` for marketing (which products appear under which sub-category)
  const activeMarketingPairs = useMemo(() => {
    const pairs = new Set<string>()
    for (const map of [historischeWerte, berechneteWerte, manuelleWerte]) {
      for (const key of map.keys()) {
        const parts = key.split(':')
        if (parts.length === 6 && parts[1] === 'marketing') pairs.add(`${parts[2]}:${parts[3]}`)
      }
    }
    return pairs
  }, [historischeWerte, berechneteWerte, manuelleWerte])

  // ─── Active IDs (platforms/products with any data) ────────────────────────

  const activePlatformIds = useMemo(() => {
    const ids = new Set<string>()
    for (const map of [historischeWerte, berechneteWerte, manuelleWerte]) {
      for (const key of map.keys()) {
        const parts = key.split(':')
        if (parts.length === 6) ids.add(parts[3])
      }
    }
    return ids
  }, [historischeWerte, berechneteWerte, manuelleWerte])

  // key: `${plattformId}:${produktId}`
  const activePairs = useMemo(() => {
    const pairs = new Set<string>()
    for (const map of [historischeWerte, berechneteWerte, manuelleWerte]) {
      for (const key of map.keys()) {
        const parts = key.split(':')
        if (parts.length === 6) pairs.add(`${parts[3]}:${parts[2]}`)
      }
    }
    return pairs
  }, [historischeWerte, berechneteWerte, manuelleWerte])

  // ─── Value selectors ──────────────────────────────────────────────────────

  function isPastWeek(kw: PlanungsWoche): boolean {
    return vergangenheitSet.has(`${kw.year}:${kw.week}`)
  }

  const getProduktWert = useCallback(
    (
      kategorie: SalesKategorie,
      produktId: string,
      plattformId: string,
      kw: PlanungsWoche,
    ): { value: number | null; isManual: boolean } => {
      if (kategorie === 'rueckerstattungen') {
        // Rabatte always empty — but "rueckerstattungen" is what the user calls Rückerstattungen
        // Nothing is hardcoded to empty; let normal flow handle it
      }
      const key = sppKey(kategorie, produktId, plattformId, kw.year, kw.week)
      const manual = manuelleWerte.get(key)
      if (manual !== undefined) return { value: manual, isManual: true }
      const past = vergangenheitSet.has(`${kw.year}:${kw.week}`)
      if (past) {
        const hist = historischeWerte.get(key)
        return { value: hist ?? null, isManual: false }
      }
      const calc = berechneteWerte.get(key)
      return { value: calc ?? null, isManual: false }
    },
    [manuelleWerte, historischeWerte, berechneteWerte, vergangenheitSet],
  )

  const getPlatformWert = useCallback(
    (
      kategorie: SalesKategorie,
      plattformId: string,
      kw: PlanungsWoche,
    ): { value: number | null; isManual: boolean } => {
      let sum = 0
      let hasAny = false
      let anyManual = false
      for (const prd of produkte) {
        const { value, isManual } = getProduktWert(kategorie, prd.id, plattformId, kw)
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
    (
      kategorie: SalesKategorie,
      kw: PlanungsWoche,
    ): { value: number | null; isManual: boolean } => {
      let sum = 0
      let hasAny = false
      let anyManual = false
      // Marketing is keyed by marketing sub-category ID, not by sales platform
      const items = kategorie === 'marketing'
        ? [...marketingSubIds].map(id => ({ id }))
        : plattformen
      for (const item of items) {
        const { value, isManual } = getPlatformWert(kategorie, item.id, kw)
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
    (kw: PlanungsWoche): number | null => {
      const kategorien: SalesKategorie[] = ['bruttoumsatz', 'rabatte', 'rueckerstattungen', 'verkaufsgebuehr']
      if (showRetouren) kategorien.push('retouren')
      if (showMarketing) kategorien.push('marketing')
      let sum = 0
      let hasAny = false
      for (const kat of kategorien) {
        const { value } = getKategorieWert(kat, kw)
        if (value !== null) {
          sum += value * KATEGORIE_VORZEICHEN[kat]
          hasAny = true
        }
      }
      return hasAny ? sum : null
    },
    [getKategorieWert, showRetouren, showMarketing],
  )

  // ─── Mutations ────────────────────────────────────────────────────────────

  const upsertWert = useCallback(
    async (
      kategorie: SalesKategorie,
      produktId: string,
      plattformId: string,
      kw: PlanungsWoche,
      value: number | null,
    ): Promise<void> => {
      const key = sppKey(kategorie, produktId, plattformId, kw.year, kw.week)
      const previous = manuelleWerte.get(key)
      setManuelleWerte(prev => {
        const next = new Map(prev)
        if (value === null) next.delete(key)
        else next.set(key, value)
        return next
      })
      try {
        const res = await fetch('/api/sales-plattform-planung', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            kategorie,
            produkt_id: produktId,
            sales_plattform_id: plattformId,
            kw_year: kw.year,
            kw_number: kw.week,
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
    [manuelleWerte],
  )

  const resetAll = useCallback(async (): Promise<void> => {
    const snapshot = new Map(manuelleWerte)
    setManuelleWerte(new Map())
    try {
      const res = await fetch('/api/sales-plattform-planung', { method: 'DELETE' })
      if (!res.ok) throw new Error()
    } catch {
      setManuelleWerte(snapshot)
      throw new Error('Zurücksetzen fehlgeschlagen')
    }
  }, [manuelleWerte])

  const refreshHistorisch = useCallback(async (filterProduktIds?: string[]): Promise<void> => {
    setIsRefreshing(true)
    try {
      const params =
        filterProduktIds && filterProduktIds.length > 0
          ? `?produkt_ids=${filterProduktIds.join(',')}`
          : ''
      const [histData, calcData] = await Promise.all([
        fetch(`/api/sales-plattform-planung/historisch${params}`).then(r =>
          r.ok ? r.json() : [],
        ),
        fetch('/api/sales-plattform-planung/berechnet').then(r => (r.ok ? r.json() : [])),
      ])

      const histMap = new Map<string, number>()
      for (const h of (Array.isArray(histData) ? histData : (histData?.data ?? [])) as SalesHistorischWert[]) {
        histMap.set(sppKey(h.kategorie, h.produkt_id, h.sales_plattform_id, h.kw_year, h.kw_number), h.wert)
      }
      // Merge: if filterProduktIds given, only update those products
      if (filterProduktIds && filterProduktIds.length > 0) {
        setHistorischeWerte(prev => {
          const next = new Map(prev)
          // Remove old entries for filtered products
          for (const key of next.keys()) {
            const parts = key.split(':')
            if (parts.length >= 3 && filterProduktIds.includes(parts[2])) next.delete(key)
          }
          for (const [k, v] of histMap) next.set(k, v)
          return next
        })
      } else {
        setHistorischeWerte(histMap)
      }

      const calcMap = new Map<string, number>()
      for (const c of (Array.isArray(calcData) ? calcData : (calcData?.data ?? [])) as SalesHistorischWert[]) {
        calcMap.set(sppKey(c.kategorie, c.produkt_id, c.sales_plattform_id, c.kw_year, c.kw_number), c.wert)
      }
      setBerechneteWerte(calcMap)
    } finally {
      setIsRefreshing(false)
    }
  }, [])

  return {
    alleWochen,
    vergangenheitswochen,
    planungswochen,
    vergangenheitSet,
    plattformen,
    produkte,
    aktiveFlags,
    showRetouren,
    showMarketing,
    activePlatformIds,
    activePairs,
    marketingUntergruppen,
    marketingKatPlattformMap,
    activeMarketingPairs,
    loading,
    error,
    isRefreshing,
    isPastWeek,
    getProduktWert,
    getPlatformWert,
    getKategorieWert,
    getSumme,
    upsertWert,
    resetAll,
    refreshHistorisch,
  }
}
