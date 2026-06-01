'use client'

import { useState, useEffect, useCallback } from 'react'

export interface VersandausgabenEinstellung {
  id?: string
  sales_plattform_id: string
  produkt_id: string
  versandgebuehr_spediteur: number | null
  versandgebuehr_3pl: number | null
}

export function useVersandausgabenEinstellungen(plattformId: string | null) {
  const [einstellungen, setEinstellungen] = useState<VersandausgabenEinstellung[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!plattformId) return
    setLoading(true)
    setError(null)
    fetch(`/api/versandausgaben-einstellungen?plattform_id=${plattformId}`)
      .then(r => {
        if (!r.ok) throw new Error('API-Fehler')
        return r.json()
      })
      .then((data: VersandausgabenEinstellung[]) => {
        setEinstellungen(data)
        setLoading(false)
      })
      .catch(() => {
        setError('Fehler beim Laden der Versandausgaben-Einstellungen.')
        setLoading(false)
      })
  }, [plattformId])

  const getEinstellung = useCallback(
    (produktId: string): VersandausgabenEinstellung => {
      if (!plattformId)
        return {
          sales_plattform_id: '',
          produkt_id: produktId,
          versandgebuehr_spediteur: null,
          versandgebuehr_3pl: null,
        }
      return (
        einstellungen.find(e => e.produkt_id === produktId) ?? {
          sales_plattform_id: plattformId,
          produkt_id: produktId,
          versandgebuehr_spediteur: null,
          versandgebuehr_3pl: null,
        }
      )
    },
    [einstellungen, plattformId]
  )

  const upsert = useCallback(
    async (patch: Omit<VersandausgabenEinstellung, 'id'>): Promise<void> => {
      const isSame = (e: VersandausgabenEinstellung) =>
        e.sales_plattform_id === patch.sales_plattform_id && e.produkt_id === patch.produkt_id

      const previous = einstellungen.find(isSame)

      setEinstellungen(curr => {
        if (curr.some(isSame)) return curr.map(e => (isSame(e) ? { ...e, ...patch } : e))
        return [...curr, patch]
      })

      const res = await fetch('/api/versandausgaben-einstellungen', {
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
