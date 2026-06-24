'use client'

import { useState, useEffect, useCallback } from 'react'
import { addWeeks, subWeeks, getISOWeek, getISOWeekYear, startOfISOWeek } from 'date-fns'
import type { KpiCategory } from '@/hooks/use-kpi-categories'
import type { PlanungsWoche } from '@/hooks/use-absatzplanung'

export type { PlanungsWoche }

// key: "${kategorieId}:${year}:${week}"
export function wertKey(kategorieId: string, year: number, week: number): string {
  return `${kategorieId}:${year}:${week}`
}

function berechneVergangenheitswochen(horizont: number, ref?: Date): PlanungsWoche[] {
  const today = ref ?? new Date()
  const result: PlanungsWoche[] = []
  for (let i = horizont; i >= 1; i--) {
    const d = startOfISOWeek(subWeeks(today, i))
    const week = getISOWeek(d)
    const year = getISOWeekYear(d)
    result.push({ year, week, label: `KW${String(week).padStart(2, '0')} / ${year}` })
  }
  return result
}

function berechneZukunftswochen(horizont: number, ref?: Date): PlanungsWoche[] {
  const today = ref ?? new Date()
  const result: PlanungsWoche[] = []
  for (let i = 0; i < horizont; i++) {
    const d = startOfISOWeek(addWeeks(today, i))
    const week = getISOWeek(d)
    const year = getISOWeekYear(d)
    result.push({ year, week, label: `KW${String(week).padStart(2, '0')} / ${year}` })
  }
  return result
}

interface ManuellerEintrag {
  kategorie_id: string
  kw_year: number
  kw_number: number
  betrag_manuell: number | null
  ist_berechnet: boolean | null
}

interface IstTatsaechlichEintrag {
  kategorie_id: string
  kw_year: number
  kw_number: number
  betrag: number
}

interface BerechneterEintrag {
  kategorie_id: string
  kw_year: number
  kw_number: number
  wert: number
}

export function useOperativeAusgaben(referenceDate?: Date) {
  const [vergangenheitswochen, setVergangenheitswochen] = useState<PlanungsWoche[]>([])
  const [zukunftswochen, setZukunftswochen] = useState<PlanungsWoche[]>([])
  const [kategorien, setKategorien] = useState<KpiCategory[]>([])
  const [values, setValues] = useState<Map<string, number | null>>(new Map())
  const [istTatsaechlichMap, setIstTatsaechlichMap] = useState<Map<string, number>>(new Map())
  const [berechneteWerte, setBerechneteWerte] = useState<Map<string, number>>(new Map())
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

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

        // Phase 2a: berechnet for ALL weeks (past + future) with erste_zukunftskw so route
        // persists future Soll values to DB as ist_berechnet=true (Ist-Plan anchor)
        const allWochen = [...vWochen, ...zWochen]
        const ersteZukunft = zWochen[0]
        const berParams = allWochen.length > 0
          ? `?von_kw=${allWochen[0].week}&von_jahr=${allWochen[0].year}&bis_kw=${allWochen[allWochen.length - 1].week}&bis_jahr=${allWochen[allWochen.length - 1].year}${ersteZukunft ? `&erste_zukunftskw=${ersteZukunft.week}&erste_zukunftsjahr=${ersteZukunft.year}` : ''}`
          : null

        const [katRaw, istRaw, berRaw] = await Promise.all([
          fetch('/api/kpi-categories?type=ausgaben_kosten').then(r => r.ok ? r.json() : []),
          istParams
            ? fetch(`/api/operative-planung/ist-tatsaechlich${istParams}`).then(r => r.ok ? r.json() : { data: [] })
            : Promise.resolve({ data: [] }),
          berParams
            ? fetch(`/api/operative-planung/berechnet${berParams}`).then(r => r.ok ? r.json() : { data: [] })
            : Promise.resolve({ data: [] }),
        ])

        // Phase 2b: load manual values AFTER berechnet persisted future Soll to DB
        const valRaw = await fetch('/api/operative-planung').then(r => r.ok ? r.json() : [])

        const allKats = (Array.isArray(katRaw) ? katRaw : []) as KpiCategory[]
        const operativRoot = allKats.find(k => k.name.trim().toLowerCase() === 'operativ')
        const operativId = operativRoot?.id ?? null
        const l1Ids = new Set(
          operativId
            ? allKats.filter(k => k.parent_id === operativId).map(k => k.id)
            : [],
        )
        const filtered = allKats.filter(k =>
          (operativId !== null && k.parent_id === operativId) ||
          (k.parent_id != null && l1Ids.has(k.parent_id)),
        )
        setKategorien(filtered)

        const entries = (Array.isArray(valRaw) ? valRaw : (valRaw?.data ?? [])) as ManuellerEintrag[]
        const valueMap = new Map<string, number | null>()
        for (const e of entries) {
          if (e.betrag_manuell !== null) {
            valueMap.set(wertKey(e.kategorie_id, e.kw_year, e.kw_number), e.betrag_manuell)
          }
        }

        // Remove future auto-calc entries from valueMap so they show gray (from berechneteWerte).
        // Past auto-calc entries stay → they're the frozen Ist-Plan.
        const futureWeekSet = new Set(zWochen.map(kw => `${kw.year}:${kw.week}`))
        for (const e of entries) {
          if (!futureWeekSet.has(`${e.kw_year}:${e.kw_number}`)) continue
          if (e.ist_berechnet === false) continue  // user manually entered → keep as blue
          valueMap.delete(wertKey(e.kategorie_id, e.kw_year, e.kw_number))
        }

        setValues(valueMap)

        const istEntries = (Array.isArray(istRaw) ? istRaw : (istRaw?.data ?? [])) as IstTatsaechlichEintrag[]
        const istMap = new Map<string, number>()
        for (const e of istEntries) {
          istMap.set(wertKey(e.kategorie_id, e.kw_year, e.kw_number), e.betrag)
        }
        setIstTatsaechlichMap(istMap)

        const berEntries = (Array.isArray(berRaw) ? berRaw : (berRaw?.data ?? [])) as BerechneterEintrag[]
        const berMap = new Map<string, number>()
        for (const e of berEntries) {
          berMap.set(wertKey(e.kategorie_id, e.kw_year, e.kw_number), e.wert)
        }
        setBerechneteWerte(berMap)
      } catch {
        setError('Fehler beim Laden der Operativen Ausgaben.')
      } finally {
        setLoading(false)
      }
    }
    load()
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const getManuellerWert = useCallback(
    (kategorieId: string, kw: PlanungsWoche): number | null => {
      const v = values.get(wertKey(kategorieId, kw.year, kw.week))
      return v !== undefined ? v : null
    },
    [values],
  )

  const getIstTatsaechlich = useCallback(
    (kategorieId: string, kw: PlanungsWoche): number | null => {
      const v = istTatsaechlichMap.get(wertKey(kategorieId, kw.year, kw.week))
      return v !== undefined ? v : null
    },
    [istTatsaechlichMap],
  )

  const getBerechneterWert = useCallback(
    (kategorieId: string, kw: PlanungsWoche): number | null => {
      const v = berechneteWerte.get(wertKey(kategorieId, kw.year, kw.week))
      return v !== undefined ? v : null
    },
    [berechneteWerte],
  )

  // For past KW: Ist-Plan = the saved manual plan from operative_planung
  const getIstPlan = useCallback(
    (kategorieId: string, kw: PlanungsWoche): number | null =>
      getManuellerWert(kategorieId, kw),
    [getManuellerWert],
  )

  const upsertZelle = useCallback(
    async (kategorieId: string, kw: PlanungsWoche, value: number | null): Promise<void> => {
      const key = wertKey(kategorieId, kw.year, kw.week)
      const existing = values.get(key)
      setValues(prev => {
        const next = new Map(prev)
        if (value === null) next.delete(key)
        else next.set(key, value)
        return next
      })
      try {
        const res = await fetch('/api/operative-planung', {
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
      const res = await fetch(`/api/operative-planung${params}`, { method: 'DELETE' })
      if (!res.ok) throw new Error()
    } catch {
      setValues(snapshot)
      throw new Error('Zurücksetzen fehlgeschlagen')
    }
    if (vergangenheitswochen.length > 0 || zukunftswochen.length > 0) {
      const allWochen = [...vergangenheitswochen, ...zukunftswochen]
      const ersteZukunft = zukunftswochen[0]
      const berParams = `?von_kw=${allWochen[0].week}&von_jahr=${allWochen[0].year}&bis_kw=${allWochen[allWochen.length - 1].week}&bis_jahr=${allWochen[allWochen.length - 1].year}${ersteZukunft ? `&erste_zukunftskw=${ersteZukunft.week}&erste_zukunftsjahr=${ersteZukunft.year}` : ''}`
      fetch(`/api/operative-planung/berechnet${berParams}`)
        .then(r => r.ok ? r.json() : { data: [] })
        .then((raw: unknown) => {
          const data = ((raw as { data?: BerechneterEintrag[] })?.data ?? [])
          const berMap = new Map<string, number>()
          for (const e of data) berMap.set(wertKey(e.kategorie_id, e.kw_year, e.kw_number), e.wert)
          setBerechneteWerte(berMap)
        })
        .catch(() => {})
    }
  }, [values, zukunftswochen, vergangenheitswochen])

  return {
    vergangenheitswochen,
    zukunftswochen,
    kategorien,
    values,
    istTatsaechlichMap,
    berechneteWerte,
    loading,
    error,
    getManuellerWert,
    getIstTatsaechlich,
    getIstPlan,
    getBerechneterWert,
    upsertZelle,
    resetAll,
  }
}
