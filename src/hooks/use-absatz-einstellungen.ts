'use client'

import { useState, useEffect, useCallback } from 'react'

export type Berechnungsart =
  | 'mittelwert_7'
  | 'mittelwert_14'
  | 'mittelwert_30'
  | 'mittelwert_60'
  | 'mittelwert_90'
  | 'gewichtet_30'
  | 'gewichtet_60'
  | 'gewichtet_90'
  | 'keine'

export const BERECHNUNGSARTEN: Berechnungsart[] = [
  'mittelwert_7',
  'mittelwert_14',
  'mittelwert_30',
  'mittelwert_60',
  'mittelwert_90',
  'gewichtet_30',
  'gewichtet_60',
  'gewichtet_90',
  'keine',
]

export const BERECHNUNGSART_LABELS: Record<Berechnungsart, string> = {
  mittelwert_7: 'Mittelwert 7 Tage',
  mittelwert_14: 'Mittelwert 14 Tage',
  mittelwert_30: 'Mittelwert 30 Tage',
  mittelwert_60: 'Mittelwert 60 Tage',
  mittelwert_90: 'Mittelwert 90 Tage',
  gewichtet_30: 'Gewichteter Mittelwert 30 Tage',
  gewichtet_60: 'Gewichteter Mittelwert 60 Tage',
  gewichtet_90: 'Gewichteter Mittelwert 90 Tage',
  keine: 'Keine',
}

export function isGewichtet(art: Berechnungsart): boolean {
  return art === 'gewichtet_30' || art === 'gewichtet_60' || art === 'gewichtet_90'
}

export interface AbsatzEinstellung {
  id?: string
  sales_plattform_id: string
  produkt_id: string
  berechnungsart: Berechnungsart
  gewichtung_erstes_drittel: number | null
  gewichtung_zweites_drittel: number | null
  gewichtung_drittes_drittel: number | null
}

function defaultEinstellung(plattformId: string, produktId: string): AbsatzEinstellung {
  return {
    sales_plattform_id: plattformId,
    produkt_id: produktId,
    berechnungsart: 'keine',
    gewichtung_erstes_drittel: null,
    gewichtung_zweites_drittel: null,
    gewichtung_drittes_drittel: null,
  }
}

export function useAbsatzEinstellungen(plattformId: string | null) {
  const [einstellungen, setEinstellungen] = useState<AbsatzEinstellung[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!plattformId) return
    setLoading(true)
    setError(null)
    fetch(`/api/absatz-einstellungen?plattform_id=${plattformId}`)
      .then(r => {
        if (!r.ok) throw new Error('API-Fehler')
        return r.json()
      })
      .then((data: AbsatzEinstellung[]) => {
        setEinstellungen(data)
        setLoading(false)
      })
      .catch(() => {
        setError('Fehler beim Laden der Absatzeinstellungen.')
        setLoading(false)
      })
  }, [plattformId])

  const getEinstellung = useCallback(
    (produktId: string): AbsatzEinstellung => {
      if (!plattformId) return defaultEinstellung('', produktId)
      return (
        einstellungen.find(e => e.produkt_id === produktId) ??
        defaultEinstellung(plattformId, produktId)
      )
    },
    [einstellungen, plattformId]
  )

  const upsert = useCallback(
    async (patch: Omit<AbsatzEinstellung, 'id'>): Promise<void> => {
      const isSame = (e: AbsatzEinstellung) =>
        e.sales_plattform_id === patch.sales_plattform_id && e.produkt_id === patch.produkt_id

      const previous = einstellungen.find(isSame)

      setEinstellungen(curr => {
        if (curr.some(isSame)) return curr.map(e => (isSame(e) ? { ...e, ...patch } : e))
        return [...curr, patch]
      })

      const res = await fetch('/api/absatz-einstellungen', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(patch),
      })

      if (!res.ok) {
        setEinstellungen(curr => {
          if (previous) return curr.map(e => (isSame(e) ? previous : e))
          return curr.filter(e => !isSame(e))
        })
        throw new Error('Speichern fehlgeschlagen')
      }
    },
    [einstellungen]
  )

  return { einstellungen, loading, error, getEinstellung, upsert }
}
