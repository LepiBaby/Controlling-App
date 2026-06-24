import { describe, it, expect } from 'vitest'
import { buildOperativekostenMonate, betragCellKey } from './use-operativekosten-planung'

// PROJ-88: Reine Logik der langfristigen Operativkosten Planung —
// Monatsfenster (Start EXAKT im Startmonat, KEIN Vorlauf, Horizont Spalten,
// Jahresgrenzen) und Schlüssel-Helfer.

describe('buildOperativekostenMonate', () => {
  it('startet exakt im Startmonat und liefert genau Horizont Spalten (kein Vorlauf)', () => {
    const monate = buildOperativekostenMonate(4, 2026, 12) // Start April 2026, Horizont 12
    expect(monate).toHaveLength(12)
    expect(monate[0]).toMatchObject({ year: 2026, month: 4 }) // April 2026 (= Startmonat)
    expect(monate[monate.length - 1]).toMatchObject({ year: 2027, month: 3 }) // März 2027 (April + 11)
  })

  it('läuft korrekt über die Jahresgrenze (Start im Dezember)', () => {
    const monate = buildOperativekostenMonate(12, 2026, 3) // Dez 2026, Horizont 3
    expect(monate).toHaveLength(3)
    expect(monate[0]).toMatchObject({ year: 2026, month: 12 }) // Dezember 2026
    expect(monate[1]).toMatchObject({ year: 2027, month: 1 }) // Januar 2027
    expect(monate[2]).toMatchObject({ year: 2027, month: 2 }) // Februar 2027
  })

  it('läuft fortlaufend über mehrere Jahre (langer Horizont)', () => {
    const monate = buildOperativekostenMonate(6, 2026, 30) // 30 Monate ab Juni 2026
    expect(monate).toHaveLength(30)
    expect(monate[0]).toMatchObject({ year: 2026, month: 6 }) // Juni 2026 (kein Vorlauf)
    let prev = monate[0]
    for (let i = 1; i < monate.length; i++) {
      const cur = monate[i]
      const diff = (cur.year - prev.year) * 12 + (cur.month - prev.month)
      expect(diff).toBe(1) // jede Spalte exakt einen Monat weiter, keine Lücken/Dopplungen
      expect(cur.month).toBeGreaterThanOrEqual(1)
      expect(cur.month).toBeLessThanOrEqual(12)
      prev = cur
    }
  })

  it('liefert mindestens eine Spalte (Fallback bei Horizont 0)', () => {
    const monate = buildOperativekostenMonate(4, 2026, 0)
    expect(monate.length).toBeGreaterThanOrEqual(1)
    expect(monate[0]).toMatchObject({ year: 2026, month: 4 })
  })

  it('erzeugt für jeden Monat ein nicht-leeres Label', () => {
    const monate = buildOperativekostenMonate(4, 2026, 3)
    for (const m of monate) {
      expect(typeof m.label).toBe('string')
      expect(m.label.length).toBeGreaterThan(0)
    }
  })
})

describe('betragCellKey', () => {
  it('kombiniert Kategorie + Jahr + Monat zu einem 3-teiligen Schlüssel', () => {
    expect(betragCellKey('kat1', 2026, 4)).toBe('kat1:2026:4')
  })

  it('Schlüssel sind je Zellkoordinate eindeutig', () => {
    const a = betragCellKey('kat1', 2026, 4)
    const b = betragCellKey('kat1', 2026, 5)
    const c = betragCellKey('kat2', 2026, 4)
    expect(a).not.toBe(b)
    expect(a).not.toBe(c)
  })

  it('ergibt mit einer UUID genau 3 durch Doppelpunkt getrennte Teile (Bulk/Notiz-Parsing)', () => {
    // UUIDs enthalten Bindestriche, keine Doppelpunkte → split(':') liefert 3 Teile.
    const key = betragCellKey('22222222-2222-4222-8222-222222222222', 2026, 4)
    expect(key.split(':')).toHaveLength(3)
    expect(key.startsWith('row:')).toBe(false)
  })
})
