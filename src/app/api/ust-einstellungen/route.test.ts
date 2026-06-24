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

const BASE_URL = 'http://localhost/api/ust-einstellungen'

const MOCK_EINSTELLUNG = {
  zahlungsfrequenz: 'monatlich',
  zahlungsverschiebung_tage: 10,
  einfuhrust_zahlungsziel_tage: 30,
  ust_satz_pflegeebene: 1,
}

beforeEach(() => {
  vi.clearAllMocks()
  mockFrom.mockReset()
})

// ─── GET ──────────────────────────────────────────────────────────────────────

describe('GET /api/ust-einstellungen', () => {
  it('returns defaults when no row exists', async () => {
    mockFrom.mockReturnValueOnce({
      select: () => ({ eq: () => ({ maybeSingle: () => ({ data: null, error: null }) }) }),
    })
    const res = await GET()
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.zahlungsfrequenz).toBe('monatlich')
    expect(body.zahlungsverschiebung_tage).toBe(0)
    expect(body.einfuhrust_zahlungsziel_tage).toBe(0)
    expect(body.ust_satz_pflegeebene).toBe(1)
  })

  it('returns saved settings when row exists', async () => {
    mockFrom.mockReturnValueOnce({
      select: () => ({ eq: () => ({ maybeSingle: () => ({ data: MOCK_EINSTELLUNG, error: null }) }) }),
    })
    const res = await GET()
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.zahlungsfrequenz).toBe('monatlich')
    expect(body.zahlungsverschiebung_tage).toBe(10)
    expect(body.einfuhrust_zahlungsziel_tage).toBe(30)
    expect(body.ust_satz_pflegeebene).toBe(1)
  })

  it('returns 401 when unauthenticated', async () => {
    const { requireAuth } = await import('@/lib/supabase-server')
    vi.mocked(requireAuth).mockResolvedValueOnce({
      user: null,
      supabase: null as never,
      error: new Response('Unauthorized', { status: 401 }),
    })
    const res = await GET()
    expect(res.status).toBe(401)
  })

  it('returns 500 when db query fails', async () => {
    mockFrom.mockReturnValueOnce({
      select: () => ({
        eq: () => ({ maybeSingle: () => ({ data: null, error: { message: 'DB error' } }) }),
      }),
    })
    const res = await GET()
    expect(res.status).toBe(500)
  })
})

// ─── PUT ──────────────────────────────────────────────────────────────────────

describe('PUT /api/ust-einstellungen', () => {
  function mockUpsert(result: unknown, err: { message: string } | null = null) {
    mockFrom.mockReturnValueOnce({
      upsert: () => ({
        select: () => ({ single: () => ({ data: result, error: err }) }),
      }),
    })
  }

  it('returns 200 and updated data on valid partial update', async () => {
    const updated = { ...MOCK_EINSTELLUNG, zahlungsfrequenz: 'quartalsweise' }
    mockUpsert(updated)
    const res = await PUT(req(BASE_URL, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ zahlungsfrequenz: 'quartalsweise' }),
    }))
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.zahlungsfrequenz).toBe('quartalsweise')
  })

  it('returns 200 on update with all fields', async () => {
    mockUpsert(MOCK_EINSTELLUNG)
    const res = await PUT(req(BASE_URL, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        zahlungsfrequenz: 'monatlich',
        zahlungsverschiebung_tage: 10,
        einfuhrust_zahlungsziel_tage: 30,
        ust_satz_pflegeebene: 1,
      }),
    }))
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.zahlungsverschiebung_tage).toBe(10)
    expect(body.einfuhrust_zahlungsziel_tage).toBe(30)
  })

  it('returns 200 when updating only ust_satz_pflegeebene to 2', async () => {
    mockUpsert({ ...MOCK_EINSTELLUNG, ust_satz_pflegeebene: 2 })
    const res = await PUT(req(BASE_URL, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ust_satz_pflegeebene: 2 }),
    }))
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.ust_satz_pflegeebene).toBe(2)
  })

  it('returns 400 when body is empty object', async () => {
    const res = await PUT(req(BASE_URL, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    }))
    expect(res.status).toBe(400)
  })

  it('returns 400 when zahlungsfrequenz has invalid value', async () => {
    const res = await PUT(req(BASE_URL, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ zahlungsfrequenz: 'jaehrlich' }),
    }))
    expect(res.status).toBe(400)
  })

  it('returns 400 when zahlungsverschiebung_tage is negative', async () => {
    const res = await PUT(req(BASE_URL, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ zahlungsverschiebung_tage: -1 }),
    }))
    expect(res.status).toBe(400)
  })

  it('returns 400 when einfuhrust_zahlungsziel_tage is negative', async () => {
    const res = await PUT(req(BASE_URL, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ einfuhrust_zahlungsziel_tage: -5 }),
    }))
    expect(res.status).toBe(400)
  })

  it('returns 400 when ust_satz_pflegeebene is not 1 or 2', async () => {
    const res = await PUT(req(BASE_URL, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ust_satz_pflegeebene: 3 }),
    }))
    expect(res.status).toBe(400)
  })

  it('returns 400 when body is not JSON', async () => {
    const res = await PUT(req(BASE_URL, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: 'not-json',
    }))
    expect(res.status).toBe(400)
  })

  it('returns 401 when unauthenticated', async () => {
    const { requireAuth } = await import('@/lib/supabase-server')
    vi.mocked(requireAuth).mockResolvedValueOnce({
      user: null,
      supabase: null as never,
      error: new Response('Unauthorized', { status: 401 }),
    })
    const res = await PUT(req(BASE_URL, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ zahlungsfrequenz: 'monatlich' }),
    }))
    expect(res.status).toBe(401)
  })

  it('returns 500 when db upsert fails', async () => {
    mockUpsert(null, { message: 'DB error' })
    const res = await PUT(req(BASE_URL, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ zahlungsfrequenz: 'monatlich' }),
    }))
    expect(res.status).toBe(500)
  })
})
