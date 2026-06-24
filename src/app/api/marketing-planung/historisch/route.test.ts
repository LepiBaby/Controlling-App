import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { GET } from './route'

const mockFrom = vi.fn()

vi.mock('@/lib/supabase-server', () => ({
  requireAuth: vi.fn().mockResolvedValue({
    user: { id: 'user-1', email: 'test@test.com' },
    supabase: { from: (table: string) => mockFrom(table) },
    error: null,
  }),
}))

const PRODUKT_ID   = '11111111-1111-1111-8111-111111111111'
const PLATTFORM_ID = '22222222-2222-2222-8222-222222222222'
const KAT_ID       = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'

// Fixed "today" for deterministic date calculations: 2026-06-10
const FIXED_TODAY = new Date('2026-06-10T00:00:00.000Z')

beforeEach(() => {
  vi.clearAllMocks()
  mockFrom.mockReset()
  vi.setSystemTime(FIXED_TODAY)
})

afterEach(() => {
  vi.useRealTimers()
})

function mockEinstellungen(data: object[]) {
  mockFrom.mockReturnValueOnce({
    select: () => ({
      eq: () => ({
        neq: () => ({ limit: () => ({ data, error: null }) }),
      }),
    }),
  })
}

function mockMarketingKats(ids: string[] = [KAT_ID]) {
  // marketing category IDs: eq(type) → ilike(name) → limit
  mockFrom.mockReturnValueOnce({
    select: () => ({
      eq: () => ({
        ilike: () => ({ limit: () => ({ data: ids.map(id => ({ id })), error: null }) }),
      }),
    }),
  })
  // rabatte category IDs: ilike(name) → limit
  mockFrom.mockReturnValueOnce({
    select: () => ({
      ilike: () => ({ limit: () => ({ data: [], error: null }) }),
    }),
  })
  // abzugsposten category IDs: eq(ist_abzugsposten) → limit
  mockFrom.mockReturnValueOnce({
    select: () => ({
      eq: () => ({ limit: () => ({ data: [], error: null }) }),
    }),
  })
}

function mockTransactions(ausgabenData: object[], umsatzData: object[]) {
  // ausgaben_kosten_transaktionen — 3× .in() (produkt, plattform, kategorie) + .eq(relevanz)
  mockFrom.mockReturnValueOnce({
    select: () => ({
      gte: () => ({
        lt: () => ({
          in: () => ({
            in: () => ({
              in: () => ({
                eq: () => ({ limit: () => ({ data: ausgabenData, error: null }) }),
              }),
            }),
          }),
        }),
      }),
    }),
  })
  // umsatz_transaktionen
  mockFrom.mockReturnValueOnce({
    select: () => ({
      gte: () => ({
        lt: () => ({
          in: () => ({
            in: () => ({ limit: () => ({ data: umsatzData, error: null }) }),
          }),
        }),
      }),
    }),
  })
}

describe('GET /api/marketing-planung/historisch', () => {
  it('returns [] when no active einstellungen', async () => {
    mockEinstellungen([])

    const res = await GET()
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body).toEqual([])
  })

  it('returns 0 pct for all when no Marketing categories exist', async () => {
    mockEinstellungen([{
      sales_plattform_id: PLATTFORM_ID,
      produkt_id: PRODUKT_ID,
      berechnungsart: 'mittelwert_30',
      gewichtung_erstes_drittel: null,
      gewichtung_zweites_drittel: null,
      gewichtung_drittes_drittel: null,
    }])
    mockMarketingKats([]) // no Marketing categories found

    const res = await GET()
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body).toHaveLength(1)
    expect(body[0].marketingkosten_pct).toBe(0)
  })

  it('returns 0 pct when no ausgaben or umsatz data', async () => {
    mockEinstellungen([{
      sales_plattform_id: PLATTFORM_ID,
      produkt_id: PRODUKT_ID,
      berechnungsart: 'mittelwert_30',
      gewichtung_erstes_drittel: null,
      gewichtung_zweites_drittel: null,
      gewichtung_drittes_drittel: null,
    }])
    mockMarketingKats()
    mockTransactions([], [])

    const res = await GET()
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body).toHaveLength(1)
    expect(body[0].marketingkosten_pct).toBe(0)
  })

  it('calculates mittelwert_30 correctly: ausgaben / umsatz * 100', async () => {
    mockEinstellungen([{
      sales_plattform_id: PLATTFORM_ID,
      produkt_id: PRODUKT_ID,
      berechnungsart: 'mittelwert_30',
      gewichtung_erstes_drittel: null,
      gewichtung_zweites_drittel: null,
      gewichtung_drittes_drittel: null,
    }])
    mockMarketingKats()

    // Today = 2026-06-10, so period = 2026-05-11 to 2026-06-09
    const ausgaben = [
      { produkt_id: PRODUKT_ID, sales_plattform_id: PLATTFORM_ID, leistungsdatum: '2026-05-20', betrag_netto: 100 },
      { produkt_id: PRODUKT_ID, sales_plattform_id: PLATTFORM_ID, leistungsdatum: '2026-06-01', betrag_netto: 50 },
    ]
    const umsatz = [
      { produkt_id: PRODUKT_ID, sales_plattform_id: PLATTFORM_ID, leistungsdatum: '2026-05-20', betrag: 1000 },
      { produkt_id: PRODUKT_ID, sales_plattform_id: PLATTFORM_ID, leistungsdatum: '2026-06-01', betrag: 500 },
    ]
    mockTransactions(ausgaben, umsatz)

    const res = await GET()
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body).toHaveLength(1)
    // (100 + 50) / (1000 + 500) * 100 = 150 / 1500 * 100 = 10.00
    expect(body[0].marketingkosten_pct).toBe(10)
    expect(body[0].produkt_id).toBe(PRODUKT_ID)
    expect(body[0].sales_plattform_id).toBe(PLATTFORM_ID)
  })

  it('returns 0 when umsatz is 0 (no division by zero)', async () => {
    mockEinstellungen([{
      sales_plattform_id: PLATTFORM_ID,
      produkt_id: PRODUKT_ID,
      berechnungsart: 'mittelwert_30',
      gewichtung_erstes_drittel: null,
      gewichtung_zweites_drittel: null,
      gewichtung_drittes_drittel: null,
    }])
    mockMarketingKats()

    const ausgaben = [
      { produkt_id: PRODUKT_ID, sales_plattform_id: PLATTFORM_ID, leistungsdatum: '2026-05-20', betrag_netto: 100 },
    ]
    mockTransactions(ausgaben, [])

    const res = await GET()
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body[0].marketingkosten_pct).toBe(0)
  })

  it('uses weighted calculation with three thirds and weights', async () => {
    mockEinstellungen([{
      sales_plattform_id: PLATTFORM_ID,
      produkt_id: PRODUKT_ID,
      berechnungsart: 'gewichtet_30',
      gewichtung_erstes_drittel: 20,
      gewichtung_zweites_drittel: 30,
      gewichtung_drittes_drittel: 50,
    }])
    mockMarketingKats()

    // Period: 2026-05-11 to 2026-06-10 (30 days); thirds = 10 days each
    // Third 1: 2026-05-11 to 2026-05-21
    // Third 2: 2026-05-21 to 2026-05-31
    // Third 3: 2026-05-31 to 2026-06-10
    const ausgaben = [
      { produkt_id: PRODUKT_ID, sales_plattform_id: PLATTFORM_ID, leistungsdatum: '2026-05-15', betrag_netto: 100 }, // t1
      { produkt_id: PRODUKT_ID, sales_plattform_id: PLATTFORM_ID, leistungsdatum: '2026-05-25', betrag_netto: 60 },  // t2
      { produkt_id: PRODUKT_ID, sales_plattform_id: PLATTFORM_ID, leistungsdatum: '2026-06-05', betrag_netto: 80 },  // t3
    ]
    const umsatz = [
      { produkt_id: PRODUKT_ID, sales_plattform_id: PLATTFORM_ID, leistungsdatum: '2026-05-15', betrag: 1000 }, // t1
      { produkt_id: PRODUKT_ID, sales_plattform_id: PLATTFORM_ID, leistungsdatum: '2026-05-25', betrag: 600 },  // t2
      { produkt_id: PRODUKT_ID, sales_plattform_id: PLATTFORM_ID, leistungsdatum: '2026-06-05', betrag: 400 },  // t3
    ]
    mockTransactions(ausgaben, umsatz)

    const res = await GET()
    expect(res.status).toBe(200)
    const body = await res.json()
    // pct1 = 100/1000*100 = 10, pct2 = 60/600*100 = 10, pct3 = 80/400*100 = 20
    // result = (20*10 + 30*10 + 50*20) / 100 = (200 + 300 + 1000) / 100 = 15
    expect(body[0].marketingkosten_pct).toBe(15)
  })

  it('falls back to simple ratio when weights are null for gewichtet', async () => {
    mockEinstellungen([{
      sales_plattform_id: PLATTFORM_ID,
      produkt_id: PRODUKT_ID,
      berechnungsart: 'gewichtet_30',
      gewichtung_erstes_drittel: null,
      gewichtung_zweites_drittel: null,
      gewichtung_drittes_drittel: null,
    }])
    mockMarketingKats()

    const ausgaben = [
      { produkt_id: PRODUKT_ID, sales_plattform_id: PLATTFORM_ID, leistungsdatum: '2026-05-20', betrag_netto: 200 },
    ]
    const umsatz = [
      { produkt_id: PRODUKT_ID, sales_plattform_id: PLATTFORM_ID, leistungsdatum: '2026-05-20', betrag: 2000 },
    ]
    mockTransactions(ausgaben, umsatz)

    const res = await GET()
    expect(res.status).toBe(200)
    const body = await res.json()
    // fallback: 200 / 2000 * 100 = 10
    expect(body[0].marketingkosten_pct).toBe(10)
  })

  it('ignores transactions without produkt_id or sales_plattform_id', async () => {
    mockEinstellungen([{
      sales_plattform_id: PLATTFORM_ID,
      produkt_id: PRODUKT_ID,
      berechnungsart: 'mittelwert_30',
      gewichtung_erstes_drittel: null,
      gewichtung_zweites_drittel: null,
      gewichtung_drittes_drittel: null,
    }])
    mockMarketingKats()

    const ausgaben = [
      { produkt_id: null, sales_plattform_id: PLATTFORM_ID, leistungsdatum: '2026-05-20', betrag_netto: 999 },
    ]
    const umsatz = [
      { produkt_id: PRODUKT_ID, sales_plattform_id: null, leistungsdatum: '2026-05-20', betrag: 9999 },
    ]
    mockTransactions(ausgaben, umsatz)

    const res = await GET()
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body[0].marketingkosten_pct).toBe(0)
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

  it('returns 500 when einstellungen query fails', async () => {
    mockFrom.mockReturnValueOnce({
      select: () => ({
        eq: () => ({
          neq: () => ({ limit: () => ({ data: null, error: { message: 'DB error' } }) }),
        }),
      }),
    })

    const res = await GET()
    expect(res.status).toBe(500)
  })

  it('returns 500 when ausgaben query fails', async () => {
    mockEinstellungen([{
      sales_plattform_id: PLATTFORM_ID,
      produkt_id: PRODUKT_ID,
      berechnungsart: 'mittelwert_30',
      gewichtung_erstes_drittel: null,
      gewichtung_zweites_drittel: null,
      gewichtung_drittes_drittel: null,
    }])
    mockMarketingKats()

    mockFrom.mockReturnValueOnce({
      select: () => ({
        gte: () => ({
          lt: () => ({
            in: () => ({
              in: () => ({
                in: () => ({
                  eq: () => ({ limit: () => ({ data: null, error: { message: 'DB error' } }) }),
                }),
              }),
            }),
          }),
        }),
      }),
    })

    const res = await GET()
    expect(res.status).toBe(500)
  })
})
