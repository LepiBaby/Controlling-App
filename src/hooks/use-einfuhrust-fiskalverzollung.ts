'use client'

import { useState, useEffect, useCallback } from 'react'
import { ustFiskalverzollungPfad } from '@/lib/steuereinstellungen-api'

export interface FiskalverzollungEintrag {
  produkt_id: string
  fiskalverzollung: boolean
}

// versionId optional: ohne → globale Kurzfristig-Fiskalverzollung (PROJ-65);
// mit → versionsgebundene Langfristig-Fiskalverzollung (PROJ-83).
export function useEinfuhrustFiskalverzollung(versionId?: string) {
  const [eintraege, setEintraege] = useState<FiskalverzollungEintrag[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const pfad = ustFiskalverzollungPfad(versionId)

  useEffect(() => {
    setLoading(true)
    setError(null)
    fetch(pfad)
      .then(r => {
        if (!r.ok) throw new Error('API-Fehler')
        return r.json()
      })
      .then((data: FiskalverzollungEintrag[]) => {
        setEintraege(data)
        setLoading(false)
      })
      .catch(() => {
        setError('Fehler beim Laden der Fiskalverzollung-Einstellungen.')
        setLoading(false)
      })
  }, [pfad])

  const toggle = useCallback(async (produkt_id: string, fiskalverzollung: boolean) => {
    setEintraege(prev => {
      const existing = prev.find(e => e.produkt_id === produkt_id)
      if (existing) return prev.map(e => e.produkt_id === produkt_id ? { ...e, fiskalverzollung } : e)
      return [...prev, { produkt_id, fiskalverzollung }]
    })

    const r = await fetch(pfad, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ produkt_id, fiskalverzollung }),
    })
    if (!r.ok) {
      const err = await r.json().catch(() => ({}))
      throw new Error((err as { error?: string }).error ?? 'Speichern fehlgeschlagen')
    }
  }, [pfad])

  function isFiskalverzollung(produkt_id: string): boolean {
    return eintraege.find(e => e.produkt_id === produkt_id)?.fiskalverzollung ?? false
  }

  return { eintraege, loading, error, toggle, isFiskalverzollung }
}
