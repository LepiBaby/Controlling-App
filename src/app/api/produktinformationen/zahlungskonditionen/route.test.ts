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

const PRODUKT_ID = '22222222-2222-2222-8222-222222222222'
const EINTRAG_ID = '33333333-3333-3333-8333-333333333333'
const MOCK_ENTRY = {
  id: EINTRAG_ID, produkt_id: PRODUKT_ID,
  vor_produktion_pct: 30, nach_produktion_pct: 40, nach_ankunft_pct: 30,
  zahlungsziel_vor_produktion_tage: 0, zahlungsziel_nach_produktion_tage: 30, zahlungsziel_nach_ankunft_tage: 60,
}

beforeEach(() => {
  vi.clearAllMocks()
  mockFrom.mockReset()
})

describe('GET /api/produktinformationen/zahlungskonditionen', () => {
  it('returns 200 with zahlungskonditionen list', async () => {
    mockFrom.mockReturnValueOnce({
      select: () => ({ eq: () => ({ limit: () => ({ data: [MOCK_ENTRY], error: null }) }) }),
    })
    const res = await GET()
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body[0].vor_produktion_pct).toBe(30)
  })

  it('returns 401 when unauthenticated', async () => {
    const { requireAuth } = await import('@/lib/supabase-server')
    vi.mocked(requireAuth).mockResolvedValueOnce({
      user: null, supabase: null as never,
      error: new Response('Unauthorized', { status: 401 }),
    })
    const res = await GET()
    expect(res.status).toBe(401)
  })
})

describe('PUT /api/produktinformationen/zahlungskonditionen', () => {
  function upsertMock(returnData: Record<string, unknown> | null, returnError: { message: string } | null = null) {
    mockFrom.mockReturnValueOnce({
      upsert: () => ({ select: () => ({ single: () => ({ data: returnData, error: returnError }) }) }),
    })
  }

  it('returns 200 on successful upsert with all fields', async () => {
    upsertMock(MOCK_ENTRY)
    const res = await PUT(req('http://localhost/', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        produkt_id: PRODUKT_ID,
        vor_produktion_pct: 30, nach_produktion_pct: 40, nach_ankunft_pct: 30,
        zahlungsziel_vor_produktion_tage: 0, zahlungsziel_nach_produktion_tage: 30, zahlungsziel_nach_ankunft_tage: 60,
      }),
    }))
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.nach_produktion_pct).toBe(40)
  })

  it('returns 200 with partial percentages (intermediate state)', async () => {
    upsertMock({ ...MOCK_ENTRY, nach_produktion_pct: null, nach_ankunft_pct: null })
    const res = await PUT(req('http://localhost/', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ produkt_id: PRODUKT_ID, vor_produktion_pct: 30 }),
    }))
    expect(res.status).toBe(200)
  })

  it('returns 400 when produkt_id is missing', async () => {
    const res = await PUT(req('http://localhost/', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ vor_produktion_pct: 30 }),
    }))
    expect(res.status).toBe(400)
  })

  it('returns 400 when percentage exceeds 100', async () => {
    const res = await PUT(req('http://localhost/', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ produkt_id: PRODUKT_ID, vor_produktion_pct: 110 }),
    }))
    expect(res.status).toBe(400)
  })

  it('returns 401 when unauthenticated', async () => {
    const { requireAuth } = await import('@/lib/supabase-server')
    vi.mocked(requireAuth).mockResolvedValueOnce({
      user: null, supabase: null as never,
      error: new Response('Unauthorized', { status: 401 }),
    })
    const res = await PUT(req('http://localhost/', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ produkt_id: PRODUKT_ID, vor_produktion_pct: 30 }),
    }))
    expect(res.status).toBe(401)
  })

  it('returns 500 when db upsert fails', async () => {
    upsertMock(null, { message: 'DB error' })
    const res = await PUT(req('http://localhost/', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ produkt_id: PRODUKT_ID, vor_produktion_pct: 30 }),
    }))
    expect(res.status).toBe(500)
  })
})
