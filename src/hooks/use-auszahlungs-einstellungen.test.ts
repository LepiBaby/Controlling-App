import { describe, it, expect } from 'vitest'
import { calculateNextPayoutWeek } from './use-auszahlungs-einstellungen'

// Note: 2026 has 53 ISO weeks (Jan 1 = Thursday).
// The spec examples assumed 52 weeks for 2026 — the implementation is correct,
// the spec examples were written with an incorrect assumption.

describe('calculateNextPayoutWeek', () => {
  // Spec-Beispiel 1: Basis-KW liegt eine Rhythmuseinheit hinter der aktuellen Woche
  it('basis one cycle behind: KW 24/2026, 2-week rhythm, current KW 25 → KW 26/2026', () => {
    expect(calculateNextPayoutWeek(24, 2026, 2, 25, 2026)).toEqual({ kw: 26, jahr: 2026 })
  })

  // Spec-Beispiel 2 (korrigiert: 2026 hat 53 Wochen, nicht 52)
  // KW 50+4=54 → 54>53 → KW 1/2027; KW 1 < KW 2 → advance: KW 1+4=KW 5/2027
  it('year rollover: KW 50/2026, 4-week rhythm, current KW 2/2027 → KW 5/2027 (2026 has 53 weeks)', () => {
    expect(calculateNextPayoutWeek(50, 2026, 4, 2, 2027)).toEqual({ kw: 5, jahr: 2027 })
  })

  // Basis = aktuelle Woche → direkt zurückgeben
  it('basis equals current week → returns basis without advancing', () => {
    expect(calculateNextPayoutWeek(22, 2026, 2, 22, 2026)).toEqual({ kw: 22, jahr: 2026 })
  })

  // Basis liegt in der Zukunft → direkt zurückgeben
  it('basis in the future → returns basis without advancing', () => {
    expect(calculateNextPayoutWeek(30, 2026, 2, 22, 2026)).toEqual({ kw: 30, jahr: 2026 })
  })

  // Wöchentlicher Rhythmus
  it('weekly rhythm: advances one week at a time', () => {
    expect(calculateNextPayoutWeek(20, 2026, 1, 23, 2026)).toEqual({ kw: 23, jahr: 2026 })
  })

  // Basis weit in der Vergangenheit → korrekt vorspulen ohne Endlosschleife
  it('basis far in the past → reaches a future week without infinite loop', () => {
    const result = calculateNextPayoutWeek(1, 2024, 4, 22, 2026)
    expect(result.jahr).toBeGreaterThanOrEqual(2026)
    expect(result.kw).toBeGreaterThanOrEqual(22)
  })

  // Jahresüberlauf: Jahr mit 52 Wochen (2025) — KW 51 + 2 überschreitet Jahr
  // KW 51+2=53 → 53>52 → KW 1/2026; KW 1/2026 >= KW 1/2026 → return
  it('year rollover in 52-week year: KW 51/2025, 2-week rhythm, current KW 1/2026 → KW 1/2026', () => {
    expect(calculateNextPayoutWeek(51, 2025, 2, 1, 2026)).toEqual({ kw: 1, jahr: 2026 })
  })

  // Jahr mit 53 ISO-Wochen (2015): KW 53 + 1 Woche = KW 1 des Folgejahrs
  it('53-week year: KW 53/2015 + 1 week, current KW 1/2016 → KW 1/2016', () => {
    expect(calculateNextPayoutWeek(53, 2015, 1, 1, 2016)).toEqual({ kw: 1, jahr: 2016 })
  })

  // 4-Wochen-Rhythmus über mehrere Jahresgrenzen
  it('4-week rhythm spanning multiple years reaches a week ≥ current', () => {
    const result = calculateNextPayoutWeek(1, 2024, 4, 10, 2026)
    expect(result.jahr).toBeGreaterThanOrEqual(2026)
    expect(result.kw).toBeGreaterThanOrEqual(10)
  })
})
