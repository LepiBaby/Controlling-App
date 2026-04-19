'use client'

import { useState, useEffect, useCallback } from 'react'

export type RentabilitaetQuelle = 'umsatz' | 'kosten'

export interface RentabilitaetZeile {
  id: string
  quelle: RentabilitaetQuelle
  leistungsdatum: string
  betrag: number // positive for umsatz, negative for kosten (API normalizes)
  kategorie_id: string | null
  gruppe_id: string | null
  untergruppe_id: string | null
  sales_plattform_id: string | null
  produkt_id: string | null
  beschreibung: string | null
}

export interface RentabilitaetFilter {
  von?: string
  bis?: string
  quelle?: RentabilitaetQuelle[]
  kategorie_ids?: string[]
  gruppe_ids?: string[]
  untergruppe_ids?: string[]
  sales_plattform_ids?: string[]
  produkt_ids?: string[]
}

export type RentabilitaetSortColumn = 'leistungsdatum' | 'betrag'
export type SortDirection = 'asc' | 'desc'

export interface RentabilitaetColumnVisibility {
  showGruppe: boolean
  showUntergruppe: boolean
  showSalesPlattform: boolean
  showProdukte: boolean
}

export const PAGE_SIZE = 50

export function useRentabilitaet() {
  const [zeilen, setZeilen] = useState<RentabilitaetZeile[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [total, setTotal] = useState(0)
  const [totalNetto, setTotalNetto] = useState(0)
  const [page, setPageState] = useState(1)
  const [filter, setFilterState] = useState<RentabilitaetFilter>({})
  const [sortColumn, setSortColumn] = useState<RentabilitaetSortColumn>('leistungsdatum')
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc')

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
      if (filter.quelle?.length) params.set('quelle', filter.quelle.join(','))
      if (filter.kategorie_ids?.length) params.set('kategorie_ids', filter.kategorie_ids.join(','))
      if (filter.gruppe_ids?.length) params.set('gruppe_ids', filter.gruppe_ids.join(','))
      if (filter.untergruppe_ids?.length) params.set('untergruppe_ids', filter.untergruppe_ids.join(','))
      if (filter.sales_plattform_ids?.length) params.set('sales_plattform_ids', filter.sales_plattform_ids.join(','))
      if (filter.produkt_ids?.length) params.set('produkt_ids', filter.produkt_ids.join(','))

      const res = await fetch(`/api/rentabilitaet?${params}`)
      if (!res.ok) throw new Error((await res.json()).error ?? 'Fehler beim Laden')
      const json = await res.json()
      setZeilen(json.data)
      setTotal(json.total)
      setTotalNetto(json.totalNetto)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Fehler beim Laden')
    } finally {
      setLoading(false)
    }
  }, [page, sortColumn, sortDirection, filter])

  useEffect(() => { fetchData() }, [fetchData])

  const setPage = useCallback((p: number) => setPageState(p), [])

  const setFilter = useCallback((f: RentabilitaetFilter) => {
    setFilterState(f)
    setPageState(1)
  }, [])

  const setSort = useCallback((column: RentabilitaetSortColumn, direction: SortDirection) => {
    setSortColumn(column)
    setSortDirection(direction)
    setPageState(1)
  }, [])

  return {
    zeilen, loading, error,
    total, totalNetto, page, filter, sortColumn, sortDirection,
    setPage, setFilter, setSort,
    refresh: fetchData,
  }
}
