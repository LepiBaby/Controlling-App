'use client'

import { useState, useCallback } from 'react'
import type { ContainerArt } from './use-bestellungen'

export interface PlanbestelllaufAenderung {
  bestellung_id: string
  produkt_namen: string[]
  aenderungsart: 'bestelldatum' | 'menge' | 'konsolidierung'
  alt_wert: string
  neu_wert: string
  begruendung: string
}

export interface SkuMengeVorschlag {
  sku_id: string
  sku_name: string
  menge_theoretisch: number
  menge_praktisch: number
  begruendung_anpassung: string
}

export interface WizardKonsolidierung {
  mit_temp_id?: string
  mit_bestellung_id?: string
  mit_produkt_namen: string[]
  containerart: ContainerArt
}

export interface NeuePlanbestellung {
  temp_id: string
  produkt_ids: string[]
  produkt_namen: string[]
  bestelldatum: string | null
  produktionsstart_datum: string | null
  produktionsende_datum: string | null
  shippingdatum: string | null
  ankunftsdatum: string | null
  verfuegbarkeitsdatum: string | null
  sku_mengen: SkuMengeVorschlag[]
  konsolidierungen: WizardKonsolidierung[]
  warnungen: string[]
}

export interface PlanbestelllaufErgebnis {
  aenderungen_bestehende: PlanbestelllaufAenderung[]
  neue_planbestellungen: NeuePlanbestellung[]
}

export function usePlanbestelllauf() {
  const [loading, setLoading] = useState(false)
  const [ergebnis, setErgebnis] = useState<PlanbestelllaufErgebnis | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [applying, setApplying] = useState(false)

  const ausfuehren = useCallback(async (): Promise<PlanbestelllaufErgebnis> => {
    setLoading(true)
    setError(null)
    setErgebnis(null)

    try {
      const res = await fetch('/api/bestellplanung/planbestelllauf', { method: 'POST' })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        const msg = (data as Record<string, string>).error ?? 'Algorithmus konnte nicht ausgeführt werden.'
        setError(msg)
        setLoading(false)
        throw new Error(msg)
      }

      const data: PlanbestelllaufErgebnis = await res.json()
      setErgebnis(data)
      setLoading(false)
      return data
    } catch (err) {
      setLoading(false)
      throw err
    }
  }, [])

  const anwenden = useCallback(
    async (
      akzeptierteAenderungen: PlanbestelllaufAenderung[],
      neueBestellungen: NeuePlanbestellung[],
    ): Promise<void> => {
      setApplying(true)
      try {
        const res = await fetch('/api/bestellplanung/planbestelllauf/anwenden', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            akzeptierte_aenderungen: akzeptierteAenderungen,
            neue_bestellungen: neueBestellungen,
          }),
        })
        setApplying(false)
        if (!res.ok) throw new Error('Konnte Planbestellungen nicht anlegen.')
        setErgebnis(null)
      } catch (err) {
        setApplying(false)
        throw err
      }
    },
    [],
  )

  const reset = useCallback(() => {
    setErgebnis(null)
    setError(null)
  }, [])

  return { loading, ergebnis, error, applying, ausfuehren, anwenden, reset }
}
