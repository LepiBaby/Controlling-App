import { describe, it, expect } from 'vitest'
import {
  calcWachstum,
  formatWachstum,
  formatProzentWert,
  wachstumColorClass,
} from './reporting-rentabilitaet-matrix'

// ─── calcWachstum ─────────────────────────────────────────────────────────────

describe('calcWachstum', () => {
  it('returns null when no previous period exists (undefined)', () => {
    expect(calcWachstum(100, undefined)).toBeNull()
  })

  it('returns 0 when both current and previous are 0', () => {
    expect(calcWachstum(0, 0)).toBe(0)
  })

  it('returns "n/a" when previous is 0 and current is non-zero', () => {
    expect(calcWachstum(100, 0)).toBe('n/a')
    expect(calcWachstum(-50, 0)).toBe('n/a')
  })

  it('calculates positive growth correctly', () => {
    // (120 - 100) / |100| * 100 = 20
    expect(calcWachstum(120, 100)).toBe(20)
  })

  it('calculates negative growth correctly', () => {
    // (80 - 100) / |100| * 100 = -20
    expect(calcWachstum(80, 100)).toBe(-20)
  })

  it('returns 0 when current equals previous and previous is non-zero', () => {
    expect(calcWachstum(50, 50)).toBe(0)
    expect(calcWachstum(-30, -30)).toBe(0)
  })

  it('uses |vorherig| in denominator (negative previous)', () => {
    // (50 - (-100)) / |-100| * 100 = 150 / 100 * 100 = 150
    expect(calcWachstum(50, -100)).toBe(150)
  })

  it('handles negative current correctly (compared to positive previous)', () => {
    // (-50 - 100) / |100| * 100 = -150
    expect(calcWachstum(-50, 100)).toBe(-150)
  })

  it('handles small positive previous and large current', () => {
    // (1000 - 0.01) / 0.01 * 100 = approximately 9_999_900
    const result = calcWachstum(1000, 0.01)
    expect(typeof result).toBe('number')
    expect(result as number).toBeGreaterThan(9_000_000)
  })
})

// ─── formatWachstum ───────────────────────────────────────────────────────────

describe('formatWachstum', () => {
  it('formats null as em-dash', () => {
    expect(formatWachstum(null)).toBe('—')
  })

  it('formats "n/a" literally', () => {
    expect(formatWachstum('n/a')).toBe('n/a')
  })

  it('formats 0 as "0,0 %"', () => {
    expect(formatWachstum(0)).toBe('0,0 %')
  })

  it('formats positive values with "+", up arrow and German decimal comma', () => {
    expect(formatWachstum(8.3)).toBe('+8,3 % ↑')
    expect(formatWachstum(150)).toBe('+150,0 % ↑')
  })

  it('formats negative values with German minus and down arrow', () => {
    expect(formatWachstum(-12.1)).toBe('−12,1 % ↓')
    expect(formatWachstum(-100)).toBe('−100,0 % ↓')
  })

  it('rounds to exactly 1 decimal place', () => {
    expect(formatWachstum(8.345)).toBe('+8,3 % ↑')
    expect(formatWachstum(-12.16)).toBe('−12,2 % ↓')
  })

  it('uses German thousands separator for very large values', () => {
    expect(formatWachstum(9_999_900)).toContain('+')
    expect(formatWachstum(9_999_900)).toContain('↑')
    // The German format uses '.' as thousands separator
    expect(formatWachstum(9_999_900)).toMatch(/9\.999\.900,0/)
  })
})

// ─── formatProzentWert ────────────────────────────────────────────────────────

describe('formatProzentWert', () => {
  it('returns em-dash when basis is 0', () => {
    expect(formatProzentWert(100, 0)).toBe('—')
    expect(formatProzentWert(0, 0)).toBe('—')
    expect(formatProzentWert(-50, 0)).toBe('—')
  })

  it('calculates positive percentage with German decimal comma', () => {
    expect(formatProzentWert(30, 100)).toBe('30,0 %')
    expect(formatProzentWert(38.4, 100)).toBe('38,4 %')
  })

  it('calculates negative percentage (uses ASCII "-" from Intl.NumberFormat)', () => {
    // Note: formatProzentWert delegates to toLocaleString which emits ASCII '-' (U+002D),
    // not the unicode minus U+2212 used by formatWachstum. This is a known
    // inconsistency in the implementation (see QA findings).
    expect(formatProzentWert(-24.7, 100)).toBe('-24,7 %')
  })

  it('returns "0,0 %" for zero value with non-zero basis (not blank)', () => {
    expect(formatProzentWert(0, 100)).toBe('0,0 %')
  })

  it('returns "100,0 %" when value equals basis', () => {
    expect(formatProzentWert(100, 100)).toBe('100,0 %')
  })

  it('rounds to exactly 1 decimal place', () => {
    expect(formatProzentWert(38.45, 100)).toBe('38,5 %')
    expect(formatProzentWert(12.14, 100)).toBe('12,1 %')
  })

  it('handles fractional basis', () => {
    // 50 / 200 = 25 %
    expect(formatProzentWert(50, 200)).toBe('25,0 %')
  })

  it('handles negative basis (mathematically allowed even if unusual)', () => {
    // 50 / -100 * 100 = -50; ASCII '-' is produced by Intl.NumberFormat
    expect(formatProzentWert(50, -100)).toBe('-50,0 %')
  })
})

// ─── wachstumColorClass ───────────────────────────────────────────────────────

describe('wachstumColorClass', () => {
  it('returns muted class for null', () => {
    expect(wachstumColorClass(null)).toContain('muted-foreground')
  })

  it('returns muted class for "n/a"', () => {
    expect(wachstumColorClass('n/a')).toContain('muted-foreground')
  })

  it('returns muted class for 0', () => {
    expect(wachstumColorClass(0)).toContain('muted-foreground')
  })

  it('returns green class for positive values', () => {
    expect(wachstumColorClass(5)).toContain('green')
    expect(wachstumColorClass(0.1)).toContain('green')
  })

  it('returns red class for negative values', () => {
    expect(wachstumColorClass(-5)).toContain('red')
    expect(wachstumColorClass(-0.1)).toContain('red')
  })
})

// ─── bruttoumsatzByPeriode logic (replicated from component useMemo) ──────────
//
// The same algorithm used inside ReportingRentabilitaetMatrix to compute the
// Bruttoumsatz basis. We test the logic standalone with realistic data shapes.

type Kategorie = { kpi_type: 'umsatz' | 'ausgaben_kosten' }
type Position = {
  type: 'position' | 'summe'
  values: Record<string, number>
  kategorien: Kategorie[]
}

function bruttoumsatzByPeriode(
  positionen: Position[],
  perioden: string[],
): Record<string, number> {
  const result: Record<string, number> = {}
  for (const pos of positionen) {
    if (pos.type !== 'position') continue
    if (!pos.kategorien.every(k => k.kpi_type === 'umsatz')) continue
    for (const p of perioden) {
      result[p] = (result[p] ?? 0) + Math.max(0, pos.values[p] ?? 0)
    }
  }
  return result
}

describe('bruttoumsatzByPeriode logic', () => {
  it('sums only positive values of pure-umsatz positions', () => {
    const positionen: Position[] = [
      {
        type: 'position',
        values: { '2026-01': 1000, '2026-02': 2000 },
        kategorien: [{ kpi_type: 'umsatz' }],
      },
    ]
    const result = bruttoumsatzByPeriode(positionen, ['2026-01', '2026-02'])
    expect(result).toEqual({ '2026-01': 1000, '2026-02': 2000 })
  })

  it('excludes positions of type "summe"', () => {
    const positionen: Position[] = [
      {
        type: 'position',
        values: { '2026-01': 1000 },
        kategorien: [{ kpi_type: 'umsatz' }],
      },
      {
        type: 'summe',
        values: { '2026-01': 5000 },
        kategorien: [{ kpi_type: 'umsatz' }],
      },
    ]
    const result = bruttoumsatzByPeriode(positionen, ['2026-01'])
    expect(result).toEqual({ '2026-01': 1000 })
  })

  it('excludes positions with any ausgaben_kosten kategorie (mixed positions)', () => {
    // Mixed positions are skipped; if no pure umsatz position contributes,
    // the resulting map is empty (lookup with ?? 0 yields 0 downstream).
    const positionen: Position[] = [
      {
        type: 'position',
        values: { '2026-01': 1000 },
        kategorien: [{ kpi_type: 'umsatz' }, { kpi_type: 'ausgaben_kosten' }],
      },
    ]
    const result = bruttoumsatzByPeriode(positionen, ['2026-01'])
    expect(result['2026-01'] ?? 0).toBe(0)
  })

  it('excludes positions with only ausgaben_kosten kategorien', () => {
    const positionen: Position[] = [
      {
        type: 'position',
        values: { '2026-01': -500 },
        kategorien: [{ kpi_type: 'ausgaben_kosten' }],
      },
    ]
    const result = bruttoumsatzByPeriode(positionen, ['2026-01'])
    expect(result['2026-01'] ?? 0).toBe(0)
  })

  it('treats negative values from umsatz positions as 0 (Math.max(0,…))', () => {
    // Retouren / Abzugsposten produce negative values; they should NOT lower
    // the gross umsatz basis.
    const positionen: Position[] = [
      {
        type: 'position',
        values: { '2026-01': 1000 },
        kategorien: [{ kpi_type: 'umsatz' }],
      },
      {
        type: 'position',
        values: { '2026-01': -200 }, // e.g. Retouren-Position
        kategorien: [{ kpi_type: 'umsatz' }],
      },
    ]
    const result = bruttoumsatzByPeriode(positionen, ['2026-01'])
    // The 1000 counts, the -200 is clipped to 0
    expect(result).toEqual({ '2026-01': 1000 })
  })

  it('handles missing period values (undefined → 0)', () => {
    const positionen: Position[] = [
      {
        type: 'position',
        values: { '2026-01': 1000 },
        kategorien: [{ kpi_type: 'umsatz' }],
      },
    ]
    const result = bruttoumsatzByPeriode(positionen, ['2026-01', '2026-02'])
    expect(result).toEqual({ '2026-01': 1000, '2026-02': 0 })
  })

  it('aggregates across multiple periods correctly', () => {
    const positionen: Position[] = [
      {
        type: 'position',
        values: { '2026-01': 500, '2026-02': 700 },
        kategorien: [{ kpi_type: 'umsatz' }],
      },
      {
        type: 'position',
        values: { '2026-01': 300, '2026-02': 100 },
        kategorien: [{ kpi_type: 'umsatz' }],
      },
    ]
    const result = bruttoumsatzByPeriode(positionen, ['2026-01', '2026-02'])
    expect(result).toEqual({ '2026-01': 800, '2026-02': 800 })
  })

  it('returns empty map when no positions match (lookup with ?? 0 yields 0 downstream)', () => {
    // Implementation only writes keys for matching positions; downstream code
    // uses `bruttoumsatzByPeriode?.[p] ?? 0` so an empty object is correct.
    const positionen: Position[] = [
      {
        type: 'position',
        values: { '2026-01': 500 },
        kategorien: [{ kpi_type: 'ausgaben_kosten' }],
      },
    ]
    const result = bruttoumsatzByPeriode(positionen, ['2026-01', '2026-02'])
    expect(result).toEqual({})
    expect(result['2026-01'] ?? 0).toBe(0)
    expect(result['2026-02'] ?? 0).toBe(0)
  })

  it('returns empty object for empty positions and no periods', () => {
    expect(bruttoumsatzByPeriode([], [])).toEqual({})
  })
})

// ─── displayPerioden logic (Wachstum mode slice(1)) ───────────────────────────

function displayPerioden(
  perioden: string[],
  anzeigemodus: 'absolut' | 'prozentual' | 'wachstum',
): string[] {
  if (anzeigemodus !== 'wachstum') return perioden
  return perioden.slice(1)
}

describe('displayPerioden logic', () => {
  const perioden = ['2025-12', '2026-01', '2026-02', '2026-03']

  it('returns all periods unchanged in absolut mode', () => {
    expect(displayPerioden(perioden, 'absolut')).toEqual(perioden)
  })

  it('returns all periods unchanged in prozentual mode', () => {
    expect(displayPerioden(perioden, 'prozentual')).toEqual(perioden)
  })

  it('strips the first period in wachstum mode (it serves as Vorperiode)', () => {
    expect(displayPerioden(perioden, 'wachstum')).toEqual([
      '2026-01',
      '2026-02',
      '2026-03',
    ])
  })

  it('returns empty array when only Vorperiode is present in wachstum mode', () => {
    expect(displayPerioden(['2025-12'], 'wachstum')).toEqual([])
  })

  it('returns empty array when no periods exist', () => {
    expect(displayPerioden([], 'wachstum')).toEqual([])
    expect(displayPerioden([], 'absolut')).toEqual([])
  })
})
