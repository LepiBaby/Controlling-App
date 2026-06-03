import { describe, it, expect, vi, beforeEach } from 'vitest'
import { GET, PUT, DELETE } from './route'

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

const PRODUKT_ID      = '11111111-1111-1111-8111-111111111111'
const PLATTFORM_ID    = '22222222-2222-2222-8222-222222222222'

const MOCK_EINTRAG = {
  produkt_id: PRODUKT_ID,
  sales_plattform_id: PLATTFORM_ID,
  kw_year: 2026,
  kw_number: 24,
  absatz_manuell: 5.50,
  effektiver_vk_manuell: 29.99,
}

beforeEach(() => {
  vi.clearAllMocks()
  mockFrom.mockReset()
})

// ─── GET ──────────────────────────────────────────────────────────────────────

describe('GET /api/absatz-planung', () => {
  it('returns 200 with empty data when no entries exist', async () => {
    mockFrom.mockReturnValueOnce({
      select: () => ({ eq: () => ({ limit: () => ({ data: [], error: null }) }) }),
    })

    const res = await GET()
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body).toEqual({ data: [] })
  })

  it('returns 200 with existing entries', async () => {
    mockFrom.mockReturnValueOnce({
      select: () => ({
        eq: () => ({ limit: () => ({ data: [MOCK_EINTRAG], error: null }) }),
      }),
    })

    const res = await GET()
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.data).toHaveLength(1)
    expect(body.data[0].kw_number).toBe(24)
    expect(body.data[0].absatz_manuell).toBe(5.50)
  })

  it('returns 401 when unauthenticated', async () => {
    const { requireAuth } = await import('@/lib/supabase-server')
    vi.mocked(requireAuth).mockResolvedValueOnce({
      user: null, supabase: null as never,
      error: new Response('Unauthorized', { status: 401 }),
    })
    const res = await GET()
    expect(res.status).toBe(401)
  })

  it('returns 500 when db query fails', async () => {
    mockFrom.mockReturnValueOnce({
      select: () => ({
        eq: () => ({ limit: () => ({ data: null, error: { message: 'DB error' } }) }),
      }),
    })

    const res = await GET()
    expect(res.status).toBe(500)
  })
})

// ─── PUT ──────────────────────────────────────────────────────────────────────

describe('PUT /api/absatz-planung', () => {
  function upsertMock(
    returnData: Record<string, unknown> | null,
    returnError: { message: string } | null = null,
  ) {
    mockFrom.mockReturnValueOnce({
      upsert: () => ({
        select: () => ({ single: () => ({ data: returnData, error: returnError }) }),
      }),
    })
  }

  it('returns 200 on valid upsert with both fields', async () => {
    upsertMock(MOCK_EINTRAG)

    const res = await PUT(req('http://localhost/api/absatz-planung', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        produkt_id: PRODUKT_ID,
        sales_plattform_id: PLATTFORM_ID,
        kw_year: 2026,
        kw_number: 24,
        absatz_manuell: 5.5,
        effektiver_vk_manuell: 29.99,
      }),
    }))
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.kw_number).toBe(24)
  })

  it('returns 200 on upsert with only absatz_manuell', async () => {
    upsertMock({ ...MOCK_EINTRAG, effektiver_vk_manuell: null })

    const res = await PUT(req('http://localhost/api/absatz-planung', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        produkt_id: PRODUKT_ID,
        sales_plattform_id: PLATTFORM_ID,
        kw_year: 2026,
        kw_number: 24,
        absatz_manuell: 5.5,
      }),
    }))
    expect(res.status).toBe(200)
  })

  it('returns 200 on upsert with null values (clear field)', async () => {
    upsertMock({ ...MOCK_EINTRAG, absatz_manuell: null, effektiver_vk_manuell: null })

    const res = await PUT(req('http://localhost/api/absatz-planung', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        produkt_id: PRODUKT_ID,
        sales_plattform_id: PLATTFORM_ID,
        kw_year: 2026,
        kw_number: 24,
        absatz_manuell: null,
        effektiver_vk_manuell: null,
      }),
    }))
    expect(res.status).toBe(200)
  })

  it('returns 400 when produkt_id is missing', async () => {
    const res = await PUT(req('http://localhost/api/absatz-planung', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        sales_plattform_id: PLATTFORM_ID,
        kw_year: 2026,
        kw_number: 24,
      }),
    }))
    expect(res.status).toBe(400)
  })

  it('returns 400 when kw_number is out of range', async () => {
    const res = await PUT(req('http://localhost/api/absatz-planung', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        produkt_id: PRODUKT_ID,
        sales_plattform_id: PLATTFORM_ID,
        kw_year: 2026,
        kw_number: 54,
        absatz_manuell: 5,
      }),
    }))
    expect(res.status).toBe(400)
  })

  it('returns 400 when absatz_manuell is negative', async () => {
    const res = await PUT(req('http://localhost/api/absatz-planung', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        produkt_id: PRODUKT_ID,
        sales_plattform_id: PLATTFORM_ID,
        kw_year: 2026,
        kw_number: 24,
        absatz_manuell: -1,
      }),
    }))
    expect(res.status).toBe(400)
  })

  it('returns 400 when body is invalid JSON', async () => {
    const res = await PUT(req('http://localhost/api/absatz-planung', {
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
    const res = await PUT(req('http://localhost/api/absatz-planung', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        produkt_id: PRODUKT_ID,
        sales_plattform_id: PLATTFORM_ID,
        kw_year: 2026,
        kw_number: 24,
      }),
    }))
    expect(res.status).toBe(401)
  })

  it('returns 500 when db upsert fails', async () => {
    mockFrom.mockReturnValueOnce({
      upsert: () => ({
        select: () => ({ single: () => ({ data: null, error: { message: 'DB constraint' } }) }),
      }),
    })

    const res = await PUT(req('http://localhost/api/absatz-planung', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        produkt_id: PRODUKT_ID,
        sales_plattform_id: PLATTFORM_ID,
        kw_year: 2026,
        kw_number: 24,
      }),
    }))
    expect(res.status).toBe(500)
  })
})

// ─── DELETE ───────────────────────────────────────────────────────────────────

describe('DELETE /api/absatz-planung', () => {
  it('returns 200 on successful full reset', async () => {
    mockFrom.mockReturnValueOnce({
      delete: () => ({ eq: () => ({ error: null }) }),
    })

    const res = await DELETE(req('http://localhost/api/absatz-planung', { method: 'DELETE' }))
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.success).toBe(true)
  })

  it('returns 200 even when no entries exist (idempotent)', async () => {
    mockFrom.mockReturnValueOnce({
      delete: () => ({ eq: () => ({ error: null }) }),
    })

    const res = await DELETE(req('http://localhost/api/absatz-planung', { method: 'DELETE' }))
    expect(res.status).toBe(200)
  })

  it('returns 401 when unauthenticated', async () => {
    const { requireAuth } = await import('@/lib/supabase-server')
    vi.mocked(requireAuth).mockResolvedValueOnce({
      user: null, supabase: null as never,
      error: new Response('Unauthorized', { status: 401 }),
    })
    const res = await DELETE(req('http://localhost/api/absatz-planung', { method: 'DELETE' }))
    expect(res.status).toBe(401)
  })

  it('returns 500 when db delete fails', async () => {
    mockFrom.mockReturnValueOnce({
      delete: () => ({ eq: () => ({ error: { message: 'DB error' } }) }),
    })

    const res = await DELETE(req('http://localhost/api/absatz-planung', { method: 'DELETE' }))
    expect(res.status).toBe(500)
  })

  it('returns 200 when ?field=absatz: nulls absatz then deletes empty rows', async () => {
    // First call: update (null absatz)
    mockFrom.mockReturnValueOnce({
      update: () => ({ eq: () => ({ error: null }) }),
    })
    // Second call: delete rows where both null
    mockFrom.mockReturnValueOnce({
      delete: () => ({ eq: () => ({ is: () => ({ is: () => ({ error: null }) }) }) }),
    })

    const res = await DELETE(req('http://localhost/api/absatz-planung?field=absatz', { method: 'DELETE' }))
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.success).toBe(true)
  })

  it('returns 500 when ?field=absatz update fails', async () => {
    mockFrom.mockReturnValueOnce({
      update: () => ({ eq: () => ({ error: { message: 'DB error' } }) }),
    })

    const res = await DELETE(req('http://localhost/api/absatz-planung?field=absatz', { method: 'DELETE' }))
    expect(res.status).toBe(500)
  })
})
