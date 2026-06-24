'use client'

import { useState, useEffect, useCallback } from 'react'
import { produktinformationenBasis } from '@/lib/produktinformationen-api'

export interface Lieferzeit {
  id?: string
  produkt_id: string
  pufferzeit_tage: number | null
  produktionszeit_tage: number | null
  zwischenzeit_tage: number | null
  shipping_zeit_tage: number | null
  entladungszeit_tage: number | null
}

export function berechneGesamtzeit(lz: Lieferzeit): number | null {
  const values = [
    lz.pufferzeit_tage,
    lz.produktionszeit_tage,
    lz.zwischenzeit_tage,
    lz.shipping_zeit_tage,
    lz.entladungszeit_tage,
  ].filter((v): v is number => v != null)
  if (values.length === 0) return null
  return values.reduce((sum, v) => sum + v, 0)
}

// versionId optional (PROJ-77): ohne → global; mit → versionsgebunden.
export function useProduktinformationenLieferzeit(versionId?: string) {
  const basis = produktinformationenBasis(versionId)
  const [lieferzeiten, setLieferzeiten] = useState<Lieferzeit[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    setLoading(true)
    setError(null)
    fetch(`${basis}/lieferzeit`)
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
  }, [basis])

  const getLieferzeit = useCallback(
    (produktId: string): Lieferzeit =>
      lieferzeiten.find(l => l.produkt_id === produktId) ?? {
        produkt_id: produktId,
        pufferzeit_tage: null,
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

      const res = await fetch(`${basis}/lieferzeit`, {
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
    [lieferzeiten, basis],
  )

  return { lieferzeiten, loading, error, getLieferzeit, upsert }
}
