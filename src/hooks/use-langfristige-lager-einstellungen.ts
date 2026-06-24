'use client'

import { useState, useEffect, useCallback } from 'react'

// PROJ-78: Lagerkosten je Produkt einer Planversion. Abweichung zur kurzfristigen
// Variante: die Lagerkosten werden MONATLICH gepflegt (€/m³/Monat netto), nicht
// wöchentlich. Inklusive Batch-Funktion „Alle Produkte gleichsetzen".

export interface LangfristigeLagerEinstellung {
  sales_plattform_id: string
  produkt_id: string
  lagerkosten_euro_m3_monat: number | null
}

export function makeEmptyLagerEinstellung(
  plattformId: string,
  produktId: string,
): LangfristigeLagerEinstellung {
  return {
    sales_plattform_id: plattformId,
    produkt_id: produktId,
    lagerkosten_euro_m3_monat: null,
  }
}

export function useLangfristigeLagerEinstellungen(
  versionId: string,
  plattformId: string | null,
) {
  const [einstellungen, setEinstellungen] = useState<LangfristigeLagerEinstellung[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const basePath = `/api/langfristige-planung/${versionId}/vertrieb/lager-einstellungen`

  useEffect(() => {
    if (!versionId || !plattformId) return
    let aktiv = true
    setLoading(true)
    setError(null)
    fetch(`${basePath}?plattform_id=${plattformId}`)
      .then(r => {
        if (!r.ok) throw new Error('API-Fehler')
        return r.json()
      })
      .then((data: LangfristigeLagerEinstellung[]) => {
        if (!aktiv) return
        setEinstellungen(data)
        setLoading(false)
      })
      .catch(() => {
        if (!aktiv) return
        setError('Fehler beim Laden der Lager-Einstellungen.')
        setLoading(false)
      })
    return () => {
      aktiv = false
    }
  }, [versionId, plattformId, basePath])

  const getEinstellung = useCallback(
    (produktId: string): LangfristigeLagerEinstellung => {
      if (!plattformId) return makeEmptyLagerEinstellung('', produktId)
      return (
        einstellungen.find(e => e.produkt_id === produktId) ??
        makeEmptyLagerEinstellung(plattformId, produktId)
      )
    },
    [einstellungen, plattformId],
  )

  const upsert = useCallback(
    async (patch: LangfristigeLagerEinstellung): Promise<void> => {
      const isSame = (e: LangfristigeLagerEinstellung) =>
        e.sales_plattform_id === patch.sales_plattform_id && e.produkt_id === patch.produkt_id

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

  const batchUpsert = useCallback(
    async (
      salesPlattformId: string,
      lagerkostenEuroM3Monat: number | null,
      produktIds: string[],
    ): Promise<void> => {
      const previous = [...einstellungen]

      setEinstellungen(curr => {
        const result = [...curr]
        for (const produktId of produktIds) {
          const idx = result.findIndex(
            e => e.sales_plattform_id === salesPlattformId && e.produkt_id === produktId,
          )
          if (idx >= 0) {
            result[idx] = { ...result[idx], lagerkosten_euro_m3_monat: lagerkostenEuroM3Monat }
          } else {
            result.push({
              sales_plattform_id: salesPlattformId,
              produkt_id: produktId,
              lagerkosten_euro_m3_monat: lagerkostenEuroM3Monat,
            })
          }
        }
        return result
      })

      const res = await fetch(`${basePath}/batch`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sales_plattform_id: salesPlattformId,
          lagerkosten_euro_m3_monat: lagerkostenEuroM3Monat,
        }),
      })

      if (!res.ok) {
        setEinstellungen(previous)
        throw new Error('Batch-Upsert fehlgeschlagen')
      }

      const data: LangfristigeLagerEinstellung[] = await res.json()
      setEinstellungen(curr => {
        const others = curr.filter(e => e.sales_plattform_id !== salesPlattformId)
        return [...others, ...data]
      })
    },
    [einstellungen, basePath],
  )

  return { einstellungen, loading, error, getEinstellung, upsert, batchUpsert }
}
