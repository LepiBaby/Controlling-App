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

// UUIDs with valid version (1-8) and variant (8-b) bits for Zod v4 compatibility
const PLATTFORM_ID = '11111111-1111-1111-8111-111111111111'
const PRODUKT_ID   = '22222222-2222-2222-8222-222222222222'
const EINTRAG_ID   = '33333333-3333-3333-8333-333333333333'

const MOCK_EINSTELLUNG = {
  id: EINTRAG_ID,
  sales_plattform_id: PLATTFORM_ID,
  produkt_id: PRODUKT_ID,
  berechnungsart: 'mittelwert_30',
  gewichtung_erstes_drittel: null,
  gewichtung_zweites_drittel: null,
  gewichtung_drittes_drittel: null,
}

beforeEach(() => {
  vi.clearAllMocks()
  mockFrom.mockReset()
})

// ─── GET ──────────────────────────────────────────────────────────────────────

describe('GET /api/marketing-einstellungen', () => {
  it('returns 400 when plattform_id is missing', async () => {
    const res = await GET(req('http://localhost/api/marketing-einstellungen'))
    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error).toMatch(/plattform_id/)
  })

  it('returns 400 when plattform_id is not a valid UUID', async () => {
    const res = await GET(req('http://localhost/api/marketing-einstellungen?plattform_id=not-a-uuid'))
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

    const res = await GET(req(`http://localhost/api/marketing-einstellungen?plattform_id=${PLATTFORM_ID}`))
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

    const res = await GET(req(`http://localhost/api/marketing-einstellungen?plattform_id=${PLATTFORM_ID}`))
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body).toHaveLength(1)
    expect(body[0].berechnungsart).toBe('mittelwert_30')
    expect(body[0].sales_plattform_id).toBe(PLATTFORM_ID)
  })

  it('returns 401 when unauthenticated', async () => {
    const { requireAuth } = await import('@/lib/supabase-server')
    vi.mocked(requireAuth).mockResolvedValueOnce({
      user: null, supabase: null as never,
      error: new Response('Unauthorized', { status: 401 }),
    })
    const res = await GET(req(`http://localhost/api/marketing-einstellungen?plattform_id=${PLATTFORM_ID}`))
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

    const res = await GET(req(`http://localhost/api/marketing-einstellungen?plattform_id=${PLATTFORM_ID}`))
    expect(res.status).toBe(500)
  })
})

// ─── PUT ──────────────────────────────────────────────────────────────────────

describe('PUT /api/marketing-einstellungen', () => {
  function upsertMock(returnData: Record<string, unknown> | null, returnError: { message: string } | null = null) {
    mockFrom.mockReturnValueOnce({
      upsert: () => ({
        select: () => ({
          single: () => ({ data: returnData, error: returnError }),
        }),
      }),
    })
  }

  it('returns 200 on upsert with non-gewichtet berechnungsart', async () => {
    upsertMock(MOCK_EINSTELLUNG)

    const res = await PUT(req('http://localhost/api/marketing-einstellungen', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        sales_plattform_id: PLATTFORM_ID,
        produkt_id: PRODUKT_ID,
        berechnungsart: 'mittelwert_30',
      }),
    }))
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.id).toBe(EINTRAG_ID)
    expect(body.berechnungsart).toBe('mittelwert_30')
  })

  it('returns 200 on upsert with "keine"', async () => {
    upsertMock({ ...MOCK_EINSTELLUNG, berechnungsart: 'keine' })

    const res = await PUT(req('http://localhost/api/marketing-einstellungen', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        sales_plattform_id: PLATTFORM_ID,
        produkt_id: PRODUKT_ID,
        berechnungsart: 'keine',
      }),
    }))
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.berechnungsart).toBe('keine')
  })

  it('returns 200 on upsert with gewichtet berechnungsart and valid weights (sum = 100)', async () => {
    upsertMock({
      ...MOCK_EINSTELLUNG,
      berechnungsart: 'gewichtet_30',
      gewichtung_erstes_drittel: 50,
      gewichtung_zweites_drittel: 30,
      gewichtung_drittes_drittel: 20,
    })

    const res = await PUT(req('http://localhost/api/marketing-einstellungen', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        sales_plattform_id: PLATTFORM_ID,
        produkt_id: PRODUKT_ID,
        berechnungsart: 'gewichtet_30',
        gewichtung_erstes_drittel: 50,
        gewichtung_zweites_drittel: 30,
        gewichtung_drittes_drittel: 20,
      }),
    }))
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.gewichtung_erstes_drittel).toBe(50)
  })

  it('returns 200 on upsert with gewichtet berechnungsart and null weights (intermediate state)', async () => {
    upsertMock({ ...MOCK_EINSTELLUNG, berechnungsart: 'gewichtet_60' })

    const res = await PUT(req('http://localhost/api/marketing-einstellungen', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        sales_plattform_id: PLATTFORM_ID,
        produkt_id: PRODUKT_ID,
        berechnungsart: 'gewichtet_60',
      }),
    }))
    expect(res.status).toBe(200)
  })

  it('returns 400 when gewichtet and weights sum is not 100', async () => {
    const res = await PUT(req('http://localhost/api/marketing-einstellungen', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        sales_plattform_id: PLATTFORM_ID,
        produkt_id: PRODUKT_ID,
        berechnungsart: 'gewichtet_30',
        gewichtung_erstes_drittel: 40,
        gewichtung_zweites_drittel: 30,
        gewichtung_drittes_drittel: 20,
      }),
    }))
    expect(res.status).toBe(400)
    const body = await res.json()
    expect(JSON.stringify(body)).toContain('100')
  })

  it('returns 400 when berechnungsart is invalid', async () => {
    const res = await PUT(req('http://localhost/api/marketing-einstellungen', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        sales_plattform_id: PLATTFORM_ID,
        produkt_id: PRODUKT_ID,
        berechnungsart: 'ungueltig',
      }),
    }))
    expect(res.status).toBe(400)
  })

  it('returns 400 when sales_plattform_id is not a valid UUID', async () => {
    const res = await PUT(req('http://localhost/api/marketing-einstellungen', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        sales_plattform_id: 'not-a-uuid',
        produkt_id: PRODUKT_ID,
        berechnungsart: 'keine',
      }),
    }))
    expect(res.status).toBe(400)
  })

  it('returns 400 when produkt_id is missing', async () => {
    const res = await PUT(req('http://localhost/api/marketing-einstellungen', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        sales_plattform_id: PLATTFORM_ID,
        berechnungsart: 'keine',
      }),
    }))
    expect(res.status).toBe(400)
  })

  it('returns 400 when weight exceeds 100', async () => {
    const res = await PUT(req('http://localhost/api/marketing-einstellungen', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        sales_plattform_id: PLATTFORM_ID,
        produkt_id: PRODUKT_ID,
        berechnungsart: 'gewichtet_90',
        gewichtung_erstes_drittel: 110,
        gewichtung_zweites_drittel: 0,
        gewichtung_drittes_drittel: 0,
      }),
    }))
    expect(res.status).toBe(400)
  })

  it('returns 400 when body is not valid JSON', async () => {
    const res = await PUT(req('http://localhost/api/marketing-einstellungen', {
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
    const res = await PUT(req('http://localhost/api/marketing-einstellungen', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        sales_plattform_id: PLATTFORM_ID,
        produkt_id: PRODUKT_ID,
        berechnungsart: 'keine',
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

    const res = await PUT(req('http://localhost/api/marketing-einstellungen', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        sales_plattform_id: PLATTFORM_ID,
        produkt_id: PRODUKT_ID,
        berechnungsart: 'keine',
      }),
    }))
    expect(res.status).toBe(500)
  })
})
