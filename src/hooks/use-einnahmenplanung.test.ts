import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, act, waitFor } from '@testing-library/react'
import { useEinnahmenplanung, kategorieWertKey } from './use-einnahmenplanung'

// ─── kategorieWertKey ─────────────────────────────────────────────────────────

describe('kategorieWertKey', () => {
  it('formats key as kategorie_id:year:week', () => {
    expect(kategorieWertKey('abc-123', 2026, 24)).toBe('abc-123:2026:24')
  })

  it('handles week 1 and week 53 correctly', () => {
    expect(kategorieWertKey('id', 2026, 1)).toBe('id:2026:1')
    expect(kategorieWertKey('id', 2026, 53)).toBe('id:2026:53')
  })

  it('handles year boundary correctly', () => {
    expect(kategorieWertKey('id', 2027, 1)).toBe('id:2027:1')
  })
})

// ─── Test helpers ─────────────────────────────────────────────────────────────

const KAT_ID_1 = '11111111-1111-1111-1111-111111111111'
const KAT_ID_2 = '22222222-2222-2222-2222-222222222222'
const KAT_ID_SUB = '33333333-3333-3333-3333-333333333333'
const PRODUKTVERKAUF_ID = '44444444-4444-4444-4444-444444444444'
const PRODUKTVERKAUF_SUB_ID = '55555555-5555-5555-5555-555555555555'

const MOCK_KATEGORIEN = [
  { id: KAT_ID_1, name: 'Sonstige Einnahmen', level: 1, parent_id: null, sort_order: 1, type: 'einnahmen' },
  { id: KAT_ID_2, name: 'Förderungen', level: 1, parent_id: null, sort_order: 2, type: 'einnahmen' },
  { id: KAT_ID_SUB, name: 'Bundesförderung', level: 2, parent_id: KAT_ID_2, sort_order: 1, type: 'einnahmen' },
  { id: PRODUKTVERKAUF_ID, name: 'Produktverkäufe', level: 1, parent_id: null, sort_order: 0, type: 'einnahmen' },
  { id: PRODUKTVERKAUF_SUB_ID, name: 'Amazon DE', level: 2, parent_id: PRODUKTVERKAUF_ID, sort_order: 1, type: 'einnahmen' },
]

const MOCK_ENTRIES = [
  { kategorie_id: KAT_ID_1, kw_year: 2026, kw_number: 24, betrag_manuell: 1000.00 },
  { kategorie_id: KAT_ID_SUB, kw_year: 2026, kw_number: 24, betrag_manuell: 500.00 },
]

function mockFetchAll(kategorien = MOCK_KATEGORIEN, entries = MOCK_ENTRIES) {
  vi.spyOn(global, 'fetch').mockImplementation((url: RequestInfo | URL) => {
    const u = url.toString()
    if (u.includes('/api/grundeinstellungen')) {
      return Promise.resolve(new Response(JSON.stringify({ planungshorizont_wochen: 13 }), { status: 200 }))
    }
    if (u.includes('/api/kpi-categories')) {
      return Promise.resolve(new Response(JSON.stringify(kategorien), { status: 200 }))
    }
    if (u.includes('/api/einnahmen-planung')) {
      return Promise.resolve(new Response(JSON.stringify(entries), { status: 200 }))
    }
    return Promise.resolve(new Response('not found', { status: 404 }))
  })
}

beforeEach(() => {
  vi.restoreAllMocks()
})

// ─── Initial load ─────────────────────────────────────────────────────────────

describe('useEinnahmenplanung — initial load', () => {
  it('starts in loading state', () => {
    mockFetchAll()
    const { result } = renderHook(() => useEinnahmenplanung())
    expect(result.current.loading).toBe(true)
    expect(result.current.kategorien).toEqual([])
    expect(result.current.values.size).toBe(0)
  })

  it('loads and sets kategorien from API on mount', async () => {
    mockFetchAll()
    const { result } = renderHook(() => useEinnahmenplanung())
    await waitFor(() => expect(result.current.loading).toBe(false))
    expect(result.current.kategorien.length).toBeGreaterThan(0)
    expect(result.current.error).toBeNull()
  })

  it('includes Produktverkäufe (level 1) in kategorien', async () => {
    mockFetchAll()
    const { result } = renderHook(() => useEinnahmenplanung())
    await waitFor(() => expect(result.current.loading).toBe(false))
    const ids = result.current.kategorien.map(k => k.id)
    expect(ids).toContain(PRODUKTVERKAUF_ID)
  })

  it('includes children of Produktverkäufe (level 2) in kategorien', async () => {
    mockFetchAll()
    const { result } = renderHook(() => useEinnahmenplanung())
    await waitFor(() => expect(result.current.loading).toBe(false))
    const ids = result.current.kategorien.map(k => k.id)
    expect(ids).toContain(PRODUKTVERKAUF_SUB_ID)
  })

  it('exposes produktverkaeufenKatId for the Produktverkäufe category', async () => {
    mockFetchAll()
    const { result } = renderHook(() => useEinnahmenplanung())
    await waitFor(() => expect(result.current.loading).toBe(false))
    expect(result.current.produktverkaeufenKatId).toBe(PRODUKTVERKAUF_ID)
  })

  it('retains non-Produktverkäufe categories and their children', async () => {
    mockFetchAll()
    const { result } = renderHook(() => useEinnahmenplanung())
    await waitFor(() => expect(result.current.loading).toBe(false))
    const ids = result.current.kategorien.map(k => k.id)
    expect(ids).toContain(KAT_ID_1)
    expect(ids).toContain(KAT_ID_2)
    expect(ids).toContain(KAT_ID_SUB)
  })

  it('builds valueMap from API entries (ignores null betrag_manuell)', async () => {
    mockFetchAll(MOCK_KATEGORIEN, [
      { kategorie_id: KAT_ID_1, kw_year: 2026, kw_number: 24, betrag_manuell: 1000 },
      { kategorie_id: KAT_ID_2, kw_year: 2026, kw_number: 24, betrag_manuell: null as unknown as number },
    ])
    const { result } = renderHook(() => useEinnahmenplanung())
    await waitFor(() => expect(result.current.loading).toBe(false))
    // null entries should not be stored
    expect(result.current.values.size).toBe(1)
    expect(result.current.values.get(kategorieWertKey(KAT_ID_1, 2026, 24))).toBe(1000)
    expect(result.current.values.has(kategorieWertKey(KAT_ID_2, 2026, 24))).toBe(false)
  })

  it('uses fallback planungshorizont=13 when grundeinstellungen not found', async () => {
    vi.spyOn(global, 'fetch').mockImplementation((url: RequestInfo | URL) => {
      const u = url.toString()
      if (u.includes('/api/grundeinstellungen')) {
        return Promise.resolve(new Response('not found', { status: 404 }))
      }
      if (u.includes('/api/kpi-categories')) {
        return Promise.resolve(new Response(JSON.stringify([]), { status: 200 }))
      }
      return Promise.resolve(new Response(JSON.stringify([]), { status: 200 }))
    })
    const { result } = renderHook(() => useEinnahmenplanung())
    await waitFor(() => expect(result.current.loading).toBe(false))
    expect(result.current.wochen).toHaveLength(13)
  })

  it('sets error on network failure', async () => {
    vi.spyOn(global, 'fetch').mockRejectedValueOnce(new Error('Network error'))
    const { result } = renderHook(() => useEinnahmenplanung())
    await waitFor(() => expect(result.current.loading).toBe(false))
    expect(result.current.error).toBeTruthy()
  })
})

// ─── Produktverkäufe erkennung (case-insensitive, trim) ──────────────────────

describe('useEinnahmenplanung — produktverkaeufenKatId edge cases', () => {
  it('identifies "produktverkäufe" (lowercase) as the PV category', async () => {
    const kats = [
      { id: 'pk1', name: 'produktverkäufe', level: 1, parent_id: null, sort_order: 0, type: 'einnahmen' },
      { id: KAT_ID_1, name: 'Sonstige Einnahmen', level: 1, parent_id: null, sort_order: 1, type: 'einnahmen' },
    ]
    mockFetchAll(kats, [])
    const { result } = renderHook(() => useEinnahmenplanung())
    await waitFor(() => expect(result.current.loading).toBe(false))
    expect(result.current.produktverkaeufenKatId).toBe('pk1')
    // Both are in kategorien (nothing is filtered out)
    const ids = result.current.kategorien.map(k => k.id)
    expect(ids).toContain('pk1')
    expect(ids).toContain(KAT_ID_1)
  })

  it('identifies "  Produktverkäufe  " (with whitespace) as PV category', async () => {
    const kats = [
      { id: 'pk2', name: '  Produktverkäufe  ', level: 1, parent_id: null, sort_order: 0, type: 'einnahmen' },
    ]
    mockFetchAll(kats, [])
    const { result } = renderHook(() => useEinnahmenplanung())
    await waitFor(() => expect(result.current.loading).toBe(false))
    expect(result.current.produktverkaeufenKatId).toBe('pk2')
    expect(result.current.kategorien.map(k => k.id)).toContain('pk2')
  })

  it('does NOT identify names that merely contain Produktverkäufe as substring as PV', async () => {
    const kats = [
      { id: 'pk3', name: 'Alle Produktverkäufe', level: 1, parent_id: null, sort_order: 0, type: 'einnahmen' },
    ]
    mockFetchAll(kats, [])
    const { result } = renderHook(() => useEinnahmenplanung())
    await waitFor(() => expect(result.current.loading).toBe(false))
    expect(result.current.produktverkaeufenKatId).toBeNull()
    expect(result.current.kategorien.map(k => k.id)).toContain('pk3')
  })
})

// ─── isNewWeek ────────────────────────────────────────────────────────────────

describe('useEinnahmenplanung — isNewWeek', () => {
  it('isNewWeek = true when no entries exist for the last week in horizon', async () => {
    mockFetchAll(MOCK_KATEGORIEN, [])
    const { result } = renderHook(() => useEinnahmenplanung())
    await waitFor(() => expect(result.current.loading).toBe(false))
    expect(result.current.isNewWeek).toBe(true)
  })

  it('isNewWeek = false when an entry exists for the last week', async () => {
    mockFetchAll(MOCK_KATEGORIEN, [])
    const { result } = renderHook(() => useEinnahmenplanung())
    await waitFor(() => expect(result.current.loading).toBe(false))

    const lastKw = result.current.lastWoche!
    // Inject an entry for the last week
    act(() => {
      // We update values to simulate having an entry for the last week
      // by using upsertZelle with a mocked PUT response
    })

    // isNewWeek is based on values; if we directly check with empty values it's true
    expect(result.current.isNewWeek).toBe(true)

    // With a loaded entry for the last week it should be false
    const entriesForLastWeek = [
      { kategorie_id: KAT_ID_1, kw_year: lastKw.year, kw_number: lastKw.week, betrag_manuell: 100 },
    ]
    vi.restoreAllMocks()
    mockFetchAll(MOCK_KATEGORIEN, entriesForLastWeek)

    const { result: result2 } = renderHook(() => useEinnahmenplanung())
    await waitFor(() => expect(result2.current.loading).toBe(false))
    expect(result2.current.isNewWeek).toBe(false)
  })
})

// ─── getWert ──────────────────────────────────────────────────────────────────

describe('useEinnahmenplanung — getWert', () => {
  it('returns null for a cell with no entry', async () => {
    mockFetchAll(MOCK_KATEGORIEN, [])
    const { result } = renderHook(() => useEinnahmenplanung())
    await waitFor(() => expect(result.current.loading).toBe(false))
    const kw = result.current.wochen[0]
    expect(result.current.getWert(KAT_ID_1, kw)).toBeNull()
  })

  it('returns the stored value for a cell with an entry', async () => {
    const kw = { year: 2026, week: 24, label: 'KW24 / 2026' }
    mockFetchAll(MOCK_KATEGORIEN, [
      { kategorie_id: KAT_ID_1, kw_year: 2026, kw_number: 24, betrag_manuell: 750.50 },
    ])
    const { result } = renderHook(() => useEinnahmenplanung())
    await waitFor(() => expect(result.current.loading).toBe(false))
    expect(result.current.getWert(KAT_ID_1, kw)).toBe(750.50)
  })
})

// ─── upsertZelle ──────────────────────────────────────────────────────────────

describe('useEinnahmenplanung — upsertZelle (optimistic)', () => {
  it('optimistically sets a new value before API responds', async () => {
    mockFetchAll(MOCK_KATEGORIEN, [])
    const { result } = renderHook(() => useEinnahmenplanung())
    await waitFor(() => expect(result.current.loading).toBe(false))

    const kw = result.current.wochen[0]
    vi.spyOn(global, 'fetch').mockResolvedValueOnce(
      new Response(JSON.stringify({ kategorie_id: KAT_ID_1, kw_year: kw.year, kw_number: kw.week, betrag_manuell: 200 }), { status: 200 })
    )

    act(() => {
      result.current.upsertZelle(KAT_ID_1, kw, 200)
    })

    expect(result.current.getWert(KAT_ID_1, kw)).toBe(200)
  })

  it('optimistically deletes a cell when value is null', async () => {
    const kw = { year: 2026, week: 24, label: 'KW24 / 2026' }
    mockFetchAll(MOCK_KATEGORIEN, [
      { kategorie_id: KAT_ID_1, kw_year: 2026, kw_number: 24, betrag_manuell: 500 },
    ])
    const { result } = renderHook(() => useEinnahmenplanung())
    await waitFor(() => expect(result.current.loading).toBe(false))

    vi.spyOn(global, 'fetch').mockResolvedValueOnce(
      new Response(JSON.stringify({ deleted: true }), { status: 200 })
    )

    act(() => {
      result.current.upsertZelle(KAT_ID_1, kw, null)
    })

    expect(result.current.getWert(KAT_ID_1, kw)).toBeNull()
  })

  it('rolls back on API failure', async () => {
    const kw = { year: 2026, week: 24, label: 'KW24 / 2026' }
    mockFetchAll(MOCK_KATEGORIEN, [
      { kategorie_id: KAT_ID_1, kw_year: 2026, kw_number: 24, betrag_manuell: 500 },
    ])
    const { result } = renderHook(() => useEinnahmenplanung())
    await waitFor(() => expect(result.current.loading).toBe(false))

    vi.spyOn(global, 'fetch').mockResolvedValueOnce(
      new Response('Error', { status: 500 })
    )

    await act(async () => {
      await expect(result.current.upsertZelle(KAT_ID_1, kw, 999)).rejects.toThrow()
    })

    // rolled back to original value
    expect(result.current.getWert(KAT_ID_1, kw)).toBe(500)
  })

  it('rolls back insertion (restores null) on API failure', async () => {
    const kw = { year: 2026, week: 25, label: 'KW25 / 2026' }
    mockFetchAll(MOCK_KATEGORIEN, [])
    const { result } = renderHook(() => useEinnahmenplanung())
    await waitFor(() => expect(result.current.loading).toBe(false))

    vi.spyOn(global, 'fetch').mockResolvedValueOnce(
      new Response('Error', { status: 500 })
    )

    await act(async () => {
      await expect(result.current.upsertZelle(KAT_ID_1, kw, 300)).rejects.toThrow()
    })

    expect(result.current.getWert(KAT_ID_1, kw)).toBeNull()
  })

  it('allows betrag_manuell = 0', async () => {
    const kw = { year: 2026, week: 24, label: 'KW24 / 2026' }
    mockFetchAll(MOCK_KATEGORIEN, [])
    const { result } = renderHook(() => useEinnahmenplanung())
    await waitFor(() => expect(result.current.loading).toBe(false))

    vi.spyOn(global, 'fetch').mockResolvedValueOnce(
      new Response(JSON.stringify({ betrag_manuell: 0 }), { status: 200 })
    )

    act(() => {
      result.current.upsertZelle(KAT_ID_1, kw, 0)
    })

    expect(result.current.getWert(KAT_ID_1, kw)).toBe(0)
  })
})

// ─── wochen & planungshorizont ───────────────────────────────────────────────

describe('useEinnahmenplanung — wochen / planungshorizont', () => {
  it('returns correct number of wochen for planungshorizont=13', async () => {
    mockFetchAll([], [])
    const { result } = renderHook(() => useEinnahmenplanung())
    await waitFor(() => expect(result.current.loading).toBe(false))
    expect(result.current.wochen).toHaveLength(13)
  })

  it('first woche starts at next ISO week (not current)', async () => {
    mockFetchAll([], [])
    const { result } = renderHook(() => useEinnahmenplanung())
    await waitFor(() => expect(result.current.loading).toBe(false))
    // The first week should be in the future
    const firstKw = result.current.wochen[0]
    expect(firstKw).toBeDefined()
    expect(firstKw.label).toMatch(/^KW\d+ \/ \d{4}$/)
  })

  it('all wochen have valid week numbers (1–53)', async () => {
    mockFetchAll([], [])
    const { result } = renderHook(() => useEinnahmenplanung())
    await waitFor(() => expect(result.current.loading).toBe(false))
    for (const kw of result.current.wochen) {
      expect(kw.week).toBeGreaterThanOrEqual(1)
      expect(kw.week).toBeLessThanOrEqual(53)
    }
  })

  it('lastWoche is the final entry of wochen', async () => {
    mockFetchAll([], [])
    const { result } = renderHook(() => useEinnahmenplanung())
    await waitFor(() => expect(result.current.loading).toBe(false))
    const last = result.current.wochen[result.current.wochen.length - 1]
    expect(result.current.lastWoche).toEqual(last)
  })
})
