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

const KAT_ID  = '123e4567-e89b-12d3-a456-426614174000'
const GRP_ID  = '223e4567-e89b-12d3-a456-426614174001'

const VALID_TRANSAKTION = {
  leistungsdatum: '2024-01-15',
  betrag: 1250.00,
  kategorie_id: KAT_ID,
}

const MOCK_ROW = {
  id: 'txn-1',
  leistungsdatum: '2024-01-15',
  betrag: 1250.00,
  kategorie_id: KAT_ID,
  gruppe_id: null,
  untergruppe_id: null,
  sales_plattform_id: null,
  produkt_id: null,
  beschreibung: null,
  created_at: '2024-01-15T10:00:00Z',
}

// ─── GET ──────────────────────────────────────────────────────────────────────

describe('GET /api/umsatz-transaktionen', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockFrom.mockReturnValue({
      select: () => ({
        order: () => ({
          range: () => ({ data: [], error: null, count: 0 }),
        }),
      }),
    })
  })

  it('returns 200 with data/total/totalBetrag shape', async () => {
    mockFrom
      .mockReturnValueOnce({
        select: () => ({
          order: () => ({
            range: () => ({ data: [MOCK_ROW], error: null, count: 1 }),
          }),
        }),
      })
      .mockReturnValueOnce({
        select: () => ({ data: [{ betrag: 1250 }], error: null }),
      })

    const res = await GET(req('http://localhost/api/umsatz-transaktionen'))
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body).toHaveProperty('data')
    expect(body).toHaveProperty('total')
    expect(body).toHaveProperty('totalBetrag')
    expect(Array.isArray(body.data)).toBe(true)
  })

  it('returns 200 with empty arrays for no data', async () => {
    mockFrom
      .mockReturnValueOnce({
        select: () => ({
          order: () => ({
            range: () => ({ data: [], error: null, count: 0 }),
          }),
        }),
      })
      .mockReturnValueOnce({
        select: () => ({ data: [], error: null }),
      })

    const res = await GET(req('http://localhost/api/umsatz-transaktionen'))
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.total).toBe(0)
    expect(body.totalBetrag).toBe(0)
  })

  it('returns 401 when unauthenticated', async () => {
    const { requireAuth } = await import('@/lib/supabase-server')
    vi.mocked(requireAuth).mockResolvedValueOnce({
      user: null,
      supabase: null as never,
      error: new Response('Unauthorized', { status: 401 }),
    })
    const res = await GET(req('http://localhost/api/umsatz-transaktionen'))
    expect(res.status).toBe(401)
  })
})

// ─── POST ─────────────────────────────────────────────────────────────────────

describe('POST /api/umsatz-transaktionen', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockFrom.mockReturnValue({
      insert: () => ({
        select: () => ({
          single: () => ({ data: MOCK_ROW, error: null }),
        }),
      }),
    })
  })

  it('returns 201 with valid payload', async () => {
    const res = await POST(req('http://localhost/api/umsatz-transaktionen', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(VALID_TRANSAKTION),
    }))
    expect(res.status).toBe(201)
    const body = await res.json()
    expect(body.id).toBe('txn-1')
  })

  it('returns 201 with optional fields', async () => {
    const res = await POST(req('http://localhost/api/umsatz-transaktionen', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ...VALID_TRANSAKTION,
        gruppe_id: GRP_ID,
        beschreibung: 'Test Beschreibung',
      }),
    }))
    expect(res.status).toBe(201)
  })

  it('returns 400 for missing leistungsdatum', async () => {
    const res = await POST(req('http://localhost/api/umsatz-transaktionen', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ betrag: 100, kategorie_id: '00000000-0000-0000-0000-000000000001' }),
    }))
    expect(res.status).toBe(400)
  })

  it('returns 400 for missing betrag', async () => {
    const res = await POST(req('http://localhost/api/umsatz-transaktionen', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ leistungsdatum: '2024-01-15', kategorie_id: '00000000-0000-0000-0000-000000000001' }),
    }))
    expect(res.status).toBe(400)
  })

  it('returns 400 for betrag = 0', async () => {
    const res = await POST(req('http://localhost/api/umsatz-transaktionen', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...VALID_TRANSAKTION, betrag: 0 }),
    }))
    expect(res.status).toBe(400)
  })

  it('returns 400 for negative betrag', async () => {
    const res = await POST(req('http://localhost/api/umsatz-transaktionen', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...VALID_TRANSAKTION, betrag: -50 }),
    }))
    expect(res.status).toBe(400)
  })

  it('returns 400 for invalid date format', async () => {
    const res = await POST(req('http://localhost/api/umsatz-transaktionen', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...VALID_TRANSAKTION, leistungsdatum: '15.01.2024' }),
    }))
    expect(res.status).toBe(400)
  })

  it('returns 400 for invalid kategorie_id (not a UUID)', async () => {
    const res = await POST(req('http://localhost/api/umsatz-transaktionen', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...VALID_TRANSAKTION, kategorie_id: 'not-a-uuid' }),
    }))
    expect(res.status).toBe(400)
  })

  it('returns 400 for missing kategorie_id', async () => {
    const res = await POST(req('http://localhost/api/umsatz-transaktionen', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ leistungsdatum: '2024-01-15', betrag: 100 }),
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
    const res = await POST(req('http://localhost/api/umsatz-transaktionen', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(VALID_TRANSAKTION),
    }))
    expect(res.status).toBe(401)
  })
})
