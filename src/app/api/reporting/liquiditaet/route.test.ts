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

function req(params: Record<string, string> = {}) {
  const qs = new URLSearchParams(params).toString()
  return new Request(`http://localhost/api/reporting/liquiditaet?${qs}`)
}

const KAT_EIN_ID = 'aaaaaaaa-0000-0000-0000-000000000001'
const KAT_AUS_ID = 'bbbbbbbb-0000-0000-0000-000000000001'

function chain(result: { data: unknown; error: unknown }) {
  const obj: Record<string, unknown> = {}
  const methods = [
    'select', 'eq', 'in', 'not', 'is', 'gte', 'lte', 'or',
    'order', 'limit', 'maybeSingle', 'single',
  ]
  for (const m of methods) obj[m] = () => obj
  ;(obj as { then: (fn: (r: unknown) => unknown) => unknown }).then =
    (fn: (r: unknown) => unknown) => Promise.resolve(result).then(fn)
  return obj
}

// 6 parallel calls in Promise.all:
// 1. kpi_categories (allEinnahmenCats, all levels)
// 2. kpi_categories (allAusgabenCats, all levels)
// 3. kpi_categories (plattformenCats)
// 4. kpi_categories (produkteCats, level=1)
// 5. einnahmen_transaktionen
// 6. ausgaben_kosten_transaktionen
function setupMocks({
  einnahmenKats = [{ id: KAT_EIN_ID, name: 'Shop Einnahmen', level: 1, parent_id: null, sort_order: 0, sales_plattform_enabled: false }],
  ausgabenKats  = [{ id: KAT_AUS_ID, name: 'Marketing', ausgaben_label: null as string | null, level: 1, parent_id: null, sort_order: 0, sales_plattform_enabled: false }],
  plattformenKats = [] as unknown[],
  produkteKats    = [] as unknown[],
  einnahmenRows = [] as unknown[],
  ausgabenRows  = [] as unknown[],
} = {}) {
  mockFrom
    .mockReturnValueOnce(chain({ data: einnahmenKats,  error: null }))
    .mockReturnValueOnce(chain({ data: ausgabenKats,   error: null }))
    .mockReturnValueOnce(chain({ data: plattformenKats, error: null }))
    .mockReturnValueOnce(chain({ data: produkteKats,   error: null }))
    .mockReturnValueOnce(chain({ data: einnahmenRows,  error: null }))
    .mockReturnValueOnce(chain({ data: ausgabenRows,   error: null }))
}

describe('GET /api/reporting/liquiditaet', () => {
  beforeEach(() => mockFrom.mockReset())

  // ── Auth ────────────────────────────────────────────────────────────────────

  it('returns 401 when unauthenticated', async () => {
    const { requireAuth } = await import('@/lib/supabase-server')
    vi.mocked(requireAuth).mockResolvedValueOnce({
      user: null,
      supabase: null as never,
      error: new Response(null, { status: 401 }),
    })
    const res = await GET(req({ von: '2025-01', bis: '2025-12' }))
    expect(res.status).toBe(401)
  })

  // ── Validierung ─────────────────────────────────────────────────────────────

  it('returns 400 when von is missing', async () => {
    const res = await GET(req({ bis: '2025-12' }))
    expect(res.status).toBe(400)
  })

  it('returns 400 when bis is missing', async () => {
    const res = await GET(req({ von: '2025-01' }))
    expect(res.status).toBe(400)
  })

  it('returns 400 when von has wrong format', async () => {
    const res = await GET(req({ von: '2025-1', bis: '2025-12' }))
    expect(res.status).toBe(400)
  })

  it('returns 400 when von > bis', async () => {
    const res = await GET(req({ von: '2025-12', bis: '2025-01' }))
    expect(res.status).toBe(400)
  })

  it('returns 400 when granularitaet is invalid', async () => {
    const res = await GET(req({ von: '2025-01', bis: '2025-03', granularitaet: 'woche' }))
    expect(res.status).toBe(400)
  })

  // ── Perioden ────────────────────────────────────────────────────────────────

  it('returns correct monatlich perioden', async () => {
    setupMocks()
    const res = await GET(req({ von: '2025-01', bis: '2025-03', granularitaet: 'monat' }))
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.perioden).toEqual(['2025-01', '2025-02', '2025-03'])
  })

  it('returns correct quartal perioden', async () => {
    setupMocks()
    const res = await GET(req({ von: '2025-01', bis: '2025-06', granularitaet: 'quartal' }))
    const body = await res.json()
    expect(body.perioden).toEqual(['2025-Q1', '2025-Q2'])
  })

  it('returns correct jahr perioden', async () => {
    setupMocks()
    const res = await GET(req({ von: '2024-06', bis: '2025-06', granularitaet: 'jahr' }))
    const body = await res.json()
    expect(body.perioden).toEqual(['2024', '2025'])
  })

  // ── Response-Struktur ────────────────────────────────────────────────────────

  it('returns valid response structure', async () => {
    setupMocks()
    const res = await GET(req({ von: '2025-01', bis: '2025-01' }))
    const body = await res.json()
    expect(Array.isArray(body.einnahmen_kategorien)).toBe(true)
    expect(Array.isArray(body.ausgaben_kategorien)).toBe(true)
    expect(typeof body.gesamt_einnahmen).toBe('object')
    expect(typeof body.gesamt_ausgaben).toBe('object')
    expect(typeof body.cashflow).toBe('object')
    expect(typeof body.kontostand).toBe('object')
    // Kategorie-Einträge haben jetzt gruppen und sales_plattformen
    expect(Array.isArray(body.einnahmen_kategorien[0].gruppen)).toBe(true)
    expect(Array.isArray(body.einnahmen_kategorien[0].sales_plattformen)).toBe(true)
    expect(Array.isArray(body.ausgaben_kategorien[0].gruppen)).toBe(true)
    expect(Array.isArray(body.ausgaben_kategorien[0].sales_plattformen)).toBe(true)
  })

  // ── Wertberechnung ───────────────────────────────────────────────────────────

  it('aggregates einnahmen betrag positively by category', async () => {
    setupMocks({
      einnahmenRows: [
        { zahlungsdatum: '2025-01-15', betrag: 5000, kategorie_id: KAT_EIN_ID },
        { zahlungsdatum: '2025-01-20', betrag: 2000, kategorie_id: KAT_EIN_ID },
      ],
    })
    const res = await GET(req({ von: '2025-01', bis: '2025-01' }))
    const body = await res.json()
    expect(body.einnahmen_kategorien[0].values['2025-01']).toBe(7000)
    expect(body.gesamt_einnahmen['2025-01']).toBe(7000)
  })

  it('aggregates ausgaben as negated betrag_brutto', async () => {
    setupMocks({
      ausgabenRows: [
        { zahlungsdatum: '2025-01-10', betrag_brutto: 3000, kategorie_id: KAT_AUS_ID },
        { zahlungsdatum: '2025-01-25', betrag_brutto: 1000, kategorie_id: KAT_AUS_ID },
      ],
    })
    const res = await GET(req({ von: '2025-01', bis: '2025-01' }))
    const body = await res.json()
    expect(body.ausgaben_kategorien[0].values['2025-01']).toBe(-4000)
    expect(body.gesamt_ausgaben['2025-01']).toBe(-4000)
  })

  it('computes cashflow = einnahmen + ausgaben (ausgaben already negated)', async () => {
    setupMocks({
      einnahmenRows: [{ zahlungsdatum: '2025-01-15', betrag: 7000, kategorie_id: KAT_EIN_ID }],
      ausgabenRows:  [{ zahlungsdatum: '2025-01-10', betrag_brutto: 4000, kategorie_id: KAT_AUS_ID }],
    })
    const res = await GET(req({ von: '2025-01', bis: '2025-01' }))
    const body = await res.json()
    expect(body.cashflow['2025-01']).toBe(3000)
  })

  it('computes kontostand as cumulative cashflow across periods', async () => {
    setupMocks({
      einnahmenRows: [
        { zahlungsdatum: '2025-01-10', betrag: 7000, kategorie_id: KAT_EIN_ID },
        { zahlungsdatum: '2025-02-10', betrag: 5000, kategorie_id: KAT_EIN_ID },
      ],
      ausgabenRows: [
        { zahlungsdatum: '2025-01-15', betrag_brutto: 4000, kategorie_id: KAT_AUS_ID },
        { zahlungsdatum: '2025-02-15', betrag_brutto: 2000, kategorie_id: KAT_AUS_ID },
      ],
    })
    const res = await GET(req({ von: '2025-01', bis: '2025-02' }))
    const body = await res.json()
    expect(body.cashflow['2025-01']).toBe(3000)    // 7000 - 4000
    expect(body.cashflow['2025-02']).toBe(3000)    // 5000 - 2000
    expect(body.kontostand['2025-01']).toBe(3000)  // 0 + 3000
    expect(body.kontostand['2025-02']).toBe(6000)  // 3000 + 3000
  })

  it('shows zero values for categories without transactions in a period', async () => {
    setupMocks()
    const res = await GET(req({ von: '2025-01', bis: '2025-01' }))
    const body = await res.json()
    expect(body.einnahmen_kategorien[0].values['2025-01']).toBe(0)
    expect(body.ausgaben_kategorien[0].values['2025-01']).toBe(0)
    expect(body.cashflow['2025-01']).toBe(0)
    expect(body.kontostand['2025-01']).toBe(0)
  })

  it('aggregates multiple months into a quartal correctly', async () => {
    setupMocks({
      einnahmenRows: [
        { zahlungsdatum: '2025-01-15', betrag: 3000, kategorie_id: KAT_EIN_ID },
        { zahlungsdatum: '2025-03-10', betrag: 4000, kategorie_id: KAT_EIN_ID },
      ],
    })
    const res = await GET(req({ von: '2025-01', bis: '2025-03', granularitaet: 'quartal' }))
    const body = await res.json()
    expect(body.perioden).toEqual(['2025-Q1'])
    expect(body.einnahmen_kategorien[0].values['2025-Q1']).toBe(7000)
    expect(body.gesamt_einnahmen['2025-Q1']).toBe(7000)
  })

  it('returns empty categories when no KPI categories configured', async () => {
    setupMocks({ einnahmenKats: [], ausgabenKats: [] })
    const res = await GET(req({ von: '2025-01', bis: '2025-01' }))
    const body = await res.json()
    expect(body.einnahmen_kategorien).toEqual([])
    expect(body.ausgaben_kategorien).toEqual([])
    expect(body.cashflow['2025-01']).toBe(0)
    expect(body.kontostand['2025-01']).toBe(0)
  })

  it('skips transactions without kategorie_id or zahlungsdatum', async () => {
    setupMocks({
      einnahmenRows: [
        { zahlungsdatum: '2025-01-10', betrag: 1000, kategorie_id: null },
        { zahlungsdatum: null,         betrag: 2000, kategorie_id: KAT_EIN_ID },
        { zahlungsdatum: '2025-01-15', betrag: 500,  kategorie_id: KAT_EIN_ID },
      ],
    })
    const res = await GET(req({ von: '2025-01', bis: '2025-01' }))
    const body = await res.json()
    expect(body.einnahmen_kategorien[0].values['2025-01']).toBe(500)
  })

  it('includes kpi_type in each category', async () => {
    setupMocks()
    const res = await GET(req({ von: '2025-01', bis: '2025-01' }))
    const body = await res.json()
    expect(body.einnahmen_kategorien[0].kpi_type).toBe('einnahmen')
    expect(body.ausgaben_kategorien[0].kpi_type).toBe('ausgaben_kosten')
  })

  it('uses ausgaben_label when set for ausgaben categories', async () => {
    setupMocks({
      ausgabenKats: [{ id: KAT_AUS_ID, name: 'Marketing', ausgaben_label: 'Marketingkosten', level: 1, parent_id: null, sort_order: 0, sales_plattform_enabled: false }],
    })
    const res = await GET(req({ von: '2025-01', bis: '2025-01' }))
    const body = await res.json()
    expect(body.ausgaben_kategorien[0].name).toBe('Marketingkosten')
  })

  it('falls back to name when ausgaben_label is null', async () => {
    setupMocks()
    const res = await GET(req({ von: '2025-01', bis: '2025-01' }))
    const body = await res.json()
    expect(body.ausgaben_kategorien[0].name).toBe('Marketing')
  })
})
