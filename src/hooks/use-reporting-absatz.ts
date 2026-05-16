'use client'

import { useState, useEffect, useCallback } from 'react'

export interface AbsatzPlattform {
  id: string
  name: string
  values: Record<string, number>
}

export interface AbsatzProdukt {
  id: string
  name: string
  sort_order: number
  values: Record<string, number>
  plattformen: AbsatzPlattform[]
}

export interface AbsatzData {
  perioden: string[]
  gesamt: Record<string, number>
  produkte: AbsatzProdukt[]
}

export function useReportingAbsatz(params: {
  von: string
  bis: string
  granularitaet: string
  produkt_ids?: string[]
  plattform_ids?: string[]
}) {
  const { von, bis, granularitaet, produkt_ids, plattform_ids } = params
  const produkt_ids_str = (produkt_ids ?? []).join(',')
  const plattform_ids_str = (plattform_ids ?? []).join(',')

  const [data, setData] = useState<AbsatzData | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const fetchData = useCallback(async () => {
    if (!von || !bis) {
      setData(null)
      return
    }
    setLoading(true)
    setError(null)
    try {
      const urlParams = new URLSearchParams({ von, bis, granularitaet })
      if (produkt_ids_str) urlParams.set('produkt_ids', produkt_ids_str)
      if (plattform_ids_str) urlParams.set('plattform_ids', plattform_ids_str)
      const res = await fetch(`/api/reporting/absatz?${urlParams}`)
      if (!res.ok) throw new Error((await res.json()).error ?? 'Fehler beim Laden')
      setData(await res.json())
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Fehler beim Laden')
    } finally {
      setLoading(false)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [von, bis, granularitaet, produkt_ids_str, plattform_ids_str])

  useEffect(() => { fetchData() }, [fetchData])

  return { data, loading, error }
}
