'use client'

import { useState, useEffect, useCallback } from 'react'

export interface EinnahmenTransaktion {
  id: string
  zahlungsdatum: string
  betrag: number
  kategorie_id: string
  gruppe_id: string | null
  untergruppe_id: string | null
  sales_plattform_id: string | null
  produkt_id: string | null
  beschreibung: string | null
  created_at: string
}

export interface EinnahmenTransaktionInput {
  zahlungsdatum: string
  betrag: number
  kategorie_id: string
  gruppe_id?: string | null
  untergruppe_id?: string | null
  sales_plattform_id?: string | null
  produkt_id?: string | null
  beschreibung?: string | null
}

export interface EinnahmenFilter {
  von?: string
  bis?: string
  kategorie_ids?: string[]
  gruppe_ids?: string[]
  untergruppe_ids?: string[]
  sales_plattform_ids?: string[]
  produkt_ids?: string[]
}

export type SortColumn = 'zahlungsdatum' | 'betrag'
export type SortDirection = 'asc' | 'desc'

export interface ColumnVisibility {
  showGruppe: boolean
  showUntergruppe: boolean
  showSalesPlattform: boolean
  showProdukte: boolean
}

export const PAGE_SIZE = 50

export function useEinnahmenTransaktionen() {
  const [transaktionen, setTransaktionen] = useState<EinnahmenTransaktion[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [total, setTotal] = useState(0)
  const [totalBetrag, setTotalBetrag] = useState(0)
  const [page, setPageState] = useState(1)
  const [filter, setFilterState] = useState<EinnahmenFilter>({})
  const [sortColumn, setSortColumn] = useState<SortColumn>('zahlungsdatum')
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
      if (filter.kategorie_ids?.length) params.set('kategorie_ids', filter.kategorie_ids.join(','))
      if (filter.gruppe_ids?.length) params.set('gruppe_ids', filter.gruppe_ids.join(','))
      if (filter.untergruppe_ids?.length) params.set('untergruppe_ids', filter.untergruppe_ids.join(','))
      if (filter.sales_plattform_ids?.length) params.set('sales_plattform_ids', filter.sales_plattform_ids.join(','))
      if (filter.produkt_ids?.length) params.set('produkt_ids', filter.produkt_ids.join(','))

      const res = await fetch(`/api/einnahmen-transaktionen?${params}`)
      if (!res.ok) throw new Error((await res.json()).error ?? 'Fehler beim Laden')
      const json = await res.json()
      setTransaktionen(json.data)
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

  const setFilter = useCallback((f: EinnahmenFilter) => {
    setFilterState(f)
    setPageState(1)
  }, [])

  const setSort = useCallback((column: SortColumn, direction: SortDirection) => {
    setSortColumn(column)
    setSortDirection(direction)
    setPageState(1)
  }, [])

  const addTransaktion = useCallback(async (input: EinnahmenTransaktionInput) => {
    const res = await fetch('/api/einnahmen-transaktionen', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(input),
    })
    if (!res.ok) throw new Error((await res.json()).error ?? 'Fehler beim Speichern')
    await fetchData()
  }, [fetchData])

  const updateTransaktion = useCallback(async (id: string, input: Partial<EinnahmenTransaktionInput>) => {
    const res = await fetch(`/api/einnahmen-transaktionen/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(input),
    })
    if (!res.ok) throw new Error((await res.json()).error ?? 'Fehler beim Aktualisieren')
    await fetchData()
  }, [fetchData])

  const deleteTransaktion = useCallback(async (id: string) => {
    const res = await fetch(`/api/einnahmen-transaktionen/${id}`, { method: 'DELETE' })
    if (!res.ok) throw new Error((await res.json()).error ?? 'Fehler beim Löschen')
    await fetchData()
  }, [fetchData])

  return {
    transaktionen, loading, error,
    total, totalBetrag, page, filter, sortColumn, sortDirection,
    setPage, setFilter, setSort,
    addTransaktion, updateTransaktion, deleteTransaktion,
  }
}
