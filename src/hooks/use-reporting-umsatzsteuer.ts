'use client'

import { useState, useEffect, useCallback } from 'react'

export type ReportGranularitaet = 'monat' | 'quartal' | 'jahr'

export interface UstPlattformProdukt {
  id: string
  name: string
  ust_satz: number
  values: Record<string, number>
}

export interface UstPlattform {
  id: string
  name: string
  values: Record<string, number>
  produkte: UstPlattformProdukt[]
}

export interface UstProdukt {
  id: string
  name: string
  ust_satz: number
  values: Record<string, number>
}

export interface UstUntergruppe {
  id: string
  name: string
  values: Record<string, number>
  produkte: UstProdukt[]
  plattformen: UstPlattform[]
}

export interface UstGruppe {
  id: string
  name: string
  values: Record<string, number>
  untergruppen: UstUntergruppe[]
  produkte: UstProdukt[]
  plattformen: UstPlattform[]
}

export interface UstKategorie {
  id: string
  name: string
  values: Record<string, number>
  gruppen: UstGruppe[]
  produkte: UstProdukt[]
  plattformen: UstPlattform[]
}

export interface VorsteuerProdukt {
  id: string
  name: string
  values: Record<string, number>
}

export interface VorsteuerPlattformProdukt {
  id: string
  name: string
  values: Record<string, number>
}

export interface VorsteuerPlattform {
  id: string
  name: string
  values: Record<string, number>
  produkte: VorsteuerPlattformProdukt[]
}

export interface VorsteuerUntergruppe {
  id: string
  name: string
  values: Record<string, number>
  plattformen: VorsteuerPlattform[]
  produkte: VorsteuerProdukt[]
}

export interface VorsteuerGruppe {
  id: string
  name: string
  values: Record<string, number>
  untergruppen: VorsteuerUntergruppe[]
  plattformen: VorsteuerPlattform[]
  produkte: VorsteuerProdukt[]
}

export interface VorsteuerKategorie {
  id: string
  name: string
  values: Record<string, number>
  gruppen: VorsteuerGruppe[]
  plattformen: VorsteuerPlattform[]
  produkte: VorsteuerProdukt[]
}

export interface ReportingUmsatzsteuerData {
  perioden: string[]
  abzufuehrendeUst: {
    kategorien: UstKategorie[]
    summe: Record<string, number>
  }
  abziehbareVorsteuer: {
    kategorien: VorsteuerKategorie[]
    summe: Record<string, number>
  }
  faelligeUst: Record<string, number>
}

function getLast12Months(): { von: string; bis: string } {
  const now = new Date()
  const bis = now.toISOString().slice(0, 7)
  const vonDate = new Date(now.getFullYear(), now.getMonth() - 11, 1)
  const von = vonDate.toISOString().slice(0, 7)
  return { von, bis }
}

export function useReportingUmsatzsteuer() {
  const { von: defaultVon, bis: defaultBis } = getLast12Months()
  const [von, setVon] = useState(defaultVon)
  const [bis, setBis] = useState(defaultBis)
  const [granularitaet, setGranularitaet] = useState<ReportGranularitaet>('monat')
  const [data, setData] = useState<ReportingUmsatzsteuerData | null>(null)
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
      const res = await fetch(`/api/reporting/umsatzsteuer?${params}`)
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
