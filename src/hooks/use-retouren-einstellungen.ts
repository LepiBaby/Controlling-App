'use client'

import { useState, useEffect, useCallback } from 'react'

export type Berechnungsart =
  | 'keine'
  | 'mittelwert_14'
  | 'mittelwert_30'
  | 'mittelwert_60'
  | 'mittelwert_90'

export interface RetourenEinstellung {
  id?: string
  sales_plattform_id: string
  produkt_id: string
  berechnungsart: Berechnungsart
  rueckversandkosten_euro_netto: number | null
  retourenhandling_kosten_euro_netto: number | null
}

export const BERECHNUNGSARTEN: Berechnungsart[] = [
  'keine',
  'mittelwert_14',
  'mittelwert_30',
  'mittelwert_60',
  'mittelwert_90',
]

export const BERECHNUNGSART_LABELS: Record<Berechnungsart, string> = {
  keine: 'Keine',
  mittelwert_14: 'Mittelwert 14 Tage',
  mittelwert_30: 'Mittelwert 30 Tage',
  mittelwert_60: 'Mittelwert 60 Tage',
  mittelwert_90: 'Mittelwert 90 Tage',
}

export function useRetourenEinstellungen(plattformId: string | null) {
  const [einstellungen, setEinstellungen] = useState<RetourenEinstellung[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(() => {
    if (!plattformId) return
    setLoading(true)
    setError(null)
    fetch(`/api/retouren-einstellungen?plattform_id=${plattformId}`)
      .then(r => {
        if (!r.ok) throw new Error('API-Fehler')
        return r.json()
      })
      .then((data: RetourenEinstellung[]) => {
        setEinstellungen(data)
        setLoading(false)
      })
      .catch(() => {
        setError('Fehler beim Laden der Retoureneinstellungen.')
        setLoading(false)
      })
  }, [plattformId])

  useEffect(() => {
    load()
  }, [load])

  const getEinstellung = useCallback(
    (produktId: string): RetourenEinstellung => {
      if (!plattformId)
        return {
          sales_plattform_id: '',
          produkt_id: produktId,
          berechnungsart: 'keine',
          rueckversandkosten_euro_netto: null,
          retourenhandling_kosten_euro_netto: null,
        }
      return (
        einstellungen.find(e => e.produkt_id === produktId) ?? {
          sales_plattform_id: plattformId,
          produkt_id: produktId,
          berechnungsart: 'keine',
          rueckversandkosten_euro_netto: null,
          retourenhandling_kosten_euro_netto: null,
        }
      )
    },
    [einstellungen, plattformId]
  )

  const upsert = useCallback(
    async (patch: Omit<RetourenEinstellung, 'id'>): Promise<void> => {
      const isSame = (e: RetourenEinstellung) =>
        e.sales_plattform_id === patch.sales_plattform_id && e.produkt_id === patch.produkt_id

      const previous = einstellungen.find(isSame)

      setEinstellungen(curr => {
        if (curr.some(isSame)) return curr.map(e => (isSame(e) ? { ...e, ...patch } : e))
        return [...curr, patch]
      })

      const res = await fetch('/api/retouren-einstellungen', {
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
