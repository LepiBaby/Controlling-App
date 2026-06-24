import { describe, it, expect } from 'vitest'
import {
  calculateNextPayoutMonth,
  getCurrentMonthAndYear,
  makeDefaultEinstellung,
  RHYTHMUS_MONATE,
  RHYTHMUS_LABELS,
  RHYTHMUS_VALUES,
  MIN_VERSCHIEBUNG_MONATE,
  MAX_VERSCHIEBUNG_MONATE,
} from './use-langfristige-auszahlungs-einstellungen'

describe('Konstanten', () => {
  it('hat drei Monats-Rhythmen mit korrekten Monatszahlen', () => {
    expect(RHYTHMUS_VALUES).toEqual(['monatlich', 'alle_zwei_monate', 'quartalsweise'])
    expect(RHYTHMUS_MONATE.monatlich).toBe(1)
    expect(RHYTHMUS_MONATE.alle_zwei_monate).toBe(2)
    expect(RHYTHMUS_MONATE.quartalsweise).toBe(3)
  })

  it('hat Labels für jeden Rhythmus', () => {
    RHYTHMUS_VALUES.forEach(r => expect(RHYTHMUS_LABELS[r]).toBeTruthy())
  })

  it('Verschiebung 0–60', () => {
    expect(MIN_VERSCHIEBUNG_MONATE).toBe(0)
    expect(MAX_VERSCHIEBUNG_MONATE).toBe(60)
  })
})

describe('makeDefaultEinstellung', () => {
  it('liefert sinnvolle Standardwerte', () => {
    const d = makeDefaultEinstellung('p-1')
    expect(d).toEqual({
      sales_plattform_id: 'p-1',
      auszahlungsrhythmus: 'monatlich',
      erster_auszahlung_monat: null,
      erster_auszahlung_jahr: null,
      verschiebung_monate: 0,
      marketingkanal_ids: [],
    })
  })
})

describe('getCurrentMonthAndYear', () => {
  it('liefert Monat 1–12 und ein plausibles Jahr', () => {
    const { monat, jahr } = getCurrentMonthAndYear()
    expect(monat).toBeGreaterThanOrEqual(1)
    expect(monat).toBeLessThanOrEqual(12)
    expect(jahr).toBeGreaterThanOrEqual(2024)
  })
})

describe('calculateNextPayoutMonth', () => {
  it('Anker in der Zukunft bleibt unverändert', () => {
    expect(calculateNextPayoutMonth(6, 2027, 1, 3, 2026)).toEqual({ monat: 6, jahr: 2027 })
  })

  it('Anker gleich aktuellem Monat bleibt unverändert', () => {
    expect(calculateNextPayoutMonth(5, 2026, 2, 5, 2026)).toEqual({ monat: 5, jahr: 2026 })
  })

  it('monatlich: rückt auf aktuellen Monat vor', () => {
    expect(calculateNextPayoutMonth(1, 2026, 1, 3, 2026)).toEqual({ monat: 3, jahr: 2026 })
  })

  it('quartalsweise: rückt auf nächsten zukünftigen Quartalsmonat vor', () => {
    // Anker Jan, aktuell Mai, Schritte +3 → Apr (<Mai) → Jul (>=Mai)
    expect(calculateNextPayoutMonth(1, 2026, 3, 5, 2026)).toEqual({ monat: 7, jahr: 2026 })
  })

  it('behandelt den Jahreswechsel korrekt (alle 2 Monate)', () => {
    // Anker Nov 2026, aktuell Feb 2027, +2 → Jan 2027 (<Feb) → Mär 2027 (>=Feb)
    expect(calculateNextPayoutMonth(11, 2026, 2, 2, 2027)).toEqual({ monat: 3, jahr: 2027 })
  })

  it('rückt mehrere Jahre vor, wenn der Anker weit in der Vergangenheit liegt', () => {
    // Anker Jan 2020 monatlich, aktuell Jun 2026 → Jun 2026
    expect(calculateNextPayoutMonth(1, 2020, 1, 6, 2026)).toEqual({ monat: 6, jahr: 2026 })
  })
})
