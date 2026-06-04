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

const SKU_ID      = '44444444-4444-4444-8444-444444444444'
const EINTRAG_ID  = '33333333-3333-3333-8333-333333333333'
const MOCK_MOQ_SKU = { id: EINTRAG_ID, sku_id: SKU_ID, moq: 50 }

beforeEach(() => {
  vi.clearAllMocks()
  mockFrom.mockReset()
})

describe('GET /api/produktinformationen/moq-sku', () => {
  it('returns 200 with sku moq list', async () => {
    mockFrom.mockReturnValueOnce({
      select: () => ({ eq: () => ({ limit: () => ({ data: [MOCK_MOQ_SKU], error: null }) }) }),
    })
    const res = await GET()
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body[0].sku_id).toBe(SKU_ID)
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

describe('PUT /api/produktinformationen/moq-sku', () => {
  function upsertMock(returnData: Record<string, unknown> | null, returnError: { message: string } | null = null) {
    mockFrom.mockReturnValueOnce({
      upsert: () => ({ select: () => ({ single: () => ({ data: returnData, error: returnError }) }) }),
    })
  }

  it('returns 200 on successful upsert', async () => {
    upsertMock(MOCK_MOQ_SKU)
    const res = await PUT(req('http://localhost/', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sku_id: SKU_ID, moq: 50 }),
    }))
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.moq).toBe(50)
  })

  it('returns 400 when sku_id is missing', async () => {
    const res = await PUT(req('http://localhost/', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ moq: 50 }),
    }))
    expect(res.status).toBe(400)
  })

  it('returns 400 when sku_id is not a valid UUID', async () => {
    const res = await PUT(req('http://localhost/', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sku_id: 'not-a-uuid', moq: 50 }),
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
      body: JSON.stringify({ sku_id: SKU_ID, moq: 50 }),
    }))
    expect(res.status).toBe(401)
  })

  it('returns 500 when db upsert fails', async () => {
    upsertMock(null, { message: 'DB error' })
    const res = await PUT(req('http://localhost/', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sku_id: SKU_ID, moq: 50 }),
    }))
    expect(res.status).toBe(500)
  })
})
