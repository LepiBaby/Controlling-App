'use client'

import { useState, useCallback } from 'react'

// PROJ-86: Bestelllauf der Langfristigen Planung (Produktebene, versionsgebunden).
//
// Spiegelt 1:1 die Shapes der KURZFRISTIGEN Planung (use-planbestelllauf.ts), damit
// derselbe 4-stufige Wizard wiederverwendet werden kann. Der einzige fachliche
// Unterschied ist die Produktebene: jede Bestellung hat genau EINEN sku_mengen-
// Eintrag, wobei sku_id = produkt_id und sku_name = produkt_name gesetzt sind.
//
// Die kurzfristigen Typen werden direkt re-exportiert (kein Duplikat), damit der
// portierte Wizard exakt dieselben Strukturen verwendet.

export type {
  PlanbestelllaufAenderung,
  SkuMengeVorschlag,
  NeuePlanbestellung,
  ProduktStammdaten,
} from '@/hooks/use-planbestelllauf'

import type {
  PlanbestelllaufAenderung,
  NeuePlanbestellung,
  ProduktStammdaten,
} from '@/hooks/use-planbestelllauf'

export interface LangfristigerBestelllaufErgebnis {
  aenderungen_bestehende: PlanbestelllaufAenderung[]
  neue_planbestellungen: NeuePlanbestellung[]
  produkt_stammdaten?: ProduktStammdaten[]
  container_global?: { volumen_20dc: number | null; volumen_40hq: number | null }
}

export function useLangfristigerBestelllauf(versionId: string) {
  const [loading, setLoading] = useState(false)
  const [ergebnis, setErgebnis] = useState<LangfristigerBestelllaufErgebnis | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [applying, setApplying] = useState(false)

  const basePath = `/api/langfristige-planung/${versionId}/bestellplanung/bestelllauf`

  const ausfuehren = useCallback(async (): Promise<LangfristigerBestelllaufErgebnis> => {
    setLoading(true)
    setError(null)
    setErgebnis(null)
    try {
      const res = await fetch(basePath, { method: 'POST' })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        const msg = (data as Record<string, string>).error ?? 'Bestelllauf konnte nicht ausgeführt werden.'
        setError(msg)
        setLoading(false)
        throw new Error(msg)
      }
      const data: LangfristigerBestelllaufErgebnis = await res.json()
      setErgebnis(data)
      setLoading(false)
      return data
    } catch (err) {
      setLoading(false)
      throw err
    }
  }, [basePath])

  const anwenden = useCallback(
    async (
      akzeptierteAenderungen: PlanbestelllaufAenderung[],
      neueBestellungen: NeuePlanbestellung[],
    ): Promise<Record<string, string>> => {
      setApplying(true)
      try {
        const res = await fetch(`${basePath}/anwenden`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            akzeptierte_aenderungen: akzeptierteAenderungen,
            neue_planbestellungen: neueBestellungen,
          }),
        })
        setApplying(false)
        if (!res.ok) {
          const data = await res.json().catch(() => ({}))
          throw new Error((data as Record<string, string>).error ?? 'Konnte Bestellungen nicht anlegen.')
        }
        const data = await res.json().catch(() => ({}))
        setErgebnis(null)
        // Erwartet { temp_id → echte id }. Backend kann das Mapping unter
        // tempToReal/temp_to_real liefern oder flach im Body.
        const map =
          (data as { tempToReal?: Record<string, string>; temp_to_real?: Record<string, string> })
            .tempToReal ??
          (data as { temp_to_real?: Record<string, string> }).temp_to_real ??
          (data as Record<string, string>)
        return map ?? {}
      } catch (err) {
        setApplying(false)
        throw err
      }
    },
    [basePath],
  )

  const reset = useCallback(() => {
    setErgebnis(null)
    setError(null)
  }, [])

  return { loading, ergebnis, error, applying, ausfuehren, anwenden, reset }
}
