import { describe, it, expect, vi, beforeEach } from 'vitest'
import { GET, POST } from './route'

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

const PRODUKT_ID  = '123e4567-e89b-12d3-a456-426614174000'
const KAT_ID      = '223e4567-e89b-12d3-a456-426614174001'
const ZEITRAUM_ID = '323e4567-e89b-12d3-a456-426614174002'

const MOCK_ZEITRAUM = {
  id:          ZEITRAUM_ID,
  produkt_id:  PRODUKT_ID,
  gueltig_von: '2024-01-01',
  gueltig_bis: '2024-12-31',
  created_at:  '2024-01-01T10:00:00Z',
}

const VALID_POST_BODY = {
  produkt_id:  PRODUKT_ID,
  gueltig_von: '2024-01-01',
  gueltig_bis: '2024-12-31',  // optional field — null also valid
  werte: [{ kategorie_id: KAT_ID, wert: 5.50 }],
}

beforeEach(() => {
  vi.clearAllMocks()
})

// ─── GET ──────────────────────────────────────────────────────────────────────

describe('GET /api/produktkosten', () => {
  it('returns 400 when produkt_id is missing', async () => {
    const res = await GET(req('http://localhost/api/produktkosten'))
    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error).toMatch(/produkt_id/)
  })

  it('returns 200 with data array', async () => {
    mockFrom.mockReturnValueOnce({
      select: () => ({
        eq: () => ({
          order: () => ({ data: [{ ...MOCK_ZEITRAUM, werte: [] }], error: null }),
        }),
      }),
    })

    const res = await GET(req(`http://localhost/api/produktkosten?produkt_id=${PRODUKT_ID}`))
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body).toHaveProperty('data')
    expect(Array.isArray(body.data)).toBe(true)
  })

  it('returns 401 when unauthenticated', async () => {
    const { requireAuth } = await import('@/lib/supabase-server')
    vi.mocked(requireAuth).mockResolvedValueOnce({
      user: null,
      supabase: null as never,
      error: new Response('Unauthorized', { status: 401 }),
    })
    const res = await GET(req(`http://localhost/api/produktkosten?produkt_id=${PRODUKT_ID}`))
    expect(res.status).toBe(401)
  })
})

// ─── POST ─────────────────────────────────────────────────────────────────────

describe('POST /api/produktkosten', () => {
  it('returns 201 on valid input', async () => {
    mockFrom
      .mockReturnValueOnce({
        select: () => ({
          eq: () => ({
            or: () => ({
              lte: () => ({ data: [], error: null }),
            }),
          }),
        }),
      })
      .mockReturnValueOnce({
        insert: () => ({
          select: () => ({
            single: () => ({ data: MOCK_ZEITRAUM, error: null }),
          }),
        }),
      })
      .mockReturnValueOnce({
        insert: () => ({ error: null }),
      })

    const res = await POST(req('http://localhost/api/produktkosten', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(VALID_POST_BODY),
    }))
    expect(res.status).toBe(201)
    const body = await res.json()
    expect(body).toHaveProperty('id')
    expect(body).toHaveProperty('werte')
  })

  it('returns 400 when produkt_id is missing', async () => {
    const res = await POST(req('http://localhost/api/produktkosten', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ gueltig_von: '2024-01-01', gueltig_bis: '2024-12-31', werte: [] }),
    }))
    expect(res.status).toBe(400)
  })

  it('returns 400 when gueltig_bis is before gueltig_von', async () => {
    const res = await POST(req('http://localhost/api/produktkosten', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...VALID_POST_BODY, gueltig_von: '2024-06-01', gueltig_bis: '2024-01-01' }),
    }))
    expect(res.status).toBe(400)
  })

  it('returns 400 when wert is negative', async () => {
    const res = await POST(req('http://localhost/api/produktkosten', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...VALID_POST_BODY, werte: [{ kategorie_id: KAT_ID, wert: -1 }] }),
    }))
    expect(res.status).toBe(400)
  })

  it('returns 400 when date format is invalid', async () => {
    const res = await POST(req('http://localhost/api/produktkosten', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...VALID_POST_BODY, gueltig_von: '01.01.2024' }),
    }))
    expect(res.status).toBe(400)
  })

  it('returns 409 when period overlaps existing entry', async () => {
    mockFrom.mockReturnValueOnce({
      select: () => ({
        eq: () => ({
          or: () => ({
            lte: () => ({
              data: [{ id: 'other', gueltig_von: '2024-01-01', gueltig_bis: '2024-06-30' }],
              error: null,
            }),
          }),
        }),
      }),
    })

    const res = await POST(req('http://localhost/api/produktkosten', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(VALID_POST_BODY),
    }))
    expect(res.status).toBe(409)
    const body = await res.json()
    expect(body.error).toMatch(/überschneidet/)
  })

  it('returns 401 when unauthenticated', async () => {
    const { requireAuth } = await import('@/lib/supabase-server')
    vi.mocked(requireAuth).mockResolvedValueOnce({
      user: null,
      supabase: null as never,
      error: new Response('Unauthorized', { status: 401 }),
    })
    const res = await POST(req('http://localhost/api/produktkosten', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(VALID_POST_BODY),
    }))
    expect(res.status).toBe(401)
  })
})
