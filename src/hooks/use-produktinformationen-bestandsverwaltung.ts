'use client'

import { useState, useEffect, useCallback } from 'react'

export interface BestandsverwaltungEinstellung {
  id?: string
  produkt_id: string
  sicherheitsbestand: number | null
  zielreichweite_monate: number | null
}

export function useProduktinformationenBestandsverwaltung() {
  const [einstellungen, setEinstellungen] = useState<BestandsverwaltungEinstellung[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    setLoading(true)
    setError(null)
    fetch('/api/produktinformationen/bestandsverwaltung')
      .then(r => {
        if (!r.ok) throw new Error('API-Fehler')
        return r.json()
      })
      .then((data: BestandsverwaltungEinstellung[]) => {
        setEinstellungen(data ?? [])
        setLoading(false)
      })
      .catch(() => {
        setError('Fehler beim Laden der Bestandsverwaltungsdaten.')
        setLoading(false)
      })
  }, [])

  const getEinstellung = useCallback(
    (produktId: string): BestandsverwaltungEinstellung =>
      einstellungen.find(e => e.produkt_id === produktId) ?? {
        produkt_id: produktId,
        sicherheitsbestand: null,
        zielreichweite_monate: null,
      },
    [einstellungen],
  )

  const upsert = useCallback(
    async (patch: Omit<BestandsverwaltungEinstellung, 'id'>): Promise<void> => {
      const isSame = (e: BestandsverwaltungEinstellung) => e.produkt_id === patch.produkt_id
      const prev = einstellungen.find(isSame)

      setEinstellungen(curr => {
        if (curr.some(isSame)) return curr.map(e => (isSame(e) ? { ...e, ...patch } : e))
        return [...curr, patch]
      })

      const res = await fetch('/api/produktinformationen/bestandsverwaltung', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(patch),
      })

      if (!res.ok) {
        setEinstellungen(curr => {
          if (prev) return curr.map(e => (isSame(e) ? prev : e))
          return curr.filter(e => !isSame(e))
        })
        throw new Error('Speichern fehlgeschlagen')
      }
    },
    [einstellungen],
  )

  return { einstellungen, loading, error, getEinstellung, upsert }
}
