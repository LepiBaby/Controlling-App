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

// category rows that simulate a real kpi_categories setup
const KAT_ROWS = [
  { id: 'brutto-1', name: 'Bruttoumsatz', parent_id: null, type: 'umsatz', ist_abzugsposten: false, level: 1 },
  { id: 'rueck-1', name: 'Rückerstattungen', parent_id: null, type: 'umsatz', ist_abzugsposten: true, level: 1 },
  { id: 'rabatt-1', name: 'Rabatte', parent_id: null, type: 'umsatz', ist_abzugsposten: true, level: 1 },
  { id: 'vertrieb-1', name: 'Vertrieb', parent_id: null, type: 'ausgaben_kosten', ist_abzugsposten: false, level: 1 },
  { id: 'vkgeb-1', name: 'Verkaufsgebühren', parent_id: 'vertrieb-1', type: 'ausgaben_kosten', ist_abzugsposten: false, level: 2 },
  { id: 'retouren-1', name: 'Retouren', parent_id: 'vertrieb-1', type: 'ausgaben_kosten', ist_abzugsposten: false, level: 2 },
  { id: 'mkt-1', name: 'Marketing', parent_id: null, type: 'ausgaben_kosten', ist_abzugsposten: false, level: 1 },
]

describe('GET /api/sales-plattform-planung/historisch', () => {
  it('returns 401 when unauthenticated', async () => {
    const { requireAuth } = await import('@/lib/supabase-server')
    vi.mocked(requireAuth).mockResolvedValueOnce({
      user: null, supabase: null as never,
      error: new Response('Unauthorized', { status: 401 }),
    })
    const res = await GET()
    expect(res.status).toBe(401)
  })

  it('returns empty array when no transactions exist', async () => {
    mockFrom
      .mockReturnValueOnce(ch({ data: { vergangenheitshorizont_wochen: 4 }, error: null })) // grundeinstellungen
      .mockReturnValueOnce(ch({ data: KAT_ROWS, error: null })) // kpi_categories
      .mockReturnValueOnce(EMPTY) // umsatz_transaktionen
      .mockReturnValueOnce(EMPTY) // ausgaben_kosten_transaktionen
    const res = await GET()
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(Array.isArray(body)).toBe(true)
    expect(body).toHaveLength(0)
  })

  it('aggregates bruttoumsatz transactions by ISO week', async () => {
    // Use a date that is clearly in the past (but within 4-week horizon)
    // We need a leistungsdatum that falls in a specific ISO week
    // KW 1 of 2025 started on 2024-12-30
    const testDate = '2025-01-06' // KW 2, 2025

    mockFrom
      .mockReturnValueOnce(ch({ data: { vergangenheitshorizont_wochen: 52 }, error: null }))
      .mockReturnValueOnce(ch({ data: KAT_ROWS, error: null }))
      .mockReturnValueOnce(ch({
        data: [
          { produkt_id: 'prod-1', sales_plattform_id: 'platt-1', leistungsdatum: testDate, betrag: 1000, kategorie_id: 'brutto-1' },
          { produkt_id: 'prod-1', sales_plattform_id: 'platt-1', leistungsdatum: testDate, betrag: 500, kategorie_id: 'brutto-1' },
        ],
        error: null,
      }))
      .mockReturnValueOnce(EMPTY)
    const res = await GET()
    expect(res.status).toBe(200)
    const body = await res.json()
    const bruRow = body.find((r: { kategorie: string }) => r.kategorie === 'bruttoumsatz')
    expect(bruRow).toBeDefined()
    expect(bruRow.wert).toBe(1500)
    expect(bruRow.kw_year).toBe(2025)
    expect(bruRow.kw_number).toBe(2)
  })

  it('separates rueckerstattungen from bruttoumsatz', async () => {
    const testDate = '2025-01-06' // KW 2, 2025
    mockFrom
      .mockReturnValueOnce(ch({ data: { vergangenheitshorizont_wochen: 52 }, error: null }))
      .mockReturnValueOnce(ch({ data: KAT_ROWS, error: null }))
      .mockReturnValueOnce(ch({
        data: [
          { produkt_id: 'prod-1', sales_plattform_id: 'platt-1', leistungsdatum: testDate, betrag: 2000, kategorie_id: 'brutto-1' },
          { produkt_id: 'prod-1', sales_plattform_id: 'platt-1', leistungsdatum: testDate, betrag: 200, kategorie_id: 'rueck-1' },
        ],
        error: null,
      }))
      .mockReturnValueOnce(EMPTY)
    const res = await GET()
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.find((r: { kategorie: string }) => r.kategorie === 'bruttoumsatz')?.wert).toBe(2000)
    expect(body.find((r: { kategorie: string }) => r.kategorie === 'rueckerstattungen')?.wert).toBe(200)
  })

  it('aggregates ausgaben by category bucket', async () => {
    const testDate = '2025-01-06'
    mockFrom
      .mockReturnValueOnce(ch({ data: { vergangenheitshorizont_wochen: 52 }, error: null }))
      .mockReturnValueOnce(ch({ data: KAT_ROWS, error: null }))
      .mockReturnValueOnce(EMPTY) // umsatz
      .mockReturnValueOnce(ch({
        data: [
          { produkt_id: 'prod-1', sales_plattform_id: 'platt-1', leistungsdatum: testDate, betrag_netto: 100, kategorie_id: 'vkgeb-1' },
          { produkt_id: 'prod-1', sales_plattform_id: 'platt-1', leistungsdatum: testDate, betrag_netto: 50, kategorie_id: 'mkt-1' },
        ],
        error: null,
      }))
    const res = await GET()
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.find((r: { kategorie: string }) => r.kategorie === 'verkaufsgebuehr')?.wert).toBe(100)
    expect(body.find((r: { kategorie: string }) => r.kategorie === 'marketing')?.wert).toBe(50)
  })
})
