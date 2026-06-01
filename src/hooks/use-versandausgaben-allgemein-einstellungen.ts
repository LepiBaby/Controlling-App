'use client'

import { useState, useEffect, useCallback } from 'react'

export type Gruppierung = 'woechentlich' | 'monatlich' | 'quartalsweise'

export interface VersandausgabenAllgemeinEinstellungen {
  gruppierung: Gruppierung
  zahlungsziel_tage: number | null
}

export const GRUPPIERUNGEN: Gruppierung[] = ['woechentlich', 'monatlich', 'quartalsweise']

export const GRUPPIERUNG_LABELS: Record<Gruppierung, string> = {
  woechentlich: 'Wöchentlich',
  monatlich: 'Monatlich',
  quartalsweise: 'Quartalsweise',
}

const DEFAULT_EINSTELLUNGEN: VersandausgabenAllgemeinEinstellungen = {
  gruppierung: 'monatlich',
  zahlungsziel_tage: null,
}

export function useVersandausgabenAllgemeinEinstellungen() {
  const [einstellungen, setEinstellungen] =
    useState<VersandausgabenAllgemeinEinstellungen>(DEFAULT_EINSTELLUNGEN)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    fetch('/api/versandausgaben-allgemein-einstellungen')
      .then(r => {
        if (!r.ok) throw new Error('API-Fehler')
        return r.json()
      })
      .then((data: VersandausgabenAllgemeinEinstellungen | null) => {
        if (data) setEinstellungen(data)
        setLoading(false)
      })
      .catch(() => {
        setError('Fehler beim Laden der Allgemein-Einstellungen.')
        setLoading(false)
      })
  }, [])

  const upsert = useCallback(
    async (patch: Partial<VersandausgabenAllgemeinEinstellungen>): Promise<void> => {
      const previous = einstellungen
      setEinstellungen(curr => ({ ...curr, ...patch }))

      const res = await fetch('/api/versandausgaben-allgemein-einstellungen', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(patch),
      })

      if (!res.ok) {
        setEinstellungen(previous)
        throw new Error('Speichern fehlgeschlagen')
      }
    },
    [einstellungen]
  )

  return { einstellungen, loading, error, upsert }
}
