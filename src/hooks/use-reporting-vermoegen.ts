'use client'

import { useState, useEffect } from 'react'

export interface VermoegenKPIs {
  datum: string
  lager: number
  transit: number
  warenkapital: number
  gesamt_forderungen: number
  verb_ll: number
  verb_sonstige: number
  darlehen: number
  cash: number
  anlagevermoegen: number
  // Waren-KPIs
  lager_anteil: number | null
  warenkapitalbindung: number
  warenbindungsquote: number | null
  lagerreichweite: number | null
  avg_monatssendungen: number
  steuerforderung: number
  // Liquiditäts-KPIs
  working_capital: number
  cash_ratio: number | null
  quick_ratio: number | null
  current_ratio: number | null
  // Vermögens-KPIs
  umlaufvermoegen: number
  steuerschulden: number
  eigenkapital: number
  fremdkapital: number
  gesamtvermoegen: number
  ek_quote: number | null
  fk_quote: number | null
  cash_quote: number | null
  uv_quote: number | null
}

export interface ProduktDetail {
  id: string
  name: string
  lager: number
  transit: number
  warenkapital: number
  avg_monatssendungen: number
  produktkosten: number
  lagerreichweite: number | null
}

export interface ReportingVermoegenData {
  latest: VermoegenKPIs | null
  series: VermoegenKPIs[]
  produkt_details: ProduktDetail[]
}

export function useReportingVermoegen() {
  const [data, setData] = useState<ReportingVermoegenData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setError(null)
    fetch('/api/reporting/vermoegen')
      .then(async (res) => {
        if (!res.ok) {
          const j = await res.json().catch(() => ({}))
          throw new Error(j.error ?? 'Fehler beim Laden')
        }
        return res.json() as Promise<ReportingVermoegenData>
      })
      .then((d) => { if (!cancelled) setData(d) })
      .catch((e) => { if (!cancelled) setError(e instanceof Error ? e.message : 'Fehler beim Laden') })
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [])

  return { data, loading, error }
}
