'use client'

import { useState, useEffect, useCallback } from 'react'

export interface InvestitionsRate {
  datum: string          // YYYY-MM-DD, Ratendatum
  ursprung_datum: string // YYYY-MM-DD, Leistungsdatum der Ursprungstransaktion
  gruppe_id: string | null
  untergruppe_id: string | null
  beschreibung: string | null
  betrag: number
}

export interface InvestitionenFilter {
  von?: string
  bis?: string
  gruppe_ids?: string[]
  untergruppe_ids?: string[]
}

export type InvestitionenSortColumn = 'datum' | 'betrag'
export type SortDirection = 'asc' | 'desc'

export const PAGE_SIZE = 50

function idsEqual(a?: string[], b?: string[]): boolean {
  const av = a ?? []
  const bv = b ?? []
  if (av.length !== bv.length) return false
  const sortedA = [...av].sort()
  const sortedB = [...bv].sort()
  return sortedA.every((v, i) => v === sortedB[i])
}

export function useInvestitionen() {
  const [raten, setRaten] = useState<InvestitionsRate[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [total, setTotal] = useState(0)
  const [totalBetrag, setTotalBetrag] = useState(0)
  const [page, setPageState] = useState(1)
  const [filter, setFilterState] = useState<InvestitionenFilter>({})
  const [sortColumn, setSortColumn] = useState<InvestitionenSortColumn>('datum')
  const [sortDirection, setSortDirection] = useState<SortDirection>('asc')

  const fetchData = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const params = new URLSearchParams()
      params.set('page', String(page))
      params.set('sortColumn', sortColumn)
      params.set('sortDirection', sortDirection)
      if (filter.von) params.set('von', filter.von)
      if (filter.bis) params.set('bis', filter.bis)
      if (filter.gruppe_ids?.length) params.set('gruppe_ids', filter.gruppe_ids.join(','))
      if (filter.untergruppe_ids?.length) params.set('untergruppe_ids', filter.untergruppe_ids.join(','))

      const res = await fetch(`/api/investitionen-abschreibungen?${params}`)
      if (!res.ok) throw new Error((await res.json()).error ?? 'Fehler beim Laden')
      const json = await res.json()
      setRaten(json.data)
      setTotal(json.total)
      setTotalBetrag(json.totalBetrag)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Fehler beim Laden')
    } finally {
      setLoading(false)
    }
  }, [page, sortColumn, sortDirection, filter])

  useEffect(() => { fetchData() }, [fetchData])

  const setPage = useCallback((p: number) => setPageState(p), [])

  const setFilter = useCallback((f: InvestitionenFilter) => {
    setFilterState(prev => {
      const gruppeChanged = !idsEqual(prev.gruppe_ids, f.gruppe_ids)
      const next: InvestitionenFilter = { ...f }
      if (gruppeChanged) {
        next.untergruppe_ids = undefined
      }
      return next
    })
    setPageState(1)
  }, [])

  const setSort = useCallback((column: InvestitionenSortColumn, direction: SortDirection) => {
    setSortColumn(column)
    setSortDirection(direction)
    setPageState(1)
  }, [])

  return {
    raten, loading, error,
    total, totalBetrag, page, filter, sortColumn, sortDirection,
    setPage, setFilter, setSort,
    refresh: fetchData,
  }
}
