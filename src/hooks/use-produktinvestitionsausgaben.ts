'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import { addWeeks, subWeeks, getISOWeek, getISOWeekYear, startOfISOWeek } from 'date-fns'
import type { KpiCategory } from '@/hooks/use-kpi-categories'
import type { PlanungsWoche } from '@/hooks/use-absatzplanung'

export type { PlanungsWoche }

// key: "${kategorieId}:${year}:${week}"
export function piAusgabenWertKey(kategorieId: string, year: number, week: number): string {
  return `${kategorieId}:${year}:${week}`
}

function istProduktinvestitionenKnoten(name: string): boolean {
  return name.trim().toLowerCase() === 'produktinvestitionen'
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

interface PlanungsEintrag {
  kategorie_id: string
  kw_year: number
  kw_number: number
  betrag_manuell: number | null
}

interface IstTatsaechlichEintrag {
  kategorie_id: string
  kw_year: number
  kw_number: number
  betrag: number
}

export function useProduktinvestitionsausgaben(referenceDate?: Date) {
  const [vergangenheitswochen, setVergangenheitswochen] = useState<PlanungsWoche[]>([])
  const [zukunftswochen, setZukunftswochen] = useState<PlanungsWoche[]>([])
  const [kategorien, setKategorien] = useState<KpiCategory[]>([])
  // values: both past (→ Ist-Plan) and future (→ Soll-manuell) entries from produktinvestitions_planung
  const [values, setValues] = useState<Map<string, number | null>>(new Map())
  const [istTatsaechlichMap, setIstTatsaechlichMap] = useState<Map<string, number>>(new Map())
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const lastWoche = zukunftswochen[zukunftswochen.length - 1] as PlanungsWoche | undefined

  // isNewWeek: the last future week has no values → highlight as new
  const isNewWeek = useMemo(() => {
    if (!lastWoche) return false
    const suffix = `:${lastWoche.year}:${lastWoche.week}`
    for (const key of values.keys()) {
      if (key.endsWith(suffix)) return false
    }
    return true
  }, [lastWoche, values])

  useEffect(() => {
    async function load() {
      setLoading(true)
      setError(null)
      try {
        const grundData = await fetch('/api/grundeinstellungen').then(r =>
          r.ok ? r.json() : {},
        ) as { planungshorizont_wochen?: number; vergangenheitshorizont_wochen?: number } | null

        const planungsHorizont = grundData?.planungshorizont_wochen ?? 13
        const vergangenheitsHorizont = grundData?.vergangenheitshorizont_wochen ?? 4

        const vWochen = berechneVergangenheitswochen(vergangenheitsHorizont, referenceDate)
        const zWochen = berechneZukunftswochen(planungsHorizont, referenceDate)
        setVergangenheitswochen(vWochen)
        setZukunftswochen(zWochen)

        const istParams = vWochen.length > 0
          ? `?von_kw=${vWochen[0].week}&von_jahr=${vWochen[0].year}&bis_kw=${vWochen[vWochen.length - 1].week}&bis_jahr=${vWochen[vWochen.length - 1].year}`
          : null

        const [katRaw, valRaw, istRaw] = await Promise.all([
          fetch('/api/kpi-categories?type=ausgaben_kosten').then(r => r.ok ? r.json() : []),
          fetch('/api/produktinvestitions-planung').then(r => r.ok ? r.json() : []),
          istParams
            ? fetch(`/api/produktinvestitions-planung/ist-tatsaechlich${istParams}`).then(r => r.ok ? r.json() : { data: [] })
            : Promise.resolve({ data: [] }),
        ])

        // Filter KPI categories to the "Produktinvestitionen" subtree
        const allKats = (Array.isArray(katRaw) ? katRaw : []) as KpiCategory[]
        const produktinvestitionenIds = new Set(
          allKats.filter(k => istProduktinvestitionenKnoten(k.name)).map(k => k.id),
        )
        const l1Ids = new Set(
          allKats
            .filter(k => k.parent_id != null && produktinvestitionenIds.has(k.parent_id))
            .map(k => k.id),
        )
        const filtered = allKats.filter(k => {
          if (k.parent_id != null && produktinvestitionenIds.has(k.parent_id)) return true // L1
          if (k.parent_id != null && l1Ids.has(k.parent_id)) return true                   // L2
          return false
        })
        setKategorien(filtered)

        // Build values map — all entries (past = Ist-Plan, future = Soll-manuell)
        const entries = (Array.isArray(valRaw) ? valRaw : (valRaw?.data ?? [])) as PlanungsEintrag[]
        const valueMap = new Map<string, number | null>()
        for (const e of entries) {
          if (e.betrag_manuell !== null) {
            valueMap.set(piAusgabenWertKey(e.kategorie_id, e.kw_year, e.kw_number), e.betrag_manuell)
          }
        }
        setValues(valueMap)

        // Build Ist-Tatsächlich map — aggregate by (kategorie_id, kw_year, kw_number)
        const istEntries = (Array.isArray(istRaw) ? istRaw : (istRaw?.data ?? [])) as IstTatsaechlichEintrag[]
        const istMap = new Map<string, number>()
        for (const e of istEntries) {
          const key = piAusgabenWertKey(e.kategorie_id, e.kw_year, e.kw_number)
          istMap.set(key, (istMap.get(key) ?? 0) + e.betrag)
        }
        setIstTatsaechlichMap(istMap)

      } catch {
        setError('Fehler beim Laden der Produktinvestitionsausgaben.')
      } finally {
        setLoading(false)
      }
    }
    load()
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const getIstTatsaechlich = useCallback(
    (kategorieId: string, kw: PlanungsWoche): number | null => {
      const v = istTatsaechlichMap.get(piAusgabenWertKey(kategorieId, kw.year, kw.week))
      return v !== undefined ? v : null
    },
    [istTatsaechlichMap],
  )

  // Used for both Ist-Plan (past weeks) and Soll-manuell (future weeks) — same underlying map
  const getWert = useCallback(
    (kategorieId: string, kw: PlanungsWoche): number | null => {
      const v = values.get(piAusgabenWertKey(kategorieId, kw.year, kw.week))
      return v !== undefined ? v : null
    },
    [values],
  )

  // Returns true if there is a manual entry in the values map for this category + KW (future = blue dot)
  const isManuelleOverride = useCallback(
    (kategorieId: string, kw: PlanungsWoche): boolean =>
      values.has(piAusgabenWertKey(kategorieId, kw.year, kw.week)),
    [values],
  )

  const upsertZelle = useCallback(
    async (kategorieId: string, kw: PlanungsWoche, value: number | null): Promise<void> => {
      const key = piAusgabenWertKey(kategorieId, kw.year, kw.week)
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
    vergangenheitswochen,
    zukunftswochen,
    lastWoche,
    kategorien,
    values,
    istTatsaechlichMap,
    loading,
    error,
    isNewWeek,
    getIstTatsaechlich,
    getWert,
    isManuelleOverride,
    upsertZelle,
  }
}
