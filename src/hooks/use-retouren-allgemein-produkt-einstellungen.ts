'use client'

import { useState, useEffect, useCallback } from 'react'
import type { Berechnungsart } from './use-retouren-einstellungen'

export interface RetourenAllgemeinProduktEinstellung {
  id?: string
  produkt_id: string
  berechnungsart: Berechnungsart
  retourenhandling_kosten_euro_netto: number | null
}

export function useRetourenAllgemeinProduktEinstellungen() {
  const [einstellungen, setEinstellungen] = useState<RetourenAllgemeinProduktEinstellung[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    setLoading(true)
    setError(null)
    fetch('/api/retouren-allgemein-produkt-einstellungen')
      .then(r => {
        if (!r.ok) throw new Error('API-Fehler')
        return r.json()
      })
      .then((data: RetourenAllgemeinProduktEinstellung[]) => {
        setEinstellungen(data)
        setLoading(false)
      })
      .catch(() => {
        setError('Fehler beim Laden der allgemeinen Produkt-Retoureneinstellungen.')
        setLoading(false)
      })
  }, [])

  const getEinstellung = useCallback(
    (produktId: string): RetourenAllgemeinProduktEinstellung => {
      return (
        einstellungen.find(e => e.produkt_id === produktId) ?? {
          produkt_id: produktId,
          berechnungsart: 'keine',
          retourenhandling_kosten_euro_netto: null,
        }
      )
    },
    [einstellungen]
  )

  const upsert = useCallback(
    async (patch: Omit<RetourenAllgemeinProduktEinstellung, 'id'>): Promise<void> => {
      const isSame = (e: RetourenAllgemeinProduktEinstellung) => e.produkt_id === patch.produkt_id
      const previous = einstellungen.find(isSame)

      setEinstellungen(curr => {
        if (curr.some(isSame)) return curr.map(e => (isSame(e) ? { ...e, ...patch } : e))
        return [...curr, patch]
      })

      const res = await fetch('/api/retouren-allgemein-produkt-einstellungen', {
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
