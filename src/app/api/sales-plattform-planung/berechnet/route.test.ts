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

const KAT_ROWS = [
  { id: 'platt-1', name: 'Amazon DE', parent_id: null, type: 'sales_plattformen', ist_abzugsposten: false, level: 1 },
  { id: 'prod-1', name: 'Produkt A', parent_id: null, type: 'produkte', ist_abzugsposten: false, level: 1 },
  { id: 'sku-1', name: 'SKU A1', parent_id: 'prod-1', type: 'produkte', ist_abzugsposten: false, level: 2 },
  { id: 'brutto-1', name: 'Bruttoumsatz', parent_id: null, type: 'umsatz', ist_abzugsposten: false, level: 1 },
  { id: 'rueck-1', name: 'Rückerstattungen', parent_id: null, type: 'umsatz', ist_abzugsposten: true, level: 1 },
  { id: 'rabatt-1', name: 'Rabatte', parent_id: null, type: 'umsatz', ist_abzugsposten: true, level: 1 },
  { id: 'mkt-1', name: 'Marketing', parent_id: null, type: 'ausgaben_kosten', ist_abzugsposten: false, level: 1 },
]

// Provide all parallel mocks for the data loading phase
function setupParallelMocks(overrides: Partial<Record<number, object>> = {}) {
  // retouren_plattform_einstellungen is Promise.resolve (no mockFrom call)
  // 0: absatz_planung, 1: absatz_einstellungen, 2: bestand_transaktionen,
  // 3: retouren_einstellungen, 4: verkaufsgebuehr_einstellungen,
  // 5: marketing_planung, 6: marketing_einstellungen,
  // 7: umsatz_transaktionen, 8: ausgaben_kosten_transaktionen,
  // 9: ust_kategorie_saetze (PROJ-65), 10: auszahlungs_marketing_gruppen (PROJ-66)
  const defaults: object[] = [EMPTY, EMPTY, EMPTY, EMPTY, EMPTY, EMPTY, EMPTY, EMPTY, EMPTY, EMPTY, EMPTY]
  const resolved = defaults.map((d, i) => overrides[i] ?? d)
  for (const m of resolved) mockFrom.mockReturnValueOnce(m)
}

describe('GET /api/sales-plattform-planung/berechnet', () => {
  it('returns 401 when unauthenticated', async () => {
    const { requireAuth } = await import('@/lib/supabase-server')
    vi.mocked(requireAuth).mockResolvedValueOnce({
      user: null, supabase: null as never,
      error: new Response('Unauthorized', { status: 401 }),
    })
    const res = await GET()
    expect(res.status).toBe(401)
  })

  it('returns empty array when no products or platforms exist', async () => {
    // Round 1: grundeinstellungen + kpi_categories (no products/platforms)
    mockFrom
      .mockReturnValueOnce(ch({ data: { planungshorizont_wochen: 4 }, error: null }))
      .mockReturnValueOnce(ch({ data: [], error: null }))
    const res = await GET()
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body).toHaveLength(0)
  })

  it('returns empty array when no VK is set in absatz_planung', async () => {
    mockFrom
      .mockReturnValueOnce(ch({ data: { planungshorizont_wochen: 4 }, error: null }))
      .mockReturnValueOnce(ch({ data: KAT_ROWS, error: null }))
    setupParallelMocks({
      0: EMPTY, // absatz_planung - no VK rows
    })
    const res = await GET()
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body).toHaveLength(0)
  })

  it('computes bruttoumsatz correctly when VK and SKU absatz are set', async () => {
    // Use current week's year and week number
    const now = new Date()
    const day = now.getUTCDay() || 7
    const monday = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() - (day - 1)))
    const thu = new Date(monday.getTime() + 3 * 86400000)
    const yearStart = new Date(Date.UTC(thu.getUTCFullYear(), 0, 1))
    const week = Math.ceil(((thu.getTime() - yearStart.getTime()) / 86400000 + 1) / 7)
    const year = thu.getUTCFullYear()

    mockFrom
      .mockReturnValueOnce(ch({ data: { planungshorizont_wochen: 1 }, error: null }))
      .mockReturnValueOnce(ch({ data: KAT_ROWS, error: null }))
    setupParallelMocks({
      0: ch({
        data: [
          // VK row (sku_id=null): VK = 50
          { sku_id: null, produkt_id: 'prod-1', sales_plattform_id: 'platt-1', kw_year: year, kw_number: week, absatz_manuell: null, effektiver_vk_manuell: 50 },
          // SKU absatz row: 10 units
          { sku_id: 'sku-1', produkt_id: 'prod-1', sales_plattform_id: 'platt-1', kw_year: year, kw_number: week, absatz_manuell: 10, effektiver_vk_manuell: null },
        ],
        error: null,
      }),
    })
    const res = await GET()
    expect(res.status).toBe(200)
    const body = await res.json()
    const bruRow = body.find((r: { kategorie: string }) => r.kategorie === 'bruttoumsatz')
    expect(bruRow).toBeDefined()
    // 10 units × €50 VK = €500 Bruttoumsatz
    expect(bruRow.wert).toBe(500)
    expect(bruRow.kw_year).toBe(year)
    expect(bruRow.kw_number).toBe(week)
    expect(bruRow.produkt_id).toBe('prod-1')
    expect(bruRow.sales_plattform_id).toBe('platt-1')
  })

  it('computes verkaufsgebuehr from bruttoumsatz and pct', async () => {
    const now = new Date()
    const day = now.getUTCDay() || 7
    const monday = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() - (day - 1)))
    const thu = new Date(monday.getTime() + 3 * 86400000)
    const yearStart = new Date(Date.UTC(thu.getUTCFullYear(), 0, 1))
    const week = Math.ceil(((thu.getTime() - yearStart.getTime()) / 86400000 + 1) / 7)
    const year = thu.getUTCFullYear()

    mockFrom
      .mockReturnValueOnce(ch({ data: { planungshorizont_wochen: 1 }, error: null }))
      .mockReturnValueOnce(ch({ data: KAT_ROWS, error: null }))
    setupParallelMocks({
      0: ch({
        data: [
          { sku_id: null, produkt_id: 'prod-1', sales_plattform_id: 'platt-1', kw_year: year, kw_number: week, absatz_manuell: null, effektiver_vk_manuell: 100 },
          { sku_id: 'sku-1', produkt_id: 'prod-1', sales_plattform_id: 'platt-1', kw_year: year, kw_number: week, absatz_manuell: 5, effektiver_vk_manuell: null },
        ],
        error: null,
      }),
      4: ch({ data: [{ sales_plattform_id: 'platt-1', produkt_id: 'prod-1', verkaufsgebuehr_prozent: 15 }], error: null }),
    })
    const res = await GET()
    expect(res.status).toBe(200)
    const body = await res.json()
    // 5 × 100 = 500 Bruttoumsatz, × 15% = 75 Verkaufsgebühr
    const vkRow = body.find((r: { kategorie: string }) => r.kategorie === 'verkaufsgebuehr')
    expect(vkRow).toBeDefined()
    expect(vkRow.wert).toBe(75)
  })

  it('uses marketing_planung manual pct when available', async () => {
    const now = new Date()
    const day = now.getUTCDay() || 7
    const monday = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() - (day - 1)))
    const thu = new Date(monday.getTime() + 3 * 86400000)
    const yearStart = new Date(Date.UTC(thu.getUTCFullYear(), 0, 1))
    const week = Math.ceil(((thu.getTime() - yearStart.getTime()) / 86400000 + 1) / 7)
    const year = thu.getUTCFullYear()

    mockFrom
      .mockReturnValueOnce(ch({ data: { planungshorizont_wochen: 1 }, error: null }))
      .mockReturnValueOnce(ch({ data: KAT_ROWS, error: null }))
    setupParallelMocks({
      0: ch({
        data: [
          { sku_id: null, produkt_id: 'prod-1', sales_plattform_id: 'platt-1', kw_year: year, kw_number: week, absatz_manuell: null, effektiver_vk_manuell: 200 },
          { sku_id: 'sku-1', produkt_id: 'prod-1', sales_plattform_id: 'platt-1', kw_year: year, kw_number: week, absatz_manuell: 2, effektiver_vk_manuell: null },
        ],
        error: null,
      }),
      5: ch({
        data: [{ produkt_id: 'prod-1', kategorie_id: 'mkt-sub-1', kw_year: year, kw_number: week, marketingkosten_pct_manuell: 10 }],
        error: null,
      }),
      6: ch({
        data: [{ kategorie_id: 'mkt-sub-1', produkt_id: 'prod-1', berechnungsart: 'mittelwert_30', gewichtung_erstes_drittel: null, gewichtung_zweites_drittel: null, gewichtung_drittes_drittel: null }],
        error: null,
      }),
      10: ch({ data: [{ kpi_kategorie_id: 'mkt-sub-1' }], error: null }), // auszahlungs_marketing_gruppen: mkt-sub-1 is inkludiert
    })
    const res = await GET()
    expect(res.status).toBe(200)
    const body = await res.json()
    // 2 × 200 = 400 Bruttoumsatz, × 10% = 40 Marketing
    const mktRow = body.find((r: { kategorie: string }) => r.kategorie === 'marketing')
    expect(mktRow).toBeDefined()
    expect(mktRow.wert).toBe(40)
  })

  it('returns 500 on database error', async () => {
    mockFrom
      .mockReturnValueOnce(NULL_DATA)
      .mockReturnValueOnce(ch({ data: null, error: { message: 'DB error' } }))
    const res = await GET()
    expect(res.status).toBe(500)
  })
})
