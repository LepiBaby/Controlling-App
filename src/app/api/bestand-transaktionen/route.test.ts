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

const SKU_ID          = '123e4567-e89b-12d3-a456-426614174000'
const PRODUKT_ID      = '223e4567-e89b-12d3-a456-426614174001'
const PLATTFORM_ID    = '323e4567-e89b-12d3-a456-426614174002'
const TRANSAKTION_ID  = '423e4567-e89b-12d3-a456-426614174003'

const MOCK_TRANSAKTION = {
  id:                  TRANSAKTION_ID,
  sku_id:              SKU_ID,
  produkt_id:          PRODUKT_ID,
  datum:               '2024-05-01',
  anfangsbestand:      100,
  einlagerungen:       20,
  anpassungen_positiv: 0,
  anpassungen_negativ: 0,
  warenverluste:       0,
  sendungen_manuell:   5,
  created_at:          '2024-05-01T10:00:00Z',
}

const VALID_POST_BODY = {
  sku_id:             SKU_ID,
  produkt_id:         PRODUKT_ID,
  datum:              '2024-05-01',
  anfangsbestand:     100,
  einlagerungen:      20,
  anpassungen_positiv: 0,
  anpassungen_negativ: 0,
  warenverluste:      0,
  sendungen_manuell:  5,
  sendungen: [{ plattform_id: PLATTFORM_ID, menge: 10 }],
}

beforeEach(() => {
  vi.clearAllMocks()
})

// ─── GET ──────────────────────────────────────────────────────────────────────

describe('GET /api/bestand-transaktionen', () => {
  it('returns 400 when sku_id is missing', async () => {
    const res = await GET(req('http://localhost/api/bestand-transaktionen'))
    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error).toMatch(/sku_id/)
  })

  it('returns 200 with data array', async () => {
    mockFrom.mockReturnValueOnce({
      select: () => ({
        eq: () => ({
          order: () => ({ data: [{ ...MOCK_TRANSAKTION, sendungen: [] }], error: null }),
        }),
      }),
    })

    const res = await GET(req(`http://localhost/api/bestand-transaktionen?sku_id=${SKU_ID}`))
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
    const res = await GET(req(`http://localhost/api/bestand-transaktionen?sku_id=${SKU_ID}`))
    expect(res.status).toBe(401)
  })
})

// ─── POST ─────────────────────────────────────────────────────────────────────

describe('POST /api/bestand-transaktionen', () => {
  it('returns 201 on valid input', async () => {
    // 1. unique check → no conflict
    mockFrom.mockReturnValueOnce({
      select: () => ({
        eq: () => ({
          eq: () => ({
            limit: () => ({ data: [], error: null }),
          }),
        }),
      }),
    })
    // 2. insert transaktion
    mockFrom.mockReturnValueOnce({
      insert: () => ({
        select: () => ({
          single: () => ({ data: MOCK_TRANSAKTION, error: null }),
        }),
      }),
    })
    // 3. insert sendungen
    mockFrom.mockReturnValueOnce({
      insert: () => ({ error: null }),
    })

    const res = await POST(req('http://localhost/api/bestand-transaktionen', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(VALID_POST_BODY),
    }))
    expect(res.status).toBe(201)
    const body = await res.json()
    expect(body).toHaveProperty('id')
    expect(body).toHaveProperty('sendungen')
  })

  it('returns 400 when sku_id is missing', async () => {
    const { sku_id: _, ...withoutSku } = VALID_POST_BODY
    const res = await POST(req('http://localhost/api/bestand-transaktionen', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(withoutSku),
    }))
    expect(res.status).toBe(400)
  })

  it('returns 400 when datum format is invalid', async () => {
    const res = await POST(req('http://localhost/api/bestand-transaktionen', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...VALID_POST_BODY, datum: '01.05.2024' }),
    }))
    expect(res.status).toBe(400)
  })

  it('returns 400 when anfangsbestand is negative', async () => {
    const res = await POST(req('http://localhost/api/bestand-transaktionen', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...VALID_POST_BODY, anfangsbestand: -1 }),
    }))
    expect(res.status).toBe(400)
  })

  it('returns 400 when sendung menge is negative', async () => {
    const res = await POST(req('http://localhost/api/bestand-transaktionen', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ...VALID_POST_BODY,
        sendungen: [{ plattform_id: PLATTFORM_ID, menge: -5 }],
      }),
    }))
    expect(res.status).toBe(400)
  })

  it('returns 409 when entry for same sku_id+datum exists', async () => {
    mockFrom.mockReturnValueOnce({
      select: () => ({
        eq: () => ({
          eq: () => ({
            limit: () => ({ data: [{ id: 'other' }], error: null }),
          }),
        }),
      }),
    })

    const res = await POST(req('http://localhost/api/bestand-transaktionen', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(VALID_POST_BODY),
    }))
    expect(res.status).toBe(409)
    const body = await res.json()
    expect(body.error).toMatch(/bereits ein Eintrag/)
  })

  it('returns 201 with empty sendungen when no platforms', async () => {
    mockFrom.mockReturnValueOnce({
      select: () => ({
        eq: () => ({
          eq: () => ({
            limit: () => ({ data: [], error: null }),
          }),
        }),
      }),
    })
    mockFrom.mockReturnValueOnce({
      insert: () => ({
        select: () => ({
          single: () => ({ data: MOCK_TRANSAKTION, error: null }),
        }),
      }),
    })

    const res = await POST(req('http://localhost/api/bestand-transaktionen', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...VALID_POST_BODY, sendungen: [] }),
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
    const res = await POST(req('http://localhost/api/bestand-transaktionen', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(VALID_POST_BODY),
    }))
    expect(res.status).toBe(401)
  })
})
