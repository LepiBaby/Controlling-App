'use client'

import { useState, useEffect, useCallback } from 'react'

export interface BestellungKosten {
  id: string
  kpi_kategorie_id: string | null
  kpi_kategorie_name: string | null
  datum: string
  nettobetrag: number
  begruendung: string | null
  ist_automatisch: boolean
  created_at: string
}

export function useBestellungKosten(bestellungId: string | null) {
  const [kosten, setKosten] = useState<BestellungKosten[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!bestellungId) return
    let cancelled = false
    setLoading(true)
    setError(null)

    fetch(`/api/bestellplanung/bestellungen/${bestellungId}/kosten`)
      .then(r => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`)
        return r.json()
      })
      .then((data: BestellungKosten[]) => {
        if (!cancelled) {
          setKosten(data)
          setLoading(false)
        }
      })
      .catch((err: unknown) => {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Laden fehlgeschlagen')
          setLoading(false)
        }
      })

    return () => { cancelled = true }
  }, [bestellungId])

  const add = useCallback(async (input: {
    kpi_kategorie_id?: string | null
    datum: string
    nettobetrag: number
    begruendung?: string | null
  }): Promise<BestellungKosten> => {
    if (!bestellungId) throw new Error('Keine Bestellung')
    const res = await fetch(`/api/bestellplanung/bestellungen/${bestellungId}/kosten`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(input),
    })
    if (!res.ok) {
      const body = await res.json().catch(() => ({}))
      throw new Error((body as { error?: string }).error ?? 'Erstellen fehlgeschlagen')
    }
    const created: BestellungKosten = await res.json()
    setKosten(prev => [...prev, created].sort((a, b) => a.datum.localeCompare(b.datum)))
    return created
  }, [bestellungId])

  const update = useCallback(async (
    kostenId: string,
    patch: {
      kpi_kategorie_id?: string | null
      datum?: string
      nettobetrag?: number
      begruendung?: string | null
      ist_automatisch?: boolean
    },
  ): Promise<BestellungKosten> => {
    if (!bestellungId) throw new Error('Keine Bestellung')

    let prevEntry: BestellungKosten | undefined
    setKosten(curr => {
      prevEntry = curr.find(k => k.id === kostenId)
      return curr.map(k => k.id === kostenId ? { ...k, ...patch } : k)
    })

    const res = await fetch(`/api/bestellplanung/bestellungen/${bestellungId}/kosten/${kostenId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(patch),
    })
    if (!res.ok) {
      if (prevEntry) {
        const snapshot = prevEntry
        setKosten(curr => curr.map(k => k.id === kostenId ? snapshot : k))
      }
      throw new Error('Speichern fehlgeschlagen')
    }
    const updated: BestellungKosten = await res.json()
    setKosten(curr =>
      curr.map(k => k.id === kostenId ? updated : k)
          .sort((a, b) => a.datum.localeCompare(b.datum))
    )
    return updated
  }, [bestellungId])

  const remove = useCallback(async (kostenId: string): Promise<void> => {
    if (!bestellungId) throw new Error('Keine Bestellung')

    let prevEntry: BestellungKosten | undefined
    setKosten(curr => {
      prevEntry = curr.find(k => k.id === kostenId)
      return curr.filter(k => k.id !== kostenId)
    })

    const res = await fetch(`/api/bestellplanung/bestellungen/${bestellungId}/kosten/${kostenId}`, {
      method: 'DELETE',
    })
    if (!res.ok) {
      if (prevEntry) {
        const snapshot = prevEntry
        setKosten(curr => [...curr, snapshot].sort((a, b) => a.datum.localeCompare(b.datum)))
      }
      throw new Error('Löschen fehlgeschlagen')
    }
  }, [bestellungId])

  return { kosten, loading, error, add, update, remove }
}
