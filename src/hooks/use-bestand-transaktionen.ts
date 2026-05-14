'use client'

import { useState, useEffect, useCallback } from 'react'

export interface BestandSendung {
  id: string
  transaktion_id: string
  plattform_id: string
  menge: number
}

export interface BestandTransaktion {
  id: string
  sku_id: string
  produkt_id: string
  datum: string
  anfangsbestand: number
  einlagerungen: number
  anpassungen_positiv: number
  anpassungen_negativ: number
  warenverluste: number
  sendungen_manuell: number
  created_at: string
  sendungen: BestandSendung[]
}

export interface BestandFormData {
  datum: string
  anfangsbestand: number
  einlagerungen: number
  anpassungen_positiv: number
  anpassungen_negativ: number
  warenverluste: number
  sendungen_manuell: number
  sendungen: { plattform_id: string; menge: number }[]
}

export function calcEndbestand(t: {
  anfangsbestand: number
  einlagerungen: number
  anpassungen_positiv: number
  anpassungen_negativ: number
  warenverluste: number
  sendungen_manuell: number
  sendungen: { menge: number }[]
}): number {
  const totalSendungen = t.sendungen.reduce((sum, s) => sum + s.menge, 0)
  return (
    t.anfangsbestand -
    totalSendungen -
    t.sendungen_manuell +
    t.einlagerungen +
    t.anpassungen_positiv -
    t.anpassungen_negativ -
    t.warenverluste
  )
}

export function useBestandTransaktionen(skuId: string | null) {
  const [transaktionen, setTransaktionen] = useState<BestandTransaktion[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const fetchData = useCallback(async () => {
    if (!skuId) {
      setTransaktionen([])
      return
    }
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`/api/bestand-transaktionen?sku_id=${skuId}`)
      if (!res.ok) throw new Error((await res.json()).error ?? 'Fehler beim Laden')
      const json = await res.json()
      setTransaktionen(json.data)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Fehler beim Laden')
    } finally {
      setLoading(false)
    }
  }, [skuId])

  useEffect(() => { fetchData() }, [fetchData])

  const addTransaktion = useCallback(async (
    skuIdArg: string,
    produktId: string,
    data: BestandFormData,
  ) => {
    const res = await fetch('/api/bestand-transaktionen', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sku_id: skuIdArg, produkt_id: produktId, ...data }),
    })
    if (!res.ok) throw new Error((await res.json()).error ?? 'Fehler beim Speichern')
    await fetchData()
  }, [fetchData])

  const updateTransaktion = useCallback(async (id: string, data: BestandFormData) => {
    const res = await fetch(`/api/bestand-transaktionen/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    })
    if (!res.ok) throw new Error((await res.json()).error ?? 'Fehler beim Aktualisieren')
    await fetchData()
  }, [fetchData])

  const deleteTransaktion = useCallback(async (id: string) => {
    const res = await fetch(`/api/bestand-transaktionen/${id}`, { method: 'DELETE' })
    if (!res.ok) throw new Error((await res.json()).error ?? 'Fehler beim Löschen')
    await fetchData()
  }, [fetchData])

  return { transaktionen, loading, error, addTransaktion, updateTransaktion, deleteTransaktion }
}
