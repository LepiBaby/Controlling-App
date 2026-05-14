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

const POS_ID = '11111111-1111-1111-1111-111111111111'
const KAT_ID = '33333333-3333-3333-a333-333333333333'
const MOCK_POSITION = { id: POS_ID, name: 'Umsatz', type: 'position', sort_order: 0 }
const params = Promise.resolve({ id: POS_ID })

function mockHappyPath(katData = [] as object[]) {
  // 1. Ownership check
  mockFrom.mockReturnValueOnce({
    select: () => ({ eq: () => ({ eq: () => ({ single: () => ({ data: MOCK_POSITION, error: null }) }) }) }),
  })
  // 2. Delete existing kategorien
  mockFrom.mockReturnValueOnce({
    delete: () => ({ eq: () => ({ eq: () => ({ error: null }) }) }),
  })
  // 3. Insert new ones (only if ids provided)
  if (katData.length > 0) {
    mockFrom.mockReturnValueOnce({
      insert: () => ({ error: null }),
    })
  }
  // 4. Fetch kategorien (in Promise.all)
  mockFrom.mockReturnValueOnce({
    select: () => ({ eq: () => ({ data: katData, error: null }) }),
  })
  // 5. Fetch summe_positionen (in Promise.all)
  mockFrom.mockReturnValueOnce({
    select: () => ({ eq: () => ({ data: [], error: null }) }),
  })
}

beforeEach(() => {
  vi.clearAllMocks()
  mockFrom.mockReset()
})

describe('PUT /api/report-positionen/[id]/kategorien', () => {
  it('returns 200 with empty kategorien when clearing', async () => {
    mockHappyPath([])

    const res = await PUT(req('http://localhost/api/report-positionen/id/kategorien', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ kpi_category_ids: [] }),
    }), { params })
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.kategorien).toEqual([])
  })

  it('returns 200 with assigned kategorien', async () => {
    const katData = [{ id: 'k1', kpi_category_id: KAT_ID, kpi_categories: { id: KAT_ID, name: 'Nettoumsatz', type: 'umsatz' } }]
    mockHappyPath(katData)

    const res = await PUT(req('http://localhost/api/report-positionen/id/kategorien', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ kpi_category_ids: [KAT_ID] }),
    }), { params })
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.kategorien).toHaveLength(1)
    expect(body.kategorien[0].kpi_category.name).toBe('Nettoumsatz')
  })

  it('returns 400 when kpi_category_ids is missing', async () => {
    const res = await PUT(req('http://localhost/api/report-positionen/id/kategorien', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    }), { params })
    expect(res.status).toBe(400)
  })

  it('returns 400 when kpi_category_ids contains non-UUID', async () => {
    const res = await PUT(req('http://localhost/api/report-positionen/id/kategorien', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ kpi_category_ids: ['not-a-uuid'] }),
    }), { params })
    expect(res.status).toBe(400)
  })

  it('returns 404 when position not found', async () => {
    mockFrom.mockReturnValueOnce({
      select: () => ({ eq: () => ({ eq: () => ({ single: () => ({ data: null, error: { message: 'not found' } }) }) }) }),
    })

    const res = await PUT(req('http://localhost/api/report-positionen/id/kategorien', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ kpi_category_ids: [] }),
    }), { params })
    expect(res.status).toBe(404)
  })

  it('returns 401 when unauthenticated', async () => {
    const { requireAuth } = await import('@/lib/supabase-server')
    vi.mocked(requireAuth).mockResolvedValueOnce({
      user: null, supabase: null as never,
      error: new Response('Unauthorized', { status: 401 }),
    })
    const res = await PUT(req('http://localhost/api/report-positionen/id/kategorien', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ kpi_category_ids: [] }),
    }), { params })
    expect(res.status).toBe(401)
  })
})
