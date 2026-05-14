import { describe, it, expect, vi, beforeEach } from 'vitest'
import { PATCH, DELETE } from './route'

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

const POS_ID = '11111111-1111-1111-1111-111111111111'
const MOCK_POSITION = { id: POS_ID, name: 'Umsatz', type: 'position', sort_order: 0 }
const params = Promise.resolve({ id: POS_ID })

beforeEach(() => {
  vi.clearAllMocks()
  mockFrom.mockReset()
})

// ─── PATCH ────────────────────────────────────────────────────────────────────

describe('PATCH /api/report-positionen/[id]', () => {
  it('returns 200 when renaming', async () => {
    mockFrom.mockReturnValueOnce({
      update: () => ({ eq: () => ({ eq: () => ({ select: () => ({ single: () => ({ data: { ...MOCK_POSITION, name: 'Neuer Name' }, error: null }) }) }) }) }),
    })

    const res = await PATCH(req('http://localhost/api/report-positionen/id', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'Neuer Name' }),
    }), { params })
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.name).toBe('Neuer Name')
  })

  it('returns 200 when updating sort_order', async () => {
    mockFrom.mockReturnValueOnce({
      update: () => ({ eq: () => ({ eq: () => ({ select: () => ({ single: () => ({ data: { ...MOCK_POSITION, sort_order: 3 }, error: null }) }) }) }) }),
    })

    const res = await PATCH(req('http://localhost/api/report-positionen/id', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sort_order: 3 }),
    }), { params })
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.sort_order).toBe(3)
  })

  it('returns 400 when body is empty', async () => {
    const res = await PATCH(req('http://localhost/api/report-positionen/id', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    }), { params })
    expect(res.status).toBe(400)
  })

  it('returns 400 when name is empty string', async () => {
    const res = await PATCH(req('http://localhost/api/report-positionen/id', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: '' }),
    }), { params })
    expect(res.status).toBe(400)
  })

  it('returns 404 when position not found', async () => {
    mockFrom.mockReturnValueOnce({
      update: () => ({ eq: () => ({ eq: () => ({ select: () => ({ single: () => ({ data: null, error: { message: 'not found' } }) }) }) }) }),
    })

    const res = await PATCH(req('http://localhost/api/report-positionen/id', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'Test' }),
    }), { params })
    expect(res.status).toBe(404)
  })

  it('returns 401 when unauthenticated', async () => {
    const { requireAuth } = await import('@/lib/supabase-server')
    vi.mocked(requireAuth).mockResolvedValueOnce({
      user: null, supabase: null as never,
      error: new Response('Unauthorized', { status: 401 }),
    })
    const res = await PATCH(req('http://localhost/api/report-positionen/id', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'Test' }),
    }), { params })
    expect(res.status).toBe(401)
  })
})

// ─── DELETE ───────────────────────────────────────────────────────────────────

describe('DELETE /api/report-positionen/[id]', () => {
  it('returns 204 on success', async () => {
    mockFrom.mockReturnValueOnce({
      delete: () => ({ eq: () => ({ eq: () => ({ error: null }) }) }),
    })

    const res = await DELETE(req('http://localhost/api/report-positionen/id', {
      method: 'DELETE',
    }), { params })
    expect(res.status).toBe(204)
  })

  it('returns 401 when unauthenticated', async () => {
    const { requireAuth } = await import('@/lib/supabase-server')
    vi.mocked(requireAuth).mockResolvedValueOnce({
      user: null, supabase: null as never,
      error: new Response('Unauthorized', { status: 401 }),
    })
    const res = await DELETE(req('http://localhost/api/report-positionen/id', {
      method: 'DELETE',
    }), { params })
    expect(res.status).toBe(401)
  })
})
