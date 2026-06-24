import { describe, it, expect } from 'vitest'
import {
  computeCascade,
  collectExpandableIds,
  bruttoByColumn,
  applyZeitbasis,
  UK_LINE_IDS,
  type UkModel,
  type UkColumn,
  type UkLineId,
  type UkNode,
} from './use-langfristige-umsatzkosten-auswertung'
import { type RaLine } from '@/lib/langfristige-rentabilitaetsauswertung-shared'

// Hilfen ─────────────────────────────────────────────────────────────────────
function mkLines(partial: Partial<Record<UkLineId, RaLine>>): Record<UkLineId, RaLine> {
  const lines = {} as Record<UkLineId, RaLine>
  for (const id of UK_LINE_IDS) lines[id] = { werte: {}, produkte: [] }
  for (const [id, l] of Object.entries(partial)) lines[id as UkLineId] = l!
  return lines
}
function line(werte: Record<string, number>, produkte: RaLine['produkte'] = []): RaLine {
  return { werte, produkte }
}
function nodeById(nodes: UkNode[], id: string): UkNode | undefined {
  return nodes.find(n => n.id === id)
}
function mkModel(lines: Record<UkLineId, RaLine>, columns: UkColumn[], brutto: RaLine = { werte: {}, produkte: [] }): UkModel {
  return { columns, lines, brutto, loading: false, error: null, isEmpty: false }
}

const COLS: UkColumn[] = [{ key: '2026-1', label: 'Jan 2026' }, { key: '2026-2', label: 'Feb 2026' }]

describe('computeCascade — Kostengruppen & Summe', () => {
  it('bündelt Produktkosten/Vertriebskosten als negative Gruppensummen und bildet die Gesamtsumme', () => {
    const lines = mkLines({
      ware: line({ '2026-1': 200 }),
      inspektion: line({ '2026-1': 10 }),
      shipping: line({ '2026-1': 20 }),
      zoll: line({ '2026-1': 5 }),
      einlagerung: line({ '2026-1': 15 }),
      versand: line({ '2026-1': 50 }),
      lagerung: line({ '2026-1': 30 }),
      retouren: line({ '2026-1': 12 }),
      kulanz: line({ '2026-1': 8 }),
      verkaufsgebuehren: line({ '2026-1': 100 }),
      marketing: line({ '2026-1': 70 }),
    })
    const nodes = computeCascade(lines, COLS)
    // Produktkosten = −(200+10+20+5+15) = −250
    expect(nodeById(nodes, 'produktkosten')!.values['2026-1']).toBe(-250)
    // Vertriebskosten = −(50+30+12+8+100) = −200
    expect(nodeById(nodes, 'vertriebskosten')!.values['2026-1']).toBe(-200)
    // Marketingkosten = −70
    expect(nodeById(nodes, 'marketing')!.values['2026-1']).toBe(-70)
    // Umsatzkosten (Gesamt) = −(250+200+70) = −520
    expect(nodeById(nodes, 'umsatzkosten_gesamt')!.values['2026-1']).toBe(-520)
  })

  it('liefert genau drei Hauptzeilen + Summenzeile, keine Umsatz-/DB-Zeilen', () => {
    const nodes = computeCascade(mkLines({}), COLS)
    expect(nodes.map(n => n.id)).toEqual(['produktkosten', 'vertriebskosten', 'marketing', 'umsatzkosten_gesamt'])
    expect(nodeById(nodes, 'brutto_umsatz')).toBeUndefined()
    expect(nodeById(nodes, 'netto_umsatz')).toBeUndefined()
    expect(nodeById(nodes, 'db1')).toBeUndefined()
  })

  it('erzeugt Gruppen-Unterzeilen (Ware/Inspektion/…) mit korrektem Vorzeichen', () => {
    const lines = mkLines({ ware: line({ '2026-1': 200 }, [{ id: 'p1', label: 'Produkt 1', werte: { '2026-1': 200 } }]) })
    const nodes = computeCascade(lines, COLS)
    const produkt = nodeById(nodes, 'produktkosten')!
    expect(produkt.children!.map(c => c.id)).toEqual(['ware', 'inspektion', 'shipping', 'zoll', 'einlagerung'])
    const ware = produkt.children!.find(c => c.id === 'ware')!
    expect(ware.values['2026-1']).toBe(-200)
    // Produkt-Drill-Down erbt das Vorzeichen
    expect(ware.children![0].label).toBe('Produkt 1')
    expect(ware.children![0].values['2026-1']).toBe(-200)
  })
})

describe('collectExpandableIds', () => {
  it('macht die drei Kostenarten ausklappbar, aber NICHT die Summenzeile', () => {
    const lines = mkLines({
      ware: line({ '2026-1': 10 }),
      versand: line({ '2026-1': 10 }),
      marketing: line({ '2026-1': 10 }, [{ id: 'k1', label: 'Kanal', werte: { '2026-1': 10 } }]),
    })
    const nodes = computeCascade(lines, COLS)
    const ids = collectExpandableIds(nodes)
    expect(ids).toContain('produktkosten')
    expect(ids).toContain('vertriebskosten')
    expect(ids).toContain('marketing')
    expect(ids).not.toContain('umsatzkosten_gesamt')
  })
})

describe('bruttoByColumn', () => {
  it('liefert den (unsichtbaren) Brutto-Umsatz je Spalte als Prozent-Bezug', () => {
    const model = mkModel(mkLines({}), COLS, line({ '2026-1': 1000, '2026-2': 0 }))
    expect(bruttoByColumn(model, COLS)).toEqual({ '2026-1': 1000, '2026-2': 0 })
  })
})

describe('applyZeitbasis — rollierende 12-Monats-Jahre', () => {
  function buildMonate(n: number): UkColumn[] {
    const labels = ['Jan', 'Feb', 'Mär', 'Apr', 'Mai', 'Jun', 'Jul', 'Aug', 'Sep', 'Okt', 'Nov', 'Dez']
    const cols: UkColumn[] = []
    let y = 2026, m = 6 // Start Juni 2026
    for (let i = 0; i < n; i++) {
      cols.push({ key: `${y}-${m}`, label: `${labels[m - 1]} ${y}` })
      m++; if (m > 12) { m = 1; y++ }
    }
    return cols
  }

  it('lässt die Monatsansicht unverändert', () => {
    const model = mkModel(mkLines({}), buildMonate(3))
    expect(applyZeitbasis(model, 'monat')).toBe(model)
  })

  it('aggregiert 24 Monate zu 2 Jahresblöcken inkl. Brutto-Bezug', () => {
    const cols = buildMonate(24)
    const werte = Object.fromEntries(cols.map(c => [c.key, 10]))
    const brutto = Object.fromEntries(cols.map(c => [c.key, 100]))
    const model = mkModel(mkLines({ versand: line(werte) }), cols, line(brutto))
    const jahr = applyZeitbasis(model, 'jahr')
    expect(jahr.columns).toHaveLength(2)
    expect(jahr.columns[0].label).toBe('Jahr 1')
    expect(jahr.columns[0].sublabel).toBe('Jun 2026 – Mai 2027')
    expect(jahr.lines.versand.werte['J1']).toBe(120)  // 12 × 10
    expect(jahr.brutto.werte['J1']).toBe(1200)        // 12 × 100
  })

  it('bildet bei nicht durch 12 teilbarem Horizont einen kürzeren letzten Block', () => {
    const cols = buildMonate(18) // 12 + 6
    const werte = Object.fromEntries(cols.map(c => [c.key, 10]))
    const model = mkModel(mkLines({ versand: line(werte) }), cols, { werte: {}, produkte: [] })
    const jahr = applyZeitbasis(model, 'jahr')
    expect(jahr.columns).toHaveLength(2)
    expect(jahr.lines.versand.werte['J1']).toBe(120) // volle 12 Monate
    expect(jahr.lines.versand.werte['J2']).toBe(60)  // nur 6 Monate
  })

  it('aggregiert verschachtelte Drill-Downs rekursiv', () => {
    const cols = buildMonate(12)
    const werte = Object.fromEntries(cols.map(c => [c.key, 10]))
    const model = mkModel(
      mkLines({ marketing: line(werte, [{ id: 'k1', label: 'Kanal', werte, children: [{ id: 'p1', label: 'P1', werte }] }]) }),
      cols,
    )
    const jahr = applyZeitbasis(model, 'jahr')
    expect(jahr.lines.marketing.werte['J1']).toBe(120)
    expect(jahr.lines.marketing.produkte[0].werte['J1']).toBe(120)
    expect(jahr.lines.marketing.produkte[0].children![0].werte['J1']).toBe(120)
  })
})
