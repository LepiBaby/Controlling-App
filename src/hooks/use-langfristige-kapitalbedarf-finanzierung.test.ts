import { describe, it, expect } from 'vitest'
import {
  sumValues,
  computeBetriebsmittelbedarf,
  effektiverBetrag,
  type KbfRow,
} from './langfristige-kapitalbedarf-finanzierung-utils'

function row(partial: Partial<KbfRow>): KbfRow {
  return {
    id: 'r', bereich: 'kapitalbedarf', zeilen_art: 'manuell', bezeichnung: '',
    betrag: null, zinssatz: null, laufzeit_jahre: null, tilgungsfrei_jahre: null,
    sort_order: 0, is_system: false, quelle_id: null, ...partial,
  }
}

describe('sumValues', () => {
  it('summiert alle Spaltenwerte über alle Monate', () => {
    expect(sumValues({ '2026-1': 100, '2026-2': 250.5, '2026-3': 0 })).toBe(350.5)
  })
  it('liefert 0 für leere Werte', () => {
    expect(sumValues({})).toBe(0)
  })
})

describe('computeBetriebsmittelbedarf', () => {
  it('liefert den Betrag des negativsten Kontostands', () => {
    const cells = { a: { value: 500 }, b: { value: -1200 }, c: { value: -300 }, d: { value: 800 } }
    expect(computeBetriebsmittelbedarf(cells)).toBe(1200)
  })
  it('liefert 0, wenn der Kontostand nie negativ wird', () => {
    const cells = { a: { value: 500 }, b: { value: 100 }, c: { value: 800 } }
    expect(computeBetriebsmittelbedarf(cells)).toBe(0)
  })
  it('ignoriert null-Zellen', () => {
    const cells = { a: { value: null }, b: { value: -50 } }
    expect(computeBetriebsmittelbedarf(cells)).toBe(50)
  })
})

describe('effektiverBetrag', () => {
  const INVEST_GESAMT = 9000
  const AUTO_BM = 1500

  it('Investitionen-Zeile ist NICHT editierbar → immer der Summenwert (override am Row ignoriert)', () => {
    expect(effektiverBetrag(row({ zeilen_art: 'investitionen', betrag: null }), INVEST_GESAMT, AUTO_BM)).toBe(9000)
    // Ein etwaiger betrag an der Investitionen-Zeile wird ignoriert (Summe sticht).
    expect(effektiverBetrag(row({ zeilen_art: 'investitionen', betrag: 12345 }), INVEST_GESAMT, AUTO_BM)).toBe(9000)
  })
  it('Betriebsmittelbedarf ohne Override → Auto-Wert', () => {
    expect(effektiverBetrag(row({ zeilen_art: 'betriebsmittelbedarf', betrag: null }), INVEST_GESAMT, AUTO_BM)).toBe(1500)
  })
  it('Override 0 sticht den Auto-Wert (manuelle Null)', () => {
    expect(effektiverBetrag(row({ zeilen_art: 'betriebsmittelbedarf', betrag: 0 }), INVEST_GESAMT, AUTO_BM)).toBe(0)
  })
  it('Liquiditätsreserve / manuelle Zeile → Betrag sonst 0', () => {
    expect(effektiverBetrag(row({ zeilen_art: 'liquiditaetsreserve', betrag: 2000 }), INVEST_GESAMT, AUTO_BM)).toBe(2000)
    expect(effektiverBetrag(row({ zeilen_art: 'manuell', betrag: null }), INVEST_GESAMT, AUTO_BM)).toBe(0)
  })
})
