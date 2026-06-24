'use client'

import { useCallback } from 'react'

export interface KonsolidierungsAenderung {
  bestellung_id: string
  neue_daten: {
    bestelldatum: string | null
    produktionsstart_datum: string | null
    produktionsende_datum: string | null
    shippingdatum: string | null
    ankunftsdatum: string | null
    verfuegbarkeitsdatum: string | null
  }
  neue_sku_mengen: Array<{
    sku_id: string
    menge_praktisch: number
    begruendung_anpassung: string
  }>
  container_anteil: Record<string, number>
  snapshot_vor_konsolidierung: {
    bestelldatum: string | null
    produktionsstart_datum: string | null
    produktionsende_datum: string | null
    shippingdatum: string | null
    ankunftsdatum: string | null
    verfuegbarkeitsdatum: string | null
    anzahl_40hq: number
    anzahl_20dc: number
    sku_mengen: Array<{
      sku_id: string
      menge_praktisch: number
      begruendung_anpassung: string | null
    }>
  }
}

export interface KonsolidierungsRequest {
  bestellung_ids: string[]
  aenderungen: KonsolidierungsAenderung[]
}

export interface KonsolidierungsResponse {
  gruppe_id: string
  success: boolean
}

export function useKonsolidierung() {
  const konsolidieren = useCallback(
    async (request: KonsolidierungsRequest): Promise<KonsolidierungsResponse> => {
      const res = await fetch('/api/bestellplanung/konsolidierung', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(request),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error((data as Record<string, string>).error ?? 'Konsolidierung fehlgeschlagen.')
      }
      return res.json()
    },
    [],
  )

  const aufheben = useCallback(
    async (gruppeId: string, options?: { dissolveOnly?: boolean }): Promise<void> => {
      const url = options?.dissolveOnly
        ? `/api/bestellplanung/konsolidierung/${gruppeId}?dissolve_only=true`
        : `/api/bestellplanung/konsolidierung/${gruppeId}`
      const res = await fetch(url, { method: 'DELETE' })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error((data as Record<string, string>).error ?? 'Aufheben fehlgeschlagen.')
      }
    },
    [],
  )

  return { konsolidieren, aufheben }
}
