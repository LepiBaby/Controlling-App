import { describe, it, expect } from 'vitest'
import { buildInvestitionsausgabenMonate, wertKey } from './use-langfristige-investitionsausgaben'

// PROJ-92: Reine Logik der langfristigen Investitionsausgaben-Planung —
// Monatsfenster (Start EXAKT im Startmonat, KEIN Vorlauf, Horizont Spalten,
// Jahresgrenzen) und Schlüssel-Helfer.

describe('buildInvestitionsausgabenMonate', () => {
  it('startet exakt im Startmonat und liefert genau Horizont Spalten (kein Vorlauf)', () => {
    const monate = buildInvestitionsausgabenMonate(4, 2026, 12) // April 2026, Horizont 12
    expect(monate).toHaveLength(12)
    expect(monate[0]).toMatchObject({ year: 2026, month: 4 })
    expect(monate[monate.length - 1]).toMatchObject({ year: 2027, month: 3 }) // April + 11 = März 2027
  })

  it('läuft korrekt über die Jahresgrenze (Start im Dezember)', () => {
    const monate = buildInvestitionsausgabenMonate(12, 2026, 3) // Dez 2026, Horizont 3
    expect(monate).toHaveLength(3)
    expect(monate[0]).toMatchObject({ year: 2026, month: 12 })
    expect(monate[1]).toMatchObject({ year: 2027, month: 1 })
    expect(monate[2]).toMatchObject({ year: 2027, month: 2 })
  })

  it('läuft fortlaufend über mehrere Jahre (langer Horizont), ohne Lücken/Dopplungen', () => {
    const monate = buildInvestitionsausgabenMonate(6, 2026, 30) // 30 Monate ab Juni 2026
    expect(monate).toHaveLength(30)
    expect(monate[0]).toMatchObject({ year: 2026, month: 6 })
    let prev = monate[0]
    for (let i = 1; i < monate.length; i++) {
      const cur = monate[i]
      const diff = (cur.year - prev.year) * 12 + (cur.month - prev.month)
      expect(diff).toBe(1)
      expect(cur.month).toBeGreaterThanOrEqual(1)
      expect(cur.month).toBeLessThanOrEqual(12)
      prev = cur
    }
  })

  it('verwendet bei fehlendem Startmonat/-jahr den aktuellen Monat (Länge = Horizont)', () => {
    const monate = buildInvestitionsausgabenMonate(undefined, undefined, 5)
    expect(monate).toHaveLength(5)
    expect(monate[0].month).toBeGreaterThanOrEqual(1)
    expect(monate[0].month).toBeLessThanOrEqual(12)
  })

  it('erzeugt für jeden Monat ein nicht-leeres Label', () => {
    const monate = buildInvestitionsausgabenMonate(4, 2026, 3)
    for (const m of monate) {
      expect(typeof m.label).toBe('string')
      expect(m.label.length).toBeGreaterThan(0)
    }
  })
})

describe('wertKey', () => {
  it('kombiniert Untergruppe + Produkt + Jahr + Monat zu einem 4-teiligen Schlüssel', () => {
    expect(wertKey('kat1', 'prod1', 2026, 7)).toBe('kat1:prod1:2026:7')
  })

  it('Schlüssel sind je Zellkoordinate eindeutig', () => {
    const a = wertKey('kat1', 'prod1', 2026, 7)
    const b = wertKey('kat1', 'prod1', 2026, 8)
    const c = wertKey('kat1', 'prod2', 2026, 7)
    expect(new Set([a, b, c]).size).toBe(3)
  })
})
