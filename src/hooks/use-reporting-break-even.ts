'use client'

import { useState, useEffect, useCallback } from 'react'
import {
  type ReportGranularitaet,
  type ReportingRentabilitaetData,
} from '@/hooks/use-reporting-rentabilitaet'

export interface BreakEvenProduktOption {
  id: string
  name: string
}

export function useReportingBreakEven() {
  const [granularitaet, setGranularitaet] = useState<ReportGranularitaet>('monat')
  const [selectedProduktIds, setSelectedProduktIds] = useState<string[]>([])
  const [produktOptionen, setProduktOptionen] = useState<BreakEvenProduktOption[]>([])

  const [data, setData] = useState<ReportingRentabilitaetData | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    fetch('/api/kpi-categories?type=produkte')
      .then(r => r.ok ? r.json() : [])
      .then((cats: Array<{ id: string; name: string; level: number }>) => {
        setProduktOptionen(cats.filter(c => c.level === 1).map(c => ({ id: c.id, name: c.name })))
      })
      .catch(() => {})
  }, [])

  const fetchData = useCallback(async () => {
    if (selectedProduktIds.length === 0) {
      setData(null)
      return
    }
    setLoading(true)
    setError(null)
    try {
      const params = new URLSearchParams({
        produkt_ids: selectedProduktIds.join(','),
        granularitaet,
      })
      const res = await fetch(`/api/reporting/break-even?${params}`)
      if (!res.ok) throw new Error((await res.json()).error ?? 'Fehler beim Laden')
      setData(await res.json())
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Fehler beim Laden')
    } finally {
      setLoading(false)
    }
  }, [selectedProduktIds, granularitaet])

  useEffect(() => { fetchData() }, [fetchData])

  function handleSetSelectedProduktIds(ids: string[]) {
    if (ids.length === 0 && selectedProduktIds.length <= 1) return
    setSelectedProduktIds(ids)
  }

  function removeProdukt(id: string) {
    if (selectedProduktIds.length <= 1) return
    setSelectedProduktIds(prev => prev.filter(x => x !== id))
  }

  const hasProducts = selectedProduktIds.length > 0
  const displayPerioden = data?.perioden ?? []

  return {
    granularitaet, selectedProduktIds, produktOptionen,
    data, displayPerioden, loading, error, hasProducts,
    setGranularitaet,
    setSelectedProduktIds: handleSetSelectedProduktIds,
    removeProdukt,
  }
}
