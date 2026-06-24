'use client'

import { useState, useEffect, useCallback } from 'react'

// PROJ-78: Versionsweite, produktweise Retouren-Allgemein-Einstellungen.
// Abweichung zur kurzfristigen Variante: statt einer berechneten Berechnungsart
// (mittelwert_…) pflegt der Nutzer die Retourenquote MANUELL in Prozent.
// Versionsgebunden (kein Plattform-Bezug).

export interface LangfristigeRetourenAllgemeinProduktEinstellung {
  produkt_id: string
  retourenquote_prozent: number | null
  retourenhandling_kosten_euro_netto: number | null
}

export function makeEmptyRetourenAllgemeinProdukt(
  produktId: string,
): LangfristigeRetourenAllgemeinProduktEinstellung {
  return {
    produkt_id: produktId,
    retourenquote_prozent: null,
    retourenhandling_kosten_euro_netto: null,
  }
}

export function useLangfristigeRetourenAllgemeinProduktEinstellungen(versionId: string) {
  const [einstellungen, setEinstellungen] = useState<
    LangfristigeRetourenAllgemeinProduktEinstellung[]
  >([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const basePath = `/api/langfristige-planung/${versionId}/vertrieb/retouren-allgemein-produkt-einstellungen`

  useEffect(() => {
    if (!versionId) return
    let aktiv = true
    setLoading(true)
    setError(null)
    fetch(basePath)
      .then(r => {
        if (!r.ok) throw new Error('API-Fehler')
        return r.json()
      })
      .then((data: LangfristigeRetourenAllgemeinProduktEinstellung[]) => {
        if (!aktiv) return
        setEinstellungen(data)
        setLoading(false)
      })
      .catch(() => {
        if (!aktiv) return
        setError('Fehler beim Laden der allgemeinen Produkt-Retoureneinstellungen.')
        setLoading(false)
      })
    return () => {
      aktiv = false
    }
  }, [versionId, basePath])

  const getEinstellung = useCallback(
    (produktId: string): LangfristigeRetourenAllgemeinProduktEinstellung => {
      return (
        einstellungen.find(e => e.produkt_id === produktId) ??
        makeEmptyRetourenAllgemeinProdukt(produktId)
      )
    },
    [einstellungen],
  )

  const upsert = useCallback(
    async (patch: LangfristigeRetourenAllgemeinProduktEinstellung): Promise<void> => {
      const isSame = (e: LangfristigeRetourenAllgemeinProduktEinstellung) =>
        e.produkt_id === patch.produkt_id
      const previous = einstellungen.find(isSame)

      setEinstellungen(curr => {
        if (curr.some(isSame)) return curr.map(e => (isSame(e) ? { ...e, ...patch } : e))
        return [...curr, patch]
      })

      const res = await fetch(basePath, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(patch),
      })

      if (!res.ok) {
        setEinstellungen(curr => {
          if (previous) return curr.map(e => (isSame(e) ? previous : e))
          return curr.filter(e => !isSame(e))
        })
        throw new Error('Speichern fehlgeschlagen')
      }
    },
    [einstellungen, basePath],
  )

  return { einstellungen, loading, error, getEinstellung, upsert }
}
