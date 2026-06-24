'use client'

import { useState, useEffect, useCallback } from 'react'
import { ustKategorieSaetzePfad } from '@/lib/steuereinstellungen-api'

export interface UstKategorieSatz {
  kategorie_id: string
  ebene: 1 | 2
  ust_satz: number | null
  // PROJ-83: Im Versions-Modus zeigt eine Satz-Zeile entweder auf eine GLOBALE
  // KPI-Kategorie ('global') oder auf eine Versions-Kategorie ('version',
  // d.h. Produkt/Marketingkanal/Investitionsgruppe). Im Kurzfristig-Modus
  // bleibt das Feld leer (globale Route ignoriert es).
  quelle?: 'global' | 'version'
}

// versionId optional: ohne → globale Kurzfristig-Sätze (PROJ-65);
// mit → versionsgebundene Langfristig-Sätze (PROJ-83).
export function useUstKategorieSaetze(versionId?: string) {
  const [saetze, setSaetze] = useState<UstKategorieSatz[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const pfad = ustKategorieSaetzePfad(versionId)

  const load = useCallback(() => {
    setLoading(true)
    setError(null)
    fetch(pfad)
      .then(r => {
        if (!r.ok) throw new Error('API-Fehler')
        return r.json()
      })
      .then((data: UstKategorieSatz[]) => {
        setSaetze(data)
        setLoading(false)
      })
      .catch(() => {
        setError('Fehler beim Laden der UST-Sätze.')
        setLoading(false)
      })
  }, [pfad])

  useEffect(() => {
    load()
  }, [load])

  const saveBatch = useCallback(async (items: UstKategorieSatz[]): Promise<void> => {
    const r = await fetch(pfad, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(items),
    })
    if (!r.ok) {
      const err = await r.json().catch(() => ({}))
      throw new Error((err as { error?: string }).error ?? 'Speichern fehlgeschlagen')
    }
    const updated: UstKategorieSatz[] = await r.json()
    setSaetze(updated)
  }, [pfad])

  return { saetze, loading, error, saveBatch }
}
