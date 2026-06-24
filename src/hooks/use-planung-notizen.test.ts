import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, act, waitFor } from '@testing-library/react'
import { usePlanungNotizen } from './use-planung-notizen'

const SEITE = 'absatzplanung'
const KEY_1 = 'sku:abc:p1:2026:24:absatz'
const KEY_2 = 'vk:prod1:p1:2026:24:vk'

const MOCK_DATA = [
  { zellen_schluessel: KEY_1, notiz_text: 'Notiz A' },
  { zellen_schluessel: KEY_2, notiz_text: 'Notiz B' },
]

beforeEach(() => {
  vi.restoreAllMocks()
})

// ─── Initial load ─────────────────────────────────────────────────────────────

describe('usePlanungNotizen — initial load', () => {
  it('starts in loading state with empty map', () => {
    vi.spyOn(global, 'fetch').mockResolvedValueOnce(
      new Response(JSON.stringify({ data: MOCK_DATA }), { status: 200 })
    )
    const { result } = renderHook(() => usePlanungNotizen(SEITE))
    expect(result.current.loading).toBe(true)
    expect(result.current.notizen.size).toBe(0)
  })

  it('loads notes into Map on mount', async () => {
    vi.spyOn(global, 'fetch').mockResolvedValueOnce(
      new Response(JSON.stringify({ data: MOCK_DATA }), { status: 200 })
    )
    const { result } = renderHook(() => usePlanungNotizen(SEITE))
    await waitFor(() => expect(result.current.loading).toBe(false))
    expect(result.current.notizen.size).toBe(2)
    expect(result.current.notizen.get(KEY_1)).toBe('Notiz A')
    expect(result.current.notizen.get(KEY_2)).toBe('Notiz B')
  })

  it('returns empty Map when API returns empty array', async () => {
    vi.spyOn(global, 'fetch').mockResolvedValueOnce(
      new Response(JSON.stringify({ data: [] }), { status: 200 })
    )
    const { result } = renderHook(() => usePlanungNotizen(SEITE))
    await waitFor(() => expect(result.current.loading).toBe(false))
    expect(result.current.notizen.size).toBe(0)
  })

  it('sets loading to false when API returns error status', async () => {
    vi.spyOn(global, 'fetch').mockResolvedValueOnce(
      new Response('Internal Server Error', { status: 500 })
    )
    const { result } = renderHook(() => usePlanungNotizen(SEITE))
    await waitFor(() => expect(result.current.loading).toBe(false))
    expect(result.current.notizen.size).toBe(0)
  })

  it('sets loading to false when fetch throws (network failure)', async () => {
    vi.spyOn(global, 'fetch').mockRejectedValueOnce(new Error('Network error'))
    const { result } = renderHook(() => usePlanungNotizen(SEITE))
    await waitFor(() => expect(result.current.loading).toBe(false))
    expect(result.current.notizen.size).toBe(0)
  })

  it('encodes seite in the fetch URL', async () => {
    const fetchSpy = vi.spyOn(global, 'fetch').mockResolvedValueOnce(
      new Response(JSON.stringify({ data: [] }), { status: 200 })
    )
    renderHook(() => usePlanungNotizen('einnahmen planung'))
    await waitFor(() => {
      const url = String((fetchSpy.mock.calls[0] as string[])[0])
      expect(url).toContain('einnahmen%20planung')
    })
  })
})

// ─── upsertNotiz ──────────────────────────────────────────────────────────────

describe('usePlanungNotizen — upsertNotiz', () => {
  it('optimistically adds a new note before API responds', async () => {
    vi.spyOn(global, 'fetch')
      .mockResolvedValueOnce(new Response(JSON.stringify({ data: [] }), { status: 200 }))
      .mockResolvedValueOnce(new Response('{}', { status: 200 }))

    const { result } = renderHook(() => usePlanungNotizen(SEITE))
    await waitFor(() => expect(result.current.loading).toBe(false))

    act(() => { result.current.upsertNotiz(KEY_1, 'Neue Notiz') })

    expect(result.current.notizen.get(KEY_1)).toBe('Neue Notiz')
  })

  it('optimistically updates an existing note', async () => {
    vi.spyOn(global, 'fetch')
      .mockResolvedValueOnce(new Response(JSON.stringify({ data: [{ zellen_schluessel: KEY_1, notiz_text: 'Alt' }] }), { status: 200 }))
      .mockResolvedValueOnce(new Response('{}', { status: 200 }))

    const { result } = renderHook(() => usePlanungNotizen(SEITE))
    await waitFor(() => expect(result.current.loading).toBe(false))

    act(() => { result.current.upsertNotiz(KEY_1, 'Neu') })

    expect(result.current.notizen.get(KEY_1)).toBe('Neu')
  })

  it('sends PUT request with correct payload', async () => {
    const fetchSpy = vi.spyOn(global, 'fetch')
      .mockResolvedValueOnce(new Response(JSON.stringify({ data: [] }), { status: 200 }))
      .mockResolvedValueOnce(new Response('{}', { status: 200 }))

    const { result } = renderHook(() => usePlanungNotizen(SEITE))
    await waitFor(() => expect(result.current.loading).toBe(false))

    await act(async () => { await result.current.upsertNotiz(KEY_1, 'Test') })

    const putCall = fetchSpy.mock.calls[1]
    expect(putCall[0]).toBe('/api/planung-notizen')
    expect((putCall[1] as RequestInit).method).toBe('PUT')
    const body = JSON.parse((putCall[1] as RequestInit).body as string)
    expect(body).toEqual({ seite: SEITE, zellen_schluessel: KEY_1, notiz_text: 'Test' })
  })

  it('treats empty text as delete — removes from Map and sends DELETE', async () => {
    vi.spyOn(global, 'fetch')
      .mockResolvedValueOnce(new Response(JSON.stringify({ data: [{ zellen_schluessel: KEY_1, notiz_text: 'Vorhanden' }] }), { status: 200 }))
      .mockResolvedValueOnce(new Response('{}', { status: 200 }))

    const { result } = renderHook(() => usePlanungNotizen(SEITE))
    await waitFor(() => expect(result.current.loading).toBe(false))
    expect(result.current.notizen.has(KEY_1)).toBe(true)

    await act(async () => { await result.current.upsertNotiz(KEY_1, '') })

    expect(result.current.notizen.has(KEY_1)).toBe(false)
  })

  it('treats whitespace-only text as delete', async () => {
    vi.spyOn(global, 'fetch')
      .mockResolvedValueOnce(new Response(JSON.stringify({ data: [{ zellen_schluessel: KEY_1, notiz_text: 'Vorhanden' }] }), { status: 200 }))
      .mockResolvedValueOnce(new Response('{}', { status: 200 }))

    const { result } = renderHook(() => usePlanungNotizen(SEITE))
    await waitFor(() => expect(result.current.loading).toBe(false))

    await act(async () => { await result.current.upsertNotiz(KEY_1, '   ') })

    expect(result.current.notizen.has(KEY_1)).toBe(false)
  })
})

// ─── deleteNotiz ──────────────────────────────────────────────────────────────

describe('usePlanungNotizen — deleteNotiz', () => {
  it('optimistically removes note from Map', async () => {
    vi.spyOn(global, 'fetch')
      .mockResolvedValueOnce(new Response(JSON.stringify({ data: MOCK_DATA }), { status: 200 }))
      .mockResolvedValueOnce(new Response('{}', { status: 200 }))

    const { result } = renderHook(() => usePlanungNotizen(SEITE))
    await waitFor(() => expect(result.current.loading).toBe(false))
    expect(result.current.notizen.has(KEY_1)).toBe(true)

    act(() => { result.current.deleteNotiz(KEY_1) })

    expect(result.current.notizen.has(KEY_1)).toBe(false)
    expect(result.current.notizen.has(KEY_2)).toBe(true)
  })

  it('sends DELETE request with correct URL params', async () => {
    const fetchSpy = vi.spyOn(global, 'fetch')
      .mockResolvedValueOnce(new Response(JSON.stringify({ data: MOCK_DATA }), { status: 200 }))
      .mockResolvedValueOnce(new Response('{}', { status: 200 }))

    const { result } = renderHook(() => usePlanungNotizen(SEITE))
    await waitFor(() => expect(result.current.loading).toBe(false))

    await act(async () => { await result.current.deleteNotiz(KEY_1) })

    const deleteCall = fetchSpy.mock.calls[1]
    const url = String((deleteCall as string[])[0])
    expect(url).toContain(`seite=${SEITE}`)
    expect(url).toContain(`zellen_schluessel=${encodeURIComponent(KEY_1)}`)
    expect((deleteCall[1] as RequestInit).method).toBe('DELETE')
  })

  it('does nothing when deleting non-existent key', async () => {
    vi.spyOn(global, 'fetch')
      .mockResolvedValueOnce(new Response(JSON.stringify({ data: [] }), { status: 200 }))
      .mockResolvedValueOnce(new Response('{}', { status: 200 }))

    const { result } = renderHook(() => usePlanungNotizen(SEITE))
    await waitFor(() => expect(result.current.loading).toBe(false))

    await act(async () => { await result.current.deleteNotiz('non:existent:key') })

    expect(result.current.notizen.size).toBe(0)
  })
})
