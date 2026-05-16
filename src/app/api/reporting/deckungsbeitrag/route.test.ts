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
  return new Request(`http://localhost/api/reporting/deckungsbeitrag?${qs}`)
}

// ─── UUID-Fixtures ────────────────────────────────────────────────────────────

const POS_ID        = 'aaaaaaaa-0000-0000-0000-000000000001'
const SUMME_ID      = 'aaaaaaaa-0000-0000-0000-000000000002'
const KAT_UMSATZ_ID = 'bbbbbbbb-0000-0000-0000-000000000001'
const KAT_KOSTEN_ID = 'bbbbbbbb-0000-0000-0000-000000000002'
const PRODUKT_ID    = 'eeeeeeee-0000-0000-0000-000000000001'
const PLT_AMAZON_ID = 'ffffffff-0000-0000-0000-000000000001'
const PLT_EBAY_ID   = 'ffffffff-0000-0000-0000-000000000002'

// ─── Mock-Builder ─────────────────────────────────────────────────────────────

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

/**
 * Setzt 11 (oder 12) aufeinanderfolgende mockReturnValueOnce-Aufrufe:
 *  1.  report_positionen (nur in_deckungsbeitragsreport=true)
 *  2.  report_position_kategorien
 *  3.  report_summe_positionen
 *  4.  kpi_categories (umsatz + ausgaben_kosten)
 *  5.  kpi_categories (sales_plattformen)
 *  6.  kpi_categories (produkte level 1)
 *  7.  umsatz_transaktionen (mit opt. Produkt/Plattform-Filter)
 *  8.  ausgaben_kosten_transaktionen (direkt, mit opt. Filter)
 *  9.  ausgaben_kosten_transaktionen (abschreibung)
 *  10. bestand_transaktionen (mit opt. Produkt-Filter)
 *  11. produktkosten_zeitraeume (mit opt. Produkt-Filter)
 *  12. ausgaben_kosten_transaktionen (Produktinvestitionen) — nur wenn piRows gesetzt
 */
function setupMocks(opts: {
  positions?:     unknown[]
  rpKategorien?:  unknown[]
  rpSummen?:      unknown[]
  kpiCats?:       unknown[]
  plattformen?:   unknown[]
  produkte?:      unknown[]
  umsatz?:        unknown[]
  ausgaben?:      unknown[]
  abschreibung?:  unknown[]
  bestandTran?:   unknown[]
  produktkosten?: unknown[]
  piRows?:        unknown[]
}) {
  mockFrom
    .mockReturnValueOnce(chain({ data: opts.positions     ?? [], error: null }))
    .mockReturnValueOnce(chain({ data: opts.rpKategorien  ?? [], error: null }))
    .mockReturnValueOnce(chain({ data: opts.rpSummen      ?? [], error: null }))
    .mockReturnValueOnce(chain({ data: opts.kpiCats       ?? [], error: null }))
    .mockReturnValueOnce(chain({ data: opts.plattformen   ?? [], error: null }))
    .mockReturnValueOnce(chain({ data: opts.produkte      ?? [], error: null }))
    .mockReturnValueOnce(chain({ data: opts.umsatz        ?? [], error: null }))
    .mockReturnValueOnce(chain({ data: opts.ausgaben      ?? [], error: null }))
    .mockReturnValueOnce(chain({ data: opts.abschreibung  ?? [], error: null }))
    .mockReturnValueOnce(chain({ data: opts.bestandTran   ?? [], error: null }))
    .mockReturnValueOnce(chain({ data: opts.produktkosten ?? [], error: null }))
  if (opts.piRows !== undefined) {
    mockFrom.mockReturnValueOnce(chain({ data: opts.piRows, error: null }))
  }
}

beforeEach(() => {
  vi.clearAllMocks()
  mockFrom.mockReset()
})

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('GET /api/reporting/deckungsbeitrag', () => {

  // ── Authentifizierung ───────────────────────────────────────────────────────

  it('returns 401 when unauthenticated', async () => {
    const { requireAuth } = await import('@/lib/supabase-server')
    vi.mocked(requireAuth).mockResolvedValueOnce({
      user: null, supabase: null as never,
      error: new Response('Unauthorized', { status: 401 }),
    })
    const res = await GET(req({ von: '2026-01', bis: '2026-12' }))
    expect(res.status).toBe(401)
  })

  // ── Parameter-Validierung ───────────────────────────────────────────────────

  it('returns 400 when von is missing', async () => {
    const res = await GET(req({ bis: '2026-12' }))
    expect(res.status).toBe(400)
  })

  it('returns 400 when bis is missing', async () => {
    const res = await GET(req({ von: '2026-01' }))
    expect(res.status).toBe(400)
  })

  it('returns 400 when von has wrong format', async () => {
    const res = await GET(req({ von: '2026-01-01', bis: '2026-12' }))
    expect(res.status).toBe(400)
  })

  it('returns 400 when von > bis', async () => {
    const res = await GET(req({ von: '2026-06', bis: '2026-01' }))
    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error).toMatch(/von.*bis/i)
  })

  it('returns 400 when granularitaet is invalid', async () => {
    const res = await GET(req({ von: '2026-01', bis: '2026-12', granularitaet: 'woche' }))
    expect(res.status).toBe(400)
  })

  // ── Leerzustand ─────────────────────────────────────────────────────────────

  it('returns 200 with empty positionen when no positions marked for deckungsbeitragsreport', async () => {
    mockFrom.mockReturnValueOnce(chain({ data: [], error: null }))

    const res = await GET(req({ von: '2026-01', bis: '2026-03' }))
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.positionen).toEqual([])
    expect(body.perioden).toHaveLength(3)
  })

  // ── Perioden-Generierung ────────────────────────────────────────────────────

  it('generates correct monthly periods', async () => {
    mockFrom.mockReturnValueOnce(chain({ data: [], error: null }))
    const res = await GET(req({ von: '2026-01', bis: '2026-03', granularitaet: 'monat' }))
    const body = await res.json()
    expect(body.perioden).toEqual(['2026-01', '2026-02', '2026-03'])
  })

  it('generates correct quarterly periods', async () => {
    mockFrom.mockReturnValueOnce(chain({ data: [], error: null }))
    const res = await GET(req({ von: '2026-01', bis: '2026-12', granularitaet: 'quartal' }))
    const body = await res.json()
    expect(body.perioden).toEqual(['2026-Q1', '2026-Q2', '2026-Q3', '2026-Q4'])
  })

  // ── Grundberechnung: Position mit Umsatz ───────────────────────────────────

  it('calculates umsatz position values correctly', async () => {
    setupMocks({
      positions: [{ id: POS_ID, name: 'Umsatz', type: 'position', sort_order: 0, investitionsbezogen: false }],
      rpKategorien: [{ report_position_id: POS_ID, kpi_category_id: KAT_UMSATZ_ID }],
      kpiCats: [{ id: KAT_UMSATZ_ID, name: 'Erlöse', type: 'umsatz', level: 1, parent_id: null, sort_order: 0, sales_plattform_enabled: false, produkt_enabled: false, ist_abzugsposten: false }],
      umsatz: [
        { leistungsdatum: '2026-01-15', betrag: '1000.00', kategorie_id: KAT_UMSATZ_ID, gruppe_id: null, untergruppe_id: null, sales_plattform_id: null, produkt_id: null },
        { leistungsdatum: '2026-02-10', betrag: '2000.00', kategorie_id: KAT_UMSATZ_ID, gruppe_id: null, untergruppe_id: null, sales_plattform_id: null, produkt_id: null },
      ],
    })

    const res = await GET(req({ von: '2026-01', bis: '2026-03', granularitaet: 'monat' }))
    expect(res.status).toBe(200)
    const body = await res.json()
    const pos = body.positionen.find((p: { id: string }) => p.id === POS_ID)
    expect(pos).toBeDefined()
    expect(pos.values['2026-01']).toBe(1000)
    expect(pos.values['2026-02']).toBe(2000)
    expect(pos.values['2026-03']).toBe(0)
  })

  // ── Summen-Position ─────────────────────────────────────────────────────────

  it('sums referenced positions correctly', async () => {
    setupMocks({
      positions: [
        { id: POS_ID,   name: 'DB1', type: 'position', sort_order: 0, investitionsbezogen: false },
        { id: SUMME_ID, name: 'DB1 Gesamt', type: 'summe', sort_order: 1, investitionsbezogen: false },
      ],
      rpKategorien: [{ report_position_id: POS_ID, kpi_category_id: KAT_UMSATZ_ID }],
      rpSummen: [{ report_position_id: SUMME_ID, referenced_position_id: POS_ID }],
      kpiCats: [{ id: KAT_UMSATZ_ID, name: 'Erlöse', type: 'umsatz', level: 1, parent_id: null, sort_order: 0, sales_plattform_enabled: false, produkt_enabled: false, ist_abzugsposten: false }],
      umsatz: [
        { leistungsdatum: '2026-01-01', betrag: '500.00', kategorie_id: KAT_UMSATZ_ID, gruppe_id: null, untergruppe_id: null, sales_plattform_id: null, produkt_id: null },
      ],
    })

    const res = await GET(req({ von: '2026-01', bis: '2026-01', granularitaet: 'monat' }))
    const body = await res.json()
    const summe = body.positionen.find((p: { id: string }) => p.id === SUMME_ID)
    expect(summe.values['2026-01']).toBe(500)
  })

  // ── Produkt-Filter ──────────────────────────────────────────────────────────

  it('passes produkt_ids to query (no error, returns filtered data)', async () => {
    setupMocks({
      positions: [{ id: POS_ID, name: 'Umsatz', type: 'position', sort_order: 0, investitionsbezogen: false }],
      rpKategorien: [{ report_position_id: POS_ID, kpi_category_id: KAT_UMSATZ_ID }],
      kpiCats: [{ id: KAT_UMSATZ_ID, name: 'Erlöse', type: 'umsatz', level: 1, parent_id: null, sort_order: 0, sales_plattform_enabled: false, produkt_enabled: false, ist_abzugsposten: false }],
      umsatz: [
        { leistungsdatum: '2026-01-10', betrag: '300.00', kategorie_id: KAT_UMSATZ_ID, gruppe_id: null, untergruppe_id: null, sales_plattform_id: PLT_AMAZON_ID, produkt_id: PRODUKT_ID },
      ],
    })

    const res = await GET(req({ von: '2026-01', bis: '2026-01', granularitaet: 'monat', produkt_ids: PRODUKT_ID }))
    expect(res.status).toBe(200)
    const body = await res.json()
    const pos = body.positionen.find((p: { id: string }) => p.id === POS_ID)
    expect(pos.values['2026-01']).toBe(300)
  })

  // ── Plattform-Filter ────────────────────────────────────────────────────────

  it('passes plattform_ids to query (no error, returns filtered data)', async () => {
    setupMocks({
      positions: [{ id: POS_ID, name: 'Umsatz', type: 'position', sort_order: 0, investitionsbezogen: false }],
      rpKategorien: [{ report_position_id: POS_ID, kpi_category_id: KAT_UMSATZ_ID }],
      kpiCats: [{ id: KAT_UMSATZ_ID, name: 'Erlöse', type: 'umsatz', level: 1, parent_id: null, sort_order: 0, sales_plattform_enabled: false, produkt_enabled: false, ist_abzugsposten: false }],
      umsatz: [
        { leistungsdatum: '2026-01-10', betrag: '800.00', kategorie_id: KAT_UMSATZ_ID, gruppe_id: null, untergruppe_id: null, sales_plattform_id: PLT_AMAZON_ID, produkt_id: null },
      ],
    })

    const res = await GET(req({ von: '2026-01', bis: '2026-01', granularitaet: 'monat', plattform_ids: PLT_AMAZON_ID }))
    expect(res.status).toBe(200)
    const body = await res.json()
    const pos = body.positionen.find((p: { id: string }) => p.id === POS_ID)
    expect(pos.values['2026-01']).toBe(800)
  })

  // ── Kombinierter Filter ─────────────────────────────────────────────────────

  it('accepts both produkt_ids and plattform_ids simultaneously', async () => {
    setupMocks({
      positions: [{ id: POS_ID, name: 'Umsatz', type: 'position', sort_order: 0, investitionsbezogen: false }],
      rpKategorien: [{ report_position_id: POS_ID, kpi_category_id: KAT_UMSATZ_ID }],
      kpiCats: [{ id: KAT_UMSATZ_ID, name: 'Erlöse', type: 'umsatz', level: 1, parent_id: null, sort_order: 0, sales_plattform_enabled: false, produkt_enabled: false, ist_abzugsposten: false }],
      umsatz: [
        { leistungsdatum: '2026-01-05', betrag: '600.00', kategorie_id: KAT_UMSATZ_ID, gruppe_id: null, untergruppe_id: null, sales_plattform_id: PLT_AMAZON_ID, produkt_id: PRODUKT_ID },
      ],
    })

    const res = await GET(req({
      von: '2026-01', bis: '2026-01', granularitaet: 'monat',
      produkt_ids: PRODUKT_ID,
      plattform_ids: `${PLT_AMAZON_ID},${PLT_EBAY_ID}`,
    }))
    expect(res.status).toBe(200)
    const body = await res.json()
    const pos = body.positionen.find((p: { id: string }) => p.id === POS_ID)
    expect(pos.values['2026-01']).toBe(600)
  })

  // ── Kosten-Position ─────────────────────────────────────────────────────────

  it('subtracts ausgaben from position values', async () => {
    setupMocks({
      positions: [{ id: POS_ID, name: 'DB1', type: 'position', sort_order: 0, investitionsbezogen: false }],
      rpKategorien: [{ report_position_id: POS_ID, kpi_category_id: KAT_KOSTEN_ID }],
      kpiCats: [{ id: KAT_KOSTEN_ID, name: 'Warenkosten', type: 'ausgaben_kosten', level: 1, parent_id: null, sort_order: 0, sales_plattform_enabled: false, produkt_enabled: false, ist_abzugsposten: false }],
      ausgaben: [
        { leistungsdatum: '2026-01-20', betrag_netto: '400.00', kategorie_id: KAT_KOSTEN_ID, gruppe_id: null, untergruppe_id: null, sales_plattform_id: null, produkt_id: null },
      ],
    })

    const res = await GET(req({ von: '2026-01', bis: '2026-01' }))
    const body = await res.json()
    const pos = body.positionen.find((p: { id: string }) => p.id === POS_ID)
    expect(pos.values['2026-01']).toBe(-400)
  })

  // ── Response enthält investitionsbezogen ────────────────────────────────────

  it('returns investitionsbezogen field per position', async () => {
    setupMocks({
      positions: [{ id: POS_ID, name: 'Umsatz', type: 'position', sort_order: 0, investitionsbezogen: true }],
      rpKategorien: [{ report_position_id: POS_ID, kpi_category_id: KAT_UMSATZ_ID }],
      kpiCats: [{ id: KAT_UMSATZ_ID, name: 'Erlöse', type: 'umsatz', level: 1, parent_id: null, sort_order: 0, sales_plattform_enabled: false, produkt_enabled: false, ist_abzugsposten: false }],
    })

    const res = await GET(req({ von: '2026-01', bis: '2026-01' }))
    const body = await res.json()
    const pos = body.positionen.find((p: { id: string }) => p.id === POS_ID)
    expect(pos.investitionsbezogen).toBe(true)
  })
})
