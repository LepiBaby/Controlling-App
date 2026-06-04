'use client'

import { useState, useEffect, useCallback } from 'react'

export type MoqEbene = 'produkt' | 'sku'

export interface MoqEinstellung {
  id?: string
  produkt_id: string
  ebene: MoqEbene
  moq: number | null
}

export interface MoqSkuEinstellung {
  id?: string
  sku_id: string
  moq: number | null
}

export function useProduktinformationenMoq() {
  const [moqEinstellungen, setMoqEinstellungen] = useState<MoqEinstellung[]>([])
  const [moqSkuEinstellungen, setMoqSkuEinstellungen] = useState<MoqSkuEinstellung[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    setLoading(true)
    setError(null)
    fetch('/api/produktinformationen/moq')
      .then(r => {
        if (!r.ok) throw new Error('API-Fehler')
        return r.json()
      })
      .then((data: { produkt: MoqEinstellung[]; sku: MoqSkuEinstellung[] }) => {
        setMoqEinstellungen(data.produkt ?? [])
        setMoqSkuEinstellungen(data.sku ?? [])
        setLoading(false)
      })
      .catch(() => {
        setError('Fehler beim Laden der MOQ-Einstellungen.')
        setLoading(false)
      })
  }, [])

  const getMoqEinstellung = useCallback(
    (produktId: string): MoqEinstellung =>
      moqEinstellungen.find(e => e.produkt_id === produktId) ?? {
        produkt_id: produktId,
        ebene: 'produkt',
        moq: null,
      },
    [moqEinstellungen],
  )

  const getMoqSkuEinstellung = useCallback(
    (skuId: string): MoqSkuEinstellung =>
      moqSkuEinstellungen.find(e => e.sku_id === skuId) ?? {
        sku_id: skuId,
        moq: null,
      },
    [moqSkuEinstellungen],
  )

  const upsertMoq = useCallback(
    async (patch: Omit<MoqEinstellung, 'id'>): Promise<void> => {
      const isSame = (e: MoqEinstellung) => e.produkt_id === patch.produkt_id
      const prev = moqEinstellungen.find(isSame)

      setMoqEinstellungen(curr => {
        if (curr.some(isSame)) return curr.map(e => (isSame(e) ? { ...e, ...patch } : e))
        return [...curr, patch]
      })

      const res = await fetch('/api/produktinformationen/moq', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(patch),
      })

      if (!res.ok) {
        setMoqEinstellungen(curr => {
          if (prev) return curr.map(e => (isSame(e) ? prev : e))
          return curr.filter(e => !isSame(e))
        })
        throw new Error('Speichern fehlgeschlagen')
      }
    },
    [moqEinstellungen],
  )

  const upsertMoqSku = useCallback(
    async (patch: Omit<MoqSkuEinstellung, 'id'>): Promise<void> => {
      const isSame = (e: MoqSkuEinstellung) => e.sku_id === patch.sku_id
      const prev = moqSkuEinstellungen.find(isSame)

      setMoqSkuEinstellungen(curr => {
        if (curr.some(isSame)) return curr.map(e => (isSame(e) ? { ...e, ...patch } : e))
        return [...curr, patch]
      })

      const res = await fetch('/api/produktinformationen/moq-sku', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(patch),
      })

      if (!res.ok) {
        setMoqSkuEinstellungen(curr => {
          if (prev) return curr.map(e => (isSame(e) ? prev : e))
          return curr.filter(e => !isSame(e))
        })
        throw new Error('Speichern fehlgeschlagen')
      }
    },
    [moqSkuEinstellungen],
  )

  return {
    moqEinstellungen,
    moqSkuEinstellungen,
    loading,
    error,
    getMoqEinstellung,
    getMoqSkuEinstellung,
    upsertMoq,
    upsertMoqSku,
  }
}
