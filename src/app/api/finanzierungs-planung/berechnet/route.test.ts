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

function buildReq(query: string) {
  return new Request(`http://localhost/api/finanzierungs-planung/berechnet?${query}`)
}

function einstellungenChain(rows: unknown[]) {
  return {
    select: () => ({
      eq: () => ({
        eq: () => ({
          limit: () => ({ data: rows, error: null }),
        }),
      }),
    }),
  }
}

beforeEach(() => {
  vi.clearAllMocks()
  mockFrom.mockReset()
})

describe('GET /api/finanzierungs-planung/berechnet', () => {
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

  it('returns 200 with empty data when no einstellungen exist', async () => {
    mockFrom.mockReturnValueOnce(einstellungenChain([]))

    const res = await GET(buildReq('von_kw=25&von_jahr=2026&bis_kw=30&bis_jahr=2026'))
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.data).toEqual([])
  })

  it('returns 500 when db query fails', async () => {
    mockFrom.mockReturnValueOnce({
      select: () => ({
        eq: () => ({
          eq: () => ({
            limit: () => ({ data: null, error: { message: 'DB error' } }),
          }),
        }),
      }),
    })

    const res = await GET(buildReq('von_kw=25&von_jahr=2026&bis_kw=30&bis_jahr=2026'))
    expect(res.status).toBe(500)
  })

  it('places a monatlich entry in the correct KW', async () => {
    // monatlich, mitte (day 15), June 2026 → 2026-06-15 → KW 25
    mockFrom.mockReturnValueOnce(einstellungenChain([{
      kategorie_id: KAT_L1,
      zahlungsfrequenz: 'monatlich',
      faelligkeits_monate: [],
      zeitpunkt_im_monat: 'mitte',
      bruttobetrag: 1000,
      aktiv_von: null,
      aktiv_bis: null,
      zahlungsziel_tage: 0,
    }]))

    const res = await GET(buildReq('von_kw=25&von_jahr=2026&bis_kw=25&bis_jahr=2026'))
    expect(res.status).toBe(200)
    const body = await res.json()
    const entry = body.data.find((d: { kw_year: number; kw_number: number }) =>
      d.kw_year === 2026 && d.kw_number === 25,
    )
    expect(entry).toBeDefined()
    expect(entry.kategorie_id).toBe(KAT_L1)
    expect(entry.wert).toBe(1000)
  })

  it('shifts payment date by zahlungsziel_tage days', async () => {
    // anfang (day 4) of June 2026 → 2026-06-04. +14 days → 2026-06-18 → KW 25
    mockFrom.mockReturnValueOnce(einstellungenChain([{
      kategorie_id: KAT_L1,
      zahlungsfrequenz: 'monatlich',
      faelligkeits_monate: [],
      zeitpunkt_im_monat: 'anfang',
      bruttobetrag: 800,
      aktiv_von: null,
      aktiv_bis: null,
      zahlungsziel_tage: 14,
    }]))

    const res = await GET(buildReq('von_kw=25&von_jahr=2026&bis_kw=25&bis_jahr=2026'))
    expect(res.status).toBe(200)
    const body = await res.json()
    // 2026-06-04 + 14 days = 2026-06-18, which is KW 25 2026
    const entry = body.data.find((d: { kw_year: number; kw_number: number }) =>
      d.kw_year === 2026 && d.kw_number === 25,
    )
    expect(entry).toBeDefined()
    expect(entry.wert).toBe(800)
  })

  it('excludes entries where base date is before aktiv_von', async () => {
    mockFrom.mockReturnValueOnce(einstellungenChain([{
      kategorie_id: KAT_L1,
      zahlungsfrequenz: 'monatlich',
      faelligkeits_monate: [],
      zeitpunkt_im_monat: 'mitte',
      bruttobetrag: 1200,
      aktiv_von: '2026-08-01',
      aktiv_bis: null,
      zahlungsziel_tage: 0,
    }]))

    const res = await GET(buildReq('von_kw=25&von_jahr=2026&bis_kw=30&bis_jahr=2026'))
    expect(res.status).toBe(200)
    const body = await res.json()
    const juneEntries = body.data.filter((d: { kw_year: number }) => d.kw_year === 2026)
    expect(juneEntries.length).toBe(0)
  })

  it('excludes entries where base date is after aktiv_bis', async () => {
    mockFrom.mockReturnValueOnce(einstellungenChain([{
      kategorie_id: KAT_L1,
      zahlungsfrequenz: 'monatlich',
      faelligkeits_monate: [],
      zeitpunkt_im_monat: 'mitte',
      bruttobetrag: 700,
      aktiv_von: null,
      aktiv_bis: '2026-05-31',
      zahlungsziel_tage: 0,
    }]))

    const res = await GET(buildReq('von_kw=25&von_jahr=2026&bis_kw=30&bis_jahr=2026'))
    expect(res.status).toBe(200)
    const body = await res.json()
    const juneEntries = body.data.filter((d: { kw_year: number }) => d.kw_year === 2026)
    expect(juneEntries.length).toBe(0)
  })

  it('checks aktiv period against base date NOT payment date', async () => {
    // anfang (day 4) of June 2026 → base date 2026-06-04. aktiv_bis = 2026-06-05 →
    // base date within aktiv period → included.
    // zahlungsziel 30 days → 2026-07-04 (Sat) → skipWeekend → 2026-07-06 (Mon) = KW28
    mockFrom.mockReturnValueOnce(einstellungenChain([{
      kategorie_id: KAT_L1,
      zahlungsfrequenz: 'monatlich',
      faelligkeits_monate: [],
      zeitpunkt_im_monat: 'anfang',
      bruttobetrag: 600,
      aktiv_von: null,
      aktiv_bis: '2026-06-05',
      zahlungsziel_tage: 30,
    }]))

    const res = await GET(buildReq('von_kw=25&von_jahr=2026&bis_kw=28&bis_jahr=2026'))
    expect(res.status).toBe(200)
    const body = await res.json()
    const entry = body.data.find((d: { kw_year: number; kw_number: number }) =>
      d.kw_year === 2026 && d.kw_number === 28,
    )
    expect(entry).toBeDefined()
    expect(entry.wert).toBe(600)
  })

  it('sums multiple einstellungen entries in the same KW for the same category', async () => {
    mockFrom.mockReturnValueOnce(einstellungenChain([
      {
        kategorie_id: KAT_L1,
        zahlungsfrequenz: 'monatlich',
        faelligkeits_monate: [],
        zeitpunkt_im_monat: 'mitte',
        bruttobetrag: 300,
        aktiv_von: null,
        aktiv_bis: null,
        zahlungsziel_tage: 0,
      },
      {
        kategorie_id: KAT_L1,
        zahlungsfrequenz: 'monatlich',
        faelligkeits_monate: [],
        zeitpunkt_im_monat: 'mitte',
        bruttobetrag: 200,
        aktiv_von: null,
        aktiv_bis: null,
        zahlungsziel_tage: 0,
      },
    ]))

    const res = await GET(buildReq('von_kw=25&von_jahr=2026&bis_kw=25&bis_jahr=2026'))
    expect(res.status).toBe(200)
    const body = await res.json()
    const entry = body.data.find((d: { kw_year: number; kw_number: number }) =>
      d.kw_year === 2026 && d.kw_number === 25,
    )
    expect(entry?.wert).toBe(500)
  })

  it('only fires in specific month for jaehrlich frequency', async () => {
    // jährlich, only in month 6 (June), anfang → day 4 → KW 23/24 2026
    mockFrom.mockReturnValueOnce(einstellungenChain([{
      kategorie_id: KAT_L1,
      zahlungsfrequenz: 'jaehrlich',
      faelligkeits_monate: [6],
      zeitpunkt_im_monat: 'anfang',
      bruttobetrag: 5000,
      aktiv_von: null,
      aktiv_bis: null,
      zahlungsziel_tage: 0,
    }]))

    const res = await GET(buildReq('von_kw=20&von_jahr=2026&bis_kw=35&bis_jahr=2026'))
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.data).toHaveLength(1)
    expect(body.data[0].wert).toBe(5000)
  })

  it('fires in all months for monatlich frequency', async () => {
    mockFrom.mockReturnValueOnce(einstellungenChain([{
      kategorie_id: KAT_L1,
      zahlungsfrequenz: 'monatlich',
      faelligkeits_monate: [],
      zeitpunkt_im_monat: 'anfang',
      bruttobetrag: 100,
      aktiv_von: null,
      aktiv_bis: null,
      zahlungsziel_tage: 0,
    }]))

    const res = await GET(buildReq('von_kw=1&von_jahr=2026&bis_kw=52&bis_jahr=2026'))
    expect(res.status).toBe(200)
    const body = await res.json()
    // 12 months × 1 entry each = 12 entries (anfang = day 4, each month once)
    expect(body.data.length).toBe(12)
  })

  it('fires in quartalsweise months only', async () => {
    // quartalsweise, Q1=3 (März), Q2=6 (Juni), Q3=9 (Sept), Q4=12 (Dez), mitte
    mockFrom.mockReturnValueOnce(einstellungenChain([{
      kategorie_id: KAT_L1,
      zahlungsfrequenz: 'quartalsweise',
      faelligkeits_monate: [3, 6, 9, 12],
      zeitpunkt_im_monat: 'mitte',
      bruttobetrag: 2000,
      aktiv_von: null,
      aktiv_bis: null,
      zahlungsziel_tage: 0,
    }]))

    const res = await GET(buildReq('von_kw=1&von_jahr=2026&bis_kw=52&bis_jahr=2026'))
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.data.length).toBe(4)
    for (const d of body.data) {
      expect(d.wert).toBe(2000)
    }
  })
})
