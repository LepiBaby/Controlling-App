'use client'

import { useState, useEffect, useCallback } from 'react'

export interface VorsteuerTransaktion {
  id: string
  leistungsdatum: string
  betrag_brutto: number
  betrag_netto: number
  ust_satz: string
  ust_betrag: number
  kategorie_id: string
  gruppe_id: string | null
  untergruppe_id: string | null
}

export interface VorsteuerFilter {
  von?: string
  bis?: string
  kategorie_ids?: string[]
  gruppe_ids?: string[]
  untergruppe_ids?: string[]
}

export type VorsteuerSortColumn = 'leistungsdatum' | 'betrag_brutto'
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

export function useVorsteuer() {
  const [transaktionen, setTransaktionen] = useState<VorsteuerTransaktion[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [total, setTotal] = useState(0)
  const [page, setPageState] = useState(1)
  const [pageSize, setPageSizeState] = useState(50)
  const [filter, setFilterState] = useState<VorsteuerFilter>({})
  const [sortColumn, setSortColumn] = useState<VorsteuerSortColumn>('leistungsdatum')
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc')

  const fetchData = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const params = new URLSearchParams()
      params.set('page', String(page))
      params.set('pageSize', String(pageSize))
      params.set('sortColumn', sortColumn)
      params.set('sortDirection', sortDirection)
      if (filter.von) params.set('von', filter.von)
      if (filter.bis) params.set('bis', filter.bis)
      if (filter.kategorie_ids?.length) params.set('kategorie_ids', filter.kategorie_ids.join(','))
      if (filter.gruppe_ids?.length) params.set('gruppe_ids', filter.gruppe_ids.join(','))
      if (filter.untergruppe_ids?.length) params.set('untergruppe_ids', filter.untergruppe_ids.join(','))

      const res = await fetch(`/api/vorsteuer?${params}`)
      if (!res.ok) throw new Error((await res.json()).error ?? 'Fehler beim Laden')
      const json = await res.json()
      setTransaktionen(json.data)
      setTotal(json.total)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Fehler beim Laden')
    } finally {
      setLoading(false)
    }
  }, [page, pageSize, sortColumn, sortDirection, filter])

  useEffect(() => { fetchData() }, [fetchData])

  const setPage = useCallback((p: number) => setPageState(p), [])

  const setPageSize = useCallback((s: number) => {
    setPageSizeState(s)
    setPageState(1)
  }, [])

  const setFilter = useCallback((f: VorsteuerFilter) => {
    setFilterState(prev => {
      const kategorieChanged = !idsEqual(prev.kategorie_ids, f.kategorie_ids)
      const gruppeChanged    = !idsEqual(prev.gruppe_ids, f.gruppe_ids)
      const next: VorsteuerFilter = { ...f }
      if (kategorieChanged) {
        next.gruppe_ids      = undefined
        next.untergruppe_ids = undefined
      } else if (gruppeChanged) {
        next.untergruppe_ids = undefined
      }
      return next
    })
    setPageState(1)
  }, [])

  const setSort = useCallback((column: VorsteuerSortColumn, direction: SortDirection) => {
    setSortColumn(column)
    setSortDirection(direction)
    setPageState(1)
  }, [])

  return {
    transaktionen, loading, error,
    total, page, pageSize, filter, sortColumn, sortDirection,
    setPage, setPageSize, setFilter, setSort,
  }
}
