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

const KAT_EINNAHMEN = '333e4567-e89b-12d3-a456-426614174000'
const KAT_AUSGABEN  = '444e4567-e89b-12d3-a456-426614174000'

function makeChain(result: { data: unknown; error: unknown }) {
  const chain: Record<string, unknown> = {}
  const methods = ['select', 'gte', 'lte', 'in', 'not', 'is', 'or', 'neq', 'eq']
  for (const m of methods) chain[m] = () => chain
  ;(chain as { then: (onFulfilled: (r: unknown) => unknown) => unknown }).then =
    (onFulfilled: (r: unknown) => unknown) => Promise.resolve(result).then(onFulfilled)
  return chain
}

function setupMockData(opts: {
  einnahmen?: Array<Record<string, unknown>>
  ausgaben?: Array<Record<string, unknown>>
  einnahmenError?: unknown
  ausgabenError?: unknown
}) {
  mockFrom.mockImplementation((table: string) => {
    if (table === 'einnahmen_transaktionen') {
      return makeChain({ data: opts.einnahmen ?? [], error: opts.einnahmenError ?? null })
    }
    if (table === 'ausgaben_kosten_transaktionen') {
      return makeChain({ data: opts.ausgaben ?? [], error: opts.ausgabenError ?? null })
    }
    return makeChain({ data: [], error: null })
  })
}

const EINNAHMEN_ROW_1 = {
  id: 'e1',
  zahlungsdatum: '2024-02-01',
  betrag: 2000,
  kategorie_id: KAT_EINNAHMEN,
  gruppe_id: null,
  untergruppe_id: null,
  sales_plattform_id: null,
  produkt_id: null,
  beschreibung: 'Zahlungseingang A',
}

const EINNAHMEN_ROW_2 = {
  id: 'e2',
  zahlungsdatum: '2024-01-01',
  betrag: 800,
  kategorie_id: KAT_EINNAHMEN,
  gruppe_id: null,
  untergruppe_id: null,
  sales_plattform_id: null,
  produkt_id: null,
  beschreibung: 'Zahlungseingang B',
}

const AUSGABEN_ROW_1 = {
  id: 'a1',
  zahlungsdatum: '2024-01-15',
  betrag_brutto: 500,
  kategorie_id: KAT_AUSGABEN,
  gruppe_id: null,
  untergruppe_id: null,
  sales_plattform_id: null,
  produkt_id: null,
  beschreibung: 'Zahlungsausgang',
}

describe('GET /api/liquiditaet', () => {
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
    const res = await GET(req('http://localhost/api/liquiditaet'))
    expect(res.status).toBe(401)
  })

  it('returns merged data with correct quelle field (einnahmen positive, ausgaben negative)', async () => {
    setupMockData({
      einnahmen: [EINNAHMEN_ROW_1],
      ausgaben: [AUSGABEN_ROW_1],
    })

    const res = await GET(req('http://localhost/api/liquiditaet'))
    expect(res.status).toBe(200)

    const body = await res.json()
    expect(body).toHaveProperty('data')
    expect(body).toHaveProperty('total')
    expect(body).toHaveProperty('totalNettoCashflow')

    expect(body.total).toBe(2)
    expect(body.data).toHaveLength(2)

    const einnahmeRow = body.data.find((r: { id: string }) => r.id === 'e1')
    expect(einnahmeRow.quelle).toBe('einnahmen')
    expect(einnahmeRow.betrag).toBe(2000)

    const ausgabeRow = body.data.find((r: { id: string }) => r.id === 'a1')
    expect(ausgabeRow.quelle).toBe('ausgaben')
    expect(ausgabeRow.betrag).toBe(-500)
  })

  it('returns only einnahmen rows when quelle=einnahmen', async () => {
    setupMockData({
      einnahmen: [EINNAHMEN_ROW_1],
      ausgaben: [AUSGABEN_ROW_1],
    })

    const res = await GET(req('http://localhost/api/liquiditaet?quelle=einnahmen'))
    expect(res.status).toBe(200)

    const body = await res.json()
    expect(body.total).toBe(1)
    expect(body.data).toHaveLength(1)
    expect(body.data[0].quelle).toBe('einnahmen')
    expect(body.data[0].id).toBe('e1')
  })

  it('returns only ausgaben rows when quelle=ausgaben', async () => {
    setupMockData({
      einnahmen: [EINNAHMEN_ROW_1],
      ausgaben: [AUSGABEN_ROW_1],
    })

    const res = await GET(req('http://localhost/api/liquiditaet?quelle=ausgaben'))
    expect(res.status).toBe(200)

    const body = await res.json()
    expect(body.total).toBe(1)
    expect(body.data).toHaveLength(1)
    expect(body.data[0].quelle).toBe('ausgaben')
    expect(body.data[0].id).toBe('a1')
  })

  it('accepts von/bis filter params without error', async () => {
    setupMockData({
      einnahmen: [EINNAHMEN_ROW_1],
      ausgaben: [AUSGABEN_ROW_1],
    })

    const res = await GET(req('http://localhost/api/liquiditaet?von=2024-01-01&bis=2024-12-31'))
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.total).toBe(2)
  })

  it('paginates correctly when page=2', async () => {
    const many = Array.from({ length: 51 }, (_, i) => ({
      id: `e${i}`,
      zahlungsdatum: `2024-01-${String((i % 28) + 1).padStart(2, '0')}`,
      betrag: 100 + i,
      kategorie_id: KAT_EINNAHMEN,
      gruppe_id: null,
      untergruppe_id: null,
      sales_plattform_id: null,
      produkt_id: null,
      beschreibung: null,
    }))

    setupMockData({ einnahmen: many, ausgaben: [] })

    const res = await GET(req('http://localhost/api/liquiditaet?page=2'))
    expect(res.status).toBe(200)
    const body = await res.json()

    expect(body.total).toBe(51)
    expect(body.data).toHaveLength(1)
  })

  it('computes correct totalNettoCashflow (einnahmen positive + ausgaben negative)', async () => {
    setupMockData({
      einnahmen: [EINNAHMEN_ROW_1, EINNAHMEN_ROW_2], // 2000 + 800 = 2800
      ausgaben: [AUSGABEN_ROW_1],                    // -500
    })

    const res = await GET(req('http://localhost/api/liquiditaet'))
    expect(res.status).toBe(200)
    const body = await res.json()

    // 2800 - 500 = 2300
    expect(body.totalNettoCashflow).toBe(2300)
    expect(body.total).toBe(3)
  })

  it('sorts by zahlungsdatum descending by default (newest first)', async () => {
    setupMockData({
      einnahmen: [EINNAHMEN_ROW_2, EINNAHMEN_ROW_1], // 2024-01-01, 2024-02-01
      ausgaben: [AUSGABEN_ROW_1],                    // 2024-01-15
    })

    const res = await GET(req('http://localhost/api/liquiditaet'))
    const body = await res.json()

    // Descending: 2024-02-01, 2024-01-15, 2024-01-01
    expect(body.data[0].zahlungsdatum).toBe('2024-02-01')
    expect(body.data[1].zahlungsdatum).toBe('2024-01-15')
    expect(body.data[2].zahlungsdatum).toBe('2024-01-01')
  })

  it('returns empty arrays and zero totals when no data', async () => {
    setupMockData({ einnahmen: [], ausgaben: [] })

    const res = await GET(req('http://localhost/api/liquiditaet'))
    expect(res.status).toBe(200)
    const body = await res.json()

    expect(body.total).toBe(0)
    expect(body.totalNettoCashflow).toBe(0)
    expect(body.data).toEqual([])
  })
})
