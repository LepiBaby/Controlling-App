'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import { berechnePlanungswochen } from '@/hooks/use-absatzplanung'
import type { PlanungsWoche } from '@/hooks/use-absatzplanung'
import type { KpiCategory } from '@/hooks/use-kpi-categories'

export type { PlanungsWoche } from '@/hooks/use-absatzplanung'

// key: "${kategorieId}:${year}:${week}"
export function kategorieWertKey(kategorieId: string, year: number, week: number): string {
  return `${kategorieId}:${year}:${week}`
}

function istProduktinvestitionenKnoten(name: string): boolean {
  return name.trim().toLowerCase() === 'produktinvestitionen'
}

export interface ProduktinvestitionsPlanungEntry {
  kategorie_id: string
  kw_year: number
  kw_number: number
  betrag_manuell: number | null
}

export function useProduktinvestitionsplanung() {
  const [planungshorizont, setPlanungshorizont] = useState(13)
  const [kategorien, setKategorien] = useState<KpiCategory[]>([])
  const [values, setValues] = useState<Map<string, number | null>>(new Map())
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const wochen = useMemo(() => berechnePlanungswochen(planungshorizont), [planungshorizont])
  const lastWoche = wochen[wochen.length - 1] as PlanungsWoche | undefined

  useEffect(() => {
    setLoading(true)
    setError(null)

    Promise.all([
      fetch('/api/grundeinstellungen').then(r => (r.ok ? r.json() : { planungshorizont_wochen: 13 })),
      fetch('/api/kpi-categories?type=ausgaben_kosten').then(r => (r.ok ? r.json() : [])),
      fetch('/api/produktinvestitions-planung').then(r => (r.ok ? r.json() : [])),
    ])
      .then(([grundData, katRaw, valRaw]) => {
        setPlanungshorizont(grundData?.planungshorizont_wochen ?? 13)

        const allKats = (Array.isArray(katRaw) ? katRaw : []) as KpiCategory[]

        // Find the "Produktinvestitionen" node(s)
        const produktinvestitionenIds = new Set(
          allKats.filter(k => istProduktinvestitionenKnoten(k.name)).map(k => k.id),
        )

        // L1 = direct children of a "Produktinvestitionen" node
        const l1Ids = new Set(
          allKats
            .filter(k => k.parent_id != null && produktinvestitionenIds.has(k.parent_id))
            .map(k => k.id),
        )

        // Keep L1 + their L2 children
        const filtered = allKats.filter(k => {
          if (k.parent_id != null && produktinvestitionenIds.has(k.parent_id)) return true // L1
          if (k.parent_id != null && l1Ids.has(k.parent_id)) return true                   // L2
          return false
        })
        setKategorien(filtered)

        const entries = (Array.isArray(valRaw) ? valRaw : (valRaw?.data ?? [])) as ProduktinvestitionsPlanungEntry[]
        const valueMap = new Map<string, number | null>()
        for (const e of entries) {
          if (e.betrag_manuell !== null) {
            valueMap.set(kategorieWertKey(e.kategorie_id, e.kw_year, e.kw_number), e.betrag_manuell)
          }
        }
        setValues(valueMap)
        setLoading(false)
      })
      .catch(() => {
        setError('Fehler beim Laden der Produktinvestitionsplanung.')
        setLoading(false)
      })
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

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
        const res = await fetch('/api/produktinvestitions-planung', {
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

  return {
    wochen,
    lastWoche,
    kategorien,
    values,
    loading,
    error,
    isNewWeek,
    getWert,
    upsertZelle,
  }
}
