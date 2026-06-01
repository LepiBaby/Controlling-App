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

// UUIDs with valid version and variant bits for Zod v4 compatibility
const PLATTFORM_ID = '11111111-1111-1111-8111-111111111111'

const MOCK_EINSTELLUNG = {
  sales_plattform_id: PLATTFORM_ID,
  auszahlungsrhythmus: 'alle_zwei_wochen',
  naechste_auszahlung_basis_kw: 24,
  naechste_auszahlung_basis_jahr: 2026,
  retouren_inkludiert: true,
  marketing_inkludiert: false,
}

beforeEach(() => {
  vi.clearAllMocks()
  mockFrom.mockReset()
})

// ─── GET ──────────────────────────────────────────────────────────────────────

describe('GET /api/auszahlungs-einstellungen', () => {
  it('returns 400 when plattform_id is missing', async () => {
    const res = await GET(req('http://localhost/api/auszahlungs-einstellungen'))
    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error).toMatch(/plattform_id/)
  })

  it('returns 400 when plattform_id is not a valid UUID', async () => {
    const res = await GET(req('http://localhost/api/auszahlungs-einstellungen?plattform_id=not-a-uuid'))
    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error).toMatch(/plattform_id/)
  })

  it('returns 200 with null when no einstellung exists for this platform', async () => {
    mockFrom.mockReturnValueOnce({
      select: () => ({
        eq: () => ({
          eq: () => ({
            maybeSingle: () => ({ data: null, error: null }),
          }),
        }),
      }),
    })

    const res = await GET(req(`http://localhost/api/auszahlungs-einstellungen?plattform_id=${PLATTFORM_ID}`))
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body).toBeNull()
  })

  it('returns 200 with einstellung for the given platform', async () => {
    mockFrom.mockReturnValueOnce({
      select: () => ({
        eq: () => ({
          eq: () => ({
            maybeSingle: () => ({ data: MOCK_EINSTELLUNG, error: null }),
          }),
        }),
      }),
    })

    const res = await GET(req(`http://localhost/api/auszahlungs-einstellungen?plattform_id=${PLATTFORM_ID}`))
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.auszahlungsrhythmus).toBe('alle_zwei_wochen')
    expect(body.naechste_auszahlung_basis_kw).toBe(24)
    expect(body.naechste_auszahlung_basis_jahr).toBe(2026)
    expect(body.retouren_inkludiert).toBe(true)
    expect(body.marketing_inkludiert).toBe(false)
  })

  it('returns 401 when unauthenticated', async () => {
    const { requireAuth } = await import('@/lib/supabase-server')
    vi.mocked(requireAuth).mockResolvedValueOnce({
      user: null, supabase: null as never,
      error: new Response('Unauthorized', { status: 401 }),
    })
    const res = await GET(req(`http://localhost/api/auszahlungs-einstellungen?plattform_id=${PLATTFORM_ID}`))
    expect(res.status).toBe(401)
  })

  it('returns 500 when db query fails', async () => {
    mockFrom.mockReturnValueOnce({
      select: () => ({
        eq: () => ({
          eq: () => ({
            maybeSingle: () => ({ data: null, error: { message: 'DB error' } }),
          }),
        }),
      }),
    })

    const res = await GET(req(`http://localhost/api/auszahlungs-einstellungen?plattform_id=${PLATTFORM_ID}`))
    expect(res.status).toBe(500)
  })
})

// ─── PUT ──────────────────────────────────────────────────────────────────────

describe('PUT /api/auszahlungs-einstellungen', () => {
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

  const validBody = {
    sales_plattform_id: PLATTFORM_ID,
    auszahlungsrhythmus: 'alle_zwei_wochen',
    naechste_auszahlung_basis_kw: 24,
    naechste_auszahlung_basis_jahr: 2026,
    retouren_inkludiert: true,
    marketing_inkludiert: false,
  }

  it('returns 200 on successful upsert with all fields', async () => {
    upsertMock(MOCK_EINSTELLUNG)

    const res = await PUT(req('http://localhost/api/auszahlungs-einstellungen', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(validBody),
    }))
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.auszahlungsrhythmus).toBe('alle_zwei_wochen')
    expect(body.retouren_inkludiert).toBe(true)
  })

  it('returns 200 with null KW and Jahr (clear basis)', async () => {
    upsertMock({ ...MOCK_EINSTELLUNG, naechste_auszahlung_basis_kw: null, naechste_auszahlung_basis_jahr: null })

    const res = await PUT(req('http://localhost/api/auszahlungs-einstellungen', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ...validBody,
        naechste_auszahlung_basis_kw: null,
        naechste_auszahlung_basis_jahr: null,
      }),
    }))
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.naechste_auszahlung_basis_kw).toBeNull()
    expect(body.naechste_auszahlung_basis_jahr).toBeNull()
  })

  it('returns 200 with "woechentlich" rhythmus', async () => {
    upsertMock({ ...MOCK_EINSTELLUNG, auszahlungsrhythmus: 'woechentlich' })

    const res = await PUT(req('http://localhost/api/auszahlungs-einstellungen', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...validBody, auszahlungsrhythmus: 'woechentlich' }),
    }))
    expect(res.status).toBe(200)
  })

  it('returns 400 when only KW is set but not Jahr', async () => {
    const res = await PUT(req('http://localhost/api/auszahlungs-einstellungen', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ...validBody,
        naechste_auszahlung_basis_kw: 24,
        naechste_auszahlung_basis_jahr: null,
      }),
    }))
    expect(res.status).toBe(400)
    const body = await res.json()
    expect(JSON.stringify(body)).toContain('basis')
  })

  it('returns 400 when only Jahr is set but not KW', async () => {
    const res = await PUT(req('http://localhost/api/auszahlungs-einstellungen', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ...validBody,
        naechste_auszahlung_basis_kw: null,
        naechste_auszahlung_basis_jahr: 2026,
      }),
    }))
    expect(res.status).toBe(400)
  })

  it('returns 400 when KW is out of range (> 53)', async () => {
    const res = await PUT(req('http://localhost/api/auszahlungs-einstellungen', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...validBody, naechste_auszahlung_basis_kw: 54 }),
    }))
    expect(res.status).toBe(400)
  })

  it('returns 400 when KW is out of range (< 1)', async () => {
    const res = await PUT(req('http://localhost/api/auszahlungs-einstellungen', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...validBody, naechste_auszahlung_basis_kw: 0 }),
    }))
    expect(res.status).toBe(400)
  })

  it('returns 400 when Jahr is before 2024', async () => {
    const res = await PUT(req('http://localhost/api/auszahlungs-einstellungen', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...validBody, naechste_auszahlung_basis_jahr: 2023 }),
    }))
    expect(res.status).toBe(400)
  })

  it('returns 400 when auszahlungsrhythmus is invalid', async () => {
    const res = await PUT(req('http://localhost/api/auszahlungs-einstellungen', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...validBody, auszahlungsrhythmus: 'alle_fuenf_wochen' }),
    }))
    expect(res.status).toBe(400)
  })

  it('returns 400 when sales_plattform_id is not a valid UUID', async () => {
    const res = await PUT(req('http://localhost/api/auszahlungs-einstellungen', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...validBody, sales_plattform_id: 'not-a-uuid' }),
    }))
    expect(res.status).toBe(400)
  })

  it('returns 400 when body is not valid JSON', async () => {
    const res = await PUT(req('http://localhost/api/auszahlungs-einstellungen', {
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
    const res = await PUT(req('http://localhost/api/auszahlungs-einstellungen', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(validBody),
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

    const res = await PUT(req('http://localhost/api/auszahlungs-einstellungen', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(validBody),
    }))
    expect(res.status).toBe(500)
  })
})
