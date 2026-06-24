'use client'

import { useState, useEffect, useCallback } from 'react'
import type { Gruppierung } from './use-retouren-plattform-einstellungen'

export interface RetourenAllgemeinEinstellungen {
  gruppierung: Gruppierung
  naechste_zahlung_basis_kw: number | null
  naechste_zahlung_basis_jahr: number | null
  zahlungsziel_tage: number | null
}

const DEFAULTS: RetourenAllgemeinEinstellungen = {
  gruppierung: 'monatlich',
  naechste_zahlung_basis_kw: null,
  naechste_zahlung_basis_jahr: null,
  zahlungsziel_tage: null,
}

export function useRetourenAllgemeinEinstellungen() {
  const [einstellungen, setEinstellungen] = useState<RetourenAllgemeinEinstellungen | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    setLoading(true)
    setError(null)
    fetch('/api/retouren-allgemein-einstellungen')
      .then(r => {
        if (!r.ok) throw new Error('API-Fehler')
        return r.json()
      })
      .then((data: RetourenAllgemeinEinstellungen | null) => {
        setEinstellungen(data)
        setLoading(false)
      })
      .catch(() => {
        setError('Fehler beim Laden der allgemeinen Retoureneinstellungen.')
        setLoading(false)
      })
  }, [])

  const upsert = useCallback(
    async (patch: Partial<RetourenAllgemeinEinstellungen>): Promise<void> => {
      const previous = einstellungen
      setEinstellungen(curr => ({ ...(curr ?? DEFAULTS), ...patch }))

      const res = await fetch('/api/retouren-allgemein-einstellungen', {
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

  return { einstellungen: einstellungen ?? DEFAULTS, loading, error, upsert }
}
