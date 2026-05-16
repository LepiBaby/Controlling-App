'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import {
  type ReportGranularitaet,
  type ReportAnzeigemodus,
  type ReportingRentabilitaetData,
  prevPeriodStart,
} from '@/hooks/use-reporting-rentabilitaet'

export interface FilterOption {
  id: string
  name: string
}

function getLast12Months(): { von: string; bis: string } {
  const now = new Date()
  const bis = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
  const vonDate = new Date(now.getFullYear(), now.getMonth() - 11, 1)
  const von = `${vonDate.getFullYear()}-${String(vonDate.getMonth() + 1).padStart(2, '0')}`
  return { von, bis }
}

export function useReportingDeckungsbeitrag() {
  const { von: defaultVon, bis: defaultBis } = getLast12Months()
  const [von, setVon] = useState(defaultVon)
  const [bis, setBis] = useState(defaultBis)
  const [granularitaet, setGranularitaet] = useState<ReportGranularitaet>('monat')
  const [anzeigemodus, setAnzeigemodus] = useState<ReportAnzeigemodus>('absolut')

  const [selectedProduktIds, setSelectedProduktIds] = useState<string[]>([])
  const [selectedPlattformIds, setSelectedPlattformIds] = useState<string[]>([])
  const [produktOptionen, setProduktOptionen] = useState<FilterOption[]>([])
  const [plattformOptionen, setPlattformOptionen] = useState<FilterOption[]>([])

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

    fetch('/api/kpi-categories?type=sales_plattformen')
      .then(r => r.ok ? r.json() : [])
      .then((cats: Array<{ id: string; name: string; level: number }>) => {
        setPlattformOptionen(cats.filter(c => c.level === 1).map(c => ({ id: c.id, name: c.name })))
      })
      .catch(() => {})
  }, [])

  const fetchData = useCallback(async () => {
    if (!von || !bis) {
      setData(null)
      return
    }
    setLoading(true)
    setError(null)
    try {
      const vonFetch = anzeigemodus === 'wachstum' ? prevPeriodStart(von, granularitaet) : von
      const params = new URLSearchParams({ von: vonFetch, bis, granularitaet })
      if (selectedProduktIds.length > 0) {
        params.set('produkt_ids', selectedProduktIds.join(','))
      }
      if (selectedPlattformIds.length > 0) {
        params.set('plattform_ids', selectedPlattformIds.join(','))
      }
      const res = await fetch(`/api/reporting/deckungsbeitrag?${params}`)
      if (!res.ok) throw new Error((await res.json()).error ?? 'Fehler beim Laden')
      setData(await res.json())
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Fehler beim Laden')
    } finally {
      setLoading(false)
    }
  }, [von, bis, granularitaet, anzeigemodus, selectedProduktIds, selectedPlattformIds])

  useEffect(() => { fetchData() }, [fetchData])

  const displayPerioden = useMemo(() => {
    if (!data) return []
    if (anzeigemodus !== 'wachstum') return data.perioden
    return data.perioden.slice(1)
  }, [data, anzeigemodus])

  return {
    von, bis, granularitaet, anzeigemodus,
    selectedProduktIds, selectedPlattformIds,
    produktOptionen, plattformOptionen,
    data, displayPerioden, loading, error,
    setVon, setBis, setGranularitaet, setAnzeigemodus,
    setSelectedProduktIds, setSelectedPlattformIds,
  }
}
