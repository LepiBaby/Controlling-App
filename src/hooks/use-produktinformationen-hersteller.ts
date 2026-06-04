'use client'

import { useState, useEffect, useCallback } from 'react'

export interface Hersteller {
  id: string
  name: string
}

export interface HerstellerZuordnung {
  id?: string
  produkt_id: string
  hersteller_id: string | null
}

export function useProduktinformationenHersteller() {
  const [hersteller, setHersteller] = useState<Hersteller[]>([])
  const [zuordnungen, setZuordnungen] = useState<HerstellerZuordnung[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    setLoading(true)
    setError(null)
    Promise.all([
      fetch('/api/produktinformationen/hersteller').then(r => {
        if (!r.ok) throw new Error('API-Fehler')
        return r.json()
      }),
      fetch('/api/produktinformationen/hersteller-zuordnung').then(r => {
        if (!r.ok) throw new Error('API-Fehler')
        return r.json()
      }),
    ])
      .then(([h, z]: [Hersteller[], HerstellerZuordnung[]]) => {
        setHersteller(h)
        setZuordnungen(z)
        setLoading(false)
      })
      .catch(() => {
        setError('Fehler beim Laden der Herstellerdaten.')
        setLoading(false)
      })
  }, [])

  const getZuordnung = useCallback(
    (produktId: string): HerstellerZuordnung | null =>
      zuordnungen.find(z => z.produkt_id === produktId) ?? null,
    [zuordnungen],
  )

  const createAndAssign = useCallback(
    async (produktId: string, name: string): Promise<void> => {
      const createRes = await fetch('/api/produktinformationen/hersteller', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name }),
      })
      if (!createRes.ok) throw new Error('Fehler beim Anlegen des Herstellers.')
      const created: Hersteller = await createRes.json()
      setHersteller(prev =>
        [...prev, created].sort((a, b) => a.name.localeCompare(b.name, 'de')),
      )
      await assignHersteller(produktId, created.id)
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  )

  const assignHersteller = useCallback(
    async (produktId: string, herstellerId: string): Promise<void> => {
      const prev = zuordnungen.find(z => z.produkt_id === produktId)

      setZuordnungen(curr => {
        const exists = curr.some(z => z.produkt_id === produktId)
        if (exists)
          return curr.map(z =>
            z.produkt_id === produktId ? { ...z, hersteller_id: herstellerId } : z,
          )
        return [...curr, { produkt_id: produktId, hersteller_id: herstellerId }]
      })

      const res = await fetch('/api/produktinformationen/hersteller-zuordnung', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ produkt_id: produktId, hersteller_id: herstellerId }),
      })

      if (!res.ok) {
        setZuordnungen(curr => {
          if (prev) return curr.map(z => (z.produkt_id === produktId ? prev : z))
          return curr.filter(z => z.produkt_id !== produktId)
        })
        throw new Error('Fehler beim Zuordnen des Herstellers.')
      }
    },
    [zuordnungen],
  )

  return { hersteller, zuordnungen, loading, error, getZuordnung, createAndAssign, assignHersteller }
}
