'use client'

import { useState, useEffect, useCallback } from 'react'
import { PlanversionError } from '@/hooks/use-planversionen'

// Ordner zur Organisation von Planversionen (PROJ-103). Ein Ordner ist ein
// reiner Behälter (Name) und enthält keine Planungsdaten.
export interface PlanversionOrdner {
  id: string
  name: string
  created_at: string
  updated_at: string
}

const API_BASE = '/api/langfristige-planung/planversion-ordner'

async function readError(res: Response, fallback: string): Promise<never> {
  let message = fallback
  try {
    const body = await res.json()
    if (typeof body?.error === 'string') message = body.error
  } catch {
    // Body nicht lesbar — Fallback verwenden
  }
  throw new PlanversionError(message, res.status)
}

export function usePlanversionOrdner() {
  const [ordner, setOrdner] = useState<PlanversionOrdner[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const reload = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(API_BASE)
      if (!res.ok) throw new Error('API-Fehler')
      const data: PlanversionOrdner[] = await res.json()
      setOrdner(data)
    } catch {
      setError('Fehler beim Laden der Ordner.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    reload()
  }, [reload])

  const create = useCallback(async (name: string): Promise<PlanversionOrdner> => {
    const res = await fetch(API_BASE, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name }),
    })
    if (!res.ok) await readError(res, 'Ordner konnte nicht erstellt werden.')
    const created: PlanversionOrdner = await res.json()
    setOrdner((prev) => [...prev, created].sort((a, b) => a.name.localeCompare(b.name)))
    return created
  }, [])

  const rename = useCallback(async (id: string, name: string): Promise<PlanversionOrdner> => {
    const res = await fetch(`${API_BASE}/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name }),
    })
    if (!res.ok) await readError(res, 'Ordner konnte nicht umbenannt werden.')
    const updated: PlanversionOrdner = await res.json()
    setOrdner((prev) =>
      prev.map((o) => (o.id === id ? updated : o)).sort((a, b) => a.name.localeCompare(b.name)),
    )
    return updated
  }, [])

  // Löscht einen Ordner. Serverseitig nur erlaubt, wenn der Ordner leer ist
  // (sonst 409 mit Hinweis). Wirft PlanversionError.
  const remove = useCallback(async (id: string): Promise<void> => {
    const res = await fetch(`${API_BASE}/${id}`, { method: 'DELETE' })
    if (!res.ok) await readError(res, 'Ordner konnte nicht gelöscht werden.')
    setOrdner((prev) => prev.filter((o) => o.id !== id))
  }, [])

  return { ordner, loading, error, reload, create, rename, remove }
}
