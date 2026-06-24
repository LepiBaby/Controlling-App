'use client'

import { useState, useEffect, useCallback } from 'react'

export type Rhythmus =
  | 'woechentlich'
  | 'alle_zwei_wochen'
  | 'alle_drei_wochen'
  | 'alle_vier_wochen'

export interface AuszahlungsEinstellung {
  sales_plattform_id: string
  auszahlungsrhythmus: Rhythmus
  naechste_auszahlung_basis_kw: number | null
  naechste_auszahlung_basis_jahr: number | null
  verschiebung_wochen: number
  retouren_inkludiert: boolean
}

export const RHYTHMUS_WOCHEN: Record<Rhythmus, number> = {
  woechentlich: 1,
  alle_zwei_wochen: 2,
  alle_drei_wochen: 3,
  alle_vier_wochen: 4,
}

export const RHYTHMUS_LABELS: Record<Rhythmus, string> = {
  woechentlich: 'Wöchentlich',
  alle_zwei_wochen: 'Alle 2 Wochen',
  alle_drei_wochen: 'Alle 3 Wochen',
  alle_vier_wochen: 'Alle 4 Wochen',
}

export const RHYTHMUS_VALUES: Rhythmus[] = [
  'woechentlich',
  'alle_zwei_wochen',
  'alle_drei_wochen',
  'alle_vier_wochen',
]

function getISOWeeksInYear(year: number): number {
  // Dec 28 is always in the last ISO week of its year
  const d = new Date(year, 11, 28)
  const dayOfWeek = d.getDay() || 7
  const thursday = new Date(d)
  thursday.setDate(d.getDate() + 4 - dayOfWeek)
  const jan1 = new Date(thursday.getFullYear(), 0, 1)
  return Math.ceil(((thursday.getTime() - jan1.getTime()) / 86400000 + 1) / 7)
}

export function getCurrentISOWeekAndYear(): { kw: number; jahr: number } {
  const today = new Date()
  const dayOfWeek = today.getDay() || 7
  const thursday = new Date(today)
  thursday.setDate(today.getDate() + 4 - dayOfWeek)
  const jan1 = new Date(thursday.getFullYear(), 0, 1)
  const kw = Math.ceil(((thursday.getTime() - jan1.getTime()) / 86400000 + 1) / 7)
  return { kw, jahr: thursday.getFullYear() }
}

export function addWeeks(
  kw: number,
  jahr: number,
  weeks: number,
): { kw: number; jahr: number } {
  let resultKw = kw + weeks
  let resultJahr = jahr
  let weeksInYear = getISOWeeksInYear(resultJahr)
  while (resultKw > weeksInYear) {
    resultKw -= weeksInYear
    resultJahr += 1
    weeksInYear = getISOWeeksInYear(resultJahr)
  }
  while (resultKw < 1) {
    resultJahr -= 1
    resultKw += getISOWeeksInYear(resultJahr)
  }
  return { kw: resultKw, jahr: resultJahr }
}

export function calculateNextPayoutWeek(
  basisKw: number,
  basisJahr: number,
  rhythmusWochen: number,
  currentKw: number,
  currentJahr: number
): { kw: number; jahr: number } {
  let kw = basisKw
  let jahr = basisJahr

  while (jahr < currentJahr || (jahr === currentJahr && kw < currentKw)) {
    kw += rhythmusWochen
    let weeksInYear = getISOWeeksInYear(jahr)
    while (kw > weeksInYear) {
      kw -= weeksInYear
      jahr += 1
      weeksInYear = getISOWeeksInYear(jahr)
    }
  }

  return { kw, jahr }
}

const makeDefault = (plattformId: string): AuszahlungsEinstellung => ({
  sales_plattform_id: plattformId,
  auszahlungsrhythmus: 'woechentlich',
  naechste_auszahlung_basis_kw: null,
  naechste_auszahlung_basis_jahr: null,
  verschiebung_wochen: 0,
  retouren_inkludiert: false,
})

export function useAuszahlungsEinstellungen(plattformId: string | null) {
  const [einstellung, setEinstellung] = useState<AuszahlungsEinstellung | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!plattformId) {
      setEinstellung(null)
      return
    }
    setLoading(true)
    setError(null)
    fetch(`/api/auszahlungs-einstellungen?plattform_id=${plattformId}`)
      .then(r => {
        if (!r.ok) throw new Error('API-Fehler')
        return r.json()
      })
      .then((data: AuszahlungsEinstellung | null) => {
        setEinstellung(data)
        setLoading(false)
      })
      .catch(() => {
        setError('Fehler beim Laden der Auszahlungseinstellungen.')
        setLoading(false)
      })
  }, [plattformId])

  const upsert = useCallback(
    async (patch: Partial<AuszahlungsEinstellung> & { sales_plattform_id: string }): Promise<void> => {
      const previous = einstellung
      const next: AuszahlungsEinstellung = {
        ...makeDefault(patch.sales_plattform_id),
        ...einstellung,
        ...patch,
      }
      setEinstellung(next)

      const res = await fetch('/api/auszahlungs-einstellungen', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(next),
      })

      if (!res.ok) {
        setEinstellung(previous)
        throw new Error('Speichern fehlgeschlagen')
      }

      const data: AuszahlungsEinstellung = await res.json()
      setEinstellung(data)
    },
    [einstellung]
  )

  return { einstellung, loading, error, upsert }
}
