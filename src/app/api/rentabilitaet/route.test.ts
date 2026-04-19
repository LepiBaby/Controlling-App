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

function req(url: string) {
  return new Request(url)
}

const KAT_UMSATZ = '111e4567-e89b-12d3-a456-426614174000'
const KAT_KOSTEN = '222e4567-e89b-12d3-a456-426614174000'

/**
 * Builds a thenable chainable mock for a Supabase query builder.
 * Every chain method (.gte, .lte, .in, .not, .is, .or, .select) returns
 * the same chain object. Awaiting the chain resolves to { data, error }.
 */
function makeChain(result: { data: unknown; error: unknown }) {
  const chain: Record<string, unknown> = {}
  const methods = ['select', 'gte', 'lte', 'in', 'not', 'is', 'or', 'neq', 'eq']
  for (const m of methods) chain[m] = () => chain
  // Make it awaitable
  ;(chain as { then: (onFulfilled: (r: unknown) => unknown) => unknown }).then =
    (onFulfilled: (r: unknown) => unknown) => Promise.resolve(result).then(onFulfilled)
  return chain
}

/**
 * Configure mockFrom to return umsatz data on the first call ('umsatz_transaktionen')
 * and kosten data on the second call ('ausgaben_kosten_transaktionen').
 */
function setupMockData(opts: {
  umsatz?: Array<Record<string, unknown>>
  kosten?: Array<Record<string, unknown>>
  abzugspostenCats?: Array<{ id: string }>
  umsatzError?: unknown
  kostenError?: unknown
}) {
  mockFrom.mockImplementation((table: string) => {
    if (table === 'umsatz_transaktionen') {
      return makeChain({ data: opts.umsatz ?? [], error: opts.umsatzError ?? null })
    }
    if (table === 'ausgaben_kosten_transaktionen') {
      return makeChain({ data: opts.kosten ?? [], error: opts.kostenError ?? null })
    }
    if (table === 'kpi_categories') {
      return makeChain({ data: opts.abzugspostenCats ?? [], error: null })
    }
    return makeChain({ data: [], error: null })
  })
}

const UMSATZ_ROW_1 = {
  id: 'u1',
  leistungsdatum: '2024-02-01',
  betrag: 1000,
  kategorie_id: KAT_UMSATZ,
  gruppe_id: null,
  untergruppe_id: null,
  sales_plattform_id: null,
  produkt_id: null,
  beschreibung: 'Verkauf A',
}

const UMSATZ_ROW_2 = {
  id: 'u2',
  leistungsdatum: '2024-01-01',
  betrag: 500,
  kategorie_id: KAT_UMSATZ,
  gruppe_id: null,
  untergruppe_id: null,
  sales_plattform_id: null,
  produkt_id: null,
  beschreibung: 'Verkauf B',
}

const KOSTEN_ROW_1 = {
  id: 'k1',
  leistungsdatum: '2024-01-15',
  betrag_netto: 300,
  kategorie_id: KAT_KOSTEN,
  gruppe_id: null,
  untergruppe_id: null,
  sales_plattform_id: null,
  produkt_id: null,
  beschreibung: 'Kostenposten',
  relevant_fuer_rentabilitaet: null,
  abschreibung: null,
}

describe('GET /api/rentabilitaet', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns 401 when unauthenticated', async () => {
    const { requireAuth } = await import('@/lib/supabase-server')
    vi.mocked(requireAuth).mockResolvedValueOnce({
      user: null,
      supabase: null as never,
      error: new Response('Unauthorized', { status: 401 }),
    })
    const res = await GET(req('http://localhost/api/rentabilitaet'))
    expect(res.status).toBe(401)
  })

  it('returns merged data with correct quelle field (umsatz positive, kosten negative)', async () => {
    setupMockData({
      umsatz: [UMSATZ_ROW_1],
      kosten: [KOSTEN_ROW_1],
    })

    const res = await GET(req('http://localhost/api/rentabilitaet'))
    expect(res.status).toBe(200)

    const body = await res.json()
    expect(body).toHaveProperty('data')
    expect(body).toHaveProperty('total')
    expect(body).toHaveProperty('totalNetto')

    expect(body.total).toBe(2)
    expect(body.data).toHaveLength(2)

    const umsatzRow = body.data.find((r: { id: string }) => r.id === 'u1')
    expect(umsatzRow.quelle).toBe('umsatz')
    expect(umsatzRow.betrag).toBe(1000)

    const kostenRow = body.data.find((r: { id: string }) => r.id === 'k1')
    expect(kostenRow.quelle).toBe('kosten')
    expect(kostenRow.betrag).toBe(-300)
  })

  it('returns only umsatz rows when quelle=umsatz', async () => {
    setupMockData({
      umsatz: [UMSATZ_ROW_1],
      kosten: [KOSTEN_ROW_1],
    })

    const res = await GET(req('http://localhost/api/rentabilitaet?quelle=umsatz'))
    expect(res.status).toBe(200)

    const body = await res.json()
    expect(body.total).toBe(1)
    expect(body.data).toHaveLength(1)
    expect(body.data[0].quelle).toBe('umsatz')
    expect(body.data[0].id).toBe('u1')
  })

  it('returns only kosten rows when quelle=kosten', async () => {
    setupMockData({
      umsatz: [UMSATZ_ROW_1],
      kosten: [KOSTEN_ROW_1],
    })

    const res = await GET(req('http://localhost/api/rentabilitaet?quelle=kosten'))
    expect(res.status).toBe(200)

    const body = await res.json()
    expect(body.total).toBe(1)
    expect(body.data).toHaveLength(1)
    expect(body.data[0].quelle).toBe('kosten')
    expect(body.data[0].id).toBe('k1')
  })

  it('accepts von/bis filter params without error', async () => {
    setupMockData({
      umsatz: [UMSATZ_ROW_1],
      kosten: [KOSTEN_ROW_1],
    })

    const res = await GET(req('http://localhost/api/rentabilitaet?von=2024-01-01&bis=2024-12-31'))
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.total).toBe(2)
  })

  it('paginates correctly when page=2', async () => {
    // 51 umsatz rows, all on different dates (descending by default)
    const many = Array.from({ length: 51 }, (_, i) => ({
      id: `u${i}`,
      leistungsdatum: `2024-01-${String((i % 28) + 1).padStart(2, '0')}`,
      betrag: 100 + i,
      kategorie_id: KAT_UMSATZ,
      gruppe_id: null,
      untergruppe_id: null,
      sales_plattform_id: null,
      produkt_id: null,
      beschreibung: null,
    }))

    setupMockData({ umsatz: many, kosten: [] })

    const res = await GET(req('http://localhost/api/rentabilitaet?page=2'))
    expect(res.status).toBe(200)
    const body = await res.json()

    expect(body.total).toBe(51)
    // Page 2 should contain the remaining 1 row (51 total, 50 per page)
    expect(body.data).toHaveLength(1)
  })

  it('computes correct totalNetto (umsatz positive + kosten negative)', async () => {
    setupMockData({
      umsatz: [UMSATZ_ROW_1, UMSATZ_ROW_2], // 1000 + 500 = 1500
      kosten: [KOSTEN_ROW_1],                // -300
    })

    const res = await GET(req('http://localhost/api/rentabilitaet'))
    expect(res.status).toBe(200)
    const body = await res.json()

    // 1500 - 300 = 1200
    expect(body.totalNetto).toBe(1200)
    expect(body.total).toBe(3)
  })

  it('sorts by leistungsdatum descending by default (newest first)', async () => {
    setupMockData({
      umsatz: [UMSATZ_ROW_2, UMSATZ_ROW_1], // 2024-01-01, 2024-02-01
      kosten: [KOSTEN_ROW_1],                // 2024-01-15
    })

    const res = await GET(req('http://localhost/api/rentabilitaet'))
    const body = await res.json()

    // Descending: 2024-02-01, 2024-01-15, 2024-01-01
    expect(body.data[0].leistungsdatum).toBe('2024-02-01')
    expect(body.data[1].leistungsdatum).toBe('2024-01-15')
    expect(body.data[2].leistungsdatum).toBe('2024-01-01')
  })

  it('returns empty arrays and zero total when no data', async () => {
    setupMockData({ umsatz: [], kosten: [] })

    const res = await GET(req('http://localhost/api/rentabilitaet'))
    expect(res.status).toBe(200)
    const body = await res.json()

    expect(body.total).toBe(0)
    expect(body.totalNetto).toBe(0)
    expect(body.data).toEqual([])
  })

  // ─── PROJ-11: Abzugsposten-Logik ──────────────────────────────────────────
  it('PROJ-11: flips sign of umsatz rows from Abzugsposten categories', async () => {
    setupMockData({
      umsatz: [UMSATZ_ROW_1], // betrag = 1000, kategorie = KAT_UMSATZ
      kosten: [],
      abzugspostenCats: [{ id: KAT_UMSATZ }], // Kategorie ist Abzugsposten
    })

    const res = await GET(req('http://localhost/api/rentabilitaet'))
    expect(res.status).toBe(200)
    const body = await res.json()

    const row = body.data.find((r: { id: string }) => r.id === 'u1')
    expect(row.quelle).toBe('umsatz')
    expect(row.betrag).toBe(-1000) // Vorzeichen-Flip
  })

  it('PROJ-11: keeps sign positive for non-Abzugsposten umsatz rows', async () => {
    setupMockData({
      umsatz: [UMSATZ_ROW_1],
      kosten: [],
      abzugspostenCats: [], // Keine Abzugsposten konfiguriert
    })

    const res = await GET(req('http://localhost/api/rentabilitaet'))
    const body = await res.json()
    const row = body.data.find((r: { id: string }) => r.id === 'u1')
    expect(row.betrag).toBe(1000)
  })

  it('PROJ-11: Abzugsposten reduces totalNetto', async () => {
    setupMockData({
      umsatz: [UMSATZ_ROW_1, UMSATZ_ROW_2], // 1000 + 500
      kosten: [],
      abzugspostenCats: [{ id: KAT_UMSATZ }], // beide Reihen sind Abzugsposten
    })

    const res = await GET(req('http://localhost/api/rentabilitaet'))
    const body = await res.json()
    // -1000 + -500 = -1500
    expect(body.totalNetto).toBe(-1500)
  })

  it('PROJ-11: does not apply Abzugsposten logic to kosten rows', async () => {
    setupMockData({
      umsatz: [],
      kosten: [KOSTEN_ROW_1], // betrag_netto 300 → -300 (normale Kostenlogik)
      abzugspostenCats: [{ id: KAT_KOSTEN }], // auch wenn als Abzugsposten markiert
    })

    const res = await GET(req('http://localhost/api/rentabilitaet'))
    const body = await res.json()
    const row = body.data.find((r: { id: string }) => r.id === 'k1')
    // Kosten bleiben negativ (kein doppelter Flip)
    expect(row.betrag).toBe(-300)
  })
})
