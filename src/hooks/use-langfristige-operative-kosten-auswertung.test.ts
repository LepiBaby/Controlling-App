import { describe, it, expect } from 'vitest'
import {
  computeCascade,
  collectExpandableIds,
  gruppenNodes,
  bruttoByColumn,
  applyZeitbasis,
  type OkColumn,
  type OkModel,
} from './use-langfristige-operative-kosten-auswertung'
import type { RaLine } from '@/lib/langfristige-rentabilitaetsauswertung-shared'

// PROJ-98: Unit-Tests für die clientseitige Operativ-Kaskaden- und Jahresbündelungs-Logik.
// Kostenwerte werden negativ signiert (rot, konsistent mit PROJ-95).

const COL1: OkColumn[] = [{ key: '2026-1', label: 'Jan 2026' }]

// Eine Operativ-Zeile mit zwei Gruppen, eine davon mit Untergruppen.
function operativLine(): RaLine {
  return {
    werte: { '2026-1': 800 },
    produkte: [
      {
        id: 'g1', label: 'Personal', werte: { '2026-1': 500 },
        children: [
          { id: 'g1u1', label: 'Gehälter', werte: { '2026-1': 300 } },
          { id: 'g1u2', label: 'Sozialabgaben', werte: { '2026-1': 200 } },
        ],
      },
      { id: 'g2', label: 'Miete', werte: { '2026-1': 300 } },
    ],
  }
}

describe('computeCascade', () => {
  it('signs every operative cost negative (group, subgroup and total)', () => {
    const nodes = computeCascade(operativLine(), COL1)
    const byId = Object.fromEntries(nodes.map(n => [n.id, n]))
    expect(byId.g1.values['2026-1']).toBe(-500)
    expect(byId.g1.children?.[0].values['2026-1']).toBe(-300)
    expect(byId.g1.children?.[1].values['2026-1']).toBe(-200)
    expect(byId.g2.values['2026-1']).toBe(-300)
  })

  it('appends a "Operative Kosten (Gesamt)" subtotal row last (= signed line total)', () => {
    const nodes = computeCascade(operativLine(), COL1)
    const last = nodes[nodes.length - 1]
    expect(last.id).toBe('operative_kosten_gesamt')
    expect(last.kind).toBe('subtotal')
    expect(last.label).toBe('Operative Kosten (Gesamt)')
    expect(last.values['2026-1']).toBe(-800)
  })

  it('orders rows as groups first, total last', () => {
    const nodes = computeCascade(operativLine(), COL1)
    expect(nodes.map(n => n.id)).toEqual(['g1', 'g2', 'operative_kosten_gesamt'])
    expect(nodes.map(n => n.kind)).toEqual(['gruppe', 'gruppe', 'subtotal'])
  })

  it('marks a group with subgroups as having children, a leaf group as having none', () => {
    const nodes = computeCascade(operativLine(), COL1)
    const byId = Object.fromEntries(nodes.map(n => [n.id, n]))
    expect(byId.g1.children).toHaveLength(2)
    expect(byId.g2.children).toBeUndefined()
  })

  it('treats an empty operativ line as a single zero total row', () => {
    const nodes = computeCascade({ werte: {}, produkte: [] }, COL1)
    expect(nodes).toHaveLength(1)
    expect(nodes[0].id).toBe('operative_kosten_gesamt')
    expect(nodes[0].values['2026-1']).toBe(-0) // 0 (or -0) — falsy zero
    expect(Math.abs(nodes[0].values['2026-1'])).toBe(0)
  })
})

describe('collectExpandableIds', () => {
  it('returns only groups that have subgroups (not leaf groups, not the total)', () => {
    const nodes = computeCascade(operativLine(), COL1)
    expect(collectExpandableIds(nodes)).toEqual(['g1'])
  })
})

describe('gruppenNodes', () => {
  it('returns only the L1 group rows (for the stacked chart), excluding the total', () => {
    const nodes = computeCascade(operativLine(), COL1)
    expect(gruppenNodes(nodes).map(n => n.id)).toEqual(['g1', 'g2'])
  })
})

describe('bruttoByColumn', () => {
  it('returns the brutto value per column (reference base for the percentage view)', () => {
    const cols: OkColumn[] = [{ key: '2026-1', label: 'Jan 2026' }, { key: '2026-2', label: 'Feb 2026' }]
    expect(bruttoByColumn({ '2026-1': 1000, '2026-2': 0 }, cols)).toEqual({ '2026-1': 1000, '2026-2': 0 })
  })
  it('defaults missing columns to 0', () => {
    const cols: OkColumn[] = [{ key: '2026-1', label: 'Jan 2026' }, { key: '2026-2', label: 'Feb 2026' }]
    expect(bruttoByColumn({ '2026-1': 500 }, cols)).toEqual({ '2026-1': 500, '2026-2': 0 })
  })
})

// ─── Jahresbündelung ────────────────────────────────────────────────────────────

function buildMonths(n: number): OkColumn[] {
  const labels = ['Jan', 'Feb', 'Mär', 'Apr', 'Mai', 'Jun', 'Jul', 'Aug', 'Sep', 'Okt', 'Nov', 'Dez']
  const out: OkColumn[] = []
  let y = 2026, m = 1
  for (let i = 0; i < n; i++) {
    out.push({ key: `${y}-${m}`, label: `${labels[m - 1]} ${y}` })
    m++; if (m > 12) { m = 1; y++ }
  }
  return out
}

function modelOf(columns: OkColumn[], perMonth: number): OkModel {
  const werte: Record<string, number> = {}
  const brutto: Record<string, number> = {}
  for (const c of columns) { werte[c.key] = perMonth; brutto[c.key] = perMonth * 5 }
  return {
    columns,
    operativ: { werte, produkte: [{ id: 'g1', label: 'Personal', werte, children: [{ id: 'g1u1', label: 'Gehälter', werte }] }] },
    brutto,
    loading: false, error: null, isEmpty: false,
  }
}

describe('applyZeitbasis', () => {
  it('returns the model unchanged for "monat"', () => {
    const model = modelOf(buildMonths(12), 100)
    expect(applyZeitbasis(model, 'monat')).toBe(model)
  })

  it('buckets 12 months into one year column (sum) for "jahr"', () => {
    const out = applyZeitbasis(modelOf(buildMonths(12), 100), 'jahr')
    expect(out.columns).toHaveLength(1)
    expect(out.columns[0]).toMatchObject({ key: 'J1', label: 'Jahr 1', sublabel: 'Jan 2026 – Dez 2026' })
    expect(out.operativ.werte.J1).toBe(1200) // 12 × 100
    expect(out.brutto.J1).toBe(6000)         // 12 × 500
  })

  it('keeps a trailing partial year as its own shorter block', () => {
    const out = applyZeitbasis(modelOf(buildMonths(14), 100), 'jahr')
    expect(out.columns.map(c => c.key)).toEqual(['J1', 'J2'])
    expect(out.columns[1]).toMatchObject({ label: 'Jahr 2', sublabel: 'Jan 2027 – Feb 2027' })
    expect(out.operativ.werte.J1).toBe(1200)
    expect(out.operativ.werte.J2).toBe(200) // nur 2 Monate
    expect(out.brutto.J2).toBe(1000)
  })

  it('aggregates the group/subgroup drill-down into year blocks too', () => {
    const out = applyZeitbasis(modelOf(buildMonths(14), 100), 'jahr')
    expect(out.operativ.produkte[0].werte).toEqual({ J1: 1200, J2: 200 })
    expect(out.operativ.produkte[0].children?.[0].werte).toEqual({ J1: 1200, J2: 200 })
  })

  it('uses a single label (no range) for a one-month block', () => {
    const out = applyZeitbasis(modelOf(buildMonths(1), 100), 'jahr')
    expect(out.columns[0].sublabel).toBe('Jan 2026')
  })

  it('signed cascade over a year block keeps groups summing to the total', () => {
    const out = applyZeitbasis(modelOf(buildMonths(12), 100), 'jahr')
    const nodes = computeCascade(out.operativ, out.columns)
    const groups = gruppenNodes(nodes)
    const total = nodes[nodes.length - 1]
    const groupSum = groups.reduce((a, g) => a + (g.values.J1 ?? 0), 0)
    expect(groupSum).toBe(total.values.J1)
    expect(total.values.J1).toBe(-1200)
  })
})
