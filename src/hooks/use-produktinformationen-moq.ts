'use client'

import { useState, useEffect, useCallback } from 'react'
import { produktinformationenBasis } from '@/lib/produktinformationen-api'

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

// versionId optional (PROJ-77). withSku=false überspringt den SKU-Abruf — in der
// Langfristigen Planung haben Produkte keine SKUs, MOQ wird nur auf Produktebene gepflegt.
export function useProduktinformationenMoq(versionId?: string, withSku: boolean = true) {
  const basis = produktinformationenBasis(versionId)
  const [moqEinstellungen, setMoqEinstellungen] = useState<MoqEinstellung[]>([])
  const [moqSkuEinstellungen, setMoqSkuEinstellungen] = useState<MoqSkuEinstellung[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    setLoading(true)
    setError(null)
    const requests: Promise<unknown>[] = [
      fetch(`${basis}/moq`).then(r => {
        if (!r.ok) throw new Error('API-Fehler')
        return r.json()
      }),
    ]
    if (withSku) {
      requests.push(
        fetch(`${basis}/moq-sku`).then(r => {
          if (!r.ok) throw new Error('API-Fehler')
          return r.json()
        }),
      )
    }
    Promise.all(requests)
      .then(([moqData, moqSkuData]) => {
        setMoqEinstellungen((moqData as MoqEinstellung[]) ?? [])
        setMoqSkuEinstellungen((moqSkuData as MoqSkuEinstellung[]) ?? [])
        setLoading(false)
      })
      .catch(() => {
        setError('Fehler beim Laden der MOQ-Einstellungen.')
        setLoading(false)
      })
  }, [basis, withSku])

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

      const res = await fetch(`${basis}/moq`, {
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
    [moqEinstellungen, basis],
  )

  const upsertMoqSku = useCallback(
    async (patch: Omit<MoqSkuEinstellung, 'id'>): Promise<void> => {
      const isSame = (e: MoqSkuEinstellung) => e.sku_id === patch.sku_id
      const prev = moqSkuEinstellungen.find(isSame)

      setMoqSkuEinstellungen(curr => {
        if (curr.some(isSame)) return curr.map(e => (isSame(e) ? { ...e, ...patch } : e))
        return [...curr, patch]
      })

      const res = await fetch(`${basis}/moq-sku`, {
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
    [moqSkuEinstellungen, basis],
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
