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

const BASE_URL     = 'http://localhost/api/lagerausgaben-einstellungen/batch'
const PLATTFORM_ID = '11111111-1111-1111-8111-111111111111'
const PRODUKT_A    = '22222222-2222-2222-8222-222222222222'
const PRODUKT_B    = '33333333-3333-3333-8333-333333333333'

const MOCK_PRODUKTE = [{ id: PRODUKT_A }, { id: PRODUKT_B }]

const MOCK_RESULT = [
  { id: 'r1', sales_plattform_id: PLATTFORM_ID, produkt_id: PRODUKT_A, lagerkosten_euro_m3: 3.0 },
  { id: 'r2', sales_plattform_id: PLATTFORM_ID, produkt_id: PRODUKT_B, lagerkosten_euro_m3: 3.0 },
]

beforeEach(() => {
  vi.clearAllMocks()
  mockFrom.mockReset()
})

describe('PUT /api/lagerausgaben-einstellungen/batch', () => {
  function mockProdukteAndUpsert(
    produkte: unknown[],
    upsertData: unknown[] | null,
    upsertErr: { message: string } | null = null
  ) {
    mockFrom.mockReturnValueOnce({
      select: () => ({ eq: () => ({ eq: () => ({ limit: () => ({ data: produkte, error: null }) }) }) }),
    })
    mockFrom.mockReturnValueOnce({
      upsert: () => ({
        select: () => ({ data: upsertData, error: upsertErr }),
      }),
    })
  }

  it('returns 200 with updated einstellungen for all products', async () => {
    mockProdukteAndUpsert(MOCK_PRODUKTE, MOCK_RESULT)
    const res = await PUT(req(BASE_URL, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sales_plattform_id: PLATTFORM_ID, lagerkosten_euro_m3: 3.0 }),
    }))
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body).toHaveLength(2)
    expect(body[0].lagerkosten_euro_m3).toBe(3.0)
  })

  it('returns 200 with empty array when no products exist', async () => {
    mockFrom.mockReturnValueOnce({
      select: () => ({ eq: () => ({ eq: () => ({ limit: () => ({ data: [], error: null }) }) }) }),
    })
    const res = await PUT(req(BASE_URL, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sales_plattform_id: PLATTFORM_ID, lagerkosten_euro_m3: 3.0 }),
    }))
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual([])
  })

  it('returns 200 with null lagerkosten (clearing all products)', async () => {
    const cleared = MOCK_RESULT.map(r => ({ ...r, lagerkosten_euro_m3: null }))
    mockProdukteAndUpsert(MOCK_PRODUKTE, cleared)
    const res = await PUT(req(BASE_URL, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sales_plattform_id: PLATTFORM_ID, lagerkosten_euro_m3: null }),
    }))
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body[0].lagerkosten_euro_m3).toBeNull()
  })

  it('returns 400 when sales_plattform_id is missing', async () => {
    const res = await PUT(req(BASE_URL, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ lagerkosten_euro_m3: 3.0 }),
    }))
    expect(res.status).toBe(400)
  })

  it('returns 400 when lagerkosten_euro_m3 is negative', async () => {
    const res = await PUT(req(BASE_URL, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sales_plattform_id: PLATTFORM_ID, lagerkosten_euro_m3: -0.5 }),
    }))
    expect(res.status).toBe(400)
  })

  it('returns 400 when lagerkosten_euro_m3 is missing (not nullable in schema)', async () => {
    const res = await PUT(req(BASE_URL, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sales_plattform_id: PLATTFORM_ID }),
    }))
    expect(res.status).toBe(400)
  })

  it('returns 401 when unauthenticated', async () => {
    const { requireAuth } = await import('@/lib/supabase-server')
    vi.mocked(requireAuth).mockResolvedValueOnce({
      user: null,
      supabase: null as never,
      error: new Response('Unauthorized', { status: 401 }),
    })
    const res = await PUT(req(BASE_URL, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sales_plattform_id: PLATTFORM_ID, lagerkosten_euro_m3: 3.0 }),
    }))
    expect(res.status).toBe(401)
  })

  it('returns 500 when db upsert fails', async () => {
    mockFrom.mockReturnValueOnce({
      select: () => ({ eq: () => ({ eq: () => ({ limit: () => ({ data: MOCK_PRODUKTE, error: null }) }) }) }),
    })
    mockFrom.mockReturnValueOnce({
      upsert: () => ({
        select: () => ({ data: null, error: { message: 'DB error' } }),
      }),
    })
    const res = await PUT(req(BASE_URL, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sales_plattform_id: PLATTFORM_ID, lagerkosten_euro_m3: 3.0 }),
    }))
    expect(res.status).toBe(500)
  })
})
