import { describe, it, expect, vi, beforeEach } from 'vitest'
import { GET } from './route'

const mockFrom = vi.fn()

vi.mock('@/lib/supabase-server', () => ({
  requireAuth: vi.fn().mockResolvedValue({
    user: { id: 'user-1', email: 'test@test.com' },
    supabase: { from: (table: string) => mockFrom(table) },
    error: null,
  }),
}))

const GRUPPE_ID = '11111111-1111-1111-8111-111111111111'
const UNTERGRUPPE_ID = '22222222-2222-2222-8222-222222222222'

beforeEach(() => {
  vi.clearAllMocks()
  mockFrom.mockReset()
})

function req(params: Record<string, string>) {
  const url = new URL('http://localhost/api/produktinvestitions-planung/ist-tatsaechlich')
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v)
  return new Request(url.toString())
}

function makeChain(result: { data: unknown; error: unknown }) {
  return {
    select: () => ({
      not: () => ({
        not: () => ({
          in: () => ({
            gte: () => ({
              lte: () => ({
                limit: () => result,
              }),
            }),
          }),
        }),
      }),
    }),
  }
}

// ─── GET ──────────────────────────────────────────────────────────────────────

describe('GET /api/produktinvestitions-planung/ist-tatsaechlich', () => {
  it('returns 400 when query params missing', async () => {
    const res = await GET(new Request('http://localhost/api/produktinvestitions-planung/ist-tatsaechlich'))
    expect(res.status).toBe(400)
  })

  it('returns 400 when params are not numbers', async () => {
    const res = await GET(req({ von_kw: 'abc', von_jahr: '2026', bis_kw: '25', bis_jahr: '2026' }))
    expect(res.status).toBe(400)
  })

  it('returns 401 when unauthenticated', async () => {
    const { requireAuth } = await import('@/lib/supabase-server')
    vi.mocked(requireAuth).mockResolvedValueOnce({
      user: null, supabase: null as never,
      error: new Response('Unauthorized', { status: 401 }),
    })
    const res = await GET(req({ von_kw: '22', von_jahr: '2026', bis_kw: '25', bis_jahr: '2026' }))
    expect(res.status).toBe(401)
  })

  it('returns 500 when db query fails', async () => {
    mockFrom.mockReturnValueOnce(makeChain({ data: null, error: { message: 'DB error' } }))
    const res = await GET(req({ von_kw: '22', von_jahr: '2026', bis_kw: '25', bis_jahr: '2026' }))
    expect(res.status).toBe(500)
  })

  it('returns 200 with empty data when no transactions', async () => {
    mockFrom.mockReturnValueOnce(makeChain({ data: [], error: null }))
    const res = await GET(req({ von_kw: '22', von_jahr: '2026', bis_kw: '25', bis_jahr: '2026' }))
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.data).toEqual([])
  })

  it('aggregates by gruppe_id when untergruppe_id is null', async () => {
    mockFrom.mockReturnValueOnce(makeChain({
      data: [
        { gruppe_id: GRUPPE_ID, untergruppe_id: null, zahlungsdatum: '2026-05-25', betrag_brutto: 1000 },
        { gruppe_id: GRUPPE_ID, untergruppe_id: null, zahlungsdatum: '2026-05-26', betrag_brutto: 500 },
      ],
      error: null,
    }))
    const res = await GET(req({ von_kw: '21', von_jahr: '2026', bis_kw: '22', bis_jahr: '2026' }))
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.data).toHaveLength(1)
    expect(body.data[0].kategorie_id).toBe(GRUPPE_ID)
    expect(body.data[0].betrag).toBe(1500)
    expect(body.data[0].kw_number).toBe(22)
    expect(body.data[0].kw_year).toBe(2026)
  })

  it('aggregates by untergruppe_id when present (effective leaf)', async () => {
    mockFrom.mockReturnValueOnce(makeChain({
      data: [
        { gruppe_id: GRUPPE_ID, untergruppe_id: UNTERGRUPPE_ID, zahlungsdatum: '2026-05-25', betrag_brutto: 800 },
        { gruppe_id: GRUPPE_ID, untergruppe_id: UNTERGRUPPE_ID, zahlungsdatum: '2026-05-26', betrag_brutto: 200 },
      ],
      error: null,
    }))
    const res = await GET(req({ von_kw: '21', von_jahr: '2026', bis_kw: '22', bis_jahr: '2026' }))
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.data).toHaveLength(1)
    expect(body.data[0].kategorie_id).toBe(UNTERGRUPPE_ID)
    expect(body.data[0].betrag).toBe(1000)
  })

  it('handles mixed transactions: some with untergruppe_id, some without', async () => {
    mockFrom.mockReturnValueOnce(makeChain({
      data: [
        { gruppe_id: GRUPPE_ID, untergruppe_id: UNTERGRUPPE_ID, zahlungsdatum: '2026-05-25', betrag_brutto: 300 },
        { gruppe_id: GRUPPE_ID, untergruppe_id: null, zahlungsdatum: '2026-05-25', betrag_brutto: 100 },
      ],
      error: null,
    }))
    const res = await GET(req({ von_kw: '21', von_jahr: '2026', bis_kw: '22', bis_jahr: '2026' }))
    expect(res.status).toBe(200)
    const body = await res.json()
    // Two separate keys: UNTERGRUPPE_ID and GRUPPE_ID
    expect(body.data).toHaveLength(2)
    const byKat = Object.fromEntries(body.data.map((d: { kategorie_id: string; betrag: number }) => [d.kategorie_id, d.betrag]))
    expect(byKat[UNTERGRUPPE_ID]).toBe(300)
    expect(byKat[GRUPPE_ID]).toBe(100)
  })

  it('skips rows with null gruppe_id or null zahlungsdatum', async () => {
    mockFrom.mockReturnValueOnce(makeChain({
      data: [
        { gruppe_id: null, untergruppe_id: null, zahlungsdatum: '2026-05-25', betrag_brutto: 999 },
        { gruppe_id: GRUPPE_ID, untergruppe_id: null, zahlungsdatum: null, betrag_brutto: 999 },
        { gruppe_id: GRUPPE_ID, untergruppe_id: null, zahlungsdatum: '2026-05-25', betrag_brutto: 200 },
      ],
      error: null,
    }))
    const res = await GET(req({ von_kw: '21', von_jahr: '2026', bis_kw: '22', bis_jahr: '2026' }))
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.data).toHaveLength(1)
    expect(body.data[0].betrag).toBe(200)
  })

  it('rounds betrag to 2 decimal places', async () => {
    mockFrom.mockReturnValueOnce(makeChain({
      data: [
        { gruppe_id: GRUPPE_ID, untergruppe_id: null, zahlungsdatum: '2026-05-25', betrag_brutto: 100.123 },
        { gruppe_id: GRUPPE_ID, untergruppe_id: null, zahlungsdatum: '2026-05-26', betrag_brutto: 200.456 },
      ],
      error: null,
    }))
    const res = await GET(req({ von_kw: '21', von_jahr: '2026', bis_kw: '22', bis_jahr: '2026' }))
    const body = await res.json()
    expect(body.data[0].betrag).toBe(300.58)
  })
})
