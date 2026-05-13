'use client'

import { useState, useEffect, useCallback } from 'react'

export type ReportGranularitaet = 'monat' | 'quartal' | 'jahr'

export interface ReportBlatt {
  id: string
  name: string
  values: Record<string, number>
}

export interface ReportPlattform {
  id: string
  name: string
  values: Record<string, number>
  produkte: ReportBlatt[]
}

export interface ReportUntergruppe {
  id: string
  name: string
  values: Record<string, number>
  sales_plattformen: ReportPlattform[]
}

export interface ReportGruppe {
  id: string
  name: string
  values: Record<string, number>
  untergruppen: ReportUntergruppe[]
  sales_plattformen: ReportPlattform[]
  produkte_wertverlust?: ReportBlatt[]
  produkte_manuelle_sendungen?: ReportBlatt[]
}

export interface ReportKategorie {
  id: string
  name: string
  kpi_type: 'umsatz' | 'ausgaben_kosten'
  values: Record<string, number>
  gruppen: ReportGruppe[]
  sales_plattformen: ReportPlattform[]
  produkte_wertverlust?: ReportBlatt[]
  produkte_manuelle_sendungen?: ReportBlatt[]
}

export interface ReportPosition {
  id: string
  name: string
  type: 'position' | 'summe'
  sort_order: number
  values: Record<string, number>
  kategorien: ReportKategorie[]
}

export interface ReportingRentabilitaetData {
  perioden: string[]
  positionen: ReportPosition[]
}

function getLast12Months(): { von: string; bis: string } {
  const now = new Date()
  const bis = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
  const vonDate = new Date(now.getFullYear(), now.getMonth() - 11, 1)
  const von = `${vonDate.getFullYear()}-${String(vonDate.getMonth() + 1).padStart(2, '0')}`
  return { von, bis }
}

export function useReportingRentabilitaet() {
  const { von: defaultVon, bis: defaultBis } = getLast12Months()
  const [von, setVon] = useState(defaultVon)
  const [bis, setBis] = useState(defaultBis)
  const [granularitaet, setGranularitaet] = useState<ReportGranularitaet>('monat')
  const [data, setData] = useState<ReportingRentabilitaetData | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const fetchData = useCallback(async () => {
    if (!von || !bis) {
      setData(null)
      return
    }
    setLoading(true)
    setError(null)
    try {
      const params = new URLSearchParams({ von, bis, granularitaet })
      const res = await fetch(`/api/reporting/rentabilitaet?${params}`)
      if (!res.ok) throw new Error((await res.json()).error ?? 'Fehler beim Laden')
      setData(await res.json())
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Fehler beim Laden')
    } finally {
      setLoading(false)
    }
  }, [von, bis, granularitaet])

  useEffect(() => { fetchData() }, [fetchData])

  return {
    von, bis, granularitaet, data, loading, error,
    setVon, setBis, setGranularitaet,
  }
}
