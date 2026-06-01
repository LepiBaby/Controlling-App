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

const PLATTFORM_ID = '11111111-1111-1111-8111-111111111111'
const PRODUKT_ID   = '22222222-2222-2222-8222-222222222222'
const EINTRAG_ID   = '33333333-3333-3333-8333-333333333333'

const MOCK_EINSTELLUNG = {
  id: EINTRAG_ID,
  sales_plattform_id: PLATTFORM_ID,
  produkt_id: PRODUKT_ID,
  versandgebuehr_euro_netto: 4.99,
}

beforeEach(() => {
  vi.clearAllMocks()
  mockFrom.mockReset()
})

// ─── GET ──────────────────────────────────────────────────────────────────────

describe('GET /api/versandausgaben-einstellungen', () => {
  it('returns 400 when plattform_id is missing', async () => {
    const res = await GET(req('http://localhost/api/versandausgaben-einstellungen'))
    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error).toMatch(/plattform_id/)
  })

  it('returns 400 when plattform_id is not a valid UUID', async () => {
    const res = await GET(req('http://localhost/api/versandausgaben-einstellungen?plattform_id=not-a-uuid'))
    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error).toMatch(/plattform_id/)
  })

  it('returns 200 with empty array when no einstellungen exist', async () => {
    mockFrom.mockReturnValueOnce({
      select: () => ({
        eq: () => ({
          eq: () => ({
            limit: () => ({ data: [], error: null }),
          }),
        }),
      }),
    })

    const res = await GET(req(`http://localhost/api/versandausgaben-einstellungen?plattform_id=${PLATTFORM_ID}`))
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body).toEqual([])
  })

  it('returns 200 with einstellungen for the given plattform', async () => {
    mockFrom.mockReturnValueOnce({
      select: () => ({
        eq: () => ({
          eq: () => ({
            limit: () => ({ data: [MOCK_EINSTELLUNG], error: null }),
          }),
        }),
      }),
    })

    const res = await GET(req(`http://localhost/api/versandausgaben-einstellungen?plattform_id=${PLATTFORM_ID}`))
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body).toHaveLength(1)
    expect(body[0].versandgebuehr_euro_netto).toBe(4.99)
    expect(body[0].sales_plattform_id).toBe(PLATTFORM_ID)
  })

  it('returns 401 when unauthenticated', async () => {
    const { requireAuth } = await import('@/lib/supabase-server')
    vi.mocked(requireAuth).mockResolvedValueOnce({
      user: null, supabase: null as never,
      error: new Response('Unauthorized', { status: 401 }),
    })
    const res = await GET(req(`http://localhost/api/versandausgaben-einstellungen?plattform_id=${PLATTFORM_ID}`))
    expect(res.status).toBe(401)
  })

  it('returns 500 when db query fails', async () => {
    mockFrom.mockReturnValueOnce({
      select: () => ({
        eq: () => ({
          eq: () => ({
            limit: () => ({ data: null, error: { message: 'DB error' } }),
          }),
        }),
      }),
    })

    const res = await GET(req(`http://localhost/api/versandausgaben-einstellungen?plattform_id=${PLATTFORM_ID}`))
    expect(res.status).toBe(500)
  })
})

// ─── PUT ──────────────────────────────────────────────────────────────────────

describe('PUT /api/versandausgaben-einstellungen', () => {
  function upsertMock(
    returnData: Record<string, unknown> | null,
    returnError: { message: string } | null = null
  ) {
    mockFrom.mockReturnValueOnce({
      upsert: () => ({
        select: () => ({
          single: () => ({ data: returnData, error: returnError }),
        }),
      }),
    })
  }

  it('returns 200 on upsert with a positive decimal value', async () => {
    upsertMock(MOCK_EINSTELLUNG)

    const res = await PUT(req('http://localhost/api/versandausgaben-einstellungen', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        sales_plattform_id: PLATTFORM_ID,
        produkt_id: PRODUKT_ID,
        versandgebuehr_euro_netto: 4.99,
      }),
    }))
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.versandgebuehr_euro_netto).toBe(4.99)
  })

  it('returns 200 on upsert with null (clearing the value)', async () => {
    upsertMock({ ...MOCK_EINSTELLUNG, versandgebuehr_euro_netto: null })

    const res = await PUT(req('http://localhost/api/versandausgaben-einstellungen', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        sales_plattform_id: PLATTFORM_ID,
        produkt_id: PRODUKT_ID,
        versandgebuehr_euro_netto: null,
      }),
    }))
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.versandgebuehr_euro_netto).toBeNull()
  })

  it('returns 200 on upsert without versandgebuehr field (treated as null)', async () => {
    upsertMock({ ...MOCK_EINSTELLUNG, versandgebuehr_euro_netto: null })

    const res = await PUT(req('http://localhost/api/versandausgaben-einstellungen', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        sales_plattform_id: PLATTFORM_ID,
        produkt_id: PRODUKT_ID,
      }),
    }))
    expect(res.status).toBe(200)
  })

  it('returns 200 on upsert with value 0 (valid)', async () => {
    upsertMock({ ...MOCK_EINSTELLUNG, versandgebuehr_euro_netto: 0 })

    const res = await PUT(req('http://localhost/api/versandausgaben-einstellungen', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        sales_plattform_id: PLATTFORM_ID,
        produkt_id: PRODUKT_ID,
        versandgebuehr_euro_netto: 0,
      }),
    }))
    expect(res.status).toBe(200)
  })

  it('returns 400 when versandgebuehr_euro_netto is negative', async () => {
    const res = await PUT(req('http://localhost/api/versandausgaben-einstellungen', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        sales_plattform_id: PLATTFORM_ID,
        produkt_id: PRODUKT_ID,
        versandgebuehr_euro_netto: -1.5,
      }),
    }))
    expect(res.status).toBe(400)
  })

  it('returns 400 when sales_plattform_id is not a valid UUID', async () => {
    const res = await PUT(req('http://localhost/api/versandausgaben-einstellungen', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        sales_plattform_id: 'not-a-uuid',
        produkt_id: PRODUKT_ID,
        versandgebuehr_euro_netto: 5,
      }),
    }))
    expect(res.status).toBe(400)
  })

  it('returns 400 when produkt_id is missing', async () => {
    const res = await PUT(req('http://localhost/api/versandausgaben-einstellungen', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        sales_plattform_id: PLATTFORM_ID,
        versandgebuehr_euro_netto: 5,
      }),
    }))
    expect(res.status).toBe(400)
  })

  it('returns 400 when body is not valid JSON', async () => {
    const res = await PUT(req('http://localhost/api/versandausgaben-einstellungen', {
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
    const res = await PUT(req('http://localhost/api/versandausgaben-einstellungen', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        sales_plattform_id: PLATTFORM_ID,
        produkt_id: PRODUKT_ID,
        versandgebuehr_euro_netto: 5,
      }),
    }))
    expect(res.status).toBe(401)
  })

  it('returns 500 when db upsert fails', async () => {
    mockFrom.mockReturnValueOnce({
      upsert: () => ({
        select: () => ({
          single: () => ({ data: null, error: { message: 'DB constraint violated' } }),
        }),
      }),
    })

    const res = await PUT(req('http://localhost/api/versandausgaben-einstellungen', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        sales_plattform_id: PLATTFORM_ID,
        produkt_id: PRODUKT_ID,
        versandgebuehr_euro_netto: 5,
      }),
    }))
    expect(res.status).toBe(500)
  })
})
