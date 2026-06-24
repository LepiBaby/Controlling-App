import { describe, it, expect } from 'vitest'
import {
  computeCascade,
  collectExpandableIds,
  gruppenNodes,
  bruttoByColumn,
  applyZeitbasis,
  buildColumns,
  buildFinanzierungLine,
  type FaColumn,
  type FaModel,
} from './use-langfristige-finanzierungsausgaben-auswertung'
import type { RaLine } from '@/lib/langfristige-rentabilitaetsauswertung-shared'
import type { KpiCategory } from '@/hooks/use-kpi-categories'

// PROJ-100: Unit-Tests für die clientseitige Finanzierungs-Kaskaden-, Jahresbündelungs- und
// Roh-Werte-Aufbau-Logik. Kostenwerte werden negativ signiert (rot, konsistent mit PROJ-98).

const COL1: FaColumn[] = [{ key: '2026-1', label: 'Jan 2026' }]

// Eine Finanzierungs-Zeile mit zwei Gruppen, eine davon mit Untergruppen.
function finanzierungLine(): RaLine {
  return {
    werte: { '2026-1': 800 },
    produkte: [
      {
        id: 'g1', label: 'Darlehen', werte: { '2026-1': 500 },
        children: [
          { id: 'g1u1', label: 'Zinsen', werte: { '2026-1': 300 } },
          { id: 'g1u2', label: 'Tilgung', werte: { '2026-1': 200 } },
        ],
      },
      { id: 'g2', label: 'Leasing', werte: { '2026-1': 300 } },
    ],
  }
}

describe('computeCascade', () => {
  it('signs every financing cost negative (group, subgroup and total)', () => {
    const nodes = computeCascade(finanzierungLine(), COL1)
    const byId = Object.fromEntries(nodes.map(n => [n.id, n]))
    expect(byId.g1.values['2026-1']).toBe(-500)
    expect(byId.g1.children?.[0].values['2026-1']).toBe(-300)
    expect(byId.g1.children?.[1].values['2026-1']).toBe(-200)
    expect(byId.g2.values['2026-1']).toBe(-300)
  })

  it('appends a "Finanzierungsausgaben (Gesamt)" subtotal row last (= signed line total)', () => {
    const nodes = computeCascade(finanzierungLine(), COL1)
    const last = nodes[nodes.length - 1]
    expect(last.id).toBe('finanzierungsausgaben_gesamt')
    expect(last.kind).toBe('subtotal')
    expect(last.label).toBe('Finanzierungsausgaben (Gesamt)')
    expect(last.values['2026-1']).toBe(-800)
  })

  it('orders rows as groups first, total last', () => {
    const nodes = computeCascade(finanzierungLine(), COL1)
    expect(nodes.map(n => n.id)).toEqual(['g1', 'g2', 'finanzierungsausgaben_gesamt'])
    expect(nodes.map(n => n.kind)).toEqual(['gruppe', 'gruppe', 'subtotal'])
  })

  it('marks a group with subgroups as having children, a leaf group as having none', () => {
    const nodes = computeCascade(finanzierungLine(), COL1)
    const byId = Object.fromEntries(nodes.map(n => [n.id, n]))
    expect(byId.g1.children).toHaveLength(2)
    expect(byId.g2.children).toBeUndefined()
  })

  it('treats an empty finanzierung line as a single zero total row', () => {
    const nodes = computeCascade({ werte: {}, produkte: [] }, COL1)
    expect(nodes).toHaveLength(1)
    expect(nodes[0].id).toBe('finanzierungsausgaben_gesamt')
    expect(Math.abs(nodes[0].values['2026-1'])).toBe(0)
  })
})

describe('collectExpandableIds', () => {
  it('returns only groups that have subgroups (not leaf groups, not the total)', () => {
    const nodes = computeCascade(finanzierungLine(), COL1)
    expect(collectExpandableIds(nodes)).toEqual(['g1'])
  })
})

describe('gruppenNodes', () => {
  it('returns only the L1 group rows (for the stacked chart), excluding the total', () => {
    const nodes = computeCascade(finanzierungLine(), COL1)
    expect(gruppenNodes(nodes).map(n => n.id)).toEqual(['g1', 'g2'])
  })
})

describe('bruttoByColumn', () => {
  it('returns the brutto value per column (reference base for the percentage view)', () => {
    const cols: FaColumn[] = [{ key: '2026-1', label: 'Jan 2026' }, { key: '2026-2', label: 'Feb 2026' }]
    expect(bruttoByColumn({ '2026-1': 1000, '2026-2': 0 }, cols)).toEqual({ '2026-1': 1000, '2026-2': 0 })
  })
  it('defaults missing columns to 0', () => {
    const cols: FaColumn[] = [{ key: '2026-1', label: 'Jan 2026' }, { key: '2026-2', label: 'Feb 2026' }]
    expect(bruttoByColumn({ '2026-1': 500 }, cols)).toEqual({ '2026-1': 500, '2026-2': 0 })
  })
})

// ─── Monatsspalten ──────────────────────────────────────────────────────────────

describe('buildColumns', () => {
  it('starts exactly at the start month with no lead-in and produces `horizont` columns', () => {
    const cols = buildColumns(4, 2026, 3)
    expect(cols).toEqual([
      { key: '2026-4', label: 'Apr 2026' },
      { key: '2026-5', label: 'Mai 2026' },
      { key: '2026-6', label: 'Jun 2026' },
    ])
  })

  it('rolls over the year boundary correctly', () => {
    const cols = buildColumns(11, 2026, 4)
    expect(cols.map(c => c.key)).toEqual(['2026-11', '2026-12', '2027-1', '2027-2'])
    expect(cols.map(c => c.label)).toEqual(['Nov 2026', 'Dez 2026', 'Jan 2027', 'Feb 2027'])
  })

  it('produces a key format matching the rentabilitaetsauswertung route ("JAHR-MONAT", not zero-padded)', () => {
    expect(buildColumns(1, 2026, 1)[0].key).toBe('2026-1')
  })

  it('guards against a non-positive horizon (at least one column)', () => {
    expect(buildColumns(1, 2026, 0)).toHaveLength(1)
  })
})

// ─── Aufbau der Finanzierungs-Zeile aus PROJ-90-Rohdaten ─────────────────────────

function kat(partial: Partial<KpiCategory> & { id: string; name: string }): KpiCategory {
  return {
    type: 'ausgaben_kosten',
    parent_id: null,
    sku_code: null,
    level: 1,
    sort_order: 0,
    sales_plattform_enabled: false,
    produkt_enabled: false,
    kosten_label: null,
    ausgaben_label: null,
    ist_abzugsposten: false,
    ust_satz: null,
    exclude_from_rentabilitaet: false,
    ...partial,
  }
}

// Globaler KPI-Baum: Root "Finanzierung" → Gruppe "Darlehen" (mit Untergruppen Zinsen/Tilgung)
//                                        → Gruppe "Leasing" (Leaf, keine Untergruppen)
function finanzierungKategorien(): KpiCategory[] {
  return [
    kat({ id: 'root', name: 'Finanzierung', parent_id: null, sort_order: 0 }),
    kat({ id: 'andere', name: 'Operativ', parent_id: null, sort_order: 1 }),
    kat({ id: 'g_darlehen', name: 'Darlehen', parent_id: 'root', sort_order: 0 }),
    kat({ id: 'g_leasing', name: 'Leasing', parent_id: 'root', sort_order: 1 }),
    kat({ id: 'u_zinsen', name: 'Zinsen', parent_id: 'g_darlehen', level: 2, sort_order: 0 }),
    kat({ id: 'u_tilgung', name: 'Tilgung', parent_id: 'g_darlehen', level: 2, sort_order: 1 }),
  ]
}

describe('buildFinanzierungLine', () => {
  const cols: FaColumn[] = [{ key: '2026-1', label: 'Jan 2026' }, { key: '2026-2', label: 'Feb 2026' }]

  function values(): Map<string, number> {
    // betragCellKey = `${kategorieId}:${jahr}:${monat}`
    return new Map<string, number>([
      ['u_zinsen:2026:1', 300],
      ['u_tilgung:2026:1', 200],
      ['g_leasing:2026:1', 150],
      ['u_zinsen:2026:2', 100],
      // Feb: Tilgung + Leasing leer → 0
    ])
  }

  it('picks only the "Finanzierung" subtree (ignores other roots like Operativ)', () => {
    const line = buildFinanzierungLine(finanzierungKategorien(), values(), cols)
    expect(line.produkte.map(p => p.id)).toEqual(['g_darlehen', 'g_leasing'])
  })

  it('builds groups with subgroups as positive magnitudes and sums subgroups into the group', () => {
    const line = buildFinanzierungLine(finanzierungKategorien(), values(), cols)
    const darlehen = line.produkte.find(p => p.id === 'g_darlehen')!
    expect(darlehen.children?.map(c => c.id)).toEqual(['u_zinsen', 'u_tilgung'])
    expect(darlehen.children?.[0].werte).toEqual({ '2026-1': 300, '2026-2': 100 })
    expect(darlehen.children?.[1].werte).toEqual({ '2026-1': 200, '2026-2': 0 })
    expect(darlehen.werte).toEqual({ '2026-1': 500, '2026-2': 100 }) // 300+200 / 100+0
  })

  it('treats a leaf group (no subgroups) as its own data row, no children', () => {
    const line = buildFinanzierungLine(finanzierungKategorien(), values(), cols)
    const leasing = line.produkte.find(p => p.id === 'g_leasing')!
    expect(leasing.children).toBeUndefined()
    expect(leasing.werte).toEqual({ '2026-1': 150, '2026-2': 0 })
  })

  it('total line equals the sum of all groups per month (= PROJ-90 Gesamtzeile)', () => {
    const line = buildFinanzierungLine(finanzierungKategorien(), values(), cols)
    expect(line.werte).toEqual({ '2026-1': 650, '2026-2': 100 }) // 500+150 / 100+0
  })

  it('returns no groups when there is no "Finanzierung" root (→ empty-state in the matrix)', () => {
    const line = buildFinanzierungLine([kat({ id: 'x', name: 'Operativ' })], new Map(), cols)
    expect(line.produkte).toHaveLength(0)
    expect(line.werte).toEqual({ '2026-1': 0, '2026-2': 0 })
  })

  it('matches the case-insensitive root name ("FINANZIERUNG" / whitespace)', () => {
    const kats = [
      kat({ id: 'root', name: '  Finanzierung  ', parent_id: null }),
      kat({ id: 'g1', name: 'Darlehen', parent_id: 'root' }),
    ]
    const line = buildFinanzierungLine(kats, new Map([['g1:2026:1', 42]]), cols)
    expect(line.produkte.map(p => p.id)).toEqual(['g1'])
    expect(line.werte['2026-1']).toBe(42)
  })
})

// ─── Jahresbündelung ────────────────────────────────────────────────────────────

function buildMonths(n: number): FaColumn[] {
  const labels = ['Jan', 'Feb', 'Mär', 'Apr', 'Mai', 'Jun', 'Jul', 'Aug', 'Sep', 'Okt', 'Nov', 'Dez']
  const out: FaColumn[] = []
  let y = 2026, m = 1
  for (let i = 0; i < n; i++) {
    out.push({ key: `${y}-${m}`, label: `${labels[m - 1]} ${y}` })
    m++; if (m > 12) { m = 1; y++ }
  }
  return out
}

function modelOf(columns: FaColumn[], perMonth: number): FaModel {
  const werte: Record<string, number> = {}
  const brutto: Record<string, number> = {}
  for (const c of columns) { werte[c.key] = perMonth; brutto[c.key] = perMonth * 5 }
  return {
    columns,
    finanzierung: { werte, produkte: [{ id: 'g1', label: 'Darlehen', werte, children: [{ id: 'g1u1', label: 'Zinsen', werte }] }] },
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
    expect(out.finanzierung.werte.J1).toBe(1200) // 12 × 100
    expect(out.brutto.J1).toBe(6000)             // 12 × 500
  })

  it('keeps a trailing partial year as its own shorter block', () => {
    const out = applyZeitbasis(modelOf(buildMonths(14), 100), 'jahr')
    expect(out.columns.map(c => c.key)).toEqual(['J1', 'J2'])
    expect(out.columns[1]).toMatchObject({ label: 'Jahr 2', sublabel: 'Jan 2027 – Feb 2027' })
    expect(out.finanzierung.werte.J1).toBe(1200)
    expect(out.finanzierung.werte.J2).toBe(200) // nur 2 Monate
    expect(out.brutto.J2).toBe(1000)
  })

  it('aggregates the group/subgroup drill-down into year blocks too', () => {
    const out = applyZeitbasis(modelOf(buildMonths(14), 100), 'jahr')
    expect(out.finanzierung.produkte[0].werte).toEqual({ J1: 1200, J2: 200 })
    expect(out.finanzierung.produkte[0].children?.[0].werte).toEqual({ J1: 1200, J2: 200 })
  })

  it('uses a single label (no range) for a one-month block', () => {
    const out = applyZeitbasis(modelOf(buildMonths(1), 100), 'jahr')
    expect(out.columns[0].sublabel).toBe('Jan 2026')
  })

  it('signed cascade over a year block keeps groups summing to the total', () => {
    const out = applyZeitbasis(modelOf(buildMonths(12), 100), 'jahr')
    const nodes = computeCascade(out.finanzierung, out.columns)
    const groups = gruppenNodes(nodes)
    const total = nodes[nodes.length - 1]
    const groupSum = groups.reduce((a, g) => a + (g.values.J1 ?? 0), 0)
    expect(groupSum).toBe(total.values.J1)
    expect(total.values.J1).toBe(-1200)
  })
})
