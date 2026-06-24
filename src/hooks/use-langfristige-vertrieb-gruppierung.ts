'use client'

import { useState, useEffect, useCallback } from 'react'

// PROJ-78: Gemeinsame Gruppierungs-/Zahlungsziel-Einstellung der langfristigen
// Vertriebseinstellungen (Versand, Lager, Ersatzteile, Retouren-Allgemein).
//
// Abweichung zur kurzfristigen Planung: NUR „Monatlich" und „Quartalsweise"
// (kein „Wöchentlich"); KEINE „Nächste Zahlungswoche" (Basis-KW/-Jahr). Der
// Zahlungszeitpunkt ergibt sich deterministisch aus der Gruppierung (Anfang
// Folgemonat bzw. Anfang Folgemonat des Quartals) und wird erst in Folge-
// Features verwendet. Das Zahlungsziel (Tage) bleibt als zusätzlicher Versatz.

export type LangfristigeGruppierung = 'monatlich' | 'quartalsweise'

export const GRUPPIERUNGEN: LangfristigeGruppierung[] = ['monatlich', 'quartalsweise']

export const GRUPPIERUNG_LABELS: Record<LangfristigeGruppierung, string> = {
  monatlich: 'Monatlich',
  quartalsweise: 'Quartalsweise',
}

export interface VertriebGruppierungEinstellung {
  gruppierung: LangfristigeGruppierung
  zahlungsziel_tage: number | null
}

const DEFAULTS: VertriebGruppierungEinstellung = {
  gruppierung: 'monatlich',
  zahlungsziel_tage: null,
}

/**
 * Lädt/speichert Gruppierung + Zahlungsziel für einen Vertriebsbereich.
 *
 * - `plattformId` als String  → plattformgebundene Einstellung (Versand/Lager/
 *   Ersatzteile); GET nutzt `?plattform_id=`, PUT sendet `sales_plattform_id`.
 * - `plattformId === undefined` → versionsweite Einstellung (Retouren-Allgemein);
 *   ohne Plattform-Bezug.
 * - `plattformId === null`     → noch nicht bereit (z.B. Plattform lädt) → kein Fetch.
 */
export function useLangfristigeVertriebGruppierung(
  versionId: string,
  endpointSuffix: string,
  plattformId?: string | null,
) {
  const versionWeit = plattformId === undefined
  // Startet als „lädt", solange ein Fetch ansteht — sonst würde die einmalige
  // Initialisierung im Formular (initializedRef) schon vor dem Laden greifen und
  // den gespeicherten Zahlungsziel-Wert verbergen.
  const wirdLaden = !!versionId && (versionWeit || !!plattformId)

  const [einstellungen, setEinstellungen] =
    useState<VertriebGruppierungEinstellung | null>(null)
  const [loading, setLoading] = useState(wirdLaden)
  const [error, setError] = useState<string | null>(null)

  const basePath = `/api/langfristige-planung/${versionId}/vertrieb/${endpointSuffix}`

  useEffect(() => {
    if (!versionId) return
    if (!versionWeit && !plattformId) return
    let aktiv = true
    setLoading(true)
    setError(null)
    const url = versionWeit ? basePath : `${basePath}?plattform_id=${plattformId}`
    fetch(url)
      .then(r => {
        if (!r.ok) throw new Error('API-Fehler')
        return r.json()
      })
      .then((data: VertriebGruppierungEinstellung | null) => {
        if (!aktiv) return
        setEinstellungen(data)
        setLoading(false)
      })
      .catch(() => {
        if (!aktiv) return
        setError('Fehler beim Laden der Einstellungen.')
        setLoading(false)
      })
    return () => {
      aktiv = false
    }
  }, [versionId, plattformId, versionWeit, basePath])

  const upsert = useCallback(
    async (patch: Partial<VertriebGruppierungEinstellung>): Promise<void> => {
      if (!versionWeit && !plattformId) return
      const previous = einstellungen
      setEinstellungen(curr => ({ ...(curr ?? DEFAULTS), ...patch }))

      const body = versionWeit
        ? patch
        : { sales_plattform_id: plattformId, ...patch }

      const res = await fetch(basePath, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })

      if (!res.ok) {
        setEinstellungen(previous)
        throw new Error('Speichern fehlgeschlagen')
      }
    },
    [einstellungen, versionWeit, plattformId, basePath],
  )

  return { einstellungen: einstellungen ?? DEFAULTS, loading, error, upsert }
}
