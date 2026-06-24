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

beforeEach(() => {
  vi.clearAllMocks()
  mockFrom.mockReset()
})

// ─── GET ──────────────────────────────────────────────────────────────────────

describe('GET /api/grundeinstellungen', () => {
  it('returns 200 with default value when no entry exists', async () => {
    mockFrom.mockReturnValueOnce({
      select: () => ({
        eq: () => ({
          maybeSingle: () => ({ data: null, error: null }),
        }),
      }),
    })

    const res = await GET(req('http://localhost/api/grundeinstellungen'))
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.planungshorizont_wochen).toBe(13)
  })

  it('returns 200 with stored value when entry exists', async () => {
    mockFrom.mockReturnValueOnce({
      select: () => ({
        eq: () => ({
          maybeSingle: () => ({ data: { planungshorizont_wochen: 26 }, error: null }),
        }),
      }),
    })

    const res = await GET(req('http://localhost/api/grundeinstellungen'))
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.planungshorizont_wochen).toBe(26)
  })

  it('returns 401 when unauthenticated', async () => {
    const { requireAuth } = await import('@/lib/supabase-server')
    vi.mocked(requireAuth).mockResolvedValueOnce({
      user: null, supabase: null as never,
      error: new Response('Unauthorized', { status: 401 }),
    })
    const res = await GET(req('http://localhost/api/grundeinstellungen'))
    expect(res.status).toBe(401)
  })

  it('returns 500 when db query fails', async () => {
    mockFrom.mockReturnValueOnce({
      select: () => ({
        eq: () => ({
          maybeSingle: () => ({ data: null, error: { message: 'DB error' } }),
        }),
      }),
    })

    const res = await GET(req('http://localhost/api/grundeinstellungen'))
    expect(res.status).toBe(500)
  })
})

// ─── PUT ──────────────────────────────────────────────────────────────────────

describe('PUT /api/grundeinstellungen', () => {
  function upsertMock(returnData: Record<string, unknown> | null, returnError: { message: string } | null = null) {
    mockFrom.mockReturnValueOnce({
      upsert: () => ({
        select: () => ({
          single: () => ({ data: returnData, error: returnError }),
        }),
      }),
    })
  }

  it('returns 200 on valid upsert', async () => {
    upsertMock({ planungshorizont_wochen: 13 })

    const res = await PUT(req('http://localhost/api/grundeinstellungen', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ planungshorizont_wochen: 13 }),
    }))
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.planungshorizont_wochen).toBe(13)
  })

  it('returns 200 for boundary value 1', async () => {
    upsertMock({ planungshorizont_wochen: 1 })

    const res = await PUT(req('http://localhost/api/grundeinstellungen', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ planungshorizont_wochen: 1 }),
    }))
    expect(res.status).toBe(200)
  })

  it('returns 200 for boundary value 52', async () => {
    upsertMock({ planungshorizont_wochen: 52 })

    const res = await PUT(req('http://localhost/api/grundeinstellungen', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ planungshorizont_wochen: 52 }),
    }))
    expect(res.status).toBe(200)
  })

  it('returns 400 when value is 0', async () => {
    const res = await PUT(req('http://localhost/api/grundeinstellungen', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ planungshorizont_wochen: 0 }),
    }))
    expect(res.status).toBe(400)
  })

  it('returns 400 when value is 53', async () => {
    const res = await PUT(req('http://localhost/api/grundeinstellungen', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ planungshorizont_wochen: 53 }),
    }))
    expect(res.status).toBe(400)
  })

  it('returns 400 when value is a decimal', async () => {
    const res = await PUT(req('http://localhost/api/grundeinstellungen', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ planungshorizont_wochen: 4.5 }),
    }))
    expect(res.status).toBe(400)
  })

  it('returns 400 when field is missing', async () => {
    const res = await PUT(req('http://localhost/api/grundeinstellungen', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    }))
    expect(res.status).toBe(400)
  })

  it('returns 400 when body is not valid JSON', async () => {
    const res = await PUT(req('http://localhost/api/grundeinstellungen', {
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
    const res = await PUT(req('http://localhost/api/grundeinstellungen', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ planungshorizont_wochen: 13 }),
    }))
    expect(res.status).toBe(401)
  })

  it('returns 500 when db upsert fails', async () => {
    upsertMock(null, { message: 'DB constraint violated' })

    const res = await PUT(req('http://localhost/api/grundeinstellungen', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ planungshorizont_wochen: 13 }),
    }))
    expect(res.status).toBe(500)
  })
})
