'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'

export type ReportGranularitaet = 'monat' | 'quartal' | 'jahr'
export type ReportAnzeigemodus = 'absolut' | 'prozentual' | 'wachstum'

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
  produkte_pi?: ReportBlatt[]
  produkte?: ReportBlatt[]
}

export interface ReportGruppe {
  id: string
  name: string
  values: Record<string, number>
  untergruppen: ReportUntergruppe[]
  sales_plattformen: ReportPlattform[]
  produkte_wertverlust?: ReportBlatt[]
  produkte_manuelle_sendungen?: ReportBlatt[]
  produkte_pi?: ReportBlatt[]
  produkte?: ReportBlatt[]
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

export interface ReportUstProdukt {
  id: string
  name: string
  ust_satz: number
  values: Record<string, number>
}

export interface ReportPosition {
  id: string
  name: string
  type: 'position' | 'summe' | 'umsatzsteuer'
  sort_order: number
  investitionsbezogen: boolean
  values: Record<string, number>
  kategorien: ReportKategorie[]
  ust_produkte?: ReportUstProdukt[]
  summe_refs?: string[]
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

// Berechnet den Startmonat der Vorperiode (für Wachstum-Modus)
export function prevPeriodStart(von: string, gran: ReportGranularitaet): string {
  const [y, m] = von.split('-').map(Number)
  const offset = gran === 'monat' ? 1 : gran === 'quartal' ? 3 : 12
  let newM = m - offset
  let newY = y
  if (newM < 1) { newM += 12; newY -= 1 }
  return `${newY}-${String(newM).padStart(2, '0')}`
}

export function useReportingRentabilitaet() {
  const { von: defaultVon, bis: defaultBis } = getLast12Months()
  const [von, setVon] = useState(defaultVon)
  const [bis, setBis] = useState(defaultBis)
  const [granularitaet, setGranularitaet] = useState<ReportGranularitaet>('monat')
  const [anzeigemodus, setAnzeigemodus] = useState<ReportAnzeigemodus>('absolut')
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
      // Im Wachstum-Modus eine Periode früher laden, damit Vorperioden-Werte verfügbar sind
      const vonFetch = anzeigemodus === 'wachstum' ? prevPeriodStart(von, granularitaet) : von
      const params = new URLSearchParams({ von: vonFetch, bis, granularitaet })
      const res = await fetch(`/api/reporting/rentabilitaet?${params}`)
      if (!res.ok) throw new Error((await res.json()).error ?? 'Fehler beim Laden')
      setData(await res.json())
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Fehler beim Laden')
    } finally {
      setLoading(false)
    }
  }, [von, bis, granularitaet, anzeigemodus])

  useEffect(() => { fetchData() }, [fetchData])

  // Im Wachstum-Modus enthält data.perioden[0] die Vorperiode — diese wird nicht angezeigt
  const displayPerioden = useMemo(() => {
    if (!data) return []
    if (anzeigemodus !== 'wachstum') return data.perioden
    return data.perioden.slice(1)
  }, [data, anzeigemodus])

  return {
    von, bis, granularitaet, anzeigemodus, data, displayPerioden, loading, error,
    setVon, setBis, setGranularitaet, setAnzeigemodus,
  }
}
