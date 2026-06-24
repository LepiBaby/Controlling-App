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

const KAT_ID = '22222222-2222-2222-8222-222222222222'
const KAT_ID_2 = '33333333-3333-3333-8333-333333333333'
const STEUERN_ROOT_ID = '44444444-4444-4444-8444-444444444444'
const EINFUHR_KAT_ID = '55555555-5555-5555-8555-555555555555'
const PRODUKT_A = '66666666-6666-6666-8666-666666666666'
const PRODUKT_B = '77777777-7777-7777-8777-777777777777'

// Fully chainable Supabase query mock; terminal ops return the provided result.
function makeChain(result: { data: unknown; error: null | { message: string } }) {
  const chain: Record<string, (...args: unknown[]) => unknown> = {}
  for (const m of ['select', 'eq', 'in', 'not', 'gte', 'lte', 'lt', 'gt', 'or', 'is']) {
    chain[m] = () => chain
  }
  chain['single'] = () => result
  chain['maybeSingle'] = () => result
  chain['limit'] = () => result
  return chain
}

beforeEach(() => {
  vi.clearAllMocks()
  mockFrom.mockReset()
  // Default: any table (e.g. the kpi_categories lookup) returns empty.
  mockFrom.mockImplementation(() => makeChain({ data: [], error: null }))
})

function buildGet(query = '') {
  return new Request(`http://localhost/api/steuerausgaben-planung/ist-tatsaechlich${query ? '?' + query : ''}`)
}

const VALID_PARAMS = 'von_kw=1&von_jahr=2026&bis_kw=13&bis_jahr=2026'
// Note: buildGet already prepends '?', so do not prefix VALID_PARAMS with '?'

describe('GET /api/steuerausgaben-planung/ist-tatsaechlich', () => {
  it('returns 400 when query params are missing', async () => {
    const res = await GET(buildGet())
    expect(res.status).toBe(400)
  })

  it('returns 401 when unauthenticated', async () => {
    const { requireAuth } = await import('@/lib/supabase-server')
    vi.mocked(requireAuth).mockResolvedValueOnce({
      user: null, supabase: null as never,
      error: new Response('Unauthorized', { status: 401 }),
    })
    const res = await GET(buildGet('?' + VALID_PARAMS))
    expect(res.status).toBe(401)
  })

  it('returns 200 with empty data when no transactions', async () => {
    mockFrom.mockReturnValueOnce({
      select: () => ({
        not: () => ({ not: () => ({ in: () => ({ gte: () => ({ lte: () => ({ limit: () => ({ data: [], error: null }) }) }) }) }) }),
      }),
    })

    const res = await GET(buildGet(VALID_PARAMS))
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.data).toEqual([])
  })

  it('queries by zahlungsdatum and liquiditaet relevanz', async () => {
    let capturedRelevanz: string[] = []
    mockFrom.mockReturnValueOnce({
      select: () => ({
        not: (_col1: string) => ({
          not: (_col2: string) => ({
            in: (_col: string, values: string[]) => {
              capturedRelevanz = values
              return { gte: () => ({ lte: () => ({ limit: () => ({ data: [], error: null }) }) }) }
            },
          }),
        }),
      }),
    })

    await GET(buildGet(VALID_PARAMS))
    expect(capturedRelevanz).toEqual(['liquiditaet', 'beides'])
  })

  it('groups transactions by kategorie and ISO week', async () => {
    const rows = [
      { gruppe_id: KAT_ID, untergruppe_id: null, zahlungsdatum: '2026-01-05', betrag_brutto: 100 },
      { gruppe_id: KAT_ID, untergruppe_id: null, zahlungsdatum: '2026-01-07', betrag_brutto: 200 },
      { gruppe_id: KAT_ID, untergruppe_id: KAT_ID_2, zahlungsdatum: '2026-01-05', betrag_brutto: 50 },
    ]

    mockFrom.mockReturnValueOnce({
      select: () => ({
        not: () => ({ not: () => ({ in: () => ({ gte: () => ({ lte: () => ({ limit: () => ({ data: rows, error: null }) }) }) }) }) }),
      }),
    })

    const res = await GET(buildGet(VALID_PARAMS))
    expect(res.status).toBe(200)
    const body = await res.json()

    // KAT_ID in KW1 2026: 100 + 200 = 300
    const katRow = body.data.find((r: { kategorie_id: string }) => r.kategorie_id === KAT_ID)
    expect(katRow).toBeDefined()
    expect(katRow.betrag).toBe(300)

    // KAT_ID_2 (untergruppe) in KW1 2026: 50
    const kat2Row = body.data.find((r: { kategorie_id: string }) => r.kategorie_id === KAT_ID_2)
    expect(kat2Row).toBeDefined()
    expect(kat2Row.betrag).toBe(50)
  })

  it('uses untergruppe_id as effective kategorie when present', async () => {
    const rows = [
      { gruppe_id: KAT_ID, untergruppe_id: KAT_ID_2, zahlungsdatum: '2026-01-05', betrag_brutto: 75 },
    ]

    mockFrom.mockReturnValueOnce({
      select: () => ({
        not: () => ({ not: () => ({ in: () => ({ gte: () => ({ lte: () => ({ limit: () => ({ data: rows, error: null }) }) }) }) }) }),
      }),
    })

    const res = await GET(buildGet(VALID_PARAMS))
    const body = await res.json()

    expect(body.data[0].kategorie_id).toBe(KAT_ID_2)
    expect(body.data[0].betrag).toBe(75)
  })

  it('breaks down Einfuhrumsatzsteuer per product', async () => {
    const rows = [
      { gruppe_id: EINFUHR_KAT_ID, untergruppe_id: null, produkt_id: PRODUKT_A, zahlungsdatum: '2026-01-05', betrag_brutto: 100 },
      { gruppe_id: EINFUHR_KAT_ID, untergruppe_id: null, produkt_id: PRODUKT_A, zahlungsdatum: '2026-01-07', betrag_brutto: 50 },
      { gruppe_id: EINFUHR_KAT_ID, untergruppe_id: null, produkt_id: PRODUKT_B, zahlungsdatum: '2026-01-05', betrag_brutto: 30 },
      // Non-Einfuhr transaction must NOT appear in the breakdown
      { gruppe_id: KAT_ID, untergruppe_id: null, produkt_id: PRODUKT_A, zahlungsdatum: '2026-01-05', betrag_brutto: 999 },
    ]
    const kpiCats = [
      { id: STEUERN_ROOT_ID, name: 'Steuern', parent_id: null },
      { id: EINFUHR_KAT_ID, name: 'Einfuhrumsatzsteuer', parent_id: STEUERN_ROOT_ID },
    ]
    mockFrom
      .mockReturnValueOnce({
        select: () => ({
          not: () => ({ not: () => ({ in: () => ({ gte: () => ({ lte: () => ({ limit: () => ({ data: rows, error: null }) }) }) }) }) }),
        }),
      })
      .mockReturnValueOnce(makeChain({ data: kpiCats, error: null }))

    const res = await GET(buildGet(VALID_PARAMS))
    expect(res.status).toBe(200)
    const body = await res.json()

    const bd = body.breakdown.einfuhr_produkte as Array<{ produkt_id: string; kw_year: number; kw_number: number; betrag: number }>
    // Produkt A in KW1: 100 + 50 = 150
    const a = bd.find(e => e.produkt_id === PRODUKT_A)
    expect(a).toBeDefined()
    expect(a!.betrag).toBe(150)
    // Produkt B in KW1: 30
    const b = bd.find(e => e.produkt_id === PRODUKT_B)
    expect(b!.betrag).toBe(30)
    // The non-Einfuhr 999 entry is excluded
    expect(bd.reduce((s, e) => s + e.betrag, 0)).toBe(180)
  })

  it('returns 500 when db query fails', async () => {
    mockFrom.mockReturnValueOnce({
      select: () => ({
        not: () => ({ not: () => ({ in: () => ({ gte: () => ({ lte: () => ({ limit: () => ({ data: null, error: { message: 'DB error' } }) }) }) }) }) }),
      }),
    })

    const res = await GET(buildGet(VALID_PARAMS))
    expect(res.status).toBe(500)
  })
})
