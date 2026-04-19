'use client'

import { useState, useEffect, useCallback } from 'react'

export interface ProduktkostenWert {
  id: string
  zeitraum_id: string
  kategorie_id: string
  wert: number
}

export interface ProduktkostenZeitraum {
  id: string
  produkt_id: string
  gueltig_von: string
  gueltig_bis: string | null
  created_at: string
  werte: ProduktkostenWert[]
}

export interface ProduktkostenFormData {
  gueltig_von: string
  gueltig_bis: string | null
  werte: { kategorie_id: string; wert: number }[]
}

export function useProduktkostenZeitraeume(produktId: string | null) {
  const [zeitraeume, setZeitraeume] = useState<ProduktkostenZeitraum[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const fetchData = useCallback(async () => {
    if (!produktId) {
      setZeitraeume([])
      return
    }
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`/api/produktkosten?produkt_id=${produktId}`)
      if (!res.ok) throw new Error((await res.json()).error ?? 'Fehler beim Laden')
      const json = await res.json()
      setZeitraeume(json.data)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Fehler beim Laden')
    } finally {
      setLoading(false)
    }
  }, [produktId])

  useEffect(() => { fetchData() }, [fetchData])

  const addZeitraum = useCallback(async (produktIdArg: string, data: ProduktkostenFormData) => {
    const res = await fetch('/api/produktkosten', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ produkt_id: produktIdArg, ...data }),
    })
    if (!res.ok) throw new Error((await res.json()).error ?? 'Fehler beim Speichern')
    await fetchData()
  }, [fetchData])

  const updateZeitraum = useCallback(async (id: string, data: ProduktkostenFormData) => {
    const res = await fetch(`/api/produktkosten/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    })
    if (!res.ok) throw new Error((await res.json()).error ?? 'Fehler beim Aktualisieren')
    await fetchData()
  }, [fetchData])

  const deleteZeitraum = useCallback(async (id: string) => {
    const res = await fetch(`/api/produktkosten/${id}`, { method: 'DELETE' })
    if (!res.ok) throw new Error((await res.json()).error ?? 'Fehler beim Löschen')
    await fetchData()
  }, [fetchData])

  return { zeitraeume, loading, error, addZeitraum, updateZeitraum, deleteZeitraum }
}
