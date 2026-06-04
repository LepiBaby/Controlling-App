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

const PRODUKT_ID = '22222222-2222-2222-8222-222222222222'
const EINTRAG_ID = '33333333-3333-3333-8333-333333333333'
const MOCK_ENTRY = {
  id: EINTRAG_ID, produkt_id: PRODUKT_ID,
  produktionszeit_tage: 30, zwischenzeit_tage: 7, shipping_zeit_tage: 21, entladungszeit_tage: 3,
}

beforeEach(() => {
  vi.clearAllMocks()
  mockFrom.mockReset()
})

describe('GET /api/produktinformationen/lieferzeit', () => {
  it('returns 200 with lieferzeit list', async () => {
    mockFrom.mockReturnValueOnce({
      select: () => ({ eq: () => ({ limit: () => ({ data: [MOCK_ENTRY], error: null }) }) }),
    })
    const res = await GET()
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body[0].produktionszeit_tage).toBe(30)
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

describe('PUT /api/produktinformationen/lieferzeit', () => {
  function upsertMock(returnData: Record<string, unknown> | null, returnError: { message: string } | null = null) {
    mockFrom.mockReturnValueOnce({
      upsert: () => ({ select: () => ({ single: () => ({ data: returnData, error: returnError }) }) }),
    })
  }

  it('returns 200 on successful upsert', async () => {
    upsertMock(MOCK_ENTRY)
    const res = await PUT(req('http://localhost/', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ produkt_id: PRODUKT_ID, produktionszeit_tage: 30, zwischenzeit_tage: 7, shipping_zeit_tage: 21, entladungszeit_tage: 3 }),
    }))
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.shipping_zeit_tage).toBe(21)
  })

  it('returns 400 when produkt_id is missing', async () => {
    const res = await PUT(req('http://localhost/', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ produktionszeit_tage: 30 }),
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
      body: JSON.stringify({ produkt_id: PRODUKT_ID, produktionszeit_tage: 30 }),
    }))
    expect(res.status).toBe(401)
  })

  it('returns 500 when db upsert fails', async () => {
    upsertMock(null, { message: 'DB error' })
    const res = await PUT(req('http://localhost/', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ produkt_id: PRODUKT_ID, produktionszeit_tage: 30 }),
    }))
    expect(res.status).toBe(500)
  })
})
