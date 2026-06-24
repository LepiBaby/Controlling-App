import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook } from '@testing-library/react'
import {
  useLangfristigeInvestitionsauswertung,
  applyIaZeitansicht,
  collectIaExpandableIds,
  type IaModel,
  type IaNode,
} from './use-langfristige-investitionsauswertung'

// PROJ-99: Investitionsauswertung (read-only). Die Seite rechnet aus der bestehenden
// PROJ-92-Datenbeschaffung den effektiven Soll (manuell → berechnet → 0), baut die
// Hierarchie Obergruppe → Untergruppe → Produkt (+ "Investitionen (Gesamt)") und zeigt
// auf Produktebene NUR Produkte, für die Daten vorliegen. Wir mocken die PROJ-92-Quelle
// und treiben den Hook über renderHook.

// ─── Mock der PROJ-92-Datenquelle ─────────────────────────────────────────────

interface Cell { jahr: number; monat: number }
const cellKey = (k: string, p: string, c: Cell) => `${k}:${p}:${c.jahr}-${c.monat}`

const mockState = vi.hoisted(() => ({
  monate: [] as { year: number; month: number; label: string }[],
  kategorien: [] as { id: string; name: string; parent_id: string | null; level: number; sort_order: number }[],
  produkte: [] as { id: string; name: string; sort_order: number }[],
  loading: false,
  error: null as string | null,
  manuell: new Map<string, number>(),
  berechnet: new Map<string, number>(),
}))

vi.mock('@/hooks/use-langfristige-investitionsausgaben', () => ({
  useLangfristigeInvestitionsausgaben: () => ({
    monate: mockState.monate,
    kategorien: mockState.kategorien,
    produkte: mockState.produkte,
    values: new Map(),
    berechneteWerte: new Map(),
    loading: mockState.loading,
    error: mockState.error,
    getManuellerWert: (k: string, p: string, m: { year: number; month: number }) => {
      const key = `${k}:${p}:${m.year}-${m.month}`
      return mockState.manuell.has(key) ? (mockState.manuell.get(key) as number) : null
    },
    getBerechneterWert: (k: string, p: string, m: { year: number; month: number }) => {
      const key = `${k}:${p}:${m.year}-${m.month}`
      return mockState.berechnet.has(key) ? (mockState.berechnet.get(key) as number) : null
    },
    isManuelleOverride: (k: string, p: string, m: { year: number; month: number }) =>
      mockState.manuell.has(`${k}:${p}:${m.year}-${m.month}`),
    upsertZelle: async () => {},
    resetAll: async () => {},
  }),
}))

// Cell-Helfer für die mockState-Maps (jahr/monat aus den Monaten).
const M1: Cell = { jahr: 2026, monat: 4 }
const M2: Cell = { jahr: 2026, monat: 5 }

function setupBasisStruktur() {
  mockState.monate = [
    { year: 2026, month: 4, label: 'Apr 2026' },
    { year: 2026, month: 5, label: 'Mai 2026' },
  ]
  mockState.kategorien = [
    { id: 'og1', name: 'Produktinvestitionen Einkauf', parent_id: null, level: 1, sort_order: 0 },
    { id: 'ug1', name: 'Ware', parent_id: 'og1', level: 2, sort_order: 0 },
    { id: 'ug2', name: 'Zoll', parent_id: 'og1', level: 2, sort_order: 1 },
  ]
  mockState.produkte = [
    { id: 'p1', name: 'Produkt A', sort_order: 0 },
    { id: 'p2', name: 'Produkt B', sort_order: 1 },
  ]
  mockState.loading = false
  mockState.error = null
  mockState.manuell = new Map()
  mockState.berechnet = new Map()
}

beforeEach(() => {
  setupBasisStruktur()
})

// ─── Hook: Baum, effektiver Soll, Produktfilter ───────────────────────────────

describe('useLangfristigeInvestitionsauswertung — Baum & effektiver Soll', () => {
  it('baut Obergruppe → Untergruppe → Produkt und summiert nach oben', () => {
    // ug1/p1 manuell 100 (nur M1); ug1/p2 berechnet 50 in M1 und M2
    mockState.manuell.set(cellKey('ug1', 'p1', M1), 100)
    mockState.berechnet.set(cellKey('ug1', 'p2', M1), 50)
    mockState.berechnet.set(cellKey('ug1', 'p2', M2), 50)

    const { result } = renderHook(() => useLangfristigeInvestitionsauswertung('v1'))
    const model = result.current

    expect(model.tree).toHaveLength(1)
    const og = model.tree[0]
    expect(og.id).toBe('og1')
    expect(og.children?.map(c => c.id)).toEqual(['ug1', 'ug2'])

    const ug1 = og.children!.find(c => c.id === 'ug1')!
    // ug1: p1 (100,0) + p2 (50,50) = (150, 50)
    expect(ug1.values['2026-4']).toBe(150)
    expect(ug1.values['2026-5']).toBe(50)
    // Obergruppe = Summe der Untergruppen (ug2 trägt 0)
    expect(og.values['2026-4']).toBe(150)
    expect(og.values['2026-5']).toBe(50)
  })

  it('effektiver Soll: manueller Wert sticht berechneten Wert', () => {
    mockState.berechnet.set(cellKey('ug1', 'p1', M1), 999)
    mockState.manuell.set(cellKey('ug1', 'p1', M1), 100) // Override gewinnt

    const { result } = renderHook(() => useLangfristigeInvestitionsauswertung('v1'))
    const p1 = result.current.tree[0].children!.find(c => c.id === 'ug1')!.children!.find(c => c.id === 'ug1:p1')!
    expect(p1.values['2026-4']).toBe(100)
  })

  it('zeigt auf Produktebene NUR Produkte, für die Daten vorliegen', () => {
    // Nur p2 in ug1 hat Daten; p1 hat keine → p1 wird ausgeblendet.
    mockState.berechnet.set(cellKey('ug1', 'p2', M1), 70)

    const { result } = renderHook(() => useLangfristigeInvestitionsauswertung('v1'))
    const ug1 = result.current.tree[0].children!.find(c => c.id === 'ug1')!
    expect(ug1.children?.map(c => c.id)).toEqual(['ug1:p2'])

    // ug2 hat gar keine Daten → keine Produktzeilen
    const ug2 = result.current.tree[0].children!.find(c => c.id === 'ug2')!
    expect(ug2.children).toEqual([])
  })

  it('manuelle 0 zählt als vorliegende Daten (Produkt bleibt sichtbar)', () => {
    mockState.manuell.set(cellKey('ug1', 'p1', M1), 0)

    const { result } = renderHook(() => useLangfristigeInvestitionsauswertung('v1'))
    const ug1 = result.current.tree[0].children!.find(c => c.id === 'ug1')!
    expect(ug1.children?.map(c => c.id)).toEqual(['ug1:p1'])
    expect(ug1.children![0].values['2026-4']).toBe(0)
  })

  it('Gesamt-Zeile summiert alle Obergruppen je Spalte', () => {
    mockState.manuell.set(cellKey('ug1', 'p1', M1), 100)
    mockState.manuell.set(cellKey('ug2', 'p2', M2), 25)

    const { result } = renderHook(() => useLangfristigeInvestitionsauswertung('v1'))
    expect(result.current.gesamt.label).toBe('Investitionen (Gesamt)')
    expect(result.current.gesamt.values['2026-4']).toBe(100)
    expect(result.current.gesamt.values['2026-5']).toBe(25)
  })

  it('liefert je Obergruppe eine Diagramm-Serie', () => {
    mockState.manuell.set(cellKey('ug1', 'p1', M1), 100)
    const { result } = renderHook(() => useLangfristigeInvestitionsauswertung('v1'))
    expect(result.current.serien).toHaveLength(1)
    expect(result.current.serien[0]).toMatchObject({ id: 'og1', label: 'Produktinvestitionen Einkauf' })
    expect(result.current.serien[0].values['2026-4']).toBe(100)
  })
})

// ─── Hook: Leer-/Sonderzustände ───────────────────────────────────────────────

describe('useLangfristigeInvestitionsauswertung — Zustände', () => {
  it('isEmpty=true bei vollständiger Struktur aber ohne Werte', () => {
    const { result } = renderHook(() => useLangfristigeInvestitionsauswertung('v1'))
    expect(result.current.hasKategorien).toBe(true)
    expect(result.current.isEmpty).toBe(true)
    // ohne Daten: keine Produktzeilen unter den Untergruppen
    expect(result.current.tree[0].children!.every(ug => ug.children!.length === 0)).toBe(true)
  })

  it('hasKategorien=false wenn keine Investitions-Obergruppen existieren', () => {
    mockState.kategorien = []
    const { result } = renderHook(() => useLangfristigeInvestitionsauswertung('v1'))
    expect(result.current.hasKategorien).toBe(false)
    expect(result.current.tree).toEqual([])
    expect(result.current.isEmpty).toBe(false) // ohne Kategorien NICHT als "leer" markiert
  })

  it('hasProdukte=false wenn die Version keine Produkte hat', () => {
    mockState.produkte = []
    const { result } = renderHook(() => useLangfristigeInvestitionsauswertung('v1'))
    expect(result.current.hasProdukte).toBe(false)
  })
})

// ─── Pure: collectIaExpandableIds ─────────────────────────────────────────────

describe('collectIaExpandableIds', () => {
  it('liefert Obergruppen und Untergruppen MIT Kindern, ohne leere Untergruppen', () => {
    const tree: IaNode[] = [
      {
        id: 'og1', label: 'OG1', kind: 'obergruppe', values: {},
        children: [
          { id: 'ug1', label: 'UG1', kind: 'untergruppe', values: {}, children: [
            { id: 'ug1:p1', label: 'P1', kind: 'produkt', values: {} },
          ] },
          { id: 'ug2', label: 'UG2', kind: 'untergruppe', values: {}, children: [] }, // leer
        ],
      },
    ]
    expect(collectIaExpandableIds(tree)).toEqual(['og1', 'ug1'])
  })

  it('Obergruppe ohne Kinder ist nicht ausklappbar', () => {
    const tree: IaNode[] = [{ id: 'og1', label: 'OG1', kind: 'obergruppe', values: {}, children: [] }]
    expect(collectIaExpandableIds(tree)).toEqual([])
  })
})

// ─── Pure: applyIaZeitansicht (Monatlich ↔ Gesamt) ────────────────────────────

function buildModel(): IaModel {
  return {
    columns: [
      { key: '2026-4', label: 'Apr 2026' },
      { key: '2026-5', label: 'Mai 2026' },
    ],
    tree: [
      {
        id: 'og1', label: 'OG1', kind: 'obergruppe', values: { '2026-4': 150, '2026-5': 50 },
        children: [
          { id: 'ug1', label: 'UG1', kind: 'untergruppe', values: { '2026-4': 150, '2026-5': 50 },
            children: [
              { id: 'ug1:p1', label: 'P1', kind: 'produkt', values: { '2026-4': 100, '2026-5': 0 } },
              { id: 'ug1:p2', label: 'P2', kind: 'produkt', values: { '2026-4': 50, '2026-5': 50 } },
            ] },
        ],
      },
    ],
    gesamt: { id: '__gesamt__', label: 'Investitionen (Gesamt)', kind: 'gesamt', values: { '2026-4': 150, '2026-5': 50 } },
    serien: [{ id: 'og1', label: 'OG1', values: { '2026-4': 150, '2026-5': 50 } }],
    loading: false, error: null, hasKategorien: true, hasProdukte: true, isEmpty: false,
  }
}

describe('applyIaZeitansicht', () => {
  it('Monatlich: gibt das Modell unverändert zurück', () => {
    const m = buildModel()
    expect(applyIaZeitansicht(m, 'monatlich')).toBe(m)
  })

  it('Gesamt: EINE Spalte = Summe über alle Monate (Baum, Gesamt, Serien)', () => {
    const out = applyIaZeitansicht(buildModel(), 'gesamt')
    expect(out.columns).toEqual([{ key: 'gesamt', label: 'Gesamt' }])

    const og = out.tree[0]
    expect(og.values).toEqual({ gesamt: 200 }) // 150 + 50
    const ug1 = og.children![0]
    expect(ug1.values).toEqual({ gesamt: 200 })
    expect(ug1.children!.map(p => p.values)).toEqual([{ gesamt: 100 }, { gesamt: 100 }])

    expect(out.gesamt.values).toEqual({ gesamt: 200 })
    expect(out.serien[0].values).toEqual({ gesamt: 200 })
  })

  it('Gesamt bei leeren Spalten: unverändert (kein Absturz)', () => {
    const empty: IaModel = { ...buildModel(), columns: [] }
    expect(applyIaZeitansicht(empty, 'gesamt')).toBe(empty)
  })
})
