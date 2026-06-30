'use client'

import { useState, useCallback } from 'react'

export interface PlanbestelllaufAenderung {
  bestellung_id: string
  produkt_ids?: string[]
  produkt_namen: string[]
  aenderungsart: 'bestelldatum' | 'menge' | 'bestelldatum_und_menge' | 'keine_aenderung' | 'kein_bedarf' | 'konsolidierung'
  herkunft?: 'algorithmus' | 'manuell'
  alt_wert: string
  neu_wert: string
  begruendung: string
  warnungen?: string[]
  konsolidierungspartner?: Array<{
    bestellung_id: string
    produkt_namen: string[]
    bestelldatum: string | null
    anzahl_40hq: number
    anzahl_20dc: number
    container_anteil: Record<string, number> | null
  }>
  alte_daten?: {
    bestelldatum?: string
    produktionsstart_datum?: string
    produktionsende_datum?: string
    shippingdatum?: string
    ankunftsdatum?: string
    verfuegbarkeitsdatum?: string
    container?: Array<'20DC' | '40HQ'>
    sku_mengen?: Array<{ sku_id: string; menge_theoretisch: number | null; menge_nach_moq?: number | null; menge_praktisch: number }>
  }
  neue_daten?: {
    bestelldatum?: string
    produktionsstart_datum?: string
    produktionsende_datum?: string
    shippingdatum?: string
    ankunftsdatum?: string
    verfuegbarkeitsdatum?: string
    container?: Array<'20DC' | '40HQ'>
    sku_mengen?: Array<{ sku_id: string; sku_name?: string; menge_theoretisch?: number; menge_nach_moq?: number; menge_praktisch: number; begruendung_anpassung: string; is_trigger?: boolean }>
  }
}

export interface SkuMengeVorschlag {
  sku_id: string
  sku_name: string
  menge_theoretisch: number
  menge_nach_moq: number
  menge_praktisch: number
  begruendung_anpassung: string
  is_trigger?: boolean
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
  warnungen: string[]
  container?: Array<'20DC' | '40HQ'>
}

export interface ProduktStammdaten {
  produkt_id: string
  produkt_name: string
  hersteller_id: string | null
  hersteller_name: string | null
  stueckvolumen_m3: number | null
  max_20dc: number | null
  max_40hq: number | null
  produktionszeit_tage: number
  zwischenzeit_tage: number
  shipping_zeit_tage: number
  entladungszeit_tage: number
  pufferzeit_tage: number
}

export interface PlanbestelllaufErgebnis {
  aenderungen_bestehende: PlanbestelllaufAenderung[]
  neue_planbestellungen: NeuePlanbestellung[]
  produkt_stammdaten?: ProduktStammdaten[]
  container_global?: { volumen_20dc: number | null; volumen_40hq: number | null }
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

  // Zweiter Lauf nach den Entscheidungen aus Schritt 1: berechnet die neuen Planbestellungen
  // neu (unter Berücksichtigung der behaltenen/geänderten bestehenden Planbestellungen).
  // Aktualisiert NUR neue_planbestellungen + Stammdaten; aenderungen_bestehende aus dem 1. Lauf
  // bleiben erhalten (werden beim Anwenden noch benötigt).
  const ausfuehrenRerun = useCallback(
    async (entscheidungen: {
      geloeschte_ids: string[]
      geaenderte: Array<{ bestellung_id: string; verfuegbarkeitsdatum: string | null; sku_mengen: Array<{ sku_id: string; menge_praktisch: number }> }>
    }): Promise<PlanbestelllaufErgebnis> => {
      const res = await fetch('/api/bestellplanung/planbestelllauf', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ modus: 'rerun', entscheidungen }),
      })
      if (!res.ok) throw new Error('Neuberechnung fehlgeschlagen.')
      const data: PlanbestelllaufErgebnis = await res.json()
      setErgebnis(prev => prev ? {
        ...prev,
        neue_planbestellungen: data.neue_planbestellungen,
        produkt_stammdaten: data.produkt_stammdaten ?? prev.produkt_stammdaten,
        container_global: data.container_global ?? prev.container_global,
      } : data)
      return data
    },
    [],
  )

  const anwenden = useCallback(
    async (
      akzeptierteAenderungen: PlanbestelllaufAenderung[],
      neueBestellungen: NeuePlanbestellung[],
    ): Promise<Record<string, string>> => {
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
        const data = await res.json().catch(() => ({}))
        setErgebnis(null)
        return (data as Record<string, string>) ?? {}
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

  return { loading, ergebnis, error, applying, ausfuehren, ausfuehrenRerun, anwenden, reset }
}
