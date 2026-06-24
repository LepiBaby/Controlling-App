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

function req(options?: RequestInit) {
  return new Request('http://localhost/api/langfristige-planung/planversionen', options)
}

const VERSION = {
  id: '11111111-1111-4111-8111-111111111111',
  name: 'Basisszenario',
  created_at: '2026-06-20T00:00:00Z',
  updated_at: '2026-06-20T00:00:00Z',
}

async function unauth() {
  const { requireAuth } = await import('@/lib/supabase-server')
  vi.mocked(requireAuth).mockResolvedValueOnce({
    user: null,
    supabase: null as never,
    error: new Response('Unauthorized', { status: 401 }),
  })
}

beforeEach(() => {
  vi.clearAllMocks()
  mockFrom.mockReset()
})

describe('GET /api/langfristige-planung/planversionen', () => {
  it('returns 200 with list of plan versions', async () => {
    mockFrom.mockReturnValueOnce({
      select: () => ({
        eq: () => ({ order: () => ({ limit: () => ({ data: [VERSION], error: null }) }) }),
      }),
    })
    const res = await GET()
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body[0].name).toBe('Basisszenario')
  })

  it('returns 401 when unauthenticated', async () => {
    await unauth()
    const res = await GET()
    expect(res.status).toBe(401)
  })

  it('returns 500 on db error', async () => {
    mockFrom.mockReturnValueOnce({
      select: () => ({
        eq: () => ({ order: () => ({ limit: () => ({ data: null, error: { message: 'DB' } }) }) }),
      }),
    })
    const res = await GET()
    expect(res.status).toBe(500)
  })
})

describe('POST /api/langfristige-planung/planversionen', () => {
  function insertMock(data: unknown, error: { code?: string; message: string } | null = null) {
    mockFrom.mockReturnValueOnce({
      insert: () => ({ select: () => ({ single: () => ({ data, error }) }) }),
    })
  }

  it('returns 201 on successful create', async () => {
    insertMock(VERSION)
    const res = await POST(
      req({ method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name: 'Basisszenario' }) }),
    )
    expect(res.status).toBe(201)
    const body = await res.json()
    expect(body.name).toBe('Basisszenario')
  })

  it('returns 400 when name is missing', async () => {
    const res = await POST(req({ method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({}) }))
    expect(res.status).toBe(400)
  })

  it('returns 400 when name is only whitespace', async () => {
    const res = await POST(
      req({ method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name: '   ' }) }),
    )
    expect(res.status).toBe(400)
  })

  it('returns 409 on duplicate name', async () => {
    insertMock(null, { code: '23505', message: 'duplicate key' })
    const res = await POST(
      req({ method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name: 'Basisszenario' }) }),
    )
    expect(res.status).toBe(409)
  })

  it('returns 401 when unauthenticated', async () => {
    await unauth()
    const res = await POST(
      req({ method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name: 'X' }) }),
    )
    expect(res.status).toBe(401)
  })
})
