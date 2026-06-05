'use client'

import { useState, useEffect, useCallback } from 'react'

export type BestellungStatus = 'plan' | 'laufend' | 'abgeschlossen'
export type ContainerArt = '20DC' | '40DC' | '40HQ'

export interface BestellungProdukt {
  id: string
  produkt_id: string
  produkt_name: string
}

export interface SkuMenge {
  id: string
  sku_id: string
  sku_name: string
  menge_theoretisch: number | null
  menge_praktisch: number
  begruendung_anpassung: string | null
}

export interface Konsolidierung {
  id: string
  bestellung_id_1: string
  bestellung_id_2: string
  containerart: ContainerArt
  andere_produkte: string[]
}

export interface Bestellung {
  id: string
  status: BestellungStatus
  bestelldatum: string | null
  produktionsstart_datum: string | null
  produktionsende_datum: string | null
  shippingdatum: string | null
  ankunftsdatum: string | null
  verfuegbarkeitsdatum: string | null
  abgeschlossen_am: string | null
  notizen: string | null
  created_at: string
  updated_at: string
  produkte: BestellungProdukt[]
  sku_mengen: SkuMenge[]
  konsolidierungen: Konsolidierung[]
}

export function berechneGesamtmenge(b: Bestellung): number {
  return b.sku_mengen.reduce((sum, s) => sum + s.menge_praktisch, 0)
}

export function berechneAktuellenStatus(b: Bestellung): string {
  const today = new Date()
  const parse = (d: string | null) => (d ? new Date(d) : null)

  const verfuegbar = parse(b.verfuegbarkeitsdatum)
  const ankunft = parse(b.ankunftsdatum)
  const shipping = parse(b.shippingdatum)
  const prodEnde = parse(b.produktionsende_datum)
  const prodStart = parse(b.produktionsstart_datum)

  if (verfuegbar && today >= verfuegbar) return 'Verfügbar'
  if (ankunft && today >= ankunft) return 'In Einlagerung'
  if (shipping && today >= shipping) return 'Unterwegs'
  if (prodEnde && today >= prodEnde) return 'Bereit zum Versand'
  if (prodStart && today >= prodStart) return 'In Produktion'
  return 'Bestellt'
}

export function useBestellungen(status: BestellungStatus) {
  const [bestellungen, setBestellungen] = useState<Bestellung[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const reload = useCallback(() => {
    setLoading(true)
    setError(null)
    fetch(`/api/bestellplanung/bestellungen?status=${status}`)
      .then(r => {
        if (!r.ok) throw new Error('API-Fehler')
        return r.json()
      })
      .then((data: Bestellung[]) => {
        setBestellungen(data ?? [])
        setLoading(false)
      })
      .catch(() => {
        setBestellungen([])
        setLoading(false)
      })
  }, [status])

  useEffect(() => {
    reload()
  }, [reload])

  const update = useCallback(
    async (id: string, patch: Partial<Bestellung>): Promise<Bestellung> => {
      const prev = bestellungen.find(b => b.id === id)
      setBestellungen(curr => curr.map(b => (b.id === id ? { ...b, ...patch } : b)))

      const res = await fetch(`/api/bestellplanung/bestellungen/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(patch),
      })

      if (!res.ok) {
        if (prev) setBestellungen(curr => curr.map(b => (b.id === id ? prev : b)))
        throw new Error('Speichern fehlgeschlagen')
      }

      const updated: Bestellung = await res.json()
      setBestellungen(curr => curr.map(b => (b.id === id ? updated : b)))
      return updated
    },
    [bestellungen],
  )

  const remove = useCallback(
    async (id: string): Promise<void> => {
      const prev = bestellungen.find(b => b.id === id)
      setBestellungen(curr => curr.filter(b => b.id !== id))

      const res = await fetch(`/api/bestellplanung/bestellungen/${id}`, { method: 'DELETE' })
      if (!res.ok) {
        if (prev) setBestellungen(curr => [...curr, prev])
        throw new Error('Löschen fehlgeschlagen')
      }
    },
    [bestellungen],
  )

  const changeStatus = useCallback(
    async (id: string, newStatus: BestellungStatus): Promise<Bestellung> => {
      const patch: Partial<Bestellung> = { status: newStatus }
      if (newStatus === 'abgeschlossen') {
        patch.abgeschlossen_am = new Date().toISOString().split('T')[0]
      }

      const res = await fetch(`/api/bestellplanung/bestellungen/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(patch),
      })

      if (!res.ok) throw new Error('Status-Änderung fehlgeschlagen')
      const updated: Bestellung = await res.json()
      setBestellungen(curr => curr.filter(b => b.id !== id))
      return updated
    },
    [bestellungen],
  )

  const addMany = useCallback((newItems: Bestellung[]) => {
    setBestellungen(curr => [...newItems, ...curr])
  }, [])

  return { bestellungen, loading, error, reload, update, remove, changeStatus, addMany }
}
