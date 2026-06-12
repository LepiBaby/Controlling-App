import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook, act, waitFor } from '@testing-library/react'
import { useBestellungKosten } from './use-bestellung-kosten'
import type { BestellungKosten } from './use-bestellung-kosten'

const makeKosten = (overrides: Partial<BestellungKosten> = {}): BestellungKosten => ({
  id: 'k-1',
  kpi_kategorie_id: 'cat-1',
  kpi_kategorie_name: 'Ware',
  datum: '2026-08-01',
  nettobetrag: 500,
  begruendung: 'Test',
  ist_automatisch: true,
  created_at: '2026-06-12T00:00:00Z',
  ...overrides,
})

beforeEach(() => {
  vi.stubGlobal('fetch', vi.fn())
})

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('useBestellungKosten', () => {
  it('does nothing when bestellungId is null', () => {
    const { result } = renderHook(() => useBestellungKosten(null))
    expect(result.current.kosten).toEqual([])
    expect(result.current.loading).toBe(false)
  })

  it('sets loading=true while fetching', async () => {
    let resolveResponse!: (value: Response) => void
    const pending = new Promise<Response>(res => { resolveResponse = res })
    vi.mocked(fetch).mockReturnValueOnce(pending)

    const { result } = renderHook(() => useBestellungKosten('b-1'))
    expect(result.current.loading).toBe(true)

    resolveResponse(new Response(JSON.stringify([]), { status: 200 }))
    await waitFor(() => expect(result.current.loading).toBe(false))
  })

  it('loads kosten on mount', async () => {
    const row = makeKosten()
    vi.mocked(fetch).mockResolvedValueOnce(new Response(JSON.stringify([row]), { status: 200 }))

    const { result } = renderHook(() => useBestellungKosten('b-1'))
    await waitFor(() => expect(result.current.loading).toBe(false))

    expect(result.current.kosten).toHaveLength(1)
    expect(result.current.kosten[0].id).toBe('k-1')
    expect(result.current.kosten[0].kpi_kategorie_name).toBe('Ware')
  })

  it('sets error when fetch fails with non-ok status', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(new Response('', { status: 500 }))

    const { result } = renderHook(() => useBestellungKosten('b-1'))
    await waitFor(() => expect(result.current.loading).toBe(false))

    expect(result.current.error).toBeTruthy()
    expect(result.current.kosten).toEqual([])
  })

  it('sets error on network failure', async () => {
    vi.mocked(fetch).mockRejectedValueOnce(new Error('Network error'))

    const { result } = renderHook(() => useBestellungKosten('b-1'))
    await waitFor(() => expect(result.current.loading).toBe(false))

    expect(result.current.error).toBe('Network error')
  })

  describe('add', () => {
    it('adds entry and sorts by datum', async () => {
      const existing = makeKosten({ id: 'k-2', datum: '2026-09-01', nettobetrag: 300 })
      vi.mocked(fetch)
        .mockResolvedValueOnce(new Response(JSON.stringify([existing]), { status: 200 }))

      const { result } = renderHook(() => useBestellungKosten('b-1'))
      await waitFor(() => expect(result.current.loading).toBe(false))

      const newEntry = makeKosten({ id: 'k-new', datum: '2026-07-15', nettobetrag: 100 })
      vi.mocked(fetch).mockResolvedValueOnce(new Response(JSON.stringify(newEntry), { status: 201 }))

      await act(async () => {
        await result.current.add({ datum: '2026-07-15', nettobetrag: 100 })
      })

      expect(result.current.kosten).toHaveLength(2)
      // Sorted: July before September
      expect(result.current.kosten[0].datum).toBe('2026-07-15')
      expect(result.current.kosten[1].datum).toBe('2026-09-01')
    })

    it('throws when API returns non-ok', async () => {
      vi.mocked(fetch)
        .mockResolvedValueOnce(new Response(JSON.stringify([]), { status: 200 }))

      const { result } = renderHook(() => useBestellungKosten('b-1'))
      await waitFor(() => expect(result.current.loading).toBe(false))

      vi.mocked(fetch).mockResolvedValueOnce(
        new Response(JSON.stringify({ error: 'Validation failed' }), { status: 400 })
      )

      await expect(
        act(async () => { await result.current.add({ datum: '2026-07-15', nettobetrag: 100 }) })
      ).rejects.toThrow('Validation failed')
    })
  })

  describe('update', () => {
    it('applies optimistic update immediately', async () => {
      const row = makeKosten()
      vi.mocked(fetch)
        .mockResolvedValueOnce(new Response(JSON.stringify([row]), { status: 200 }))

      const { result } = renderHook(() => useBestellungKosten('b-1'))
      await waitFor(() => expect(result.current.loading).toBe(false))

      let resolveUpdate!: (value: Response) => void
      const pending = new Promise<Response>(r => { resolveUpdate = r })
      vi.mocked(fetch).mockReturnValueOnce(pending)

      act(() => {
        result.current.update('k-1', { nettobetrag: 999 })
      })

      // Optimistic update applied immediately
      expect(result.current.kosten[0].nettobetrag).toBe(999)

      const updated = makeKosten({ nettobetrag: 999 })
      resolveUpdate(new Response(JSON.stringify(updated), { status: 200 }))
      await waitFor(() => expect(result.current.kosten[0].nettobetrag).toBe(999))
    })

    it('rolls back on API error', async () => {
      const row = makeKosten({ nettobetrag: 500 })
      vi.mocked(fetch)
        .mockResolvedValueOnce(new Response(JSON.stringify([row]), { status: 200 }))

      const { result } = renderHook(() => useBestellungKosten('b-1'))
      await waitFor(() => expect(result.current.loading).toBe(false))

      vi.mocked(fetch).mockResolvedValueOnce(new Response('error', { status: 500 }))

      await expect(
        act(async () => { await result.current.update('k-1', { nettobetrag: 999 }) })
      ).rejects.toThrow()

      // Rolled back to original value
      expect(result.current.kosten[0].nettobetrag).toBe(500)
    })
  })

  describe('remove', () => {
    it('removes entry optimistically', async () => {
      const row = makeKosten()
      vi.mocked(fetch)
        .mockResolvedValueOnce(new Response(JSON.stringify([row]), { status: 200 }))

      const { result } = renderHook(() => useBestellungKosten('b-1'))
      await waitFor(() => expect(result.current.loading).toBe(false))

      let resolveDelete!: (value: Response) => void
      const pending = new Promise<Response>(r => { resolveDelete = r })
      vi.mocked(fetch).mockReturnValueOnce(pending)

      act(() => {
        result.current.remove('k-1')
      })

      // Optimistically removed
      expect(result.current.kosten).toHaveLength(0)

      resolveDelete(new Response(JSON.stringify({ success: true }), { status: 200 }))
      await waitFor(() => expect(result.current.kosten).toHaveLength(0))
    })

    it('restores entry on delete error', async () => {
      const row = makeKosten()
      vi.mocked(fetch)
        .mockResolvedValueOnce(new Response(JSON.stringify([row]), { status: 200 }))

      const { result } = renderHook(() => useBestellungKosten('b-1'))
      await waitFor(() => expect(result.current.loading).toBe(false))

      vi.mocked(fetch).mockResolvedValueOnce(new Response('error', { status: 500 }))

      await expect(
        act(async () => { await result.current.remove('k-1') })
      ).rejects.toThrow()

      // Restored after error
      expect(result.current.kosten).toHaveLength(1)
      expect(result.current.kosten[0].id).toBe('k-1')
    })

    it('throws when bestellungId is null', async () => {
      const { result } = renderHook(() => useBestellungKosten(null))
      await expect(
        act(async () => { await result.current.remove('k-1') })
      ).rejects.toThrow('Keine Bestellung')
    })
  })
})
