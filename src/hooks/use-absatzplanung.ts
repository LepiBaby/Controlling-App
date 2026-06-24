'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import { addWeeks, getISOWeek, getISOWeekYear, startOfISOWeek } from 'date-fns'
import type { KpiCategory } from '@/hooks/use-kpi-categories'

// ─── Types ───────────────────────────────────────────────────────────────────

export interface PlanungsWoche {
  year: number
  week: number
  label: string // "KW24 / 2026"
}

export interface HistorischSkuWert {
  sku_id: string
  produkt_id: string
  sales_plattform_id: string
  tagesdurchschnitt: number
  berechnungsart: string
}

interface StoredAbsatzEntry {
  value: number
  ist_manuell: boolean
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

export function berechnePlanungswochen(horizont: number): PlanungsWoche[] {
  const today = new Date()
  const wochen: PlanungsWoche[] = []
  for (let i = 0; i < horizont; i++) {
    const d = addWeeks(startOfISOWeek(today), i)
    const week = getISOWeek(d)
    const year = getISOWeekYear(d)
    wochen.push({
      year,
      week,
      label: `KW${String(week).padStart(2, '0')} / ${year}`,
    })
  }
  return wochen
}

// Key for SKU absatz manual entry: sku:${skuId}:${plattformId}:${year}:${week}
export function skuAbsatzKey(skuId: string, plattformId: string, year: number, week: number): string {
  return `sku:${skuId}:${plattformId}:${year}:${week}`
}

// Key for product VK manual entry: vk:${produktId}:${plattformId}:${year}:${week}
export function produktVKKey(produktId: string, plattformId: string, year: number, week: number): string {
  return `vk:${produktId}:${plattformId}:${year}:${week}`
}

export function kwKey(year: number, week: number): string {
  return `${year}:${week}`
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function useAbsatzplanung() {
  const [planungshorizont, setPlanungshorizont] = useState(13)
  const [plattformen, setPlattformen] = useState<KpiCategory[]>([])
  const [produkte, setProdukte] = useState<KpiCategory[]>([])
  const [skusByProdukt, setSkusByProdukt] = useState<Map<string, KpiCategory[]>>(new Map())
  // Set of "plattformId:produktId" where berechnungsart !== 'keine'
  const [aktiveKombis, setAktiveKombis] = useState<Set<string>>(new Set())
  // key: "${skuId}:${plattformId}" → tagesdurchschnitt (daily)
  const [historischeSkuWerte, setHistorischeSkuWerte] = useState<Map<string, number>>(new Map())
  // key: skuAbsatzKey(...) → { value, ist_manuell }
  const [storedSkuAbsatz, setStoredSkuAbsatz] = useState<Map<string, StoredAbsatzEntry>>(new Map())
  // key: produktVKKey(...) → effektiver_vk_manuell value
  const [manuelleVK, setManuelleVK] = useState<Map<string, number | null>>(new Map())
  // key: skuId → { aktueller_bestand, ankunft_per_week: Map<"year:week", menge> }
  const [bestandSnapshot, setBestandSnapshot] = useState<Map<string, { aktueller_bestand: number; ankunft_per_week: Map<string, number> }>>(new Map())
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [isRefreshing, setIsRefreshing] = useState(false)

  const wochen = useMemo(
    () => berechnePlanungswochen(planungshorizont),
    [planungshorizont],
  )

  useEffect(() => {
    setLoading(true)
    setError(null)

    Promise.all([
      fetch('/api/grundeinstellungen').then(r => (r.ok ? r.json() : { planungshorizont_wochen: 13 })),
      fetch('/api/kpi-categories?type=sales_plattformen').then(r => r.ok ? r.json() : []),
      fetch('/api/kpi-categories?type=produkte').then(r => (r.ok ? r.json() : [])),
      fetch('/api/absatz-planung/historisch-sku').then(r => r.ok ? r.json() : { data: [] }),
      fetch('/api/absatz-planung').then(r => (r.ok ? r.json() : { data: [] })),
    ])
      .then(([grundData, plattRaw, prodRaw, histSkuData, manData]) => {
        const horizont: number =
          grundData?.planungshorizont_absatz_wochen ?? grundData?.planungshorizont_wochen ?? 13
        setPlanungshorizont(horizont)

        const plattList = (Array.isArray(plattRaw) ? plattRaw : []) as KpiCategory[]
        const allProdukte = (Array.isArray(prodRaw) ? prodRaw : []) as KpiCategory[]
        const prodList = allProdukte.filter(c => c.level === 1)
        const skuList = allProdukte.filter(c => c.level === 2)

        setPlattformen(plattList)
        setProdukte(prodList)

        // Build skusByProdukt map
        const skuMap = new Map<string, KpiCategory[]>()
        for (const sku of skuList) {
          const parentId = sku.parent_id as string | null
          if (!parentId) continue
          if (!skuMap.has(parentId)) skuMap.set(parentId, [])
          skuMap.get(parentId)!.push(sku)
        }
        setSkusByProdukt(skuMap)

        // Historical SKU values: key = "skuId:plattformId"
        const histMap = new Map<string, number>()
        for (const h of (histSkuData?.data ?? []) as HistorischSkuWert[]) {
          histMap.set(`${h.sku_id}:${h.sales_plattform_id}`, h.tagesdurchschnitt)
        }
        setHistorischeSkuWerte(histMap)

        // Stored values — split into SKU absatz and product VK
        const absatzMap = new Map<string, StoredAbsatzEntry>()
        const vkMap = new Map<string, number | null>()
        for (const m of (manData?.data ?? []) as {
          sku_id: string | null
          produkt_id: string
          sales_plattform_id: string
          kw_year: number
          kw_number: number
          absatz_manuell: number | null
          effektiver_vk_manuell: number | null
          ist_manuell: boolean
        }[]) {
          if (m.sku_id !== null && m.absatz_manuell !== null) {
            absatzMap.set(
              skuAbsatzKey(m.sku_id, m.sales_plattform_id, m.kw_year, m.kw_number),
              { value: m.absatz_manuell, ist_manuell: m.ist_manuell },
            )
          }
          if (m.sku_id === null && m.effektiver_vk_manuell !== null) {
            vkMap.set(produktVKKey(m.produkt_id, m.sales_plattform_id, m.kw_year, m.kw_number), m.effektiver_vk_manuell)
          }
        }
        setStoredSkuAbsatz(absatzMap)
        setManuelleVK(vkMap)

        const lbFetches = prodList.map(prd =>
          fetch(`/api/bestellplanung/lagerbestand-verlauf?produkt_id=${prd.id}`)
            .then(r => r.ok ? r.json() : { wochen: [], skus: [] })
            .catch(() => ({ wochen: [], skus: [] })),
        )

        const einstellFetches = plattList.map(plt =>
          fetch(`/api/absatz-einstellungen?plattform_id=${plt.id}`).then(r =>
            r.ok ? r.json() : [],
          ),
        )

        return Promise.all([Promise.all(lbFetches), Promise.all(einstellFetches)])
      })
      .then(([lbDataArray, einstellArrays]) => {
        // Bestand-Snapshot aus lagerbestand-verlauf (bewährter Endpunkt)
        const snapMap = new Map<string, { aktueller_bestand: number; ankunft_per_week: Map<string, number> }>()
        for (const lbData of lbDataArray as Array<{
          wochen: Array<{ kw: number; jahr: number; ist_prognose: boolean }>
          skus: Array<{
            sku_id: string
            verlauf: Array<{ kw: number; jahr: number; bestand_vorher: number; ankunft: number; ist_prognose: boolean }>
          }>
        }>) {
          const firstForecastWeek = (lbData.wochen ?? []).find(w => w.ist_prognose)
          if (!firstForecastWeek) continue
          for (const sku of (lbData.skus ?? [])) {
            const verlauf = sku.verlauf ?? []
            const currentVerlauf = verlauf.find(v => v.kw === firstForecastWeek.kw && v.jahr === firstForecastWeek.jahr)
            const ankunft_per_week = new Map<string, number>()
            for (const v of verlauf) {
              if (v.ist_prognose && v.ankunft > 0) {
                ankunft_per_week.set(`${v.jahr}:${v.kw}`, v.ankunft)
              }
            }
            snapMap.set(sku.sku_id, {
              aktueller_bestand: currentVerlauf?.bestand_vorher ?? 0,
              ankunft_per_week,
            })
          }
        }
        setBestandSnapshot(snapMap)

        const kombis = new Set<string>()
        for (const list of einstellArrays) {
          for (const e of Array.isArray(list) ? list : (list?.data ?? [])) {
            if (e.berechnungsart && e.berechnungsart !== 'keine') {
              kombis.add(`${e.sales_plattform_id}:${e.produkt_id}`)
            }
          }
        }
        setAktiveKombis(kombis)
        setLoading(false)
      })
      .catch(() => {
        setError('Fehler beim Laden der Absatzplanung.')
        setLoading(false)
      })
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // ─── Selectors ──────────────────────────────────────────────────────────────

  const getSkuAbsatz = useCallback(
    (skuId: string, plattformId: string, kw: PlanungsWoche): { value: number; isManual: boolean } => {
      const key = skuAbsatzKey(skuId, plattformId, kw.year, kw.week)
      const stored = storedSkuAbsatz.get(key)
      if (stored !== undefined) return { value: stored.value, isManual: stored.ist_manuell }
      const hist = historischeSkuWerte.get(`${skuId}:${plattformId}`)
      return { value: hist !== undefined ? Math.round(hist * 7 * 100) / 100 : 0, isManual: false }
    },
    [storedSkuAbsatz, historischeSkuWerte],
  )

  const getProductAbsatz = useCallback(
    (produktId: string, plattformId: string, kw: PlanungsWoche): number => {
      const skus = skusByProdukt.get(produktId) ?? []
      return Math.round(skus.reduce((sum, sku) => sum + getSkuAbsatz(sku.id, plattformId, kw).value, 0) * 100) / 100
    },
    [skusByProdukt, getSkuAbsatz],
  )

  const getVK = useCallback(
    (produktId: string, plattformId: string, kw: PlanungsWoche): { value: number | null; isManual: boolean } => {
      const key = produktVKKey(produktId, plattformId, kw.year, kw.week)
      const m = manuelleVK.get(key)
      if (m !== undefined && m !== null) return { value: m, isManual: true }
      return { value: null, isManual: false }
    },
    [manuelleVK],
  )

  // ─── Rollierender Lagerbestand pro SKU pro Woche ────────────────────────────

  const bestandVerlauf = useMemo((): Map<string, Map<string, { vorher: number; nachher: number }>> => {
    const result = new Map<string, Map<string, { vorher: number; nachher: number }>>()

    for (const [produktId, skuList] of skusByProdukt) {
      for (const sku of skuList) {
        const snap = bestandSnapshot.get(sku.id)
        let running = snap?.aktueller_bestand ?? 0

        const kwMap = new Map<string, { vorher: number; nachher: number }>()
        for (const kw of wochen) {
          const kwk = `${kw.year}:${kw.week}`
          const incoming = snap?.ankunft_per_week.get(kwk) ?? 0

          let totalAbsatz = 0
          for (const plt of plattformen) {
            if (!aktiveKombis.has(`${plt.id}:${produktId}`)) continue
            const key = skuAbsatzKey(sku.id, plt.id, kw.year, kw.week)
            const stored = storedSkuAbsatz.get(key)
            if (stored !== undefined) {
              totalAbsatz += stored.value
            } else {
              const hist = historischeSkuWerte.get(`${sku.id}:${plt.id}`)
              totalAbsatz += hist !== undefined ? Math.round(hist * 7 * 100) / 100 : 0
            }
          }

          const vorher = Math.round(running)
          const rawNachher = running + incoming - totalAbsatz
          const nachher = Math.round(Math.max(0, rawNachher))
          kwMap.set(kwk, { vorher, nachher })
          running = Math.max(0, rawNachher)
        }

        result.set(sku.id, kwMap)
      }
    }

    return result
  }, [bestandSnapshot, skusByProdukt, wochen, plattformen, aktiveKombis, storedSkuAbsatz, historischeSkuWerte])

  const getBestandVerlauf = useCallback(
    (skuId: string, kw: PlanungsWoche): { vorher: number; nachher: number } | null =>
      bestandVerlauf.get(skuId)?.get(`${kw.year}:${kw.week}`) ?? null,
    [bestandVerlauf],
  )

  const getAnkunft = useCallback(
    (skuId: string, kw: PlanungsWoche): number =>
      bestandSnapshot.get(skuId)?.ankunft_per_week.get(`${kw.year}:${kw.week}`) ?? 0,
    [bestandSnapshot],
  )

  const lastWoche = wochen[wochen.length - 1]
  const isNewWeek = useMemo(() => {
    if (!lastWoche) return false
    for (const key of storedSkuAbsatz.keys()) {
      if (key.includes(`:${lastWoche.year}:${lastWoche.week}`)) return false
    }
    return true
  }, [lastWoche, storedSkuAbsatz])

  // ─── Mutations ──────────────────────────────────────────────────────────────

  const upsertSkuAbsatz = useCallback(
    async (
      skuId: string,
      produktId: string,
      plattformId: string,
      kw: PlanungsWoche,
      value: number | null,
    ): Promise<void> => {
      const key = skuAbsatzKey(skuId, plattformId, kw.year, kw.week)
      const existing = storedSkuAbsatz.get(key)
      if (value !== null) {
        setStoredSkuAbsatz(prev => new Map(prev).set(key, { value, ist_manuell: true }))
      } else {
        setStoredSkuAbsatz(prev => { const n = new Map(prev); n.delete(key); return n })
      }
      try {
        const res = await fetch('/api/absatz-planung', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            sku_id: skuId,
            produkt_id: produktId,
            sales_plattform_id: plattformId,
            kw_year: kw.year,
            kw_number: kw.week,
            absatz_manuell: value,
            effektiver_vk_manuell: null,
            ist_manuell: true,
          }),
        })
        if (!res.ok) throw new Error()
      } catch {
        setStoredSkuAbsatz(prev => {
          const next = new Map(prev)
          if (existing !== undefined) next.set(key, existing)
          else next.delete(key)
          return next
        })
        throw new Error('Speichern fehlgeschlagen')
      }
    },
    [storedSkuAbsatz],
  )

  const upsertVK = useCallback(
    async (
      produktId: string,
      plattformId: string,
      kw: PlanungsWoche,
      value: number | null,
    ): Promise<void> => {
      const key = produktVKKey(produktId, plattformId, kw.year, kw.week)
      const existing = manuelleVK.get(key)
      setManuelleVK(prev => new Map(prev).set(key, value))
      try {
        const res = await fetch('/api/absatz-planung', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            sku_id: null,
            produkt_id: produktId,
            sales_plattform_id: plattformId,
            kw_year: kw.year,
            kw_number: kw.week,
            absatz_manuell: null,
            effektiver_vk_manuell: value,
            ist_manuell: true,
          }),
        })
        if (!res.ok) throw new Error()
      } catch {
        setManuelleVK(prev => {
          const next = new Map(prev)
          if (existing !== undefined) next.set(key, existing)
          else next.delete(key)
          return next
        })
        throw new Error('Speichern fehlgeschlagen')
      }
    },
    [manuelleVK],
  )

  const upsertBatch = useCallback(
    async (
      updates: Array<{
        skuId?: string
        produktId: string
        plattformId: string
        kw: PlanungsWoche
        field: 'absatz' | 'vk'
        value: number
      }>,
    ): Promise<void> => {
      const absatzUpdates = updates.filter(u => u.field === 'absatz' && u.skuId)
      const vkUpdates = updates.filter(u => u.field === 'vk')

      const absatzRollback = new Map<string, StoredAbsatzEntry | undefined>()
      const vkRollback = new Map<string, number | null | undefined>()

      if (absatzUpdates.length > 0) {
        setStoredSkuAbsatz(prev => {
          const next = new Map(prev)
          for (const u of absatzUpdates) {
            const key = skuAbsatzKey(u.skuId!, u.plattformId, u.kw.year, u.kw.week)
            absatzRollback.set(key, prev.get(key))
            next.set(key, { value: u.value, ist_manuell: true })
          }
          return next
        })
      }

      if (vkUpdates.length > 0) {
        setManuelleVK(prev => {
          const next = new Map(prev)
          for (const u of vkUpdates) {
            const key = produktVKKey(u.produktId, u.plattformId, u.kw.year, u.kw.week)
            vkRollback.set(key, prev.get(key))
            next.set(key, u.value)
          }
          return next
        })
      }

      try {
        await Promise.all(
          updates.map(u =>
            fetch('/api/absatz-planung', {
              method: 'PUT',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                sku_id: u.field === 'absatz' ? (u.skuId ?? null) : null,
                produkt_id: u.produktId,
                sales_plattform_id: u.plattformId,
                kw_year: u.kw.year,
                kw_number: u.kw.week,
                absatz_manuell: u.field === 'absatz' ? u.value : null,
                effektiver_vk_manuell: u.field === 'vk' ? u.value : null,
                ist_manuell: true,
              }),
            }).then(r => { if (!r.ok) throw new Error() }),
          ),
        )
      } catch {
        if (absatzUpdates.length > 0) {
          setStoredSkuAbsatz(prev => {
            const next = new Map(prev)
            for (const [key, old] of absatzRollback) {
              if (old !== undefined) next.set(key, old)
              else next.delete(key)
            }
            return next
          })
        }
        if (vkUpdates.length > 0) {
          setManuelleVK(prev => {
            const next = new Map(prev)
            for (const [key, old] of vkRollback) {
              if (old !== undefined) next.set(key, old)
              else next.delete(key)
            }
            return next
          })
        }
        throw new Error('Batch-Speichern fehlgeschlagen')
      }
    },
    [storedSkuAbsatz, manuelleVK],
  )

  // Reset selected SKU absatz cells back to calculation method
  const resetSkuAbsatzToCalc = useCallback(
    async (
      cells: Array<{ skuId: string; produktId: string; plattformId: string; kw: PlanungsWoche }>,
    ): Promise<void> => {
      const updates = cells.map(c => {
        const tagesdurchschnitt = historischeSkuWerte.get(`${c.skuId}:${c.plattformId}`) ?? 0
        const calcValue = Math.round(tagesdurchschnitt * 7 * 100) / 100
        return { ...c, calcValue }
      })

      const rollback = new Map<string, StoredAbsatzEntry | undefined>()
      setStoredSkuAbsatz(prev => {
        const next = new Map(prev)
        for (const u of updates) {
          const key = skuAbsatzKey(u.skuId, u.plattformId, u.kw.year, u.kw.week)
          rollback.set(key, prev.get(key))
          next.set(key, { value: u.calcValue, ist_manuell: false })
        }
        return next
      })

      try {
        await Promise.all(
          updates.map(u =>
            fetch('/api/absatz-planung', {
              method: 'PUT',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                sku_id: u.skuId,
                produkt_id: u.produktId,
                sales_plattform_id: u.plattformId,
                kw_year: u.kw.year,
                kw_number: u.kw.week,
                absatz_manuell: u.calcValue,
                effektiver_vk_manuell: null,
                ist_manuell: false,
              }),
            }).then(r => { if (!r.ok) throw new Error() }),
          ),
        )
      } catch {
        setStoredSkuAbsatz(prev => {
          const next = new Map(prev)
          for (const [key, old] of rollback) {
            if (old !== undefined) next.set(key, old)
            else next.delete(key)
          }
          return next
        })
        throw new Error('Zurücksetzen auf Berechnungsmethode fehlgeschlagen')
      }
    },
    [historischeSkuWerte],
  )

  const resetAll = useCallback(async (): Promise<void> => {
    const snapshot = new Map(storedSkuAbsatz)
    setStoredSkuAbsatz(new Map())
    try {
      const res = await fetch('/api/absatz-planung?field=absatz', { method: 'DELETE' })
      if (!res.ok) throw new Error()
    } catch {
      setStoredSkuAbsatz(snapshot)
      throw new Error('Zurücksetzen fehlgeschlagen')
    }
  }, [storedSkuAbsatz])

  const refreshAutomatischWerte = useCallback(async (filterProduktIds?: string[]): Promise<void> => {
    setIsRefreshing(true)
    try {
      // Fetch fresh historical data directly — do not rely on cached state
      const histSkuData = await fetch('/api/absatz-planung/historisch-sku').then(r =>
        r.ok ? r.json() : { data: [] },
      )
      const freshHistMap = new Map<string, number>()
      for (const h of (histSkuData?.data ?? []) as HistorischSkuWert[]) {
        freshHistMap.set(`${h.sku_id}:${h.sales_plattform_id}`, h.tagesdurchschnitt)
      }
      setHistorischeSkuWerte(freshHistMap)

      const currentWochen = berechnePlanungswochen(planungshorizont)
      const rowsToInit: Array<{
        sku_id: string
        produkt_id: string
        sales_plattform_id: string
        kw_year: number
        kw_number: number
        absatz_manuell: number
      }> = []

      for (const kombi of aktiveKombis) {
        const colonIdx = kombi.indexOf(':')
        const plattformId = kombi.slice(0, colonIdx)
        const produktId = kombi.slice(colonIdx + 1)
        if (filterProduktIds && !filterProduktIds.includes(produktId)) continue
        const skus = skusByProdukt.get(produktId) ?? []
        for (const sku of skus) {
          const tagesdurchschnitt = freshHistMap.get(`${sku.id}:${plattformId}`)
          if (tagesdurchschnitt === undefined) continue
          const wochenabsatz = Math.round(tagesdurchschnitt * 7 * 100) / 100
          for (const woche of currentWochen) {
            const key = skuAbsatzKey(sku.id, plattformId, woche.year, woche.week)
            const stored = storedSkuAbsatz.get(key)
            if (stored?.ist_manuell === true) continue
            rowsToInit.push({
              sku_id: sku.id,
              produkt_id: produktId,
              sales_plattform_id: plattformId,
              kw_year: woche.year,
              kw_number: woche.week,
              absatz_manuell: wochenabsatz,
            })
          }
        }
      }

      if (rowsToInit.length > 0) {
        const res = await fetch('/api/absatz-planung/init-defaults', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ rows: rowsToInit }),
        })
        if (!res.ok) throw new Error()
        setStoredSkuAbsatz(prev => {
          const next = new Map(prev)
          for (const r of rowsToInit) {
            const key = skuAbsatzKey(r.sku_id, r.sales_plattform_id, r.kw_year, r.kw_number)
            next.set(key, { value: r.absatz_manuell, ist_manuell: false })
          }
          return next
        })
      }
    } catch {
      throw new Error('Aktualisierung fehlgeschlagen')
    } finally {
      setIsRefreshing(false)
    }
  }, [aktiveKombis, planungshorizont, skusByProdukt, storedSkuAbsatz])

  return {
    wochen,
    plattformen,
    produkte,
    skusByProdukt,
    aktiveKombis,
    loading,
    error,
    isNewWeek,
    lastWoche,
    getSkuAbsatz,
    getProductAbsatz,
    getVK,
    getBestandVerlauf,
    getAnkunft,
    upsertSkuAbsatz,
    upsertVK,
    upsertBatch,
    resetSkuAbsatzToCalc,
    resetAll,
    isRefreshing,
    refreshAutomatischWerte,
  }
}
