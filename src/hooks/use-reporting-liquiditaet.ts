'use client'

import { useState, useEffect, useCallback } from 'react'

export type ReportGranularitaet = 'woche' | 'monat' | 'quartal' | 'jahr'

export interface LiquiditaetBlatt {
  id: string
  name: string
  values: Record<string, number>
}

export interface LiquiditaetPlattform {
  id: string
  name: string
  values: Record<string, number>
  produkte: LiquiditaetBlatt[]
}

export interface LiquiditaetUntergruppe {
  id: string
  name: string
  values: Record<string, number>
  sales_plattformen: LiquiditaetPlattform[]
  produkte: LiquiditaetBlatt[]
}

export interface LiquiditaetGruppe {
  id: string
  name: string
  values: Record<string, number>
  untergruppen: LiquiditaetUntergruppe[]
  sales_plattformen: LiquiditaetPlattform[]
  produkte: LiquiditaetBlatt[]
}

export interface LiquiditaetKategorie {
  id: string
  name: string
  kpi_type: 'einnahmen' | 'ausgaben_kosten'
  values: Record<string, number>
  gruppen: LiquiditaetGruppe[]
  sales_plattformen: LiquiditaetPlattform[]
  produkte: LiquiditaetBlatt[]
}

export interface ReportingLiquiditaetData {
  perioden: string[]
  einnahmen_kategorien: LiquiditaetKategorie[]
  ausgaben_kategorien: LiquiditaetKategorie[]
  gesamt_einnahmen: Record<string, number>
  gesamt_ausgaben: Record<string, number>
  cashflow: Record<string, number>
  kontostand: Record<string, number>
}

function getLast12Months(): { von: string; bis: string } {
  const now = new Date()
  const bis = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
  const vonDate = new Date(now.getFullYear(), now.getMonth() - 11, 1)
  const von = `${vonDate.getFullYear()}-${String(vonDate.getMonth() + 1).padStart(2, '0')}`
  return { von, bis }
}

export function useReportingLiquiditaet() {
  const { von: defaultVon, bis: defaultBis } = getLast12Months()
  const [von, setVon] = useState(defaultVon)
  const [bis, setBis] = useState(defaultBis)
  const [granularitaet, setGranularitaet] = useState<ReportGranularitaet>('monat')
  const [data, setData] = useState<ReportingLiquiditaetData | null>(null)
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
      const res = await fetch(`/api/reporting/liquiditaet?${params}`)
      if (!res.ok) throw new Error((await res.json()).error ?? 'Fehler beim Laden')
      setData(await res.json())
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Fehler beim Laden')
    } finally {
      setLoading(false)
    }
  }, [von, bis, granularitaet])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  return {
    von, bis, granularitaet, data, loading, error,
    setVon, setBis, setGranularitaet,
  }
}
