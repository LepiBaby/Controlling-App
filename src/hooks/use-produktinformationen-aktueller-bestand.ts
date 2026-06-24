'use client'

import { useState, useEffect, useCallback } from 'react'
import { produktinformationenBasis } from '@/lib/produktinformationen-api'

export interface AktuellerBestandEintrag {
  id?: string
  produkt_id: string
  bestand: number | null
}

// versionId optional: ohne → global; mit → versionsgebunden.
export function useProduktinformationenAktuellerBestand(versionId?: string) {
  const basis = produktinformationenBasis(versionId)
  const [eintraege, setEintraege] = useState<AktuellerBestandEintrag[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    setLoading(true)
    setError(null)
    fetch(`${basis}/aktueller-bestand`)
      .then(r => {
        if (!r.ok) throw new Error('API-Fehler')
        return r.json()
      })
      .then((data: AktuellerBestandEintrag[]) => {
        setEintraege(data ?? [])
        setLoading(false)
      })
      .catch(() => {
        setError('Fehler beim Laden der Bestandsdaten.')
        setLoading(false)
      })
  }, [basis])

  const getEintrag = useCallback(
    (produktId: string): AktuellerBestandEintrag =>
      eintraege.find(e => e.produkt_id === produktId) ?? {
        produkt_id: produktId,
        bestand: null,
      },
    [eintraege],
  )

  const upsert = useCallback(
    async (patch: Omit<AktuellerBestandEintrag, 'id'>): Promise<void> => {
      const isSame = (e: AktuellerBestandEintrag) => e.produkt_id === patch.produkt_id
      const prev = eintraege.find(isSame)

      setEintraege(curr => {
        if (curr.some(isSame)) return curr.map(e => (isSame(e) ? { ...e, ...patch } : e))
        return [...curr, patch]
      })

      const res = await fetch(`${basis}/aktueller-bestand`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(patch),
      })

      if (!res.ok) {
        setEintraege(curr => {
          if (prev) return curr.map(e => (isSame(e) ? prev : e))
          return curr.filter(e => !isSame(e))
        })
        throw new Error('Speichern fehlgeschlagen')
      }
    },
    [eintraege, basis],
  )

  return { eintraege, loading, error, getEintrag, upsert }
}
