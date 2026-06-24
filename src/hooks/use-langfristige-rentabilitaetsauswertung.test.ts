import { describe, it, expect } from 'vitest'
import {
  computeCascade,
  applyZeitbasis,
  collectExpandableIds,
  bruttoByMonth,
  type RaModel,
  type RaColumn,
  type RaNode,
} from './use-langfristige-rentabilitaetsauswertung'
import { RA_LINE_IDS, type RaLineId, type RaLine } from '@/lib/langfristige-rentabilitaetsauswertung-shared'

// Hilfen ─────────────────────────────────────────────────────────────────────
function mkLines(partial: Partial<Record<RaLineId, RaLine>>): Record<RaLineId, RaLine> {
  const lines = {} as Record<RaLineId, RaLine>
  for (const id of RA_LINE_IDS) lines[id] = { werte: {}, produkte: [] }
  for (const [id, l] of Object.entries(partial)) lines[id as RaLineId] = l!
  return lines
}
function line(werte: Record<string, number>, produkte: RaLine['produkte'] = []): RaLine {
  return { werte, produkte }
}
function nodeById(nodes: RaNode[], id: string): RaNode | undefined {
  return nodes.find(n => n.id === id)
}

const COLS: RaColumn[] = [{ key: '2026-1', label: 'Jan 2026' }, { key: '2026-2', label: 'Feb 2026' }]

describe('computeCascade — Zwischensummen', () => {
  it('rechnet Netto-Umsatz und DB I als kumulierte Beiträge (Brutto +, Kosten −)', () => {
    const lines = mkLines({
      brutto_umsatz: line({ '2026-1': 1000 }),
      rabatte: line({ '2026-1': 100 }),
      rueckerstattungen: line({ '2026-1': 50 }),
      umsatzsteuer: line({ '2026-1': 150 }),
      ware: line({ '2026-1': 200 }),
    })
    const nodes = computeCascade(lines, COLS)
    expect(nodeById(nodes, 'brutto_umsatz')!.values['2026-1']).toBe(1000)
    expect(nodeById(nodes, 'rabatte')!.values['2026-1']).toBe(-100)
    // Netto = 1000 − 100 − 50 − 150 = 700
    expect(nodeById(nodes, 'netto_umsatz')!.values['2026-1']).toBe(700)
    // Produktkosten-Gruppe = −(Ware 200) ; DB I = 700 − 200 = 500
    expect(nodeById(nodes, 'produktkosten')!.values['2026-1']).toBe(-200)
    expect(nodeById(nodes, 'db1')!.values['2026-1']).toBe(500)
  })

  it('führt die Kaskade bis Ergebnis korrekt durch (ohne Investitionen)', () => {
    const lines = mkLines({
      brutto_umsatz: line({ '2026-1': 1000 }),
      marketing: line({ '2026-1': 100 }),
      operativ: line({ '2026-1': 50 }),
      finanzierung_zinsen: line({ '2026-1': 30 }),
      steuern_ertrag: line({ '2026-1': 20 }),
    })
    const nodes = computeCascade(lines, COLS)
    // Investitionen + „EBIT nach Investitionen" gibt es nicht (mehr)
    expect(nodeById(nodes, 'investitionen')).toBeUndefined()
    expect(nodeById(nodes, 'ebit_nach_invest')).toBeUndefined()
    expect(nodeById(nodes, 'db3')!.values['2026-1']).toBe(900)   // 1000 − 100
    expect(nodeById(nodes, 'ebit')!.values['2026-1']).toBe(850)  // − 50 operativ
    expect(nodeById(nodes, 'ebt')!.values['2026-1']).toBe(820)   // EBIT − 30 zinsen (direkt)
    expect(nodeById(nodes, 'ergebnis')!.values['2026-1']).toBe(800) // − 20 steuern
  })
})

describe('computeCascade — geschachtelte Drill-Downs', () => {
  it('übernimmt verschachtelte produkte als RaNode-Baum mit Vorzeichen', () => {
    const lines = mkLines({
      marketing: line({ '2026-1': 300 }, [
        { id: 'kanalA', label: 'Kanal A', werte: { '2026-1': 300 }, children: [
          { id: 'p1', label: 'Produkt 1', werte: { '2026-1': 200 } },
          { id: 'p2', label: 'Produkt 2', werte: { '2026-1': 100 } },
        ] },
      ]),
    })
    const nodes = computeCascade(lines, COLS)
    const mkt = nodeById(nodes, 'marketing')!
    expect(mkt.values['2026-1']).toBe(-300)
    expect(mkt.children).toHaveLength(1)
    const kanal = mkt.children![0]
    expect(kanal.label).toBe('Kanal A')
    expect(kanal.values['2026-1']).toBe(-300)
    expect(kanal.children).toHaveLength(2)
    expect(kanal.children![0].values['2026-1']).toBe(-200)
    // Ausklappbare Ids enthalten Marketing-Zeile und den Kanal
    const ids = collectExpandableIds(nodes)
    expect(ids).toContain('marketing')
    expect(ids.some(i => i.includes('kanalA'))).toBe(true)
  })
})

describe('bruttoByMonth', () => {
  it('liefert den Brutto-Umsatz je Spalte (Bezugsgröße Prozentual)', () => {
    const nodes = computeCascade(mkLines({ brutto_umsatz: line({ '2026-1': 1234, '2026-2': 0 }) }), COLS)
    expect(bruttoByMonth(nodes, COLS)).toEqual({ '2026-1': 1234, '2026-2': 0 })
  })
})

describe('applyZeitbasis — rollierende 12-Monats-Jahre', () => {
  function buildMonate(n: number): RaColumn[] {
    const labels = ['Jan', 'Feb', 'Mär', 'Apr', 'Mai', 'Jun', 'Jul', 'Aug', 'Sep', 'Okt', 'Nov', 'Dez']
    const cols: RaColumn[] = []
    let y = 2026, m = 6 // Start Juni 2026
    for (let i = 0; i < n; i++) {
      cols.push({ key: `${y}-${m}`, label: `${labels[m - 1]} ${y}` })
      m++; if (m > 12) { m = 1; y++ }
    }
    return cols
  }

  it('lässt die Monatsansicht unverändert', () => {
    const model: RaModel = { columns: buildMonate(3), lines: mkLines({}), absatz: { gesamt: {}, produkte: [] }, loading: false, error: null, isEmpty: false }
    expect(applyZeitbasis(model, 'monat')).toBe(model)
  })

  it('aggregiert 24 Monate ab Startmonat zu 2 Jahresblöcken (keine Kalenderjahre)', () => {
    const cols = buildMonate(24)
    const brutto: Record<string, number> = {}
    for (const c of cols) brutto[c.key] = 100
    const model: RaModel = {
      columns: cols,
      lines: mkLines({ brutto_umsatz: line(brutto) }),
      absatz: { gesamt: Object.fromEntries(cols.map(c => [c.key, 5])), produkte: [] },
      loading: false, error: null, isEmpty: false,
    }
    const jahr = applyZeitbasis(model, 'jahr')
    expect(jahr.columns).toHaveLength(2)
    expect(jahr.columns[0].label).toBe('Jahr 1')
    expect(jahr.columns[0].sublabel).toBe('Jun 2026 – Mai 2027')
    expect(jahr.columns[1].sublabel).toBe('Jun 2027 – Mai 2028')
    // Jahressumme = 12 × 100
    expect(jahr.lines.brutto_umsatz.werte['J1']).toBe(1200)
    expect(jahr.lines.brutto_umsatz.werte['J2']).toBe(1200)
    // Absatz summiert je Jahr
    expect(jahr.absatz.gesamt['J1']).toBe(60)
  })

  it('aggregiert verschachtelte Aufschlüsselungen rekursiv', () => {
    const cols = buildMonate(12)
    const werte = Object.fromEntries(cols.map(c => [c.key, 10]))
    const model: RaModel = {
      columns: cols,
      lines: mkLines({ marketing: line(werte, [{ id: 'k1', label: 'Kanal', werte, children: [{ id: 'p1', label: 'P1', werte }] }]) }),
      absatz: { gesamt: {}, produkte: [] },
      loading: false, error: null, isEmpty: false,
    }
    const jahr = applyZeitbasis(model, 'jahr')
    expect(jahr.lines.marketing.werte['J1']).toBe(120)
    expect(jahr.lines.marketing.produkte[0].werte['J1']).toBe(120)
    expect(jahr.lines.marketing.produkte[0].children![0].werte['J1']).toBe(120)
  })
})
