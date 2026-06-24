'use client'

import { useState, useEffect, useCallback } from 'react'
import { ustEinstellungenPfad } from '@/lib/steuereinstellungen-api'

export type Zahlungsfrequenz = 'monatlich' | 'quartalsweise'

export interface UstEinstellungen {
  zahlungsfrequenz: Zahlungsfrequenz
  zahlungsverschiebung_tage: number
  einfuhrust_zahlungsziel_tage: number
  einfuhrust_satz: number
  ust_satz_pflegeebene: 1 | 2
}

const DEFAULTS: UstEinstellungen = {
  zahlungsfrequenz: 'monatlich',
  zahlungsverschiebung_tage: 0,
  einfuhrust_zahlungsziel_tage: 0,
  einfuhrust_satz: 0,
  ust_satz_pflegeebene: 1,
}

// versionId optional: ohne → globale Kurzfristig-Einstellungen (PROJ-65);
// mit → versionsgebundene Langfristig-Einstellungen (PROJ-83).
export function useUstEinstellungen(versionId?: string) {
  const [einstellungen, setEinstellungen] = useState<UstEinstellungen>(DEFAULTS)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const pfad = ustEinstellungenPfad(versionId)

  useEffect(() => {
    setLoading(true)
    setError(null)
    fetch(pfad)
      .then(r => {
        if (!r.ok) throw new Error('API-Fehler')
        return r.json()
      })
      .then((data: UstEinstellungen | null) => {
        setEinstellungen(data ?? DEFAULTS)
        setLoading(false)
      })
      .catch(() => {
        setError('Fehler beim Laden der Steuereinstellungen.')
        setLoading(false)
      })
  }, [pfad])

  const save = useCallback(async (patch: Partial<UstEinstellungen>): Promise<UstEinstellungen> => {
    const r = await fetch(pfad, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(patch),
    })
    if (!r.ok) {
      const err = await r.json().catch(() => ({}))
      throw new Error((err as { error?: string }).error ?? 'Speichern fehlgeschlagen')
    }
    const updated: UstEinstellungen = await r.json()
    setEinstellungen(updated)
    return updated
  }, [pfad])

  return { einstellungen, loading, error, save }
}
