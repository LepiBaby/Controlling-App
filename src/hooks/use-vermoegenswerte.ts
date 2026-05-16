'use client'

import { useState, useEffect, useCallback } from 'react'

export interface SnapshotLagerwert {
  id: string
  produkt_id: string | null
  lagerwert: number
}

export interface SnapshotTransitwert {
  id: string
  produkt_id: string | null
  ausgaben_transaktion_id: string | null
  transitwert: number
}

export interface SnapshotForderung {
  id: string
  plattform_id: string | null
  betrag: number
}

export interface VermoegenswertSnapshot {
  id: string
  datum: string
  verbindlichkeiten_llv: number
  verbindlichkeiten_sonstige: number
  darlehensvb: number
  steuersaldo_typ: 'forderung' | 'verbindlichkeit' | null
  steuersaldo: number | null
  steuersaldo_von: string | null
  steuersaldo_bis: string | null
  cash_bestand: number
  anlagevermoegen: number
  created_at: string
  lagerwerte: SnapshotLagerwert[]
  transitwerte: SnapshotTransitwert[]
  forderungen: SnapshotForderung[]
}

export interface VermoegenswertInput {
  datum: string
  lagerwerte: { produkt_id: string; lagerwert: number }[]
  transitwerte: { produkt_id: string; ausgaben_transaktion_id: string | null; transitwert: number }[]
  verbindlichkeiten_llv: number
  verbindlichkeiten_sonstige: number
  darlehensvb: number
  forderungen: { plattform_id: string | null; betrag: number }[]
  steuersaldo_typ: 'forderung' | 'verbindlichkeit' | null
  steuersaldo: number | null
  steuersaldo_von: string | null
  steuersaldo_bis: string | null
  cash_bestand: number
  anlagevermoegen: number
}

export interface VermoegenswertVorschlaege {
  lagerwerte: Record<string, number>
  verbindlichkeiten_llv: number
  verbindlichkeiten_sonstige: number
  darlehensvb: number
  darlehensvb_fremdkapital: number
  darlehensvb_tilgungen: number
  anlagevermoegen: number
  cash_bestand: number
}

export function useVermoegenswerte() {
  const [snapshots, setSnapshots] = useState<VermoegenswertSnapshot[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchData = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/vermoegenswerte')
      if (!res.ok) throw new Error((await res.json()).error ?? 'Fehler beim Laden')
      setSnapshots(await res.json())
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Fehler beim Laden')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { fetchData() }, [fetchData])

  const addSnapshot = useCallback(async (input: VermoegenswertInput): Promise<string | null> => {
    try {
      const res = await fetch('/api/vermoegenswerte', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(input),
      })
      if (!res.ok) {
        const json = await res.json()
        return json.error ?? 'Fehler beim Speichern'
      }
      await fetchData()
      return null
    } catch (e) {
      return e instanceof Error ? e.message : 'Fehler beim Speichern'
    }
  }, [fetchData])

  const deleteSnapshot = useCallback(async (id: string): Promise<string | null> => {
    try {
      const res = await fetch(`/api/vermoegenswerte/${id}`, { method: 'DELETE' })
      if (!res.ok) {
        const json = await res.json()
        return json.error ?? 'Fehler beim Löschen'
      }
      await fetchData()
      return null
    } catch (e) {
      return e instanceof Error ? e.message : 'Fehler beim Löschen'
    }
  }, [fetchData])

  return { snapshots, loading, error, addSnapshot, deleteSnapshot, refresh: fetchData }
}

export async function loadVorschlaege(datum: string): Promise<VermoegenswertVorschlaege> {
  const fallback: VermoegenswertVorschlaege = {
    lagerwerte: {},
    verbindlichkeiten_llv: 0,
    verbindlichkeiten_sonstige: 0,
    darlehensvb: 0,
    darlehensvb_fremdkapital: 0,
    darlehensvb_tilgungen: 0,
    anlagevermoegen: 0,
    cash_bestand: 0,
  }
  try {
    const res = await fetch(`/api/vermoegenswerte/vorschlaege?datum=${datum}`)
    if (!res.ok) return fallback
    return await res.json()
  } catch {
    return fallback
  }
}
