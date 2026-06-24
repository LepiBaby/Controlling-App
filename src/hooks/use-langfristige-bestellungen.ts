'use client'

import { useState, useEffect, useCallback } from 'react'

// PROJ-86: Versionsgebundene Bestellungen der Langfristigen Planung.
// Rein auf Produktebene (keine SKUs), KEINE operative Status-Unterscheidung
// (alle Bestellungen werden gemeinsam angezeigt).

export interface KonsolidierungsPartner {
  bestellung_id: string
  produkt_name: string
  containerart: string | null
  bestelldatum: string | null
  anzahl_40hq: number
  anzahl_20dc: number
  container_anteil: Record<string, number> | null
}

export interface LangfristigeBestellung {
  id: string
  produkt_id: string
  produkt_name: string
  bestelldatum: string | null
  produktionsstart_datum: string | null
  produktionsende_datum: string | null
  shippingdatum: string | null
  ankunftsdatum: string | null
  verfuegbarkeitsdatum: string | null
  menge_theoretisch: number | null
  menge_nach_moq: number | null
  /** Menge vor der Konsolidierung (gesetzt, wenn die Bestellung konsolidiert wurde). */
  menge_vor_konsolidierung: number | null
  menge_praktisch: number
  begruendung: string | null
  herkunft: 'algorithmus' | 'manuell' | null
  manuell_geaendert: boolean
  /** Vom Nutzer als Erstbestellung dieses Produktes markiert (vorerst rein informativ). */
  ist_erstbestellung: boolean
  anzahl_20dc: number
  anzahl_40hq: number
  /** Anteiliger Container-Share bei Konsolidierung, z. B. { "40HQ": 0.5 }. */
  container_anteil: Record<string, number> | null
  notizen: string | null
  konsolidiert_mit: KonsolidierungsPartner[]
  created_at: string
  updated_at: string
}

export function useLangfristigeBestellungen(versionId: string) {
  const [bestellungen, setBestellungen] = useState<LangfristigeBestellung[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const basePath = `/api/langfristige-planung/${versionId}/bestellplanung/bestellungen`

  const reload = useCallback(() => {
    if (!versionId) return
    setLoading(true)
    setError(null)
    // no-store: immer frische Daten (Partner-Container-Anteile etc. dürfen nicht
    // aus einer veralteten Browser-Cache-Antwort kommen).
    fetch(basePath, { cache: 'no-store' })
      .then((r) => {
        if (!r.ok) throw new Error(`API-Fehler (${r.status})`)
        return r.json()
      })
      .then((data: LangfristigeBestellung[]) => {
        setBestellungen(data ?? [])
        setLoading(false)
      })
      .catch((err: unknown) => {
        setError(err instanceof Error ? err.message : 'Laden fehlgeschlagen')
        setLoading(false)
      })
  }, [versionId, basePath])

  useEffect(() => {
    reload()
  }, [reload])

  // Manuelle Bestellung anlegen (herkunft='manuell' wird serverseitig gesetzt).
  const create = useCallback(
    async (payload: {
      produkt_id: string
      bestelldatum?: string | null
      produktionsstart_datum?: string | null
      produktionsende_datum?: string | null
      shippingdatum?: string | null
      ankunftsdatum?: string | null
      verfuegbarkeitsdatum?: string | null
      menge_praktisch?: number
      menge_theoretisch?: number | null
      begruendung?: string | null
      anzahl_20dc?: number
      anzahl_40hq?: number
      notizen?: string | null
    }): Promise<void> => {
      const res = await fetch(basePath, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        throw new Error(
          body?.error ? `Anlegen fehlgeschlagen` : `Anlegen fehlgeschlagen (HTTP ${res.status})`,
        )
      }
      reload()
    },
    [basePath, reload],
  )

  const update = useCallback(
    async (id: string, patch: Partial<LangfristigeBestellung>): Promise<LangfristigeBestellung> => {
      const prev = bestellungen.find((b) => b.id === id)
      setBestellungen((curr) => curr.map((b) => (b.id === id ? { ...b, ...patch } : b)))

      const res = await fetch(`${basePath}/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(patch),
      })

      if (!res.ok) {
        if (prev) setBestellungen((curr) => curr.map((b) => (b.id === id ? prev : b)))
        throw new Error('Speichern fehlgeschlagen')
      }

      // Die PUT-Antwort enthält nur die DB-Spalten der Bestellung — NICHT die
      // angereicherten Felder produkt_name / konsolidiert_mit (die nur beim
      // Listen-Load gebaut werden). Daher in die vorhandene Zeile mergen statt
      // ersetzen, sonst gehen diese Felder verloren (→ Render-Crash).
      const updated: Partial<LangfristigeBestellung> = await res.json()
      let merged: LangfristigeBestellung | undefined
      setBestellungen((curr) =>
        curr.map((b) => {
          if (b.id !== id) return b
          merged = { ...b, ...updated }
          return merged
        }),
      )
      return merged ?? ({ ...(prev as LangfristigeBestellung), ...updated } as LangfristigeBestellung)
    },
    [bestellungen, basePath],
  )

  const remove = useCallback(
    async (id: string): Promise<void> => {
      const prev = bestellungen.find((b) => b.id === id)
      setBestellungen((curr) => curr.filter((b) => b.id !== id))

      const res = await fetch(`${basePath}/${id}`, { method: 'DELETE' })
      if (!res.ok) {
        if (prev) setBestellungen((curr) => [...curr, prev])
        let msg = `Löschen fehlgeschlagen (HTTP ${res.status})`
        try {
          const body = await res.json()
          if (body?.error) msg = body.error
        } catch {
          /* response body not JSON */
        }
        throw new Error(msg)
      }
    },
    [bestellungen, basePath],
  )

  return { bestellungen, loading, error, reload, create, update, remove }
}
