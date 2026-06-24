'use client'

import { useState, useEffect, useCallback } from 'react'
import {
  type Gruppierung,
  GRUPPIERUNGEN,
  GRUPPIERUNG_LABELS,
  GRUPPIERUNG_WOCHEN,
} from '@/hooks/use-retouren-plattform-einstellungen'

export type { Gruppierung }
export { GRUPPIERUNGEN, GRUPPIERUNG_LABELS, GRUPPIERUNG_WOCHEN }

export interface ErsatzteileKulanzPlattformEinstellungen {
  gruppierung: Gruppierung
  naechste_zahlung_basis_kw: number | null
  naechste_zahlung_basis_jahr: number | null
  zahlungsziel_tage: number | null
}

const DEFAULTS: ErsatzteileKulanzPlattformEinstellungen = {
  gruppierung: 'monatlich',
  naechste_zahlung_basis_kw: null,
  naechste_zahlung_basis_jahr: null,
  zahlungsziel_tage: null,
}

export function useErsatzteileKulanzPlattformEinstellungen(plattformId: string | null) {
  const [einstellungen, setEinstellungen] =
    useState<ErsatzteileKulanzPlattformEinstellungen | null>(null)
  const [loading, setLoading] = useState(!!plattformId)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!plattformId) return
    setLoading(true)
    setError(null)
    fetch(`/api/ersatzteile-kulanz-plattform-einstellungen?plattform_id=${plattformId}`)
      .then(r => {
        if (!r.ok) throw new Error('API-Fehler')
        return r.json()
      })
      .then((data: ErsatzteileKulanzPlattformEinstellungen | null) => {
        setEinstellungen(data)
        setLoading(false)
      })
      .catch(() => {
        setError('Fehler beim Laden der Plattform-Einstellungen.')
        setLoading(false)
      })
  }, [plattformId])

  const upsert = useCallback(
    async (patch: Partial<ErsatzteileKulanzPlattformEinstellungen>): Promise<void> => {
      if (!plattformId) return
      const previous = einstellungen
      setEinstellungen(curr => ({ ...(curr ?? DEFAULTS), ...patch }))

      const res = await fetch('/api/ersatzteile-kulanz-plattform-einstellungen', {
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
