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
const NULL_DATA = ch({ data: null, error: null })

beforeEach(() => {
  vi.clearAllMocks()
  mockFrom.mockReset()
})

// KPI category tree: one product, one platform, vertrieb/marketing L1+L2 categories
const KAT_ROWS = [
  { id: 'platt-1', name: 'Amazon DE', parent_id: null, type: 'sales_plattformen', ist_abzugsposten: false, level: 1 },
  { id: 'prod-1', name: 'Produkt A', parent_id: null, type: 'produkte', ist_abzugsposten: false, level: 1 },
  { id: 'sku-1', name: 'SKU A1', parent_id: 'prod-1', type: 'produkte', ist_abzugsposten: false, level: 2 },
  { id: 'brutto-1', name: 'Bruttoumsatz', parent_id: null, type: 'umsatz', ist_abzugsposten: false, level: 1 },
  { id: 'rueck-1', name: 'Rückerstattungen', parent_id: null, type: 'umsatz', ist_abzugsposten: true, level: 1 },
  { id: 'vertrieb-1', name: 'Vertrieb', parent_id: null, type: 'ausgaben_kosten', ist_abzugsposten: false, level: 1 },
  { id: 'versand-2', name: 'Versandausgaben', parent_id: 'vertrieb-1', type: 'ausgaben_kosten', ist_abzugsposten: false, level: 2 },
  { id: 'lager-2', name: 'Lagerausgaben', parent_id: 'vertrieb-1', type: 'ausgaben_kosten', ist_abzugsposten: false, level: 2 },
  { id: 'retour-2', name: 'Retourenausgaben', parent_id: 'vertrieb-1', type: 'ausgaben_kosten', ist_abzugsposten: false, level: 2 },
  { id: 'kulanz-2', name: 'Ersatzteile/Kulanz', parent_id: 'vertrieb-1', type: 'ausgaben_kosten', ist_abzugsposten: false, level: 2 },
  { id: 'mkt-1', name: 'Marketing', parent_id: null, type: 'ausgaben_kosten', ist_abzugsposten: false, level: 1 },
  { id: 'mkt-2', name: 'Suchmaschinen', parent_id: 'mkt-1', type: 'ausgaben_kosten', ist_abzugsposten: false, level: 2 },
]

// Parallel mocks for Promise.all in the berechnet route.
// Order matches the Promise.all array in the route (20 calls):
//  0: absatz_planung
//  1: absatz_einstellungen
//  2: bestand_transaktionen
//  3: versandausgaben_einstellungen
//  4: versandausgaben_plattform_einstellungen
//  5: lagerausgaben_einstellungen
//  6: lagerausgaben_plattform_einstellungen
//  7: produktinformationen_containerkapazitaet
//  8: retouren_allgemein_produkt_einstellungen
//  9: retouren_allgemein_einstellungen  (maybeSingle → NULL_DATA)
// 10: ersatzteile_kulanz_einstellungen
// 11: ersatzteile_kulanz_plattform_einstellungen
// 12: marketing_planung
// 13: marketing_kategorie_einstellungen
// 14: auszahlungs_marketing_gruppen
// 15: bestellungen
// 16: bestellungen_produkte
// 17: bestellungen_kosten
// 18: ust_kategorie_saetze
// 19: umsatz_transaktionen
function setupParallelMocks(overrides: Partial<Record<number, object>> = {}) {
  const defaults: object[] = [
    EMPTY, EMPTY, EMPTY, EMPTY, EMPTY,  // 0-4
    EMPTY, EMPTY, EMPTY, EMPTY, NULL_DATA, // 5-9
    EMPTY, EMPTY, EMPTY, EMPTY, EMPTY,  // 10-14
    EMPTY, EMPTY, EMPTY, EMPTY, EMPTY,  // 15-19
  ]
  const resolved = defaults.map((d, i) => overrides[i] ?? d)
  for (const m of resolved) mockFrom.mockReturnValueOnce(m)
}

function makeRequest(params = { von_kw: 26, von_jahr: 2026, bis_kw: 26, bis_jahr: 2026 }) {
  const url = new URL('http://localhost/api/umsatzausgaben-planung/berechnet')
  Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, String(v)))
  return new Request(url.toString())
}

describe('GET /api/umsatzausgaben-planung/berechnet', () => {
  it('returns 401 when unauthenticated', async () => {
    const { requireAuth } = await import('@/lib/supabase-server')
    vi.mocked(requireAuth).mockResolvedValueOnce({
      user: null, supabase: null as never,
      error: new Response('Unauthorized', { status: 401 }),
    })
    const res = await GET(makeRequest())
    expect(res.status).toBe(401)
  })

  it('returns 400 when query params are missing', async () => {
    const res = await GET(new Request('http://localhost/api/umsatzausgaben-planung/berechnet'))
    expect(res.status).toBe(400)
  })

  it('returns empty data when no products exist in kpi_categories', async () => {
    mockFrom.mockReturnValueOnce(ch({ data: [], error: null }))
    const res = await GET(makeRequest())
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.data).toEqual([])
  })

  it('returns empty data when all parallel queries return empty', async () => {
    mockFrom.mockReturnValueOnce(ch({ data: KAT_ROWS, error: null }))
    setupParallelMocks()
    const res = await GET(makeRequest())
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.data).toEqual([])
  })

  it('computes Versandausgaben from absatz + versandgebuehr with no payment shift', async () => {
    mockFrom.mockReturnValueOnce(ch({ data: KAT_ROWS, error: null }))
    setupParallelMocks({
      0: ch({ // absatz_planung: 10 units on week 26/2026 for prod-1 on platt-1
        data: [{
          sku_id: 'sku-1', produkt_id: 'prod-1', sales_plattform_id: 'platt-1',
          kw_year: 2026, kw_number: 26, absatz_manuell: 10, effektiver_vk_manuell: null,
        }],
        error: null,
      }),
      3: ch({ // versandausgaben_einstellungen: spediteur=5, 3pl=2 → total=7/unit
        data: [{ sales_plattform_id: 'platt-1', produkt_id: 'prod-1', versandgebuehr_spediteur: 5, versandgebuehr_3pl: 2 }],
        error: null,
      }),
      4: ch({ // versandausgaben_plattform_einstellungen: no shift (zahlungsziel=0, no gruppierung)
        data: [{ sales_plattform_id: 'platt-1', zahlungsziel_tage: 0, gruppierung: null, naechste_zahlung_basis_kw: null, naechste_zahlung_basis_jahr: null }],
        error: null,
      }),
    })
    const res = await GET(makeRequest())
    expect(res.status).toBe(200)
    const body = await res.json()
    // 10 units * 7 EUR = 70 EUR on week 26/2026 for prod-1, versand-2 category
    const versandRow = body.data.find((r: { kategorie_id: string; produkt_id: string; kw_number: number; wert: number }) =>
      r.kategorie_id === 'versand-2' && r.produkt_id === 'prod-1' && r.kw_number === 26
    )
    expect(versandRow).toBeDefined()
    expect(versandRow?.wert).toBeCloseTo(70, 1)
  })

  it('computes Bestellkosten (Produktausgaben) from bestellungen + kosten', async () => {
    mockFrom.mockReturnValueOnce(ch({ data: KAT_ROWS, error: null }))

    // Need an ausgaben_kosten L1 for "Produktausgaben" - add to KAT_ROWS conceptually via bestellungen_kosten with a matching kpi_kategorie_id
    // Route distributes bestellkosten across products by bestellungen_produkte, grouped by kpi_kategorie_id
    const BESTELLUNG_ID = 'best-1'
    setupParallelMocks({
      15: ch({ // bestellungen: one plan order
        data: [{ id: BESTELLUNG_ID, status: 'plan', bestelldatum: '2026-06-23', ankunftsdatum: null, ankunftsdatum_ist: null }],
        error: null,
      }),
      16: ch({ // bestellungen_produkte: prod-1 in this order
        data: [{ bestellung_id: BESTELLUNG_ID, produkt_id: 'prod-1' }],
        error: null,
      }),
      17: ch({ // bestellungen_kosten: 100 EUR for versand-2 category on KW26
        data: [{ bestellung_id: BESTELLUNG_ID, kpi_kategorie_id: 'versand-2', datum: '2026-06-23', nettobetrag: 100 }],
        error: null,
      }),
    })
    const res = await GET(makeRequest())
    expect(res.status).toBe(200)
    const body = await res.json()
    // bestellkosten 100 for versand-2 assigned to prod-1 (only product in order) on KW26
    const bestRow = body.data.find((r: { kategorie_id: string; produkt_id: string; kw_number: number }) =>
      r.kategorie_id === 'versand-2' && r.produkt_id === 'prod-1'
    )
    expect(bestRow).toBeDefined()
    expect(bestRow?.wert).toBeGreaterThan(0)
  })
})
