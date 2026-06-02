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

const BASE_URL     = 'http://localhost/api/ersatzteile-kulanz-plattform-einstellungen'
const PLATTFORM_ID = '11111111-1111-1111-8111-111111111111'

const MOCK_EINSTELLUNGEN = {
  gruppierung: 'monatlich',
  naechste_zahlung_basis_kw: 26,
  naechste_zahlung_basis_jahr: 2026,
  zahlungsziel_tage: 30,
}

beforeEach(() => {
  vi.clearAllMocks()
  mockFrom.mockReset()
})

// ─── GET ──────────────────────────────────────────────────────────────────────

describe('GET /api/ersatzteile-kulanz-plattform-einstellungen', () => {
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

  it('returns 200 with all einstellungen when entry exists', async () => {
    mockFrom.mockReturnValueOnce({
      select: () => ({
        eq: () => ({
          eq: () => ({ maybeSingle: () => ({ data: MOCK_EINSTELLUNGEN, error: null }) }),
        }),
      }),
    })
    const res = await GET(req(`${BASE_URL}?plattform_id=${PLATTFORM_ID}`))
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.gruppierung).toBe('monatlich')
    expect(body.naechste_zahlung_basis_kw).toBe(26)
    expect(body.zahlungsziel_tage).toBe(30)
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
        eq: () => ({
          eq: () => ({ maybeSingle: () => ({ data: null, error: { message: 'DB error' } }) }),
        }),
      }),
    })
    const res = await GET(req(`${BASE_URL}?plattform_id=${PLATTFORM_ID}`))
    expect(res.status).toBe(500)
  })
})

// ─── PUT ──────────────────────────────────────────────────────────────────────

describe('PUT /api/ersatzteile-kulanz-plattform-einstellungen', () => {
  function mockFetchThenUpsert(
    current: unknown,
    upserted: unknown,
    upsertErr: { message: string } | null = null
  ) {
    mockFrom
      .mockReturnValueOnce({
        select: () => ({ eq: () => ({ eq: () => ({ maybeSingle: () => ({ data: current, error: null }) }) }) }),
      })
      .mockReturnValueOnce({
        upsert: () => ({
          select: () => ({ single: () => ({ data: upserted, error: upsertErr }) }),
        }),
      })
  }

  it('returns 200 when updating gruppierung', async () => {
    mockFetchThenUpsert(MOCK_EINSTELLUNGEN, { ...MOCK_EINSTELLUNGEN, gruppierung: 'woechentlich' })
    const res = await PUT(req(BASE_URL, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sales_plattform_id: PLATTFORM_ID, gruppierung: 'woechentlich' }),
    }))
    expect(res.status).toBe(200)
    expect((await res.json()).gruppierung).toBe('woechentlich')
  })

  it('returns 200 when updating zahlungsziel', async () => {
    mockFetchThenUpsert(MOCK_EINSTELLUNGEN, { ...MOCK_EINSTELLUNGEN, zahlungsziel_tage: 14 })
    const res = await PUT(req(BASE_URL, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sales_plattform_id: PLATTFORM_ID, zahlungsziel_tage: 14 }),
    }))
    expect(res.status).toBe(200)
    expect((await res.json()).zahlungsziel_tage).toBe(14)
  })

  it('returns 200 when clearing zahlungsziel (null)', async () => {
    mockFetchThenUpsert(MOCK_EINSTELLUNGEN, { ...MOCK_EINSTELLUNGEN, zahlungsziel_tage: null })
    const res = await PUT(req(BASE_URL, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sales_plattform_id: PLATTFORM_ID, zahlungsziel_tage: null }),
    }))
    expect(res.status).toBe(200)
    expect((await res.json()).zahlungsziel_tage).toBeNull()
  })

  it('returns 200 when setting KW/Jahr basis', async () => {
    mockFetchThenUpsert(
      MOCK_EINSTELLUNGEN,
      { ...MOCK_EINSTELLUNGEN, naechste_zahlung_basis_kw: 30, naechste_zahlung_basis_jahr: 2026 }
    )
    const res = await PUT(req(BASE_URL, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        sales_plattform_id: PLATTFORM_ID,
        naechste_zahlung_basis_kw: 30,
        naechste_zahlung_basis_jahr: 2026,
      }),
    }))
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.naechste_zahlung_basis_kw).toBe(30)
    expect(body.naechste_zahlung_basis_jahr).toBe(2026)
  })

  it('returns 200 when clearing KW basis (null, null)', async () => {
    mockFetchThenUpsert(
      MOCK_EINSTELLUNGEN,
      { ...MOCK_EINSTELLUNGEN, naechste_zahlung_basis_kw: null, naechste_zahlung_basis_jahr: null }
    )
    const res = await PUT(req(BASE_URL, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        sales_plattform_id: PLATTFORM_ID,
        naechste_zahlung_basis_kw: null,
        naechste_zahlung_basis_jahr: null,
      }),
    }))
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.naechste_zahlung_basis_kw).toBeNull()
    expect(body.naechste_zahlung_basis_jahr).toBeNull()
  })

  it('returns 200 creating new entry when none exists (uses defaults)', async () => {
    mockFetchThenUpsert(null, { gruppierung: 'monatlich', naechste_zahlung_basis_kw: null, naechste_zahlung_basis_jahr: null, zahlungsziel_tage: null })
    const res = await PUT(req(BASE_URL, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sales_plattform_id: PLATTFORM_ID, zahlungsziel_tage: null }),
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

  it('returns 400 when no patch fields are provided', async () => {
    const res = await PUT(req(BASE_URL, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sales_plattform_id: PLATTFORM_ID }),
    }))
    expect(res.status).toBe(400)
  })

  it('returns 400 when gruppierung has invalid value', async () => {
    const res = await PUT(req(BASE_URL, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sales_plattform_id: PLATTFORM_ID, gruppierung: 'jaehrlich' }),
    }))
    expect(res.status).toBe(400)
  })

  it('returns 400 when KW exceeds 53', async () => {
    const res = await PUT(req(BASE_URL, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sales_plattform_id: PLATTFORM_ID, naechste_zahlung_basis_kw: 54 }),
    }))
    expect(res.status).toBe(400)
  })

  it('returns 400 when zahlungsziel_tage is negative', async () => {
    const res = await PUT(req(BASE_URL, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sales_plattform_id: PLATTFORM_ID, zahlungsziel_tage: -1 }),
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
      body: JSON.stringify({ sales_plattform_id: PLATTFORM_ID, gruppierung: 'monatlich' }),
    }))
    expect(res.status).toBe(401)
  })

  it('returns 500 when db upsert fails', async () => {
    mockFetchThenUpsert(MOCK_EINSTELLUNGEN, null, { message: 'DB error' })
    const res = await PUT(req(BASE_URL, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sales_plattform_id: PLATTFORM_ID, gruppierung: 'woechentlich' }),
    }))
    expect(res.status).toBe(500)
  })
})
