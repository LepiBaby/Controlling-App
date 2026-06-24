'use client'

import { useState, useEffect, useCallback } from 'react'

// PROJ-78: Generischer Hook für plattformgebundene, produktweise Vertriebs-
// einstellungen einer Planversion (Versand, Ersatzteile/Kulanz, Retouren je
// Plattform). Spiegelt das kurzfristige Muster (Liste laden, getEinstellung,
// optimistischer Upsert je Produkt), arbeitet aber gegen die versions-/nutzer-
// gesicherten Endpunkte unter `/api/langfristige-planung/[versionId]/vertrieb/…`.

export interface ProduktEinstellungBase {
  produkt_id: string
  sales_plattform_id: string
}

export function useLangfristigeVertriebProduktEinstellungen<T extends ProduktEinstellungBase>(
  versionId: string,
  endpointSuffix: string,
  plattformId: string | null,
  makeEmpty: (plattformId: string, produktId: string) => T,
) {
  const [einstellungen, setEinstellungen] = useState<T[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const basePath = `/api/langfristige-planung/${versionId}/vertrieb/${endpointSuffix}`

  useEffect(() => {
    if (!versionId || !plattformId) return
    let aktiv = true
    setLoading(true)
    setError(null)
    fetch(`${basePath}?plattform_id=${plattformId}`)
      .then(r => {
        if (!r.ok) throw new Error('API-Fehler')
        return r.json()
      })
      .then((data: T[]) => {
        if (!aktiv) return
        setEinstellungen(data)
        setLoading(false)
      })
      .catch(() => {
        if (!aktiv) return
        setError('Fehler beim Laden der Einstellungen.')
        setLoading(false)
      })
    return () => {
      aktiv = false
    }
  }, [versionId, plattformId, basePath])

  const getEinstellung = useCallback(
    (produktId: string): T => {
      if (!plattformId) return makeEmpty('', produktId)
      return einstellungen.find(e => e.produkt_id === produktId) ?? makeEmpty(plattformId, produktId)
    },
    [einstellungen, plattformId, makeEmpty],
  )

  const upsert = useCallback(
    async (patch: T): Promise<void> => {
      const isSame = (e: T) =>
        e.sales_plattform_id === patch.sales_plattform_id && e.produkt_id === patch.produkt_id

      const previous = einstellungen.find(isSame)

      setEinstellungen(curr => {
        if (curr.some(isSame)) return curr.map(e => (isSame(e) ? { ...e, ...patch } : e))
        return [...curr, patch]
      })

      const res = await fetch(basePath, {
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
    [einstellungen, basePath],
  )

  return { einstellungen, loading, error, getEinstellung, upsert }
}
