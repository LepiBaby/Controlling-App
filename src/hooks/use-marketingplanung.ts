'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import {
  berechnePlanungswochen,
  skuAbsatzKey,
  produktVKKey,
} from '@/hooks/use-absatzplanung'
import type { PlanungsWoche, HistorischSkuWert } from '@/hooks/use-absatzplanung'
import type { KpiCategory } from '@/hooks/use-kpi-categories'

export type { PlanungsWoche } from '@/hooks/use-absatzplanung'

// ─── Types ────────────────────────────────────────────────────────────────────

export interface HistorischMarketingPct {
  produkt_id: string
  kategorie_id: string
  marketingkosten_pct: number
}

// ─── Key helpers ─────────────────────────────────────────────────────────────

export function mktPctKey(
  produktId: string,
  kategorieId: string,
  year: number,
  week: number,
): string {
  return `mkt:${produktId}:${kategorieId}:${year}:${week}`
}

export function mktHistKey(produktId: string, kategorieId: string): string {
  return `${produktId}:${kategorieId}`
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function useMarketingplanung() {
  const [planungshorizont, setPlanungshorizont] = useState(13)
  // Marketing-Untergruppen (level-2 Kinder der "Marketing" ausgaben_kosten-Kategorie)
  const [marketingUntergruppen, setMarketingUntergruppen] = useState<KpiCategory[]>([])
  // Alle Sales-Plattformen — nur intern für Absatz/VK-Berechnung
  const [plattformen, setPlattformen] = useState<KpiCategory[]>([])
  const [produkte, setProdukte] = useState<KpiCategory[]>([])
  const [skusByProdukt, setSkusByProdukt] = useState<Map<string, KpiCategory[]>>(new Map())
  // Set of "kategorieId:produktId" where berechnungsart !== 'keine'
  const [aktiveKombis, setAktiveKombis] = useState<Set<string>>(new Set())
  // key: kategorieId → sales_plattform_id (null = alle Plattformen)
  const [kategoriePlattformMap, setKategoriePlattformMap] = useState<Map<string, string | null>>(new Map())
  // key: "${skuId}:${plattformId}" → tagesdurchschnitt (daily)
  const [historischeSkuWerte, setHistorischeSkuWerte] = useState<Map<string, number>>(new Map())
  // key: skuAbsatzKey(...) → absatz_manuell
  const [manuelleSkuAbsatz, setManuelleSkuAbsatz] = useState<Map<string, number | null>>(new Map())
  // key: produktVKKey(...) → effektiver_vk_manuell
  const [manuelleVK, setManuelleVK] = useState<Map<string, number | null>>(new Map())
  // key: mktPctKey(...) → { value, ist_manuell }
  const [storedMarketingPct, setStoredMarketingPct] = useState<Map<string, { value: number; ist_manuell: boolean }>>(new Map())
  // key: mktHistKey(...) → historischer %-Wert
  const [historischeMarketingPct, setHistorischeMarketingPct] = useState<Map<string, number>>(new Map())
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [isRefreshing, setIsRefreshing] = useState(false)

  const wochen = useMemo(() => berechnePlanungswochen(planungshorizont), [planungshorizont])

  useEffect(() => {
    setLoading(true)
    setError(null)

    Promise.all([
      fetch('/api/grundeinstellungen').then(r => (r.ok ? r.json() : { planungshorizont_wochen: 13 })),
      fetch('/api/kpi-categories?type=sales_plattformen').then(r => (r.ok ? r.json() : [])),
      fetch('/api/kpi-categories?type=produkte').then(r => (r.ok ? r.json() : [])),
      fetch('/api/kpi-categories?type=ausgaben_kosten').then(r => (r.ok ? r.json() : [])),
      fetch('/api/absatz-planung/historisch-sku').then(r => (r.ok ? r.json() : { data: [] })),
      fetch('/api/absatz-planung').then(r => (r.ok ? r.json() : { data: [] })),
      fetch('/api/marketing-planung').then(r => (r.ok ? r.json() : [])),
      fetch('/api/marketing-planung/historisch').then(r => (r.ok ? r.json() : [])),
    ])
      .then(([grundData, plattRaw, prodRaw, ausgabenKatsRaw, histSkuData, manAbsatzData, manMktData, histMktData]) => {
        const horizont: number = grundData?.planungshorizont_wochen ?? 13
        setPlanungshorizont(horizont)

        const plattList  = (Array.isArray(plattRaw) ? plattRaw : []) as KpiCategory[]
        const allProdukte = (Array.isArray(prodRaw) ? prodRaw : []) as KpiCategory[]
        const prodList   = allProdukte.filter(c => c.level === 1)
        const skuList    = allProdukte.filter(c => c.level === 2)

        setPlattformen(plattList)
        setProdukte(prodList)

        // Derive Marketing-Untergruppen: level-2 children of the "Marketing" ausgaben_kosten category
        const allAusgabenKats = (Array.isArray(ausgabenKatsRaw) ? ausgabenKatsRaw : []) as KpiCategory[]
        const marketingParent = allAusgabenKats.find(
          k => k.level === 1 && k.name.toLowerCase() === 'marketing'
        )
        const untergruppen = marketingParent
          ? allAusgabenKats.filter(k => k.level === 2 && k.parent_id === marketingParent.id)
          : []
        setMarketingUntergruppen(untergruppen)

        const skuMap = new Map<string, KpiCategory[]>()
        for (const sku of skuList) {
          const parentId = sku.parent_id as string | null
          if (!parentId) continue
          if (!skuMap.has(parentId)) skuMap.set(parentId, [])
          skuMap.get(parentId)!.push(sku)
        }
        setSkusByProdukt(skuMap)

        const histSkuMap = new Map<string, number>()
        for (const h of (histSkuData?.data ?? []) as HistorischSkuWert[]) {
          histSkuMap.set(`${h.sku_id}:${h.sales_plattform_id}`, h.tagesdurchschnitt)
        }
        setHistorischeSkuWerte(histSkuMap)

        const absatzMap = new Map<string, number | null>()
        const vkMap    = new Map<string, number | null>()
        for (const m of (manAbsatzData?.data ?? []) as {
          sku_id: string | null
          produkt_id: string
          sales_plattform_id: string
          kw_year: number
          kw_number: number
          absatz_manuell: number | null
          effektiver_vk_manuell: number | null
        }[]) {
          if (m.sku_id !== null && m.absatz_manuell !== null) {
            absatzMap.set(skuAbsatzKey(m.sku_id, m.sales_plattform_id, m.kw_year, m.kw_number), m.absatz_manuell)
          }
          if (m.sku_id === null && m.effektiver_vk_manuell !== null) {
            vkMap.set(produktVKKey(m.produkt_id, m.sales_plattform_id, m.kw_year, m.kw_number), m.effektiver_vk_manuell)
          }
        }
        setManuelleSkuAbsatz(absatzMap)
        setManuelleVK(vkMap)

        const mktStoredMap = new Map<string, { value: number; ist_manuell: boolean }>()
        for (const m of (Array.isArray(manMktData) ? manMktData : (manMktData?.data ?? [])) as {
          produkt_id: string
          kategorie_id: string
          kw_year: number
          kw_number: number
          marketingkosten_pct_manuell: number | null
          ist_manuell: boolean
        }[]) {
          if (m.marketingkosten_pct_manuell !== null) {
            mktStoredMap.set(
              mktPctKey(m.produkt_id, m.kategorie_id, m.kw_year, m.kw_number),
              { value: m.marketingkosten_pct_manuell, ist_manuell: m.ist_manuell },
            )
          }
        }
        setStoredMarketingPct(mktStoredMap)

        const mktHistMap = new Map<string, number>()
        for (const h of (Array.isArray(histMktData) ? histMktData : (histMktData?.data ?? [])) as HistorischMarketingPct[]) {
          mktHistMap.set(mktHistKey(h.produkt_id, h.kategorie_id), h.marketingkosten_pct)
        }
        setHistorischeMarketingPct(mktHistMap)

        return Promise.all([
          Promise.all(
            untergruppen.map(ug =>
              fetch(`/api/marketing-einstellungen?kategorie_id=${ug.id}`).then(r =>
                r.ok ? r.json() : [],
              ),
            ),
          ),
          Promise.all(
            untergruppen.map(ug =>
              fetch(`/api/marketing-kategorie-einstellungen?kategorie_id=${ug.id}`).then(r =>
                r.ok ? r.json() : null,
              ),
            ),
          ),
          Promise.resolve(untergruppen),
        ] as const)
      })
      .then(([einstellArrays, katEinstArrays, untergruppen]) => {
        const kombis = new Set<string>()
        for (const list of einstellArrays) {
          for (const e of Array.isArray(list) ? list : (list?.data ?? [])) {
            if (e.berechnungsart && e.berechnungsart !== 'keine') {
              kombis.add(`${e.kategorie_id}:${e.produkt_id}`)
            }
          }
        }
        setAktiveKombis(kombis)

        const plattformMap = new Map<string, string | null>()
        for (let i = 0; i < untergruppen.length; i++) {
          const einst = katEinstArrays[i] as { sales_plattform_id?: string | null } | null
          plattformMap.set(untergruppen[i].id, einst?.sales_plattform_id ?? null)
        }
        setKategoriePlattformMap(plattformMap)
        setLoading(false)
      })
      .catch(() => {
        setError('Fehler beim Laden der Marketing-Planung.')
        setLoading(false)
      })
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // ─── Selectors ──────────────────────────────────────────────────────────────

  const getSkuAbsatz = useCallback(
    (skuId: string, plattformId: string, kw: PlanungsWoche): number => {
      const key = skuAbsatzKey(skuId, plattformId, kw.year, kw.week)
      const m   = manuelleSkuAbsatz.get(key)
      if (m !== undefined && m !== null) return m
      const hist = historischeSkuWerte.get(`${skuId}:${plattformId}`)
      return hist !== undefined ? Math.round(hist * 7 * 100) / 100 : 0
    },
    [manuelleSkuAbsatz, historischeSkuWerte],
  )

  const getProductAbsatz = useCallback(
    (produktId: string, plattformId: string, kw: PlanungsWoche): number => {
      const skus = skusByProdukt.get(produktId) ?? []
      return Math.round(skus.reduce((sum, sku) => sum + getSkuAbsatz(sku.id, plattformId, kw), 0) * 100) / 100
    },
    [skusByProdukt, getSkuAbsatz],
  )

  const getVK = useCallback(
    (produktId: string, plattformId: string, kw: PlanungsWoche): number | null => {
      const key = produktVKKey(produktId, plattformId, kw.year, kw.week)
      const m   = manuelleVK.get(key)
      return m !== undefined && m !== null ? m : null
    },
    [manuelleVK],
  )

  // Total absatz across all platforms for a product in a given week
  const getProductTotalAbsatz = useCallback(
    (produktId: string, kw: PlanungsWoche): number => {
      return Math.round(
        plattformen.reduce((sum, plt) => sum + getProductAbsatz(produktId, plt.id, kw), 0) * 100,
      ) / 100
    },
    [plattformen, getProductAbsatz],
  )

  // Total umsatz = sum of (absatz × VK) across all platforms; null if no platform has VK set
  const getProductTotalUmsatz = useCallback(
    (produktId: string, kw: PlanungsWoche): number | null => {
      let total  = 0
      let hasVK  = false
      for (const plt of plattformen) {
        const absatz = getProductAbsatz(produktId, plt.id, kw)
        const vk     = getVK(produktId, plt.id, kw)
        if (vk !== null) {
          total += absatz * vk
          hasVK  = true
        }
      }
      return hasVK ? total : null
    },
    [plattformen, getProductAbsatz, getVK],
  )

  // Weighted-average VK across all platforms (totalUmsatz / totalAbsatz)
  const getProductEffektiverVK = useCallback(
    (produktId: string, kw: PlanungsWoche): number | null => {
      const totalAbsatz = getProductTotalAbsatz(produktId, kw)
      const totalUmsatz = getProductTotalUmsatz(produktId, kw)
      if (totalAbsatz === 0 || totalUmsatz === null) return null
      return totalUmsatz / totalAbsatz
    },
    [getProductTotalAbsatz, getProductTotalUmsatz],
  )

  // ─── Kategorie-aware selectors (platform-filtered when sales_plattform_id set) ──

  const getAbsatzForKategorie = useCallback(
    (produktId: string, kw: PlanungsWoche, kategorieId: string): number => {
      const plattformId = kategoriePlattformMap.get(kategorieId) ?? null
      if (plattformId !== null) {
        const skus = skusByProdukt.get(produktId) ?? []
        return Math.round(skus.reduce((sum, sku) => sum + getSkuAbsatz(sku.id, plattformId, kw), 0) * 100) / 100
      }
      return getProductTotalAbsatz(produktId, kw)
    },
    [kategoriePlattformMap, skusByProdukt, getSkuAbsatz, getProductTotalAbsatz],
  )

  const getVKForKategorie = useCallback(
    (produktId: string, kw: PlanungsWoche, kategorieId: string): number | null => {
      const plattformId = kategoriePlattformMap.get(kategorieId) ?? null
      if (plattformId !== null) {
        return getVK(produktId, plattformId, kw)
      }
      return getProductEffektiverVK(produktId, kw)
    },
    [kategoriePlattformMap, getVK, getProductEffektiverVK],
  )

  const getUmsatzForKategorie = useCallback(
    (produktId: string, kw: PlanungsWoche, kategorieId: string): number | null => {
      const plattformId = kategoriePlattformMap.get(kategorieId) ?? null
      if (plattformId !== null) {
        const skus = skusByProdukt.get(produktId) ?? []
        const absatz = Math.round(skus.reduce((sum, sku) => sum + getSkuAbsatz(sku.id, plattformId, kw), 0) * 100) / 100
        const vk = getVK(produktId, plattformId, kw)
        if (vk === null) return null
        return Math.round(absatz * vk * 100) / 100
      }
      return getProductTotalUmsatz(produktId, kw)
    },
    [kategoriePlattformMap, skusByProdukt, getSkuAbsatz, getVK, getProductTotalUmsatz],
  )

  const getKategoriePlattformId = useCallback(
    (kategorieId: string): string | null => kategoriePlattformMap.get(kategorieId) ?? null,
    [kategoriePlattformMap],
  )

  const getKategoriePlattformLabel = useCallback(
    (kategorieId: string): string => {
      const plattformId = kategoriePlattformMap.get(kategorieId) ?? null
      if (plattformId === null) return 'Gesamt'
      const platt = plattformen.find(p => p.id === plattformId)
      return platt?.name ?? 'Gesamt'
    },
    [kategoriePlattformMap, plattformen],
  )

  const getMarketingPct = useCallback(
    (produktId: string, kategorieId: string, kw: PlanungsWoche): { value: number; isManual: boolean } => {
      const key    = mktPctKey(produktId, kategorieId, kw.year, kw.week)
      const stored = storedMarketingPct.get(key)
      if (stored !== undefined) return { value: stored.value, isManual: stored.ist_manuell }
      const hist = historischeMarketingPct.get(mktHistKey(produktId, kategorieId))
      return { value: hist ?? 0, isManual: false }
    },
    [storedMarketingPct, historischeMarketingPct],
  )

  const lastWoche = wochen[wochen.length - 1]
  const isNewWeek = useMemo(() => {
    if (!lastWoche) return false
    for (const key of storedMarketingPct.keys()) {
      if (key.endsWith(`:${lastWoche.year}:${lastWoche.week}`)) return false
    }
    return true
  }, [lastWoche, storedMarketingPct])

  // ─── Mutations ──────────────────────────────────────────────────────────────

  const upsertMarketingPct = useCallback(
    async (
      produktId: string,
      kategorieId: string,
      kw: PlanungsWoche,
      value: number | null,
    ): Promise<void> => {
      const key      = mktPctKey(produktId, kategorieId, kw.year, kw.week)
      const existing = storedMarketingPct.get(key)
      setStoredMarketingPct(prev => {
        const next = new Map(prev)
        if (value === null) next.delete(key)
        else next.set(key, { value, ist_manuell: true })
        return next
      })
      try {
        const res = await fetch('/api/marketing-planung', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            produkt_id: produktId,
            kategorie_id: kategorieId,
            kw_year: kw.year,
            kw_number: kw.week,
            marketingkosten_pct_manuell: value,
            ist_manuell: true,
          }),
        })
        if (!res.ok) throw new Error()
      } catch {
        setStoredMarketingPct(prev => {
          const next = new Map(prev)
          if (existing !== undefined) next.set(key, existing)
          else next.delete(key)
          return next
        })
        throw new Error('Speichern fehlgeschlagen')
      }
    },
    [storedMarketingPct],
  )

  const upsertBatch = useCallback(
    async (
      updates: Array<{
        produktId: string
        kategorieId: string
        kw: PlanungsWoche
        value: number
      }>,
    ): Promise<void> => {
      const rollback = new Map<string, { value: number; ist_manuell: boolean } | undefined>()
      setStoredMarketingPct(prev => {
        const next = new Map(prev)
        for (const u of updates) {
          const key = mktPctKey(u.produktId, u.kategorieId, u.kw.year, u.kw.week)
          rollback.set(key, prev.get(key))
          next.set(key, { value: u.value, ist_manuell: true })
        }
        return next
      })
      try {
        await Promise.all(
          updates.map(u =>
            fetch('/api/marketing-planung', {
              method: 'PUT',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                produkt_id: u.produktId,
                kategorie_id: u.kategorieId,
                kw_year: u.kw.year,
                kw_number: u.kw.week,
                marketingkosten_pct_manuell: u.value,
                ist_manuell: true,
              }),
            }).then(r => { if (!r.ok) throw new Error() }),
          ),
        )
      } catch {
        setStoredMarketingPct(prev => {
          const next = new Map(prev)
          for (const [key, old] of rollback) {
            if (old !== undefined) next.set(key, old)
            else next.delete(key)
          }
          return next
        })
        throw new Error('Batch-Speichern fehlgeschlagen')
      }
    },
    [],
  )

  const resetMarketingPctToCalc = useCallback(
    async (
      cells: Array<{ produktId: string; kategorieId: string; kw: PlanungsWoche }>,
    ): Promise<void> => {
      const rollback = new Map<string, { value: number; ist_manuell: boolean } | undefined>()
      setStoredMarketingPct(prev => {
        const next = new Map(prev)
        for (const c of cells) {
          const key = mktPctKey(c.produktId, c.kategorieId, c.kw.year, c.kw.week)
          rollback.set(key, prev.get(key))
          next.delete(key)
        }
        return next
      })
      try {
        await Promise.all(
          cells.map(c =>
            fetch('/api/marketing-planung', {
              method: 'PUT',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                produkt_id: c.produktId,
                kategorie_id: c.kategorieId,
                kw_year: c.kw.year,
                kw_number: c.kw.week,
                marketingkosten_pct_manuell: null,
              }),
            }).then(r => { if (!r.ok) throw new Error() }),
          ),
        )
      } catch {
        setStoredMarketingPct(prev => {
          const next = new Map(prev)
          for (const [key, old] of rollback) {
            if (old !== undefined) next.set(key, old)
            else next.delete(key)
          }
          return next
        })
        throw new Error('Zurücksetzen fehlgeschlagen')
      }
    },
    [],
  )

  const resetAll = useCallback(async (): Promise<void> => {
    const snapshot = new Map(storedMarketingPct)
    setStoredMarketingPct(new Map())
    try {
      const res = await fetch('/api/marketing-planung', { method: 'DELETE' })
      if (!res.ok) throw new Error()
    } catch {
      setStoredMarketingPct(snapshot)
      throw new Error('Zurücksetzen fehlgeschlagen')
    }
  }, [storedMarketingPct])

  const refreshHistorisch = useCallback(async (filterProduktIds?: string[]): Promise<void> => {
    setIsRefreshing(true)
    try {
      const [histSkuData, histMktData] = await Promise.all([
        fetch('/api/absatz-planung/historisch-sku').then(r => (r.ok ? r.json() : { data: [] })),
        fetch('/api/marketing-planung/historisch').then(r => (r.ok ? r.json() : [])),
      ])

      const freshHistSkuMap = new Map<string, number>()
      for (const h of (histSkuData?.data ?? []) as HistorischSkuWert[]) {
        freshHistSkuMap.set(`${h.sku_id}:${h.sales_plattform_id}`, h.tagesdurchschnitt)
      }
      setHistorischeSkuWerte(freshHistSkuMap)

      const freshMktHistMap = new Map<string, number>()
      for (const h of (Array.isArray(histMktData) ? histMktData : (histMktData?.data ?? [])) as HistorischMarketingPct[]) {
        freshMktHistMap.set(mktHistKey(h.produkt_id, h.kategorie_id), h.marketingkosten_pct)
      }
      setHistorischeMarketingPct(freshMktHistMap)

      const rowsToInit: Array<{
        produkt_id: string
        kategorie_id: string
        kw_year: number
        kw_number: number
        marketingkosten_pct_manuell: number
      }> = []

      for (const kombi of aktiveKombis) {
        const colonIdx   = kombi.indexOf(':')
        const kategorieId = kombi.slice(0, colonIdx)
        const produktId  = kombi.slice(colonIdx + 1)
        if (filterProduktIds && !filterProduktIds.includes(produktId)) continue
        const histPct = freshMktHistMap.get(mktHistKey(produktId, kategorieId)) ?? 0

        for (const kw of wochen) {
          const key = mktPctKey(produktId, kategorieId, kw.year, kw.week)
          if (storedMarketingPct.get(key)?.ist_manuell === true) continue
          rowsToInit.push({
            produkt_id: produktId,
            kategorie_id: kategorieId,
            kw_year: kw.year,
            kw_number: kw.week,
            marketingkosten_pct_manuell: histPct,
          })
        }
      }

      if (rowsToInit.length > 0) {
        const res = await fetch('/api/marketing-planung/init-defaults', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ rows: rowsToInit }),
        })
        if (!res.ok) throw new Error('Init-Defaults fehlgeschlagen')

        setStoredMarketingPct(prev => {
          const next = new Map(prev)
          for (const r of rowsToInit) {
            const key = mktPctKey(r.produkt_id, r.kategorie_id, r.kw_year, r.kw_number)
            next.set(key, { value: r.marketingkosten_pct_manuell, ist_manuell: false })
          }
          return next
        })
      }
    } catch {
      throw new Error('Aktualisierung fehlgeschlagen')
    } finally {
      setIsRefreshing(false)
    }
  }, [aktiveKombis, storedMarketingPct, wochen])

  return {
    wochen,
    marketingUntergruppen,
    produkte,
    skusByProdukt,
    aktiveKombis,
    loading,
    error,
    isNewWeek,
    lastWoche,
    getAbsatzForKategorie,
    getVKForKategorie,
    getUmsatzForKategorie,
    getKategoriePlattformId,
    getKategoriePlattformLabel,
    getMarketingPct,
    upsertMarketingPct,
    upsertBatch,
    resetMarketingPctToCalc,
    resetAll,
    isRefreshing,
    refreshHistorisch,
  }
}
