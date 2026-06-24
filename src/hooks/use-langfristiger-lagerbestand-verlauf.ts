'use client'

import { useState, useEffect, useCallback } from 'react'

// PROJ-86: Lagerbestandsverlauf je Produkt (Langfristige Planung, Monatsachse).
// Der Verlauf wird serverseitig aus Startbestand (Aktueller Bestand), konstanter
// Start-Monats-Absatzrate und geplanten Bestell-Zugängen abgeleitet.

export interface VerlaufMonat {
  label: string // z.B. "Apr 26"
  jahr: number
  monat: number
  bestand_vorher: number // Bestand zu Monatsanfang (vor Einlagerung)
  bestand_nachher: number // = vorher + Einlagerung − Absatz
  kalkulatorischer_bestand: number // Trigger-Basis (in der LP = Bestand nachher)
  sicherheitsbestand: number | null
  meldebestand: number | null
  ankunft: number // Einlagerung = Zugänge in diesem Monat (Verfügbarkeit)
  bestellmenge: number // in diesem Monat aufgegebene Bestellmenge
  absatz: number // realer geplanter Monatsabsatz (Absatzplanung)
  ist_start: boolean // Start-Planungsmonat
}

export interface LagerbestandVerlauf {
  produkt_id: string
  start_label: string
  monate: VerlaufMonat[]
  hinweis: string | null
}

export function useLangfristigerLagerbestandVerlauf(versionId: string, produktId: string | null) {
  const [data, setData] = useState<LagerbestandVerlauf | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(() => {
    if (!versionId || !produktId) {
      setData(null)
      return
    }
    setIsLoading(true)
    setError(null)
    fetch(
      `/api/langfristige-planung/${versionId}/bestellplanung/lagerbestand-verlauf?produkt_id=${produktId}`,
    )
      .then((r) => {
        if (!r.ok) throw new Error(`API-Fehler (${r.status})`)
        return r.json()
      })
      .then((d: LagerbestandVerlauf) => {
        setData(d)
        setIsLoading(false)
      })
      .catch((err: unknown) => {
        setError(err instanceof Error ? err.message : 'Laden fehlgeschlagen')
        setIsLoading(false)
      })
  }, [versionId, produktId])

  useEffect(() => {
    load()
  }, [load])

  return { data, isLoading, error, reload: load }
}
