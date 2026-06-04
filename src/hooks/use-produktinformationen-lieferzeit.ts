'use client'

import { useState, useEffect, useCallback } from 'react'

export interface Lieferzeit {
  id?: string
  produkt_id: string
  produktionszeit_tage: number | null
  zwischenzeit_tage: number | null
  shipping_zeit_tage: number | null
  entladungszeit_tage: number | null
}

export function berechneGesamtzeit(lz: Lieferzeit): number | null {
  const values = [
    lz.produktionszeit_tage,
    lz.zwischenzeit_tage,
    lz.shipping_zeit_tage,
    lz.entladungszeit_tage,
  ].filter((v): v is number => v != null)
  if (values.length === 0) return null
  return values.reduce((sum, v) => sum + v, 0)
}

export function useProduktinformationenLieferzeit() {
  const [lieferzeiten, setLieferzeiten] = useState<Lieferzeit[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    setLoading(true)
    setError(null)
    fetch('/api/produktinformationen/lieferzeit')
      .then(r => {
        if (!r.ok) throw new Error('API-Fehler')
        return r.json()
      })
      .then((data: Lieferzeit[]) => {
        setLieferzeiten(data ?? [])
        setLoading(false)
      })
      .catch(() => {
        setError('Fehler beim Laden der Lieferzeitdaten.')
        setLoading(false)
      })
  }, [])

  const getLieferzeit = useCallback(
    (produktId: string): Lieferzeit =>
      lieferzeiten.find(l => l.produkt_id === produktId) ?? {
        produkt_id: produktId,
        produktionszeit_tage: null,
        zwischenzeit_tage: null,
        shipping_zeit_tage: null,
        entladungszeit_tage: null,
      },
    [lieferzeiten],
  )

  const upsert = useCallback(
    async (patch: Omit<Lieferzeit, 'id'>): Promise<void> => {
      const isSame = (l: Lieferzeit) => l.produkt_id === patch.produkt_id
      const prev = lieferzeiten.find(isSame)

      setLieferzeiten(curr => {
        if (curr.some(isSame)) return curr.map(l => (isSame(l) ? { ...l, ...patch } : l))
        return [...curr, patch]
      })

      const res = await fetch('/api/produktinformationen/lieferzeit', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(patch),
      })

      if (!res.ok) {
        setLieferzeiten(curr => {
          if (prev) return curr.map(l => (isSame(l) ? prev : l))
          return curr.filter(l => !isSame(l))
        })
        throw new Error('Speichern fehlgeschlagen')
      }
    },
    [lieferzeiten],
  )

  return { lieferzeiten, loading, error, getLieferzeit, upsert }
}
