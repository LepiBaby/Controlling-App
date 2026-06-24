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

const PRODUKT_ID   = '11111111-1111-1111-8111-111111111111'
const KATEGORIE_ID = '22222222-2222-2222-8222-222222222222'

const MOCK_EINTRAG = {
  produkt_id: PRODUKT_ID,
  kategorie_id: KATEGORIE_ID,
  kw_year: 2026,
  kw_number: 24,
  marketingkosten_pct_manuell: 5.25,
}

beforeEach(() => {
  vi.clearAllMocks()
  mockFrom.mockReset()
})

// ─── GET ──────────────────────────────────────────────────────────────────────

describe('GET /api/marketing-planung', () => {
  it('returns 200 with empty array when no entries exist', async () => {
    mockFrom.mockReturnValueOnce({
      select: () => ({ eq: () => ({ limit: () => ({ data: [], error: null }) }) }),
    })

    const res = await GET()
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body).toEqual([])
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
    expect(body).toHaveLength(1)
    expect(body[0].marketingkosten_pct_manuell).toBe(5.25)
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

describe('PUT /api/marketing-planung', () => {
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

  function deleteMock(returnError: { message: string } | null = null) {
    mockFrom.mockReturnValueOnce({
      delete: () => ({
        eq: () => ({
          eq: () => ({
            eq: () => ({
              eq: () => ({
                eq: () => ({ error: returnError }),
              }),
            }),
          }),
        }),
      }),
    })
  }

  it('returns 200 on valid upsert', async () => {
    upsertMock(MOCK_EINTRAG)

    const res = await PUT(req('http://localhost/api/marketing-planung', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        produkt_id: PRODUKT_ID,
        kategorie_id: KATEGORIE_ID,
        kw_year: 2026,
        kw_number: 24,
        marketingkosten_pct_manuell: 5.25,
      }),
    }))
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.kw_number).toBe(24)
    expect(body.marketingkosten_pct_manuell).toBe(5.25)
  })

  it('returns 200 when pct is null (deletes entry)', async () => {
    deleteMock(null)

    const res = await PUT(req('http://localhost/api/marketing-planung', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        produkt_id: PRODUKT_ID,
        kategorie_id: KATEGORIE_ID,
        kw_year: 2026,
        kw_number: 24,
        marketingkosten_pct_manuell: null,
      }),
    }))
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.success).toBe(true)
  })

  it('returns 200 when pct is 0 (stores 0, not delete)', async () => {
    upsertMock({ ...MOCK_EINTRAG, marketingkosten_pct_manuell: 0 })

    const res = await PUT(req('http://localhost/api/marketing-planung', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        produkt_id: PRODUKT_ID,
        kategorie_id: KATEGORIE_ID,
        kw_year: 2026,
        kw_number: 24,
        marketingkosten_pct_manuell: 0,
      }),
    }))
    expect(res.status).toBe(200)
  })

  it('returns 400 when produkt_id is missing', async () => {
    const res = await PUT(req('http://localhost/api/marketing-planung', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        kategorie_id: KATEGORIE_ID,
        kw_year: 2026,
        kw_number: 24,
        marketingkosten_pct_manuell: 5,
      }),
    }))
    expect(res.status).toBe(400)
  })

  it('returns 400 when kw_number is out of range', async () => {
    const res = await PUT(req('http://localhost/api/marketing-planung', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        produkt_id: PRODUKT_ID,
        kategorie_id: KATEGORIE_ID,
        kw_year: 2026,
        kw_number: 54,
        marketingkosten_pct_manuell: 5,
      }),
    }))
    expect(res.status).toBe(400)
  })

  it('returns 400 when pct > 100', async () => {
    const res = await PUT(req('http://localhost/api/marketing-planung', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        produkt_id: PRODUKT_ID,
        kategorie_id: KATEGORIE_ID,
        kw_year: 2026,
        kw_number: 24,
        marketingkosten_pct_manuell: 101,
      }),
    }))
    expect(res.status).toBe(400)
  })

  it('returns 400 when pct is negative', async () => {
    const res = await PUT(req('http://localhost/api/marketing-planung', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        produkt_id: PRODUKT_ID,
        kategorie_id: KATEGORIE_ID,
        kw_year: 2026,
        kw_number: 24,
        marketingkosten_pct_manuell: -1,
      }),
    }))
    expect(res.status).toBe(400)
  })

  it('returns 400 when body is invalid JSON', async () => {
    const res = await PUT(req('http://localhost/api/marketing-planung', {
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
    const res = await PUT(req('http://localhost/api/marketing-planung', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        produkt_id: PRODUKT_ID,
        kategorie_id: KATEGORIE_ID,
        kw_year: 2026,
        kw_number: 24,
        marketingkosten_pct_manuell: 5,
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

    const res = await PUT(req('http://localhost/api/marketing-planung', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        produkt_id: PRODUKT_ID,
        kategorie_id: KATEGORIE_ID,
        kw_year: 2026,
        kw_number: 24,
        marketingkosten_pct_manuell: 5,
      }),
    }))
    expect(res.status).toBe(500)
  })
})

// ─── DELETE ───────────────────────────────────────────────────────────────────

describe('DELETE /api/marketing-planung', () => {
  it('returns 200 on successful reset', async () => {
    mockFrom.mockReturnValueOnce({
      delete: () => ({ eq: () => ({ error: null }) }),
    })

    const res = await DELETE()
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.success).toBe(true)
  })

  it('returns 200 when no entries exist (idempotent)', async () => {
    mockFrom.mockReturnValueOnce({
      delete: () => ({ eq: () => ({ error: null }) }),
    })

    const res = await DELETE()
    expect(res.status).toBe(200)
  })

  it('returns 401 when unauthenticated', async () => {
    const { requireAuth } = await import('@/lib/supabase-server')
    vi.mocked(requireAuth).mockResolvedValueOnce({
      user: null, supabase: null as never,
      error: new Response('Unauthorized', { status: 401 }),
    })
    const res = await DELETE()
    expect(res.status).toBe(401)
  })

  it('returns 500 when db delete fails', async () => {
    mockFrom.mockReturnValueOnce({
      delete: () => ({ eq: () => ({ error: { message: 'DB error' } }) }),
    })

    const res = await DELETE()
    expect(res.status).toBe(500)
  })
})
