import { describe, it, expect, vi, beforeEach } from 'vitest'
import { GET } from './route'

const mockFrom = vi.fn()

vi.mock('@/lib/supabase-server', () => ({
  requireAuth: vi.fn().mockResolvedValue({
    user: { id: 'user-1' },
    supabase: { from: (table: string) => mockFrom(table) },
    error: null,
  }),
}))

function ch(result: { data: unknown; error: unknown }): object {
  const p: object = new Proxy({} as Record<string, unknown>, {
    get(_t, prop) {
      const key = String(prop)
      if (key === 'then') return undefined
      if (key === 'data') return result.data
      if (key === 'error') return result.error
      return (..._args: unknown[]) => p
    },
  })
  return p
}

const EMPTY = ch({ data: [], error: null })

beforeEach(() => {
  vi.clearAllMocks()
  mockFrom.mockReset()
})

function makeRequest(params: Record<string, string>) {
  const url = new URL('http://localhost/api/einnahmen-planung/ist-tatsaechlich')
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v)
  return new Request(url.toString())
}

describe('GET /api/einnahmen-planung/ist-tatsaechlich', () => {
  it('returns 401 when unauthenticated', async () => {
    const { requireAuth } = await import('@/lib/supabase-server')
    vi.mocked(requireAuth).mockResolvedValueOnce({
      user: null,
      supabase: null as never,
      error: new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 }),
    })
    const req = makeRequest({ von_kw: '1', von_jahr: '2026', bis_kw: '3', bis_jahr: '2026' })
    const res = await GET(req)
    expect(res.status).toBe(401)
  })

  it('returns 400 when params are missing', async () => {
    const req = makeRequest({ von_kw: '1', von_jahr: '2026' })
    const res = await GET(req)
    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error).toBeDefined()
  })

  it('returns 400 for invalid kw (0)', async () => {
    const req = makeRequest({ von_kw: '0', von_jahr: '2026', bis_kw: '3', bis_jahr: '2026' })
    const res = await GET(req)
    expect(res.status).toBe(400)
  })

  it('returns 400 for invalid kw (54)', async () => {
    const req = makeRequest({ von_kw: '1', von_jahr: '2026', bis_kw: '54', bis_jahr: '2026' })
    const res = await GET(req)
    expect(res.status).toBe(400)
  })

  it('returns 400 for invalid year (2019)', async () => {
    const req = makeRequest({ von_kw: '1', von_jahr: '2019', bis_kw: '3', bis_jahr: '2026' })
    const res = await GET(req)
    expect(res.status).toBe(400)
  })

  it('returns empty array when no transactions exist', async () => {
    mockFrom.mockReturnValueOnce(EMPTY)
    const req = makeRequest({ von_kw: '1', von_jahr: '2026', bis_kw: '3', bis_jahr: '2026' })
    const res = await GET(req)
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body).toEqual([])
  })

  it('returns 500 on database error', async () => {
    mockFrom.mockReturnValueOnce(ch({ data: null, error: { message: 'DB error' } }))
    const req = makeRequest({ von_kw: '1', von_jahr: '2026', bis_kw: '3', bis_jahr: '2026' })
    const res = await GET(req)
    expect(res.status).toBe(500)
    const body = await res.json()
    expect(body.error).toBe('DB error')
  })

  it('aggregates transactions by leaf category and ISO week', async () => {
    // KW1/2026: Mon 2025-12-29 … Sun 2026-01-04
    const transactions = [
      // gruppe_id present → use gruppe_id as leaf
      { kategorie_id: 'kat-1', gruppe_id: 'grp-1', zahlungsdatum: '2026-01-02', betrag: 100 },
      { kategorie_id: 'kat-1', gruppe_id: 'grp-1', zahlungsdatum: '2026-01-03', betrag: 50 },
      // keine gruppe_id → use kategorie_id as leaf
      { kategorie_id: 'kat-2', gruppe_id: null, zahlungsdatum: '2026-01-02', betrag: 200 },
    ]
    mockFrom.mockReturnValueOnce(ch({ data: transactions, error: null }))
    const req = makeRequest({ von_kw: '1', von_jahr: '2026', bis_kw: '1', bis_jahr: '2026' })
    const res = await GET(req)
    expect(res.status).toBe(200)
    const body: { kategorie_id: string; kw_year: number; kw_number: number; betrag: number }[] = await res.json()
    const grp1Row = body.find(r => r.kategorie_id === 'grp-1')
    const kat2Row = body.find(r => r.kategorie_id === 'kat-2')
    expect(grp1Row).toBeDefined()
    expect(grp1Row!.betrag).toBe(150)
    expect(grp1Row!.kw_number).toBe(1)
    expect(grp1Row!.kw_year).toBe(2026)
    expect(kat2Row).toBeDefined()
    expect(kat2Row!.betrag).toBe(200)
  })

  it('emits a per-platform aggregate row so PV platform sub-rows show Ist-Tatsächlich', async () => {
    // PV transactions carry sales_plattform_id but no KPI gruppe_id.
    // Each must be aggregated under BOTH the PV category id and its platform id.
    const transactions = [
      { kategorie_id: 'pv-kat', gruppe_id: null, sales_plattform_id: 'plt-amazon', zahlungsdatum: '2026-01-02', betrag: 100 },
      { kategorie_id: 'pv-kat', gruppe_id: null, sales_plattform_id: 'plt-amazon', zahlungsdatum: '2026-01-03', betrag: 50 },
      { kategorie_id: 'pv-kat', gruppe_id: null, sales_plattform_id: 'plt-otto', zahlungsdatum: '2026-01-02', betrag: 30 },
    ]
    mockFrom.mockReturnValueOnce(ch({ data: transactions, error: null }))
    const req = makeRequest({ von_kw: '1', von_jahr: '2026', bis_kw: '1', bis_jahr: '2026' })
    const res = await GET(req)
    expect(res.status).toBe(200)
    const body: { kategorie_id: string; betrag: number }[] = await res.json()

    // Category-level aggregate (header) = sum of all PV transactions
    const pvRow = body.find(r => r.kategorie_id === 'pv-kat')
    expect(pvRow?.betrag).toBe(180)

    // Per-platform aggregates (sub-rows) sum back to the header
    const amazonRow = body.find(r => r.kategorie_id === 'plt-amazon')
    const ottoRow = body.find(r => r.kategorie_id === 'plt-otto')
    expect(amazonRow?.betrag).toBe(150)
    expect(ottoRow?.betrag).toBe(30)
  })

  it('splits transactions across weeks correctly', async () => {
    // KW1/2026: 2025-12-29 … 2026-01-04
    // KW2/2026: 2026-01-05 … 2026-01-11
    const transactions = [
      { kategorie_id: 'kat-1', gruppe_id: null, zahlungsdatum: '2026-01-04', betrag: 300 }, // KW1
      { kategorie_id: 'kat-1', gruppe_id: null, zahlungsdatum: '2026-01-05', betrag: 400 }, // KW2
    ]
    mockFrom.mockReturnValueOnce(ch({ data: transactions, error: null }))
    const req = makeRequest({ von_kw: '1', von_jahr: '2026', bis_kw: '2', bis_jahr: '2026' })
    const res = await GET(req)
    expect(res.status).toBe(200)
    const body: { kategorie_id: string; kw_year: number; kw_number: number; betrag: number }[] = await res.json()
    const kw1 = body.find(r => r.kw_number === 1)
    const kw2 = body.find(r => r.kw_number === 2)
    expect(kw1?.betrag).toBe(300)
    expect(kw2?.betrag).toBe(400)
  })

  it('rounds betrag to 2 decimal places', async () => {
    const transactions = [
      { kategorie_id: 'kat-1', gruppe_id: null, zahlungsdatum: '2026-01-02', betrag: 10.005 },
      { kategorie_id: 'kat-1', gruppe_id: null, zahlungsdatum: '2026-01-02', betrag: 10.005 },
    ]
    mockFrom.mockReturnValueOnce(ch({ data: transactions, error: null }))
    const req = makeRequest({ von_kw: '1', von_jahr: '2026', bis_kw: '1', bis_jahr: '2026' })
    const res = await GET(req)
    const body: { betrag: number }[] = await res.json()
    expect(body[0].betrag).toBe(20.01)
  })

  it('skips rows with missing zahlungsdatum', async () => {
    const transactions = [
      { kategorie_id: 'kat-1', gruppe_id: null, zahlungsdatum: null, betrag: 999 },
    ]
    mockFrom.mockReturnValueOnce(ch({ data: transactions, error: null }))
    const req = makeRequest({ von_kw: '1', von_jahr: '2026', bis_kw: '1', bis_jahr: '2026' })
    const res = await GET(req)
    const body = await res.json()
    expect(body).toHaveLength(0)
  })
})
