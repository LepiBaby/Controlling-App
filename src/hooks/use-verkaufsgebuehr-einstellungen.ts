'use client'

import { useState, useEffect, useCallback } from 'react'

export interface VerkaufsgebuehrEinstellung {
  id?: string
  sales_plattform_id: string
  produkt_id: string
  verkaufsgebuehr_prozent: number | null
}

export function useVerkaufsgebuehrEinstellungen(plattformId: string | null) {
  const [einstellungen, setEinstellungen] = useState<VerkaufsgebuehrEinstellung[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!plattformId) return
    setLoading(true)
    setError(null)
    fetch(`/api/verkaufsgebuehr-einstellungen?plattform_id=${plattformId}`)
      .then(r => {
        if (!r.ok) throw new Error('API-Fehler')
        return r.json()
      })
      .then((data: VerkaufsgebuehrEinstellung[]) => {
        setEinstellungen(data)
        setLoading(false)
      })
      .catch(() => {
        setError('Fehler beim Laden der Verkaufsgebühr-Einstellungen.')
        setLoading(false)
      })
  }, [plattformId])

  const getEinstellung = useCallback(
    (produktId: string): VerkaufsgebuehrEinstellung => {
      if (!plattformId) return { sales_plattform_id: '', produkt_id: produktId, verkaufsgebuehr_prozent: null }
      return (
        einstellungen.find(e => e.produkt_id === produktId) ?? {
          sales_plattform_id: plattformId,
          produkt_id: produktId,
          verkaufsgebuehr_prozent: null,
        }
      )
    },
    [einstellungen, plattformId]
  )

  const upsert = useCallback(
    async (patch: Omit<VerkaufsgebuehrEinstellung, 'id'>): Promise<void> => {
      const isSame = (e: VerkaufsgebuehrEinstellung) =>
        e.sales_plattform_id === patch.sales_plattform_id && e.produkt_id === patch.produkt_id

      const previous = einstellungen.find(isSame)

      setEinstellungen(curr => {
        if (curr.some(isSame)) return curr.map(e => (isSame(e) ? { ...e, ...patch } : e))
        return [...curr, patch]
      })

      const res = await fetch('/api/verkaufsgebuehr-einstellungen', {
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
      verkaufsgebuehrProzent: number | null,
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
            result[idx] = { ...result[idx], verkaufsgebuehr_prozent: verkaufsgebuehrProzent }
          } else {
            result.push({
              sales_plattform_id: salesPlattformId,
              produkt_id: produktId,
              verkaufsgebuehr_prozent: verkaufsgebuehrProzent,
            })
          }
        }
        return result
      })

      const res = await fetch('/api/verkaufsgebuehr-einstellungen/batch', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sales_plattform_id: salesPlattformId,
          verkaufsgebuehr_prozent: verkaufsgebuehrProzent,
        }),
      })

      if (!res.ok) {
        setEinstellungen(previous)
        throw new Error('Batch-Upsert fehlgeschlagen')
      }

      const data: VerkaufsgebuehrEinstellung[] = await res.json()
      setEinstellungen(curr => {
        const others = curr.filter(e => e.sales_plattform_id !== salesPlattformId)
        return [...others, ...data]
      })
    },
    [einstellungen]
  )

  return { einstellungen, loading, error, getEinstellung, upsert, batchUpsert }
}
