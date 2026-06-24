'use client'

import { useState, useEffect, useCallback } from 'react'

// PROJ-86: Bestellkosten einer Bestellung (Langfristige Planung). Voller CRUD wie
// kurzfristig (PROJ-64), nur versionsgebunden. Auto-Kosten werden serverseitig
// aus den Produktinformationen der Version generiert; manuelle Einträge sind
// frei anlegbar/bearbeitbar.

export interface LangfristigeBestellungKosten {
  id: string
  kpi_kategorie_id: string | null
  kpi_kategorie_name: string | null
  datum: string
  nettobetrag: number
  begruendung: string | null
  ist_automatisch: boolean
  created_at: string
}

export function useLangfristigeBestellungKosten(versionId: string, bestellungId: string | null) {
  const [kosten, setKosten] = useState<LangfristigeBestellungKosten[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const basis = `/api/langfristige-planung/${versionId}/bestellplanung/bestellungen/${bestellungId}/kosten`

  useEffect(() => {
    if (!versionId || !bestellungId) return
    let cancelled = false
    setLoading(true)
    setError(null)

    fetch(`/api/langfristige-planung/${versionId}/bestellplanung/bestellungen/${bestellungId}/kosten`)
      .then((r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`)
        return r.json()
      })
      .then((data: LangfristigeBestellungKosten[]) => {
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

    return () => {
      cancelled = true
    }
  }, [versionId, bestellungId])

  const add = useCallback(
    async (input: {
      kpi_kategorie_id?: string | null
      datum: string
      nettobetrag: number
      begruendung?: string | null
    }): Promise<LangfristigeBestellungKosten> => {
      if (!bestellungId) throw new Error('Keine Bestellung')
      const res = await fetch(basis, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(input),
      })
      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        throw new Error((body as { error?: string }).error ?? 'Erstellen fehlgeschlagen')
      }
      const created: LangfristigeBestellungKosten = await res.json()
      setKosten((prev) => [...prev, created].sort((a, b) => a.datum.localeCompare(b.datum)))
      return created
    },
    [basis, bestellungId],
  )

  const update = useCallback(
    async (
      kostenId: string,
      patch: {
        kpi_kategorie_id?: string | null
        datum?: string
        nettobetrag?: number
        begruendung?: string | null
        ist_automatisch?: boolean
      },
    ): Promise<LangfristigeBestellungKosten> => {
      if (!bestellungId) throw new Error('Keine Bestellung')

      let prevEntry: LangfristigeBestellungKosten | undefined
      setKosten((curr) => {
        prevEntry = curr.find((k) => k.id === kostenId)
        return curr.map((k) => (k.id === kostenId ? { ...k, ...patch } : k))
      })

      const res = await fetch(`${basis}/${kostenId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(patch),
      })
      if (!res.ok) {
        if (prevEntry) {
          const snapshot = prevEntry
          setKosten((curr) => curr.map((k) => (k.id === kostenId ? snapshot : k)))
        }
        throw new Error('Speichern fehlgeschlagen')
      }
      const updated: LangfristigeBestellungKosten = await res.json()
      setKosten((curr) =>
        curr.map((k) => (k.id === kostenId ? updated : k)).sort((a, b) => a.datum.localeCompare(b.datum)),
      )
      return updated
    },
    [basis, bestellungId],
  )

  const remove = useCallback(
    async (kostenId: string): Promise<void> => {
      if (!bestellungId) throw new Error('Keine Bestellung')

      let prevEntry: LangfristigeBestellungKosten | undefined
      setKosten((curr) => {
        prevEntry = curr.find((k) => k.id === kostenId)
        return curr.filter((k) => k.id !== kostenId)
      })

      const res = await fetch(`${basis}/${kostenId}`, { method: 'DELETE' })
      if (!res.ok) {
        if (prevEntry) {
          const snapshot = prevEntry
          setKosten((curr) => [...curr, snapshot].sort((a, b) => a.datum.localeCompare(b.datum)))
        }
        throw new Error('Löschen fehlgeschlagen')
      }
    },
    [basis, bestellungId],
  )

  return { kosten, loading, error, add, update, remove }
}
