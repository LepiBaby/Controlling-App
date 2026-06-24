'use client'

import { useState, useEffect, useCallback } from 'react'

export type Gruppierung = 'woechentlich' | 'monatlich' | 'quartalsweise'

export interface VersandausgabenPlattformEinstellungen {
  gruppierung: Gruppierung
  zahlungsziel_tage: number | null
  naechste_zahlung_basis_kw: number | null
  naechste_zahlung_basis_jahr: number | null
}

export const GRUPPIERUNGEN: Gruppierung[] = ['woechentlich', 'monatlich', 'quartalsweise']

export const GRUPPIERUNG_LABELS: Record<Gruppierung, string> = {
  woechentlich: 'Wöchentlich',
  monatlich: 'Monatlich',
  quartalsweise: 'Quartalsweise',
}

export const GRUPPIERUNG_WOCHEN: Record<Gruppierung, number> = {
  woechentlich: 1,
  monatlich: 4,
  quartalsweise: 13,
}

const DEFAULTS: VersandausgabenPlattformEinstellungen = {
  gruppierung: 'monatlich',
  zahlungsziel_tage: null,
  naechste_zahlung_basis_kw: null,
  naechste_zahlung_basis_jahr: null,
}

export function useVersandausgabenPlattformEinstellungen(plattformId: string | null) {
  const [einstellungen, setEinstellungen] =
    useState<VersandausgabenPlattformEinstellungen | null>(null)
  const [loading, setLoading] = useState(!!plattformId)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!plattformId) return
    setLoading(true)
    setError(null)
    fetch(`/api/versandausgaben-plattform-einstellungen?plattform_id=${plattformId}`)
      .then(r => {
        if (!r.ok) throw new Error('API-Fehler')
        return r.json()
      })
      .then((data: VersandausgabenPlattformEinstellungen | null) => {
        setEinstellungen(data)
        setLoading(false)
      })
      .catch(() => {
        setError('Fehler beim Laden der Plattform-Einstellungen.')
        setLoading(false)
      })
  }, [plattformId])

  const upsert = useCallback(
    async (patch: Partial<VersandausgabenPlattformEinstellungen>): Promise<void> => {
      if (!plattformId) return
      const previous = einstellungen
      setEinstellungen(curr => ({ ...(curr ?? DEFAULTS), ...patch }))

      const res = await fetch('/api/versandausgaben-plattform-einstellungen', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sales_plattform_id: plattformId, ...patch }),
      })

      if (!res.ok) {
        setEinstellungen(previous)
        throw new Error('Speichern fehlgeschlagen')
      }
    },
    [einstellungen, plattformId]
  )

  const effektiv = einstellungen ?? DEFAULTS

  return { einstellungen: effektiv, loading, error, upsert }
}
