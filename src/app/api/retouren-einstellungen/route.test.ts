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

const BASE_URL     = 'http://localhost/api/retouren-einstellungen'
const PLATTFORM_ID = '11111111-1111-1111-8111-111111111111'
const PRODUKT_ID   = '22222222-2222-2222-8222-222222222222'
const EINTRAG_ID   = '33333333-3333-3333-8333-333333333333'

const MOCK_EINSTELLUNG = {
  id: EINTRAG_ID,
  sales_plattform_id: PLATTFORM_ID,
  produkt_id: PRODUKT_ID,
  berechnungsart: 'mittelwert_30',
  rueckversandkosten_euro_netto: 3.5,
  retourenhandling_kosten_euro_netto: 1.5,
}

beforeEach(() => {
  vi.clearAllMocks()
  mockFrom.mockReset()
})

// ─── GET ──────────────────────────────────────────────────────────────────────

describe('GET /api/retouren-einstellungen', () => {
  it('returns 400 when plattform_id is missing', async () => {
    const res = await GET(req(BASE_URL))
    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error).toMatch(/plattform_id/)
  })

  it('returns 400 when plattform_id is not a valid UUID', async () => {
    const res = await GET(req(`${BASE_URL}?plattform_id=not-a-uuid`))
    expect(res.status).toBe(400)
  })

  it('returns 200 with empty array when no einstellungen exist', async () => {
    mockFrom.mockReturnValueOnce({
      select: () => ({ eq: () => ({ eq: () => ({ limit: () => ({ data: [], error: null }) }) }) }),
    })
    const res = await GET(req(`${BASE_URL}?plattform_id=${PLATTFORM_ID}`))
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual([])
  })

  it('returns 200 with retouren data', async () => {
    mockFrom.mockReturnValueOnce({
      select: () => ({
        eq: () => ({ eq: () => ({ limit: () => ({ data: [MOCK_EINSTELLUNG], error: null }) }) }),
      }),
    })
    const res = await GET(req(`${BASE_URL}?plattform_id=${PLATTFORM_ID}`))
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body).toHaveLength(1)
    expect(body[0].berechnungsart).toBe('mittelwert_30')
    expect(body[0].rueckversandkosten_euro_netto).toBe(3.5)
    expect(body[0].retourenhandling_kosten_euro_netto).toBe(1.5)
  })

  it('returns 401 when unauthenticated', async () => {
    const { requireAuth } = await import('@/lib/supabase-server')
    vi.mocked(requireAuth).mockResolvedValueOnce({
      user: null,
      supabase: null as never,
      error: new Response('Unauthorized', { status: 401 }),
    })
    const res = await GET(req(`${BASE_URL}?plattform_id=${PLATTFORM_ID}`))
    expect(res.status).toBe(401)
  })

  it('returns 500 when db query fails', async () => {
    mockFrom.mockReturnValueOnce({
      select: () => ({
        eq: () => ({ eq: () => ({ limit: () => ({ data: null, error: { message: 'DB error' } }) }) }),
      }),
    })
    const res = await GET(req(`${BASE_URL}?plattform_id=${PLATTFORM_ID}`))
    expect(res.status).toBe(500)
  })
})

// ─── PUT ──────────────────────────────────────────────────────────────────────

describe('PUT /api/retouren-einstellungen', () => {
  function mockUpsert(result: unknown, err: { message: string } | null = null) {
    mockFrom.mockReturnValueOnce({
      upsert: () => ({
        select: () => ({ single: () => ({ data: result, error: err }) }),
      }),
    })
  }

  it('returns 200 with upserted data (all fields)', async () => {
    mockUpsert(MOCK_EINSTELLUNG)
    const res = await PUT(req(BASE_URL, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        sales_plattform_id: PLATTFORM_ID,
        produkt_id: PRODUKT_ID,
        berechnungsart: 'mittelwert_30',
        rueckversandkosten_euro_netto: 3.5,
        retourenhandling_kosten_euro_netto: 1.5,
      }),
    }))
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.berechnungsart).toBe('mittelwert_30')
    expect(body.rueckversandkosten_euro_netto).toBe(3.5)
  })

  it('returns 200 with berechnungsart "keine" (default)', async () => {
    mockUpsert({ ...MOCK_EINSTELLUNG, berechnungsart: 'keine' })
    const res = await PUT(req(BASE_URL, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        sales_plattform_id: PLATTFORM_ID,
        produkt_id: PRODUKT_ID,
      }),
    }))
    expect(res.status).toBe(200)
  })

  it('returns 200 with null cost values (clearing)', async () => {
    mockUpsert({
      ...MOCK_EINSTELLUNG,
      rueckversandkosten_euro_netto: null,
      retourenhandling_kosten_euro_netto: null,
    })
    const res = await PUT(req(BASE_URL, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        sales_plattform_id: PLATTFORM_ID,
        produkt_id: PRODUKT_ID,
        rueckversandkosten_euro_netto: null,
        retourenhandling_kosten_euro_netto: null,
      }),
    }))
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.rueckversandkosten_euro_netto).toBeNull()
    expect(body.retourenhandling_kosten_euro_netto).toBeNull()
  })

  it('returns 200 with zero cost values', async () => {
    mockUpsert({
      ...MOCK_EINSTELLUNG,
      rueckversandkosten_euro_netto: 0,
      retourenhandling_kosten_euro_netto: 0,
    })
    const res = await PUT(req(BASE_URL, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        sales_plattform_id: PLATTFORM_ID,
        produkt_id: PRODUKT_ID,
        rueckversandkosten_euro_netto: 0,
        retourenhandling_kosten_euro_netto: 0,
      }),
    }))
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.rueckversandkosten_euro_netto).toBe(0)
  })

  it('returns 400 when sales_plattform_id is missing', async () => {
    const res = await PUT(req(BASE_URL, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ produkt_id: PRODUKT_ID }),
    }))
    expect(res.status).toBe(400)
  })

  it('returns 400 when produkt_id is missing', async () => {
    const res = await PUT(req(BASE_URL, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sales_plattform_id: PLATTFORM_ID }),
    }))
    expect(res.status).toBe(400)
  })

  it('returns 400 when berechnungsart has invalid value', async () => {
    const res = await PUT(req(BASE_URL, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        sales_plattform_id: PLATTFORM_ID,
        produkt_id: PRODUKT_ID,
        berechnungsart: 'mittelwert_45',
      }),
    }))
    expect(res.status).toBe(400)
  })

  it('returns 400 when rueckversandkosten is negative', async () => {
    const res = await PUT(req(BASE_URL, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        sales_plattform_id: PLATTFORM_ID,
        produkt_id: PRODUKT_ID,
        rueckversandkosten_euro_netto: -1,
      }),
    }))
    expect(res.status).toBe(400)
  })

  it('returns 400 when retourenhandling_kosten is negative', async () => {
    const res = await PUT(req(BASE_URL, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        sales_plattform_id: PLATTFORM_ID,
        produkt_id: PRODUKT_ID,
        retourenhandling_kosten_euro_netto: -5,
      }),
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
      body: JSON.stringify({
        sales_plattform_id: PLATTFORM_ID,
        produkt_id: PRODUKT_ID,
      }),
    }))
    expect(res.status).toBe(401)
  })

  it('returns 500 when db upsert fails', async () => {
    mockUpsert(null, { message: 'DB error' })
    const res = await PUT(req(BASE_URL, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        sales_plattform_id: PLATTFORM_ID,
        produkt_id: PRODUKT_ID,
      }),
    }))
    expect(res.status).toBe(500)
  })
})
