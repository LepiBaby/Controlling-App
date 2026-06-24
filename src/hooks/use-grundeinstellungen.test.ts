import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, act, waitFor } from '@testing-library/react'
import { useGrundeinstellungen, DEFAULT_PLANUNGSHORIZONT } from './use-grundeinstellungen'

const mockFetch = vi.fn()
global.fetch = mockFetch

beforeEach(() => {
  vi.clearAllMocks()
  mockFetch.mockReset()
})

// ─── DEFAULT_PLANUNGSHORIZONT ────────────────────────────────────────────────

describe('DEFAULT_PLANUNGSHORIZONT', () => {
  it('is 13', () => {
    expect(DEFAULT_PLANUNGSHORIZONT).toBe(13)
  })
})

// ─── useGrundeinstellungen — Initial Load ────────────────────────────────────

describe('useGrundeinstellungen — initial load', () => {
  it('starts with loading=true and default value', () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ planungshorizont_wochen: 13 }),
    })

    const { result } = renderHook(() => useGrundeinstellungen())
    expect(result.current.loading).toBe(true)
    expect(result.current.planungshorizont).toBe(DEFAULT_PLANUNGSHORIZONT)
    expect(result.current.error).toBeNull()
  })

  it('loads stored value from API and sets loading=false', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ planungshorizont_wochen: 26 }),
    })

    const { result } = renderHook(() => useGrundeinstellungen())
    await waitFor(() => expect(result.current.loading).toBe(false))

    expect(result.current.planungshorizont).toBe(26)
    expect(result.current.error).toBeNull()
  })

  it('uses default value 13 when API returns 13', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ planungshorizont_wochen: 13 }),
    })

    const { result } = renderHook(() => useGrundeinstellungen())
    await waitFor(() => expect(result.current.loading).toBe(false))

    expect(result.current.planungshorizont).toBe(13)
  })

  it('sets error and loading=false when API returns non-ok', async () => {
    mockFetch.mockResolvedValueOnce({ ok: false })

    const { result } = renderHook(() => useGrundeinstellungen())
    await waitFor(() => expect(result.current.loading).toBe(false))

    expect(result.current.error).toBeTruthy()
    expect(result.current.planungshorizont).toBe(DEFAULT_PLANUNGSHORIZONT)
  })

  it('sets error and loading=false on network failure', async () => {
    mockFetch.mockRejectedValueOnce(new Error('Network error'))

    const { result } = renderHook(() => useGrundeinstellungen())
    await waitFor(() => expect(result.current.loading).toBe(false))

    expect(result.current.error).toBeTruthy()
  })
})

// ─── useGrundeinstellungen — save ────────────────────────────────────────────

describe('useGrundeinstellungen — save', () => {
  async function setupHook(initialValue: number) {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ planungshorizont_wochen: initialValue }),
    })
    const hook = renderHook(() => useGrundeinstellungen())
    await waitFor(() => expect(hook.result.current.loading).toBe(false))
    return hook
  }

  it('optimistically updates planungshorizont before API responds', async () => {
    const { result } = await setupHook(13)

    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ planungshorizont_wochen: 26 }),
    })

    act(() => { result.current.save(26) })
    expect(result.current.planungshorizont).toBe(26)
  })

  it('keeps updated value after successful save', async () => {
    const { result } = await setupHook(13)

    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ planungshorizont_wochen: 26 }),
    })

    await act(async () => { await result.current.save(26) })
    expect(result.current.planungshorizont).toBe(26)
  })

  it('rolls back to previous value on API error', async () => {
    const { result } = await setupHook(13)

    mockFetch.mockResolvedValueOnce({ ok: false })

    await act(async () => {
      await expect(result.current.save(26)).rejects.toThrow()
    })
    expect(result.current.planungshorizont).toBe(13)
  })

  it('throws on API error so caller can show toast', async () => {
    const { result } = await setupHook(13)

    mockFetch.mockResolvedValueOnce({ ok: false })

    await act(async () => {
      await expect(result.current.save(26)).rejects.toThrow('Speichern fehlgeschlagen')
    })
  })
})
