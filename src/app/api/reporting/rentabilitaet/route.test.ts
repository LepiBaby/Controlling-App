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
  return new Request(`http://localhost/api/reporting/rentabilitaet?${qs}`)
}

// ─── UUID-Fixtures ────────────────────────────────────────────────────────────

const POS_ID        = 'aaaaaaaa-0000-0000-0000-000000000001'
const SUMME_ID      = 'aaaaaaaa-0000-0000-0000-000000000002'
const KAT_UMSATZ_ID = 'bbbbbbbb-0000-0000-0000-000000000001'
const KAT_KOSTEN_ID = 'bbbbbbbb-0000-0000-0000-000000000002'
const GRP_ID        = 'cccccccc-0000-0000-0000-000000000001'
const UGR_ID        = 'dddddddd-0000-0000-0000-000000000001'

// PROJ-21 Fixtures
const KAT_PRODUKT_ID = 'bbbbbbbb-0000-0000-0000-000000000010'  // ausgaben_kosten, level=1, name='Produkt'
const GRP_WARE_ID    = 'cccccccc-0000-0000-0000-000000000010'  // ausgaben_kosten, level=2, parent=KAT_PRODUKT_ID
const PRODUKT_ID     = 'eeeeeeee-0000-0000-0000-000000000001'  // kpi_categories type='produkte', level=1
const PLT_AMAZON_ID  = 'ffffffff-0000-0000-0000-000000000001'  // sales_plattform
const PLT_EBAY_ID    = 'ffffffff-0000-0000-0000-000000000002'  // sales_plattform

// PROJ-22 Fixtures
const KAT_WV_ID      = 'bbbbbbbb-0000-0000-0000-000000000020'  // ausgaben_kosten, level=1, name='Wertverlust Ware'
const PRODUKT2_ID    = 'eeeeeeee-0000-0000-0000-000000000002'  // zweites Produkt für PROJ-22 Tests

// PROJ-23 Fixtures
const KAT_MS_ID      = 'bbbbbbbb-0000-0000-0000-000000000030'  // ausgaben_kosten, level=1, name='Ersatzteile / Kulanz'
const PRODUKT3_ID    = 'eeeeeeee-0000-0000-0000-000000000003'  // drittes Produkt für PROJ-23 Tests

// PROJ-20 Produktinvestitionen Fixtures
const KAT_PI_ID      = 'bbbbbbbb-0000-0000-0000-000000000040'  // ausgaben_kosten, level=1, name='Produktinvestitionen'

// PROJ-20 Umsatzsteuer Fixtures
const UST_POS_ID     = 'aaaaaaaa-0000-0000-0000-000000000003'  // report_position type='umsatzsteuer'

// ─── Mock-Builder ─────────────────────────────────────────────────────────────

/**
 * Baut eine chainable Supabase-Mock-Query, die auf alle üblichen
 * Builder-Methoden antwortet und beim Awaiten { data, error } zurückgibt.
 */
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
 *  1.  report_positionen
 *  2.  report_position_kategorien
 *  3.  report_summe_positionen
 *  4.  kpi_categories (umsatz + ausgaben_kosten)
 *  5.  kpi_categories (sales_plattformen)
 *  6.  kpi_categories (produkte level 1)
 *  7.  umsatz_transaktionen
 *  8.  ausgaben_kosten_transaktionen (direkt)
 *  9.  ausgaben_kosten_transaktionen (abschreibung)
 *  10. bestand_transaktionen (PROJ-21)
 *  11. produktkosten_zeitraeume (PROJ-21)
 *  12. ausgaben_kosten_transaktionen (Produktinvestitionen, PROJ-20) — nur wenn piRows gesetzt
 */
function setupMocks(opts: {
  positions?:         unknown[]
  rpKategorien?:      unknown[]
  rpSummen?:          unknown[]
  kpiCats?:           unknown[]
  plattformen?:       unknown[]
  produkte?:          unknown[]
  umsatz?:            unknown[]
  ausgaben?:          unknown[]
  abschreibung?:      unknown[]
  bestandTran?:       unknown[]
  produktkosten?:     unknown[]
  piRows?:            unknown[]
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

describe('GET /api/reporting/rentabilitaet', () => {

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

  it('returns 200 with empty positionen when no positions configured', async () => {
    mockFrom.mockReturnValueOnce(chain({ data: [], error: null })) // positions

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

  it('generates correct yearly periods spanning two years', async () => {
    mockFrom.mockReturnValueOnce(chain({ data: [], error: null }))
    const res = await GET(req({ von: '2025-07', bis: '2026-06', granularitaet: 'jahr' }))
    const body = await res.json()
    expect(body.perioden).toEqual(['2025', '2026'])
  })

  // ── Wertberechnung: Umsatz ──────────────────────────────────────────────────

  it('returns correct positive values for a umsatz position', async () => {
    setupMocks({
      positions: [{ id: POS_ID, name: 'Online-Shop', type: 'position', sort_order: 0 }],
      rpKategorien: [{ report_position_id: POS_ID, kpi_category_id: KAT_UMSATZ_ID }],
      kpiCats: [{ id: KAT_UMSATZ_ID, name: 'Online', type: 'umsatz', level: 1, parent_id: null, sort_order: 0, sales_plattform_enabled: false, produkt_enabled: false }],
      umsatz: [
        { leistungsdatum: '2026-01-10', betrag: 1000, kategorie_id: KAT_UMSATZ_ID, gruppe_id: null, untergruppe_id: null, sales_plattform_id: null, produkt_id: null },
        { leistungsdatum: '2026-01-20', betrag: 500,  kategorie_id: KAT_UMSATZ_ID, gruppe_id: null, untergruppe_id: null, sales_plattform_id: null, produkt_id: null },
        { leistungsdatum: '2026-02-05', betrag: 800,  kategorie_id: KAT_UMSATZ_ID, gruppe_id: null, untergruppe_id: null, sales_plattform_id: null, produkt_id: null },
      ],
    })

    const res = await GET(req({ von: '2026-01', bis: '2026-02', granularitaet: 'monat' }))
    expect(res.status).toBe(200)
    const body = await res.json()

    expect(body.positionen).toHaveLength(1)
    const pos = body.positionen[0]
    expect(pos.id).toBe(POS_ID)
    expect(pos.type).toBe('position')
    expect(pos.values['2026-01']).toBe(1500)
    expect(pos.values['2026-02']).toBe(800)
  })

  // ── Wertberechnung: Ausgaben ────────────────────────────────────────────────

  it('returns correct negative values for an ausgaben position', async () => {
    setupMocks({
      positions: [{ id: POS_ID, name: 'Personalkosten', type: 'position', sort_order: 0 }],
      rpKategorien: [{ report_position_id: POS_ID, kpi_category_id: KAT_KOSTEN_ID }],
      kpiCats: [{ id: KAT_KOSTEN_ID, name: 'Personal', type: 'ausgaben_kosten', level: 1, parent_id: null, sort_order: 0, sales_plattform_enabled: false, produkt_enabled: false }],
      ausgaben: [
        { leistungsdatum: '2026-01-15', betrag_netto: 3000, kategorie_id: KAT_KOSTEN_ID, gruppe_id: null, untergruppe_id: null, sales_plattform_id: null, produkt_id: null },
      ],
    })

    const res = await GET(req({ von: '2026-01', bis: '2026-01', granularitaet: 'monat' }))
    const body = await res.json()

    const pos = body.positionen[0]
    expect(pos.values['2026-01']).toBe(-3000)
  })

  // ── Wertberechnung: Abzugsposten (PROJ-11) ──────────────────────────────────

  it('negates umsatz values for ist_abzugsposten categories (e.g. Rabatte, Rückerstattungen)', async () => {
    const KAT_ABZUG_ID = 'bbbbbbbb-0000-0000-0000-000000000003'
    setupMocks({
      positions: [{ id: POS_ID, name: 'Rabatte', type: 'position', sort_order: 0 }],
      rpKategorien: [{ report_position_id: POS_ID, kpi_category_id: KAT_ABZUG_ID }],
      kpiCats: [{ id: KAT_ABZUG_ID, name: 'Rabatte', type: 'umsatz', level: 1, parent_id: null, sort_order: 0, sales_plattform_enabled: false, produkt_enabled: false, ist_abzugsposten: true }],
      umsatz: [
        { leistungsdatum: '2026-01-05', betrag: 200, kategorie_id: KAT_ABZUG_ID, gruppe_id: null, untergruppe_id: null, sales_plattform_id: null, produkt_id: null },
      ],
    })

    const res = await GET(req({ von: '2026-01', bis: '2026-01', granularitaet: 'monat' }))
    const body = await res.json()

    expect(body.positionen[0].values['2026-01']).toBe(-200)
  })

  // ── Wertberechnung: Summen-Position ─────────────────────────────────────────

  it('returns correct summe-position values (sum of referenced positions)', async () => {
    setupMocks({
      positions: [
        { id: POS_ID,   name: 'Umsatz',      type: 'position', sort_order: 0 },
        { id: SUMME_ID, name: 'Netto-Umsatz', type: 'summe',    sort_order: 1 },
      ],
      rpKategorien: [{ report_position_id: POS_ID, kpi_category_id: KAT_UMSATZ_ID }],
      rpSummen:     [{ report_position_id: SUMME_ID, referenced_position_id: POS_ID }],
      kpiCats: [{ id: KAT_UMSATZ_ID, name: 'Online', type: 'umsatz', level: 1, parent_id: null, sort_order: 0, sales_plattform_enabled: false, produkt_enabled: false }],
      umsatz: [
        { leistungsdatum: '2026-03-01', betrag: 2000, kategorie_id: KAT_UMSATZ_ID, gruppe_id: null, untergruppe_id: null, sales_plattform_id: null, produkt_id: null },
      ],
    })

    const res = await GET(req({ von: '2026-03', bis: '2026-03', granularitaet: 'monat' }))
    const body = await res.json()

    expect(body.positionen).toHaveLength(2)
    const summePos = body.positionen.find((p: { id: string }) => p.id === SUMME_ID)
    expect(summePos.type).toBe('summe')
    expect(summePos.values['2026-03']).toBe(2000)
    expect(summePos.kategorien).toHaveLength(0)
  })

  // ── Wertberechnung: Abschreibungen ─────────────────────────────────────────

  it('includes depreciation rates in ausgaben values', async () => {
    setupMocks({
      positions:    [{ id: POS_ID, name: 'Investitionen', type: 'position', sort_order: 0 }],
      rpKategorien: [{ report_position_id: POS_ID, kpi_category_id: KAT_KOSTEN_ID }],
      kpiCats: [{ id: KAT_KOSTEN_ID, name: 'Maschinen', type: 'ausgaben_kosten', level: 1, parent_id: null, sort_order: 0, sales_plattform_enabled: false, produkt_enabled: false }],
      abschreibung: [{
        leistungsdatum: '2026-01-01',
        betrag_netto: 36000, // 36 months × 1000 €/Monat
        kategorie_id: KAT_KOSTEN_ID,
        gruppe_id: null,
        untergruppe_id: null,
        abschreibung: '3_jahre',
      }],
    })

    const res = await GET(req({ von: '2026-01', bis: '2026-02', granularitaet: 'monat' }))
    const body = await res.json()

    const pos = body.positionen[0]
    // Rate: 36000 / 36 = 1000 pro Monat → negiert
    expect(pos.values['2026-01']).toBe(-1000)
    expect(pos.values['2026-02']).toBe(-1000)
  })

  // ── Drill-Down: Kategorie-Hierarchie ────────────────────────────────────────

  it('returns kategorie drill-down with gruppe and untergruppe', async () => {
    setupMocks({
      positions:    [{ id: POS_ID, name: 'Umsatz', type: 'position', sort_order: 0 }],
      rpKategorien: [{ report_position_id: POS_ID, kpi_category_id: KAT_UMSATZ_ID }],
      kpiCats: [
        { id: KAT_UMSATZ_ID, name: 'Online',    type: 'umsatz', level: 1, parent_id: null,        sort_order: 0, sales_plattform_enabled: false, produkt_enabled: false },
        { id: GRP_ID,        name: 'Deutschland', type: 'umsatz', level: 2, parent_id: KAT_UMSATZ_ID, sort_order: 0, sales_plattform_enabled: false, produkt_enabled: false },
        { id: UGR_ID,        name: 'Kleidung',   type: 'umsatz', level: 3, parent_id: GRP_ID,     sort_order: 0, sales_plattform_enabled: false, produkt_enabled: false },
      ],
      umsatz: [
        { leistungsdatum: '2026-01-15', betrag: 500, kategorie_id: KAT_UMSATZ_ID, gruppe_id: GRP_ID, untergruppe_id: UGR_ID, sales_plattform_id: null, produkt_id: null },
      ],
    })

    const res = await GET(req({ von: '2026-01', bis: '2026-01', granularitaet: 'monat' }))
    const body = await res.json()

    const pos = body.positionen[0]
    expect(pos.kategorien).toHaveLength(1)

    const kat = pos.kategorien[0]
    expect(kat.id).toBe(KAT_UMSATZ_ID)
    expect(kat.kpi_type).toBe('umsatz')
    expect(kat.values['2026-01']).toBe(500)
    expect(kat.gruppen).toHaveLength(1)

    const grp = kat.gruppen[0]
    expect(grp.id).toBe(GRP_ID)
    expect(grp.values['2026-01']).toBe(500)
    expect(grp.untergruppen).toHaveLength(1)

    const ugr = grp.untergruppen[0]
    expect(ugr.id).toBe(UGR_ID)
    expect(ugr.values['2026-01']).toBe(500)
    expect(ugr.sales_plattformen).toHaveLength(0)
  })

  // ── Transaktionen ausserhalb des Zeitraums werden ignoriert ─────────────────

  it('excludes transactions outside the date range', async () => {
    setupMocks({
      positions:    [{ id: POS_ID, name: 'Umsatz', type: 'position', sort_order: 0 }],
      rpKategorien: [{ report_position_id: POS_ID, kpi_category_id: KAT_UMSATZ_ID }],
      kpiCats: [{ id: KAT_UMSATZ_ID, name: 'Online', type: 'umsatz', level: 1, parent_id: null, sort_order: 0, sales_plattform_enabled: false, produkt_enabled: false }],
      // API-seitig bereits durch gte/lte gefiltert → DB gibt keine Treffer
      umsatz: [],
    })

    const res = await GET(req({ von: '2026-03', bis: '2026-03', granularitaet: 'monat' }))
    const body = await res.json()

    const pos = body.positionen[0]
    expect(pos.values['2026-03']).toBe(0)
  })

  // ── Transaktionen ohne zugewiesene Kategorie werden ignoriert ────────────────

  it('ignores transactions whose kategorie is not assigned to any position', async () => {
    const UNASSIGNED_ID = 'ffffffff-0000-0000-0000-000000000099'
    setupMocks({
      positions:    [{ id: POS_ID, name: 'Umsatz', type: 'position', sort_order: 0 }],
      rpKategorien: [{ report_position_id: POS_ID, kpi_category_id: KAT_UMSATZ_ID }],
      kpiCats: [{ id: KAT_UMSATZ_ID, name: 'Online', type: 'umsatz', level: 1, parent_id: null, sort_order: 0, sales_plattform_enabled: false, produkt_enabled: false }],
      umsatz: [
        { leistungsdatum: '2026-01-10', betrag: 999, kategorie_id: UNASSIGNED_ID, gruppe_id: null, untergruppe_id: null, sales_plattform_id: null, produkt_id: null },
      ],
    })

    const res = await GET(req({ von: '2026-01', bis: '2026-01', granularitaet: 'monat' }))
    const body = await res.json()

    expect(body.positionen[0].values['2026-01']).toBe(0)
  })

  // ── Quartals-Aggregation ────────────────────────────────────────────────────

  it('aggregates multiple months into the same quarter', async () => {
    setupMocks({
      positions:    [{ id: POS_ID, name: 'Umsatz', type: 'position', sort_order: 0 }],
      rpKategorien: [{ report_position_id: POS_ID, kpi_category_id: KAT_UMSATZ_ID }],
      kpiCats: [{ id: KAT_UMSATZ_ID, name: 'Online', type: 'umsatz', level: 1, parent_id: null, sort_order: 0, sales_plattform_enabled: false, produkt_enabled: false }],
      umsatz: [
        { leistungsdatum: '2026-01-05', betrag: 100, kategorie_id: KAT_UMSATZ_ID, gruppe_id: null, untergruppe_id: null, sales_plattform_id: null, produkt_id: null },
        { leistungsdatum: '2026-02-10', betrag: 200, kategorie_id: KAT_UMSATZ_ID, gruppe_id: null, untergruppe_id: null, sales_plattform_id: null, produkt_id: null },
        { leistungsdatum: '2026-03-20', betrag: 300, kategorie_id: KAT_UMSATZ_ID, gruppe_id: null, untergruppe_id: null, sales_plattform_id: null, produkt_id: null },
      ],
    })

    const res = await GET(req({ von: '2026-01', bis: '2026-03', granularitaet: 'quartal' }))
    const body = await res.json()

    expect(body.perioden).toEqual(['2026-Q1'])
    const pos = body.positionen[0]
    expect(pos.values['2026-Q1']).toBe(600)
  })

  // ── PROJ-21: Bestandsberechnung ─────────────────────────────────────────────

  it('adds bestand-calculated costs to the Produkt ausgaben_kosten category', async () => {
    setupMocks({
      positions:    [{ id: POS_ID, name: 'Produktkosten', type: 'position', sort_order: 0 }],
      rpKategorien: [{ report_position_id: POS_ID, kpi_category_id: KAT_PRODUKT_ID }],
      kpiCats: [{ id: KAT_PRODUKT_ID, name: 'Produkt', type: 'ausgaben_kosten', level: 1, parent_id: null, sort_order: 0, sales_plattform_enabled: false, produkt_enabled: false }],
      produkte: [{ id: PRODUKT_ID, name: 'Baby-Mütze' }],
      bestandTran: [{
        datum: '2026-01-10',
        produkt_id: PRODUKT_ID,
        bestand_sendungen: [{ menge: 10, plattform_id: PLT_AMAZON_ID }],
      }],
      produktkosten: [{
        produkt_id: PRODUKT_ID,
        gueltig_von: '2026-01-01',
        gueltig_bis: null,
        produktkosten_werte: [{ kategorie_id: GRP_WARE_ID, wert: 5 }, { kategorie_id: GRP_WARE_ID, wert: 3 }],  // 10 × (5+3) = 80
      }],
      plattformen: [{ id: PLT_AMAZON_ID, name: 'Amazon' }],
    })

    const res = await GET(req({ von: '2026-01', bis: '2026-01', granularitaet: 'monat' }))
    expect(res.status).toBe(200)
    const body = await res.json()

    // Position should have -80 (10 units × 8 € = 80, negated)
    const pos = body.positionen[0]
    expect(pos.values['2026-01']).toBe(-80)
  })

  it('adds bestand costs on top of direct ausgaben bookings', async () => {
    setupMocks({
      positions:    [{ id: POS_ID, name: 'Produktkosten', type: 'position', sort_order: 0 }],
      rpKategorien: [{ report_position_id: POS_ID, kpi_category_id: KAT_PRODUKT_ID }],
      kpiCats: [{ id: KAT_PRODUKT_ID, name: 'Produkt', type: 'ausgaben_kosten', level: 1, parent_id: null, sort_order: 0, sales_plattform_enabled: false, produkt_enabled: false }],
      produkte: [{ id: PRODUKT_ID, name: 'Baby-Mütze' }],
      ausgaben: [{
        leistungsdatum: '2026-01-05', betrag_netto: 100,
        kategorie_id: KAT_PRODUKT_ID, gruppe_id: null, untergruppe_id: null,
        sales_plattform_id: null, produkt_id: null,
      }],
      bestandTran: [{
        datum: '2026-01-10',
        produkt_id: PRODUKT_ID,
        bestand_sendungen: [{ menge: 5, plattform_id: PLT_AMAZON_ID }],
      }],
      produktkosten: [{
        produkt_id: PRODUKT_ID,
        gueltig_von: '2026-01-01',
        gueltig_bis: null,
        produktkosten_werte: [{ kategorie_id: GRP_WARE_ID, wert: 10 }],
      }],
      plattformen: [{ id: PLT_AMAZON_ID, name: 'Amazon' }],
    })

    const res = await GET(req({ von: '2026-01', bis: '2026-01', granularitaet: 'monat' }))
    const body = await res.json()

    // -100 (direct) + -50 (5 × 10) = -150
    expect(body.positionen[0].values['2026-01']).toBe(-150)
  })

  it('returns Gruppe → Plattform → Produkt drill-down for bestand costs', async () => {
    setupMocks({
      positions:    [{ id: POS_ID, name: 'Produktkosten', type: 'position', sort_order: 0 }],
      rpKategorien: [{ report_position_id: POS_ID, kpi_category_id: KAT_PRODUKT_ID }],
      kpiCats: [
        { id: KAT_PRODUKT_ID, name: 'Produkt', type: 'ausgaben_kosten', level: 1, parent_id: null, sort_order: 0, sales_plattform_enabled: false, produkt_enabled: false },
        { id: GRP_WARE_ID, name: 'Ware', type: 'ausgaben_kosten', level: 2, parent_id: KAT_PRODUKT_ID, sort_order: 0, sales_plattform_enabled: false, produkt_enabled: false },
      ],
      produkte: [{ id: PRODUKT_ID, name: 'Baby-Mütze' }],
      bestandTran: [{
        datum: '2026-01-15',
        produkt_id: PRODUKT_ID,
        bestand_sendungen: [{ menge: 4, plattform_id: PLT_AMAZON_ID }],
      }],
      produktkosten: [{
        produkt_id: PRODUKT_ID,
        gueltig_von: '2026-01-01',
        gueltig_bis: '2026-03-31',
        produktkosten_werte: [{ kategorie_id: GRP_WARE_ID, wert: 12.5 }],
      }],
      plattformen: [{ id: PLT_AMAZON_ID, name: 'Amazon' }],
    })

    const res = await GET(req({ von: '2026-01', bis: '2026-01', granularitaet: 'monat' }))
    const body = await res.json()

    const kat = body.positionen[0].kategorien[0]
    expect(kat.id).toBe(KAT_PRODUKT_ID)
    expect(kat.gruppen).toHaveLength(1)

    const grp = kat.gruppen[0]
    expect(grp.id).toBe(GRP_WARE_ID)
    expect(grp.name).toBe('Ware')
    expect(grp.values['2026-01']).toBe(-50)  // 4 × 12.5 = 50, negated

    expect(grp.sales_plattformen).toHaveLength(1)
    const plt = grp.sales_plattformen[0]
    expect(plt.id).toBe(PLT_AMAZON_ID)
    expect(plt.values['2026-01']).toBe(-50)

    expect(plt.produkte).toHaveLength(1)
    const prd = plt.produkte[0]
    expect(prd.id).toBe(PRODUKT_ID)
    expect(prd.name).toBe('Baby-Mütze')
    expect(prd.values['2026-01']).toBe(-50)
  })

  it('returns Plattform breakdown within Gruppe for bestand costs', async () => {
    setupMocks({
      positions:    [{ id: POS_ID, name: 'Produktkosten', type: 'position', sort_order: 0 }],
      rpKategorien: [{ report_position_id: POS_ID, kpi_category_id: KAT_PRODUKT_ID }],
      kpiCats: [
        { id: KAT_PRODUKT_ID, name: 'Produkt', type: 'ausgaben_kosten', level: 1, parent_id: null, sort_order: 0, sales_plattform_enabled: false, produkt_enabled: false },
        { id: GRP_WARE_ID, name: 'Ware', type: 'ausgaben_kosten', level: 2, parent_id: KAT_PRODUKT_ID, sort_order: 0, sales_plattform_enabled: false, produkt_enabled: false },
      ],
      produkte: [{ id: PRODUKT_ID, name: 'Baby-Mütze' }],
      bestandTran: [{
        datum: '2026-01-10',
        produkt_id: PRODUKT_ID,
        bestand_sendungen: [
          { menge: 3, plattform_id: PLT_AMAZON_ID },
          { menge: 2, plattform_id: PLT_EBAY_ID },
        ],
      }],
      produktkosten: [{
        produkt_id: PRODUKT_ID,
        gueltig_von: '2026-01-01',
        gueltig_bis: null,
        produktkosten_werte: [{ kategorie_id: GRP_WARE_ID, wert: 10 }],
      }],
      plattformen: [
        { id: PLT_AMAZON_ID, name: 'Amazon' },
        { id: PLT_EBAY_ID,   name: 'eBay' },
      ],
    })

    const res = await GET(req({ von: '2026-01', bis: '2026-01', granularitaet: 'monat' }))
    const body = await res.json()

    const grp = body.positionen[0].kategorien[0].gruppen[0]
    expect(grp.values['2026-01']).toBe(-50)  // (3+2) × 10 = 50, negated

    expect(grp.sales_plattformen).toHaveLength(2)
    const amazon = grp.sales_plattformen.find((p: { id: string }) => p.id === PLT_AMAZON_ID)
    const ebay   = grp.sales_plattformen.find((p: { id: string }) => p.id === PLT_EBAY_ID)
    expect(amazon.values['2026-01']).toBe(-30)  // 3 × 10
    expect(ebay.values['2026-01']).toBe(-20)    // 2 × 10

    // Produkt ist innerhalb jeder Plattform sichtbar
    expect(amazon.produkte).toHaveLength(1)
    expect(amazon.produkte[0].id).toBe(PRODUKT_ID)
    expect(amazon.produkte[0].values['2026-01']).toBe(-30)
    expect(ebay.produkte[0].values['2026-01']).toBe(-20)
  })

  it('contributes 0 when no matching produktkosten_zeitraum exists', async () => {
    setupMocks({
      positions:    [{ id: POS_ID, name: 'Produktkosten', type: 'position', sort_order: 0 }],
      rpKategorien: [{ report_position_id: POS_ID, kpi_category_id: KAT_PRODUKT_ID }],
      kpiCats: [{ id: KAT_PRODUKT_ID, name: 'Produkt', type: 'ausgaben_kosten', level: 1, parent_id: null, sort_order: 0, sales_plattform_enabled: false, produkt_enabled: false }],
      produkte: [{ id: PRODUKT_ID, name: 'Baby-Mütze' }],
      bestandTran: [{
        datum: '2026-01-10',
        produkt_id: PRODUKT_ID,
        bestand_sendungen: [{ menge: 10, plattform_id: PLT_AMAZON_ID }],
      }],
      produktkosten: [],  // no zeitraeume at all
      plattformen: [{ id: PLT_AMAZON_ID, name: 'Amazon' }],
    })

    const res = await GET(req({ von: '2026-01', bis: '2026-01', granularitaet: 'monat' }))
    const body = await res.json()

    // No cost contribution → 0
    expect(body.positionen[0].values['2026-01']).toBe(0)
    // No gruppen in response because no cost was accumulated
    expect(body.positionen[0].kategorien[0].gruppen).toHaveLength(0)
  })

  it('aggregates bestand costs from multiple SKUs of the same product', async () => {
    const SKU1_TXN = { datum: '2026-01-10', produkt_id: PRODUKT_ID, bestand_sendungen: [{ menge: 3, plattform_id: PLT_AMAZON_ID }] }
    const SKU2_TXN = { datum: '2026-01-12', produkt_id: PRODUKT_ID, bestand_sendungen: [{ menge: 7, plattform_id: PLT_AMAZON_ID }] }

    setupMocks({
      positions:    [{ id: POS_ID, name: 'Produktkosten', type: 'position', sort_order: 0 }],
      rpKategorien: [{ report_position_id: POS_ID, kpi_category_id: KAT_PRODUKT_ID }],
      kpiCats: [
        { id: KAT_PRODUKT_ID, name: 'Produkt', type: 'ausgaben_kosten', level: 1, parent_id: null, sort_order: 0, sales_plattform_enabled: false, produkt_enabled: false },
        { id: GRP_WARE_ID, name: 'Ware', type: 'ausgaben_kosten', level: 2, parent_id: KAT_PRODUKT_ID, sort_order: 0, sales_plattform_enabled: false, produkt_enabled: false },
      ],
      produkte: [{ id: PRODUKT_ID, name: 'Baby-Mütze' }],
      bestandTran: [SKU1_TXN, SKU2_TXN],
      produktkosten: [{
        produkt_id: PRODUKT_ID,
        gueltig_von: '2026-01-01',
        gueltig_bis: null,
        produktkosten_werte: [{ kategorie_id: GRP_WARE_ID, wert: 4 }],
      }],
      plattformen: [{ id: PLT_AMAZON_ID, name: 'Amazon' }],
    })

    const res = await GET(req({ von: '2026-01', bis: '2026-01', granularitaet: 'monat' }))
    const body = await res.json()

    // (3+7) × 4 = 40, negated
    expect(body.positionen[0].values['2026-01']).toBe(-40)
    // Gruppe → Plattform → Produkt
    expect(body.positionen[0].kategorien[0].gruppen[0].sales_plattformen[0].produkte[0].values['2026-01']).toBe(-40)
  })

  it('ignores bestand transactions with no produkt_id', async () => {
    setupMocks({
      positions:    [{ id: POS_ID, name: 'Produktkosten', type: 'position', sort_order: 0 }],
      rpKategorien: [{ report_position_id: POS_ID, kpi_category_id: KAT_PRODUKT_ID }],
      kpiCats: [{ id: KAT_PRODUKT_ID, name: 'Produkt', type: 'ausgaben_kosten', level: 1, parent_id: null, sort_order: 0, sales_plattform_enabled: false, produkt_enabled: false }],
      produkte: [],
      bestandTran: [{
        datum: '2026-01-10',
        produkt_id: null,  // no product assigned
        bestand_sendungen: [{ menge: 10, plattform_id: PLT_AMAZON_ID }],
      }],
      produktkosten: [],
      plattformen: [{ id: PLT_AMAZON_ID, name: 'Amazon' }],
    })

    const res = await GET(req({ von: '2026-01', bis: '2026-01', granularitaet: 'monat' }))
    const body = await res.json()

    expect(body.positionen[0].values['2026-01']).toBe(0)
  })

  // ── PROJ-22: Wertverlust-Berechnung ─────────────────────────────────────────

  it('calculates wertverlust as warenverluste × Σ(produktkosten werte) and negates it', async () => {
    setupMocks({
      positions:    [{ id: POS_ID, name: 'Wertverluste', type: 'position', sort_order: 0 }],
      rpKategorien: [{ report_position_id: POS_ID, kpi_category_id: KAT_WV_ID }],
      kpiCats: [{ id: KAT_WV_ID, name: 'Wertverlust Ware', type: 'ausgaben_kosten', level: 1, parent_id: null, sort_order: 0, sales_plattform_enabled: false, produkt_enabled: false }],
      produkte: [{ id: PRODUKT_ID, name: 'Baby-Mütze' }],
      bestandTran: [{
        datum: '2026-01-15',
        produkt_id: PRODUKT_ID,
        warenverluste: 5,
        bestand_sendungen: [],
      }],
      produktkosten: [{
        produkt_id: PRODUKT_ID,
        gueltig_von: '2026-01-01',
        gueltig_bis: null,
        produktkosten_werte: [{ kategorie_id: GRP_WARE_ID, wert: 8 }, { kategorie_id: GRP_WARE_ID, wert: 2 }],  // Σ = 10
      }],
    })

    const res = await GET(req({ von: '2026-01', bis: '2026-01', granularitaet: 'monat' }))
    expect(res.status).toBe(200)
    const body = await res.json()

    // 5 × (8 + 2) = 50, negiert
    expect(body.positionen[0].values['2026-01']).toBe(-50)
  })

  it('returns produkte_wertverlust array with correct product values', async () => {
    setupMocks({
      positions:    [{ id: POS_ID, name: 'Wertverluste', type: 'position', sort_order: 0 }],
      rpKategorien: [{ report_position_id: POS_ID, kpi_category_id: KAT_WV_ID }],
      kpiCats: [{ id: KAT_WV_ID, name: 'Wertverlust Ware', type: 'ausgaben_kosten', level: 1, parent_id: null, sort_order: 0, sales_plattform_enabled: false, produkt_enabled: false }],
      produkte: [{ id: PRODUKT_ID, name: 'Baby-Mütze' }],
      bestandTran: [{
        datum: '2026-01-10',
        produkt_id: PRODUKT_ID,
        warenverluste: 3,
        bestand_sendungen: [],
      }],
      produktkosten: [{
        produkt_id: PRODUKT_ID,
        gueltig_von: '2026-01-01',
        gueltig_bis: null,
        produktkosten_werte: [{ kategorie_id: GRP_WARE_ID, wert: 20 }],
      }],
    })

    const res = await GET(req({ von: '2026-01', bis: '2026-01', granularitaet: 'monat' }))
    const body = await res.json()

    const kat = body.positionen[0].kategorien[0]
    expect(kat.id).toBe(KAT_WV_ID)
    expect(kat.produkte_wertverlust).toHaveLength(1)
    expect(kat.produkte_wertverlust[0].id).toBe(PRODUKT_ID)
    expect(kat.produkte_wertverlust[0].name).toBe('Baby-Mütze')
    expect(kat.produkte_wertverlust[0].values['2026-01']).toBe(-60)  // 3 × 20 = 60
  })

  it('aggregates wertverlust from multiple transactions of the same product', async () => {
    setupMocks({
      positions:    [{ id: POS_ID, name: 'Wertverluste', type: 'position', sort_order: 0 }],
      rpKategorien: [{ report_position_id: POS_ID, kpi_category_id: KAT_WV_ID }],
      kpiCats: [{ id: KAT_WV_ID, name: 'Wertverlust Ware', type: 'ausgaben_kosten', level: 1, parent_id: null, sort_order: 0, sales_plattform_enabled: false, produkt_enabled: false }],
      produkte: [{ id: PRODUKT_ID, name: 'Baby-Mütze' }],
      bestandTran: [
        { datum: '2026-01-05', produkt_id: PRODUKT_ID, warenverluste: 2, bestand_sendungen: [] },
        { datum: '2026-01-20', produkt_id: PRODUKT_ID, warenverluste: 3, bestand_sendungen: [] },
      ],
      produktkosten: [{
        produkt_id: PRODUKT_ID,
        gueltig_von: '2026-01-01',
        gueltig_bis: null,
        produktkosten_werte: [{ kategorie_id: GRP_WARE_ID, wert: 10 }],
      }],
    })

    const res = await GET(req({ von: '2026-01', bis: '2026-01', granularitaet: 'monat' }))
    const body = await res.json()

    // (2 + 3) × 10 = 50, negiert
    expect(body.positionen[0].values['2026-01']).toBe(-50)
    expect(body.positionen[0].kategorien[0].produkte_wertverlust[0].values['2026-01']).toBe(-50)
  })

  it('ignores warenverluste = 0 — product does not appear in produkte_wertverlust', async () => {
    setupMocks({
      positions:    [{ id: POS_ID, name: 'Wertverluste', type: 'position', sort_order: 0 }],
      rpKategorien: [{ report_position_id: POS_ID, kpi_category_id: KAT_WV_ID }],
      kpiCats: [{ id: KAT_WV_ID, name: 'Wertverlust Ware', type: 'ausgaben_kosten', level: 1, parent_id: null, sort_order: 0, sales_plattform_enabled: false, produkt_enabled: false }],
      produkte: [{ id: PRODUKT_ID, name: 'Baby-Mütze' }],
      bestandTran: [{
        datum: '2026-01-10',
        produkt_id: PRODUKT_ID,
        warenverluste: 0,
        bestand_sendungen: [],
      }],
      produktkosten: [{
        produkt_id: PRODUKT_ID,
        gueltig_von: '2026-01-01',
        gueltig_bis: null,
        produktkosten_werte: [{ kategorie_id: GRP_WARE_ID, wert: 15 }],
      }],
    })

    const res = await GET(req({ von: '2026-01', bis: '2026-01', granularitaet: 'monat' }))
    const body = await res.json()

    expect(body.positionen[0].values['2026-01']).toBe(0)
    expect(body.positionen[0].kategorien[0].produkte_wertverlust).toHaveLength(0)
  })

  it('contributes 0 wertverlust when no matching produktkosten_zeitraum', async () => {
    setupMocks({
      positions:    [{ id: POS_ID, name: 'Wertverluste', type: 'position', sort_order: 0 }],
      rpKategorien: [{ report_position_id: POS_ID, kpi_category_id: KAT_WV_ID }],
      kpiCats: [{ id: KAT_WV_ID, name: 'Wertverlust Ware', type: 'ausgaben_kosten', level: 1, parent_id: null, sort_order: 0, sales_plattform_enabled: false, produkt_enabled: false }],
      produkte: [{ id: PRODUKT_ID, name: 'Baby-Mütze' }],
      bestandTran: [{
        datum: '2026-01-10',
        produkt_id: PRODUKT_ID,
        warenverluste: 10,
        bestand_sendungen: [],
      }],
      produktkosten: [],  // kein passender Zeitraum
    })

    const res = await GET(req({ von: '2026-01', bis: '2026-01', granularitaet: 'monat' }))
    const body = await res.json()

    expect(body.positionen[0].values['2026-01']).toBe(0)
    expect(body.positionen[0].kategorien[0].produkte_wertverlust).toHaveLength(0)
  })

  it('does not apply wertverlust when WV-Kategorie is not assigned to any position', async () => {
    setupMocks({
      positions:    [{ id: POS_ID, name: 'Sonstiges', type: 'position', sort_order: 0 }],
      rpKategorien: [{ report_position_id: POS_ID, kpi_category_id: KAT_KOSTEN_ID }],
      kpiCats: [
        { id: KAT_KOSTEN_ID, name: 'Logistik',        type: 'ausgaben_kosten', level: 1, parent_id: null, sort_order: 0, sales_plattform_enabled: false, produkt_enabled: false },
        { id: KAT_WV_ID,     name: 'Wertverlust Ware', type: 'ausgaben_kosten', level: 1, parent_id: null, sort_order: 1, sales_plattform_enabled: false, produkt_enabled: false },
      ],
      produkte: [{ id: PRODUKT_ID, name: 'Baby-Mütze' }],
      bestandTran: [{
        datum: '2026-01-10',
        produkt_id: PRODUKT_ID,
        warenverluste: 5,
        bestand_sendungen: [],
      }],
      produktkosten: [{
        produkt_id: PRODUKT_ID,
        gueltig_von: '2026-01-01',
        gueltig_bis: null,
        produktkosten_werte: [{ kategorie_id: GRP_WARE_ID, wert: 10 }],
      }],
    })

    const res = await GET(req({ von: '2026-01', bis: '2026-01', granularitaet: 'monat' }))
    const body = await res.json()

    // KAT_WV_ID not assigned → no wertverlust in position
    expect(body.positionen[0].values['2026-01']).toBe(0)
  })

  it('adds direct ausgaben bookings and wertverlust calculation together', async () => {
    setupMocks({
      positions:    [{ id: POS_ID, name: 'Wertverluste', type: 'position', sort_order: 0 }],
      rpKategorien: [{ report_position_id: POS_ID, kpi_category_id: KAT_WV_ID }],
      kpiCats: [{ id: KAT_WV_ID, name: 'Wertverlust Ware', type: 'ausgaben_kosten', level: 1, parent_id: null, sort_order: 0, sales_plattform_enabled: false, produkt_enabled: false }],
      produkte: [{ id: PRODUKT_ID, name: 'Baby-Mütze' }],
      ausgaben: [{
        leistungsdatum: '2026-01-05', betrag_netto: 200,
        kategorie_id: KAT_WV_ID, gruppe_id: null, untergruppe_id: null,
        sales_plattform_id: null, produkt_id: null,
      }],
      bestandTran: [{
        datum: '2026-01-10',
        produkt_id: PRODUKT_ID,
        warenverluste: 4,
        bestand_sendungen: [],
      }],
      produktkosten: [{
        produkt_id: PRODUKT_ID,
        gueltig_von: '2026-01-01',
        gueltig_bis: null,
        produktkosten_werte: [{ kategorie_id: GRP_WARE_ID, wert: 25 }],
      }],
    })

    const res = await GET(req({ von: '2026-01', bis: '2026-01', granularitaet: 'monat' }))
    const body = await res.json()

    // -200 (direct) + -(4 × 25) = -200 + -100 = -300
    expect(body.positionen[0].values['2026-01']).toBe(-300)
  })

  it('handles multiple products with different wertverlust amounts', async () => {
    setupMocks({
      positions:    [{ id: POS_ID, name: 'Wertverluste', type: 'position', sort_order: 0 }],
      rpKategorien: [{ report_position_id: POS_ID, kpi_category_id: KAT_WV_ID }],
      kpiCats: [{ id: KAT_WV_ID, name: 'Wertverlust Ware', type: 'ausgaben_kosten', level: 1, parent_id: null, sort_order: 0, sales_plattform_enabled: false, produkt_enabled: false }],
      produkte: [
        { id: PRODUKT_ID,  name: 'Baby-Mütze' },
        { id: PRODUKT2_ID, name: 'Winter-Jacket' },
      ],
      bestandTran: [
        { datum: '2026-01-10', produkt_id: PRODUKT_ID,  warenverluste: 2, bestand_sendungen: [] },
        { datum: '2026-01-15', produkt_id: PRODUKT2_ID, warenverluste: 3, bestand_sendungen: [] },
      ],
      produktkosten: [
        {
          produkt_id: PRODUKT_ID,
          gueltig_von: '2026-01-01', gueltig_bis: null,
          produktkosten_werte: [{ kategorie_id: GRP_WARE_ID, wert: 10 }],
        },
        {
          produkt_id: PRODUKT2_ID,
          gueltig_von: '2026-01-01', gueltig_bis: null,
          produktkosten_werte: [{ kategorie_id: GRP_WARE_ID, wert: 30 }],
        },
      ],
    })

    const res = await GET(req({ von: '2026-01', bis: '2026-01', granularitaet: 'monat' }))
    const body = await res.json()

    // Produkt 1: 2 × 10 = 20, Produkt 2: 3 × 30 = 90 → gesamt -110
    expect(body.positionen[0].values['2026-01']).toBe(-110)

    const wvProdukte = body.positionen[0].kategorien[0].produkte_wertverlust
    expect(wvProdukte).toHaveLength(2)
    const p1 = wvProdukte.find((p: { id: string }) => p.id === PRODUKT_ID)
    const p2 = wvProdukte.find((p: { id: string }) => p.id === PRODUKT2_ID)
    expect(p1.values['2026-01']).toBe(-20)
    expect(p2.values['2026-01']).toBe(-90)
  })

  // ── PROJ-23: Manuelle-Sendungen-Berechnung ─────────────────────────────────

  it('calculates manuelle sendungen as sendungen_manuell × Σ(produktkosten werte) and negates it', async () => {
    setupMocks({
      positions:    [{ id: POS_ID, name: 'Vertriebskosten', type: 'position', sort_order: 0 }],
      rpKategorien: [{ report_position_id: POS_ID, kpi_category_id: KAT_MS_ID }],
      kpiCats: [{ id: KAT_MS_ID, name: 'Ersatzteile / Kulanz', type: 'ausgaben_kosten', level: 1, parent_id: null, sort_order: 0, sales_plattform_enabled: false, produkt_enabled: false }],
      produkte: [{ id: PRODUKT_ID, name: 'Baby-Mütze' }],
      bestandTran: [{
        datum: '2026-01-15',
        produkt_id: PRODUKT_ID,
        sendungen_manuell: 4,
        bestand_sendungen: [],
      }],
      produktkosten: [{
        produkt_id: PRODUKT_ID,
        gueltig_von: '2026-01-01',
        gueltig_bis: null,
        produktkosten_werte: [{ kategorie_id: GRP_WARE_ID, wert: 8 }, { kategorie_id: GRP_WARE_ID, wert: 2 }],  // Σ = 10
      }],
    })

    const res = await GET(req({ von: '2026-01', bis: '2026-01', granularitaet: 'monat' }))
    expect(res.status).toBe(200)
    const body = await res.json()

    // 4 × (8 + 2) = 40, negiert
    expect(body.positionen[0].values['2026-01']).toBe(-40)
  })

  it('returns produkte_manuelle_sendungen array with correct product values', async () => {
    setupMocks({
      positions:    [{ id: POS_ID, name: 'Vertriebskosten', type: 'position', sort_order: 0 }],
      rpKategorien: [{ report_position_id: POS_ID, kpi_category_id: KAT_MS_ID }],
      kpiCats: [{ id: KAT_MS_ID, name: 'Ersatzteile / Kulanz', type: 'ausgaben_kosten', level: 1, parent_id: null, sort_order: 0, sales_plattform_enabled: false, produkt_enabled: false }],
      produkte: [{ id: PRODUKT_ID, name: 'Baby-Mütze' }],
      bestandTran: [{
        datum: '2026-01-10',
        produkt_id: PRODUKT_ID,
        sendungen_manuell: 3,
        bestand_sendungen: [],
      }],
      produktkosten: [{
        produkt_id: PRODUKT_ID,
        gueltig_von: '2026-01-01',
        gueltig_bis: null,
        produktkosten_werte: [{ kategorie_id: GRP_WARE_ID, wert: 20 }],
      }],
    })

    const res = await GET(req({ von: '2026-01', bis: '2026-01', granularitaet: 'monat' }))
    const body = await res.json()

    const kat = body.positionen[0].kategorien[0]
    expect(kat.id).toBe(KAT_MS_ID)
    expect(kat.produkte_manuelle_sendungen).toHaveLength(1)
    expect(kat.produkte_manuelle_sendungen[0].id).toBe(PRODUKT_ID)
    expect(kat.produkte_manuelle_sendungen[0].name).toBe('Baby-Mütze')
    expect(kat.produkte_manuelle_sendungen[0].values['2026-01']).toBe(-60)  // 3 × 20 = 60
  })

  it('aggregates manuelle sendungen from multiple transactions of the same product', async () => {
    setupMocks({
      positions:    [{ id: POS_ID, name: 'Vertriebskosten', type: 'position', sort_order: 0 }],
      rpKategorien: [{ report_position_id: POS_ID, kpi_category_id: KAT_MS_ID }],
      kpiCats: [{ id: KAT_MS_ID, name: 'Ersatzteile / Kulanz', type: 'ausgaben_kosten', level: 1, parent_id: null, sort_order: 0, sales_plattform_enabled: false, produkt_enabled: false }],
      produkte: [{ id: PRODUKT_ID, name: 'Baby-Mütze' }],
      bestandTran: [
        { datum: '2026-01-05', produkt_id: PRODUKT_ID, sendungen_manuell: 2, bestand_sendungen: [] },
        { datum: '2026-01-20', produkt_id: PRODUKT_ID, sendungen_manuell: 3, bestand_sendungen: [] },
      ],
      produktkosten: [{
        produkt_id: PRODUKT_ID,
        gueltig_von: '2026-01-01',
        gueltig_bis: null,
        produktkosten_werte: [{ kategorie_id: GRP_WARE_ID, wert: 10 }],
      }],
    })

    const res = await GET(req({ von: '2026-01', bis: '2026-01', granularitaet: 'monat' }))
    const body = await res.json()

    // (2 + 3) × 10 = 50, negiert
    expect(body.positionen[0].values['2026-01']).toBe(-50)
    expect(body.positionen[0].kategorien[0].produkte_manuelle_sendungen[0].values['2026-01']).toBe(-50)
  })

  it('ignores sendungen_manuell = 0 — product does not appear in produkte_manuelle_sendungen', async () => {
    setupMocks({
      positions:    [{ id: POS_ID, name: 'Vertriebskosten', type: 'position', sort_order: 0 }],
      rpKategorien: [{ report_position_id: POS_ID, kpi_category_id: KAT_MS_ID }],
      kpiCats: [{ id: KAT_MS_ID, name: 'Ersatzteile / Kulanz', type: 'ausgaben_kosten', level: 1, parent_id: null, sort_order: 0, sales_plattform_enabled: false, produkt_enabled: false }],
      produkte: [{ id: PRODUKT_ID, name: 'Baby-Mütze' }],
      bestandTran: [{
        datum: '2026-01-10',
        produkt_id: PRODUKT_ID,
        sendungen_manuell: 0,
        bestand_sendungen: [],
      }],
      produktkosten: [{
        produkt_id: PRODUKT_ID,
        gueltig_von: '2026-01-01',
        gueltig_bis: null,
        produktkosten_werte: [{ kategorie_id: GRP_WARE_ID, wert: 15 }],
      }],
    })

    const res = await GET(req({ von: '2026-01', bis: '2026-01', granularitaet: 'monat' }))
    const body = await res.json()

    expect(body.positionen[0].values['2026-01']).toBe(0)
    expect(body.positionen[0].kategorien[0].produkte_manuelle_sendungen).toHaveLength(0)
  })

  it('contributes 0 manuelle sendungen when no matching produktkosten_zeitraum', async () => {
    setupMocks({
      positions:    [{ id: POS_ID, name: 'Vertriebskosten', type: 'position', sort_order: 0 }],
      rpKategorien: [{ report_position_id: POS_ID, kpi_category_id: KAT_MS_ID }],
      kpiCats: [{ id: KAT_MS_ID, name: 'Ersatzteile / Kulanz', type: 'ausgaben_kosten', level: 1, parent_id: null, sort_order: 0, sales_plattform_enabled: false, produkt_enabled: false }],
      produkte: [{ id: PRODUKT_ID, name: 'Baby-Mütze' }],
      bestandTran: [{
        datum: '2026-01-10',
        produkt_id: PRODUKT_ID,
        sendungen_manuell: 10,
        bestand_sendungen: [],
      }],
      produktkosten: [],  // kein passender Zeitraum
    })

    const res = await GET(req({ von: '2026-01', bis: '2026-01', granularitaet: 'monat' }))
    const body = await res.json()

    expect(body.positionen[0].values['2026-01']).toBe(0)
    expect(body.positionen[0].kategorien[0].produkte_manuelle_sendungen).toHaveLength(0)
  })

  it('does not apply manuelle sendungen when MS-Kategorie is not assigned to any position', async () => {
    setupMocks({
      positions:    [{ id: POS_ID, name: 'Sonstiges', type: 'position', sort_order: 0 }],
      rpKategorien: [{ report_position_id: POS_ID, kpi_category_id: KAT_KOSTEN_ID }],
      kpiCats: [
        { id: KAT_KOSTEN_ID, name: 'Logistik',              type: 'ausgaben_kosten', level: 1, parent_id: null, sort_order: 0, sales_plattform_enabled: false, produkt_enabled: false },
        { id: KAT_MS_ID,     name: 'Ersatzteile / Kulanz',  type: 'ausgaben_kosten', level: 1, parent_id: null, sort_order: 1, sales_plattform_enabled: false, produkt_enabled: false },
      ],
      produkte: [{ id: PRODUKT_ID, name: 'Baby-Mütze' }],
      bestandTran: [{
        datum: '2026-01-10',
        produkt_id: PRODUKT_ID,
        sendungen_manuell: 5,
        bestand_sendungen: [],
      }],
      produktkosten: [{
        produkt_id: PRODUKT_ID,
        gueltig_von: '2026-01-01',
        gueltig_bis: null,
        produktkosten_werte: [{ kategorie_id: GRP_WARE_ID, wert: 10 }],
      }],
    })

    const res = await GET(req({ von: '2026-01', bis: '2026-01', granularitaet: 'monat' }))
    const body = await res.json()

    // KAT_MS_ID not assigned → keine manuelle Sendungen in Position
    expect(body.positionen[0].values['2026-01']).toBe(0)
  })

  it('adds direct ausgaben bookings and manuelle sendungen calculation together', async () => {
    setupMocks({
      positions:    [{ id: POS_ID, name: 'Vertriebskosten', type: 'position', sort_order: 0 }],
      rpKategorien: [{ report_position_id: POS_ID, kpi_category_id: KAT_MS_ID }],
      kpiCats: [{ id: KAT_MS_ID, name: 'Ersatzteile / Kulanz', type: 'ausgaben_kosten', level: 1, parent_id: null, sort_order: 0, sales_plattform_enabled: false, produkt_enabled: false }],
      produkte: [{ id: PRODUKT_ID, name: 'Baby-Mütze' }],
      ausgaben: [{
        leistungsdatum: '2026-01-05', betrag_netto: 150,
        kategorie_id: KAT_MS_ID, gruppe_id: null, untergruppe_id: null,
        sales_plattform_id: null, produkt_id: null,
      }],
      bestandTran: [{
        datum: '2026-01-10',
        produkt_id: PRODUKT_ID,
        sendungen_manuell: 3,
        bestand_sendungen: [],
      }],
      produktkosten: [{
        produkt_id: PRODUKT_ID,
        gueltig_von: '2026-01-01',
        gueltig_bis: null,
        produktkosten_werte: [{ kategorie_id: GRP_WARE_ID, wert: 25 }],
      }],
    })

    const res = await GET(req({ von: '2026-01', bis: '2026-01', granularitaet: 'monat' }))
    const body = await res.json()

    // -150 (direct) + -(3 × 25) = -150 + -75 = -225
    expect(body.positionen[0].values['2026-01']).toBe(-225)
  })

  it('handles multiple products with different sendungen_manuell amounts', async () => {
    setupMocks({
      positions:    [{ id: POS_ID, name: 'Vertriebskosten', type: 'position', sort_order: 0 }],
      rpKategorien: [{ report_position_id: POS_ID, kpi_category_id: KAT_MS_ID }],
      kpiCats: [{ id: KAT_MS_ID, name: 'Ersatzteile / Kulanz', type: 'ausgaben_kosten', level: 1, parent_id: null, sort_order: 0, sales_plattform_enabled: false, produkt_enabled: false }],
      produkte: [
        { id: PRODUKT_ID,  name: 'Baby-Mütze' },
        { id: PRODUKT3_ID, name: 'Sommer-Mütze' },
      ],
      bestandTran: [
        { datum: '2026-01-10', produkt_id: PRODUKT_ID,  sendungen_manuell: 2, bestand_sendungen: [] },
        { datum: '2026-01-15', produkt_id: PRODUKT3_ID, sendungen_manuell: 5, bestand_sendungen: [] },
      ],
      produktkosten: [
        {
          produkt_id: PRODUKT_ID,
          gueltig_von: '2026-01-01', gueltig_bis: null,
          produktkosten_werte: [{ kategorie_id: GRP_WARE_ID, wert: 10 }],
        },
        {
          produkt_id: PRODUKT3_ID,
          gueltig_von: '2026-01-01', gueltig_bis: null,
          produktkosten_werte: [{ kategorie_id: GRP_WARE_ID, wert: 20 }],
        },
      ],
    })

    const res = await GET(req({ von: '2026-01', bis: '2026-01', granularitaet: 'monat' }))
    const body = await res.json()

    // Produkt 1: 2 × 10 = 20, Produkt 2: 5 × 20 = 100 → gesamt -120
    expect(body.positionen[0].values['2026-01']).toBe(-120)

    const msProdukte = body.positionen[0].kategorien[0].produkte_manuelle_sendungen
    expect(msProdukte).toHaveLength(2)
    const p1 = msProdukte.find((p: { id: string }) => p.id === PRODUKT_ID)
    const p2 = msProdukte.find((p: { id: string }) => p.id === PRODUKT3_ID)
    expect(p1.values['2026-01']).toBe(-20)
    expect(p2.values['2026-01']).toBe(-100)
  })

  // ── PROJ-20: Produktinvestitionen-Raten ─────────────────────────────────────

  it('spreads a Produktinvestitionen transaction over 12 monthly rates', async () => {
    setupMocks({
      positions:    [{ id: POS_ID, name: 'Investitionen', type: 'position', sort_order: 0 }],
      rpKategorien: [{ report_position_id: POS_ID, kpi_category_id: KAT_PI_ID }],
      kpiCats: [{ id: KAT_PI_ID, name: 'Produktinvestitionen', type: 'ausgaben_kosten', level: 1, parent_id: null, sort_order: 0, sales_plattform_enabled: false, produkt_enabled: false }],
      piRows: [{
        leistungsdatum: '2026-01-15',
        betrag_netto: 1200,
        kategorie_id: KAT_PI_ID,
        gruppe_id: null,
        untergruppe_id: null,
      }],
    })

    const res = await GET(req({ von: '2026-01', bis: '2026-12', granularitaet: 'monat' }))
    expect(res.status).toBe(200)
    const body = await res.json()

    const pos = body.positionen[0]
    // 1200 / 12 = 100 € pro Monat, alle 12 Monate im Zeitraum → je -100
    expect(pos.values['2026-01']).toBe(-100)
    expect(pos.values['2026-06']).toBe(-100)
    expect(pos.values['2026-12']).toBe(-100)
    // Summe aller Monate = -1200
    const total = Object.values(pos.values as Record<string, number>).reduce((s, v) => s + v, 0)
    expect(Math.round(total * 100) / 100).toBe(-1200)
  })

  it('only includes PI rates whose rateDatum falls within the period', async () => {
    setupMocks({
      positions:    [{ id: POS_ID, name: 'Investitionen', type: 'position', sort_order: 0 }],
      rpKategorien: [{ report_position_id: POS_ID, kpi_category_id: KAT_PI_ID }],
      kpiCats: [{ id: KAT_PI_ID, name: 'Produktinvestitionen', type: 'ausgaben_kosten', level: 1, parent_id: null, sort_order: 0, sales_plattform_enabled: false, produkt_enabled: false }],
      piRows: [{
        leistungsdatum: '2025-07-01',  // Rate 1 = Jul 2025, Rate 7 = Jan 2026, Rate 12 = Jun 2026
        betrag_netto: 600,
        kategorie_id: KAT_PI_ID,
        gruppe_id: null,
        untergruppe_id: null,
      }],
    })

    // Zeitraum Jan–Jun 2026 → nur Raten 7–12 (6 Raten à 50 €)
    const res = await GET(req({ von: '2026-01', bis: '2026-06', granularitaet: 'monat' }))
    const body = await res.json()

    const pos = body.positionen[0]
    // 600 / 12 = 50 € pro Rate → Raten im Zeitraum: Jan–Jun 2026
    expect(pos.values['2026-01']).toBe(-50)
    expect(pos.values['2026-06']).toBe(-50)
    const total = Object.values(pos.values as Record<string, number>).reduce((s, v) => s + v, 0)
    expect(Math.round(total * 100) / 100).toBe(-300)
  })

  it('does not double-count PI transactions that fall within the ausgaben date range', async () => {
    setupMocks({
      positions:    [{ id: POS_ID, name: 'Investitionen', type: 'position', sort_order: 0 }],
      rpKategorien: [{ report_position_id: POS_ID, kpi_category_id: KAT_PI_ID }],
      kpiCats: [{ id: KAT_PI_ID, name: 'Produktinvestitionen', type: 'ausgaben_kosten', level: 1, parent_id: null, sort_order: 0, sales_plattform_enabled: false, produkt_enabled: false }],
      // ausgaben enthält dieselbe PI-Transaktion — sie muss ignoriert werden (Skip-Logik)
      ausgaben: [{
        leistungsdatum: '2026-01-15', betrag_netto: 1200,
        kategorie_id: KAT_PI_ID, gruppe_id: null, untergruppe_id: null,
        sales_plattform_id: null, produkt_id: null,
      }],
      piRows: [{
        leistungsdatum: '2026-01-15',
        betrag_netto: 1200,
        kategorie_id: KAT_PI_ID,
        gruppe_id: null,
        untergruppe_id: null,
      }],
    })

    const res = await GET(req({ von: '2026-01', bis: '2026-01', granularitaet: 'monat' }))
    const body = await res.json()

    // Nur die Rate für Jan: 1200/12 = 100 — NICHT der volle Betrag 1200
    expect(body.positionen[0].values['2026-01']).toBe(-100)
  })

  it('ignores PI transactions with betrag_netto = 0', async () => {
    setupMocks({
      positions:    [{ id: POS_ID, name: 'Investitionen', type: 'position', sort_order: 0 }],
      rpKategorien: [{ report_position_id: POS_ID, kpi_category_id: KAT_PI_ID }],
      kpiCats: [{ id: KAT_PI_ID, name: 'Produktinvestitionen', type: 'ausgaben_kosten', level: 1, parent_id: null, sort_order: 0, sales_plattform_enabled: false, produkt_enabled: false }],
      piRows: [{
        leistungsdatum: '2026-01-01',
        betrag_netto: 0,
        kategorie_id: KAT_PI_ID,
        gruppe_id: null,
        untergruppe_id: null,
      }],
    })

    const res = await GET(req({ von: '2026-01', bis: '2026-01', granularitaet: 'monat' }))
    const body = await res.json()

    expect(body.positionen[0].values['2026-01']).toBe(0)
  })

  // ── PROJ-20: Umsatzsteuer-Berechnung ────────────────────────────────────────

  it('calculates umsatzsteuer as netbase × ust_satz and negates it', async () => {
    setupMocks({
      positions: [{ id: UST_POS_ID, name: 'Umsatzsteuer', type: 'umsatzsteuer', sort_order: 0 }],
      produkte: [{ id: PRODUKT_ID, name: 'Baby-Mütze', ust_satz: 19 }],
      umsatz: [
        { leistungsdatum: '2026-01-10', betrag: 1000, kategorie_id: KAT_UMSATZ_ID, gruppe_id: null, untergruppe_id: null, sales_plattform_id: null, produkt_id: PRODUKT_ID },
      ],
      kpiCats: [{ id: KAT_UMSATZ_ID, name: 'Online', type: 'umsatz', level: 1, parent_id: null, sort_order: 0, sales_plattform_enabled: false, produkt_enabled: false, ist_abzugsposten: false }],
    })

    const res = await GET(req({ von: '2026-01', bis: '2026-01', granularitaet: 'monat' }))
    expect(res.status).toBe(200)
    const body = await res.json()

    // 1000 × 19/119 = 159.66, negiert
    expect(body.positionen[0].values['2026-01']).toBe(-159.66)
  })

  it('subtracts abzugsposten from netbase before applying ust_satz', async () => {
    const KAT_RABATT_ID = 'bbbbbbbb-0000-0000-0000-000000000099'
    setupMocks({
      positions: [{ id: UST_POS_ID, name: 'Umsatzsteuer', type: 'umsatzsteuer', sort_order: 0 }],
      rpKategorien: [{ report_position_id: UST_POS_ID, kpi_category_id: KAT_UMSATZ_ID }],
      produkte: [{ id: PRODUKT_ID, name: 'Baby-Mütze', ust_satz: 19 }],
      umsatz: [
        { leistungsdatum: '2026-01-10', betrag: 1000, kategorie_id: KAT_UMSATZ_ID, gruppe_id: null, untergruppe_id: null, sales_plattform_id: null, produkt_id: PRODUKT_ID },
        { leistungsdatum: '2026-01-15', betrag: 200,  kategorie_id: KAT_RABATT_ID, gruppe_id: null, untergruppe_id: null, sales_plattform_id: null, produkt_id: PRODUKT_ID },
      ],
      kpiCats: [
        { id: KAT_UMSATZ_ID, name: 'Online',  type: 'umsatz', level: 1, parent_id: null, sort_order: 0, sales_plattform_enabled: false, produkt_enabled: false, ist_abzugsposten: false },
        { id: KAT_RABATT_ID, name: 'Rabatte', type: 'umsatz', level: 1, parent_id: null, sort_order: 1, sales_plattform_enabled: false, produkt_enabled: false, ist_abzugsposten: true },
      ],
    })

    const res = await GET(req({ von: '2026-01', bis: '2026-01', granularitaet: 'monat' }))
    const body = await res.json()

    // netBase = 1000 - 200 = 800 → USt = 800 × 19/119 = 127.73, negiert
    expect(body.positionen[0].values['2026-01']).toBe(-127.73)
  })

  it('returns ust_produkte array with per-product ust values', async () => {
    setupMocks({
      positions: [{ id: UST_POS_ID, name: 'Umsatzsteuer', type: 'umsatzsteuer', sort_order: 0 }],
      produkte: [{ id: PRODUKT_ID, name: 'Baby-Mütze', ust_satz: 19 }],
      umsatz: [
        { leistungsdatum: '2026-01-10', betrag: 500, kategorie_id: KAT_UMSATZ_ID, gruppe_id: null, untergruppe_id: null, sales_plattform_id: null, produkt_id: PRODUKT_ID },
      ],
      kpiCats: [{ id: KAT_UMSATZ_ID, name: 'Online', type: 'umsatz', level: 1, parent_id: null, sort_order: 0, sales_plattform_enabled: false, produkt_enabled: false, ist_abzugsposten: false }],
    })

    const res = await GET(req({ von: '2026-01', bis: '2026-01', granularitaet: 'monat' }))
    const body = await res.json()

    const pos = body.positionen[0]
    expect(pos.ust_produkte).toHaveLength(1)
    expect(pos.ust_produkte[0].id).toBe(PRODUKT_ID)
    expect(pos.ust_produkte[0].name).toBe('Baby-Mütze')
    expect(pos.ust_produkte[0].ust_satz).toBe(19)
    expect(pos.ust_produkte[0].values['2026-01']).toBe(-79.83)  // 500 × 19/119 = 79.83
  })

  it('aggregates ust across multiple products with different rates', async () => {
    setupMocks({
      positions: [{ id: UST_POS_ID, name: 'Umsatzsteuer', type: 'umsatzsteuer', sort_order: 0 }],
      produkte: [
        { id: PRODUKT_ID,  name: 'Baby-Mütze',    ust_satz: 19 },
        { id: PRODUKT2_ID, name: 'Winter-Jacket',  ust_satz: 7  },
      ],
      umsatz: [
        { leistungsdatum: '2026-01-10', betrag: 1000, kategorie_id: KAT_UMSATZ_ID, gruppe_id: null, untergruppe_id: null, sales_plattform_id: null, produkt_id: PRODUKT_ID },
        { leistungsdatum: '2026-01-15', betrag: 2000, kategorie_id: KAT_UMSATZ_ID, gruppe_id: null, untergruppe_id: null, sales_plattform_id: null, produkt_id: PRODUKT2_ID },
      ],
      kpiCats: [{ id: KAT_UMSATZ_ID, name: 'Online', type: 'umsatz', level: 1, parent_id: null, sort_order: 0, sales_plattform_enabled: false, produkt_enabled: false, ist_abzugsposten: false }],
    })

    const res = await GET(req({ von: '2026-01', bis: '2026-01', granularitaet: 'monat' }))
    const body = await res.json()

    // Produkt 1: 1000 × 19/119 = 159.66; Produkt 2: 2000 × 7/107 = 130.84 → gesamt -290.50
    expect(body.positionen[0].values['2026-01']).toBe(-290.50)
    expect(body.positionen[0].ust_produkte).toHaveLength(2)
  })

  it('ignores transactions without produkt_id for ust calculation', async () => {
    setupMocks({
      positions: [{ id: UST_POS_ID, name: 'Umsatzsteuer', type: 'umsatzsteuer', sort_order: 0 }],
      produkte: [{ id: PRODUKT_ID, name: 'Baby-Mütze', ust_satz: 19 }],
      umsatz: [
        { leistungsdatum: '2026-01-10', betrag: 1000, kategorie_id: KAT_UMSATZ_ID, gruppe_id: null, untergruppe_id: null, sales_plattform_id: null, produkt_id: null },
      ],
      kpiCats: [{ id: KAT_UMSATZ_ID, name: 'Online', type: 'umsatz', level: 1, parent_id: null, sort_order: 0, sales_plattform_enabled: false, produkt_enabled: false, ist_abzugsposten: false }],
    })

    const res = await GET(req({ von: '2026-01', bis: '2026-01', granularitaet: 'monat' }))
    const body = await res.json()

    expect(body.positionen[0].values['2026-01']).toBe(0)
    expect(body.positionen[0].ust_produkte).toHaveLength(0)
  })

  it('contributes 0 ust when product has no ust_satz', async () => {
    setupMocks({
      positions: [{ id: UST_POS_ID, name: 'Umsatzsteuer', type: 'umsatzsteuer', sort_order: 0 }],
      produkte: [{ id: PRODUKT_ID, name: 'Baby-Mütze', ust_satz: null }],
      umsatz: [
        { leistungsdatum: '2026-01-10', betrag: 1000, kategorie_id: KAT_UMSATZ_ID, gruppe_id: null, untergruppe_id: null, sales_plattform_id: null, produkt_id: PRODUKT_ID },
      ],
      kpiCats: [{ id: KAT_UMSATZ_ID, name: 'Online', type: 'umsatz', level: 1, parent_id: null, sort_order: 0, sales_plattform_enabled: false, produkt_enabled: false, ist_abzugsposten: false }],
    })

    const res = await GET(req({ von: '2026-01', bis: '2026-01', granularitaet: 'monat' }))
    const body = await res.json()

    expect(body.positionen[0].values['2026-01']).toBe(0)
    expect(body.positionen[0].ust_produkte).toHaveLength(0)
  })

  it('aggregates ust into quarters correctly', async () => {
    setupMocks({
      positions: [{ id: UST_POS_ID, name: 'Umsatzsteuer', type: 'umsatzsteuer', sort_order: 0 }],
      produkte: [{ id: PRODUKT_ID, name: 'Baby-Mütze', ust_satz: 19 }],
      umsatz: [
        { leistungsdatum: '2026-01-10', betrag: 1000, kategorie_id: KAT_UMSATZ_ID, gruppe_id: null, untergruppe_id: null, sales_plattform_id: null, produkt_id: PRODUKT_ID },
        { leistungsdatum: '2026-02-10', betrag: 1000, kategorie_id: KAT_UMSATZ_ID, gruppe_id: null, untergruppe_id: null, sales_plattform_id: null, produkt_id: PRODUKT_ID },
        { leistungsdatum: '2026-03-10', betrag: 1000, kategorie_id: KAT_UMSATZ_ID, gruppe_id: null, untergruppe_id: null, sales_plattform_id: null, produkt_id: PRODUKT_ID },
      ],
      kpiCats: [{ id: KAT_UMSATZ_ID, name: 'Online', type: 'umsatz', level: 1, parent_id: null, sort_order: 0, sales_plattform_enabled: false, produkt_enabled: false, ist_abzugsposten: false }],
    })

    const res = await GET(req({ von: '2026-01', bis: '2026-03', granularitaet: 'quartal' }))
    const body = await res.json()

    // 3 × 1000 × 19/119 = 478.99, negiert
    expect(body.positionen[0].values['2026-Q1']).toBe(-478.99)
  })

  it('umsatzsteuer position can be referenced by a summe position', async () => {
    setupMocks({
      positions: [
        { id: POS_ID,     name: 'Bruttoumsatz',  type: 'position',     sort_order: 0 },
        { id: UST_POS_ID, name: 'Umsatzsteuer',  type: 'umsatzsteuer', sort_order: 1 },
        { id: SUMME_ID,   name: 'Nettoumsatz',   type: 'summe',        sort_order: 2 },
      ],
      rpKategorien: [{ report_position_id: POS_ID, kpi_category_id: KAT_UMSATZ_ID }],
      rpSummen: [
        { report_position_id: SUMME_ID, referenced_position_id: POS_ID },
        { report_position_id: SUMME_ID, referenced_position_id: UST_POS_ID },
      ],
      produkte: [{ id: PRODUKT_ID, name: 'Baby-Mütze', ust_satz: 19 }],
      umsatz: [
        { leistungsdatum: '2026-01-10', betrag: 1000, kategorie_id: KAT_UMSATZ_ID, gruppe_id: null, untergruppe_id: null, sales_plattform_id: null, produkt_id: PRODUKT_ID },
      ],
      kpiCats: [{ id: KAT_UMSATZ_ID, name: 'Online', type: 'umsatz', level: 1, parent_id: null, sort_order: 0, sales_plattform_enabled: false, produkt_enabled: false, ist_abzugsposten: false }],
    })

    const res = await GET(req({ von: '2026-01', bis: '2026-01', granularitaet: 'monat' }))
    const body = await res.json()

    const summe = body.positionen.find((p: { id: string }) => p.id === SUMME_ID)
    // 1000 (brutto) + (-159.66) (USt) = 840.34
    expect(summe.values['2026-01']).toBe(840.34)
  })

  it('does not add bestand costs when the Produkt category is not assigned to any position', async () => {
    // Position uses a different category, not KAT_PRODUKT_ID
    setupMocks({
      positions:    [{ id: POS_ID, name: 'Sonstiges', type: 'position', sort_order: 0 }],
      rpKategorien: [{ report_position_id: POS_ID, kpi_category_id: KAT_KOSTEN_ID }],
      kpiCats: [
        { id: KAT_KOSTEN_ID,   name: 'Logistik', type: 'ausgaben_kosten', level: 1, parent_id: null, sort_order: 0, sales_plattform_enabled: false, produkt_enabled: false },
        { id: KAT_PRODUKT_ID,  name: 'Produkt',  type: 'ausgaben_kosten', level: 1, parent_id: null, sort_order: 1, sales_plattform_enabled: false, produkt_enabled: false },
      ],
      produkte: [{ id: PRODUKT_ID, name: 'Baby-Mütze' }],
      bestandTran: [{
        datum: '2026-01-10',
        produkt_id: PRODUKT_ID,
        bestand_sendungen: [{ menge: 5, plattform_id: PLT_AMAZON_ID }],
      }],
      produktkosten: [{
        produkt_id: PRODUKT_ID,
        gueltig_von: '2026-01-01',
        gueltig_bis: null,
        produktkosten_werte: [{ wert: 10 }],
      }],
      plattformen: [{ id: PLT_AMAZON_ID, name: 'Amazon' }],
    })

    const res = await GET(req({ von: '2026-01', bis: '2026-01', granularitaet: 'monat' }))
    const body = await res.json()

    // KAT_PRODUKT_ID not in assigned cats → bestand costs not added
    expect(body.positionen[0].values['2026-01']).toBe(0)
  })
})
