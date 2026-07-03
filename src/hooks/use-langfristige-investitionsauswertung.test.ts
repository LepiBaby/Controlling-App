import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook } from '@testing-library/react'
import {
  useLangfristigeInvestitionsauswertung,
  applyIaZeitansicht,
  collectIaExpandableIds,
  type IaModel,
  type IaNode,
} from './use-langfristige-investitionsauswertung'

// PROJ-99 (Redesign): Investitionsauswertung (read-only). Die Seite rechnet aus der
// bestehenden PROJ-92-Datenbeschaffung den effektiven Soll (manuell → berechnet → 0)
// und baut die Hierarchie PRODUKT → Obergruppe → Untergruppe (+ "Investitionen
// (Gesamt)"). OBERSTE Ebene = nur die als Investition markierten Produkte
// (ist_investition, PROJ-105); darunter je Produkt der VOLLSTÄNDIGE Kategoriebaum.
// Wir mocken die PROJ-92-Quelle und treiben den Hook über renderHook.

// ─── Mock der PROJ-92-Datenquelle ─────────────────────────────────────────────

interface Cell { jahr: number; monat: number }
const cellKey = (k: string, p: string, c: Cell) => `${k}:${p}:${c.jahr}-${c.monat}`

const mockState = vi.hoisted(() => ({
  monate: [] as { year: number; month: number; label: string }[],
  kategorien: [] as { id: string; name: string; parent_id: string | null; level: number; sort_order: number }[],
  produkte: [] as { id: string; name: string; sort_order: number; ist_investition: boolean }[],
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
  // p1 ist als Investition markiert (erscheint oben), p2 nicht.
  mockState.produkte = [
    { id: 'p1', name: 'Produkt A', sort_order: 0, ist_investition: true },
    { id: 'p2', name: 'Produkt B', sort_order: 1, ist_investition: false },
  ]
  mockState.loading = false
  mockState.error = null
  mockState.manuell = new Map()
  mockState.berechnet = new Map()
}

beforeEach(() => {
  setupBasisStruktur()
})

// ─── Hook: Baum, effektiver Soll, Produktebene oben ───────────────────────────

describe('useLangfristigeInvestitionsauswertung — Produkt → Obergruppe → Untergruppe', () => {
  it('oberste Ebene = nur als Investition markierte Produkte', () => {
    const { result } = renderHook(() => useLangfristigeInvestitionsauswertung('v1'))
    // p1 markiert → oben; p2 nicht markiert → nicht oben
    expect(result.current.tree.map(n => n.id)).toEqual(['p1'])
    expect(result.current.tree[0].kind).toBe('produkt')
    expect(result.current.tree[0].label).toBe('Produkt A')
  })

  it('unter jedem Produkt der VOLLE Kategoriebaum (Obergruppe → Untergruppe), auch ohne Werte', () => {
    const { result } = renderHook(() => useLangfristigeInvestitionsauswertung('v1'))
    const prod = result.current.tree[0]
    expect(prod.children?.map(c => c.id)).toEqual(['p1:og1'])
    const og = prod.children![0]
    expect(og.kind).toBe('obergruppe')
    // Beide Untergruppen erscheinen, auch wenn 0 (voller Baum)
    expect(og.children?.map(c => c.id)).toEqual(['p1:og1:ug1', 'p1:og1:ug2'])
    expect(og.children!.every(c => c.kind === 'untergruppe')).toBe(true)
  })

  it('Untergruppe-Leaf trägt den effektiven Soll des Produkts; Summe nach oben', () => {
    // p1 in ug1: manuell 100 (M1); berechnet 50 (M1 und M2)? → manuell sticht in M1.
    mockState.manuell.set(cellKey('ug1', 'p1', M1), 100)
    mockState.berechnet.set(cellKey('ug1', 'p1', M2), 40)

    const { result } = renderHook(() => useLangfristigeInvestitionsauswertung('v1'))
    const og = result.current.tree[0].children![0]
    const ug1 = og.children!.find(c => c.id === 'p1:og1:ug1')!
    expect(ug1.values['2026-4']).toBe(100)
    expect(ug1.values['2026-5']).toBe(40)
    // Obergruppe = Summe der Untergruppen (ug2 = 0)
    expect(og.values['2026-4']).toBe(100)
    expect(og.values['2026-5']).toBe(40)
    // Produkt = Summe der Obergruppen
    expect(result.current.tree[0].values['2026-4']).toBe(100)
    expect(result.current.tree[0].values['2026-5']).toBe(40)
  })

  it('effektiver Soll: manueller Wert sticht berechneten Wert', () => {
    mockState.berechnet.set(cellKey('ug1', 'p1', M1), 999)
    mockState.manuell.set(cellKey('ug1', 'p1', M1), 100) // Override gewinnt

    const { result } = renderHook(() => useLangfristigeInvestitionsauswertung('v1'))
    const ug1 = result.current.tree[0].children![0].children!.find(c => c.id === 'p1:og1:ug1')!
    expect(ug1.values['2026-4']).toBe(100)
  })

  it('Werte nicht markierter Produkte fließen NICHT in die Auswertung ein', () => {
    // p2 ist nicht markiert → erscheint weder oben noch in der Gesamtsumme.
    mockState.manuell.set(cellKey('ug1', 'p2', M1), 500)

    const { result } = renderHook(() => useLangfristigeInvestitionsauswertung('v1'))
    expect(result.current.tree.map(n => n.id)).toEqual(['p1'])
    expect(result.current.gesamt.values['2026-4']).toBe(0)
  })

  it('Gesamt-Zeile summiert alle (markierten) Produkte je Spalte', () => {
    mockState.produkte[1].ist_investition = true // p2 nun auch markiert
    mockState.manuell.set(cellKey('ug1', 'p1', M1), 100)
    mockState.manuell.set(cellKey('ug2', 'p2', M2), 25)

    const { result } = renderHook(() => useLangfristigeInvestitionsauswertung('v1'))
    expect(result.current.tree.map(n => n.id)).toEqual(['p1', 'p2'])
    expect(result.current.gesamt.label).toBe('Investitionen (Gesamt)')
    expect(result.current.gesamt.values['2026-4']).toBe(100)
    expect(result.current.gesamt.values['2026-5']).toBe(25)
  })

  it('liefert je markiertem Produkt eine Diagramm-Serie (Summe = Gesamt)', () => {
    mockState.manuell.set(cellKey('ug1', 'p1', M1), 100)
    const { result } = renderHook(() => useLangfristigeInvestitionsauswertung('v1'))
    expect(result.current.serien).toHaveLength(1)
    expect(result.current.serien[0]).toMatchObject({ id: 'p1', label: 'Produkt A' })
    expect(result.current.serien[0].values['2026-4']).toBe(100)
  })
})

// ─── Hook: Leer-/Sonderzustände ───────────────────────────────────────────────

describe('useLangfristigeInvestitionsauswertung — Zustände', () => {
  it('isEmpty=true bei markiertem Produkt + Kategorien aber ohne Werte', () => {
    const { result } = renderHook(() => useLangfristigeInvestitionsauswertung('v1'))
    expect(result.current.hasKategorien).toBe(true)
    expect(result.current.hasProdukte).toBe(true)
    expect(result.current.isEmpty).toBe(true)
    // voller Baum trotzdem vorhanden
    expect(result.current.tree[0].children![0].children!.map(c => c.id)).toEqual(['p1:og1:ug1', 'p1:og1:ug2'])
  })

  it('hasKategorien=false wenn keine Investitions-Obergruppen existieren', () => {
    mockState.kategorien = []
    const { result } = renderHook(() => useLangfristigeInvestitionsauswertung('v1'))
    expect(result.current.hasKategorien).toBe(false)
    // p1 markiert, aber ohne Kategorien keine Kinder
    expect(result.current.tree[0].children).toEqual([])
    expect(result.current.isEmpty).toBe(false) // ohne Kategorien NICHT als "leer" markiert
  })

  it('hasProdukte=false wenn kein Produkt als Investition markiert ist', () => {
    mockState.produkte = [
      { id: 'p1', name: 'Produkt A', sort_order: 0, ist_investition: false },
      { id: 'p2', name: 'Produkt B', sort_order: 1, ist_investition: false },
    ]
    const { result } = renderHook(() => useLangfristigeInvestitionsauswertung('v1'))
    expect(result.current.hasProdukte).toBe(false)
    expect(result.current.tree).toEqual([])
    expect(result.current.isEmpty).toBe(false)
  })
})

// ─── Pure: collectIaExpandableIds ─────────────────────────────────────────────

describe('collectIaExpandableIds', () => {
  it('liefert alle Knoten mit Kindern (Produkt + Obergruppe), Leafs nicht', () => {
    const tree: IaNode[] = [
      {
        id: 'p1', label: 'P1', kind: 'produkt', values: {},
        children: [
          { id: 'p1:og1', label: 'OG1', kind: 'obergruppe', values: {}, children: [
            { id: 'p1:og1:ug1', label: 'UG1', kind: 'untergruppe', values: {} },
          ] },
          { id: 'p1:og2', label: 'OG2', kind: 'obergruppe', values: {}, children: [] }, // leer
        ],
      },
    ]
    expect(collectIaExpandableIds(tree)).toEqual(['p1', 'p1:og1'])
  })

  it('Produkt ohne Kinder ist nicht ausklappbar', () => {
    const tree: IaNode[] = [{ id: 'p1', label: 'P1', kind: 'produkt', values: {}, children: [] }]
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
        id: 'p1', label: 'Produkt A', kind: 'produkt', values: { '2026-4': 150, '2026-5': 50 },
        children: [
          { id: 'p1:og1', label: 'OG1', kind: 'obergruppe', values: { '2026-4': 150, '2026-5': 50 },
            children: [
              { id: 'p1:og1:ug1', label: 'UG1', kind: 'untergruppe', values: { '2026-4': 100, '2026-5': 0 } },
              { id: 'p1:og1:ug2', label: 'UG2', kind: 'untergruppe', values: { '2026-4': 50, '2026-5': 50 } },
            ] },
        ],
      },
    ],
    gesamt: { id: '__gesamt__', label: 'Investitionen (Gesamt)', kind: 'gesamt', values: { '2026-4': 150, '2026-5': 50 } },
    serien: [{ id: 'p1', label: 'Produkt A', values: { '2026-4': 150, '2026-5': 50 } }],
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

    const prod = out.tree[0]
    expect(prod.values).toEqual({ gesamt: 200 }) // 150 + 50
    const og = prod.children![0]
    expect(og.values).toEqual({ gesamt: 200 })
    expect(og.children!.map(u => u.values)).toEqual([{ gesamt: 100 }, { gesamt: 100 }])

    expect(out.gesamt.values).toEqual({ gesamt: 200 })
    expect(out.serien[0].values).toEqual({ gesamt: 200 })
  })

  it('Gesamt bei leeren Spalten: unverändert (kein Absturz)', () => {
    const empty: IaModel = { ...buildModel(), columns: [] }
    expect(applyIaZeitansicht(empty, 'gesamt')).toBe(empty)
  })
})
