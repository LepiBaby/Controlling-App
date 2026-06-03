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

const PRODUKT_ID   = '11111111-1111-1111-8111-111111111111'
const PLATTFORM_ID = '22222222-2222-2222-8222-222222222222'

beforeEach(() => {
  vi.clearAllMocks()
  mockFrom.mockReset()
})

// Helper: mock einstellungen query result
function mockEinstellungen(data: unknown[], dbError: { message: string } | null = null) {
  mockFrom.mockReturnValueOnce({
    select: () => ({
      eq: () => ({
        neq: () => ({
          limit: () => ({ data, error: dbError }),
        }),
      }),
    }),
  })
}

// Helper: mock bestand_transaktionen query result
function mockTransaktionen(data: unknown[], dbError: { message: string } | null = null) {
  mockFrom.mockReturnValueOnce({
    select: () => ({
      gte: () => ({
        lt: () => ({
          in: () => ({
            limit: () => ({ data, error: dbError }),
          }),
        }),
      }),
    }),
  })
}

describe('GET /api/absatz-planung/historisch', () => {
  it('returns 200 with empty data when no einstellungen exist', async () => {
    mockEinstellungen([])

    const res = await GET()
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body).toEqual({ data: [] })
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
    mockEinstellungen([], { message: 'DB error' })

    const res = await GET()
    expect(res.status).toBe(500)
  })

  it('returns 200 with tagesdurchschnitt = 0 when no sendungen exist', async () => {
    mockEinstellungen([{
      sales_plattform_id: PLATTFORM_ID,
      produkt_id: PRODUKT_ID,
      berechnungsart: 'mittelwert_14',
      gewichtung_erstes_drittel: null,
      gewichtung_zweites_drittel: null,
      gewichtung_drittes_drittel: null,
    }])
    mockTransaktionen([]) // no historical data

    const res = await GET()
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.data).toHaveLength(1)
    expect(body.data[0].tagesdurchschnitt).toBe(0)
    expect(body.data[0].produkt_id).toBe(PRODUKT_ID)
    expect(body.data[0].sales_plattform_id).toBe(PLATTFORM_ID)
  })

  it('returns correct mittelwert_14 calculation', async () => {
    // 28 total sendungen over 14 days = 2 per day
    const today = new Date()
    today.setUTCHours(0, 0, 0, 0)

    // Create 14 entries, one per day, each with menge=2 for our plattform
    const transaktionen = Array.from({ length: 14 }, (_, i) => {
      const d = new Date(today.getTime() - (i + 1) * 86_400_000)
      return {
        produkt_id: PRODUKT_ID,
        datum: d.toISOString().slice(0, 10),
        bestand_sendungen: [{ plattform_id: PLATTFORM_ID, menge: 2 }],
      }
    })

    mockEinstellungen([{
      sales_plattform_id: PLATTFORM_ID,
      produkt_id: PRODUKT_ID,
      berechnungsart: 'mittelwert_14',
      gewichtung_erstes_drittel: null,
      gewichtung_zweites_drittel: null,
      gewichtung_drittes_drittel: null,
    }])
    mockTransaktionen(transaktionen)

    const res = await GET()
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.data).toHaveLength(1)
    // 28 total / 14 days = 2.00
    expect(body.data[0].tagesdurchschnitt).toBe(2)
  })

  it('returns correct gewichtet_30 calculation with weights', async () => {
    // Third 1 (oldest, 10 days): 10 * 1 menge = sum=10, avg=1
    // Third 2 (middle, 10 days): 10 * 2 menge = sum=20, avg=2
    // Third 3 (newest, 10 days): 10 * 3 menge = sum=30, avg=3
    // Weights: w1=20, w2=30, w3=50
    // Result = (20*1 + 30*2 + 50*3) / 100 = (20 + 60 + 150) / 100 = 2.30
    const today = new Date()
    today.setUTCHours(0, 0, 0, 0)

    const transaktionen: unknown[] = []
    for (let i = 0; i < 30; i++) {
      const d = new Date(today.getTime() - (i + 1) * 86_400_000)
      // i=0..9 → newest (third 3): 3 per day
      // i=10..19 → middle (third 2): 2 per day
      // i=20..29 → oldest (third 1): 1 per day
      const menge = i < 10 ? 3 : i < 20 ? 2 : 1
      transaktionen.push({
        produkt_id: PRODUKT_ID,
        datum: d.toISOString().slice(0, 10),
        bestand_sendungen: [{ plattform_id: PLATTFORM_ID, menge }],
      })
    }

    mockEinstellungen([{
      sales_plattform_id: PLATTFORM_ID,
      produkt_id: PRODUKT_ID,
      berechnungsart: 'gewichtet_30',
      gewichtung_erstes_drittel: 20,
      gewichtung_zweites_drittel: 30,
      gewichtung_drittes_drittel: 50,
    }])
    mockTransaktionen(transaktionen)

    const res = await GET()
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.data[0].tagesdurchschnitt).toBe(2.30)
  })

  it('falls back to simple average when gewichtet weights are null', async () => {
    // 30 days, 3 sendungen each = 90 total / 30 = 3.00
    const today = new Date()
    today.setUTCHours(0, 0, 0, 0)

    const transaktionen = Array.from({ length: 30 }, (_, i) => {
      const d = new Date(today.getTime() - (i + 1) * 86_400_000)
      return {
        produkt_id: PRODUKT_ID,
        datum: d.toISOString().slice(0, 10),
        bestand_sendungen: [{ plattform_id: PLATTFORM_ID, menge: 3 }],
      }
    })

    mockEinstellungen([{
      sales_plattform_id: PLATTFORM_ID,
      produkt_id: PRODUKT_ID,
      berechnungsart: 'gewichtet_30',
      gewichtung_erstes_drittel: null,
      gewichtung_zweites_drittel: null,
      gewichtung_drittes_drittel: null,
    }])
    mockTransaktionen(transaktionen)

    const res = await GET()
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.data[0].tagesdurchschnitt).toBe(3)
  })

  it('returns 500 when bestand_transaktionen query fails', async () => {
    mockEinstellungen([{
      sales_plattform_id: PLATTFORM_ID,
      produkt_id: PRODUKT_ID,
      berechnungsart: 'mittelwert_30',
      gewichtung_erstes_drittel: null,
      gewichtung_zweites_drittel: null,
      gewichtung_drittes_drittel: null,
    }])
    mockTransaktionen([], { message: 'DB error' })

    const res = await GET()
    expect(res.status).toBe(500)
  })

  it('ignores sendungen for other plattformen', async () => {
    // Our plattform: 2 per day (over 14 days)
    // Other plattform: 10 per day — should not affect result
    const today = new Date()
    today.setUTCHours(0, 0, 0, 0)

    const OTHER_PLATTFORM = '33333333-3333-3333-8333-333333333333'
    const transaktionen = Array.from({ length: 14 }, (_, i) => {
      const d = new Date(today.getTime() - (i + 1) * 86_400_000)
      return {
        produkt_id: PRODUKT_ID,
        datum: d.toISOString().slice(0, 10),
        bestand_sendungen: [
          { plattform_id: PLATTFORM_ID, menge: 2 },
          { plattform_id: OTHER_PLATTFORM, menge: 10 },
        ],
      }
    })

    mockEinstellungen([{
      sales_plattform_id: PLATTFORM_ID,
      produkt_id: PRODUKT_ID,
      berechnungsart: 'mittelwert_14',
      gewichtung_erstes_drittel: null,
      gewichtung_zweites_drittel: null,
      gewichtung_drittes_drittel: null,
    }])
    mockTransaktionen(transaktionen)

    const res = await GET()
    const body = await res.json()
    // Should still be 2 (only PLATTFORM_ID counted)
    expect(body.data[0].tagesdurchschnitt).toBe(2)
  })
})
