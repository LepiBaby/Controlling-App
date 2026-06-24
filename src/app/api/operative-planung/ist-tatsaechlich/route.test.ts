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

const KAT_L1 = '11111111-1111-1111-8111-111111111111'
const KAT_L2 = '22222222-2222-2222-8222-222222222222'

function buildReq(query: string) {
  return new Request(`http://localhost/api/operative-planung/ist-tatsaechlich?${query}`)
}

function baseChain(rows: unknown[]) {
  return {
    select: () => ({
      not: () => ({
        not: () => ({
          in: () => ({
            gte: () => ({
              lte: () => ({
                limit: () => ({ data: rows, error: null }),
              }),
            }),
          }),
        }),
      }),
    }),
  }
}

beforeEach(() => {
  vi.clearAllMocks()
  mockFrom.mockReset()
})

describe('GET /api/operative-planung/ist-tatsaechlich', () => {
  it('returns 400 when query params are missing', async () => {
    const res = await GET(buildReq(''))
    expect(res.status).toBe(400)
  })

  it('returns 400 when only some params are provided', async () => {
    const res = await GET(buildReq('von_kw=25&von_jahr=2026'))
    expect(res.status).toBe(400)
  })

  it('returns 401 when unauthenticated', async () => {
    const { requireAuth } = await import('@/lib/supabase-server')
    vi.mocked(requireAuth).mockResolvedValueOnce({
      user: null, supabase: null as never,
      error: new Response('Unauthorized', { status: 401 }),
    })
    const res = await GET(buildReq('von_kw=25&von_jahr=2026&bis_kw=30&bis_jahr=2026'))
    expect(res.status).toBe(401)
  })

  it('returns 200 with empty data when no transactions exist', async () => {
    mockFrom.mockReturnValueOnce(baseChain([]))

    const res = await GET(buildReq('von_kw=25&von_jahr=2026&bis_kw=30&bis_jahr=2026'))
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.data).toEqual([])
  })

  it('returns 200 with aggregated transaction data', async () => {
    mockFrom.mockReturnValueOnce(baseChain([
      { gruppe_id: KAT_L1, untergruppe_id: null, zahlungsdatum: '2026-06-16', betrag_brutto: 1000 },
      { gruppe_id: KAT_L1, untergruppe_id: null, zahlungsdatum: '2026-06-17', betrag_brutto: 500 },
    ]))

    const res = await GET(buildReq('von_kw=25&von_jahr=2026&bis_kw=30&bis_jahr=2026'))
    expect(res.status).toBe(200)
    const body = await res.json()
    // Both dates fall in KW 25/2026 → should be summed
    expect(body.data).toHaveLength(1)
    expect(body.data[0].kategorie_id).toBe(KAT_L1)
    expect(body.data[0].betrag).toBe(1500)
  })

  it('uses untergruppe_id as effective category when set', async () => {
    mockFrom.mockReturnValueOnce(baseChain([
      { gruppe_id: KAT_L1, untergruppe_id: KAT_L2, zahlungsdatum: '2026-06-16', betrag_brutto: 300 },
    ]))

    const res = await GET(buildReq('von_kw=25&von_jahr=2026&bis_kw=30&bis_jahr=2026'))
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.data[0].kategorie_id).toBe(KAT_L2)
  })

  it('uses gruppe_id when untergruppe_id is null', async () => {
    mockFrom.mockReturnValueOnce(baseChain([
      { gruppe_id: KAT_L1, untergruppe_id: null, zahlungsdatum: '2026-06-16', betrag_brutto: 200 },
    ]))

    const res = await GET(buildReq('von_kw=25&von_jahr=2026&bis_kw=30&bis_jahr=2026'))
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.data[0].kategorie_id).toBe(KAT_L1)
  })

  it('aggregates transactions in the same KW for the same category', async () => {
    mockFrom.mockReturnValueOnce(baseChain([
      { gruppe_id: KAT_L1, untergruppe_id: null, zahlungsdatum: '2026-06-15', betrag_brutto: 100 },
      { gruppe_id: KAT_L1, untergruppe_id: null, zahlungsdatum: '2026-06-16', betrag_brutto: 200 },
      { gruppe_id: KAT_L1, untergruppe_id: null, zahlungsdatum: '2026-06-17', betrag_brutto: 300 },
    ]))

    const res = await GET(buildReq('von_kw=25&von_jahr=2026&bis_kw=30&bis_jahr=2026'))
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.data).toHaveLength(1)
    expect(body.data[0].betrag).toBe(600)
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

    const res = await GET(buildReq('von_kw=25&von_jahr=2026&bis_kw=30&bis_jahr=2026'))
    expect(res.status).toBe(500)
  })

  it('skips rows with null gruppe_id or null betrag_brutto', async () => {
    mockFrom.mockReturnValueOnce(baseChain([
      { gruppe_id: null, untergruppe_id: null, zahlungsdatum: '2026-06-16', betrag_brutto: 100 },
      { gruppe_id: KAT_L1, untergruppe_id: null, zahlungsdatum: '2026-06-16', betrag_brutto: null },
      { gruppe_id: KAT_L1, untergruppe_id: null, zahlungsdatum: '2026-06-16', betrag_brutto: 500 },
    ]))

    const res = await GET(buildReq('von_kw=25&von_jahr=2026&bis_kw=30&bis_jahr=2026'))
    expect(res.status).toBe(200)
    const body = await res.json()
    // Only the last valid row should appear
    expect(body.data).toHaveLength(1)
    expect(body.data[0].betrag).toBe(500)
  })
})
