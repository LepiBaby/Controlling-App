'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import { addWeeks, subWeeks, getISOWeek, getISOWeekYear, startOfISOWeek } from 'date-fns'
import type { KpiCategory } from '@/hooks/use-kpi-categories'
import type { PlanungsWoche } from '@/hooks/use-absatzplanung'

export type { PlanungsWoche }

// key: "${kategorieId}:${produktId ?? ''}:${year}:${week}"
export function wertKey(
  kategorieId: string,
  produktId: string | null,
  year: number,
  week: number,
): string {
  return `${kategorieId}:${produktId ?? ''}:${year}:${week}`
}

// key: "${kategorieId}:${produktId ?? ''}:${year}:${week}"
export function istTKey(kategorieId: string, produktId: string | null, year: number, week: number): string {
  return `${kategorieId}:${produktId ?? ''}:${year}:${week}`
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

interface ManuellerEintrag {
  kategorie_id: string
  produkt_id: string | null
  kw_year: number
  kw_number: number
  betrag_manuell: number | null
  ist_berechnet: boolean | null
}

interface IstTatsaechlichEintrag {
  kategorie_id: string
  produkt_id: string | null
  kw_year: number
  kw_number: number
  betrag: number
}

interface BerechneterEintrag {
  kategorie_id: string
  produkt_id: string
  kw_year: number
  kw_number: number
  wert: number
}

export function useUmsatzausgaben(referenceDate?: Date) {
  const [vergangenheitswochen, setVergangenheitswochen] = useState<PlanungsWoche[]>([])
  const [zukunftswochen, setZukunftswochen] = useState<PlanungsWoche[]>([])
  const [kategorien, setKategorien] = useState<KpiCategory[]>([])
  const [produkte, setProdukte] = useState<KpiCategory[]>([])
  const [values, setValues] = useState<Map<string, number | null>>(new Map())
  const [istTatsaechlichMap, setIstTatsaechlichMap] = useState<Map<string, number>>(new Map())
  const [berechneteWerte, setBerechneteWerte] = useState<Map<string, number>>(new Map())
  // Set of L2-kategorie IDs that have any berechnet data (→ show products under them)
  const [katIdsWithProducts, setKatIdsWithProducts] = useState<Set<string>>(new Set())
  // Set of L2-kategorie IDs that appear in ist-tatsaechlich data
  const [istTatsaechlichKatIds, setIstTatsaechlichKatIds] = useState<Set<string>>(new Set())
  // Marketing L2 IDs that are NOT assigned to any sales platform (should be shown in Umsatzausgaben)
  const [unassignedMarketingL2Ids, setUnassignedMarketingL2Ids] = useState<Set<string> | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const lastWoche = zukunftswochen[zukunftswochen.length - 1] as PlanungsWoche | undefined

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

        // Fetch berechnet for all weeks (past + future) so that Versand/Lager/etc. L2 IDs
        // appear in katIdsWithProducts even when absatz planning only exists in past weeks
        const allWochen = [...vWochen, ...zWochen]
        const ersteZukunft = zWochen[0]
        const berParams = allWochen.length > 0
          ? `?von_kw=${allWochen[0].week}&von_jahr=${allWochen[0].year}&bis_kw=${allWochen[allWochen.length - 1].week}&bis_jahr=${allWochen[allWochen.length - 1].year}${ersteZukunft ? `&erste_zukunftskw=${ersteZukunft.week}&erste_zukunftsjahr=${ersteZukunft.year}` : ''}`
          : null

        // Phase 2a: Load berechnet first — the API persists past-week Soll values
        // to DB as a side-effect; we must wait for it before loading umsatzausgaben-planung
        // so that Ist-Plan values (= saved Soll) are present in the DB response.
        const [katRaw, prodRaw, istRaw, berRaw] = await Promise.all([
          fetch('/api/kpi-categories?type=ausgaben_kosten').then(r => r.ok ? r.json() : []),
          fetch('/api/kpi-categories?type=produkte').then(r => r.ok ? r.json() : []),
          istParams
            ? fetch(`/api/umsatzausgaben-planung/ist-tatsaechlich${istParams}`).then(r => r.ok ? r.json() : { data: [] })
            : Promise.resolve({ data: [] }),
          berParams
            ? fetch(`/api/umsatzausgaben-planung/berechnet${berParams}`).then(r => r.ok ? r.json() : { data: [] })
            : Promise.resolve({ data: [] }),
        ])

        // Phase 2b: Now load manual values — DB now contains freshly persisted past-week Soll values
        const valRaw = await fetch('/api/umsatzausgaben-planung').then(r => r.ok ? r.json() : { data: [] })

        setKategorien((Array.isArray(katRaw) ? katRaw : []) as KpiCategory[])
        const allProdukte = (Array.isArray(prodRaw) ? prodRaw : []) as KpiCategory[]
        setProdukte(allProdukte.filter(p => p.level === 1).sort((a, b) => a.sort_order - b.sort_order))

        const entries = (Array.isArray(valRaw) ? valRaw : (valRaw?.data ?? [])) as ManuellerEintrag[]
        const valueMap = new Map<string, number | null>()
        for (const e of entries) {
          if (e.betrag_manuell !== null) {
            valueMap.set(wertKey(e.kategorie_id, e.produkt_id, e.kw_year, e.kw_number), e.betrag_manuell)
          }
        }

        const istEntries = (Array.isArray(istRaw) ? istRaw : (istRaw?.data ?? [])) as IstTatsaechlichEintrag[]
        const istMap = new Map<string, number>()
        const istKatIds = new Set<string>()
        for (const e of istEntries) {
          istMap.set(istTKey(e.kategorie_id, e.produkt_id, e.kw_year, e.kw_number), e.betrag)
          istKatIds.add(e.kategorie_id)
        }
        setIstTatsaechlichMap(istMap)
        setIstTatsaechlichKatIds(istKatIds)

        const berEntries = (Array.isArray(berRaw) ? berRaw : (berRaw?.data ?? [])) as BerechneterEintrag[]
        const berMap = new Map<string, number>()
        const withProducts = new Set<string>()
        for (const e of berEntries) {
          berMap.set(wertKey(e.kategorie_id, e.produkt_id, e.kw_year, e.kw_number), e.wert)
          withProducts.add(e.kategorie_id)
        }
        // Also detect per-product L2 categories from manual values
        for (const e of entries) {
          if (e.produkt_id !== null) withProducts.add(e.kategorie_id)
        }
        setBerechneteWerte(berMap)
        setKatIdsWithProducts(withProducts)
        const unassignedMktIds = new Set<string>((berRaw?.unassigned_marketing_kat_ids ?? []) as string[])
        setUnassignedMarketingL2Ids(unassignedMktIds)

        // For FUTURE weeks: remove auto-calculated entries from valueMap so they show grey
        // (from berechneteWerte), not blue (as if manually entered).
        // Uses the ist_berechnet flag: true/null = auto-calc (remove), false = user manual (keep).
        // Past weeks are skipped so their values remain available as Ist-Plan.
        const futureWeekSet = new Set(zWochen.map(kw => `${kw.year}:${kw.week}`))
        for (const e of entries) {
          if (!futureWeekSet.has(`${e.kw_year}:${e.kw_number}`)) continue
          if (e.ist_berechnet === false) continue  // user manually entered → keep as blue
          const key = wertKey(e.kategorie_id, e.produkt_id, e.kw_year, e.kw_number)
          valueMap.delete(key)
        }

        setValues(valueMap)
      } catch {
        setError('Fehler beim Laden der Umsatzausgaben.')
      } finally {
        setLoading(false)
      }
    }
    load()
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const getManuellerWert = useCallback(
    (kategorieId: string, produktId: string | null, kw: PlanungsWoche): number | null => {
      const v = values.get(wertKey(kategorieId, produktId, kw.year, kw.week))
      return v !== undefined ? v : null
    },
    [values],
  )

  const getIstTatsaechlich = useCallback(
    (kategorieId: string, produktId: string | null, kw: PlanungsWoche): number | null => {
      const v = istTatsaechlichMap.get(istTKey(kategorieId, produktId, kw.year, kw.week))
      return v !== undefined ? v : null
    },
    [istTatsaechlichMap],
  )

  const getBerechneterWert = useCallback(
    (kategorieId: string, produktId: string, kw: PlanungsWoche): number | null => {
      const v = berechneteWerte.get(wertKey(kategorieId, produktId, kw.year, kw.week))
      return v !== undefined ? v : null
    },
    [berechneteWerte],
  )

  const getIstPlan = useCallback(
    (kategorieId: string, produktId: string | null, kw: PlanungsWoche): number | null =>
      getManuellerWert(kategorieId, produktId, kw),
    [getManuellerWert],
  )

  const isManuelleOverride = useCallback(
    (kategorieId: string, produktId: string | null, kw: PlanungsWoche): boolean =>
      values.has(wertKey(kategorieId, produktId, kw.year, kw.week)),
    [values],
  )

  const hasBerechneterWert = useCallback(
    (kategorieId: string, produktId: string, kw: PlanungsWoche): boolean =>
      berechneteWerte.has(wertKey(kategorieId, produktId, kw.year, kw.week)),
    [berechneteWerte],
  )

  const upsertZelle = useCallback(
    async (
      kategorieId: string,
      produktId: string | null,
      kw: PlanungsWoche,
      value: number | null,
    ): Promise<void> => {
      const key = wertKey(kategorieId, produktId, kw.year, kw.week)
      const existing = values.get(key)
      setValues(prev => {
        const next = new Map(prev)
        if (value === null) next.delete(key)
        else next.set(key, value)
        return next
      })
      try {
        const res = await fetch('/api/umsatzausgaben-planung', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            kategorie_id: kategorieId,
            produkt_id: produktId,
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
      const res = await fetch(`/api/umsatzausgaben-planung${params}`, { method: 'DELETE' })
      if (!res.ok) throw new Error()
    } catch {
      setValues(snapshot)
      throw new Error('Zurücksetzen fehlgeschlagen')
    }
    // Re-fetch berechnet after delete so displayed values reflect the current calculation
    const allWochen = [...vergangenheitswochen, ...zukunftswochen]
    const ersteZukunft = zukunftswochen[0]
    if (allWochen.length > 0) {
      const berParams = `?von_kw=${allWochen[0].week}&von_jahr=${allWochen[0].year}&bis_kw=${allWochen[allWochen.length - 1].week}&bis_jahr=${allWochen[allWochen.length - 1].year}${ersteZukunft ? `&erste_zukunftskw=${ersteZukunft.week}&erste_zukunftsjahr=${ersteZukunft.year}` : ''}`
      fetch(`/api/umsatzausgaben-planung/berechnet${berParams}`)
        .then(r => r.ok ? r.json() : { data: [] })
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        .then((berRaw: any) => {
          const berEntries = (Array.isArray(berRaw) ? berRaw : (berRaw?.data ?? [])) as BerechneterEintrag[]
          const berMap = new Map<string, number>()
          const withProducts = new Set<string>()
          for (const e of berEntries) {
            berMap.set(wertKey(e.kategorie_id, e.produkt_id, e.kw_year, e.kw_number), e.wert)
            withProducts.add(e.kategorie_id)
          }
          setBerechneteWerte(berMap)
          setKatIdsWithProducts(withProducts)
        })
        .catch(() => {})
    }
  }, [values, zukunftswochen, vergangenheitswochen])

  return {
    vergangenheitswochen,
    zukunftswochen,
    lastWoche,
    kategorien,
    produkte,
    katIdsWithProducts,
    istTatsaechlichKatIds,
    istTatsaechlichMap,
    unassignedMarketingL2Ids,
    values,
    berechneteWerte,
    loading,
    error,
    isNewWeek,
    getManuellerWert,
    getIstTatsaechlich,
    getIstPlan,
    getBerechneterWert,
    isManuelleOverride,
    hasBerechneterWert,
    upsertZelle,
    resetAll,
  }
}
