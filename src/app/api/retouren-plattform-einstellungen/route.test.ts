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

const BASE_URL     = 'http://localhost/api/retouren-plattform-einstellungen'
const PLATTFORM_ID = '11111111-1111-1111-8111-111111111111'

const MOCK_EINSTELLUNGEN = {
  gruppierung: 'monatlich',
  naechste_zahlung_basis_kw: 26,
  naechste_zahlung_basis_jahr: 2026,
  zahlungsziel_tage: 30,
  erstattung_verkaufsgebuehr_prozent: 50,
}

beforeEach(() => {
  vi.clearAllMocks()
  mockFrom.mockReset()
})

// ─── GET ──────────────────────────────────────────────────────────────────────

describe('GET /api/retouren-plattform-einstellungen', () => {
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
    expect(body.erstattung_verkaufsgebuehr_prozent).toBe(50)
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

describe('PUT /api/retouren-plattform-einstellungen', () => {
  function mockSelectAndUpsert(
    current: Record<string, unknown> | null,
    upserted: Record<string, unknown> | null,
    upsertErr: { message: string } | null = null
  ) {
    mockFrom.mockReturnValueOnce({
      select: () => ({
        eq: () => ({ eq: () => ({ maybeSingle: () => ({ data: current, error: null }) }) }),
      }),
    })
    mockFrom.mockReturnValueOnce({
      upsert: () => ({ select: () => ({ single: () => ({ data: upserted, error: upsertErr }) }) }),
    })
  }

  it('returns 200 updating gruppierung (other fields preserved)', async () => {
    mockSelectAndUpsert(
      { gruppierung: 'woechentlich', zahlungsziel_tage: 14, naechste_zahlung_basis_kw: null, naechste_zahlung_basis_jahr: null, erstattung_verkaufsgebuehr_prozent: 50 },
      { gruppierung: 'monatlich', zahlungsziel_tage: 14, naechste_zahlung_basis_kw: null, naechste_zahlung_basis_jahr: null, erstattung_verkaufsgebuehr_prozent: 50 }
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
    expect(body.erstattung_verkaufsgebuehr_prozent).toBe(50)
  })

  it('returns 200 setting KW/Jahr basis', async () => {
    mockSelectAndUpsert(
      { gruppierung: 'monatlich', zahlungsziel_tage: null, naechste_zahlung_basis_kw: null, naechste_zahlung_basis_jahr: null, erstattung_verkaufsgebuehr_prozent: null },
      { ...MOCK_EINSTELLUNGEN }
    )
    const res = await PUT(req(BASE_URL, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        sales_plattform_id: PLATTFORM_ID,
        naechste_zahlung_basis_kw: 26,
        naechste_zahlung_basis_jahr: 2026,
      }),
    }))
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.naechste_zahlung_basis_kw).toBe(26)
    expect(body.naechste_zahlung_basis_jahr).toBe(2026)
  })

  it('returns 200 setting erstattung_verkaufsgebuehr_prozent', async () => {
    mockSelectAndUpsert(
      { gruppierung: 'monatlich', zahlungsziel_tage: null, naechste_zahlung_basis_kw: null, naechste_zahlung_basis_jahr: null, erstattung_verkaufsgebuehr_prozent: null },
      { ...MOCK_EINSTELLUNGEN, erstattung_verkaufsgebuehr_prozent: 75.5 }
    )
    const res = await PUT(req(BASE_URL, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sales_plattform_id: PLATTFORM_ID, erstattung_verkaufsgebuehr_prozent: 75.5 }),
    }))
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.erstattung_verkaufsgebuehr_prozent).toBe(75.5)
  })

  it('returns 200 clearing erstattung (null)', async () => {
    mockSelectAndUpsert(
      { gruppierung: 'monatlich', zahlungsziel_tage: null, naechste_zahlung_basis_kw: null, naechste_zahlung_basis_jahr: null, erstattung_verkaufsgebuehr_prozent: 50 },
      { ...MOCK_EINSTELLUNGEN, erstattung_verkaufsgebuehr_prozent: null }
    )
    const res = await PUT(req(BASE_URL, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sales_plattform_id: PLATTFORM_ID, erstattung_verkaufsgebuehr_prozent: null }),
    }))
    expect(res.status).toBe(200)
    expect((await res.json()).erstattung_verkaufsgebuehr_prozent).toBeNull()
  })

  it('returns 200 clearing zahlungsziel (null)', async () => {
    mockSelectAndUpsert(
      { gruppierung: 'monatlich', zahlungsziel_tage: 30, naechste_zahlung_basis_kw: null, naechste_zahlung_basis_jahr: null, erstattung_verkaufsgebuehr_prozent: null },
      { gruppierung: 'monatlich', zahlungsziel_tage: null, naechste_zahlung_basis_kw: null, naechste_zahlung_basis_jahr: null, erstattung_verkaufsgebuehr_prozent: null }
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
    mockSelectAndUpsert(
      null,
      { gruppierung: 'quartalsweise', zahlungsziel_tage: null, naechste_zahlung_basis_kw: null, naechste_zahlung_basis_jahr: null, erstattung_verkaufsgebuehr_prozent: null }
    )
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

  it('returns 400 when KW is out of range', async () => {
    const res = await PUT(req(BASE_URL, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        sales_plattform_id: PLATTFORM_ID,
        naechste_zahlung_basis_kw: 54,
        naechste_zahlung_basis_jahr: 2026,
      }),
    }))
    expect(res.status).toBe(400)
  })

  it('returns 400 when erstattung > 100', async () => {
    const res = await PUT(req(BASE_URL, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sales_plattform_id: PLATTFORM_ID, erstattung_verkaufsgebuehr_prozent: 101 }),
    }))
    expect(res.status).toBe(400)
  })

  it('returns 400 when erstattung is negative', async () => {
    const res = await PUT(req(BASE_URL, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sales_plattform_id: PLATTFORM_ID, erstattung_verkaufsgebuehr_prozent: -1 }),
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
    mockFrom.mockReturnValueOnce({
      select: () => ({
        eq: () => ({ eq: () => ({ maybeSingle: () => ({ data: null, error: null }) }) }),
      }),
    })
    mockFrom.mockReturnValueOnce({
      upsert: () => ({
        select: () => ({ single: () => ({ data: null, error: { message: 'DB error' } }) }),
      }),
    })
    const res = await PUT(req(BASE_URL, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sales_plattform_id: PLATTFORM_ID, gruppierung: 'monatlich' }),
    }))
    expect(res.status).toBe(500)
  })
})
