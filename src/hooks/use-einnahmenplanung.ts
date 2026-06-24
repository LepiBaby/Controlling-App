'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import { addWeeks, subWeeks, getISOWeek, getISOWeekYear, startOfISOWeek } from 'date-fns'
import type { KpiCategory } from '@/hooks/use-kpi-categories'

export type { PlanungsWoche } from '@/hooks/use-absatzplanung'
import type { PlanungsWoche } from '@/hooks/use-absatzplanung'

// key: "${kategorieId}:${year}:${week}"
export function kategorieWertKey(kategorieId: string, year: number, week: number): string {
  return `${kategorieId}:${year}:${week}`
}

export function istProduktverkaufe(name: string): boolean {
  return name.trim().toLowerCase() === 'produktverkäufe'
}

function berechneVergangenheitswochen(horizont: number, referenceDate?: Date): PlanungsWoche[] {
  const today = referenceDate ?? new Date()
  const result: PlanungsWoche[] = []
  for (let i = horizont; i >= 1; i--) {
    const d = startOfISOWeek(subWeeks(today, i))
    const week = getISOWeek(d)
    const year = getISOWeekYear(d)
    result.push({ year, week, label: `KW${String(week).padStart(2, '0')} / ${year}` })
  }
  return result
}

function berechneZukunftswochen(horizont: number, referenceDate?: Date): PlanungsWoche[] {
  const today = referenceDate ?? new Date()
  const result: PlanungsWoche[] = []
  for (let i = 0; i < horizont; i++) {
    const d = startOfISOWeek(addWeeks(today, i))
    const week = getISOWeek(d)
    const year = getISOWeekYear(d)
    result.push({ year, week, label: `KW${String(week).padStart(2, '0')} / ${year}` })
  }
  return result
}

export interface EinnahmenPlanungEntry {
  kategorie_id: string
  kw_year: number
  kw_number: number
  betrag_manuell: number | null
}

interface IstTatsaechlichEntry {
  kategorie_id: string
  kw_year: number
  kw_number: number
  betrag: number
}

interface ProduktverkaeufeSollEntry {
  kw_year: number
  kw_number: number
  sales_plattform_id: string
  wert: number
}

export function useEinnahmenplanung(referenceDate?: Date) {
  const [vergangenheitswochen, setVergangenheitswochen] = useState<PlanungsWoche[]>([])
  const [zukunftswochen, setZukunftswochen] = useState<PlanungsWoche[]>([])
  const [kategorien, setKategorien] = useState<KpiCategory[]>([])
  const [produktverkaeufenKatId, setProduktverkaeufenKatId] = useState<string | null>(null)
  const [values, setValues] = useState<Map<string, number | null>>(new Map())
  const [istTatsaechlichMap, setIstTatsaechlichMap] = useState<Map<string, number>>(new Map())
  const [produktverkaeufeSollMap, setProduktverkaeufeSollMap] = useState<Map<string, number>>(new Map())
  const [plattformen, setPlattformen] = useState<KpiCategory[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Alias for backward compat and as the "future weeks" for planning
  const wochen = zukunftswochen
  const lastWoche = wochen[wochen.length - 1] as PlanungsWoche | undefined

  const vergangenheitSet = useMemo(() => {
    const s = new Set<string>()
    for (const w of vergangenheitswochen) s.add(`${w.year}:${w.week}`)
    return s
  }, [vergangenheitswochen])

  useEffect(() => {
    async function load() {
      setLoading(true)
      setError(null)
      try {
        // Phase 1: load horizons so we can compute the past week range for ist-tatsaechlich
        const grundData = await fetch('/api/grundeinstellungen').then(r =>
          r.ok ? r.json() : {}
        ) as { planungshorizont_wochen?: number; vergangenheitshorizont_wochen?: number } | null

        const planungsHorizont = grundData?.planungshorizont_wochen ?? 13
        const vergangenheitsHorizont = grundData?.vergangenheitshorizont_wochen ?? 4

        const vWochen = berechneVergangenheitswochen(vergangenheitsHorizont, referenceDate)
        const zWochen = berechneZukunftswochen(planungsHorizont, referenceDate)
        setVergangenheitswochen(vWochen)
        setZukunftswochen(zWochen)

        // Phase 2a: fetch produktverkaeufe-berechnet first — the API persists Soll values
        // to DB as a side-effect; we must wait for it before loading einnahmen-planung
        // so that Ist-Plan values (= saved Soll) are present in the DB response.
        const istParams = vWochen.length > 0
          ? `?von_kw=${vWochen[0].week}&von_jahr=${vWochen[0].year}&bis_kw=${vWochen[vWochen.length - 1].week}&bis_jahr=${vWochen[vWochen.length - 1].year}`
          : null

        const [katRaw, istRaw, pvRaw, pltRaw] = await Promise.all([
          fetch('/api/kpi-categories?type=einnahmen').then(r => r.ok ? r.json() : []),
          istParams
            ? fetch(`/api/einnahmen-planung/ist-tatsaechlich${istParams}`).then(r => r.ok ? r.json() : [])
            : Promise.resolve([]),
          fetch(`/api/einnahmen-planung/produktverkaeufe-berechnet?vergangenheit_horizont=${vergangenheitsHorizont}`).then(r => r.ok ? r.json() : []),
          fetch('/api/kpi-categories?type=sales_plattformen').then(r => r.ok ? r.json() : []),
        ])

        // Phase 2b: now load manual values — DB now contains freshly persisted Soll values
        const valRaw = await fetch('/api/einnahmen-planung').then(r => r.ok ? r.json() : [])

        // All categories, including Produktverkäufe
        const allKats = (Array.isArray(katRaw) ? katRaw : []) as KpiCategory[]
        const pvKat = allKats.find(k => k.level === 1 && istProduktverkaufe(k.name))
        const pvKatId = pvKat?.id ?? null
        setProduktverkaeufenKatId(pvKatId)
        setKategorien(allKats.filter(k => k.level === 1 || k.level === 2))

        // Manual values — used for both Ist-Plan (past) and Soll-Manuell (future)
        const entries = (Array.isArray(valRaw) ? valRaw : (valRaw?.data ?? [])) as EinnahmenPlanungEntry[]
        const valueMap = new Map<string, number | null>()
        for (const e of entries) {
          if (e.betrag_manuell !== null) {
            valueMap.set(kategorieWertKey(e.kategorie_id, e.kw_year, e.kw_number), e.betrag_manuell)
          }
        }

        // Ist-Tatsächlich from einnahmen_transaktionen (past weeks only)
        const istEntries = (Array.isArray(istRaw) ? istRaw : []) as IstTatsaechlichEntry[]
        const istMap = new Map<string, number>()
        for (const e of istEntries) {
          istMap.set(kategorieWertKey(e.kategorie_id, e.kw_year, e.kw_number), e.betrag)
        }
        setIstTatsaechlichMap(istMap)

        // Auto-calculated Produktverkäufe soll — only keep entries for displayed weeks
        // (vWochen for Ist-Plan, zWochen for Soll). Older weeks are excluded to prevent
        // phantom Ist-Plan values from payment-timing shifts based on historical data.
        const allowedWeeks = new Set([...vWochen, ...zWochen].map(kw => `${kw.year}:${kw.week}`))
        const pvEntries = (Array.isArray(pvRaw) ? pvRaw : []) as ProduktverkaeufeSollEntry[]
        const pvMap = new Map<string, number>()
        for (const e of pvEntries) {
          if (allowedWeeks.has(`${e.kw_year}:${e.kw_number}`)) {
            pvMap.set(`${e.kw_year}:${e.kw_number}:${e.sales_plattform_id}`, e.wert)
          }
        }
        setProduktverkaeufeSollMap(pvMap)

        // Sales platforms (level 1 only, sorted)
        const allPlatt = (Array.isArray(pltRaw) ? pltRaw : []) as KpiCategory[]
        setPlattformen(allPlatt.filter(k => k.level === 1).sort((a, b) => a.sort_order - b.sort_order))

        if (pvKatId) {
          // For FUTURE weeks (zWochen): remove auto-saved DB entries from valueMap so
          // the Soll column shows grey (auto-computed), not blue (manual).
          // This covers both the pvKatId total and per-platform (Amazon/Otto) entries.
          for (const kw of zWochen) {
            const prefix = `${kw.year}:${kw.week}:`
            const hasAutoForWeek = [...pvMap.keys()].some(k => k.startsWith(prefix))
            if (!hasAutoForWeek) continue

            // Remove pvKatId total
            valueMap.delete(kategorieWertKey(pvKatId, kw.year, kw.week))

            // Remove per-platform entries
            for (const plt of allPlatt) {
              if (pvMap.has(`${kw.year}:${kw.week}:${plt.id}`)) {
                valueMap.delete(kategorieWertKey(plt.id, kw.year, kw.week))
              }
            }
          }
        }

        setValues(valueMap)
      } catch {
        setError('Fehler beim Laden der Einnahmenplanung.')
      } finally {
        setLoading(false)
      }
    }

    load()
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // For backward compat: isNewWeek checks last zukunftswoche
  const isNewWeek = useMemo(() => {
    if (!lastWoche) return false
    const suffix = `:${lastWoche.year}:${lastWoche.week}`
    for (const key of values.keys()) {
      if (key.endsWith(suffix)) return false
    }
    return true
  }, [lastWoche, values])

  const getWert = useCallback(
    (kategorieId: string, kw: PlanungsWoche): number | null => {
      const v = values.get(kategorieWertKey(kategorieId, kw.year, kw.week))
      return v !== undefined ? v : null
    },
    [values],
  )

  const getIstTatsaechlich = useCallback(
    (kategorieId: string, kw: PlanungsWoche): number | null => {
      const v = istTatsaechlichMap.get(kategorieWertKey(kategorieId, kw.year, kw.week))
      return v !== undefined ? v : null
    },
    [istTatsaechlichMap],
  )

  // Ist-Plan = manual entry only. No auto-calc fallback for past weeks — pvMap is Soll-only.
  const getIstPlan = useCallback(
    (kategorieId: string, kw: PlanungsWoche): number | null => getWert(kategorieId, kw),
    [getWert],
  )

  const getProduktverkaeufeSoll = useCallback(
    (kw: PlanungsWoche, plattformId?: string): number | null => {
      if (plattformId) {
        const v = produktverkaeufeSollMap.get(`${kw.year}:${kw.week}:${plattformId}`)
        return v !== undefined ? v : null
      }
      // Total: sum across all platforms for this week
      const prefix = `${kw.year}:${kw.week}:`
      let total = 0
      let found = false
      for (const [key, v] of produktverkaeufeSollMap) {
        if (key.startsWith(prefix)) { total += v; found = true }
      }
      return found ? total : null
    },
    [produktverkaeufeSollMap],
  )

  const isManuelleOverride = useCallback(
    (kategorieId: string, kw: PlanungsWoche): boolean =>
      values.has(kategorieWertKey(kategorieId, kw.year, kw.week)),
    [values],
  )

  const upsertZelle = useCallback(
    async (kategorieId: string, kw: PlanungsWoche, value: number | null): Promise<void> => {
      const key = kategorieWertKey(kategorieId, kw.year, kw.week)
      const existing = values.get(key)
      setValues(prev => {
        const next = new Map(prev)
        if (value === null) next.delete(key)
        else next.set(key, value)
        return next
      })
      try {
        const res = await fetch('/api/einnahmen-planung', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            kategorie_id: kategorieId,
            kw_year: kw.year,
            kw_number: kw.week,
            betrag_manuell: value,
          }),
        })
        if (!res.ok) throw new Error()
      } catch {
        setValues(prev => {
          const next = new Map(prev)
          if (existing !== undefined) next.set(key, existing)
          else next.delete(key)
          return next
        })
        throw new Error('Speichern fehlgeschlagen')
      }
    },
    [values],
  )

  const resetAll = useCallback(async (): Promise<void> => {
    const firstFuture = zukunftswochen[0]
    const snapshot = new Map(values)
    // Only clear future-week entries from local state — past entries are Ist-Plan values
    setValues(prev => {
      const next = new Map(prev)
      for (const key of next.keys()) {
        const parts = key.split(':')
        const yr = Number(parts[parts.length - 2])
        const wk = Number(parts[parts.length - 1])
        if (!firstFuture || yr > firstFuture.year || (yr === firstFuture.year && wk >= firstFuture.week)) {
          next.delete(key)
        }
      }
      return next
    })
    try {
      const params = firstFuture
        ? `?ab_kw_year=${firstFuture.year}&ab_kw_number=${firstFuture.week}`
        : ''
      const res = await fetch(`/api/einnahmen-planung${params}`, { method: 'DELETE' })
      if (!res.ok) throw new Error()
    } catch {
      setValues(snapshot)
      throw new Error('Zurücksetzen fehlgeschlagen')
    }
  }, [values, zukunftswochen])

  return {
    vergangenheitswochen,
    zukunftswochen,
    wochen,
    lastWoche,
    vergangenheitSet,
    kategorien,
    plattformen,
    produktverkaeufenKatId,
    values,
    istTatsaechlichMap,
    produktverkaeufeSollMap,
    loading,
    error,
    isNewWeek,
    getWert,
    getIstTatsaechlich,
    getIstPlan,
    getProduktverkaeufeSoll,
    isManuelleOverride,
    upsertZelle,
    resetAll,
  }
}
