import { describe, it, expect } from 'vitest'
import {
  rainbowColor,
  formatPeriode,
  formatAbsolutShort,
  formatWachstumTick,
} from './reporting-rentabilitaet-chart'

// ─── rainbowColor ─────────────────────────────────────────────────────────────

describe('rainbowColor', () => {
  it('returns red (hue 0) for total=1', () => {
    expect(rainbowColor(0, 1)).toBe('hsl(0, 80%, 45%)')
  })

  it('returns red (hue 0) when total <= 1 (defensive)', () => {
    expect(rainbowColor(0, 0)).toBe('hsl(0, 80%, 45%)')
  })

  it('index=0 returns red (hue 0) for total=5', () => {
    expect(rainbowColor(0, 5)).toBe('hsl(0, 80%, 45%)')
  })

  it('last index returns violet (hue 270) for total=5', () => {
    expect(rainbowColor(4, 5)).toBe('hsl(270, 80%, 45%)')
  })

  it('last index returns violet (hue 270) for total=2', () => {
    expect(rainbowColor(1, 2)).toBe('hsl(270, 80%, 45%)')
  })

  it('middle index returns hue ≈ 135 for total=3', () => {
    // index=1, total=3 → 1/2 * 270 = 135
    expect(rainbowColor(1, 3)).toBe('hsl(135, 80%, 45%)')
  })

  it('distributes hues evenly across 0..270 for 5 selections', () => {
    const hues = [0, 1, 2, 3, 4].map(i => rainbowColor(i, 5))
    // (i / 4) * 270 → 0, 67.5→68, 135, 202.5→203, 270
    expect(hues[0]).toBe('hsl(0, 80%, 45%)')
    expect(hues[1]).toBe('hsl(68, 80%, 45%)')
    expect(hues[2]).toBe('hsl(135, 80%, 45%)')
    expect(hues[3]).toBe('hsl(203, 80%, 45%)')
    expect(hues[4]).toBe('hsl(270, 80%, 45%)')
  })

  it('2 selections produce only red (0) and violet (270) — distinct extremes', () => {
    expect(rainbowColor(0, 2)).toBe('hsl(0, 80%, 45%)')
    expect(rainbowColor(1, 2)).toBe('hsl(270, 80%, 45%)')
  })

  it('re-distributes when count changes (1 → 2)', () => {
    // mit 1 Position → hue 0
    expect(rainbowColor(0, 1)).toBe('hsl(0, 80%, 45%)')
    // mit 2 Positionen → index 0 = hue 0, index 1 = hue 270
    expect(rainbowColor(0, 2)).toBe('hsl(0, 80%, 45%)')
    expect(rainbowColor(1, 2)).toBe('hsl(270, 80%, 45%)')
  })
})

// ─── formatPeriode ────────────────────────────────────────────────────────────

describe('formatPeriode', () => {
  it('formats YYYY-MM as "Mon JJJJ"', () => {
    expect(formatPeriode('2026-01')).toBe('Jan 2026')
    expect(formatPeriode('2026-02')).toBe('Feb 2026')
    expect(formatPeriode('2026-03')).toBe('Mär 2026')
    expect(formatPeriode('2026-04')).toBe('Apr 2026')
    expect(formatPeriode('2026-05')).toBe('Mai 2026')
    expect(formatPeriode('2026-12')).toBe('Dez 2026')
  })

  it('formats YYYY-Qn as "Qn JJJJ"', () => {
    expect(formatPeriode('2026-Q1')).toBe('Q1 2026')
    expect(formatPeriode('2026-Q2')).toBe('Q2 2026')
    expect(formatPeriode('2026-Q4')).toBe('Q4 2026')
  })

  it('returns year unchanged for YYYY format', () => {
    expect(formatPeriode('2026')).toBe('2026')
    expect(formatPeriode('2024')).toBe('2024')
  })

  it('returns unrecognized format unchanged (fallback)', () => {
    expect(formatPeriode('hello')).toBe('hello')
    expect(formatPeriode('')).toBe('')
  })
})

// ─── formatAbsolutShort ───────────────────────────────────────────────────────

describe('formatAbsolutShort', () => {
  it('formats values < 1000 as plain euros without decimals', () => {
    expect(formatAbsolutShort(0)).toBe('0 €')
    expect(formatAbsolutShort(123)).toBe('123 €')
    expect(formatAbsolutShort(999)).toBe('999 €')
  })

  it('formats values >= 1000 with k-suffix', () => {
    expect(formatAbsolutShort(1000)).toBe('1k €')
    expect(formatAbsolutShort(1500)).toBe('1,5 €'.replace('1,5 €', '1,5k €'))
    expect(formatAbsolutShort(1500)).toBe('1,5k €')
    expect(formatAbsolutShort(12_450)).toBe('12,5k €')
  })

  it('formats values >= 1_000_000 with M-suffix', () => {
    expect(formatAbsolutShort(1_000_000)).toBe('1M €')
    expect(formatAbsolutShort(1_500_000)).toBe('1,5M €')
    expect(formatAbsolutShort(2_750_000)).toBe('2,8M €')
  })

  it('formats negative values < 1000 with minus prefix', () => {
    // toLocaleString in node uses ASCII hyphen for negative; the function
    // does not normalize to Unicode minus. We assert the actual runtime
    // behaviour here so the test pins the contract.
    const result = formatAbsolutShort(-500)
    expect(result).toMatch(/^[-−]500 €$/)
  })

  it('formats negative thousands with k-suffix and minus', () => {
    const result = formatAbsolutShort(-1500)
    expect(result).toMatch(/^[-−]1,5k €$/)
  })

  it('formats negative millions with M-suffix and minus', () => {
    const result = formatAbsolutShort(-1_500_000)
    expect(result).toMatch(/^[-−]1,5M €$/)
  })
})

// ─── formatWachstumTick ───────────────────────────────────────────────────────

describe('formatWachstumTick', () => {
  it('formats 0 as "0,0 %"', () => {
    expect(formatWachstumTick(0)).toBe('0,0 %')
  })

  it('formats positive values with +sign and one decimal', () => {
    expect(formatWachstumTick(8.3)).toBe('+8,3 %')
    expect(formatWachstumTick(100)).toBe('+100,0 %')
    expect(formatWachstumTick(0.1)).toBe('+0,1 %')
  })

  it('formats negative values with Unicode minus sign and one decimal', () => {
    expect(formatWachstumTick(-12.1)).toBe('−12,1 %')
    expect(formatWachstumTick(-100)).toBe('−100,0 %')
    expect(formatWachstumTick(-0.1)).toBe('−0,1 %')
  })

  it('uses German number formatting (comma as decimal separator)', () => {
    expect(formatWachstumTick(1234.5)).toBe('+1.234,5 %')
    expect(formatWachstumTick(-1234.5)).toBe('−1.234,5 %')
  })

  it('handles very high growth rates without overflow', () => {
    expect(formatWachstumTick(9_999_900)).toBe('+9.999.900,0 %')
  })
})
