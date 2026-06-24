'use client'

import { useState, useEffect, useCallback } from 'react'
import { produktinformationenBasis } from '@/lib/produktinformationen-api'

export interface Zahlungskonditionen {
  id?: string
  produkt_id: string
  vor_produktion_pct: number | null
  nach_produktion_pct: number | null
  nach_ankunft_pct: number | null
  zahlungsziel_vor_produktion_tage: number | null
  zahlungsziel_nach_produktion_tage: number | null
  zahlungsziel_nach_ankunft_tage: number | null
}

export function isProzentSummeGueltig(
  vor: number | null,
  nach: number | null,
  ankunft: number | null,
): boolean {
  if (vor == null || nach == null || ankunft == null) return false
  return Math.abs(vor + nach + ankunft - 100) < 0.01
}

export function alleProzentGesetzt(
  vor: number | null,
  nach: number | null,
  ankunft: number | null,
): boolean {
  return vor != null && nach != null && ankunft != null
}

// versionId optional (PROJ-77): ohne → global; mit → versionsgebunden.
export function useProduktinformationenZahlungskonditionen(versionId?: string) {
  const basis = produktinformationenBasis(versionId)
  const [konditionen, setKonditionen] = useState<Zahlungskonditionen[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    setLoading(true)
    setError(null)
    fetch(`${basis}/zahlungskonditionen`)
      .then(r => {
        if (!r.ok) throw new Error('API-Fehler')
        return r.json()
      })
      .then((data: Zahlungskonditionen[]) => {
        setKonditionen(data ?? [])
        setLoading(false)
      })
      .catch(() => {
        setError('Fehler beim Laden der Zahlungskonditionen.')
        setLoading(false)
      })
  }, [basis])

  const getKonditionen = useCallback(
    (produktId: string): Zahlungskonditionen =>
      konditionen.find(k => k.produkt_id === produktId) ?? {
        produkt_id: produktId,
        vor_produktion_pct: null,
        nach_produktion_pct: null,
        nach_ankunft_pct: null,
        zahlungsziel_vor_produktion_tage: null,
        zahlungsziel_nach_produktion_tage: null,
        zahlungsziel_nach_ankunft_tage: null,
      },
    [konditionen],
  )

  const upsert = useCallback(
    async (patch: Omit<Zahlungskonditionen, 'id'>): Promise<void> => {
      const isSame = (k: Zahlungskonditionen) => k.produkt_id === patch.produkt_id
      const prev = konditionen.find(isSame)

      setKonditionen(curr => {
        if (curr.some(isSame)) return curr.map(k => (isSame(k) ? { ...k, ...patch } : k))
        return [...curr, patch]
      })

      const res = await fetch(`${basis}/zahlungskonditionen`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(patch),
      })

      if (!res.ok) {
        setKonditionen(curr => {
          if (prev) return curr.map(k => (isSame(k) ? prev : k))
          return curr.filter(k => !isSame(k))
        })
        throw new Error('Speichern fehlgeschlagen')
      }
    },
    [konditionen, basis],
  )

  return { konditionen, loading, error, getKonditionen, upsert }
}
