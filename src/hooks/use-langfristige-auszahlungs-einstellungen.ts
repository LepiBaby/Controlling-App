'use client'

import { useState, useEffect, useCallback } from 'react'

// PROJ-76: Versionsgebundene Auszahlungseinstellungen der Langfristigen Planung.
// Spiegelt useAuszahlungsEinstellungen (kurzfristig), arbeitet aber gegen die
// versions-/nutzergesicherten Endpunkte und denkt in MONATEN statt Kalenderwochen.
// Marketingkanal-Zuordnungen werden im selben Datensatz mitgeführt
// (marketingkanal_ids), d.h. ein GET/PUT lädt/speichert alles für eine Plattform.

export type LangfristigerRhythmus =
  | 'monatlich'
  | 'alle_zwei_monate'
  | 'quartalsweise'

export interface LangfristigeAuszahlungsEinstellung {
  sales_plattform_id: string
  auszahlungsrhythmus: LangfristigerRhythmus
  erster_auszahlung_monat: number | null
  erster_auszahlung_jahr: number | null
  verschiebung_monate: number
  marketingkanal_ids: string[]
}

// Rhythmus → Anzahl Monate, um die der Ankermonat fortgeschrieben wird.
export const RHYTHMUS_MONATE: Record<LangfristigerRhythmus, number> = {
  monatlich: 1,
  alle_zwei_monate: 2,
  quartalsweise: 3,
}

export const RHYTHMUS_LABELS: Record<LangfristigerRhythmus, string> = {
  monatlich: 'Monatlich',
  alle_zwei_monate: 'Alle 2 Monate',
  quartalsweise: 'Quartalsweise',
}

export const RHYTHMUS_VALUES: LangfristigerRhythmus[] = [
  'monatlich',
  'alle_zwei_monate',
  'quartalsweise',
]

export const MIN_VERSCHIEBUNG_MONATE = 0
export const MAX_VERSCHIEBUNG_MONATE = 60

/** Aktueller Monat (1–12) + Jahr aus dem Browser. */
export function getCurrentMonthAndYear(): { monat: number; jahr: number } {
  const now = new Date()
  return { monat: now.getMonth() + 1, jahr: now.getFullYear() }
}

/**
 * Nächster zukünftiger Auszahlungsmonat: Ankermonat um den Rhythmus vorrücken,
 * bis er den aktuellen Monat erreicht/überschreitet. Reine Frontend-Berechnung,
 * verändert den gespeicherten Anker nicht. Die Verschiebung wird hier NICHT
 * eingerechnet (sie dient erst der späteren Liquiditätszuordnung).
 */
export function calculateNextPayoutMonth(
  ankerMonat: number,
  ankerJahr: number,
  rhythmusMonate: number,
  currentMonat: number,
  currentJahr: number,
): { monat: number; jahr: number } {
  // Monate als fortlaufenden Index darstellen (jahr*12 + (monat-1)).
  let idx = ankerJahr * 12 + (ankerMonat - 1)
  const currentIdx = currentJahr * 12 + (currentMonat - 1)
  while (idx < currentIdx) idx += rhythmusMonate
  return { monat: (idx % 12) + 1, jahr: Math.floor(idx / 12) }
}

export function makeDefaultEinstellung(
  plattformId: string,
): LangfristigeAuszahlungsEinstellung {
  return {
    sales_plattform_id: plattformId,
    auszahlungsrhythmus: 'monatlich',
    erster_auszahlung_monat: null,
    erster_auszahlung_jahr: null,
    verschiebung_monate: 0,
    marketingkanal_ids: [],
  }
}

export function useLangfristigeAuszahlungsEinstellungen(
  versionId: string,
  plattformId: string | null,
) {
  const [einstellung, setEinstellung] =
    useState<LangfristigeAuszahlungsEinstellung | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const basePath = `/api/langfristige-planung/${versionId}/auszahlungs-einstellungen`

  useEffect(() => {
    if (!versionId || !plattformId) {
      setEinstellung(null)
      return
    }
    let aktiv = true
    setLoading(true)
    setError(null)
    fetch(`${basePath}?plattform_id=${plattformId}`)
      .then(r => {
        if (!r.ok) throw new Error('API-Fehler')
        return r.json()
      })
      .then((data: LangfristigeAuszahlungsEinstellung | null) => {
        if (!aktiv) return
        setEinstellung(data)
        setLoading(false)
      })
      .catch(() => {
        if (!aktiv) return
        setError('Fehler beim Laden der Auszahlungseinstellungen.')
        setLoading(false)
      })
    return () => {
      aktiv = false
    }
  }, [versionId, plattformId, basePath])

  const upsert = useCallback(
    async (
      patch: Partial<LangfristigeAuszahlungsEinstellung> & {
        sales_plattform_id: string
      },
    ): Promise<void> => {
      const previous = einstellung
      const next: LangfristigeAuszahlungsEinstellung = {
        ...makeDefaultEinstellung(patch.sales_plattform_id),
        ...einstellung,
        ...patch,
      }
      setEinstellung(next)

      const res = await fetch(basePath, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(next),
      })

      if (!res.ok) {
        setEinstellung(previous)
        throw new Error('Speichern fehlgeschlagen')
      }

      const data: LangfristigeAuszahlungsEinstellung = await res.json()
      setEinstellung(data)
    },
    [einstellung, basePath],
  )

  return { einstellung, loading, error, upsert }
}
