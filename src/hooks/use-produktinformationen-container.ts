'use client'

import { useState, useEffect, useCallback } from 'react'
import { produktinformationenBasis } from '@/lib/produktinformationen-api'

export interface ContainerGlobal {
  volumen_20dc: number | null
  volumen_40hq: number | null
}

export interface Containerkapazitaet {
  id?: string
  produkt_id: string
  laenge_cm: number | null
  breite_cm: number | null
  hoehe_cm: number | null
}

export function berechneStueckvolumen(
  laenge: number | null,
  breite: number | null,
  hoehe: number | null,
): number | null {
  if (laenge == null || breite == null || hoehe == null) return null
  if (laenge <= 0 || breite <= 0 || hoehe <= 0) return null
  return laenge * breite * hoehe
}

export function berechneMaxKapazitaet(
  containerVolumenM3: number | null,
  stueckvolumenCm3: number | null,
): number | null {
  if (containerVolumenM3 == null || stueckvolumenCm3 == null) return null
  if (containerVolumenM3 <= 0 || stueckvolumenCm3 <= 0) return null
  const containerCm3 = containerVolumenM3 * 1_000_000
  return Math.floor(containerCm3 / stueckvolumenCm3)
}

export function perContainerMengen(
  total: number,
  anz40hq: number,
  anz20dc: number,
  max40hq: number | null,
  max20dc: number | null,
): { hqAmounts: number[]; dcAmounts: number[] } {
  let remaining = total
  const hqAmounts: number[] = []
  if (max40hq != null && max40hq > 0) {
    for (let i = 0; i < anz40hq; i++) {
      const amount = Math.min(max40hq, remaining)
      hqAmounts.push(amount)
      remaining = Math.max(0, remaining - amount)
    }
  }
  const dcAmounts: number[] = []
  if (max20dc != null && max20dc > 0) {
    for (let i = 0; i < anz20dc; i++) {
      const amount = Math.min(max20dc, remaining)
      dcAmounts.push(amount)
      remaining = Math.max(0, remaining - amount)
    }
  }
  return { hqAmounts, dcAmounts }
}

const DEFAULT_CONTAINER_GLOBAL: ContainerGlobal = {
  volumen_20dc: null,
  volumen_40hq: null,
}

// versionId optional (PROJ-77): ohne → global; mit → versionsgebunden.
export function useProduktinformationenContainer(versionId?: string) {
  const basis = produktinformationenBasis(versionId)
  const [containerGlobal, setContainerGlobal] = useState<ContainerGlobal>(DEFAULT_CONTAINER_GLOBAL)
  const [kapazitaeten, setKapazitaeten] = useState<Containerkapazitaet[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    setLoading(true)
    setError(null)
    Promise.all([
      fetch(`${basis}/container-global`).then(r => {
        if (!r.ok) throw new Error('API-Fehler')
        return r.json()
      }),
      fetch(`${basis}/containerkapazitaet`).then(r => {
        if (!r.ok) throw new Error('API-Fehler')
        return r.json()
      }),
    ])
      .then(([g, k]: [ContainerGlobal, Containerkapazitaet[]]) => {
        setContainerGlobal(g ?? DEFAULT_CONTAINER_GLOBAL)
        setKapazitaeten(k ?? [])
        setLoading(false)
      })
      .catch(() => {
        setError('Fehler beim Laden der Containerkapazitätsdaten.')
        setLoading(false)
      })
  }, [basis])

  const getKapazitaet = useCallback(
    (produktId: string): Containerkapazitaet =>
      kapazitaeten.find(k => k.produkt_id === produktId) ?? {
        produkt_id: produktId,
        laenge_cm: null,
        breite_cm: null,
        hoehe_cm: null,
      },
    [kapazitaeten],
  )

  const getMaxKapazitaet = useCallback(
    (produktId: string): { max_40hq: number | null; max_20dc: number | null } => {
      const k = kapazitaeten.find(kk => kk.produkt_id === produktId) ?? { laenge_cm: null, breite_cm: null, hoehe_cm: null }
      const stueck = berechneStueckvolumen(k.laenge_cm, k.breite_cm, k.hoehe_cm)
      return {
        max_40hq: berechneMaxKapazitaet(containerGlobal.volumen_40hq, stueck),
        max_20dc: berechneMaxKapazitaet(containerGlobal.volumen_20dc, stueck),
      }
    },
    [kapazitaeten, containerGlobal],
  )

  const upsertContainerGlobal = useCallback(
    async (patch: Partial<ContainerGlobal>): Promise<void> => {
      const prev = { ...containerGlobal }
      setContainerGlobal(curr => ({ ...curr, ...patch }))

      const res = await fetch(`${basis}/container-global`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...containerGlobal, ...patch }),
      })

      if (!res.ok) {
        setContainerGlobal(prev)
        throw new Error('Speichern fehlgeschlagen')
      }
    },
    [containerGlobal, basis],
  )

  const upsertKapazitaet = useCallback(
    async (patch: Omit<Containerkapazitaet, 'id'>): Promise<void> => {
      const isSame = (k: Containerkapazitaet) => k.produkt_id === patch.produkt_id
      const prev = kapazitaeten.find(isSame)

      setKapazitaeten(curr => {
        if (curr.some(isSame)) return curr.map(k => (isSame(k) ? { ...k, ...patch } : k))
        return [...curr, patch]
      })

      const res = await fetch(`${basis}/containerkapazitaet`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(patch),
      })

      if (!res.ok) {
        setKapazitaeten(curr => {
          if (prev) return curr.map(k => (isSame(k) ? prev : k))
          return curr.filter(k => !isSame(k))
        })
        throw new Error('Speichern fehlgeschlagen')
      }
    },
    [kapazitaeten, basis],
  )

  return {
    containerGlobal,
    kapazitaeten,
    loading,
    error,
    getKapazitaet,
    getMaxKapazitaet,
    upsertContainerGlobal,
    upsertKapazitaet,
  }
}
