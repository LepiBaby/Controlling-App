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

export interface HistorischerWert {
  produkt_id: string
  sales_plattform_id: string
  tagesdurchschnitt: number
}

export interface ManuellerWert {
  produkt_id: string
  sales_plattform_id: string
  kw_year: number
  kw_number: number
  absatz_manuell: number | null
  effektiver_vk_manuell: number | null
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

export function berechnePlanungswochen(horizont: number): PlanungsWoche[] {
  const today = new Date()
  const wochen: PlanungsWoche[] = []
  for (let i = 1; i <= horizont; i++) {
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

export function historischKey(produktId: string, plattformId: string): string {
  return `${produktId}:${plattformId}`
}

export function manuellerKey(
  produktId: string,
  plattformId: string,
  year: number,
  week: number,
): string {
  return `${produktId}:${plattformId}:${year}:${week}`
}

export function kwKey(year: number, week: number): string {
  return `${year}:${week}`
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function useAbsatzplanung() {
  const [planungshorizont, setPlanungshorizont] = useState(13)
  const [plattformen, setPlattformen] = useState<KpiCategory[]>([])
  const [produkte, setProdukte] = useState<KpiCategory[]>([])
  // Set of "plattformId:produktId" where berechnungsart !== 'keine'
  const [aktiveKombis, setAktiveKombis] = useState<Set<string>>(new Set())
  const [historischeWerte, setHistorischeWerte] = useState<Map<string, number>>(new Map())
  const [manuelleWerte, setManuelleWerte] = useState<Map<string, ManuellerWert>>(new Map())
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const wochen = useMemo(
    () => berechnePlanungswochen(planungshorizont),
    [planungshorizont],
  )

  useEffect(() => {
    setLoading(true)
    setError(null)

    // Phase 1: load static data
    Promise.all([
      fetch('/api/grundeinstellungen').then(r => (r.ok ? r.json() : { planungshorizont_wochen: 13 })),
      fetch('/api/kpi-categories?type=sales_plattformen').then(r =>
        r.ok ? r.json() : [],
      ),
      fetch('/api/kpi-categories?type=produkte').then(r => (r.ok ? r.json() : [])),
      fetch('/api/absatz-planung/historisch').then(r =>
        r.ok ? r.json() : { data: [] },
      ),
      fetch('/api/absatz-planung').then(r => (r.ok ? r.json() : { data: [] })),
    ])
      .then(([grundData, plattRaw, prodRaw, histData, manData]) => {
        const horizont: number = grundData?.planungshorizont_wochen ?? 13
        setPlanungshorizont(horizont)

        const plattList = (Array.isArray(plattRaw) ? plattRaw : []) as KpiCategory[]
        const prodList = (Array.isArray(prodRaw) ? prodRaw : []).filter(
          (c: KpiCategory) => c.level === 1,
        ) as KpiCategory[]

        setPlattformen(plattList)
        setProdukte(prodList)

        // Historical
        const histMap = new Map<string, number>()
        for (const h of (histData?.data ?? []) as HistorischerWert[]) {
          histMap.set(historischKey(h.produkt_id, h.sales_plattform_id), h.tagesdurchschnitt)
        }
        setHistorischeWerte(histMap)

        // Manual
        const manMap = new Map<string, ManuellerWert>()
        for (const m of (manData?.data ?? []) as ManuellerWert[]) {
          manMap.set(manuellerKey(m.produkt_id, m.sales_plattform_id, m.kw_year, m.kw_number), m)
        }
        setManuelleWerte(manMap)

        // Phase 2: load einstellungen for each platform
        return Promise.all(
          plattList.map(plt =>
            fetch(`/api/absatz-einstellungen?plattform_id=${plt.id}`).then(r =>
              r.ok ? r.json() : [],
            ),
          ),
        )
      })
      .then(einstellArrays => {
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

  const getAbsatz = useCallback(
    (
      produktId: string,
      plattformId: string,
      kw: PlanungsWoche,
    ): { value: number; isManual: boolean } => {
      const key = manuellerKey(produktId, plattformId, kw.year, kw.week)
      const m = manuelleWerte.get(key)
      if (m && m.absatz_manuell !== null) return { value: m.absatz_manuell, isManual: true }
      const hist = historischeWerte.get(historischKey(produktId, plattformId))
      return { value: hist ?? 0, isManual: false }
    },
    [manuelleWerte, historischeWerte],
  )

  const getVK = useCallback(
    (
      produktId: string,
      plattformId: string,
      kw: PlanungsWoche,
    ): { value: number | null; isManual: boolean } => {
      const key = manuellerKey(produktId, plattformId, kw.year, kw.week)
      const m = manuelleWerte.get(key)
      if (m && m.effektiver_vk_manuell !== null)
        return { value: m.effektiver_vk_manuell, isManual: true }
      return { value: null, isManual: false }
    },
    [manuelleWerte],
  )

  // Last week is "new" if no manual entries exist for it
  const lastWoche = wochen[wochen.length - 1]
  const isNewWeek = useMemo(() => {
    if (!lastWoche) return false
    for (const key of manuelleWerte.keys()) {
      if (key.includes(`:${lastWoche.year}:${lastWoche.week}`)) return false
    }
    return true
  }, [lastWoche, manuelleWerte])

  // ─── Mutations ──────────────────────────────────────────────────────────────

  const upsertZelle = useCallback(
    async (
      produktId: string,
      plattformId: string,
      kw: PlanungsWoche,
      field: 'absatz' | 'vk',
      value: number | null,
    ): Promise<void> => {
      const key = manuellerKey(produktId, plattformId, kw.year, kw.week)
      const existing = manuelleWerte.get(key)

      const updated: ManuellerWert = {
        produkt_id: produktId,
        sales_plattform_id: plattformId,
        kw_year: kw.year,
        kw_number: kw.week,
        absatz_manuell: field === 'absatz' ? value : (existing?.absatz_manuell ?? null),
        effektiver_vk_manuell:
          field === 'vk' ? value : (existing?.effektiver_vk_manuell ?? null),
      }

      setManuelleWerte(prev => new Map(prev).set(key, updated))

      try {
        const res = await fetch('/api/absatz-planung', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            produkt_id: produktId,
            sales_plattform_id: plattformId,
            kw_year: kw.year,
            kw_number: kw.week,
            absatz_manuell: updated.absatz_manuell,
            effektiver_vk_manuell: updated.effektiver_vk_manuell,
          }),
        })
        if (!res.ok) throw new Error()
      } catch {
        setManuelleWerte(prev => {
          const next = new Map(prev)
          if (existing) next.set(key, existing)
          else next.delete(key)
          return next
        })
        throw new Error('Speichern fehlgeschlagen')
      }
    },
    [manuelleWerte],
  )

  const upsertBatch = useCallback(
    async (
      updates: Array<{
        produktId: string
        plattformId: string
        kw: PlanungsWoche
        field: 'absatz' | 'vk'
        value: number
      }>,
    ): Promise<void> => {
      // Optimistic batch update
      const rollbackMap = new Map<string, ManuellerWert | undefined>()
      setManuelleWerte(prev => {
        const next = new Map(prev)
        for (const u of updates) {
          const key = manuellerKey(u.produktId, u.plattformId, u.kw.year, u.kw.week)
          rollbackMap.set(key, prev.get(key))
          const existing = prev.get(key)
          next.set(key, {
            produkt_id: u.produktId,
            sales_plattform_id: u.plattformId,
            kw_year: u.kw.year,
            kw_number: u.kw.week,
            absatz_manuell:
              u.field === 'absatz' ? u.value : (existing?.absatz_manuell ?? null),
            effektiver_vk_manuell:
              u.field === 'vk' ? u.value : (existing?.effektiver_vk_manuell ?? null),
          })
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
                produkt_id: u.produktId,
                sales_plattform_id: u.plattformId,
                kw_year: u.kw.year,
                kw_number: u.kw.week,
                absatz_manuell: u.field === 'absatz' ? u.value : null,
                effektiver_vk_manuell: u.field === 'vk' ? u.value : null,
              }),
            }).then(r => { if (!r.ok) throw new Error() }),
          ),
        )
      } catch {
        setManuelleWerte(prev => {
          const next = new Map(prev)
          for (const [key, old] of rollbackMap) {
            if (old) next.set(key, old)
            else next.delete(key)
          }
          return next
        })
        throw new Error('Batch-Speichern fehlgeschlagen')
      }
    },
    [manuelleWerte],
  )

  const resetAll = useCallback(async (): Promise<void> => {
    const snapshot = new Map(manuelleWerte)
    setManuelleWerte(new Map())
    try {
      const res = await fetch('/api/absatz-planung', { method: 'DELETE' })
      if (!res.ok) throw new Error()
    } catch {
      setManuelleWerte(snapshot)
      throw new Error('Zurücksetzen fehlgeschlagen')
    }
  }, [manuelleWerte])

  return {
    wochen,
    plattformen,
    produkte,
    aktiveKombis,
    loading,
    error,
    isNewWeek,
    lastWoche,
    getAbsatz,
    getVK,
    upsertZelle,
    upsertBatch,
    resetAll,
  }
}
