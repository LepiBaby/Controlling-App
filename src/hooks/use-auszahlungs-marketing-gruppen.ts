'use client'

import { useState, useEffect, useCallback } from 'react'

export interface AuszahlungsMarketingGruppe {
  kpi_kategorie_id: string
  inkludiert: boolean
}

export function useAuszahlungsMarketingGruppen(plattformId: string | null) {
  const [gruppen, setGruppen] = useState<AuszahlungsMarketingGruppe[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!plattformId) {
      setGruppen([])
      return
    }
    setLoading(true)
    setError(null)
    fetch(`/api/auszahlungs-marketing-gruppen?plattform_id=${plattformId}`)
      .then(r => {
        if (!r.ok) throw new Error('API-Fehler')
        return r.json()
      })
      .then((data: AuszahlungsMarketingGruppe[]) => {
        setGruppen(data)
        setLoading(false)
      })
      .catch(() => {
        setError('Fehler beim Laden der Marketing-Gruppen.')
        setLoading(false)
      })
  }, [plattformId])

  const upsert = useCallback(
    async (plattId: string, kategorieId: string, inkludiert: boolean): Promise<void> => {
      const previous = gruppen.find(g => g.kpi_kategorie_id === kategorieId)
      setGruppen(prev =>
        prev.some(g => g.kpi_kategorie_id === kategorieId)
          ? prev.map(g => g.kpi_kategorie_id === kategorieId ? { ...g, inkludiert } : g)
          : [...prev, { kpi_kategorie_id: kategorieId, inkludiert }]
      )

      const res = await fetch('/api/auszahlungs-marketing-gruppen', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sales_plattform_id: plattId, kpi_kategorie_id: kategorieId, inkludiert }),
      })

      if (!res.ok) {
        setGruppen(prev =>
          previous
            ? prev.map(g => g.kpi_kategorie_id === kategorieId ? previous : g)
            : prev.filter(g => g.kpi_kategorie_id !== kategorieId)
        )
        throw new Error('Speichern fehlgeschlagen')
      }
    },
    [gruppen]
  )

  const remove = useCallback(
    async (plattId: string, kategorieId: string): Promise<void> => {
      const previous = gruppen.find(g => g.kpi_kategorie_id === kategorieId)
      setGruppen(prev => prev.filter(g => g.kpi_kategorie_id !== kategorieId))

      const res = await fetch(
        `/api/auszahlungs-marketing-gruppen?plattform_id=${plattId}&kpi_kategorie_id=${kategorieId}`,
        { method: 'DELETE' }
      )

      if (!res.ok) {
        if (previous) setGruppen(prev => [...prev, previous])
        throw new Error('Löschen fehlgeschlagen')
      }
    },
    [gruppen]
  )

  return { gruppen, loading, error, upsert, remove }
}
