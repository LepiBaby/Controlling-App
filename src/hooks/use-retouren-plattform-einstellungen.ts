'use client'

import { useState, useEffect, useCallback } from 'react'

export type Gruppierung = 'woechentlich' | 'monatlich' | 'quartalsweise'

export interface RetourenPlattformEinstellungen {
  gruppierung: Gruppierung
  naechste_zahlung_basis_kw: number | null
  naechste_zahlung_basis_jahr: number | null
  zahlungsziel_tage: number | null
  erstattung_verkaufsgebuehr_prozent: number | null
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

const DEFAULTS: RetourenPlattformEinstellungen = {
  gruppierung: 'monatlich',
  naechste_zahlung_basis_kw: null,
  naechste_zahlung_basis_jahr: null,
  zahlungsziel_tage: null,
  erstattung_verkaufsgebuehr_prozent: null,
}

export function useRetourenPlattformEinstellungen(plattformId: string | null) {
  const [einstellungen, setEinstellungen] =
    useState<RetourenPlattformEinstellungen | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!plattformId) return
    setLoading(true)
    setError(null)
    fetch(`/api/retouren-plattform-einstellungen?plattform_id=${plattformId}`)
      .then(r => {
        if (!r.ok) throw new Error('API-Fehler')
        return r.json()
      })
      .then((data: RetourenPlattformEinstellungen | null) => {
        setEinstellungen(data)
        setLoading(false)
      })
      .catch(() => {
        setError('Fehler beim Laden der Plattform-Einstellungen.')
        setLoading(false)
      })
  }, [plattformId])

  const upsert = useCallback(
    async (patch: Partial<RetourenPlattformEinstellungen>): Promise<void> => {
      if (!plattformId) return
      const previous = einstellungen
      setEinstellungen(curr => ({ ...(curr ?? DEFAULTS), ...patch }))

      const res = await fetch('/api/retouren-plattform-einstellungen', {
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
