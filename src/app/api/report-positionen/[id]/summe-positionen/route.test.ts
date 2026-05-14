import { describe, it, expect, vi, beforeEach } from 'vitest'
import { PUT } from './route'

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

const SUMME_ID  = '11111111-1111-1111-1111-111111111111'
const POS_ID    = '22222222-2222-2222-a222-222222222222'
const MOCK_SUMME_POS = { id: SUMME_ID, name: 'Gesamt', type: 'summe', sort_order: 2 }
const params = Promise.resolve({ id: SUMME_ID })

function mockHappyPath(summeRefsData = [] as object[]) {
  // 1. Ownership check
  mockFrom.mockReturnValueOnce({
    select: () => ({ eq: () => ({ eq: () => ({ single: () => ({ data: MOCK_SUMME_POS, error: null }) }) }) }),
  })
  // 2. Delete existing refs
  mockFrom.mockReturnValueOnce({
    delete: () => ({ eq: () => ({ eq: () => ({ error: null }) }) }),
  })
  // 3. Insert new refs (only if ids provided)
  if (summeRefsData.length > 0) {
    mockFrom.mockReturnValueOnce({
      insert: () => ({ error: null }),
    })
  }
  // 4. Fetch summe_positionen
  mockFrom.mockReturnValueOnce({
    select: () => ({ eq: () => ({ data: summeRefsData, error: null }) }),
  })
  // 5. Fetch referenced position names (if any refs)
  if (summeRefsData.length > 0) {
    mockFrom.mockReturnValueOnce({
      select: () => ({ in: () => ({ data: [{ id: POS_ID, name: 'Rohertrag' }], error: null }) }),
    })
  }
}

beforeEach(() => {
  vi.clearAllMocks()
  mockFrom.mockReset()
})

describe('PUT /api/report-positionen/[id]/summe-positionen', () => {
  it('returns 200 with empty summe_positionen when clearing', async () => {
    mockHappyPath([])

    const res = await PUT(req('http://localhost/api/report-positionen/id/summe-positionen', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ referenced_position_ids: [] }),
    }), { params })
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.summe_positionen).toEqual([])
  })

  it('returns 200 with summe references', async () => {
    const summeRefsData = [{ id: 's1', referenced_position_id: POS_ID }]
    mockHappyPath(summeRefsData)

    const res = await PUT(req('http://localhost/api/report-positionen/id/summe-positionen', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ referenced_position_ids: [POS_ID] }),
    }), { params })
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.summe_positionen).toHaveLength(1)
    expect(body.summe_positionen[0].referenced_position.name).toBe('Rohertrag')
  })

  it('returns 400 when referenced_position_ids is missing', async () => {
    const res = await PUT(req('http://localhost/api/report-positionen/id/summe-positionen', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    }), { params })
    expect(res.status).toBe(400)
  })

  it('returns 400 when referenced_position_ids contains non-UUID', async () => {
    const res = await PUT(req('http://localhost/api/report-positionen/id/summe-positionen', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ referenced_position_ids: ['not-a-uuid'] }),
    }), { params })
    expect(res.status).toBe(400)
  })

  it('returns 404 when position not found', async () => {
    mockFrom.mockReturnValueOnce({
      select: () => ({ eq: () => ({ eq: () => ({ single: () => ({ data: null, error: { message: 'not found' } }) }) }) }),
    })

    const res = await PUT(req('http://localhost/api/report-positionen/id/summe-positionen', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ referenced_position_ids: [] }),
    }), { params })
    expect(res.status).toBe(404)
  })

  it('returns 401 when unauthenticated', async () => {
    const { requireAuth } = await import('@/lib/supabase-server')
    vi.mocked(requireAuth).mockResolvedValueOnce({
      user: null, supabase: null as never,
      error: new Response('Unauthorized', { status: 401 }),
    })
    const res = await PUT(req('http://localhost/api/report-positionen/id/summe-positionen', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ referenced_position_ids: [] }),
    }), { params })
    expect(res.status).toBe(401)
  })
})
