import { describe, it, expect, vi, beforeEach } from 'vitest'
import { GET, POST } from './route'

const mockSelect = vi.fn()
const mockInsert = vi.fn()
const mockFrom = vi.fn()

vi.mock('@/lib/supabase-server', () => ({
  requireAuth: vi.fn().mockResolvedValue({
    user: { id: 'user-1', email: 'test@test.com' },
    supabase: {
      from: (table: string) => mockFrom(table),
    },
    error: null,
  }),
}))

function makeRequest(url: string, options?: RequestInit) {
  return new Request(url, options)
}

describe('GET /api/kpi-categories', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockFrom.mockReturnValue({
      select: () => ({ eq: () => ({ order: () => ({ data: [], error: null }) }) }),
    })
  })

  it('returns 400 for missing type param', async () => {
    const res = await GET(makeRequest('http://localhost/api/kpi-categories'))
    expect(res.status).toBe(400)
  })

  it('returns 400 for invalid type param', async () => {
    const res = await GET(makeRequest('http://localhost/api/kpi-categories?type=invalid'))
    expect(res.status).toBe(400)
  })

  it('returns 200 with empty array for valid type', async () => {
    const res = await GET(makeRequest('http://localhost/api/kpi-categories?type=umsatz'))
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(Array.isArray(body)).toBe(true)
  })

  it('returns 200 for sales_plattformen type', async () => {
    const res = await GET(makeRequest('http://localhost/api/kpi-categories?type=sales_plattformen'))
    expect(res.status).toBe(200)
  })

  it('returns 200 for produkte type', async () => {
    const res = await GET(makeRequest('http://localhost/api/kpi-categories?type=produkte'))
    expect(res.status).toBe(200)
  })
})

describe('POST /api/kpi-categories', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    // Default: no duplicate found, insert succeeds
    mockFrom.mockReturnValue({
      select: () => ({
        eq: () => ({
          eq: () => ({
            is: () => ({
              limit: () => ({ data: [], error: null }),
            }),
          }),
        }),
      }),
      insert: () => ({
        select: () => ({
          single: () => ({
            data: { id: 'cat-1', type: 'umsatz', name: 'Test', parent_id: null, level: 1, sort_order: 1 },
            error: null,
          }),
        }),
      }),
    })
  })

  it('returns 400 for missing required fields', async () => {
    const res = await POST(makeRequest('http://localhost/api/kpi-categories', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'Test' }),
    }))
    expect(res.status).toBe(400)
  })

  it('returns 400 for invalid type', async () => {
    const res = await POST(makeRequest('http://localhost/api/kpi-categories', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type: 'invalid', name: 'Test', parent_id: null, level: 1 }),
    }))
    expect(res.status).toBe(400)
  })

  it('returns 400 for empty name', async () => {
    const res = await POST(makeRequest('http://localhost/api/kpi-categories', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type: 'umsatz', name: '', parent_id: null, level: 1 }),
    }))
    expect(res.status).toBe(400)
  })

  it('returns 400 for invalid level (4)', async () => {
    const res = await POST(makeRequest('http://localhost/api/kpi-categories', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type: 'umsatz', name: 'Test', parent_id: null, level: 4 }),
    }))
    expect(res.status).toBe(400)
  })

  it('returns 400 for sales_plattformen with level 2 (flat type rejects subcategories)', async () => {
    const res = await POST(makeRequest('http://localhost/api/kpi-categories', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type: 'sales_plattformen', name: 'Sub', parent_id: '00000000-0000-0000-0000-000000000001', level: 2 }),
    }))
    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error).toBeTruthy()
  })

  it('returns 400 for produkte with level 2 (flat type rejects subcategories)', async () => {
    const res = await POST(makeRequest('http://localhost/api/kpi-categories', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type: 'produkte', name: 'Sub', parent_id: '00000000-0000-0000-0000-000000000001', level: 2 }),
    }))
    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error).toBeTruthy()
  })

  it('returns 201 for sales_plattformen with level 1', async () => {
    const res = await POST(makeRequest('http://localhost/api/kpi-categories', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type: 'sales_plattformen', name: 'Amazon', parent_id: null, level: 1 }),
    }))
    expect(res.status).toBe(201)
  })

  it('returns 401 when unauthenticated', async () => {
    const { requireAuth } = await import('@/lib/supabase-server')
    vi.mocked(requireAuth).mockResolvedValueOnce({
      user: null,
      supabase: null as never,
      error: new Response('Unauthorized', { status: 401 }),
    })
    const res = await POST(makeRequest('http://localhost/api/kpi-categories', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type: 'umsatz', name: 'Test', parent_id: null, level: 1 }),
    }))
    expect(res.status).toBe(401)
  })
})
