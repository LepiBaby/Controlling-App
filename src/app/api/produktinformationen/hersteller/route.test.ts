import { describe, it, expect, vi, beforeEach } from 'vitest'
import { GET, POST } from './route'

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

const HERSTELLER_ID = '11111111-1111-1111-8111-111111111111'
const MOCK_HERSTELLER = { id: HERSTELLER_ID, name: 'Acme GmbH' }

beforeEach(() => {
  vi.clearAllMocks()
  mockFrom.mockReset()
})

describe('GET /api/produktinformationen/hersteller', () => {
  it('returns 200 with empty array when no hersteller exist', async () => {
    mockFrom.mockReturnValueOnce({
      select: () => ({ eq: () => ({ order: () => ({ limit: () => ({ data: [], error: null }) }) }) }),
    })
    const res = await GET()
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual([])
  })

  it('returns 200 with hersteller list', async () => {
    mockFrom.mockReturnValueOnce({
      select: () => ({ eq: () => ({ order: () => ({ limit: () => ({ data: [MOCK_HERSTELLER], error: null }) }) }) }),
    })
    const res = await GET()
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body).toHaveLength(1)
    expect(body[0].name).toBe('Acme GmbH')
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
      select: () => ({ eq: () => ({ order: () => ({ limit: () => ({ data: null, error: { message: 'DB error' } }) }) }) }),
    })
    const res = await GET()
    expect(res.status).toBe(500)
  })
})

describe('POST /api/produktinformationen/hersteller', () => {
  it('returns 201 on successful creation', async () => {
    mockFrom.mockReturnValueOnce({
      insert: () => ({ select: () => ({ single: () => ({ data: MOCK_HERSTELLER, error: null }) }) }),
    })
    const res = await POST(req('http://localhost/api/produktinformationen/hersteller', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'Acme GmbH' }),
    }))
    expect(res.status).toBe(201)
    const body = await res.json()
    expect(body.name).toBe('Acme GmbH')
  })

  it('returns 400 when name is empty', async () => {
    const res = await POST(req('http://localhost/api/produktinformationen/hersteller', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: '' }),
    }))
    expect(res.status).toBe(400)
  })

  it('returns 400 when body is invalid JSON', async () => {
    const res = await POST(req('http://localhost/api/produktinformationen/hersteller', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: 'not json',
    }))
    expect(res.status).toBe(400)
  })

  it('returns 409 when hersteller already exists', async () => {
    mockFrom.mockReturnValueOnce({
      insert: () => ({ select: () => ({ single: () => ({ data: null, error: { code: '23505', message: 'unique' } }) }) }),
    })
    const res = await POST(req('http://localhost/api/produktinformationen/hersteller', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'Acme GmbH' }),
    }))
    expect(res.status).toBe(409)
  })

  it('returns 401 when unauthenticated', async () => {
    const { requireAuth } = await import('@/lib/supabase-server')
    vi.mocked(requireAuth).mockResolvedValueOnce({
      user: null, supabase: null as never,
      error: new Response('Unauthorized', { status: 401 }),
    })
    const res = await POST(req('http://localhost/api/produktinformationen/hersteller', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'Test' }),
    }))
    expect(res.status).toBe(401)
  })
})
