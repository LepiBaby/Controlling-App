'use client'

import { useState, useEffect, useCallback } from 'react'

export interface ContainerGlobal {
  volumen_20dc_m3: number | null
  volumen_40dc_m3: number | null
  volumen_40hq_m3: number | null
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

const DEFAULT_CONTAINER_GLOBAL: ContainerGlobal = {
  volumen_20dc_m3: null,
  volumen_40dc_m3: null,
  volumen_40hq_m3: null,
}

export function useProduktinformationenContainer() {
  const [containerGlobal, setContainerGlobal] = useState<ContainerGlobal>(DEFAULT_CONTAINER_GLOBAL)
  const [kapazitaeten, setKapazitaeten] = useState<Containerkapazitaet[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    setLoading(true)
    setError(null)
    Promise.all([
      fetch('/api/produktinformationen/container-global').then(r => {
        if (!r.ok) throw new Error('API-Fehler')
        return r.json()
      }),
      fetch('/api/produktinformationen/containerkapazitaet').then(r => {
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
  }, [])

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

  const upsertContainerGlobal = useCallback(
    async (patch: Partial<ContainerGlobal>): Promise<void> => {
      const prev = { ...containerGlobal }
      setContainerGlobal(curr => ({ ...curr, ...patch }))

      const res = await fetch('/api/produktinformationen/container-global', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...containerGlobal, ...patch }),
      })

      if (!res.ok) {
        setContainerGlobal(prev)
        throw new Error('Speichern fehlgeschlagen')
      }
    },
    [containerGlobal],
  )

  const upsertKapazitaet = useCallback(
    async (patch: Omit<Containerkapazitaet, 'id'>): Promise<void> => {
      const isSame = (k: Containerkapazitaet) => k.produkt_id === patch.produkt_id
      const prev = kapazitaeten.find(isSame)

      setKapazitaeten(curr => {
        if (curr.some(isSame)) return curr.map(k => (isSame(k) ? { ...k, ...patch } : k))
        return [...curr, patch]
      })

      const res = await fetch('/api/produktinformationen/containerkapazitaet', {
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
    [kapazitaeten],
  )

  return {
    containerGlobal,
    kapazitaeten,
    loading,
    error,
    getKapazitaet,
    upsertContainerGlobal,
    upsertKapazitaet,
  }
}
