// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'
import { useLangfristigeInvestitionsausgaben } from './use-langfristige-investitionsausgaben'

// PROJ-105: Auswahllogik je Untergruppe — standardmäßig nur als Investition markierte
// Produkte; manuell ergänzte Produktzeilen kommen hinzu.

const grund = { startmonat_monat: 1, startmonat_jahr: 2026, planungshorizont_monate: 2 }

// p1 markiert (Investition), p2 & p3 nicht. sort_order = Anzeigereihenfolge.
const produkte = [
  { id: 'p1', name: 'Alpha', parent_id: null, level: 1, sort_order: 0, ist_investition: true },
  { id: 'p2', name: 'Bravo', parent_id: null, level: 1, sort_order: 1, ist_investition: false },
  { id: 'p3', name: 'Cesar', parent_id: null, level: 1, sort_order: 2, ist_investition: false },
]

const investition = [
  { id: 'iv1', name: 'Übergruppe', parent_id: null, level: 1, sort_order: 0 },
  { id: 'kat-a', name: 'Untergruppe A', parent_id: 'iv1', level: 2, sort_order: 0 },
  { id: 'kat-b', name: 'Untergruppe B', parent_id: 'iv1', level: 2, sort_order: 1 },
]

// p2 wurde manuell zu Untergruppe A ergänzt.
const produktzeilen = [{ kategorie_id: 'kat-a', produkt_id: 'p2' }]

function jsonRes(body: unknown) {
  return Promise.resolve({ ok: true, json: () => Promise.resolve(body) } as Response)
}

function mockFetch(input: RequestInfo | URL): Promise<Response> {
  const url = String(input)
  if (url.includes('/grundeinstellungen')) return jsonRes(grund)
  if (url.includes('art=lp_investition')) return jsonRes(investition)
  if (url.includes('art=lp_produkt')) return jsonRes(produkte)
  if (url.includes('/investitionsausgaben-planung/berechnet')) return jsonRes({ data: [] })
  if (url.includes('/investitionsausgaben-planung/produktzeilen')) return jsonRes(produktzeilen)
  if (url.includes('/investitionsausgaben-planung')) return jsonRes([]) // manuelle Werte
  return jsonRes([])
}

beforeEach(() => {
  vi.stubGlobal('fetch', vi.fn(mockFetch))
})
afterEach(() => {
  vi.unstubAllGlobals()
})

const ids = (arr: { id: string }[]) => arr.map(p => p.id)

describe('useLangfristigeInvestitionsausgaben — Produktzeilen-Auswahl (PROJ-105)', () => {
  it('zeigt je Untergruppe standardmäßig nur markierte Produkte, plus ergänzte', async () => {
    const { result } = renderHook(() => useLangfristigeInvestitionsausgaben('v1'))
    await waitFor(() => expect(result.current.loading).toBe(false))

    // Untergruppe A: markiert (p1) + ergänzt (p2), sortiert nach sort_order
    expect(ids(result.current.getUntergruppeProdukte('kat-a'))).toEqual(['p1', 'p2'])
    // Untergruppe B: nur markiert (p1)
    expect(ids(result.current.getUntergruppeProdukte('kat-b'))).toEqual(['p1'])
  })

  it('bietet im Picker nur noch nicht angezeigte Produkte an', async () => {
    const { result } = renderHook(() => useLangfristigeInvestitionsausgaben('v1'))
    await waitFor(() => expect(result.current.loading).toBe(false))

    // A: p1 (markiert) + p2 (ergänzt) sichtbar → nur p3 addbar
    expect(ids(result.current.getAddbareProdukte('kat-a'))).toEqual(['p3'])
    // B: nur p1 sichtbar → p2 + p3 addbar
    expect(ids(result.current.getAddbareProdukte('kat-b'))).toEqual(['p2', 'p3'])
  })

  it('markiert nur manuell ergänzte, nicht-markierte Zeilen als entfernbar', async () => {
    const { result } = renderHook(() => useLangfristigeInvestitionsausgaben('v1'))
    await waitFor(() => expect(result.current.loading).toBe(false))

    expect(result.current.isEntfernbareZeile('kat-a', 'p2')).toBe(true)  // ergänzt & nicht markiert
    expect(result.current.isEntfernbareZeile('kat-a', 'p1')).toBe(false) // markiert → Standardzeile
    expect(result.current.isEntfernbareZeile('kat-b', 'p2')).toBe(false) // dort nicht ergänzt
  })

  it('trägt die Investitions-Markierung an den Produkten', async () => {
    const { result } = renderHook(() => useLangfristigeInvestitionsausgaben('v1'))
    await waitFor(() => expect(result.current.loading).toBe(false))

    expect(result.current.produkte.find(p => p.id === 'p1')?.ist_investition).toBe(true)
    expect(result.current.produkte.find(p => p.id === 'p2')?.ist_investition).toBe(false)
  })
})
