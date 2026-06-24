import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, act, waitFor } from '@testing-library/react'
import {
  useMarketingEinstellungen,
  isGewichtet,
  BERECHNUNGSART_LABELS,
  BERECHNUNGSARTEN,
  type Berechnungsart,
} from './use-marketing-einstellungen'

// ─── isGewichtet ─────────────────────────────────────────────────────────────

describe('isGewichtet', () => {
  it('returns true for gewichtet_30', () => expect(isGewichtet('gewichtet_30')).toBe(true))
  it('returns true for gewichtet_60', () => expect(isGewichtet('gewichtet_60')).toBe(true))
  it('returns true for gewichtet_90', () => expect(isGewichtet('gewichtet_90')).toBe(true))
  it('returns false for mittelwert_30', () => expect(isGewichtet('mittelwert_30')).toBe(false))
  it('returns false for mittelwert_90', () => expect(isGewichtet('mittelwert_90')).toBe(false))
  it('returns false for keine', () => expect(isGewichtet('keine')).toBe(false))
})

// ─── BERECHNUNGSARTEN ─────────────────────────────────────────────────────────

describe('BERECHNUNGSARTEN', () => {
  it('contains exactly 9 entries', () => expect(BERECHNUNGSARTEN).toHaveLength(9))
  it('has a label for every entry', () => {
    BERECHNUNGSARTEN.forEach(art => {
      expect(BERECHNUNGSART_LABELS[art]).toBeDefined()
      expect(BERECHNUNGSART_LABELS[art].length).toBeGreaterThan(0)
    })
  })
})

// ─── useMarketingEinstellungen ────────────────────────────────────────────────

const KATEGORIE_ID = 'p1'
const PRODUKT_ID   = 'prod1'

const MOCK_EINSTELLUNG = {
  id: 'e1',
  kategorie_id: KATEGORIE_ID,
  produkt_id: PRODUKT_ID,
  berechnungsart: 'mittelwert_30' as Berechnungsart,
  gewichtung_erstes_drittel: null,
  gewichtung_zweites_drittel: null,
  gewichtung_drittes_drittel: null,
}

beforeEach(() => {
  vi.restoreAllMocks()
})

describe('useMarketingEinstellungen — initial load', () => {
  it('starts in loading state', () => {
    vi.spyOn(global, 'fetch').mockResolvedValueOnce(
      new Response(JSON.stringify([MOCK_EINSTELLUNG]), { status: 200 })
    )
    const { result } = renderHook(() => useMarketingEinstellungen(KATEGORIE_ID))
    expect(result.current.loading).toBe(true)
    expect(result.current.einstellungen).toEqual([])
  })

  it('loads einstellungen from API on mount', async () => {
    vi.spyOn(global, 'fetch').mockResolvedValueOnce(
      new Response(JSON.stringify([MOCK_EINSTELLUNG]), { status: 200 })
    )
    const { result } = renderHook(() => useMarketingEinstellungen(KATEGORIE_ID))
    await waitFor(() => expect(result.current.loading).toBe(false))
    expect(result.current.einstellungen).toHaveLength(1)
    expect(result.current.einstellungen[0].berechnungsart).toBe('mittelwert_30')
  })

  it('returns empty array and no error when API returns []', async () => {
    vi.spyOn(global, 'fetch').mockResolvedValueOnce(
      new Response(JSON.stringify([]), { status: 200 })
    )
    const { result } = renderHook(() => useMarketingEinstellungen(KATEGORIE_ID))
    await waitFor(() => expect(result.current.loading).toBe(false))
    expect(result.current.einstellungen).toEqual([])
    expect(result.current.error).toBeNull()
  })

  it('sets error when API fails', async () => {
    vi.spyOn(global, 'fetch').mockResolvedValueOnce(
      new Response('Internal Server Error', { status: 500 })
    )
    const { result } = renderHook(() => useMarketingEinstellungen(KATEGORIE_ID))
    await waitFor(() => expect(result.current.loading).toBe(false))
    expect(result.current.error).toBeTruthy()
    expect(result.current.einstellungen).toEqual([])
  })

  it('sets error when fetch throws (network failure)', async () => {
    vi.spyOn(global, 'fetch').mockRejectedValueOnce(new Error('Network error'))
    const { result } = renderHook(() => useMarketingEinstellungen(KATEGORIE_ID))
    await waitFor(() => expect(result.current.loading).toBe(false))
    expect(result.current.error).toBeTruthy()
  })

  it('does not fetch when plattformId is null', () => {
    const fetchSpy = vi.spyOn(global, 'fetch')
    renderHook(() => useMarketingEinstellungen(null))
    expect(fetchSpy).not.toHaveBeenCalled()
  })
})

describe('useMarketingEinstellungen — getEinstellung', () => {
  it('returns loaded einstellung for known produktId', async () => {
    vi.spyOn(global, 'fetch').mockResolvedValueOnce(
      new Response(JSON.stringify([MOCK_EINSTELLUNG]), { status: 200 })
    )
    const { result } = renderHook(() => useMarketingEinstellungen(KATEGORIE_ID))
    await waitFor(() => expect(result.current.loading).toBe(false))
    const e = result.current.getEinstellung(PRODUKT_ID)
    expect(e.berechnungsart).toBe('mittelwert_30')
  })

  it('returns default "keine" for unknown produktId', async () => {
    vi.spyOn(global, 'fetch').mockResolvedValueOnce(
      new Response(JSON.stringify([]), { status: 200 })
    )
    const { result } = renderHook(() => useMarketingEinstellungen(KATEGORIE_ID))
    await waitFor(() => expect(result.current.loading).toBe(false))
    const e = result.current.getEinstellung('unknown-id')
    expect(e.berechnungsart).toBe('keine')
    expect(e.gewichtung_erstes_drittel).toBeNull()
  })

  it('returns default with plattformId set correctly', async () => {
    vi.spyOn(global, 'fetch').mockResolvedValueOnce(
      new Response(JSON.stringify([]), { status: 200 })
    )
    const { result } = renderHook(() => useMarketingEinstellungen(KATEGORIE_ID))
    await waitFor(() => expect(result.current.loading).toBe(false))
    const e = result.current.getEinstellung('new-prod')
    expect(e.kategorie_id).toBe(KATEGORIE_ID)
  })
})

describe('useMarketingEinstellungen — upsert (optimistic)', () => {
  it('optimistically adds new einstellung before API responds', async () => {
    vi.spyOn(global, 'fetch')
      .mockResolvedValueOnce(new Response(JSON.stringify([]), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify(MOCK_EINSTELLUNG), { status: 200 }))

    const { result } = renderHook(() => useMarketingEinstellungen(KATEGORIE_ID))
    await waitFor(() => expect(result.current.loading).toBe(false))

    act(() => {
      result.current.upsert({
        kategorie_id: KATEGORIE_ID,
        produkt_id: PRODUKT_ID,
        berechnungsart: 'mittelwert_30',
        gewichtung_erstes_drittel: null,
        gewichtung_zweites_drittel: null,
        gewichtung_drittes_drittel: null,
      })
    })

    expect(result.current.einstellungen).toHaveLength(1)
    expect(result.current.einstellungen[0].berechnungsart).toBe('mittelwert_30')
  })

  it('optimistically updates existing einstellung', async () => {
    vi.spyOn(global, 'fetch')
      .mockResolvedValueOnce(new Response(JSON.stringify([MOCK_EINSTELLUNG]), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ ...MOCK_EINSTELLUNG, berechnungsart: 'mittelwert_90' }), { status: 200 }))

    const { result } = renderHook(() => useMarketingEinstellungen(KATEGORIE_ID))
    await waitFor(() => expect(result.current.loading).toBe(false))

    act(() => {
      result.current.upsert({ ...MOCK_EINSTELLUNG, berechnungsart: 'mittelwert_90' })
    })

    expect(result.current.einstellungen[0].berechnungsart).toBe('mittelwert_90')
  })

  it('rolls back on API failure for new einstellung', async () => {
    vi.spyOn(global, 'fetch')
      .mockResolvedValueOnce(new Response(JSON.stringify([]), { status: 200 }))
      .mockResolvedValueOnce(new Response('Error', { status: 500 }))

    const { result } = renderHook(() => useMarketingEinstellungen(KATEGORIE_ID))
    await waitFor(() => expect(result.current.loading).toBe(false))

    await act(async () => {
      await expect(
        result.current.upsert({
          kategorie_id: KATEGORIE_ID,
          produkt_id: PRODUKT_ID,
          berechnungsart: 'mittelwert_30',
          gewichtung_erstes_drittel: null,
          gewichtung_zweites_drittel: null,
          gewichtung_drittes_drittel: null,
        })
      ).rejects.toThrow()
    })

    expect(result.current.einstellungen).toHaveLength(0)
  })

  it('rolls back on API failure for existing einstellung', async () => {
    vi.spyOn(global, 'fetch')
      .mockResolvedValueOnce(new Response(JSON.stringify([MOCK_EINSTELLUNG]), { status: 200 }))
      .mockResolvedValueOnce(new Response('Error', { status: 500 }))

    const { result } = renderHook(() => useMarketingEinstellungen(KATEGORIE_ID))
    await waitFor(() => expect(result.current.loading).toBe(false))

    await act(async () => {
      await expect(
        result.current.upsert({ ...MOCK_EINSTELLUNG, berechnungsart: 'mittelwert_90' })
      ).rejects.toThrow()
    })

    expect(result.current.einstellungen[0].berechnungsart).toBe('mittelwert_30')
  })
})
