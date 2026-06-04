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

const EINTRAG_ID = '33333333-3333-3333-8333-333333333333'
const MOCK_GLOBAL = { id: EINTRAG_ID, volumen_20dc: 25.5, volumen_40dc: 56.1, volumen_40hq: 67.7 }

beforeEach(() => {
  vi.clearAllMocks()
  mockFrom.mockReset()
})

describe('GET /api/produktinformationen/container-global', () => {
  it('returns 200 with null when no entry exists', async () => {
    mockFrom.mockReturnValueOnce({
      select: () => ({ eq: () => ({ maybeSingle: () => ({ data: null, error: null }) }) }),
    })
    const res = await GET()
    expect(res.status).toBe(200)
    expect(await res.json()).toBeNull()
  })

  it('returns 200 with global volumes', async () => {
    mockFrom.mockReturnValueOnce({
      select: () => ({ eq: () => ({ maybeSingle: () => ({ data: MOCK_GLOBAL, error: null }) }) }),
    })
    const res = await GET()
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.volumen_20dc).toBe(25.5)
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

describe('PUT /api/produktinformationen/container-global', () => {
  function upsertMock(returnData: Record<string, unknown> | null, returnError: { message: string } | null = null) {
    mockFrom.mockReturnValueOnce({
      upsert: () => ({ select: () => ({ single: () => ({ data: returnData, error: returnError }) }) }),
    })
  }

  it('returns 200 on successful upsert', async () => {
    upsertMock(MOCK_GLOBAL)
    const res = await PUT(req('http://localhost/', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ volumen_20dc: 25.5, volumen_40dc: 56.1, volumen_40hq: 67.7 }),
    }))
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.volumen_40hq).toBe(67.7)
  })

  it('returns 200 with partial data (some null)', async () => {
    upsertMock({ ...MOCK_GLOBAL, volumen_40dc: null })
    const res = await PUT(req('http://localhost/', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ volumen_20dc: 25.5 }),
    }))
    expect(res.status).toBe(200)
  })

  it('returns 400 when body is invalid JSON', async () => {
    const res = await PUT(req('http://localhost/', {
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
    const res = await PUT(req('http://localhost/', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ volumen_20dc: 25.5 }),
    }))
    expect(res.status).toBe(401)
  })

  it('returns 500 when db upsert fails', async () => {
    upsertMock(null, { message: 'DB error' })
    const res = await PUT(req('http://localhost/', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ volumen_20dc: 25.5 }),
    }))
    expect(res.status).toBe(500)
  })
})
