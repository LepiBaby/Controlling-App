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
const MOCK_MOQ   = { id: EINTRAG_ID, produkt_id: PRODUKT_ID, ebene: 'produkt', moq: 100 }

beforeEach(() => {
  vi.clearAllMocks()
  mockFrom.mockReset()
})

describe('GET /api/produktinformationen/moq', () => {
  it('returns 200 with moq list', async () => {
    mockFrom.mockReturnValueOnce({
      select: () => ({ eq: () => ({ limit: () => ({ data: [MOCK_MOQ], error: null }) }) }),
    })
    const res = await GET()
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body[0].ebene).toBe('produkt')
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

describe('PUT /api/produktinformationen/moq', () => {
  function upsertMock(returnData: Record<string, unknown> | null, returnError: { message: string } | null = null) {
    mockFrom.mockReturnValueOnce({
      upsert: () => ({ select: () => ({ single: () => ({ data: returnData, error: returnError }) }) }),
    })
  }

  it('returns 200 on upsert with produkt ebene', async () => {
    upsertMock(MOCK_MOQ)
    const res = await PUT(req('http://localhost/', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ produkt_id: PRODUKT_ID, ebene: 'produkt', moq: 100 }),
    }))
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.moq).toBe(100)
  })

  it('returns 200 on upsert with sku ebene', async () => {
    upsertMock({ ...MOCK_MOQ, ebene: 'sku', moq: null })
    const res = await PUT(req('http://localhost/', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ produkt_id: PRODUKT_ID, ebene: 'sku' }),
    }))
    expect(res.status).toBe(200)
  })

  it('returns 400 when ebene is invalid', async () => {
    const res = await PUT(req('http://localhost/', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ produkt_id: PRODUKT_ID, ebene: 'invalid' }),
    }))
    expect(res.status).toBe(400)
  })

  it('returns 400 when produkt_id is missing', async () => {
    const res = await PUT(req('http://localhost/', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ebene: 'produkt', moq: 50 }),
    }))
    expect(res.status).toBe(400)
  })

  it('returns 400 when produkt_id is not a valid UUID', async () => {
    const res = await PUT(req('http://localhost/', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ produkt_id: 'not-a-uuid', ebene: 'produkt' }),
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
      body: JSON.stringify({ produkt_id: PRODUKT_ID, ebene: 'produkt' }),
    }))
    expect(res.status).toBe(401)
  })

  it('returns 500 when db upsert fails', async () => {
    upsertMock(null, { message: 'DB error' })
    const res = await PUT(req('http://localhost/', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ produkt_id: PRODUKT_ID, ebene: 'produkt' }),
    }))
    expect(res.status).toBe(500)
  })
})
