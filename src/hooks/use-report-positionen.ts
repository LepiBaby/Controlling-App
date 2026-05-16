'use client'

import { useState, useEffect, useCallback } from 'react'

export type ReportPositionType = 'position' | 'summe' | 'umsatzsteuer'

export interface ReportPositionKategorie {
  id: string
  kpi_category_id: string
  kpi_category: {
    id: string
    name: string
    type: 'umsatz' | 'ausgaben_kosten'
  }
}

export interface ReportSummeRef {
  id: string
  referenced_position_id: string
  referenced_position: {
    id: string
    name: string
  }
}

export interface ReportPosition {
  id: string
  name: string
  type: ReportPositionType
  sort_order: number
  investitionsbezogen: boolean
  in_deckungsbeitragsreport: boolean
  in_break_even_report: boolean
  kategorien: ReportPositionKategorie[]
  summe_positionen: ReportSummeRef[]
}

export function useReportPositionen() {
  const [positions, setPositions] = useState<ReportPosition[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    setLoading(true)
    fetch('/api/report-positionen')
      .then(r => {
        if (!r.ok) throw new Error('API-Fehler')
        return r.json()
      })
      .then((data: ReportPosition[]) => {
        setPositions(data.sort((a, b) => a.sort_order - b.sort_order))
        setLoading(false)
      })
      .catch(() => {
        setError('Fehler beim Laden des Reporting-Modells.')
        setLoading(false)
      })
  }, [])

  const addPosition = useCallback(async (type: ReportPositionType) => {
    const name = type === 'position' ? 'Neue Position' : type === 'summe' ? 'Neue Summe' : 'Umsatzsteuer'
    const res = await fetch('/api/report-positionen', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, type }),
    })
    if (!res.ok) throw new Error('Fehler beim Anlegen.')
    const created: ReportPosition = await res.json()
    setPositions(prev => [...prev, created])
    return created
  }, [])

  const updateName = useCallback(async (id: string, name: string) => {
    const prev = positions.find(p => p.id === id)
    if (!prev) return
    setPositions(ps => ps.map(p => p.id === id ? { ...p, name } : p))
    const res = await fetch(`/api/report-positionen/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name }),
    })
    if (!res.ok) {
      setPositions(ps => ps.map(p => p.id === id ? prev : p))
    }
  }, [positions])

  const updateSortOrders = useCallback(async (reordered: ReportPosition[]) => {
    const prev = positions
    setPositions(reordered)
    try {
      await Promise.all(reordered.map((p, idx) =>
        fetch(`/api/report-positionen/${p.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ sort_order: idx }),
        })
      ))
    } catch {
      setPositions(prev)
    }
  }, [positions])

  const setKategorien = useCallback(async (id: string, kpiCategoryIds: string[]) => {
    const res = await fetch(`/api/report-positionen/${id}/kategorien`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ kpi_category_ids: kpiCategoryIds }),
    })
    if (!res.ok) throw new Error('Fehler beim Speichern der Kategorien.')
    const updated: ReportPosition = await res.json()
    setPositions(ps => ps.map(p => p.id === id ? updated : p))
  }, [])

  const setSummePositionen = useCallback(async (id: string, referencedPositionIds: string[]) => {
    const res = await fetch(`/api/report-positionen/${id}/summe-positionen`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ referenced_position_ids: referencedPositionIds }),
    })
    if (!res.ok) throw new Error('Fehler beim Speichern der Summen-Referenzen.')
    const updated: ReportPosition = await res.json()
    setPositions(ps => ps.map(p => p.id === id ? updated : p))
  }, [])

  const deletePosition = useCallback(async (id: string) => {
    setPositions(ps => ps.filter(p => p.id !== id))
    await fetch(`/api/report-positionen/${id}`, { method: 'DELETE' })
  }, [])

  const updateInvestitionsbezogen = useCallback(async (id: string, investitionsbezogen: boolean) => {
    const prev = positions.find(p => p.id === id)
    if (!prev) return
    setPositions(ps => ps.map(p => p.id === id ? { ...p, investitionsbezogen } : p))
    const res = await fetch(`/api/report-positionen/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ investitionsbezogen }),
    })
    if (!res.ok) {
      setPositions(ps => ps.map(p => p.id === id ? prev : p))
    }
  }, [positions])

  const updateInDeckungsbeitragsreport = useCallback(async (id: string, in_deckungsbeitragsreport: boolean) => {
    const prev = positions.find(p => p.id === id)
    if (!prev) return
    setPositions(ps => ps.map(p => p.id === id ? { ...p, in_deckungsbeitragsreport } : p))
    const res = await fetch(`/api/report-positionen/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ in_deckungsbeitragsreport }),
    })
    if (!res.ok) {
      setPositions(ps => ps.map(p => p.id === id ? prev : p))
    }
  }, [positions])

  const updateInBreakEvenReport = useCallback(async (id: string, in_break_even_report: boolean) => {
    const prev = positions.find(p => p.id === id)
    if (!prev) return
    setPositions(ps => ps.map(p => p.id === id ? { ...p, in_break_even_report } : p))
    const res = await fetch(`/api/report-positionen/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ in_break_even_report }),
    })
    if (!res.ok) {
      setPositions(ps => ps.map(p => p.id === id ? prev : p))
    }
  }, [positions])

  return {
    positions, loading, error,
    addPosition, updateName, updateSortOrders, setKategorien, setSummePositionen,
    deletePosition, updateInvestitionsbezogen, updateInDeckungsbeitragsreport, updateInBreakEvenReport,
  }
}
