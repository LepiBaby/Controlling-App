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

beforeEach(() => {
  vi.clearAllMocks()
  mockFrom.mockReset()
})

function req(params: Record<string, string>) {
  const url = new URL('http://localhost/api/produktinvestitions-planung/ist-tatsaechlich')
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v)
  return new Request(url.toString())
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
    mockFrom.mockReturnValueOnce({
      select: () => ({
        not: () => ({
          not: () => ({
            in: () => ({
              gte: () => ({
                lte: () => ({
                  limit: () => ({ data: null, error: { message: 'DB error' } }),
                }),
              }),
            }),
          }),
        }),
      }),
    })
    const res = await GET(req({ von_kw: '22', von_jahr: '2026', bis_kw: '25', bis_jahr: '2026' }))
    expect(res.status).toBe(500)
  })

  it('returns 200 with empty data when no transactions', async () => {
    mockFrom.mockReturnValueOnce({
      select: () => ({
        not: () => ({
          not: () => ({
            in: () => ({
              gte: () => ({
                lte: () => ({
                  limit: () => ({ data: [], error: null }),
                }),
              }),
            }),
          }),
        }),
      }),
    })
    const res = await GET(req({ von_kw: '22', von_jahr: '2026', bis_kw: '25', bis_jahr: '2026' }))
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.data).toEqual([])
  })

  it('aggregates transactions by kategorie and ISO week', async () => {
    mockFrom.mockReturnValueOnce({
      select: () => ({
        not: () => ({
          not: () => ({
            in: () => ({
              gte: () => ({
                lte: () => ({
                  limit: () => ({
                    data: [
                      { gruppe_id: GRUPPE_ID, zahlungsdatum: '2026-05-25', betrag_brutto: 1000 },
                      { gruppe_id: GRUPPE_ID, zahlungsdatum: '2026-05-26', betrag_brutto: 500 },
                    ],
                    error: null,
                  }),
                }),
              }),
            }),
          }),
        }),
      }),
    })
    const res = await GET(req({ von_kw: '21', von_jahr: '2026', bis_kw: '22', bis_jahr: '2026' }))
    expect(res.status).toBe(200)
    const body = await res.json()
    // Both dates are in KW22 2026 (2026-05-25 = Monday KW22)
    expect(body.data).toHaveLength(1)
    expect(body.data[0].kategorie_id).toBe(GRUPPE_ID)
    expect(body.data[0].betrag).toBe(1500)
    expect(body.data[0].kw_number).toBe(22)
    expect(body.data[0].kw_year).toBe(2026)
  })

  it('skips rows with null gruppe_id or null zahlungsdatum', async () => {
    mockFrom.mockReturnValueOnce({
      select: () => ({
        not: () => ({
          not: () => ({
            in: () => ({
              gte: () => ({
                lte: () => ({
                  limit: () => ({
                    data: [
                      { gruppe_id: null, zahlungsdatum: '2026-05-25', betrag_brutto: 999 },
                      { gruppe_id: GRUPPE_ID, zahlungsdatum: null, betrag_brutto: 999 },
                      { gruppe_id: GRUPPE_ID, zahlungsdatum: '2026-05-25', betrag_brutto: 200 },
                    ],
                    error: null,
                  }),
                }),
              }),
            }),
          }),
        }),
      }),
    })
    const res = await GET(req({ von_kw: '21', von_jahr: '2026', bis_kw: '22', bis_jahr: '2026' }))
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.data).toHaveLength(1)
    expect(body.data[0].betrag).toBe(200)
  })

  it('rounds betrag to 2 decimal places', async () => {
    mockFrom.mockReturnValueOnce({
      select: () => ({
        not: () => ({
          not: () => ({
            in: () => ({
              gte: () => ({
                lte: () => ({
                  limit: () => ({
                    data: [
                      { gruppe_id: GRUPPE_ID, zahlungsdatum: '2026-05-25', betrag_brutto: 100.123 },
                      { gruppe_id: GRUPPE_ID, zahlungsdatum: '2026-05-26', betrag_brutto: 200.456 },
                    ],
                    error: null,
                  }),
                }),
              }),
            }),
          }),
        }),
      }),
    })
    const res = await GET(req({ von_kw: '21', von_jahr: '2026', bis_kw: '22', bis_jahr: '2026' }))
    const body = await res.json()
    expect(body.data[0].betrag).toBe(300.58)
  })
})
