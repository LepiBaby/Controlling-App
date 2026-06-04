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

const EINTRAG_ID = '33333333-3333-3333-8333-333333333333'
const MOCK_ENTRY = {
  id: EINTRAG_ID,
  shipping_kosten_20dc: 1500, shipping_kosten_40dc: 2500, shipping_kosten_40hq: 2800,
  shipping_zahlungsziel_tage: 30,
  inspektion_kosten_20dc: 200, inspektion_kosten_40dc: 300, inspektion_kosten_40hq: 350,
  inspektion_zahlungsziel_tage: 14,
  einlagerung_kosten_20dc: 100, einlagerung_kosten_40dc: 150, einlagerung_kosten_40hq: 180,
  einlagerung_zahlungsziel_tage: 7,
  zoll_zahlungsziel_tage: 60,
}

beforeEach(() => {
  vi.clearAllMocks()
  mockFrom.mockReset()
})

describe('GET /api/produktinformationen/kosten-global', () => {
  it('returns 200 with null when no entry exists', async () => {
    mockFrom.mockReturnValueOnce({
      select: () => ({ eq: () => ({ maybeSingle: () => ({ data: null, error: null }) }) }),
    })
    const res = await GET()
    expect(res.status).toBe(200)
    expect(await res.json()).toBeNull()
  })

  it('returns 200 with kosten global', async () => {
    mockFrom.mockReturnValueOnce({
      select: () => ({ eq: () => ({ maybeSingle: () => ({ data: MOCK_ENTRY, error: null }) }) }),
    })
    const res = await GET()
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.shipping_kosten_20dc).toBe(1500)
    expect(body.zoll_zahlungsziel_tage).toBe(60)
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

describe('PUT /api/produktinformationen/kosten-global', () => {
  function upsertMock(returnData: Record<string, unknown> | null, returnError: { message: string } | null = null) {
    mockFrom.mockReturnValueOnce({
      upsert: () => ({ select: () => ({ single: () => ({ data: returnData, error: returnError }) }) }),
    })
  }

  it('returns 200 on successful upsert', async () => {
    upsertMock(MOCK_ENTRY)
    const res = await PUT(req('http://localhost/', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ shipping_kosten_20dc: 1500, zoll_zahlungsziel_tage: 60 }),
    }))
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.shipping_kosten_20dc).toBe(1500)
  })

  it('returns 400 when body is invalid JSON', async () => {
    const res = await PUT(req('http://localhost/', {
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
    const res = await PUT(req('http://localhost/', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ shipping_kosten_20dc: 1500 }),
    }))
    expect(res.status).toBe(401)
  })

  it('returns 500 when db upsert fails', async () => {
    upsertMock(null, { message: 'DB error' })
    const res = await PUT(req('http://localhost/', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ shipping_kosten_20dc: 1500 }),
    }))
    expect(res.status).toBe(500)
  })
})
