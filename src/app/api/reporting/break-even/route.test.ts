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
  return new Request(`http://localhost/api/reporting/break-even?${qs}`)
}

// ─── UUID-Fixtures ────────────────────────────────────────────────────────────

const POS_ID        = 'aaaaaaaa-0000-0000-0000-000000000001'
const SUMME_ID      = 'aaaaaaaa-0000-0000-0000-000000000002'
const KAT_UMSATZ_ID = 'bbbbbbbb-0000-0000-0000-000000000001'
const KAT_KOSTEN_ID = 'bbbbbbbb-0000-0000-0000-000000000002'
const KAT_PI_ID     = 'cccccccc-0000-0000-0000-000000000001'
const PRODUKT_ID    = 'eeeeeeee-0000-0000-0000-000000000001'

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
 * 8 aufeinanderfolgende mockReturnValueOnce-Aufrufe + optionaler 9. für PI-Raten:
 *  1. report_positionen (nur in_break_even_report=true)
 *  2. report_position_kategorien
 *  3. report_summe_positionen
 *  4. kpi_categories (umsatz + ausgaben_kosten)
 *  5. kpi_categories (sales_plattformen)
 *  6. kpi_categories (produkte level 1)
 *  7. umsatz_transaktionen (nach produkt_id gefiltert)
 *  8. ausgaben_kosten_transaktionen (direkt, nach produkt_id gefiltert)
 *  9. ausgaben_kosten_transaktionen (PI-Raten) — nur wenn kpiCats 'produktinvestitionen' enthält
 */
function setupMocks(opts: {
  positions?:    unknown[]
  rpKategorien?: unknown[]
  rpSummen?:     unknown[]
  kpiCats?:      unknown[]
  plattformen?:  unknown[]
  produkte?:     unknown[]
  umsatz?:       unknown[]
  ausgaben?:     unknown[]
  piRows?:       unknown[]
}) {
  const mock = mockFrom
    .mockReturnValueOnce(chain({ data: opts.positions    ?? [], error: null }))
    .mockReturnValueOnce(chain({ data: opts.rpKategorien ?? [], error: null }))
    .mockReturnValueOnce(chain({ data: opts.rpSummen     ?? [], error: null }))
    .mockReturnValueOnce(chain({ data: opts.kpiCats      ?? [], error: null }))
    .mockReturnValueOnce(chain({ data: opts.plattformen  ?? [], error: null }))
    .mockReturnValueOnce(chain({ data: opts.produkte     ?? [], error: null }))
    .mockReturnValueOnce(chain({ data: opts.umsatz       ?? [], error: null }))
    .mockReturnValueOnce(chain({ data: opts.ausgaben     ?? [], error: null }))
  if (opts.piRows !== undefined) {
    mock.mockReturnValueOnce(chain({ data: opts.piRows, error: null }))
  }
}

beforeEach(() => {
  vi.clearAllMocks()
  mockFrom.mockReset()
})

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('GET /api/reporting/break-even', () => {

  // ── Authentifizierung ───────────────────────────────────────────────────────

  it('returns 401 when unauthenticated', async () => {
    const { requireAuth } = await import('@/lib/supabase-server')
    vi.mocked(requireAuth).mockResolvedValueOnce({
      user: null, supabase: null as never,
      error: new Response('Unauthorized', { status: 401 }),
    })
    const res = await GET(req({ produkt_ids: PRODUKT_ID }))
    expect(res.status).toBe(401)
  })

  // ── Parameter-Validierung ───────────────────────────────────────────────────

  it('returns 400 when produkt_ids is missing', async () => {
    const res = await GET(req({}))
    expect(res.status).toBe(400)
  })

  it('returns 400 when granularitaet is invalid', async () => {
    const res = await GET(req({ produkt_ids: PRODUKT_ID, granularitaet: 'woche' }))
    expect(res.status).toBe(400)
  })

  // ── Leerzustand ─────────────────────────────────────────────────────────────

  it('returns empty positionen when no positions marked for break-even-report', async () => {
    mockFrom.mockReturnValueOnce(chain({ data: [], error: null }))
    const res = await GET(req({ produkt_ids: PRODUKT_ID }))
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.positionen).toEqual([])
    expect(body.perioden).toEqual([])
  })

  it('returns empty perioden when no transactions exist for selected products', async () => {
    setupMocks({
      positions: [{ id: POS_ID, name: 'Umsatz', type: 'position', sort_order: 0, investitionsbezogen: false }],
      rpKategorien: [{ report_position_id: POS_ID, kpi_category_id: KAT_UMSATZ_ID }],
      kpiCats: [{ id: KAT_UMSATZ_ID, name: 'Erlöse', type: 'umsatz', level: 1, parent_id: null, sort_order: 0, sales_plattform_enabled: false, ist_abzugsposten: false }],
      umsatz: [],
      ausgaben: [],
    })
    const res = await GET(req({ produkt_ids: PRODUKT_ID }))
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.perioden).toEqual([])
    expect(body.positionen).toEqual([])
  })

  // ── Auto-Zeitraum ───────────────────────────────────────────────────────────

  it('auto-detects time range from transaction dates', async () => {
    setupMocks({
      positions: [{ id: POS_ID, name: 'Umsatz', type: 'position', sort_order: 0, investitionsbezogen: false }],
      rpKategorien: [{ report_position_id: POS_ID, kpi_category_id: KAT_UMSATZ_ID }],
      kpiCats: [{ id: KAT_UMSATZ_ID, name: 'Erlöse', type: 'umsatz', level: 1, parent_id: null, sort_order: 0, sales_plattform_enabled: false, ist_abzugsposten: false }],
      umsatz: [
        { leistungsdatum: '2026-03-01', betrag: '100', kategorie_id: KAT_UMSATZ_ID, gruppe_id: null, untergruppe_id: null, sales_plattform_id: null, produkt_id: PRODUKT_ID },
        { leistungsdatum: '2026-05-15', betrag: '200', kategorie_id: KAT_UMSATZ_ID, gruppe_id: null, untergruppe_id: null, sales_plattform_id: null, produkt_id: PRODUKT_ID },
      ],
    })
    const res = await GET(req({ produkt_ids: PRODUKT_ID, granularitaet: 'monat' }))
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.perioden).toEqual(['2026-03', '2026-04', '2026-05'])
  })

  it('uses earliest date across both umsatz and ausgaben for von', async () => {
    setupMocks({
      positions: [{ id: POS_ID, name: 'Kosten', type: 'position', sort_order: 0, investitionsbezogen: false }],
      rpKategorien: [{ report_position_id: POS_ID, kpi_category_id: KAT_KOSTEN_ID }],
      kpiCats: [{ id: KAT_KOSTEN_ID, name: 'Kosten', type: 'ausgaben_kosten', level: 1, parent_id: null, sort_order: 0, sales_plattform_enabled: false, ist_abzugsposten: false }],
      umsatz: [
        { leistungsdatum: '2026-06-01', betrag: '500', kategorie_id: KAT_UMSATZ_ID, gruppe_id: null, untergruppe_id: null, sales_plattform_id: null, produkt_id: PRODUKT_ID },
      ],
      ausgaben: [
        { leistungsdatum: '2026-02-01', betrag_netto: '100', kategorie_id: KAT_KOSTEN_ID, gruppe_id: null, untergruppe_id: null, sales_plattform_id: null, produkt_id: PRODUKT_ID },
      ],
    })
    const res = await GET(req({ produkt_ids: PRODUKT_ID, granularitaet: 'quartal' }))
    const body = await res.json()
    expect(body.perioden[0]).toBe('2026-Q1')
    expect(body.perioden[body.perioden.length - 1]).toBe('2026-Q2')
  })

  // ── Rohe Periodenwerte (nicht kumuliert) ────────────────────────────────────

  it('shows raw per-period values for regular positions (not cumulated)', async () => {
    setupMocks({
      positions: [{ id: POS_ID, name: 'Umsatz', type: 'position', sort_order: 0, investitionsbezogen: false }],
      rpKategorien: [{ report_position_id: POS_ID, kpi_category_id: KAT_UMSATZ_ID }],
      kpiCats: [{ id: KAT_UMSATZ_ID, name: 'Erlöse', type: 'umsatz', level: 1, parent_id: null, sort_order: 0, sales_plattform_enabled: false, ist_abzugsposten: false }],
      umsatz: [
        { leistungsdatum: '2026-01-15', betrag: '200', kategorie_id: KAT_UMSATZ_ID, gruppe_id: null, untergruppe_id: null, sales_plattform_id: null, produkt_id: PRODUKT_ID },
        { leistungsdatum: '2026-02-10', betrag: '300', kategorie_id: KAT_UMSATZ_ID, gruppe_id: null, untergruppe_id: null, sales_plattform_id: null, produkt_id: PRODUKT_ID },
      ],
    })
    const res = await GET(req({ produkt_ids: PRODUKT_ID, granularitaet: 'monat' }))
    const body = await res.json()
    const pos = body.positionen.find((p: { id: string }) => p.id === POS_ID)
    // Raw values — NOT cumulated
    expect(pos.values['2026-01']).toBe(200)
    expect(pos.values['2026-02']).toBe(300)
  })

  // ── Kumuliertes Ergebnis: virtuelle Zeile ───────────────────────────────────

  it('appends a "Kumuliertes Ergebnis" virtual position after the last summe', async () => {
    setupMocks({
      positions: [
        { id: POS_ID,   name: 'Umsatz',   type: 'position', sort_order: 0, investitionsbezogen: false },
        { id: SUMME_ID, name: 'Ergebnis', type: 'summe',    sort_order: 1, investitionsbezogen: false },
      ],
      rpKategorien: [{ report_position_id: POS_ID, kpi_category_id: KAT_UMSATZ_ID }],
      rpSummen: [{ report_position_id: SUMME_ID, referenced_position_id: POS_ID }],
      kpiCats: [{ id: KAT_UMSATZ_ID, name: 'Erlöse', type: 'umsatz', level: 1, parent_id: null, sort_order: 0, sales_plattform_enabled: false, ist_abzugsposten: false }],
      umsatz: [
        { leistungsdatum: '2026-01-01', betrag: '100', kategorie_id: KAT_UMSATZ_ID, gruppe_id: null, untergruppe_id: null, sales_plattform_id: null, produkt_id: PRODUKT_ID },
        { leistungsdatum: '2026-02-01', betrag: '150', kategorie_id: KAT_UMSATZ_ID, gruppe_id: null, untergruppe_id: null, sales_plattform_id: null, produkt_id: PRODUKT_ID },
        { leistungsdatum: '2026-03-01', betrag: '-50', kategorie_id: KAT_UMSATZ_ID, gruppe_id: null, untergruppe_id: null, sales_plattform_id: null, produkt_id: PRODUKT_ID },
      ],
    })
    const res = await GET(req({ produkt_ids: PRODUKT_ID, granularitaet: 'monat' }))
    const body = await res.json()

    // The virtual position is always the last
    const kumPos = body.positionen.find((p: { id: string }) => p.id === 'break-even-kumuliert')
    expect(kumPos).toBeDefined()
    expect(kumPos.name).toBe('Kumuliertes Ergebnis')
    expect(kumPos.type).toBe('summe')

    // Summe "Ergebnis" shows raw values: 100, 150, -50
    const summePos = body.positionen.find((p: { id: string }) => p.id === SUMME_ID)
    expect(summePos.values['2026-01']).toBe(100)
    expect(summePos.values['2026-02']).toBe(150)
    expect(summePos.values['2026-03']).toBe(-50)

    // Kumuliertes Ergebnis is running sum of Summe: 100, 250, 200
    expect(kumPos.values['2026-01']).toBe(100)
    expect(kumPos.values['2026-02']).toBe(250)   // 100 + 150
    expect(kumPos.values['2026-03']).toBe(200)   // 250 + (-50)
  })

  it('kumuliertes ergebnis is always the last position in the list', async () => {
    setupMocks({
      positions: [
        { id: POS_ID,   name: 'DB1',      type: 'position', sort_order: 0, investitionsbezogen: false },
        { id: SUMME_ID, name: 'Ergebnis', type: 'summe',    sort_order: 1, investitionsbezogen: false },
      ],
      rpKategorien: [{ report_position_id: POS_ID, kpi_category_id: KAT_UMSATZ_ID }],
      rpSummen: [{ report_position_id: SUMME_ID, referenced_position_id: POS_ID }],
      kpiCats: [{ id: KAT_UMSATZ_ID, name: 'Erlöse', type: 'umsatz', level: 1, parent_id: null, sort_order: 0, sales_plattform_enabled: false, ist_abzugsposten: false }],
      umsatz: [
        { leistungsdatum: '2026-01-01', betrag: '500', kategorie_id: KAT_UMSATZ_ID, gruppe_id: null, untergruppe_id: null, sales_plattform_id: null, produkt_id: PRODUKT_ID },
      ],
    })
    const res = await GET(req({ produkt_ids: PRODUKT_ID, granularitaet: 'monat' }))
    const body = await res.json()
    const last = body.positionen[body.positionen.length - 1]
    expect(last.id).toBe('break-even-kumuliert')
  })

  it('no kumuliertes ergebnis appended when no summe position exists', async () => {
    setupMocks({
      positions: [{ id: POS_ID, name: 'Umsatz', type: 'position', sort_order: 0, investitionsbezogen: false }],
      rpKategorien: [{ report_position_id: POS_ID, kpi_category_id: KAT_UMSATZ_ID }],
      kpiCats: [{ id: KAT_UMSATZ_ID, name: 'Erlöse', type: 'umsatz', level: 1, parent_id: null, sort_order: 0, sales_plattform_enabled: false, ist_abzugsposten: false }],
      umsatz: [
        { leistungsdatum: '2026-01-01', betrag: '100', kategorie_id: KAT_UMSATZ_ID, gruppe_id: null, untergruppe_id: null, sales_plattform_id: null, produkt_id: PRODUKT_ID },
      ],
    })
    const res = await GET(req({ produkt_ids: PRODUKT_ID, granularitaet: 'monat' }))
    const body = await res.json()
    const kumPos = body.positionen.find((p: { id: string }) => p.id === 'break-even-kumuliert')
    expect(kumPos).toBeUndefined()
  })

  it('kumuliertes ergebnis accumulates negative cost months correctly', async () => {
    setupMocks({
      positions: [
        { id: POS_ID,   name: 'Kosten',   type: 'position', sort_order: 0, investitionsbezogen: false },
        { id: SUMME_ID, name: 'Ergebnis', type: 'summe',    sort_order: 1, investitionsbezogen: false },
      ],
      rpKategorien: [{ report_position_id: POS_ID, kpi_category_id: KAT_KOSTEN_ID }],
      rpSummen: [{ report_position_id: SUMME_ID, referenced_position_id: POS_ID }],
      kpiCats: [{ id: KAT_KOSTEN_ID, name: 'Kosten', type: 'ausgaben_kosten', level: 1, parent_id: null, sort_order: 0, sales_plattform_enabled: false, ist_abzugsposten: false }],
      ausgaben: [
        { leistungsdatum: '2026-01-10', betrag_netto: '200', kategorie_id: KAT_KOSTEN_ID, gruppe_id: null, untergruppe_id: null, sales_plattform_id: null, produkt_id: PRODUKT_ID },
        { leistungsdatum: '2026-02-20', betrag_netto: '300', kategorie_id: KAT_KOSTEN_ID, gruppe_id: null, untergruppe_id: null, sales_plattform_id: null, produkt_id: PRODUKT_ID },
      ],
    })
    const res = await GET(req({ produkt_ids: PRODUKT_ID, granularitaet: 'monat' }))
    const body = await res.json()
    // Raw Summe values
    const summe = body.positionen.find((p: { id: string }) => p.id === SUMME_ID)
    expect(summe.values['2026-01']).toBe(-200)
    expect(summe.values['2026-02']).toBe(-300)
    // Cumulated Ergebnis
    const kum = body.positionen.find((p: { id: string }) => p.id === 'break-even-kumuliert')
    expect(kum.values['2026-01']).toBe(-200)
    expect(kum.values['2026-02']).toBe(-500)   // -200 + (-300)
  })

  // ── Quartal-Aggregation ─────────────────────────────────────────────────────

  it('aggregates by quarter and cumulates the ergebnis correctly', async () => {
    setupMocks({
      positions: [
        { id: POS_ID,   name: 'Umsatz',   type: 'position', sort_order: 0, investitionsbezogen: false },
        { id: SUMME_ID, name: 'Ergebnis', type: 'summe',    sort_order: 1, investitionsbezogen: false },
      ],
      rpKategorien: [{ report_position_id: POS_ID, kpi_category_id: KAT_UMSATZ_ID }],
      rpSummen: [{ report_position_id: SUMME_ID, referenced_position_id: POS_ID }],
      kpiCats: [{ id: KAT_UMSATZ_ID, name: 'Erlöse', type: 'umsatz', level: 1, parent_id: null, sort_order: 0, sales_plattform_enabled: false, ist_abzugsposten: false }],
      umsatz: [
        { leistungsdatum: '2026-01-15', betrag: '100', kategorie_id: KAT_UMSATZ_ID, gruppe_id: null, untergruppe_id: null, sales_plattform_id: null, produkt_id: PRODUKT_ID },
        { leistungsdatum: '2026-02-10', betrag: '200', kategorie_id: KAT_UMSATZ_ID, gruppe_id: null, untergruppe_id: null, sales_plattform_id: null, produkt_id: PRODUKT_ID },
        { leistungsdatum: '2026-04-20', betrag: '400', kategorie_id: KAT_UMSATZ_ID, gruppe_id: null, untergruppe_id: null, sales_plattform_id: null, produkt_id: PRODUKT_ID },
      ],
    })
    const res = await GET(req({ produkt_ids: PRODUKT_ID, granularitaet: 'quartal' }))
    const body = await res.json()
    expect(body.perioden).toEqual(['2026-Q1', '2026-Q2'])
    // Raw Summe (Ergebnis): Q1=300, Q2=400
    const summe = body.positionen.find((p: { id: string }) => p.id === SUMME_ID)
    expect(summe.values['2026-Q1']).toBe(300)
    expect(summe.values['2026-Q2']).toBe(400)
    // Cumulated: Q1=300, Q2=700
    const kum = body.positionen.find((p: { id: string }) => p.id === 'break-even-kumuliert')
    expect(kum.values['2026-Q1']).toBe(300)
    expect(kum.values['2026-Q2']).toBe(700)
  })

  // ── Abzugsposten ────────────────────────────────────────────────────────────

  it('negates umsatz values for ist_abzugsposten categories', async () => {
    const KAT_ABZUG_ID = 'bbbbbbbb-0000-0000-0000-000000000099'
    setupMocks({
      positions: [{ id: POS_ID, name: 'Nettoumsatz', type: 'position', sort_order: 0, investitionsbezogen: false }],
      rpKategorien: [{ report_position_id: POS_ID, kpi_category_id: KAT_ABZUG_ID }],
      kpiCats: [{ id: KAT_ABZUG_ID, name: 'Rabatte', type: 'umsatz', level: 1, parent_id: null, sort_order: 0, sales_plattform_enabled: false, ist_abzugsposten: true }],
      umsatz: [
        { leistungsdatum: '2026-01-01', betrag: '50', kategorie_id: KAT_ABZUG_ID, gruppe_id: null, untergruppe_id: null, sales_plattform_id: null, produkt_id: PRODUKT_ID },
      ],
    })
    const res = await GET(req({ produkt_ids: PRODUKT_ID, granularitaet: 'monat' }))
    const body = await res.json()
    const pos = body.positionen.find((p: { id: string }) => p.id === POS_ID)
    expect(pos.values['2026-01']).toBe(-50)
  })

  it('includes position-type rows after last summe in kumuliertes ergebnis (e.g. PI-Kosten)', async () => {
    const PI_POS_ID = 'aaaaaaaa-0000-0000-0000-000000000003'
    setupMocks({
      positions: [
        { id: POS_ID,    name: 'Umsatz',    type: 'position', sort_order: 0, investitionsbezogen: false },
        { id: SUMME_ID,  name: 'DB3',       type: 'summe',    sort_order: 1, investitionsbezogen: false },
        { id: PI_POS_ID, name: 'PI-Kosten', type: 'position', sort_order: 2, investitionsbezogen: false },
      ],
      rpKategorien: [
        { report_position_id: POS_ID,    kpi_category_id: KAT_UMSATZ_ID },
        { report_position_id: PI_POS_ID, kpi_category_id: KAT_KOSTEN_ID },
      ],
      rpSummen: [{ report_position_id: SUMME_ID, referenced_position_id: POS_ID }],
      kpiCats: [
        { id: KAT_UMSATZ_ID, name: 'Erlöse', type: 'umsatz',        level: 1, parent_id: null, sort_order: 0, sales_plattform_enabled: false, ist_abzugsposten: false },
        { id: KAT_KOSTEN_ID, name: 'Kosten', type: 'ausgaben_kosten', level: 1, parent_id: null, sort_order: 1, sales_plattform_enabled: false, ist_abzugsposten: false },
      ],
      umsatz: [
        { leistungsdatum: '2026-01-01', betrag: '500', kategorie_id: KAT_UMSATZ_ID, gruppe_id: null, untergruppe_id: null, sales_plattform_id: null, produkt_id: PRODUKT_ID },
        { leistungsdatum: '2026-02-01', betrag: '800', kategorie_id: KAT_UMSATZ_ID, gruppe_id: null, untergruppe_id: null, sales_plattform_id: null, produkt_id: PRODUKT_ID },
      ],
      ausgaben: [
        { leistungsdatum: '2026-01-01', betrag_netto: '2500', kategorie_id: KAT_KOSTEN_ID, gruppe_id: null, untergruppe_id: null, sales_plattform_id: null, produkt_id: PRODUKT_ID },
      ],
    })
    const res = await GET(req({ produkt_ids: PRODUKT_ID, granularitaet: 'monat' }))
    const body = await res.json()

    // DB3 = only Umsatz (PI-Kosten not referenced by summe)
    const db3 = body.positionen.find((p: { id: string }) => p.id === SUMME_ID)
    expect(db3.values['2026-01']).toBe(500)
    expect(db3.values['2026-02']).toBe(800)

    // PI-Kosten standalone
    const piPos = body.positionen.find((p: { id: string }) => p.id === PI_POS_ID)
    expect(piPos.values['2026-01']).toBe(-2500)
    expect(piPos.values['2026-02']).toBe(0)

    // Periodenergebnis = DB3 + PI-Kosten per period
    const periode = body.positionen.find((p: { id: string }) => p.id === 'break-even-periodenergebnis')
    expect(periode.values['2026-01']).toBe(-2000)  // 500 + (-2500)
    expect(periode.values['2026-02']).toBe(800)    // 800 + 0

    // Kumuliertes Ergebnis = running sum of Periodenergebnis
    // Period 1: -2000 → cumul: -2000
    // Period 2: 800 → cumul: -2000 + 800 = -1200
    const kum = body.positionen.find((p: { id: string }) => p.id === 'break-even-kumuliert')
    expect(kum.values['2026-01']).toBe(-2000)
    expect(kum.values['2026-02']).toBe(-1200)
  })

  // ── Produktinvestitionen ─────────────────────────────────────────────────────

  it('books PI investment cost in full in the booking month (no amortization spread)', async () => {
    setupMocks({
      positions: [
        { id: POS_ID,   name: 'PI-Kosten', type: 'position', sort_order: 0, investitionsbezogen: false },
        { id: SUMME_ID, name: 'Ergebnis',  type: 'summe',    sort_order: 1, investitionsbezogen: false },
      ],
      rpKategorien: [{ report_position_id: POS_ID, kpi_category_id: KAT_PI_ID }],
      rpSummen: [{ report_position_id: SUMME_ID, referenced_position_id: POS_ID }],
      kpiCats: [{ id: KAT_PI_ID, name: 'Produktinvestitionen', type: 'ausgaben_kosten', level: 1, parent_id: null, sort_order: 0, sales_plattform_enabled: false, ist_abzugsposten: false }],
      piRows: [
        { leistungsdatum: '2026-01-15', betrag_netto: '1200', kategorie_id: KAT_PI_ID, gruppe_id: null, untergruppe_id: null },
      ],
    })
    const res = await GET(req({ produkt_ids: PRODUKT_ID, granularitaet: 'monat' }))
    expect(res.status).toBe(200)
    const body = await res.json()

    // Full amount in booking month only — no spread over 12 months
    expect(body.perioden).toEqual(['2026-01'])

    const pos = body.positionen.find((p: { id: string }) => p.id === POS_ID)
    expect(pos.values['2026-01']).toBe(-1200)

    const kum = body.positionen.find((p: { id: string }) => p.id === 'break-even-kumuliert')
    expect(kum.values['2026-01']).toBe(-1200)
  })

  // ── Datenbankfehler ─────────────────────────────────────────────────────────

  it('returns 500 on database error for report_positionen', async () => {
    mockFrom.mockReturnValueOnce(chain({ data: null, error: { message: 'DB Error' } }))
    const res = await GET(req({ produkt_ids: PRODUKT_ID }))
    expect(res.status).toBe(500)
  })
})
