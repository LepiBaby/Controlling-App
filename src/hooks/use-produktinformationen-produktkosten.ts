'use client'

import { useState, useEffect, useCallback } from 'react'
import { produktinformationenBasis } from '@/lib/produktinformationen-api'

export interface KostenGlobal {
  shipping_kosten_20dc: number | null
  shipping_kosten_40hq: number | null
  shipping_zahlungsziel_tage: number | null
  inspektion_kosten_20dc: number | null
  inspektion_kosten_40hq: number | null
  inspektion_zahlungsziel_tage: number | null
  einlagerung_kosten_20dc: number | null
  einlagerung_kosten_40hq: number | null
  einlagerung_zahlungsziel_tage: number | null
  zoll_zahlungsziel_tage: number | null
}

export interface Produktkosten {
  id?: string
  produkt_id: string
  warenkosten: number | null
  zollsatz_pct: number | null
}

const DEFAULT_KOSTEN_GLOBAL: KostenGlobal = {
  shipping_kosten_20dc: null,
  shipping_kosten_40hq: null,
  shipping_zahlungsziel_tage: null,
  inspektion_kosten_20dc: null,
  inspektion_kosten_40hq: null,
  inspektion_zahlungsziel_tage: null,
  einlagerung_kosten_20dc: null,
  einlagerung_kosten_40hq: null,
  einlagerung_zahlungsziel_tage: null,
  zoll_zahlungsziel_tage: null,
}

// versionId optional (PROJ-77): ohne → global; mit → versionsgebunden.
export function useProduktinformationenProduktkosten(versionId?: string) {
  const basis = produktinformationenBasis(versionId)
  const [kostenGlobal, setKostenGlobal] = useState<KostenGlobal>(DEFAULT_KOSTEN_GLOBAL)
  const [produktkosten, setProduktkosten] = useState<Produktkosten[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    setLoading(true)
    setError(null)
    Promise.all([
      fetch(`${basis}/kosten-global`).then(r => {
        if (!r.ok) throw new Error('API-Fehler')
        return r.json()
      }),
      fetch(`${basis}/produktkosten`).then(r => {
        if (!r.ok) throw new Error('API-Fehler')
        return r.json()
      }),
    ])
      .then(([g, p]: [KostenGlobal, Produktkosten[]]) => {
        setKostenGlobal(g ?? DEFAULT_KOSTEN_GLOBAL)
        setProduktkosten(p ?? [])
        setLoading(false)
      })
      .catch(() => {
        setError('Fehler beim Laden der Produktkostendaten.')
        setLoading(false)
      })
  }, [basis])

  const getProduktkosten = useCallback(
    (produktId: string): Produktkosten =>
      produktkosten.find(p => p.produkt_id === produktId) ?? {
        produkt_id: produktId,
        warenkosten: null,
        zollsatz_pct: null,
      },
    [produktkosten],
  )

  const upsertKostenGlobal = useCallback(
    async (patch: Partial<KostenGlobal>): Promise<void> => {
      const prev = { ...kostenGlobal }
      setKostenGlobal(curr => ({ ...curr, ...patch }))

      const res = await fetch(`${basis}/kosten-global`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...kostenGlobal, ...patch }),
      })

      if (!res.ok) {
        setKostenGlobal(prev)
        throw new Error('Speichern fehlgeschlagen')
      }
    },
    [kostenGlobal, basis],
  )

  const upsertProduktkosten = useCallback(
    async (patch: Omit<Produktkosten, 'id'>): Promise<void> => {
      const isSame = (p: Produktkosten) => p.produkt_id === patch.produkt_id
      const prev = produktkosten.find(isSame)

      setProduktkosten(curr => {
        if (curr.some(isSame)) return curr.map(p => (isSame(p) ? { ...p, ...patch } : p))
        return [...curr, patch]
      })

      const res = await fetch(`${basis}/produktkosten`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(patch),
      })

      if (!res.ok) {
        setProduktkosten(curr => {
          if (prev) return curr.map(p => (isSame(p) ? prev : p))
          return curr.filter(p => !isSame(p))
        })
        throw new Error('Speichern fehlgeschlagen')
      }
    },
    [produktkosten, basis],
  )

  return {
    kostenGlobal,
    produktkosten,
    loading,
    error,
    getProduktkosten,
    upsertKostenGlobal,
    upsertProduktkosten,
  }
}
