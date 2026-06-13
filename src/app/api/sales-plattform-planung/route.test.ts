import { describe, it, expect, vi, beforeEach } from 'vitest'
import { GET, PUT, DELETE } from './route'

const mockFrom = vi.fn()

vi.mock('@/lib/supabase-server', () => ({
  requireAuth: vi.fn().mockResolvedValue({
    user: { id: 'user-1' },
    supabase: { from: (table: string) => mockFrom(table) },
    error: null,
  }),
}))

function ch(result: { data: unknown; error: unknown }): object {
  const p: object = new Proxy({} as Record<string, unknown>, {
    get(_t, prop) {
      const key = String(prop)
      if (key === 'then') return undefined
      if (key === 'data') return result.data
      if (key === 'error') return result.error
      return (..._args: unknown[]) => p
    },
  })
  return p
}

const EMPTY = ch({ data: [], error: null })

function req(url: string, opts?: RequestInit) {
  return new Request(url, opts)
}

beforeEach(() => {
  vi.clearAllMocks()
  mockFrom.mockReset()
})

// ─── GET ──────────────────────────────────────────────────────────────────────

describe('GET /api/sales-plattform-planung', () => {
  it('returns 401 when unauthenticated', async () => {
    const { requireAuth } = await import('@/lib/supabase-server')
    vi.mocked(requireAuth).mockResolvedValueOnce({
      user: null, supabase: null as never,
      error: new Response('Unauthorized', { status: 401 }),
    })
    const res = await GET()
    expect(res.status).toBe(401)
  })

  it('returns empty array when no manual values exist', async () => {
    mockFrom.mockReturnValueOnce(EMPTY)
    const res = await GET()
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(Array.isArray(body)).toBe(true)
    expect(body).toHaveLength(0)
  })

  it('returns manual override rows', async () => {
    const row = {
      id: 'id-1', kategorie: 'bruttoumsatz',
      produkt_id: 'prod-1', sales_plattform_id: 'platt-1',
      kw_year: 2026, kw_number: 25, wert_manuell: 12345.67,
    }
    mockFrom.mockReturnValueOnce(ch({ data: [row], error: null }))
    const res = await GET()
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body).toHaveLength(1)
    expect(body[0].wert_manuell).toBe(12345.67)
  })
})

// ─── PUT ──────────────────────────────────────────────────────────────────────

describe('PUT /api/sales-plattform-planung', () => {
  it('returns 401 when unauthenticated', async () => {
    const { requireAuth } = await import('@/lib/supabase-server')
    vi.mocked(requireAuth).mockResolvedValueOnce({
      user: null, supabase: null as never,
      error: new Response('Unauthorized', { status: 401 }),
    })
    const res = await PUT(req('http://localhost/api/sales-plattform-planung', {
      method: 'PUT',
      body: JSON.stringify({}),
    }))
    expect(res.status).toBe(401)
  })

  it('returns 400 when required fields are missing', async () => {
    const res = await PUT(req('http://localhost/api/sales-plattform-planung', {
      method: 'PUT',
      body: JSON.stringify({ kategorie: 'bruttoumsatz' }),
    }))
    expect(res.status).toBe(400)
  })

  const PROD_ID = '11111111-1111-1111-8111-111111111111'
  const PLATT_ID = '22222222-2222-2222-8222-222222222222'

  it('returns 400 when kategorie is invalid', async () => {
    const res = await PUT(req('http://localhost/api/sales-plattform-planung', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        kategorie: 'invalid', produkt_id: PROD_ID, sales_plattform_id: PLATT_ID,
        kw_year: 2026, kw_number: 25, wert_manuell: 100,
      }),
    }))
    expect(res.status).toBe(400)
  })

  it('upserts manual value on valid input', async () => {
    const row = { id: 'id-1', kategorie: 'bruttoumsatz', produkt_id: PROD_ID, sales_plattform_id: PLATT_ID, kw_year: 2026, kw_number: 25, wert_manuell: 999.99 }
    mockFrom.mockReturnValueOnce(ch({ data: row, error: null }))
    const res = await PUT(req('http://localhost/api/sales-plattform-planung', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ kategorie: 'bruttoumsatz', produkt_id: PROD_ID, sales_plattform_id: PLATT_ID, kw_year: 2026, kw_number: 25, wert_manuell: 999.99 }),
    }))
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.wert_manuell).toBe(999.99)
  })

  it('deletes row when wert_manuell is null', async () => {
    mockFrom.mockReturnValueOnce(ch({ data: null, error: null })) // delete
    const res = await PUT(req('http://localhost/api/sales-plattform-planung', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ kategorie: 'bruttoumsatz', produkt_id: PROD_ID, sales_plattform_id: PLATT_ID, kw_year: 2026, kw_number: 25, wert_manuell: null }),
    }))
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.success).toBe(true)
  })
})

// ─── DELETE ───────────────────────────────────────────────────────────────────

describe('DELETE /api/sales-plattform-planung', () => {
  it('returns 401 when unauthenticated', async () => {
    const { requireAuth } = await import('@/lib/supabase-server')
    vi.mocked(requireAuth).mockResolvedValueOnce({
      user: null, supabase: null as never,
      error: new Response('Unauthorized', { status: 401 }),
    })
    const res = await DELETE()
    expect(res.status).toBe(401)
  })

  it('deletes all manual overrides and returns success', async () => {
    mockFrom.mockReturnValueOnce(ch({ data: null, error: null }))
    const res = await DELETE()
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.success).toBe(true)
  })
})
