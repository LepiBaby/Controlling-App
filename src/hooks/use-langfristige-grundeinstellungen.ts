'use client'

import { useState, useEffect, useCallback } from 'react'

export const DEFAULT_PLANUNGSHORIZONT_MONATE = 12
export const MIN_HORIZONT_MONATE = 1
export const MAX_HORIZONT_MONATE = 120

export interface LangfristigeGrundeinstellungen {
  startmonat_monat: number
  startmonat_jahr: number
  startkontostand: number
  planungshorizont_monate: number
  planungshorizont_absatz_monate: number | null
}

function currentMonthDefaults(): { monat: number; jahr: number } {
  const now = new Date()
  return { monat: now.getMonth() + 1, jahr: now.getFullYear() }
}

export function useLangfristigeGrundeinstellungen(versionId: string) {
  const fallback = currentMonthDefaults()
  const [startmonatMonat, setStartmonatMonat] = useState<number>(fallback.monat)
  const [startmonatJahr, setStartmonatJahr] = useState<number>(fallback.jahr)
  const [startkontostand, setStartkontostand] = useState<number>(0)
  const [planungshorizont, setPlanungshorizont] = useState<number>(DEFAULT_PLANUNGSHORIZONT_MONATE)
  const [planungshorizontAbsatz, setPlanungshorizontAbsatz] = useState<number | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!versionId) return
    let aktiv = true
    setLoading(true)
    setError(null)
    fetch(`/api/langfristige-planung/${versionId}/grundeinstellungen`)
      .then(r => {
        if (!r.ok) throw new Error('API-Fehler')
        return r.json()
      })
      .then((data: LangfristigeGrundeinstellungen) => {
        if (!aktiv) return
        setStartmonatMonat(data.startmonat_monat)
        setStartmonatJahr(data.startmonat_jahr)
        setStartkontostand(data.startkontostand)
        setPlanungshorizont(data.planungshorizont_monate)
        setPlanungshorizontAbsatz(data.planungshorizont_absatz_monate)
        setLoading(false)
      })
      .catch(() => {
        if (!aktiv) return
        setError('Fehler beim Laden der Grundeinstellungen.')
        setLoading(false)
      })
    return () => {
      aktiv = false
    }
  }, [versionId])

  async function put(body: Record<string, unknown>): Promise<void> {
    const res = await fetch(`/api/langfristige-planung/${versionId}/grundeinstellungen`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
    if (!res.ok) throw new Error('Speichern fehlgeschlagen')
  }

  const saveStartmonat = useCallback(
    async (monat: number, jahr: number): Promise<void> => {
      const prevMonat = startmonatMonat
      const prevJahr = startmonatJahr
      setStartmonatMonat(monat)
      setStartmonatJahr(jahr)
      try {
        await put({ startmonat_monat: monat, startmonat_jahr: jahr })
      } catch (e) {
        setStartmonatMonat(prevMonat)
        setStartmonatJahr(prevJahr)
        throw e
      }
    },
    [startmonatMonat, startmonatJahr, versionId],
  )

  const saveStartkontostand = useCallback(
    async (betrag: number): Promise<void> => {
      const previous = startkontostand
      setStartkontostand(betrag)
      try {
        await put({ startkontostand: betrag })
      } catch (e) {
        setStartkontostand(previous)
        throw e
      }
    },
    [startkontostand, versionId],
  )

  const savePlanungshorizont = useCallback(
    async (monate: number): Promise<void> => {
      const previous = planungshorizont
      setPlanungshorizont(monate)
      try {
        await put({ planungshorizont_monate: monate })
      } catch (e) {
        setPlanungshorizont(previous)
        throw e
      }
    },
    [planungshorizont, versionId],
  )

  const saveAbsatz = useCallback(
    async (monate: number | null): Promise<void> => {
      const previous = planungshorizontAbsatz
      setPlanungshorizontAbsatz(monate)
      try {
        await put({ planungshorizont_absatz_monate: monate })
      } catch (e) {
        setPlanungshorizontAbsatz(previous)
        throw e
      }
    },
    [planungshorizontAbsatz, versionId],
  )

  return {
    startmonatMonat,
    startmonatJahr,
    startkontostand,
    planungshorizont,
    planungshorizontAbsatz,
    loading,
    error,
    saveStartmonat,
    saveStartkontostand,
    savePlanungshorizont,
    saveAbsatz,
  }
}
