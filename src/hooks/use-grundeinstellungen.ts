'use client'

import { useState, useEffect, useCallback } from 'react'

export const DEFAULT_PLANUNGSHORIZONT = 13

export const DEFAULT_VERGANGENHEITSHORIZONT = 13

export interface Grundeinstellungen {
  planungshorizont_wochen: number
  planungshorizont_absatz_wochen: number | null
  vergangenheitshorizont_wochen: number
}

export function useGrundeinstellungen() {
  const [planungshorizont, setPlanungshorizont] = useState<number>(DEFAULT_PLANUNGSHORIZONT)
  const [planungshorizontAbsatz, setPlanungshorizontAbsatz] = useState<number | null>(null)
  const [vergangenheitshorizont, setVergangenheitshorizont] = useState<number>(DEFAULT_VERGANGENHEITSHORIZONT)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    setLoading(true)
    setError(null)
    fetch('/api/grundeinstellungen')
      .then(r => {
        if (!r.ok) throw new Error('API-Fehler')
        return r.json()
      })
      .then((data: Grundeinstellungen) => {
        setPlanungshorizont(data.planungshorizont_wochen)
        setPlanungshorizontAbsatz(data.planungshorizont_absatz_wochen)
        setVergangenheitshorizont(data.vergangenheitshorizont_wochen)
        setLoading(false)
      })
      .catch(() => {
        setError('Fehler beim Laden der Grundeinstellungen.')
        setLoading(false)
      })
  }, [])

  const save = useCallback(async (wochen: number): Promise<void> => {
    const previous = planungshorizont
    setPlanungshorizont(wochen)

    const res = await fetch('/api/grundeinstellungen', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ planungshorizont_wochen: wochen }),
    })

    if (!res.ok) {
      setPlanungshorizont(previous)
      throw new Error('Speichern fehlgeschlagen')
    }
  }, [planungshorizont])

  const saveAbsatz = useCallback(async (wochen: number | null): Promise<void> => {
    const previous = planungshorizontAbsatz
    setPlanungshorizontAbsatz(wochen)

    const res = await fetch('/api/grundeinstellungen', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ planungshorizont_absatz_wochen: wochen }),
    })

    if (!res.ok) {
      setPlanungshorizontAbsatz(previous)
      throw new Error('Speichern fehlgeschlagen')
    }
  }, [planungshorizontAbsatz])

  const saveVergangenheit = useCallback(async (wochen: number): Promise<void> => {
    const previous = vergangenheitshorizont
    setVergangenheitshorizont(wochen)

    const res = await fetch('/api/grundeinstellungen', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ vergangenheitshorizont_wochen: wochen }),
    })

    if (!res.ok) {
      setVergangenheitshorizont(previous)
      throw new Error('Speichern fehlgeschlagen')
    }
  }, [vergangenheitshorizont])

  return { planungshorizont, planungshorizontAbsatz, vergangenheitshorizont, loading, error, save, saveAbsatz, saveVergangenheit }
}
