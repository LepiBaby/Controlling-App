import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, act, waitFor } from '@testing-library/react'
import { useVersandausgabenEinstellungen } from './use-versandausgaben-einstellungen'

const PLATTFORM_ID = '11111111-1111-1111-8111-111111111111'
const PRODUKT_A = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'
const PRODUKT_B = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb'

const MOCK_ENTRIES = [
  {
    id: 'entry-1',
    sales_plattform_id: PLATTFORM_ID,
    produkt_id: PRODUKT_A,
    versandgebuehr_spediteur: 3.5,
    versandgebuehr_3pl: 1.5,
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
    const { result } = renderHook(() => useVersandausgabenEinstellungen(PLATTFORM_ID))
    await waitFor(() => expect(result.current.loading).toBe(false))
    const entry = result.current.getEinstellung(PRODUKT_A)
    expect(entry.versandgebuehr_spediteur).toBe(3.5)
    expect(entry.versandgebuehr_3pl).toBe(1.5)
    expect(entry.produkt_id).toBe(PRODUKT_A)
  })

  it('returns default with null fields when produkt not found', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
      new Response(JSON.stringify(MOCK_ENTRIES), { status: 200 })
    )
    const { result } = renderHook(() => useVersandausgabenEinstellungen(PLATTFORM_ID))
    await waitFor(() => expect(result.current.loading).toBe(false))
    const entry = result.current.getEinstellung(PRODUKT_B)
    expect(entry.versandgebuehr_spediteur).toBeNull()
    expect(entry.versandgebuehr_3pl).toBeNull()
    expect(entry.sales_plattform_id).toBe(PLATTFORM_ID)
    expect(entry.produkt_id).toBe(PRODUKT_B)
  })

  it('returns empty-plattform default when plattformId is null', () => {
    const { result } = renderHook(() => useVersandausgabenEinstellungen(null))
    const entry = result.current.getEinstellung(PRODUKT_A)
    expect(entry.sales_plattform_id).toBe('')
    expect(entry.produkt_id).toBe(PRODUKT_A)
    expect(entry.versandgebuehr_spediteur).toBeNull()
    expect(entry.versandgebuehr_3pl).toBeNull()
  })
})

// ─── Loading & Error States ───────────────────────────────────────────────────

describe('loading / error', () => {
  it('starts loading when plattformId is provided', () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
      new Response(JSON.stringify([]), { status: 200 })
    )
    const { result } = renderHook(() => useVersandausgabenEinstellungen(PLATTFORM_ID))
    expect(result.current.loading).toBe(true)
  })

  it('sets error state on API failure', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
      new Response('error', { status: 500 })
    )
    const { result } = renderHook(() => useVersandausgabenEinstellungen(PLATTFORM_ID))
    await waitFor(() => expect(result.current.loading).toBe(false))
    expect(result.current.error).toBeTruthy()
  })

  it('does not fetch when plattformId is null', () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch')
    renderHook(() => useVersandausgabenEinstellungen(null))
    expect(fetchSpy).not.toHaveBeenCalled()
  })
})

// ─── Optimistic Update (upsert) ───────────────────────────────────────────────

describe('upsert optimistic update', () => {
  it('applies optimistic update before fetch completes', async () => {
    vi.spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce(new Response(JSON.stringify(MOCK_ENTRIES), { status: 200 }))
      .mockImplementationOnce(
        () => new Promise(resolve => setTimeout(() => resolve(new Response(JSON.stringify({}), { status: 200 })), 100))
      )

    const { result } = renderHook(() => useVersandausgabenEinstellungen(PLATTFORM_ID))
    await waitFor(() => expect(result.current.loading).toBe(false))

    act(() => {
      result.current.upsert({
        sales_plattform_id: PLATTFORM_ID,
        produkt_id: PRODUKT_A,
        versandgebuehr_spediteur: 9.99,
        versandgebuehr_3pl: 1.5,
      })
    })

    expect(result.current.getEinstellung(PRODUKT_A).versandgebuehr_spediteur).toBe(9.99)
  })

  it('rolls back on API error', async () => {
    vi.spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce(new Response(JSON.stringify(MOCK_ENTRIES), { status: 200 }))
      .mockResolvedValueOnce(new Response('error', { status: 500 }))

    const { result } = renderHook(() => useVersandausgabenEinstellungen(PLATTFORM_ID))
    await waitFor(() => expect(result.current.loading).toBe(false))

    await act(async () => {
      await result.current.upsert({
        sales_plattform_id: PLATTFORM_ID,
        produkt_id: PRODUKT_A,
        versandgebuehr_spediteur: 999,
        versandgebuehr_3pl: 999,
      }).catch(() => {})
    })

    expect(result.current.getEinstellung(PRODUKT_A).versandgebuehr_spediteur).toBe(3.5)
  })
})
