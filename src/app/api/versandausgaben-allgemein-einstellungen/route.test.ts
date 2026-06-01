import { describe, it, expect, vi, beforeEach } from 'vitest'
import { GET, PUT } from './route'

const mockFrom = vi.fn()

vi.mock('@/lib/supabase-server', () => ({
  requireAuth: vi.fn().mockResolvedValue({
    user: { id: 'user-1', email: 'test@test.com' },
    supabase: { from: (table: string) => mockFrom(table) },
    error: null,
  }),
}))

function req(url: string, options?: RequestInit) {
  return new Request(url, options)
}

const BASE_URL = 'http://localhost/api/versandausgaben-allgemein-einstellungen'

const MOCK_EINSTELLUNGEN = {
  gruppierung: 'monatlich',
  zahlungsziel_tage: 30,
}

beforeEach(() => {
  vi.clearAllMocks()
  mockFrom.mockReset()
})

// ─── GET ──────────────────────────────────────────────────────────────────────

describe('GET /api/versandausgaben-allgemein-einstellungen', () => {
  it('returns 200 with null when no entry exists', async () => {
    mockFrom.mockReturnValueOnce({
      select: () => ({
        eq: () => ({
          maybeSingle: () => ({ data: null, error: null }),
        }),
      }),
    })

    const res = await GET(req(BASE_URL))
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body).toBeNull()
  })

  it('returns 200 with einstellungen when entry exists', async () => {
    mockFrom.mockReturnValueOnce({
      select: () => ({
        eq: () => ({
          maybeSingle: () => ({ data: MOCK_EINSTELLUNGEN, error: null }),
        }),
      }),
    })

    const res = await GET(req(BASE_URL))
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.gruppierung).toBe('monatlich')
    expect(body.zahlungsziel_tage).toBe(30)
  })

  it('returns 401 when unauthenticated', async () => {
    const { requireAuth } = await import('@/lib/supabase-server')
    vi.mocked(requireAuth).mockResolvedValueOnce({
      user: null, supabase: null as never,
      error: new Response('Unauthorized', { status: 401 }),
    })
    const res = await GET(req(BASE_URL))
    expect(res.status).toBe(401)
  })

  it('returns 500 when db query fails', async () => {
    mockFrom.mockReturnValueOnce({
      select: () => ({
        eq: () => ({
          maybeSingle: () => ({ data: null, error: { message: 'DB error' } }),
        }),
      }),
    })

    const res = await GET(req(BASE_URL))
    expect(res.status).toBe(500)
  })
})

// ─── PUT ──────────────────────────────────────────────────────────────────────

describe('PUT /api/versandausgaben-allgemein-einstellungen', () => {
  function mockSelectAndUpsert(
    currentData: Record<string, unknown> | null,
    upsertData: Record<string, unknown> | null,
    upsertError: { message: string } | null = null
  ) {
    // First call: SELECT current row
    mockFrom.mockReturnValueOnce({
      select: () => ({
        eq: () => ({
          maybeSingle: () => ({ data: currentData, error: null }),
        }),
      }),
    })
    // Second call: UPSERT
    mockFrom.mockReturnValueOnce({
      upsert: () => ({
        select: () => ({
          single: () => ({ data: upsertData, error: upsertError }),
        }),
      }),
    })
  }

  it('returns 200 when updating gruppierung only', async () => {
    mockSelectAndUpsert(
      { gruppierung: 'woechentlich', zahlungsziel_tage: 14 },
      { gruppierung: 'monatlich', zahlungsziel_tage: 14 }
    )

    const res = await PUT(req(BASE_URL, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ gruppierung: 'monatlich' }),
    }))
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.gruppierung).toBe('monatlich')
    expect(body.zahlungsziel_tage).toBe(14)
  })

  it('returns 200 when updating zahlungsziel_tage only', async () => {
    mockSelectAndUpsert(
      { gruppierung: 'monatlich', zahlungsziel_tage: null },
      { gruppierung: 'monatlich', zahlungsziel_tage: 30 }
    )

    const res = await PUT(req(BASE_URL, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ zahlungsziel_tage: 30 }),
    }))
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.zahlungsziel_tage).toBe(30)
    expect(body.gruppierung).toBe('monatlich')
  })

  it('returns 200 when clearing zahlungsziel_tage (null)', async () => {
    mockSelectAndUpsert(
      { gruppierung: 'monatlich', zahlungsziel_tage: 30 },
      { gruppierung: 'monatlich', zahlungsziel_tage: null }
    )

    const res = await PUT(req(BASE_URL, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ zahlungsziel_tage: null }),
    }))
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.zahlungsziel_tage).toBeNull()
  })

  it('returns 200 on first-time upsert (no current row)', async () => {
    mockSelectAndUpsert(
      null,
      { gruppierung: 'quartalsweise', zahlungsziel_tage: null }
    )

    const res = await PUT(req(BASE_URL, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ gruppierung: 'quartalsweise' }),
    }))
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.gruppierung).toBe('quartalsweise')
  })

  it('returns 400 when gruppierung has invalid value', async () => {
    const res = await PUT(req(BASE_URL, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ gruppierung: 'taglich' }),
    }))
    expect(res.status).toBe(400)
  })

  it('returns 400 when zahlungsziel_tage is negative', async () => {
    const res = await PUT(req(BASE_URL, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ zahlungsziel_tage: -5 }),
    }))
    expect(res.status).toBe(400)
  })

  it('returns 400 when zahlungsziel_tage is a decimal (non-integer)', async () => {
    const res = await PUT(req(BASE_URL, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ zahlungsziel_tage: 3.5 }),
    }))
    expect(res.status).toBe(400)
  })

  it('returns 400 when body has no recognised fields', async () => {
    const res = await PUT(req(BASE_URL, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ unbekanntes_feld: 'wert' }),
    }))
    expect(res.status).toBe(400)
  })

  it('returns 400 when body is not valid JSON', async () => {
    const res = await PUT(req(BASE_URL, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: 'not json',
    }))
    expect(res.status).toBe(400)
  })

  it('returns 401 when unauthenticated', async () => {
    const { requireAuth } = await import('@/lib/supabase-server')
    vi.mocked(requireAuth).mockResolvedValueOnce({
      user: null, supabase: null as never,
      error: new Response('Unauthorized', { status: 401 }),
    })
    const res = await PUT(req(BASE_URL, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ gruppierung: 'monatlich' }),
    }))
    expect(res.status).toBe(401)
  })

  it('returns 500 when db upsert fails', async () => {
    // First call: SELECT succeeds
    mockFrom.mockReturnValueOnce({
      select: () => ({
        eq: () => ({
          maybeSingle: () => ({ data: null, error: null }),
        }),
      }),
    })
    // Second call: UPSERT fails
    mockFrom.mockReturnValueOnce({
      upsert: () => ({
        select: () => ({
          single: () => ({ data: null, error: { message: 'DB constraint violated' } }),
        }),
      }),
    })

    const res = await PUT(req(BASE_URL, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ gruppierung: 'monatlich' }),
    }))
    expect(res.status).toBe(500)
  })
})
