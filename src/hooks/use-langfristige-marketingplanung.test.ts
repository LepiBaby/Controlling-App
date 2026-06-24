import { describe, it, expect } from 'vitest'
import {
  computeBruttoUmsatz,
  computeBudget,
  pctCellKey,
} from './use-langfristige-marketingplanung'

// PROJ-85: Reine Berechnungs-/Schlüssel-Helfer der Marketing-Planung.
// Brutto-Umsatz = Absatz × Eff. VK; Marketingbudget = Brutto × (% / 100).

describe('computeBruttoUmsatz', () => {
  it('liefert null, wenn der VK fehlt', () => {
    expect(computeBruttoUmsatz(120, null)).toBeNull()
    expect(computeBruttoUmsatz(null, null)).toBeNull()
  })

  it('behandelt fehlenden Absatz als 0 (VK gesetzt)', () => {
    expect(computeBruttoUmsatz(null, 29.99)).toBe(0)
  })

  it('berechnet Absatz × VK, wenn beide gesetzt sind', () => {
    expect(computeBruttoUmsatz(100, 29.99)).toBeCloseTo(2999, 5)
    expect(computeBruttoUmsatz(0, 29.99)).toBe(0)
  })
})

describe('computeBudget', () => {
  it('liefert null, wenn der Brutto-Umsatz fehlt', () => {
    expect(computeBudget(null, 10)).toBeNull()
  })

  it('liefert null, wenn der Prozentsatz fehlt (nicht gesetzt)', () => {
    expect(computeBudget(1000, null)).toBeNull()
  })

  it('berechnet Brutto × (% / 100)', () => {
    expect(computeBudget(1000, 12.5)).toBeCloseTo(125, 5)
    expect(computeBudget(2999, 10)).toBeCloseTo(299.9, 5)
  })

  it('liefert 0, wenn Brutto-Umsatz vorhanden und % = 0 ist', () => {
    expect(computeBudget(1000, 0)).toBe(0)
  })
})

describe('pctCellKey', () => {
  it('baut den Schlüssel im Format kanal:produkt:jahr:monat:pct', () => {
    expect(pctCellKey('k1', 'p1', 2026, 4)).toBe('k1:p1:2026:4:pct')
  })

  it('endet immer auf :pct (für Bulk-Edit-/Notiz-Erkennung)', () => {
    expect(pctCellKey('a', 'b', 2025, 12).endsWith(':pct')).toBe(true)
  })
})
