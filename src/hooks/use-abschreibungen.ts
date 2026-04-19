'use client'

import { useState, useEffect, useCallback } from 'react'

export interface AbschreibungsRate {
  datum: string // YYYY-MM-DD, Ratendatum
  ursprung_datum: string // YYYY-MM-DD, Leistungsdatum der Ursprungstransaktion
  kategorie_id: string | null
  gruppe_id: string | null
  untergruppe_id: string | null
  beschreibung: string | null
  betrag: number
}

export interface AbschreibungenFilter {
  von?: string
  bis?: string
  kategorie_ids?: string[]
  gruppe_ids?: string[]
  untergruppe_ids?: string[]
}

export type AbschreibungenSortColumn = 'datum' | 'betrag'
export type SortDirection = 'asc' | 'desc'

export const PAGE_SIZE = 50

// Prüft, ob sich ein ID-Array effektiv geändert hat (Reihenfolge-unabhängig)
function idsEqual(a?: string[], b?: string[]): boolean {
  const av = a ?? []
  const bv = b ?? []
  if (av.length !== bv.length) return false
  const sortedA = [...av].sort()
  const sortedB = [...bv].sort()
  return sortedA.every((v, i) => v === sortedB[i])
}

export function useAbschreibungen() {
  const [raten, setRaten] = useState<AbschreibungsRate[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [total, setTotal] = useState(0)
  const [totalBetrag, setTotalBetrag] = useState(0)
  const [page, setPageState] = useState(1)
  const [filter, setFilterState] = useState<AbschreibungenFilter>({})
  const [sortColumn, setSortColumn] = useState<AbschreibungenSortColumn>('datum')
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
      if (filter.kategorie_ids?.length) params.set('kategorie_ids', filter.kategorie_ids.join(','))
      if (filter.gruppe_ids?.length) params.set('gruppe_ids', filter.gruppe_ids.join(','))
      if (filter.untergruppe_ids?.length) params.set('untergruppe_ids', filter.untergruppe_ids.join(','))

      const res = await fetch(`/api/abschreibungen?${params}`)
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

  const setFilter = useCallback((f: AbschreibungenFilter) => {
    setFilterState(prev => {
      // Kaskadenreset: Wenn sich der Kategorie-Filter geändert hat,
      // gruppe_ids und untergruppe_ids zurücksetzen.
      // Wenn sich der Gruppe-Filter geändert hat, untergruppe_ids zurücksetzen.
      const kategorieChanged = !idsEqual(prev.kategorie_ids, f.kategorie_ids)
      const gruppeChanged = !idsEqual(prev.gruppe_ids, f.gruppe_ids)

      const next: AbschreibungenFilter = { ...f }
      if (kategorieChanged) {
        next.gruppe_ids = undefined
        next.untergruppe_ids = undefined
      } else if (gruppeChanged) {
        next.untergruppe_ids = undefined
      }
      return next
    })
    setPageState(1)
  }, [])

  const setSort = useCallback((column: AbschreibungenSortColumn, direction: SortDirection) => {
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
