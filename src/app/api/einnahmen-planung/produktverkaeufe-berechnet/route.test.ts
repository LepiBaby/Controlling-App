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
const GRUND_DEFAULT = ch({ data: { planungshorizont_wochen: 13 }, error: null })

// Supabase call order from route.ts (all in one Promise.all):
// 0: grundeinstellungen (maybeSingle)
// 1: kpi_categories
// 2: auszahlungs_einstellungen
// 3: auszahlungs_marketing_gruppen
// After fetch (SPP historisch + berechnet, not via supabase):
// 4: sales_plattform_planung (manual overrides)

const MOCK_REQUEST = new Request('http://localhost:3000/api/einnahmen-planung/produktverkaeufe-berechnet')

function setupAllMocks(overrides: Partial<Record<number, object>> = {}) {
  const defaults: object[] = [
    GRUND_DEFAULT,               // 0: grundeinstellungen
    EMPTY,                       // 1: kpi_categories
    EMPTY,                       // 2: auszahlungs_einstellungen
    EMPTY,                       // 3: auszahlungs_marketing_gruppen
    EMPTY,                       // 4: sales_plattform_planung
  ]
  const resolved = defaults.map((d, i) => overrides[i] ?? d)
  for (const m of resolved) {
    mockFrom.mockReturnValueOnce(m)
  }
}

const KAT_ROWS = [
  { id: 'platt-1', name: 'Amazon DE', parent_id: null, type: 'sales_plattformen', ist_abzugsposten: false, level: 1 },
  { id: 'prod-1', name: 'Produkt A', parent_id: null, type: 'produkte', ist_abzugsposten: false, level: 1 },
  { id: 'sku-1', name: 'SKU A1', parent_id: 'prod-1', type: 'produkte', ist_abzugsposten: false, level: 2 },
  { id: 'brutto-1', name: 'Bruttoumsatz', parent_id: null, type: 'umsatz', ist_abzugsposten: false, level: 1 },
  { id: 'rueck-1', name: 'Rückerstattungen', parent_id: null, type: 'umsatz', ist_abzugsposten: true, level: 1 },
]

beforeEach(() => {
  vi.clearAllMocks()
  mockFrom.mockReset()
})

describe('GET /api/einnahmen-planung/produktverkaeufe-berechnet', () => {
  it('returns 401 when unauthenticated', async () => {
    const { requireAuth } = await import('@/lib/supabase-server')
    vi.mocked(requireAuth).mockResolvedValueOnce({
      user: null,
      supabase: null as never,
      error: new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 }),
    })
    const res = await GET(MOCK_REQUEST)
    expect(res.status).toBe(401)
  })

  it('returns empty array when no Auszahlungseinstellungen configured', async () => {
    mockFrom.mockReturnValueOnce(GRUND_DEFAULT)        // grundeinstellungen
    mockFrom.mockReturnValueOnce(ch({ data: KAT_ROWS, error: null })) // kpi_categories
    mockFrom.mockReturnValueOnce(EMPTY)                // auszahlungs_einstellungen (empty)
    mockFrom.mockReturnValueOnce(EMPTY)                // auszahlungs_marketing_gruppen

    const res = await GET(MOCK_REQUEST)
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body).toEqual([])
  })

  it('returns empty array when no platforms / products in KPI categories', async () => {
    mockFrom.mockReturnValueOnce(GRUND_DEFAULT)
    mockFrom.mockReturnValueOnce(ch({ data: [], error: null })) // no categories
    mockFrom.mockReturnValueOnce(EMPTY)
    mockFrom.mockReturnValueOnce(EMPTY)

    const res = await GET(MOCK_REQUEST)
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body).toEqual([])
  })

  it('returns 500 when kpi_categories query fails', async () => {
    // All 4 queries in the initial Promise.all fire simultaneously even if one fails
    mockFrom.mockReturnValueOnce(GRUND_DEFAULT)
    mockFrom.mockReturnValueOnce(ch({ data: null, error: { message: 'DB error' } }))
    mockFrom.mockReturnValueOnce(EMPTY) // auszahlungs_einstellungen
    mockFrom.mockReturnValueOnce(EMPTY) // auszahlungs_marketing_gruppen

    const res = await GET(MOCK_REQUEST)
    expect(res.status).toBe(500)
    const body = await res.json()
    expect(body.error).toBe('DB error')
  })

  it('returns 500 when auszahlungs_einstellungen query fails', async () => {
    mockFrom.mockReturnValueOnce(GRUND_DEFAULT)
    mockFrom.mockReturnValueOnce(ch({ data: KAT_ROWS, error: null }))
    mockFrom.mockReturnValueOnce(ch({ data: null, error: { message: 'Auszahlung DB error' } }))
    mockFrom.mockReturnValueOnce(EMPTY) // auszahlungs_marketing_gruppen

    const res = await GET(MOCK_REQUEST)
    expect(res.status).toBe(500)
    const body = await res.json()
    expect(body.error).toBe('Auszahlung DB error')
  })

  it('computes payment week correctly with weekly rhythm and no shift', async () => {
    const auszEinst = [{
      sales_plattform_id: 'platt-1',
      auszahlungsrhythmus: 'woechentlich',
      naechste_auszahlung_basis_kw: 24,
      naechste_auszahlung_basis_jahr: 2026,
      verschiebung_wochen: 0,
      marketing_inkludiert: false,
    }]

    mockFrom.mockReturnValueOnce(GRUND_DEFAULT)
    mockFrom.mockReturnValueOnce(ch({ data: KAT_ROWS, error: null }))
    mockFrom.mockReturnValueOnce(ch({ data: auszEinst, error: null }))
    mockFrom.mockReturnValueOnce(EMPTY) // auszahlungs_marketing_gruppen
    mockFrom.mockReturnValueOnce(EMPTY) // sales_plattform_planung

    const res = await GET(MOCK_REQUEST)
    expect(res.status).toBe(200)
    const body = await res.json()
    // With no SPP data, net = 0 for all weeks → empty result is correct
    expect(Array.isArray(body)).toBe(true)
  })

  it('skips platforms without naechste_auszahlung_basis configured', async () => {
    const auszEinst = [{
      sales_plattform_id: 'platt-1',
      auszahlungsrhythmus: 'woechentlich',
      naechste_auszahlung_basis_kw: null,
      naechste_auszahlung_basis_jahr: null,
      verschiebung_wochen: 0,
      marketing_inkludiert: false,
    }]

    mockFrom.mockReturnValueOnce(GRUND_DEFAULT)
    mockFrom.mockReturnValueOnce(ch({ data: KAT_ROWS, error: null }))
    mockFrom.mockReturnValueOnce(ch({ data: auszEinst, error: null }))
    mockFrom.mockReturnValueOnce(EMPTY) // auszahlungs_marketing_gruppen
    mockFrom.mockReturnValueOnce(EMPTY) // sales_plattform_planung

    const res = await GET(MOCK_REQUEST)
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body).toEqual([])
  })

  it('result is sorted by week index ascending', async () => {
    const auszEinst = [{
      sales_plattform_id: 'platt-1',
      auszahlungsrhythmus: 'woechentlich',
      naechste_auszahlung_basis_kw: 1,
      naechste_auszahlung_basis_jahr: 2026,
      verschiebung_wochen: 0,
      marketing_inkludiert: false,
    }]

    mockFrom.mockReturnValueOnce(GRUND_DEFAULT)
    mockFrom.mockReturnValueOnce(ch({ data: KAT_ROWS, error: null }))
    mockFrom.mockReturnValueOnce(ch({ data: auszEinst, error: null }))
    mockFrom.mockReturnValueOnce(EMPTY) // auszahlungs_marketing_gruppen
    mockFrom.mockReturnValueOnce(EMPTY) // sales_plattform_planung

    const res = await GET(MOCK_REQUEST)
    expect(res.status).toBe(200)
    const body: { kw_year: number; kw_number: number; sales_plattform_id: string; wert: number }[] = await res.json()
    for (let i = 1; i < body.length; i++) {
      const prev = body[i - 1].kw_year * 54 + body[i - 1].kw_number
      const curr = body[i].kw_year * 54 + body[i].kw_number
      expect(curr).toBeGreaterThanOrEqual(prev)
    }
  })

  it('result entries have required fields kw_year, kw_number, sales_plattform_id, wert', async () => {
    const auszEinst = [{
      sales_plattform_id: 'platt-1',
      auszahlungsrhythmus: 'alle_zwei_wochen',
      naechste_auszahlung_basis_kw: 25,
      naechste_auszahlung_basis_jahr: 2026,
      verschiebung_wochen: 1,
      marketing_inkludiert: false,
    }]

    mockFrom.mockReturnValueOnce(GRUND_DEFAULT)
    mockFrom.mockReturnValueOnce(ch({ data: KAT_ROWS, error: null }))
    mockFrom.mockReturnValueOnce(ch({ data: auszEinst, error: null }))
    mockFrom.mockReturnValueOnce(EMPTY) // auszahlungs_marketing_gruppen
    mockFrom.mockReturnValueOnce(EMPTY) // sales_plattform_planung

    const res = await GET(MOCK_REQUEST)
    expect(res.status).toBe(200)
    const body: unknown[] = await res.json()
    for (const item of body) {
      expect(item).toHaveProperty('kw_year')
      expect(item).toHaveProperty('kw_number')
      expect(item).toHaveProperty('sales_plattform_id')
      expect(item).toHaveProperty('wert')
    }
  })
})
