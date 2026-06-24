'use client'

import { useState, useEffect, useCallback } from 'react'

export type Gruppierung = 'woechentlich' | 'monatlich' | 'quartalsweise'

export interface MarketingKategorieEinstellung {
  gruppierung: Gruppierung
  naechste_zahlung_basis_kw: number | null
  naechste_zahlung_basis_jahr: number | null
  zahlungsziel_tage: number | null
  sales_plattform_id: string | null
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

const DEFAULTS: MarketingKategorieEinstellung = {
  gruppierung: 'monatlich',
  naechste_zahlung_basis_kw: null,
  naechste_zahlung_basis_jahr: null,
  zahlungsziel_tage: null,
  sales_plattform_id: null,
}

export function useMarketingKategorieEinstellungen(kategorieId: string | null) {
  const [einstellung, setEinstellung] = useState<MarketingKategorieEinstellung | null>(null)
  // Start as loading so the form doesn't prematurely initialize from DEFAULTS before data arrives
  const [loading, setLoading] = useState(!!kategorieId)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!kategorieId) return
    setLoading(true)
    setError(null)
    fetch(`/api/marketing-kategorie-einstellungen?kategorie_id=${kategorieId}`)
      .then(r => {
        if (!r.ok) throw new Error('API-Fehler')
        return r.json()
      })
      .then((data: MarketingKategorieEinstellung | null) => {
        setEinstellung(data)
        setLoading(false)
      })
      .catch(() => {
        setError('Fehler beim Laden der Einstellungen.')
        setLoading(false)
      })
  }, [kategorieId])

  const upsert = useCallback(
    async (patch: Partial<MarketingKategorieEinstellung>): Promise<void> => {
      if (!kategorieId) return
      const previous = einstellung
      setEinstellung(curr => ({ ...(curr ?? DEFAULTS), ...patch }))

      // Always include gruppierung so that INSERT (first-time save) works even when
      // only a single field like zahlungsziel_tage is being changed.
      const current = einstellung ?? DEFAULTS
      const res = await fetch('/api/marketing-kategorie-einstellungen', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ kategorie_id: kategorieId, gruppierung: current.gruppierung, ...patch }),
      })

      if (!res.ok) {
        setEinstellung(previous)
        throw new Error('Speichern fehlgeschlagen')
      }
    },
    [einstellung, kategorieId]
  )

  const effektiv = einstellung ?? DEFAULTS

  return { einstellung: effektiv, loading, error, upsert }
}
