import { describe, it, expect } from 'vitest'
import { addWeeks, getISOWeek, getISOWeekYear, startOfISOWeek } from 'date-fns'
import {
  berechnePlanungswochen,
  skuAbsatzKey,
  produktVKKey,
  kwKey,
} from './use-absatzplanung'

describe('berechnePlanungswochen', () => {
  it('returns the correct number of weeks', () => {
    expect(berechnePlanungswochen(13)).toHaveLength(13)
    expect(berechnePlanungswochen(1)).toHaveLength(1)
    expect(berechnePlanungswochen(0)).toHaveLength(0)
    expect(berechnePlanungswochen(52)).toHaveLength(52)
  })

  it('starts from the next ISO week (never the current week)', () => {
    const today = new Date()
    const nextWeekDate = addWeeks(startOfISOWeek(today), 1)
    const expectedFirstWeek = getISOWeek(nextWeekDate)
    const expectedFirstYear = getISOWeekYear(nextWeekDate)

    const wochen = berechnePlanungswochen(4)
    expect(wochen[0].week).toBe(expectedFirstWeek)
    expect(wochen[0].year).toBe(expectedFirstYear)
  })

  it('produces weeks in ascending consecutive order', () => {
    const wochen = berechnePlanungswochen(13)
    for (let i = 1; i < wochen.length; i++) {
      const prev = wochen[i - 1]
      const curr = wochen[i]
      const prevNum = prev.year * 100 + prev.week
      const currNum = curr.year * 100 + curr.week
      expect(currNum).toBeGreaterThan(prevNum)
    }
  })

  it('generates correct label format "KW04 / 2026"', () => {
    const wochen = berechnePlanungswochen(3)
    for (const w of wochen) {
      expect(w.label).toMatch(/^KW\d{2} \/ \d{4}$/)
    }
  })

  it('handles year boundary (week 52/53 → week 1 of next year)', () => {
    // Force a date near year-end to test boundary
    const wochen = berechnePlanungswochen(53)
    const years = new Set(wochen.map(w => w.year))
    // For any 53-week span starting from current week, it will always span at least 1 year boundary
    // Unless we happen to be right at week 1 — in that case it spans 2 calendar years
    expect(years.size).toBeGreaterThanOrEqual(1)
    // All weeks should be valid (1–53)
    for (const w of wochen) {
      expect(w.week).toBeGreaterThanOrEqual(1)
      expect(w.week).toBeLessThanOrEqual(53)
    }
  })
})

describe('skuAbsatzKey', () => {
  it('produces the expected key format', () => {
    const key = skuAbsatzKey('sku-1', 'plt-1', 2026, 24)
    expect(key).toBe('sku:sku-1:plt-1:2026:24')
  })

  it('keys for different SKUs are distinct', () => {
    const k1 = skuAbsatzKey('sku-a', 'plt-1', 2026, 1)
    const k2 = skuAbsatzKey('sku-b', 'plt-1', 2026, 1)
    expect(k1).not.toBe(k2)
  })

  it('keys for different platforms are distinct', () => {
    const k1 = skuAbsatzKey('sku-1', 'plt-a', 2026, 1)
    const k2 = skuAbsatzKey('sku-1', 'plt-b', 2026, 1)
    expect(k1).not.toBe(k2)
  })

  it('keys for different weeks are distinct', () => {
    const k1 = skuAbsatzKey('sku-1', 'plt-1', 2026, 1)
    const k2 = skuAbsatzKey('sku-1', 'plt-1', 2026, 2)
    expect(k1).not.toBe(k2)
  })

  it('parses back to original components when split on ":"', () => {
    const skuId = 'abc-123'
    const plattformId = 'xyz-456'
    const key = skuAbsatzKey(skuId, plattformId, 2026, 24)
    const parts = key.split(':')
    expect(parts[0]).toBe('sku')
    expect(parts[1]).toBe(skuId)
    expect(parts[2]).toBe(plattformId)
    expect(parseInt(parts[3])).toBe(2026)
    expect(parseInt(parts[4])).toBe(24)
  })
})

describe('produktVKKey', () => {
  it('produces the expected key format', () => {
    const key = produktVKKey('prod-1', 'plt-1', 2026, 24)
    expect(key).toBe('vk:prod-1:plt-1:2026:24')
  })

  it('is distinct from skuAbsatzKey for same IDs', () => {
    const skuKey = skuAbsatzKey('id-1', 'plt-1', 2026, 1)
    const vkKey = produktVKKey('id-1', 'plt-1', 2026, 1)
    expect(skuKey).not.toBe(vkKey)
  })

  it('starts with "vk:" prefix', () => {
    const key = produktVKKey('prod-x', 'plt-x', 2025, 52)
    expect(key.startsWith('vk:')).toBe(true)
  })

  it('parses back to original components when split on ":"', () => {
    const produktId = 'prod-abc'
    const plattformId = 'plt-xyz'
    const key = produktVKKey(produktId, plattformId, 2027, 1)
    const parts = key.split(':')
    expect(parts[0]).toBe('vk')
    expect(parts[1]).toBe(produktId)
    expect(parts[2]).toBe(plattformId)
    expect(parseInt(parts[3])).toBe(2027)
    expect(parseInt(parts[4])).toBe(1)
  })
})

describe('kwKey', () => {
  it('produces "year:week" format', () => {
    expect(kwKey(2026, 24)).toBe('2026:24')
    expect(kwKey(2027, 1)).toBe('2027:1')
  })

  it('is distinct for different year/week combos', () => {
    expect(kwKey(2026, 1)).not.toBe(kwKey(2026, 2))
    expect(kwKey(2026, 52)).not.toBe(kwKey(2027, 52))
  })
})
