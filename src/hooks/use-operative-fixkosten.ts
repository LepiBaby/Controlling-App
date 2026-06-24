'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'

export type Zahlungsfrequenz = 'monatlich' | 'quartalsweise' | 'jaehrlich'
export type ZeitpunktImMonat = 'anfang' | 'mitte' | 'ende'
export type UstSatz = '0' | '7' | '19' | 'individuell'

export const ZAHLUNGSFREQUENZ_LABELS: Record<Zahlungsfrequenz, string> = {
  monatlich: 'Monatlich',
  quartalsweise: 'Quartalsweise',
  jaehrlich: 'Jährlich',
}

export const ZEITPUNKT_LABELS: Record<ZeitpunktImMonat, string> = {
  anfang: 'Anfang',
  mitte: 'Mitte',
  ende: 'Ende',
}

export const UST_SATZ_LABELS: Record<UstSatz, string> = {
  '0': '0 % USt',
  '7': '7 % USt',
  '19': '19 % USt',
  individuell: 'Individuell',
}

export const MONAT_LABELS: Record<number, string> = {
  1: 'Januar', 2: 'Februar', 3: 'März', 4: 'April',
  5: 'Mai', 6: 'Juni', 7: 'Juli', 8: 'August',
  9: 'September', 10: 'Oktober', 11: 'November', 12: 'Dezember',
}

export const MONAT_KURZ: Record<number, string> = {
  1: 'Jan', 2: 'Feb', 3: 'Mär', 4: 'Apr',
  5: 'Mai', 6: 'Jun', 7: 'Jul', 8: 'Aug',
  9: 'Sep', 10: 'Okt', 11: 'Nov', 12: 'Dez',
}

export interface OperativeFixkostenEintrag {
  id: string
  kategorie_id: string
  kategorie_name: string
  untergruppe_id: string | null
  untergruppe_name: string | null
  name: string
  zahlungsfrequenz: Zahlungsfrequenz
  faelligkeits_monate: number[]
  zeitpunkt_im_monat: ZeitpunktImMonat
  zahlungsziel_tage: number | null
  betrag_netto: number
  ust_satz: UstSatz
  ust_betrag: number
  bruttobetrag: number
  aktiv: boolean
  aktiv_von: string | null
  aktiv_bis: string | null
  created_at: string
  updated_at: string
}

export interface OperativeFixkostenInput {
  kategorie_id: string
  untergruppe_id: string | null
  name: string
  zahlungsfrequenz: Zahlungsfrequenz
  faelligkeits_monate: number[]
  zeitpunkt_im_monat: ZeitpunktImMonat
  zahlungsziel_tage: number | null
  betrag_netto: number
  ust_satz: UstSatz
  ust_betrag_individuell?: number
  aktiv: boolean
  aktiv_von: string | null
  aktiv_bis: string | null
}

export function getKalenderwoche(dateStr: string | null): string | null {
  if (!dateStr) return null
  const date = new Date(dateStr)
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()))
  const dayNum = d.getUTCDay() || 7
  d.setUTCDate(d.getUTCDate() + 4 - dayNum)
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1))
  const kw = Math.ceil((((d.getTime() - yearStart.getTime()) / 86400000) + 1) / 7)
  return `KW ${kw}/${d.getUTCFullYear()}`
}

export function berechneNettoMonatlich(
  betrag_netto: number,
  frequenz: Zahlungsfrequenz,
): number {
  if (frequenz === 'monatlich') return betrag_netto
  if (frequenz === 'quartalsweise') return betrag_netto / 3
  return betrag_netto / 12
}

export function formatFaelligkeitsMonate(
  monate: number[],
  frequenz: Zahlungsfrequenz,
): string {
  if (frequenz === 'monatlich') return 'Alle Monate'
  const sorted = [...monate].sort((a, b) => a - b)
  return sorted.map(m => MONAT_KURZ[m]).join(', ')
}

export function useOperativeFixkosten() {
  const [eintraege, setEintraege] = useState<OperativeFixkostenEintrag[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(() => {
    setLoading(true)
    setError(null)
    fetch('/api/operative-fixkosten-einstellungen')
      .then(r => {
        if (!r.ok) throw new Error('API-Fehler')
        return r.json()
      })
      .then((data: OperativeFixkostenEintrag[]) => {
        setEintraege(data)
        setLoading(false)
      })
      .catch(() => {
        setError('Fehler beim Laden der Fixkosten.')
        setLoading(false)
      })
  }, [])

  useEffect(() => { load() }, [load])

  const create = useCallback(async (input: OperativeFixkostenInput): Promise<void> => {
    const res = await fetch('/api/operative-fixkosten-einstellungen', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(input),
    })
    if (!res.ok) {
      const body = await res.json().catch(() => ({}))
      throw new Error(body?.error ?? 'Fehler beim Speichern.')
    }
    const created: OperativeFixkostenEintrag = await res.json()
    setEintraege(prev => [created, ...prev])
  }, [])

  const update = useCallback(async (id: string, input: OperativeFixkostenInput): Promise<void> => {
    const prev = eintraege.find(e => e.id === id)
    setEintraege(current => current.map(e => e.id === id ? { ...e, ...input } : e))
    const res = await fetch(`/api/operative-fixkosten-einstellungen/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(input),
    })
    if (!res.ok) {
      if (prev) setEintraege(current => current.map(e => e.id === id ? prev : e))
      const body = await res.json().catch(() => ({}))
      throw new Error(body?.error ?? 'Fehler beim Aktualisieren.')
    }
    const updated: OperativeFixkostenEintrag = await res.json()
    setEintraege(current => current.map(e => e.id === id ? updated : e))
  }, [eintraege])

  const remove = useCallback(async (id: string): Promise<void> => {
    const prev = eintraege
    setEintraege(current => current.filter(e => e.id !== id))
    const res = await fetch(`/api/operative-fixkosten-einstellungen/${id}`, { method: 'DELETE' })
    if (!res.ok) {
      setEintraege(prev)
      throw new Error('Fehler beim Löschen.')
    }
  }, [eintraege])

  const gesamtNettoMonatlich = useMemo(
    () => eintraege
      .filter(e => e.aktiv)
      .reduce((sum, e) => sum + berechneNettoMonatlich(e.betrag_netto, e.zahlungsfrequenz), 0),
    [eintraege],
  )

  const gesamtNettoMonatlichNachKategorie = useMemo(() => {
    const map = new Map<string, { name: string; summe: number }>()
    eintraege
      .filter(e => e.aktiv)
      .forEach(e => {
        const existing = map.get(e.kategorie_id)
        const betrag = berechneNettoMonatlich(e.betrag_netto, e.zahlungsfrequenz)
        if (existing) existing.summe += betrag
        else map.set(e.kategorie_id, { name: e.kategorie_name, summe: betrag })
      })
    return [...map.values()].sort((a, b) => b.summe - a.summe)
  }, [eintraege])

  return {
    eintraege,
    loading,
    error,
    create,
    update,
    remove,
    gesamtNettoMonatlich,
    gesamtNettoMonatlichNachKategorie,
  }
}
