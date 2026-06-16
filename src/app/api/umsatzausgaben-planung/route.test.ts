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
const OK = ch({ data: null, error: null })

beforeEach(() => {
  vi.clearAllMocks()
  mockFrom.mockReset()
})

describe('GET /api/umsatzausgaben-planung', () => {
  it('returns 401 when unauthenticated', async () => {
    const { requireAuth } = await import('@/lib/supabase-server')
    vi.mocked(requireAuth).mockResolvedValueOnce({
      user: null, supabase: null as never,
      error: new Response('Unauthorized', { status: 401 }),
    })
    const res = await GET()
    expect(res.status).toBe(401)
  })

  it('returns empty data when no entries exist', async () => {
    mockFrom.mockReturnValueOnce(EMPTY)
    const res = await GET()
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.data).toEqual([])
  })

  it('translates sentinel produkt_id to null', async () => {
    mockFrom.mockReturnValueOnce(ch({
      data: [{
        kategorie_id: 'kat-1',
        produkt_id: '00000000-0000-0000-0000-000000000000',
        kw_year: 2026,
        kw_number: 26,
        betrag_manuell: 100,
      }],
      error: null,
    }))
    const res = await GET()
    const body = await res.json()
    expect(body.data[0].produkt_id).toBeNull()
  })

  it('keeps real produkt_id as-is', async () => {
    mockFrom.mockReturnValueOnce(ch({
      data: [{
        kategorie_id: 'kat-1',
        produkt_id: 'prod-abc',
        kw_year: 2026,
        kw_number: 26,
        betrag_manuell: 200,
      }],
      error: null,
    }))
    const res = await GET()
    const body = await res.json()
    expect(body.data[0].produkt_id).toBe('prod-abc')
  })
})

// UUIDs with valid version and variant bits for Zod v4 UUID validation
const KAT_UUID = '11111111-1111-4111-8111-111111111111'
const PROD_UUID = '22222222-2222-4222-8222-222222222222'

describe('PUT /api/umsatzausgaben-planung', () => {
  const validBody = {
    kategorie_id: KAT_UUID,
    produkt_id: PROD_UUID,
    kw_year: 2026,
    kw_number: 26,
    betrag_manuell: 500,
  }

  const jsonHeaders = { 'Content-Type': 'application/json' }

  it('returns 401 when unauthenticated', async () => {
    const { requireAuth } = await import('@/lib/supabase-server')
    vi.mocked(requireAuth).mockResolvedValueOnce({
      user: null, supabase: null as never,
      error: new Response('Unauthorized', { status: 401 }),
    })
    const req = new Request('http://localhost', { method: 'PUT', headers: jsonHeaders, body: JSON.stringify(validBody) })
    const res = await PUT(req)
    expect(res.status).toBe(401)
  })

  it('returns 400 on invalid input', async () => {
    const req = new Request('http://localhost', {
      method: 'PUT',
      headers: jsonHeaders,
      body: JSON.stringify({ kategorie_id: 'not-a-uuid', kw_year: 2026, kw_number: 26, betrag_manuell: 100 }),
    })
    const res = await PUT(req)
    expect(res.status).toBe(400)
  })

  it('deletes entry when betrag_manuell is null', async () => {
    mockFrom.mockReturnValueOnce(OK)
    const body = { ...validBody, betrag_manuell: null }
    const req = new Request('http://localhost', { method: 'PUT', headers: jsonHeaders, body: JSON.stringify(body) })
    const res = await PUT(req)
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json.ok).toBe(true)
  })

  it('upserts entry and returns result', async () => {
    mockFrom.mockReturnValueOnce(ch({
      data: { ...validBody, produkt_id: PROD_UUID },
      error: null,
    }))
    const req = new Request('http://localhost', { method: 'PUT', headers: jsonHeaders, body: JSON.stringify(validBody) })
    const res = await PUT(req)
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json.betrag_manuell).toBe(500)
  })

  it('uses sentinel UUID for null produkt_id', async () => {
    const body = { ...validBody, produkt_id: null }
    mockFrom.mockReturnValueOnce(ch({
      data: { ...body, produkt_id: '00000000-0000-0000-0000-000000000000' },
      error: null,
    }))
    const req = new Request('http://localhost', { method: 'PUT', headers: jsonHeaders, body: JSON.stringify(body) })
    const res = await PUT(req)
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json.produkt_id).toBeNull()
  })
})

describe('DELETE /api/umsatzausgaben-planung', () => {
  it('returns 401 when unauthenticated', async () => {
    const { requireAuth } = await import('@/lib/supabase-server')
    vi.mocked(requireAuth).mockResolvedValueOnce({
      user: null, supabase: null as never,
      error: new Response('Unauthorized', { status: 401 }),
    })
    const res = await DELETE()
    expect(res.status).toBe(401)
  })

  it('deletes all entries and returns ok', async () => {
    mockFrom.mockReturnValueOnce(OK)
    const res = await DELETE()
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json.ok).toBe(true)
  })
})
