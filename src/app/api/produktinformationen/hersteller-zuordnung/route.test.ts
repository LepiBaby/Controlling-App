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

const PRODUKT_ID    = '22222222-2222-2222-8222-222222222222'
const HERSTELLER_ID = '11111111-1111-1111-8111-111111111111'
const EINTRAG_ID    = '33333333-3333-3333-8333-333333333333'

const MOCK_ZUORDNUNG = { id: EINTRAG_ID, produkt_id: PRODUKT_ID, hersteller_id: HERSTELLER_ID }

beforeEach(() => {
  vi.clearAllMocks()
  mockFrom.mockReset()
})

describe('GET /api/produktinformationen/hersteller-zuordnung', () => {
  it('returns 200 with empty array', async () => {
    mockFrom.mockReturnValueOnce({
      select: () => ({ eq: () => ({ limit: () => ({ data: [], error: null }) }) }),
    })
    const res = await GET()
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual([])
  })

  it('returns 200 with zuordnungen', async () => {
    mockFrom.mockReturnValueOnce({
      select: () => ({ eq: () => ({ limit: () => ({ data: [MOCK_ZUORDNUNG], error: null }) }) }),
    })
    const res = await GET()
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body[0].produkt_id).toBe(PRODUKT_ID)
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
})

describe('PUT /api/produktinformationen/hersteller-zuordnung', () => {
  function upsertMock(returnData: Record<string, unknown> | null, returnError: { message: string } | null = null) {
    mockFrom.mockReturnValueOnce({
      upsert: () => ({ select: () => ({ single: () => ({ data: returnData, error: returnError }) }) }),
    })
  }

  it('returns 200 on successful upsert', async () => {
    upsertMock(MOCK_ZUORDNUNG)
    const res = await PUT(req('http://localhost/', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ produkt_id: PRODUKT_ID, hersteller_id: HERSTELLER_ID }),
    }))
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.hersteller_id).toBe(HERSTELLER_ID)
  })

  it('returns 200 when hersteller_id is null (remove assignment)', async () => {
    upsertMock({ ...MOCK_ZUORDNUNG, hersteller_id: null })
    const res = await PUT(req('http://localhost/', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ produkt_id: PRODUKT_ID, hersteller_id: null }),
    }))
    expect(res.status).toBe(200)
  })

  it('returns 400 when produkt_id is missing', async () => {
    const res = await PUT(req('http://localhost/', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ hersteller_id: HERSTELLER_ID }),
    }))
    expect(res.status).toBe(400)
  })

  it('returns 400 when produkt_id is not a valid UUID', async () => {
    const res = await PUT(req('http://localhost/', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ produkt_id: 'not-a-uuid', hersteller_id: HERSTELLER_ID }),
    }))
    expect(res.status).toBe(400)
  })

  it('returns 401 when unauthenticated', async () => {
    const { requireAuth } = await import('@/lib/supabase-server')
    vi.mocked(requireAuth).mockResolvedValueOnce({
      user: null, supabase: null as never,
      error: new Response('Unauthorized', { status: 401 }),
    })
    const res = await PUT(req('http://localhost/', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ produkt_id: PRODUKT_ID, hersteller_id: HERSTELLER_ID }),
    }))
    expect(res.status).toBe(401)
  })

  it('returns 500 when db upsert fails', async () => {
    upsertMock(null, { message: 'DB error' })
    const res = await PUT(req('http://localhost/', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ produkt_id: PRODUKT_ID, hersteller_id: HERSTELLER_ID }),
    }))
    expect(res.status).toBe(500)
  })
})
