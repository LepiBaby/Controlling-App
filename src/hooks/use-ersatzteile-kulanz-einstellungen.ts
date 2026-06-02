'use client'

import { useState, useEffect, useCallback } from 'react'

export interface ErsatzteileKulanzEinstellung {
  id?: string
  sales_plattform_id: string
  produkt_id: string
  quote_prozent: number | null
  produktkosten_pro_stueck_euro_netto: number | null
  versandkosten_pro_stueck_euro_netto: number | null
}

export function useErsatzteileKulanzEinstellungen(plattformId: string | null) {
  const [einstellungen, setEinstellungen] = useState<ErsatzteileKulanzEinstellung[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(() => {
    if (!plattformId) return
    setLoading(true)
    setError(null)
    fetch(`/api/ersatzteile-kulanz-einstellungen?plattform_id=${plattformId}`)
      .then(r => {
        if (!r.ok) throw new Error('API-Fehler')
        return r.json()
      })
      .then((data: ErsatzteileKulanzEinstellung[]) => {
        setEinstellungen(data)
        setLoading(false)
      })
      .catch(() => {
        setError('Fehler beim Laden der Ersatzteile/Kulanz-Einstellungen.')
        setLoading(false)
      })
  }, [plattformId])

  useEffect(() => {
    load()
  }, [load])

  const getEinstellung = useCallback(
    (produktId: string): ErsatzteileKulanzEinstellung => {
      if (!plattformId)
        return {
          sales_plattform_id: '',
          produkt_id: produktId,
          quote_prozent: null,
          produktkosten_pro_stueck_euro_netto: null,
          versandkosten_pro_stueck_euro_netto: null,
        }
      return (
        einstellungen.find(e => e.produkt_id === produktId) ?? {
          sales_plattform_id: plattformId,
          produkt_id: produktId,
          quote_prozent: null,
          produktkosten_pro_stueck_euro_netto: null,
          versandkosten_pro_stueck_euro_netto: null,
        }
      )
    },
    [einstellungen, plattformId]
  )

  const upsert = useCallback(
    async (patch: Omit<ErsatzteileKulanzEinstellung, 'id'>): Promise<void> => {
      const isSame = (e: ErsatzteileKulanzEinstellung) =>
        e.sales_plattform_id === patch.sales_plattform_id && e.produkt_id === patch.produkt_id

      const previous = einstellungen.find(isSame)

      setEinstellungen(curr => {
        if (curr.some(isSame)) return curr.map(e => (isSame(e) ? { ...e, ...patch } : e))
        return [...curr, patch]
      })

      const res = await fetch('/api/ersatzteile-kulanz-einstellungen', {
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

  return { einstellungen, loading, error, getEinstellung, upsert }
}
