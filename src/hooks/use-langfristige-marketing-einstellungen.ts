'use client'

import { useState, useEffect, useCallback } from 'react'

// PROJ-80: Versionsgebundene Marketing-Einstellungen der Langfristigen Planung.
// Spiegelt das obere Kanal-Formular der kurzfristigen Marketing-Einstellungen
// (PROJ-49), arbeitet aber gegen die versions-/nutzergesicherten Endpunkte.
// Pro Marketingkanal genau drei Felder: Sales Plattform (optional), Gruppierung
// (nur monatlich/quartalsweise) und Zahlungsziel in Tagen. KEINE Produkt-Tabelle,
// KEIN Datums-/KW-Picker, KEINE "Nächste Zahlungswoche".

export type Gruppierung = 'monatlich' | 'quartalsweise'

export interface LangfristigeMarketingEinstellung {
  marketingkanal_id: string
  sales_plattform_id: string | null
  gruppierung: Gruppierung
  zahlungsziel_tage: number | null
}

export const GRUPPIERUNG_VALUES: Gruppierung[] = ['monatlich', 'quartalsweise']

export const GRUPPIERUNG_LABELS: Record<Gruppierung, string> = {
  monatlich: 'Monatlich',
  quartalsweise: 'Quartalsweise',
}

// Feste Berechnungsregel je Gruppierung (nur Anzeige/Erläuterung – kein Anker).
export const GRUPPIERUNG_HINWEISE: Record<Gruppierung, string> = {
  monatlich: 'Berechnung am Anfang des Folgemonats',
  quartalsweise: 'Berechnung am Anfang des Monats nach dem Quartal',
}

export function makeDefaultEinstellung(
  marketingkanalId: string,
): LangfristigeMarketingEinstellung {
  return {
    marketingkanal_id: marketingkanalId,
    sales_plattform_id: null,
    gruppierung: 'monatlich',
    zahlungsziel_tage: null,
  }
}

export function useLangfristigeMarketingEinstellungen(
  versionId: string,
  marketingkanalId: string | null,
) {
  const [einstellung, setEinstellung] =
    useState<LangfristigeMarketingEinstellung | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const basePath = `/api/langfristige-planung/${versionId}/marketing-einstellungen`

  useEffect(() => {
    if (!versionId || !marketingkanalId) {
      setEinstellung(null)
      return
    }
    let aktiv = true
    setLoading(true)
    setError(null)
    fetch(`${basePath}?marketingkanal_id=${marketingkanalId}`)
      .then(r => {
        if (!r.ok) throw new Error('API-Fehler')
        return r.json()
      })
      .then((data: LangfristigeMarketingEinstellung | null) => {
        if (!aktiv) return
        setEinstellung(data)
        setLoading(false)
      })
      .catch(() => {
        if (!aktiv) return
        setError('Fehler beim Laden der Marketing-Einstellungen.')
        setLoading(false)
      })
    return () => {
      aktiv = false
    }
  }, [versionId, marketingkanalId, basePath])

  const upsert = useCallback(
    async (
      patch: Partial<LangfristigeMarketingEinstellung> & {
        marketingkanal_id: string
      },
    ): Promise<void> => {
      const previous = einstellung
      const next: LangfristigeMarketingEinstellung = {
        ...makeDefaultEinstellung(patch.marketingkanal_id),
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

      const data: LangfristigeMarketingEinstellung = await res.json()
      setEinstellung(data)
    },
    [einstellung, basePath],
  )

  return { einstellung, loading, error, upsert }
}
