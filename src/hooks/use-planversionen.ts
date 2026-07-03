'use client'

import { useState, useEffect, useCallback } from 'react'

export interface Planversion {
  id: string
  name: string
  /** Ordner-Zugehörigkeit (PROJ-103): null = liegt frei auf der Grundseite. */
  ordner_id: string | null
  created_at: string
  updated_at: string
}

const API_BASE = '/api/langfristige-planung/planversionen'

// Fehler mit zusätzlichem Statuscode, damit Aufrufer z.B. 409 (Duplikat)
// gezielt behandeln können.
export class PlanversionError extends Error {
  status: number
  constructor(message: string, status: number) {
    super(message)
    this.name = 'PlanversionError'
    this.status = status
  }
}

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

export function usePlanversionen() {
  const [planversionen, setPlanversionen] = useState<Planversion[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const reload = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(API_BASE)
      if (!res.ok) throw new Error('API-Fehler')
      const data: Planversion[] = await res.json()
      setPlanversionen(data)
    } catch {
      setError('Fehler beim Laden der Planversionen.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    reload()
  }, [reload])

  const create = useCallback(
    async (name: string, ordnerId: string | null = null): Promise<Planversion> => {
      const res = await fetch(API_BASE, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, ordner_id: ordnerId }),
      })
      if (!res.ok) await readError(res, 'Planversion konnte nicht erstellt werden.')
      const created: Planversion = await res.json()
      setPlanversionen((prev) => [...prev, created].sort((a, b) => a.name.localeCompare(b.name)))
      return created
    },
    [],
  )

  const rename = useCallback(async (id: string, name: string): Promise<Planversion> => {
    const res = await fetch(`${API_BASE}/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name }),
    })
    if (!res.ok) await readError(res, 'Planversion konnte nicht umbenannt werden.')
    const updated: Planversion = await res.json()
    setPlanversionen((prev) =>
      prev.map((p) => (p.id === id ? updated : p)).sort((a, b) => a.name.localeCompare(b.name)),
    )
    return updated
  }, [])

  const remove = useCallback(async (id: string): Promise<void> => {
    const res = await fetch(`${API_BASE}/${id}`, { method: 'DELETE' })
    if (!res.ok) await readError(res, 'Planversion konnte nicht gelöscht werden.')
    setPlanversionen((prev) => prev.filter((p) => p.id !== id))
  }, [])

  // Dupliziert eine Version komplett (PROJ-104). Der Server legt eine neue Version
  // mit Auto-Namen („… (Kopie)") am selben Ort an und kopiert alle versionsgebundenen
  // Daten. Gibt die neue Version zurück.
  const duplicate = useCallback(async (id: string): Promise<Planversion> => {
    const res = await fetch(`${API_BASE}/${id}/duplicate`, { method: 'POST' })
    if (!res.ok) await readError(res, 'Planversion konnte nicht dupliziert werden.')
    const created: Planversion = await res.json()
    setPlanversionen((prev) => [...prev, created].sort((a, b) => a.name.localeCompare(b.name)))
    return created
  }, [])

  // Verschiebt eine Version in einen Ordner (ordnerId) oder auf die Grundseite (null).
  // Ändert ausschließlich die Ordner-Zugehörigkeit — keine Planungsdaten (PROJ-103).
  const move = useCallback(
    async (id: string, ordnerId: string | null): Promise<Planversion> => {
      const res = await fetch(`${API_BASE}/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ordner_id: ordnerId }),
      })
      if (!res.ok) await readError(res, 'Planversion konnte nicht verschoben werden.')
      const updated: Planversion = await res.json()
      setPlanversionen((prev) => prev.map((p) => (p.id === id ? updated : p)))
      return updated
    },
    [],
  )

  return { planversionen, loading, error, reload, create, rename, remove, move, duplicate }
}
