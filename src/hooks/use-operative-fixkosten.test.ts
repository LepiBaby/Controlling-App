import { describe, it, expect } from 'vitest'
import {
  berechneNettoMonatlich,
  formatFaelligkeitsMonate,
  MONAT_KURZ,
} from './use-operative-fixkosten'

describe('berechneNettoMonatlich', () => {
  it('returns the full amount for monatlich', () => {
    expect(berechneNettoMonatlich(1200, 'monatlich')).toBe(1200)
  })

  it('divides by 3 for quartalsweise', () => {
    expect(berechneNettoMonatlich(300, 'quartalsweise')).toBe(100)
  })

  it('divides by 12 for jaehrlich', () => {
    expect(berechneNettoMonatlich(1200, 'jaehrlich')).toBe(100)
  })

  it('returns 0 for zero netto with any frequency', () => {
    expect(berechneNettoMonatlich(0, 'monatlich')).toBe(0)
    expect(berechneNettoMonatlich(0, 'quartalsweise')).toBe(0)
    expect(berechneNettoMonatlich(0, 'jaehrlich')).toBe(0)
  })

  it('handles decimal amounts for quartalsweise', () => {
    expect(berechneNettoMonatlich(100, 'quartalsweise')).toBeCloseTo(33.333, 3)
  })

  it('handles decimal amounts for jaehrlich', () => {
    expect(berechneNettoMonatlich(1000, 'jaehrlich')).toBeCloseTo(83.333, 3)
  })
})

describe('formatFaelligkeitsMonate', () => {
  it('returns "Alle Monate" for monatlich regardless of monate array', () => {
    expect(formatFaelligkeitsMonate([], 'monatlich')).toBe('Alle Monate')
    expect(formatFaelligkeitsMonate([3, 6, 9, 12], 'monatlich')).toBe('Alle Monate')
  })

  it('returns short month name for jaehrlich with single month', () => {
    expect(formatFaelligkeitsMonate([3], 'jaehrlich')).toBe('Mär')
    expect(formatFaelligkeitsMonate([12], 'jaehrlich')).toBe('Dez')
  })

  it('returns comma-separated sorted short month names for quartalsweise', () => {
    expect(formatFaelligkeitsMonate([2, 5, 8, 11], 'quartalsweise')).toBe('Feb, Mai, Aug, Nov')
  })

  it('sorts months ascending before formatting', () => {
    // months provided in reverse order
    expect(formatFaelligkeitsMonate([11, 8, 5, 2], 'quartalsweise')).toBe('Feb, Mai, Aug, Nov')
  })

  it('handles all 12 months for quartalsweise (unusual but valid)', () => {
    const result = formatFaelligkeitsMonate([1, 4, 7, 10], 'quartalsweise')
    expect(result).toBe('Jan, Apr, Jul, Okt')
  })

  it('maps all months correctly via MONAT_KURZ', () => {
    const allMonths = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]
    const result = formatFaelligkeitsMonate(allMonths, 'jaehrlich')
    const expected = allMonths.map(m => MONAT_KURZ[m]).join(', ')
    expect(result).toBe(expected)
  })

  it('returns empty string for empty array with non-monatlich frequency', () => {
    expect(formatFaelligkeitsMonate([], 'jaehrlich')).toBe('')
    expect(formatFaelligkeitsMonate([], 'quartalsweise')).toBe('')
  })
})
