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
    mockFrom.mockReset()
    // Default: no duplicate found, insert succeeds
    // Covers BOTH paths: duplicate-name (eq.eq.is.limit) and duplicate-sku_code (eq.limit)
    mockFrom.mockReturnValue({
      select: () => ({
        eq: () => ({
          // For duplicate-name chain: .eq(type).eq(name).is(parent_id).limit()
          eq: () => ({
            is: () => ({
              limit: () => ({ data: [], error: null }),
            }),
          }),
          // For duplicate-sku_code chain: .eq(sku_code, val).limit()
          limit: () => ({ data: [], error: null }),
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
      body: JSON.stringify({ type: 'sales_plattformen', name: 'Sub', parent_id: '11111111-1111-4111-8111-111111111111', level: 2 }),
    }))
    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error).toBeTruthy()
  })

  it('returns 400 for produkte with level 2 (flat type rejects subcategories)', async () => {
    const res = await POST(makeRequest('http://localhost/api/kpi-categories', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type: 'produkte', name: 'Sub', parent_id: '11111111-1111-4111-8111-111111111111', level: 2 }),
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

  // ─── PROJ-2 SKU Amendment tests ─────────────────────────────────────────────

  it('PROJ-2 SKU: returns 201 for produkte level 1 (product, no sku_code needed)', async () => {
    const res = await POST(makeRequest('http://localhost/api/kpi-categories', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type: 'produkte', name: 'T-Shirt', parent_id: null, level: 1 }),
    }))
    expect(res.status).toBe(201)
  })

  it('PROJ-2 SKU: returns 400 for produkte level 2 WITHOUT sku_code', async () => {
    const res = await POST(makeRequest('http://localhost/api/kpi-categories', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        type: 'produkte',
        name: 'Red M',
        parent_id: '11111111-1111-4111-8111-111111111111',
        level: 2,
      }),
    }))
    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error).toMatch(/SKU-Code/i)
  })

  it('PROJ-2 SKU: returns 201 for produkte level 2 WITH sku_code', async () => {
    const res = await POST(makeRequest('http://localhost/api/kpi-categories', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        type: 'produkte',
        name: 'Red M',
        parent_id: '11111111-1111-4111-8111-111111111111',
        level: 2,
        sku_code: 'TS-RED-M',
      }),
    }))
    expect(res.status).toBe(201)
  })

  it('PROJ-2 SKU: returns 400 for produkte level 3 (even with sku_code)', async () => {
    const res = await POST(makeRequest('http://localhost/api/kpi-categories', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        type: 'produkte',
        name: 'Sub-SKU',
        parent_id: '22222222-2222-4222-8222-222222222222',
        level: 3,
        sku_code: 'SUB-1',
      }),
    }))
    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error).toMatch(/2 Ebenen|Ebene 2|Produkt/i)
  })

  it('PROJ-2 SKU: returns 400 for produkte level 2 with empty sku_code string', async () => {
    const res = await POST(makeRequest('http://localhost/api/kpi-categories', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        type: 'produkte',
        name: 'Blue M',
        parent_id: '11111111-1111-4111-8111-111111111111',
        level: 2,
        sku_code: '',
      }),
    }))
    expect(res.status).toBe(400)
  })

  it('PROJ-2 SKU: returns 409 for duplicate sku_code (global uniqueness)', async () => {
    // override: simulate duplicate sku_code lookup found
    mockFrom.mockReset()
    mockFrom.mockImplementation(() => ({
      select: () => ({
        // first call: duplicate name check
        eq: (col: string, val: unknown) => {
          if (col === 'sku_code') {
            return { limit: () => ({ data: [{ id: 'existing-sku' }], error: null }) }
          }
          return {
            eq: () => ({
              is: () => ({ limit: () => ({ data: [], error: null }) }),
            }),
          }
        },
      }),
      insert: () => ({
        select: () => ({
          single: () => ({ data: { id: 'new' }, error: null }),
        }),
      }),
    }))

    const res = await POST(makeRequest('http://localhost/api/kpi-categories', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        type: 'produkte',
        name: 'Rot M',
        parent_id: '11111111-1111-4111-8111-111111111111',
        level: 2,
        sku_code: 'DUPLICATE-SKU',
      }),
    }))
    expect(res.status).toBe(409)
    const body = await res.json()
    expect(body.error).toMatch(/SKU-Code/i)
  })

  it('PROJ-2 SKU: accepts sku_code with whitespace (trimmed)', async () => {
    const res = await POST(makeRequest('http://localhost/api/kpi-categories', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        type: 'produkte',
        name: 'Green L',
        parent_id: '11111111-1111-4111-8111-111111111111',
        level: 2,
        sku_code: '  TS-GRN-L  ',
      }),
    }))
    expect(res.status).toBe(201)
  })

  it('PROJ-2 SKU: sales_plattformen is unaffected (still flat, level 2 rejected)', async () => {
    const res = await POST(makeRequest('http://localhost/api/kpi-categories', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        type: 'sales_plattformen',
        name: 'Sub',
        parent_id: '11111111-1111-4111-8111-111111111111',
        level: 2,
        sku_code: 'IGNORED',
      }),
    }))
    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error).toMatch(/Hauptkategorie|Ebene 1/i)
  })

  it('PROJ-2 SKU: umsatz is unaffected (sku_code ignored, no validation error)', async () => {
    const res = await POST(makeRequest('http://localhost/api/kpi-categories', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        type: 'umsatz',
        name: 'Sub Umsatz',
        parent_id: '11111111-1111-4111-8111-111111111111',
        level: 2,
      }),
    }))
    expect(res.status).toBe(201)
  })

  it('PROJ-2 SKU: umsatz level 3 remains allowed (regression)', async () => {
    const res = await POST(makeRequest('http://localhost/api/kpi-categories', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        type: 'umsatz',
        name: 'L3',
        parent_id: '22222222-2222-4222-8222-222222222222',
        level: 3,
      }),
    }))
    expect(res.status).toBe(201)
  })

  it('PROJ-2 SKU: sku_code validation — max 100 chars', async () => {
    const res = await POST(makeRequest('http://localhost/api/kpi-categories', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        type: 'produkte',
        name: 'TooLong',
        parent_id: '11111111-1111-4111-8111-111111111111',
        level: 2,
        sku_code: 'x'.repeat(101),
      }),
    }))
    expect(res.status).toBe(400)
  })

  it('PROJ-2 SKU: sku_code exactly 100 chars is accepted (boundary)', async () => {
    const res = await POST(makeRequest('http://localhost/api/kpi-categories', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        type: 'produkte',
        name: 'Boundary',
        parent_id: '11111111-1111-4111-8111-111111111111',
        level: 2,
        sku_code: 'x'.repeat(100),
      }),
    }))
    expect(res.status).toBe(201)
  })
})
