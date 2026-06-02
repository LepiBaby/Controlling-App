'use client'

import { useState, useEffect, useCallback } from 'react'

export interface LagerausgabenEinstellung {
  id?: string
  sales_plattform_id: string
  produkt_id: string
  lagerkosten_euro_m3: number | null
}

export function useLagerausgabenEinstellungen(plattformId: string | null) {
  const [einstellungen, setEinstellungen] = useState<LagerausgabenEinstellung[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(() => {
    if (!plattformId) return
    setLoading(true)
    setError(null)
    fetch(`/api/lagerausgaben-einstellungen?plattform_id=${plattformId}`)
      .then(r => {
        if (!r.ok) throw new Error('API-Fehler')
        return r.json()
      })
      .then((data: LagerausgabenEinstellung[]) => {
        setEinstellungen(data)
        setLoading(false)
      })
      .catch(() => {
        setError('Fehler beim Laden der Lagerausgaben-Einstellungen.')
        setLoading(false)
      })
  }, [plattformId])

  useEffect(() => {
    load()
  }, [load])

  const getEinstellung = useCallback(
    (produktId: string): LagerausgabenEinstellung => {
      if (!plattformId)
        return { sales_plattform_id: '', produkt_id: produktId, lagerkosten_euro_m3: null }
      return (
        einstellungen.find(e => e.produkt_id === produktId) ?? {
          sales_plattform_id: plattformId,
          produkt_id: produktId,
          lagerkosten_euro_m3: null,
        }
      )
    },
    [einstellungen, plattformId]
  )

  const upsert = useCallback(
    async (patch: Omit<LagerausgabenEinstellung, 'id'>): Promise<void> => {
      const isSame = (e: LagerausgabenEinstellung) =>
        e.sales_plattform_id === patch.sales_plattform_id && e.produkt_id === patch.produkt_id

      const previous = einstellungen.find(isSame)

      setEinstellungen(curr => {
        if (curr.some(isSame)) return curr.map(e => (isSame(e) ? { ...e, ...patch } : e))
        return [...curr, patch]
      })

      const res = await fetch('/api/lagerausgaben-einstellungen', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(patch),
      })

      if (!res.ok) {
        setEinstellungen(curr => {
          if (previous) return curr.map(e => (isSame(e) ? previous : e))
          return curr.filter(e => !isSame(e))
        })
        throw new Error('Speichern fehlgeschlagen')
      }
    },
    [einstellungen]
  )

  const batchUpsert = useCallback(
    async (
      salesPlattformId: string,
      lagerkostenEuroM3: number | null,
      produktIds: string[]
    ): Promise<void> => {
      const previous = [...einstellungen]

      setEinstellungen(curr => {
        const result = [...curr]
        for (const produktId of produktIds) {
          const idx = result.findIndex(
            e => e.sales_plattform_id === salesPlattformId && e.produkt_id === produktId
          )
          if (idx >= 0) {
            result[idx] = { ...result[idx], lagerkosten_euro_m3: lagerkostenEuroM3 }
          } else {
            result.push({
              sales_plattform_id: salesPlattformId,
              produkt_id: produktId,
              lagerkosten_euro_m3: lagerkostenEuroM3,
            })
          }
        }
        return result
      })

      const res = await fetch('/api/lagerausgaben-einstellungen/batch', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sales_plattform_id: salesPlattformId,
          lagerkosten_euro_m3: lagerkostenEuroM3,
        }),
      })

      if (!res.ok) {
        setEinstellungen(previous)
        throw new Error('Batch-Upsert fehlgeschlagen')
      }

      const data: LagerausgabenEinstellung[] = await res.json()
      setEinstellungen(curr => {
        const others = curr.filter(e => e.sales_plattform_id !== salesPlattformId)
        return [...others, ...data]
      })
    },
    [einstellungen]
  )

  return { einstellungen, loading, error, getEinstellung, upsert, batchUpsert }
}
