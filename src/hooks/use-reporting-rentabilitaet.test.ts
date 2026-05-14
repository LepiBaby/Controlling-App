import { describe, it, expect } from 'vitest'
import { prevPeriodStart } from './use-reporting-rentabilitaet'

// ─── prevPeriodStart ──────────────────────────────────────────────────────────

describe('prevPeriodStart', () => {
  describe('Granularität: monat (−1 Monat)', () => {
    it('subtracts 1 month within the same year', () => {
      expect(prevPeriodStart('2026-05', 'monat')).toBe('2026-04')
    })

    it('handles January → previous December (year rollover)', () => {
      expect(prevPeriodStart('2026-01', 'monat')).toBe('2025-12')
    })

    it('handles February → January', () => {
      expect(prevPeriodStart('2026-02', 'monat')).toBe('2026-01')
    })

    it('handles December → November', () => {
      expect(prevPeriodStart('2026-12', 'monat')).toBe('2026-11')
    })

    it('zero-pads single-digit months', () => {
      expect(prevPeriodStart('2026-09', 'monat')).toBe('2026-08')
      expect(prevPeriodStart('2026-10', 'monat')).toBe('2026-09')
    })
  })

  describe('Granularität: quartal (−3 Monate)', () => {
    it('subtracts 3 months within the same year', () => {
      expect(prevPeriodStart('2026-04', 'quartal')).toBe('2026-01')
      expect(prevPeriodStart('2026-07', 'quartal')).toBe('2026-04')
      expect(prevPeriodStart('2026-10', 'quartal')).toBe('2026-07')
    })

    it('handles Q1 (Jan) → previous Q4 (Oct) of previous year', () => {
      expect(prevPeriodStart('2026-01', 'quartal')).toBe('2025-10')
    })

    it('handles Q2 (Feb start hypothetical) crossing year boundary', () => {
      expect(prevPeriodStart('2026-02', 'quartal')).toBe('2025-11')
      expect(prevPeriodStart('2026-03', 'quartal')).toBe('2025-12')
    })
  })

  describe('Granularität: jahr (−12 Monate)', () => {
    it('subtracts exactly one year', () => {
      expect(prevPeriodStart('2026-01', 'jahr')).toBe('2025-01')
      expect(prevPeriodStart('2026-06', 'jahr')).toBe('2025-06')
      expect(prevPeriodStart('2026-12', 'jahr')).toBe('2025-12')
    })

    it('keeps the month unchanged', () => {
      expect(prevPeriodStart('2030-07', 'jahr')).toBe('2029-07')
    })
  })

  describe('Format invariants', () => {
    it('always returns YYYY-MM with zero-padded month', () => {
      const result = prevPeriodStart('2026-01', 'monat')
      expect(result).toMatch(/^\d{4}-\d{2}$/)
    })

    it('returns string of length 7', () => {
      expect(prevPeriodStart('2026-01', 'quartal')).toHaveLength(7)
      expect(prevPeriodStart('2026-12', 'jahr')).toHaveLength(7)
    })
  })
})
