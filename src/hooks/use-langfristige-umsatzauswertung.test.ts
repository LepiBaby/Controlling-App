import { describe, it, expect } from 'vitest'
import {
  computeCascade,
  collectExpandableIds,
  bruttoByColumn,
  applyZeitbasis,
  UA_LINE_IDS,
  type UaColumn,
  type UaModel,
} from './use-langfristige-umsatzauswertung'
import type { RaLine } from '@/lib/langfristige-rentabilitaetsauswertung-shared'

// PROJ-96: Unit-Tests für die clientseitige Umsatz-Kaskaden- und Jahresbündelungs-Logik.

function lines(partial: Partial<Record<string, RaLine>>): Record<string, RaLine> {
  const base: Record<string, RaLine> = {}
  for (const id of UA_LINE_IDS) base[id] = { werte: {}, produkte: [] }
  return { ...base, ...partial }
}

const COL1: UaColumn[] = [{ key: '2026-1', label: 'Jan 2026' }]

describe('computeCascade', () => {
  it('signs brutto positive and the deductions negative', () => {
    const nodes = computeCascade(lines({
      brutto_umsatz: { werte: { '2026-1': 1000 }, produkte: [] },
      rabatte: { werte: { '2026-1': 100 }, produkte: [] },
      rueckerstattungen: { werte: { '2026-1': 50 }, produkte: [] },
      umsatzsteuer: { werte: { '2026-1': 150 }, produkte: [] },
    }) as never, COL1)

    const byId = Object.fromEntries(nodes.map(n => [n.id, n]))
    expect(byId.brutto_umsatz.values['2026-1']).toBe(1000)
    expect(byId.brutto_umsatz.isBrutto).toBe(true)
    expect(byId.rabatte.values['2026-1']).toBe(-100)
    expect(byId.rueckerstattungen.values['2026-1']).toBe(-50)
    expect(byId.umsatzsteuer.values['2026-1']).toBe(-150)
  })

  it('computes Netto-Umsatz as the running subtotal (brutto − rabatte − rueck − ust)', () => {
    const nodes = computeCascade(lines({
      brutto_umsatz: { werte: { '2026-1': 1000 }, produkte: [] },
      rabatte: { werte: { '2026-1': 100 }, produkte: [] },
      rueckerstattungen: { werte: { '2026-1': 50 }, produkte: [] },
      umsatzsteuer: { werte: { '2026-1': 150 }, produkte: [] },
    }) as never, COL1)
    const netto = nodes.find(n => n.id === 'netto_umsatz')!
    expect(netto.kind).toBe('subtotal')
    expect(netto.values['2026-1']).toBe(700)
  })

  it('produces exactly five rows in fixed order, Netto last', () => {
    const nodes = computeCascade(lines({}) as never, COL1)
    expect(nodes.map(n => n.id)).toEqual([
      'brutto_umsatz', 'rabatte', 'rueckerstattungen', 'umsatzsteuer', 'netto_umsatz',
    ])
  })

  it('builds drill-down children with the row sign applied', () => {
    const nodes = computeCascade(lines({
      brutto_umsatz: { werte: { '2026-1': 1000 }, produkte: [{ id: 'p1', label: 'P1', werte: { '2026-1': 1000 } }] },
      rabatte: { werte: { '2026-1': 100 }, produkte: [{ id: 'p1', label: 'P1', werte: { '2026-1': 100 } }] },
    }) as never, COL1)
    const brutto = nodes.find(n => n.id === 'brutto_umsatz')!
    expect(brutto.children?.[0]).toMatchObject({ label: 'P1', kind: 'produkt', values: { '2026-1': 1000 } })
    const rabatte = nodes.find(n => n.id === 'rabatte')!
    expect(rabatte.children?.[0].values['2026-1']).toBe(-100) // Abzugsposten → negativ
  })

  it('treats missing line values as 0', () => {
    const nodes = computeCascade(lines({}) as never, COL1)
    expect(nodes.find(n => n.id === 'brutto_umsatz')!.values['2026-1']).toBe(0)
    expect(nodes.find(n => n.id === 'netto_umsatz')!.values['2026-1']).toBe(0)
  })
})

describe('collectExpandableIds', () => {
  it('returns only rows that have a product breakdown', () => {
    const nodes = computeCascade(lines({
      brutto_umsatz: { werte: { '2026-1': 1000 }, produkte: [{ id: 'p1', label: 'P1', werte: { '2026-1': 1000 } }] },
      rabatte: { werte: { '2026-1': 100 }, produkte: [] }, // keine Aufschlüsselung
    }) as never, COL1)
    expect(collectExpandableIds(nodes)).toEqual(['brutto_umsatz'])
  })
})

describe('bruttoByColumn', () => {
  it('returns the brutto value per column (reference base for the percentage view)', () => {
    const cols: UaColumn[] = [{ key: '2026-1', label: 'Jan 2026' }, { key: '2026-2', label: 'Feb 2026' }]
    const nodes = computeCascade(lines({
      brutto_umsatz: { werte: { '2026-1': 1000, '2026-2': 0 }, produkte: [] },
    }) as never, cols)
    expect(bruttoByColumn(nodes, cols)).toEqual({ '2026-1': 1000, '2026-2': 0 })
  })
})

// ─── Jahresbündelung ────────────────────────────────────────────────────────────

function buildMonths(n: number): UaColumn[] {
  const labels = ['Jan', 'Feb', 'Mär', 'Apr', 'Mai', 'Jun', 'Jul', 'Aug', 'Sep', 'Okt', 'Nov', 'Dez']
  const out: UaColumn[] = []
  let y = 2026, m = 1
  for (let i = 0; i < n; i++) {
    out.push({ key: `${y}-${m}`, label: `${labels[m - 1]} ${y}` })
    m++; if (m > 12) { m = 1; y++ }
  }
  return out
}

function modelOf(columns: UaColumn[], bruttoPerMonth: number): UaModel {
  const werte: Record<string, number> = {}
  const absatz: Record<string, number> = {}
  for (const c of columns) { werte[c.key] = bruttoPerMonth; absatz[c.key] = 1 }
  return {
    columns,
    lines: {
      brutto_umsatz: { werte, produkte: [{ id: 'p1', label: 'P1', werte }] },
      rabatte: { werte: {}, produkte: [] },
      rueckerstattungen: { werte: {}, produkte: [] },
      umsatzsteuer: { werte: {}, produkte: [] },
    },
    absatz: { gesamt: absatz, produkte: [{ id: 'p1', label: 'P1', werte: absatz }] },
    loading: false, error: null, isEmpty: false,
  }
}

describe('applyZeitbasis', () => {
  it('returns the model unchanged for "monat"', () => {
    const model = modelOf(buildMonths(12), 100)
    expect(applyZeitbasis(model, 'monat')).toBe(model)
  })

  it('buckets 12 months into one year column for "jahr"', () => {
    const out = applyZeitbasis(modelOf(buildMonths(12), 100), 'jahr')
    expect(out.columns).toHaveLength(1)
    expect(out.columns[0]).toMatchObject({ key: 'J1', label: 'Jahr 1', sublabel: 'Jan 2026 – Dez 2026' })
    expect(out.lines.brutto_umsatz.werte.J1).toBe(1200) // 12 × 100
    expect(out.absatz.gesamt.J1).toBe(12)
  })

  it('keeps a trailing partial year as its own shorter block', () => {
    const out = applyZeitbasis(modelOf(buildMonths(14), 100), 'jahr')
    expect(out.columns.map(c => c.key)).toEqual(['J1', 'J2'])
    expect(out.columns[0].sublabel).toBe('Jan 2026 – Dez 2026')
    expect(out.columns[1]).toMatchObject({ label: 'Jahr 2', sublabel: 'Jan 2027 – Feb 2027' })
    expect(out.lines.brutto_umsatz.werte.J1).toBe(1200)
    expect(out.lines.brutto_umsatz.werte.J2).toBe(200) // nur 2 Monate
  })

  it('aggregates the product drill-down and absatz into year blocks too', () => {
    const out = applyZeitbasis(modelOf(buildMonths(14), 100), 'jahr')
    expect(out.lines.brutto_umsatz.produkte[0].werte).toEqual({ J1: 1200, J2: 200 })
    expect(out.absatz.produkte[0].werte).toEqual({ J1: 12, J2: 2 })
  })

  it('uses a single label (no range) for a one-month block', () => {
    const out = applyZeitbasis(modelOf(buildMonths(1), 100), 'jahr')
    expect(out.columns[0].sublabel).toBe('Jan 2026')
  })
})
