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

const BASE_URL = 'http://localhost/api/versandausgaben-plattform-einstellungen'
const PLATTFORM_ID = '11111111-1111-1111-8111-111111111111'
const MOCK_EINSTELLUNGEN = { gruppierung: 'monatlich', zahlungsziel_tage: 30 }

beforeEach(() => {
  vi.clearAllMocks()
  mockFrom.mockReset()
})

// ─── GET ──────────────────────────────────────────────────────────────────────

describe('GET /api/versandausgaben-plattform-einstellungen', () => {
  it('returns 400 when plattform_id is missing', async () => {
    const res = await GET(req(BASE_URL))
    expect(res.status).toBe(400)
    expect((await res.json()).error).toMatch(/plattform_id/)
  })

  it('returns 400 when plattform_id is not a valid UUID', async () => {
    const res = await GET(req(`${BASE_URL}?plattform_id=not-a-uuid`))
    expect(res.status).toBe(400)
  })

  it('returns 200 with null when no entry exists', async () => {
    mockFrom.mockReturnValueOnce({
      select: () => ({ eq: () => ({ eq: () => ({ maybeSingle: () => ({ data: null, error: null }) }) }) }),
    })
    const res = await GET(req(`${BASE_URL}?plattform_id=${PLATTFORM_ID}`))
    expect(res.status).toBe(200)
    expect(await res.json()).toBeNull()
  })

  it('returns 200 with einstellungen when entry exists', async () => {
    mockFrom.mockReturnValueOnce({
      select: () => ({ eq: () => ({ eq: () => ({ maybeSingle: () => ({ data: MOCK_EINSTELLUNGEN, error: null }) }) }) }),
    })
    const res = await GET(req(`${BASE_URL}?plattform_id=${PLATTFORM_ID}`))
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.gruppierung).toBe('monatlich')
    expect(body.zahlungsziel_tage).toBe(30)
  })

  it('returns 401 when unauthenticated', async () => {
    const { requireAuth } = await import('@/lib/supabase-server')
    vi.mocked(requireAuth).mockResolvedValueOnce({ user: null, supabase: null as never, error: new Response('Unauthorized', { status: 401 }) })
    const res = await GET(req(`${BASE_URL}?plattform_id=${PLATTFORM_ID}`))
    expect(res.status).toBe(401)
  })

  it('returns 500 when db query fails', async () => {
    mockFrom.mockReturnValueOnce({
      select: () => ({ eq: () => ({ eq: () => ({ maybeSingle: () => ({ data: null, error: { message: 'DB error' } }) }) }) }),
    })
    const res = await GET(req(`${BASE_URL}?plattform_id=${PLATTFORM_ID}`))
    expect(res.status).toBe(500)
  })
})

// ─── PUT ──────────────────────────────────────────────────────────────────────

describe('PUT /api/versandausgaben-plattform-einstellungen', () => {
  function mockSelectAndUpsert(
    current: Record<string, unknown> | null,
    upserted: Record<string, unknown> | null,
    upsertErr: { message: string } | null = null
  ) {
    mockFrom.mockReturnValueOnce({
      select: () => ({ eq: () => ({ eq: () => ({ maybeSingle: () => ({ data: current, error: null }) }) }) }),
    })
    mockFrom.mockReturnValueOnce({
      upsert: () => ({ select: () => ({ single: () => ({ data: upserted, error: upsertErr }) }) }),
    })
  }

  it('returns 200 updating gruppierung only (zahlungsziel preserved)', async () => {
    mockSelectAndUpsert(
      { gruppierung: 'woechentlich', zahlungsziel_tage: 14 },
      { gruppierung: 'monatlich', zahlungsziel_tage: 14 }
    )
    const res = await PUT(req(BASE_URL, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sales_plattform_id: PLATTFORM_ID, gruppierung: 'monatlich' }),
    }))
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.gruppierung).toBe('monatlich')
    expect(body.zahlungsziel_tage).toBe(14)
  })

  it('returns 200 updating zahlungsziel only (gruppierung preserved)', async () => {
    mockSelectAndUpsert(
      { gruppierung: 'monatlich', zahlungsziel_tage: null },
      { gruppierung: 'monatlich', zahlungsziel_tage: 30 }
    )
    const res = await PUT(req(BASE_URL, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sales_plattform_id: PLATTFORM_ID, zahlungsziel_tage: 30 }),
    }))
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.zahlungsziel_tage).toBe(30)
  })

  it('returns 200 clearing zahlungsziel (null)', async () => {
    mockSelectAndUpsert(
      { gruppierung: 'monatlich', zahlungsziel_tage: 30 },
      { gruppierung: 'monatlich', zahlungsziel_tage: null }
    )
    const res = await PUT(req(BASE_URL, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sales_plattform_id: PLATTFORM_ID, zahlungsziel_tage: null }),
    }))
    expect(res.status).toBe(200)
    expect((await res.json()).zahlungsziel_tage).toBeNull()
  })

  it('returns 200 on first-time upsert (no current row)', async () => {
    mockSelectAndUpsert(null, { gruppierung: 'quartalsweise', zahlungsziel_tage: null })
    const res = await PUT(req(BASE_URL, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sales_plattform_id: PLATTFORM_ID, gruppierung: 'quartalsweise' }),
    }))
    expect(res.status).toBe(200)
  })

  it('returns 400 when sales_plattform_id is missing', async () => {
    const res = await PUT(req(BASE_URL, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ gruppierung: 'monatlich' }),
    }))
    expect(res.status).toBe(400)
  })

  it('returns 400 when gruppierung has invalid value', async () => {
    const res = await PUT(req(BASE_URL, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sales_plattform_id: PLATTFORM_ID, gruppierung: 'taglich' }),
    }))
    expect(res.status).toBe(400)
  })

  it('returns 400 when zahlungsziel_tage is negative', async () => {
    const res = await PUT(req(BASE_URL, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sales_plattform_id: PLATTFORM_ID, zahlungsziel_tage: -5 }),
    }))
    expect(res.status).toBe(400)
  })

  it('returns 400 when zahlungsziel_tage is a decimal', async () => {
    const res = await PUT(req(BASE_URL, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sales_plattform_id: PLATTFORM_ID, zahlungsziel_tage: 3.5 }),
    }))
    expect(res.status).toBe(400)
  })

  it('returns 400 when body has no recognised patch fields', async () => {
    const res = await PUT(req(BASE_URL, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sales_plattform_id: PLATTFORM_ID }),
    }))
    expect(res.status).toBe(400)
  })

  it('returns 401 when unauthenticated', async () => {
    const { requireAuth } = await import('@/lib/supabase-server')
    vi.mocked(requireAuth).mockResolvedValueOnce({ user: null, supabase: null as never, error: new Response('Unauthorized', { status: 401 }) })
    const res = await PUT(req(BASE_URL, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sales_plattform_id: PLATTFORM_ID, gruppierung: 'monatlich' }),
    }))
    expect(res.status).toBe(401)
  })

  it('returns 500 when db upsert fails', async () => {
    mockFrom.mockReturnValueOnce({
      select: () => ({ eq: () => ({ eq: () => ({ maybeSingle: () => ({ data: null, error: null }) }) }) }),
    })
    mockFrom.mockReturnValueOnce({
      upsert: () => ({ select: () => ({ single: () => ({ data: null, error: { message: 'DB error' } }) }) }),
    })
    const res = await PUT(req(BASE_URL, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sales_plattform_id: PLATTFORM_ID, gruppierung: 'monatlich' }),
    }))
    expect(res.status).toBe(500)
  })
})
