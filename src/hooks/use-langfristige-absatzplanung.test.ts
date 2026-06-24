import { describe, it, expect } from 'vitest'
import {
  buildPlanungsmonate,
  zellKey,
  absatzCellKey,
  vkCellKey,
} from './use-langfristige-absatzplanung'

// PROJ-84: Reine Logik der langfristigen Absatzplanung —
// Monatsfenster (Startmonat − 3, Horizont + 3, Jahresgrenzen) und Schlüssel-Helfer.

describe('buildPlanungsmonate', () => {
  it('startet 3 Monate vor dem Startmonat und liefert Horizont + 3 Spalten', () => {
    const monate = buildPlanungsmonate(4, 2026, 12) // Start April 2026, Horizont 12
    expect(monate).toHaveLength(15) // 12 + 3
    expect(monate[0]).toMatchObject({ year: 2026, month: 1 }) // Januar 2026 (April − 3)
    expect(monate[monate.length - 1]).toMatchObject({ year: 2027, month: 3 }) // März 2027 (April + 11)
  })

  it('dekrementiert das Jahr korrekt, wenn der Vorlauf über die Jahresgrenze fällt', () => {
    const monate = buildPlanungsmonate(1, 2026, 12) // Start Januar 2026
    expect(monate[0]).toMatchObject({ year: 2025, month: 10 }) // Oktober 2025
    expect(monate[1]).toMatchObject({ year: 2025, month: 11 }) // November 2025
    expect(monate[3]).toMatchObject({ year: 2026, month: 1 }) // Januar 2026
    expect(monate[monate.length - 1]).toMatchObject({ year: 2026, month: 12 }) // Dezember 2026
  })

  it('behandelt den Vorlauf bei Februar-Start (November Vorjahr)', () => {
    const monate = buildPlanungsmonate(2, 2026, 6) // Start Februar 2026
    expect(monate).toHaveLength(9) // 6 + 3
    expect(monate[0]).toMatchObject({ year: 2025, month: 11 }) // November 2025
    expect(monate[1]).toMatchObject({ year: 2025, month: 12 }) // Dezember 2025
  })

  it('läuft fortlaufend über mehrere Jahre (langer Horizont)', () => {
    const monate = buildPlanungsmonate(6, 2026, 30) // 30 Monate ab Juni 2026
    expect(monate).toHaveLength(33) // 30 + 3
    // Erste = März 2026; jede Spalte exakt einen Monat weiter, keine Lücken/Dopplungen
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

  it('erzeugt für jeden Monat ein Label', () => {
    const monate = buildPlanungsmonate(4, 2026, 3)
    for (const m of monate) {
      expect(typeof m.label).toBe('string')
      expect(m.label.length).toBeGreaterThan(0)
    }
  })
})

describe('Schlüssel-Helfer', () => {
  it('zellKey kombiniert Koordinaten ohne Feld-Suffix', () => {
    expect(zellKey('p1', 'prd1', 2026, 4)).toBe('p1:prd1:2026:4')
  })

  it('absatzCellKey/vkCellKey hängen das passende Feld-Suffix an', () => {
    expect(absatzCellKey('p1', 'prd1', 2026, 4)).toBe('p1:prd1:2026:4:absatz')
    expect(vkCellKey('p1', 'prd1', 2026, 4)).toBe('p1:prd1:2026:4:vk')
  })

  it('Schlüssel sind je Koordinate eindeutig und unterscheiden Absatz vs. VK', () => {
    const a = absatzCellKey('p1', 'prd1', 2026, 4)
    const v = vkCellKey('p1', 'prd1', 2026, 4)
    const other = absatzCellKey('p1', 'prd1', 2026, 5)
    expect(a).not.toBe(v)
    expect(a).not.toBe(other)
  })
})
