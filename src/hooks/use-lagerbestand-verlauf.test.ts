import { describe, it, expect } from 'vitest'
import { kwLabel, kwStartStr, skuColor, skuHue } from './use-lagerbestand-verlauf'

describe('kwLabel', () => {
  it('formats KW with leading zero for single-digit weeks', () => {
    expect(kwLabel(1, 2026)).toBe('KW01 / 26')
    expect(kwLabel(9, 2025)).toBe('KW09 / 25')
  })

  it('formats KW without leading zero for double-digit weeks', () => {
    expect(kwLabel(23, 2026)).toBe('KW23 / 26')
    expect(kwLabel(52, 2025)).toBe('KW52 / 25')
  })
})

describe('kwStartStr', () => {
  it('returns Monday of KW1 2026 (= 29.12.2025)', () => {
    // ISO week 1 of 2026 starts on Monday 29 Dec 2025
    expect(kwStartStr(1, 2026)).toBe('29.12.')
  })

  it('returns Monday of KW23 2026 (= 01.06.2026)', () => {
    // ISO week 23 of 2026 starts on Monday 01 Jun 2026
    expect(kwStartStr(23, 2026)).toBe('01.06.')
  })

  it('returns Monday of KW1 2025 (= 30.12.2024)', () => {
    // ISO week 1 of 2025 starts on Monday 30 Dec 2024
    expect(kwStartStr(1, 2025)).toBe('30.12.')
  })

  it('returns Monday of KW10 2026 (= 02.03.2026)', () => {
    expect(kwStartStr(10, 2026)).toBe('02.03.')
  })

  it('pads day and month with leading zeros', () => {
    // KW5 2026: starts Mon 26 Jan 2026
    expect(kwStartStr(5, 2026)).toBe('26.01.')
  })
})

describe('skuHue', () => {
  it('returns 0 for a single SKU', () => {
    expect(skuHue(0, 1)).toBe(0)
  })

  it('spans from 0 to 270 for two SKUs', () => {
    expect(skuHue(0, 2)).toBe(0)
    expect(skuHue(1, 2)).toBe(270)
  })

  it('returns midpoint 135 for index 1 of 3 SKUs', () => {
    expect(skuHue(1, 3)).toBe(135)
  })
})

describe('skuColor', () => {
  it('returns name-based color for known color keywords', () => {
    const blau = skuColor(0, 5, 'Produkt Blau')
    expect(blau).toMatch(/^hsl\(/)
    expect(blau).toContain('221')  // blue hue
  })

  it('returns name-based color for "grau"', () => {
    const grau = skuColor(0, 5, 'Grau')
    expect(grau).toBe('hsl(0, 0%, 52%)')
  })

  it('falls back to hue-based color for unknown name', () => {
    const color = skuColor(0, 3, 'Artikel Unbekannt')
    expect(color).toBe('hsl(0, 80%, 45%)')
  })

  it('falls back to hue-based color when name is undefined', () => {
    const color = skuColor(1, 2)
    expect(color).toBe('hsl(270, 80%, 45%)')
  })
})
