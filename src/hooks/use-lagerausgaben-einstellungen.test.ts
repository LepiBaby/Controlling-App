import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, act, waitFor } from '@testing-library/react'
import { useLagerausgabenEinstellungen } from './use-lagerausgaben-einstellungen'

const PLATTFORM_ID = '11111111-1111-1111-8111-111111111111'
const PRODUKT_A    = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'
const PRODUKT_B    = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb'

const MOCK_ENTRIES = [
  {
    id: 'entry-1',
    sales_plattform_id: PLATTFORM_ID,
    produkt_id: PRODUKT_A,
    lagerkosten_euro_m3: 2.5,
  },
]

beforeEach(() => {
  vi.restoreAllMocks()
})

// ─── getEinstellung ───────────────────────────────────────────────────────────

describe('getEinstellung', () => {
  it('returns entry from state when produkt exists', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
      new Response(JSON.stringify(MOCK_ENTRIES), { status: 200 })
    )
    const { result } = renderHook(() => useLagerausgabenEinstellungen(PLATTFORM_ID))
    await waitFor(() => expect(result.current.loading).toBe(false))
    const entry = result.current.getEinstellung(PRODUKT_A)
    expect(entry.lagerkosten_euro_m3).toBe(2.5)
    expect(entry.produkt_id).toBe(PRODUKT_A)
  })

  it('returns default with null when produkt not found', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
      new Response(JSON.stringify(MOCK_ENTRIES), { status: 200 })
    )
    const { result } = renderHook(() => useLagerausgabenEinstellungen(PLATTFORM_ID))
    await waitFor(() => expect(result.current.loading).toBe(false))
    const entry = result.current.getEinstellung(PRODUKT_B)
    expect(entry.lagerkosten_euro_m3).toBeNull()
    expect(entry.sales_plattform_id).toBe(PLATTFORM_ID)
    expect(entry.produkt_id).toBe(PRODUKT_B)
  })

  it('returns empty-plattform default when plattformId is null', () => {
    const { result } = renderHook(() => useLagerausgabenEinstellungen(null))
    const entry = result.current.getEinstellung(PRODUKT_A)
    expect(entry.sales_plattform_id).toBe('')
    expect(entry.produkt_id).toBe(PRODUKT_A)
    expect(entry.lagerkosten_euro_m3).toBeNull()
  })
})

// ─── Loading & Error States ───────────────────────────────────────────────────

describe('loading / error', () => {
  it('starts loading when plattformId is provided', () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
      new Response(JSON.stringify([]), { status: 200 })
    )
    const { result } = renderHook(() => useLagerausgabenEinstellungen(PLATTFORM_ID))
    expect(result.current.loading).toBe(true)
  })

  it('sets error state on API failure', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
      new Response('error', { status: 500 })
    )
    const { result } = renderHook(() => useLagerausgabenEinstellungen(PLATTFORM_ID))
    await waitFor(() => expect(result.current.loading).toBe(false))
    expect(result.current.error).toBeTruthy()
  })

  it('does not fetch when plattformId is null', () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch')
    renderHook(() => useLagerausgabenEinstellungen(null))
    expect(fetchSpy).not.toHaveBeenCalled()
  })
})

// ─── Optimistic Update (single upsert) ───────────────────────────────────────

describe('upsert optimistic update', () => {
  it('applies optimistic update before fetch completes', async () => {
    vi.spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce(new Response(JSON.stringify(MOCK_ENTRIES), { status: 200 }))
      .mockImplementationOnce(
        () =>
          new Promise(resolve =>
            setTimeout(
              () => resolve(new Response(JSON.stringify({}), { status: 200 })),
              100
            )
          )
      )

    const { result } = renderHook(() => useLagerausgabenEinstellungen(PLATTFORM_ID))
    await waitFor(() => expect(result.current.loading).toBe(false))

    act(() => {
      result.current.upsert({
        sales_plattform_id: PLATTFORM_ID,
        produkt_id: PRODUKT_A,
        lagerkosten_euro_m3: 9.99,
      })
    })

    expect(result.current.getEinstellung(PRODUKT_A).lagerkosten_euro_m3).toBe(9.99)
  })

  it('rolls back on API error', async () => {
    vi.spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce(new Response(JSON.stringify(MOCK_ENTRIES), { status: 200 }))
      .mockResolvedValueOnce(new Response('error', { status: 500 }))

    const { result } = renderHook(() => useLagerausgabenEinstellungen(PLATTFORM_ID))
    await waitFor(() => expect(result.current.loading).toBe(false))

    await act(async () => {
      await result.current
        .upsert({
          sales_plattform_id: PLATTFORM_ID,
          produkt_id: PRODUKT_A,
          lagerkosten_euro_m3: 999,
        })
        .catch(() => {})
    })

    expect(result.current.getEinstellung(PRODUKT_A).lagerkosten_euro_m3).toBe(2.5)
  })

  it('adds new entry optimistically for previously unseen produkt', async () => {
    vi.spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce(new Response(JSON.stringify(MOCK_ENTRIES), { status: 200 }))
      .mockImplementationOnce(
        () =>
          new Promise(resolve =>
            setTimeout(
              () => resolve(new Response(JSON.stringify({}), { status: 200 })),
              100
            )
          )
      )

    const { result } = renderHook(() => useLagerausgabenEinstellungen(PLATTFORM_ID))
    await waitFor(() => expect(result.current.loading).toBe(false))

    act(() => {
      result.current.upsert({
        sales_plattform_id: PLATTFORM_ID,
        produkt_id: PRODUKT_B,
        lagerkosten_euro_m3: 5.0,
      })
    })

    expect(result.current.getEinstellung(PRODUKT_B).lagerkosten_euro_m3).toBe(5.0)
  })
})

// ─── Batch Upsert ────────────────────────────────────────────────────────────

describe('batchUpsert', () => {
  it('applies optimistic update to all given produkt_ids', async () => {
    vi.spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce(new Response(JSON.stringify(MOCK_ENTRIES), { status: 200 }))
      .mockImplementationOnce(
        () =>
          new Promise(resolve =>
            setTimeout(
              () => resolve(new Response(JSON.stringify([]), { status: 200 })),
              100
            )
          )
      )

    const { result } = renderHook(() => useLagerausgabenEinstellungen(PLATTFORM_ID))
    await waitFor(() => expect(result.current.loading).toBe(false))

    act(() => {
      result.current.batchUpsert(PLATTFORM_ID, 7.0, [PRODUKT_A, PRODUKT_B])
    })

    expect(result.current.getEinstellung(PRODUKT_A).lagerkosten_euro_m3).toBe(7.0)
    expect(result.current.getEinstellung(PRODUKT_B).lagerkosten_euro_m3).toBe(7.0)
  })

  it('rolls back all entries on API error', async () => {
    vi.spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce(new Response(JSON.stringify(MOCK_ENTRIES), { status: 200 }))
      .mockResolvedValueOnce(new Response('error', { status: 500 }))

    const { result } = renderHook(() => useLagerausgabenEinstellungen(PLATTFORM_ID))
    await waitFor(() => expect(result.current.loading).toBe(false))

    await act(async () => {
      await result.current
        .batchUpsert(PLATTFORM_ID, 999, [PRODUKT_A, PRODUKT_B])
        .catch(() => {})
    })

    // PRODUKT_A should revert to original value
    expect(result.current.getEinstellung(PRODUKT_A).lagerkosten_euro_m3).toBe(2.5)
    // PRODUKT_B had no entry before — should revert to null
    expect(result.current.getEinstellung(PRODUKT_B).lagerkosten_euro_m3).toBeNull()
  })

  it('updates state from server response after successful batch', async () => {
    const serverResponse = [
      { id: 'e1', sales_plattform_id: PLATTFORM_ID, produkt_id: PRODUKT_A, lagerkosten_euro_m3: 4.0 },
      { id: 'e2', sales_plattform_id: PLATTFORM_ID, produkt_id: PRODUKT_B, lagerkosten_euro_m3: 4.0 },
    ]

    vi.spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce(new Response(JSON.stringify(MOCK_ENTRIES), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify(serverResponse), { status: 200 }))

    const { result } = renderHook(() => useLagerausgabenEinstellungen(PLATTFORM_ID))
    await waitFor(() => expect(result.current.loading).toBe(false))

    await act(async () => {
      await result.current.batchUpsert(PLATTFORM_ID, 4.0, [PRODUKT_A, PRODUKT_B])
    })

    expect(result.current.getEinstellung(PRODUKT_A).lagerkosten_euro_m3).toBe(4.0)
    expect(result.current.getEinstellung(PRODUKT_B).lagerkosten_euro_m3).toBe(4.0)
  })
})
