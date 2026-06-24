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

const EINFUHR_KAT_ID = '11111111-1111-1111-8111-111111111111'
const UST_KAT_ID = '22222222-2222-2222-8222-222222222222'
const STEUERN_ROOT_ID = '33333333-3333-3333-8333-333333333333'
const BESTELLUNG_ID = '44444444-4444-4444-8444-444444444444'
const PRODUKT_ID = '55555555-5555-5555-8555-555555555555'
const KAT_OPERATIVE = '66666666-6666-6666-8666-666666666666'
const WARE_KAT_ID = '77777777-7777-7777-8777-777777777777'
const SHIPPING_KAT_ID = '88888888-8888-8888-8888-888888888888'
const ZOLL_KAT_ID = '99999999-9999-9999-8999-999999999999'

// KPI categories: Steuern subtree + Ware/Shipping/Zoll for Einfuhrumsatzsteuer base (ausgaben_kosten only)
const DEFAULT_KPI_CATS = [
  { id: STEUERN_ROOT_ID, name: 'Steuern', parent_id: null },
  { id: EINFUHR_KAT_ID, name: 'Einfuhrumsatzsteuer', parent_id: STEUERN_ROOT_ID },
  { id: UST_KAT_ID, name: 'Umsatzsteuer', parent_id: STEUERN_ROOT_ID },
  { id: WARE_KAT_ID, name: 'Ware', parent_id: null },
  { id: SHIPPING_KAT_ID, name: 'Shipping', parent_id: null },
  { id: ZOLL_KAT_ID, name: 'Zoll', parent_id: null },
]

// Note: buildGet prepends '?' so do NOT prefix params with '?'
const VALID_PARAMS = 'von_kw=1&von_jahr=2026&bis_kw=13&bis_jahr=2026&erste_zukunftskw=1&erste_zukunftsjahr=2026'

beforeEach(() => {
  vi.clearAllMocks()
  mockFrom.mockReset()
})

function buildGet(query = '') {
  return new Request(`http://localhost/api/steuerausgaben-planung/berechnet${query ? '?' + query : ''}`)
}

// Returns a fully chainable Supabase query mock.
// Terminal operations (.single(), .limit()) return the provided result.
function makeChain(result: { data: unknown; error: null | { message: string }; status?: number }) {
  const chain: Record<string, (...args: unknown[]) => unknown> = {}
  const chainMethods = ['select', 'eq', 'in', 'not', 'gte', 'lte', 'lt', 'gt', 'or', 'filter', 'delete', 'upsert', 'insert', 'is']
  for (const m of chainMethods) {
    chain[m] = () => chain
  }
  chain['single'] = () => result
  chain['maybeSingle'] = () => result
  chain['limit'] = () => result
  return chain
}

// Sets up all 31 parallel DB mocks + 2 persistence mocks in call order.
function setupMocks(options: {
  ustEinst?: unknown
  ustSaetze?: unknown
  bestellungen?: unknown
  bestellKosten?: unknown
  bestellProdukte?: unknown
  fiskal?: unknown
  einnahmen?: unknown
  umsatzausgaben?: unknown
  operative?: unknown
  produktinvest?: unknown
  finanzierungs?: unknown
  kpiCats?: unknown
  absatzPlanung?: unknown
  vkGebEinst?: unknown
  salesPlattPlanung?: unknown
  ustL1Ebene?: unknown
  produktKats?: unknown
  einnahmenL1Kats?: unknown
  operFixkosten?: unknown
  finEinst?: unknown
  versandPlatt?: unknown
  lagerPlatt?: unknown
  retourenEinst?: unknown
  kulanzPlatt?: unknown
  // B1 Retouren + Marketing
  retourenEinstDetail?: unknown
  retourenAllgemeinProd?: unknown
  umsatzKats?: unknown
  umsatzTrans?: unknown
  marketingPlan?: unknown
  auszahlungsMkt?: unknown
  mktKatPlatt?: unknown
  steuerManuell?: unknown
  kostenGlobal?: unknown
  wareBestelldatum?: unknown
  einnahmenActual?: unknown
  umsatzActual?: unknown
  ausgabenUst?: unknown
  einfuhrActual?: unknown
}) {
  const empty = { data: [], error: null }
  mockFrom.mockReturnValueOnce(makeChain({ data: options.ustEinst ?? null, error: null })) // ust_einstellungen
  mockFrom.mockReturnValueOnce(makeChain({ data: options.ustSaetze ?? [], error: null })) // ust_kategorie_saetze
  mockFrom.mockReturnValueOnce(makeChain({ data: options.bestellungen ?? [], error: null })) // bestellungen
  mockFrom.mockReturnValueOnce(makeChain({ data: options.bestellKosten ?? [], error: null })) // bestellungen_kosten
  mockFrom.mockReturnValueOnce(makeChain({ data: options.bestellProdukte ?? [], error: null })) // bestellungen_produkte
  mockFrom.mockReturnValueOnce(makeChain({ data: options.fiskal ?? [], error: null })) // einfuhrust_fiskalverzollung
  mockFrom.mockReturnValueOnce(makeChain({ data: options.einnahmen ?? [], error: null })) // einnahmen_planung
  mockFrom.mockReturnValueOnce(makeChain({ data: options.umsatzausgaben ?? [], error: null })) // umsatzausgaben_planung
  mockFrom.mockReturnValueOnce(makeChain({ data: options.operative ?? [], error: null })) // operative_planung
  mockFrom.mockReturnValueOnce(makeChain({ data: options.produktinvest ?? [], error: null })) // produktinvestitions_planung
  mockFrom.mockReturnValueOnce(makeChain({ data: options.finanzierungs ?? [], error: null })) // finanzierungs_planung
  mockFrom.mockReturnValueOnce(makeChain({ data: options.kpiCats ?? DEFAULT_KPI_CATS, error: null })) // kpi_categories (ausgaben_kosten)
  mockFrom.mockReturnValueOnce(makeChain({ data: options.absatzPlanung ?? [], error: null })) // absatz_planung
  mockFrom.mockReturnValueOnce(makeChain({ data: options.vkGebEinst ?? [], error: null })) // verkaufsgebuehr_einstellungen
  mockFrom.mockReturnValueOnce(makeChain({ data: options.salesPlattPlanung ?? [], error: null })) // sales_plattform_planung
  mockFrom.mockReturnValueOnce(makeChain({ data: options.ustL1Ebene ?? [], error: null })) // ust_l1_ebene_auswahl
  mockFrom.mockReturnValueOnce(makeChain({ data: options.produktKats ?? [], error: null })) // kpi_categories (produkte)
  mockFrom.mockReturnValueOnce(makeChain({ data: options.einnahmenL1Kats ?? [], error: null })) // kpi_categories (einnahmen)
  mockFrom.mockReturnValueOnce(makeChain({ data: options.operFixkosten ?? [], error: null })) // operative_fixkosten_einstellungen
  mockFrom.mockReturnValueOnce(makeChain({ data: options.finEinst ?? [], error: null })) // finanzierungs_einstellungen
  mockFrom.mockReturnValueOnce(makeChain({ data: options.versandPlatt ?? [], error: null })) // versandausgaben_plattform_einstellungen
  mockFrom.mockReturnValueOnce(makeChain({ data: options.lagerPlatt ?? [], error: null })) // lagerausgaben_plattform_einstellungen
  mockFrom.mockReturnValueOnce(makeChain({ data: options.retourenEinst ?? [], error: null })) // retouren_allgemein_einstellungen
  mockFrom.mockReturnValueOnce(makeChain({ data: options.kulanzPlatt ?? [], error: null })) // ersatzteile_kulanz_plattform_einstellungen
  mockFrom.mockReturnValueOnce(makeChain({ data: options.retourenEinstDetail ?? [], error: null })) // retouren_einstellungen
  mockFrom.mockReturnValueOnce(makeChain({ data: options.retourenAllgemeinProd ?? [], error: null })) // retouren_allgemein_produkt_einstellungen
  mockFrom.mockReturnValueOnce(makeChain({ data: options.umsatzKats ?? [], error: null })) // kpi_categories (umsatz)
  mockFrom.mockReturnValueOnce(makeChain({ data: options.umsatzTrans ?? [], error: null })) // umsatz_transaktionen
  mockFrom.mockReturnValueOnce(makeChain({ data: options.marketingPlan ?? [], error: null })) // marketing_planung
  mockFrom.mockReturnValueOnce(makeChain({ data: options.auszahlungsMkt ?? [], error: null })) // auszahlungs_marketing_gruppen
  mockFrom.mockReturnValueOnce(makeChain({ data: options.mktKatPlatt ?? [], error: null })) // marketing_kategorie_einstellungen
  mockFrom.mockReturnValueOnce(makeChain({ data: options.steuerManuell ?? [], error: null })) // steuerausgaben_planung (manuell, B6)
  mockFrom.mockReturnValueOnce(makeChain({ data: options.kostenGlobal ?? null, error: null })) // produktinformationen_kosten_global (maybeSingle)
  mockFrom.mockReturnValueOnce(makeChain({ data: options.wareBestelldatum ?? [], error: null })) // bestellungen (by bestelldatum, for B2 Ware)
  // Historical actual transactions (always called when erste_zukunftskw is provided, i.e. hatZukunftsgrenze=true)
  mockFrom.mockReturnValueOnce(makeChain({ data: options.einnahmenActual ?? [], error: null })) // einnahmen_transaktionen
  mockFrom.mockReturnValueOnce(makeChain({ data: options.umsatzActual ?? [], error: null })) // umsatz_transaktionen
  mockFrom.mockReturnValueOnce(makeChain({ data: options.ausgabenUst ?? [], error: null })) // ausgaben_kosten_transaktionen (ust_betrag, B1–B5)
  mockFrom.mockReturnValueOnce(makeChain({ data: options.einfuhrActual ?? [], error: null })) // ausgaben_kosten_transaktionen (betrag_brutto, B6 Ist-Tatsächlich)
  // Persistence: read existing + delete stale + optional upsert (only called when toUpsert.length > 0)
  mockFrom.mockReturnValueOnce(makeChain(empty)) // existing steuerausgaben_planung
  mockFrom.mockReturnValueOnce(makeChain(empty)) // delete stale auto rows
  mockFrom.mockReturnValueOnce(makeChain(empty)) // upsert fresh auto rows (if any)
}

const DEFAULT_UST_EINST = {
  einfuhrust_satz: 0,
  einfuhrust_zahlungsziel_tage: 0,
  zahlungsfrequenz: 'monatlich',
  zahlungsverschiebung_tage: 0,
}

describe('GET /api/steuerausgaben-planung/berechnet', () => {
  it('returns 400 when query params are missing', async () => {
    const res = await GET(buildGet())
    expect(res.status).toBe(400)
  })

  it('returns 401 when unauthenticated', async () => {
    const { requireAuth } = await import('@/lib/supabase-server')
    vi.mocked(requireAuth).mockResolvedValueOnce({
      user: null, supabase: null as never,
      error: new Response('Unauthorized', { status: 401 }),
    })
    const res = await GET(buildGet(VALID_PARAMS))
    expect(res.status).toBe(401)
  })

  it('returns 200 with empty data when ust_einstellungen not found', async () => {
    setupMocks({ ustEinst: null })

    const res = await GET(buildGet(VALID_PARAMS))
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.data).toEqual([])
  })

  it('returns 200 with empty data when no Steuern categories in KPI model', async () => {
    setupMocks({ ustEinst: DEFAULT_UST_EINST, kpiCats: [] }) // no categories → IDs not found

    const res = await GET(buildGet(VALID_PARAMS))
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.data).toEqual([])
  })

  it('calculates Einfuhrumsatzsteuer from a non-fiskalverzollt order', async () => {
    // ankunftsdatum 2026-01-05 + 7 zahlungsziel → 2026-01-12 → KW3 2026
    setupMocks({
      ustEinst: {
        einfuhrust_satz: 19,
        einfuhrust_zahlungsziel_tage: 7,
        zahlungsfrequenz: 'monatlich',
        zahlungsverschiebung_tage: 0,
      },
      bestellungen: [{ id: BESTELLUNG_ID, status: 'plan', ankunftsdatum: '2026-01-05', ankunftsdatum_ist: null }],
      bestellKosten: [{ bestellung_id: BESTELLUNG_ID, kpi_kategorie_id: WARE_KAT_ID, nettobetrag: 1000 }],
      bestellProdukte: [{ bestellung_id: BESTELLUNG_ID, produkt_id: PRODUKT_ID }],
      fiskal: [],
    })

    const res = await GET(buildGet(VALID_PARAMS))
    expect(res.status).toBe(200)
    const body = await res.json()

    // 1000 × 19% = 190
    const eintrag = body.data.find((r: { kategorie_id: string }) => r.kategorie_id === EINFUHR_KAT_ID)
    expect(eintrag).toBeDefined()
    expect(eintrag.wert).toBeCloseTo(190, 1)
    // KW3 2026 (2026-01-12 falls in KW3)
    expect(eintrag.kw_year).toBe(2026)
    expect(eintrag.kw_number).toBe(3)
  })

  it('skips fiskalverzollt orders for Einfuhrumsatzsteuer', async () => {
    setupMocks({
      ustEinst: {
        einfuhrust_satz: 19,
        einfuhrust_zahlungsziel_tage: 7,
        zahlungsfrequenz: 'monatlich',
        zahlungsverschiebung_tage: 0,
      },
      bestellungen: [{ id: BESTELLUNG_ID, status: 'plan', ankunftsdatum: '2026-01-05', ankunftsdatum_ist: null }],
      bestellKosten: [{ bestellung_id: BESTELLUNG_ID, kpi_kategorie_id: WARE_KAT_ID, nettobetrag: 1000 }],
      bestellProdukte: [{ bestellung_id: BESTELLUNG_ID, produkt_id: PRODUKT_ID }],
      fiskal: [{ produkt_id: PRODUKT_ID, fiskalverzollung: true }],
    })

    const res = await GET(buildGet(VALID_PARAMS))
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.data).toEqual([])
  })

  it('uses ankunftsdatum_ist when available', async () => {
    // ankunftsdatum_ist = 2026-01-12 + 7 → 2026-01-19 → KW4
    setupMocks({
      ustEinst: {
        einfuhrust_satz: 10,
        einfuhrust_zahlungsziel_tage: 7,
        zahlungsfrequenz: 'monatlich',
        zahlungsverschiebung_tage: 0,
      },
      bestellungen: [{ id: BESTELLUNG_ID, status: 'laufend', ankunftsdatum: '2026-01-05', ankunftsdatum_ist: '2026-01-12' }],
      bestellKosten: [{ bestellung_id: BESTELLUNG_ID, kpi_kategorie_id: SHIPPING_KAT_ID, nettobetrag: 500 }],
      bestellProdukte: [],
      fiskal: [],
    })

    const res = await GET(buildGet(VALID_PARAMS))
    const body = await res.json()

    // 500 × 10% = 50, payment = 2026-01-19 (KW4)
    const eintrag = body.data.find((r: { kategorie_id: string }) => r.kategorie_id === EINFUHR_KAT_ID)
    expect(eintrag).toBeDefined()
    expect(eintrag.wert).toBeCloseTo(50, 1)
    expect(eintrag.kw_number).toBe(4)
  })

  it('calculates Vorsteuer from operative_planung and groups monthly', async () => {
    // 1190 brutto with 19% UST in KW3 (January) → Vorsteuer = extractVorsteuer(1190, 19) = 1190 × 19/119 ≈ 190
    // Monthly grouping: January → payment = first KW of February = KW5 2026
    setupMocks({
      ustEinst: {
        einfuhrust_satz: 0,
        einfuhrust_zahlungsziel_tage: 0,
        zahlungsfrequenz: 'monatlich',
        zahlungsverschiebung_tage: 0,
      },
      ustSaetze: [{ kategorie_id: KAT_OPERATIVE, ebene: 1, ust_satz: 19 }],
      operative: [{ kategorie_id: KAT_OPERATIVE, kw_year: 2026, kw_number: 3, betrag_manuell: 1190 }],
    })

    const res = await GET(buildGet(VALID_PARAMS))
    expect(res.status).toBe(200)
    const body = await res.json()

    const ustEintrag = body.data.find((r: { kategorie_id: string }) => r.kategorie_id === UST_KAT_ID)
    expect(ustEintrag).toBeDefined()
    // Vorsteuer = extractVorsteuer(1190, 19) = 1190 × 19/119 ≈ 190 (negative because it's expense)
    expect(ustEintrag.wert).toBeCloseTo(-190, 0)
  })

  it('groups UST amounts quarterly when zahlungsfrequenz = quartalsweise', async () => {
    // KW3 (Jan) and KW8 (Feb) → both in Q1 → Q1 payment = first KW of April = KW14 2026
    // Use a range that includes KW14 (April): von_kw=1 bis_kw=16
    setupMocks({
      ustEinst: {
        einfuhrust_satz: 0,
        einfuhrust_zahlungsziel_tage: 0,
        zahlungsfrequenz: 'quartalsweise',
        zahlungsverschiebung_tage: 0,
      },
      ustSaetze: [{ kategorie_id: KAT_OPERATIVE, ebene: 1, ust_satz: 19 }],
      operative: [
        { kategorie_id: KAT_OPERATIVE, kw_year: 2026, kw_number: 3, betrag_manuell: 119 },
        { kategorie_id: KAT_OPERATIVE, kw_year: 2026, kw_number: 8, betrag_manuell: 119 },
      ],
    })

    // Range includes April (KW14) so Q1 payment week is within range
    const wideParams = 'von_kw=1&von_jahr=2026&bis_kw=16&bis_jahr=2026&erste_zukunftskw=1&erste_zukunftsjahr=2026'
    const res = await GET(buildGet(wideParams))
    const body = await res.json()

    const ustEntries = body.data.filter((r: { kategorie_id: string }) => r.kategorie_id === UST_KAT_ID)
    // Both Q1 KWs grouped → one payment entry in April
    expect(ustEntries).toHaveLength(1)
    // Total Vorsteuer = -2 × extractVorsteuer(119, 19) = -2 × (119 × 19/119) = -2 × 19 = -38
    expect(ustEntries[0].wert).toBeCloseTo(-38, 0)
  })

  it('returns 200 with empty data when ust_einstellungen has any error (no config)', async () => {
    // makeChain with error result — single() and limit() both return the error object.
    // All 12 Promise.all queries fire before error is checked, so all need mocks.
    mockFrom.mockReturnValueOnce(makeChain({ data: null, error: { message: 'No rows found' } }))
    const empty = makeChain({ data: [], error: null })
    for (let i = 0; i < 33; i++) mockFrom.mockReturnValueOnce(empty) // other 33 parallel queries

    const res = await GET(buildGet(VALID_PARAMS))
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.data).toEqual([])
  })

  it('calculates A1 Zahllast from Produktverkäufe (absatz × VK → calcZahllast)', async () => {
    // SKU kw3 absatz=10, VK=119 → nettoumsatz=1190
    // UST 19% on product (Gesamt mode on parent in produkte hierarchy)
    // calcZahllast(1190, 19) = 1190 × 19/100 = 226.1
    // Monthly: KW3 is January → payment KW5 (first KW of February 2026)
    const PARENT_KAT_ID = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'
    const PRODUKT_ID2 = '55555555-5555-5555-8555-555555555555'
    const SKU_ID = 'cccccccc-cccc-cccc-cccc-cccccccccccc'
    const PLATT_ID = 'dddddddd-dddd-dddd-dddd-dddddddddddd'

    setupMocks({
      ustEinst: { einfuhrust_satz: 0, einfuhrust_zahlungsziel_tage: 0, zahlungsfrequenz: 'monatlich', zahlungsverschiebung_tage: 0 },
      ustSaetze: [{ kategorie_id: PARENT_KAT_ID, ebene: 1, ust_satz: 19 }],
      produktKats: [
        { id: PRODUKT_ID2, name: 'SamiBu', parent_id: PARENT_KAT_ID, level: 1 },
        { id: SKU_ID, name: 'SamiBu-SKU', parent_id: PRODUKT_ID2, level: 2 },
      ],
      ustL1Ebene: [{ kategorie_id: PARENT_KAT_ID, ebene: 1 }],
      einnahmenL1Kats: [{ id: PARENT_KAT_ID, name: 'Produktverkäufe', parent_id: null }],
      absatzPlanung: [
        { sku_id: SKU_ID, produkt_id: PRODUKT_ID2, sales_plattform_id: PLATT_ID, kw_year: 2026, kw_number: 3, absatz_manuell: 10, effektiver_vk_manuell: null },
        { sku_id: null, produkt_id: PRODUKT_ID2, sales_plattform_id: PLATT_ID, kw_year: 2026, kw_number: 3, absatz_manuell: null, effektiver_vk_manuell: 119 },
      ],
    })

    const wideParams = 'von_kw=1&von_jahr=2026&bis_kw=13&bis_jahr=2026&erste_zukunftskw=1&erste_zukunftsjahr=2026'
    const res = await GET(buildGet(wideParams))
    expect(res.status).toBe(200)
    const body = await res.json()

    const ustEintrag = body.data.find((r: { kategorie_id: string }) => r.kategorie_id === UST_KAT_ID)
    expect(ustEintrag).toBeDefined()
    // extractVorsteuer(1190, 19) = 1190 × 19/119 = 190 in KW5
    expect(ustEintrag.wert).toBeCloseTo(190, 0)
    expect(ustEintrag.kw_number).toBe(5) // first KW of February 2026
  })

  it('calculates A1 Zahllast using einnahmen Gesamt-Satz when product has no parent in produkte hierarchy', async () => {
    // Real-world scenario: products are root-level in produkte (parent_id=null)
    // UST rate is configured on the einnahmen "Produktverkäufe" category at Gesamt level
    const PROD_VERKAUFE_ID = 'eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee'
    const PRODUKT_ID2 = '55555555-5555-5555-8555-555555555555'
    const SKU_ID = 'cccccccc-cccc-cccc-cccc-cccccccccccc'
    const PLATT_ID = 'dddddddd-dddd-dddd-dddd-dddddddddddd'

    setupMocks({
      ustEinst: { einfuhrust_satz: 0, einfuhrust_zahlungsziel_tage: 0, zahlungsfrequenz: 'monatlich', zahlungsverschiebung_tage: 0 },
      ustSaetze: [{ kategorie_id: PROD_VERKAUFE_ID, ebene: 1, ust_satz: 19 }],
      // product has NO parent in produkte hierarchy
      produktKats: [
        { id: PRODUKT_ID2, name: 'SamiBu', parent_id: null, level: 1 },
        { id: SKU_ID, name: 'SamiBu-SKU', parent_id: PRODUKT_ID2, level: 2 },
      ],
      ustL1Ebene: [{ kategorie_id: PROD_VERKAUFE_ID, ebene: 1 }],
      // einnahmen L1: Produktverkäufe with Gesamt rate (parent_id=null = L1)
      einnahmenL1Kats: [{ id: PROD_VERKAUFE_ID, name: 'Produktverkäufe', parent_id: null }],
      absatzPlanung: [
        { sku_id: SKU_ID, produkt_id: PRODUKT_ID2, sales_plattform_id: PLATT_ID, kw_year: 2026, kw_number: 3, absatz_manuell: 10, effektiver_vk_manuell: null },
        { sku_id: null, produkt_id: PRODUKT_ID2, sales_plattform_id: PLATT_ID, kw_year: 2026, kw_number: 3, absatz_manuell: null, effektiver_vk_manuell: 119 },
      ],
    })

    const wideParams = 'von_kw=1&von_jahr=2026&bis_kw=13&bis_jahr=2026&erste_zukunftskw=1&erste_zukunftsjahr=2026'
    const res = await GET(buildGet(wideParams))
    expect(res.status).toBe(200)
    const body = await res.json()

    const ustEintrag = body.data.find((r: { kategorie_id: string }) => r.kategorie_id === UST_KAT_ID)
    expect(ustEintrag).toBeDefined()
    // extractVorsteuer(1190, 19) = 1190 × 19/119 = 190 in KW5
    expect(ustEintrag.wert).toBeCloseTo(190, 0)
    expect(ustEintrag.kw_number).toBe(5)
  })

  it('excludes Marketing from B2 Umsatzausgaben Vorsteuer', async () => {
    // Marketing L1 (parent_id=null) + one L2 child
    const MKT_L1 = 'a1111111-a111-a111-a111-a11111111111'
    const MKT_L2 = 'a2222222-a222-a222-a222-a22222222222'
    const VERTRIEB_L1 = 'a3333333-a333-a333-a333-a33333333333'
    const VERSAND_L2 = 'a4444444-a444-a444-a444-a44444444444'
    setupMocks({
      ustEinst: DEFAULT_UST_EINST,
      ustSaetze: [
        { kategorie_id: MKT_L1, ebene: 1, ust_satz: 19 },
        { kategorie_id: VERTRIEB_L1, ebene: 1, ust_satz: 19 },
      ],
      kpiCats: [
        ...DEFAULT_KPI_CATS,
        { id: VERTRIEB_L1, name: 'Vertrieb', parent_id: null },
        { id: MKT_L1, name: 'Marketing', parent_id: null },
        { id: VERSAND_L2, name: 'Versand', parent_id: VERTRIEB_L1 },
        { id: MKT_L2, name: 'Online Marketing', parent_id: MKT_L1 },
      ],
      umsatzausgaben: [
        { kategorie_id: MKT_L2, kw_year: 2026, kw_number: 3, betrag_manuell: 1190, ist_berechnet: false },
        { kategorie_id: VERSAND_L2, kw_year: 2026, kw_number: 3, betrag_manuell: 595, ist_berechnet: false },
      ],
      // Marketing exclusion from B2 only applies when the category is assigned in auszahlungs_marketing_gruppen
      auszahlungsMkt: [{ kpi_kategorie_id: MKT_L2 }],
    })

    const res = await GET(buildGet(VALID_PARAMS))
    const body = await res.json()

    const ustEintrag = body.data.find((r: { kategorie_id: string }) => r.kategorie_id === UST_KAT_ID)
    expect(ustEintrag).toBeDefined()
    // Only Versand counted (-extractVorsteuer(595, 19) = -595 × 19/119 ≈ -95), Marketing excluded (in auszahlungs_marketing_gruppen → B1)
    expect(ustEintrag.wert).toBeCloseTo(-95, 0)
  })

  it('shifts B2 Versand Vorsteuer back by zahlungsziel_tage for ist_berechnet=true rows', async () => {
    // KW6 (February) with 14-day shift → KW4 (January) → payment KW5
    const VERTRIEB_L1 = 'b3333333-b333-b333-b333-b33333333333'
    const VERSAND_L2 = 'b4444444-b444-b444-b444-b44444444444'
    setupMocks({
      ustEinst: DEFAULT_UST_EINST,
      ustSaetze: [{ kategorie_id: VERTRIEB_L1, ebene: 1, ust_satz: 19 }],
      kpiCats: [
        ...DEFAULT_KPI_CATS,
        { id: VERTRIEB_L1, name: 'Vertrieb', parent_id: null },
        { id: VERSAND_L2, name: 'Versand', parent_id: VERTRIEB_L1 },
      ],
      umsatzausgaben: [
        { kategorie_id: VERSAND_L2, kw_year: 2026, kw_number: 6, betrag_manuell: 1190, ist_berechnet: true },
      ],
      versandPlatt: [{ zahlungsziel_tage: 14 }],
    })

    const wideParams = 'von_kw=1&von_jahr=2026&bis_kw=13&bis_jahr=2026&erste_zukunftskw=1&erste_zukunftsjahr=2026'
    const res = await GET(buildGet(wideParams))
    const body = await res.json()

    const ustEintrag = body.data.find((r: { kategorie_id: string }) => r.kategorie_id === UST_KAT_ID)
    expect(ustEintrag).toBeDefined()
    // -extractVorsteuer(1190, 19) = -1190 × 19/119 ≈ -190, shifted to January → payment KW5
    expect(ustEintrag.wert).toBeCloseTo(-190, 0)
    expect(ustEintrag.kw_number).toBe(5)
  })

  it('shifts B2 Versand Vorsteuer back by zahlungsziel_tage for ist_berechnet=false (manual) rows', async () => {
    // Manual entry in KW6 (February) with 14-day shift → KW4 (January) → payment KW5
    const VERTRIEB_L1 = 'e3333333-e333-e333-e333-e33333333333'
    const VERSAND_L2 = 'e4444444-e444-e444-e444-e44444444444'
    setupMocks({
      ustEinst: DEFAULT_UST_EINST,
      ustSaetze: [{ kategorie_id: VERTRIEB_L1, ebene: 1, ust_satz: 19 }],
      kpiCats: [
        ...DEFAULT_KPI_CATS,
        { id: VERTRIEB_L1, name: 'Vertrieb', parent_id: null },
        { id: VERSAND_L2, name: 'Versand', parent_id: VERTRIEB_L1 },
      ],
      umsatzausgaben: [
        { kategorie_id: VERSAND_L2, kw_year: 2026, kw_number: 6, betrag_manuell: 1190, ist_berechnet: false },
      ],
      versandPlatt: [{ zahlungsziel_tage: 14 }],
    })

    const wideParams = 'von_kw=1&von_jahr=2026&bis_kw=13&bis_jahr=2026&erste_zukunftskw=1&erste_zukunftsjahr=2026'
    const res = await GET(buildGet(wideParams))
    const body = await res.json()

    const ustEintrag = body.data.find((r: { kategorie_id: string }) => r.kategorie_id === UST_KAT_ID)
    expect(ustEintrag).toBeDefined()
    // -extractVorsteuer(1190, 19) ≈ -190, shifted from Feb (KW6) to Jan (KW4) → payment KW5
    expect(ustEintrag.wert).toBeCloseTo(-190, 0)
    expect(ustEintrag.kw_number).toBe(5)
  })

  it('shifts B3 operative Vorsteuer back by zahlungsziel_tage for ist_berechnet=true rows', async () => {
    // KW6 Monday = 2026-02-02; shift back 14 days → 2026-01-19 → KW4 (January)
    // Without shift: February → payment KW9; with shift: January → payment KW5
    const KAT_OPER_L1 = 'b1111111-b111-b111-b111-b11111111111'
    setupMocks({
      ustEinst: { einfuhrust_satz: 0, einfuhrust_zahlungsziel_tage: 0, zahlungsfrequenz: 'monatlich', zahlungsverschiebung_tage: 0 },
      ustSaetze: [{ kategorie_id: KAT_OPERATIVE, ebene: 1, ust_satz: 19 }],
      operative: [{ kategorie_id: KAT_OPERATIVE, kw_year: 2026, kw_number: 6, betrag_manuell: 1190, ist_berechnet: true }],
      operFixkosten: [{ kategorie_id: KAT_OPER_L1, untergruppe_id: KAT_OPERATIVE, zahlungsziel_tage: 14 }],
    })

    const wideParams = 'von_kw=1&von_jahr=2026&bis_kw=13&bis_jahr=2026&erste_zukunftskw=1&erste_zukunftsjahr=2026'
    const res = await GET(buildGet(wideParams))
    const body = await res.json()

    const ustEintrag = body.data.find((r: { kategorie_id: string }) => r.kategorie_id === UST_KAT_ID)
    expect(ustEintrag).toBeDefined()
    // -extractVorsteuer(1190, 19) = -1190 × 19/119 ≈ -190, shifted from Feb (KW6) to Jan (KW4) → payment KW5
    expect(ustEintrag.wert).toBeCloseTo(-190, 0)
    expect(ustEintrag.kw_number).toBe(5)
    expect(ustEintrag.kw_year).toBe(2026)
  })

  it('shifts B3 operative Vorsteuer back by zahlungsziel_tage for ist_berechnet=false (manual) rows', async () => {
    // KW6 Monday = 2026-02-02; shift back 14 days → 2026-01-19 → KW4 (January) → payment KW5
    const KAT_OPER_L1 = 'f1111111-f111-f111-f111-f11111111111'
    setupMocks({
      ustEinst: { einfuhrust_satz: 0, einfuhrust_zahlungsziel_tage: 0, zahlungsfrequenz: 'monatlich', zahlungsverschiebung_tage: 0 },
      ustSaetze: [{ kategorie_id: KAT_OPERATIVE, ebene: 1, ust_satz: 19 }],
      operative: [{ kategorie_id: KAT_OPERATIVE, kw_year: 2026, kw_number: 6, betrag_manuell: 1190, ist_berechnet: false }],
      operFixkosten: [{ kategorie_id: KAT_OPER_L1, untergruppe_id: KAT_OPERATIVE, zahlungsziel_tage: 14 }],
    })

    const wideParams = 'von_kw=1&von_jahr=2026&bis_kw=13&bis_jahr=2026&erste_zukunftskw=1&erste_zukunftsjahr=2026'
    const res = await GET(buildGet(wideParams))
    const body = await res.json()

    const ustEintrag = body.data.find((r: { kategorie_id: string }) => r.kategorie_id === UST_KAT_ID)
    expect(ustEintrag).toBeDefined()
    // -extractVorsteuer(1190, 19) ≈ -190, shifted from Feb (KW6) to Jan (KW4) → payment KW5
    expect(ustEintrag.wert).toBeCloseTo(-190, 0)
    expect(ustEintrag.kw_number).toBe(5)
    expect(ustEintrag.kw_year).toBe(2026)
  })

  it('uses parent-category UST rate for B3 when subcategory has no own entry (hierarchical fallback)', async () => {
    // Hierarchy: Operativ L1 → Rechtliches L2 (19%) → Versicherungen L3 (no own entry)
    // Expects: getUstSatzHierarchisch (Aufgeteilt mode) walks up to Rechtliches and applies 19%
    const OPERATIV_L1 = 'c1111111-c111-c111-c111-c11111111111'
    const RECHTLICHES_L2 = 'c2222222-c222-c222-c222-c22222222222'
    const VERSICHERUNGEN_L3 = 'c3333333-c333-c333-c333-c33333333333'
    setupMocks({
      ustEinst: { einfuhrust_satz: 0, einfuhrust_zahlungsziel_tage: 0, zahlungsfrequenz: 'monatlich', zahlungsverschiebung_tage: 0 },
      ustSaetze: [
        // Only L2 has an entry at ebene=2 (Aufgeteilt) — L3 (Versicherungen) does NOT
        { kategorie_id: RECHTLICHES_L2, ebene: 2, ust_satz: 19 },
      ],
      ustL1Ebene: [{ kategorie_id: OPERATIV_L1, ebene: 2 }],
      kpiCats: [
        ...DEFAULT_KPI_CATS,
        { id: OPERATIV_L1, name: 'Operativ', parent_id: null },
        { id: RECHTLICHES_L2, name: 'Rechtliches', parent_id: OPERATIV_L1 },
        { id: VERSICHERUNGEN_L3, name: 'Versicherungen', parent_id: RECHTLICHES_L2 },
      ],
      // operative row uses the L3 category (Versicherungen), manuell → no shift
      operative: [{ kategorie_id: VERSICHERUNGEN_L3, kw_year: 2026, kw_number: 3, betrag_manuell: 1190, ist_berechnet: false }],
    })

    const res = await GET(buildGet(VALID_PARAMS))
    const body = await res.json()

    const ustEintrag = body.data.find((r: { kategorie_id: string }) => r.kategorie_id === UST_KAT_ID)
    expect(ustEintrag).toBeDefined()
    // -extractVorsteuer(1190, 19) = -190, grouped in January (KW3) → payment KW5
    expect(ustEintrag.wert).toBeCloseTo(-190, 0)
    expect(ustEintrag.kw_number).toBe(5)
    expect(ustEintrag.kw_year).toBe(2026)
  })

  it('uses parent-category UST rate for B4 when subcategory has no own entry (hierarchical fallback)', async () => {
    // Hierarchy: Produktinvestitionen L1 → Sales&Marketing L2 (19%) → Produktbilder L3 (no own entry)
    // Expects: getUstSatzHierarchisch (Aufgeteilt mode) walks up to Sales&Marketing and applies 19%
    const PRODINV_L1 = 'd1111111-d111-d111-d111-d11111111111'
    const SALES_MKT_L2 = 'd2222222-d222-d222-d222-d22222222222'
    const PRODUKTBILDER_L3 = 'd3333333-d333-d333-d333-d33333333333'
    setupMocks({
      ustEinst: { einfuhrust_satz: 0, einfuhrust_zahlungsziel_tage: 0, zahlungsfrequenz: 'monatlich', zahlungsverschiebung_tage: 0 },
      ustSaetze: [
        // Only L2 has an entry at ebene=2 (Aufgeteilt) — L3 (Produktbilder) does NOT
        { kategorie_id: SALES_MKT_L2, ebene: 2, ust_satz: 19 },
      ],
      ustL1Ebene: [{ kategorie_id: PRODINV_L1, ebene: 2 }],
      kpiCats: [
        ...DEFAULT_KPI_CATS,
        { id: PRODINV_L1, name: 'Produktinvestitionen', parent_id: null },
        { id: SALES_MKT_L2, name: 'Sales & Marketing', parent_id: PRODINV_L1 },
        { id: PRODUKTBILDER_L3, name: 'Produktbilder & -videos', parent_id: SALES_MKT_L2 },
      ],
      produktinvest: [{ kategorie_id: PRODUKTBILDER_L3, kw_year: 2026, kw_number: 3, betrag_manuell: 1190 }],
    })

    const res = await GET(buildGet(VALID_PARAMS))
    const body = await res.json()

    const ustEintrag = body.data.find((r: { kategorie_id: string }) => r.kategorie_id === UST_KAT_ID)
    expect(ustEintrag).toBeDefined()
    // -extractVorsteuer(1190, 19) = -190, grouped in January (KW3) → payment KW5
    expect(ustEintrag.wert).toBeCloseTo(-190, 0)
    expect(ustEintrag.kw_number).toBe(5)
    expect(ustEintrag.kw_year).toBe(2026)
  })

  it('deducts Einfuhrumsatzsteuer amounts from UST in KW before payment (B6)', async () => {
    // Einfuhr: ankunft 2026-01-05 + 7 days = 2026-01-12 → KW3, betrag = 1000 × 19% = 190
    // B6: -190 added to netUstPerKw in KW2 (one week before KW3)
    // KW2 is January → monthly group Jan → UST payment in KW5
    setupMocks({
      ustEinst: { einfuhrust_satz: 19, einfuhrust_zahlungsziel_tage: 7, zahlungsfrequenz: 'monatlich', zahlungsverschiebung_tage: 0 },
      bestellungen: [{ id: BESTELLUNG_ID, status: 'plan', ankunftsdatum: '2026-01-05', ankunftsdatum_ist: null }],
      bestellKosten: [{ bestellung_id: BESTELLUNG_ID, kpi_kategorie_id: WARE_KAT_ID, nettobetrag: 1000 }],
      bestellProdukte: [{ bestellung_id: BESTELLUNG_ID, produkt_id: PRODUKT_ID }],
      fiskal: [],
    })

    const res = await GET(buildGet(VALID_PARAMS))
    const body = await res.json()

    // Einfuhr still appears in its payment KW (Part 1 unchanged)
    const einfuhrEintrag = body.data.find((r: { kategorie_id: string }) => r.kategorie_id === EINFUHR_KAT_ID)
    expect(einfuhrEintrag).toBeDefined()
    expect(einfuhrEintrag.kw_number).toBe(3)
    expect(einfuhrEintrag.wert).toBeCloseTo(190, 1)

    // B6: same amount deducted from UST, grouped in January (KW2) → payment KW5
    const ustEintrag = body.data.find((r: { kategorie_id: string }) => r.kategorie_id === UST_KAT_ID)
    expect(ustEintrag).toBeDefined()
    expect(ustEintrag.wert).toBeCloseTo(-190, 1)
    expect(ustEintrag.kw_number).toBe(5)
    expect(ustEintrag.kw_year).toBe(2026)
  })

  it('includes manually entered Einfuhrumsatzsteuer in B6 deduction (ist_berechnet=false)', async () => {
    // Manuell entry: 5000€ Einfuhrumsatzsteuer in KW25 2026 (paid week June 15-21)
    // B6 shift: KW25 → KW24 (prev week), KW24 Thursday = June 11 → month 6 (June)
    // Monthly grouping: June → first KW of July = KW27 2026
    const PARAMS = 'von_kw=1&von_jahr=2026&bis_kw=27&bis_jahr=2026&erste_zukunftskw=1&erste_zukunftsjahr=2026'
    setupMocks({
      ustEinst: { einfuhrust_satz: 0, einfuhrust_zahlungsziel_tage: 0, zahlungsfrequenz: 'monatlich', zahlungsverschiebung_tage: 0 },
      steuerManuell: [{ kategorie_id: EINFUHR_KAT_ID, kw_year: 2026, kw_number: 25, betrag_manuell: 5000 }],
    })

    const res = await GET(buildGet(PARAMS))
    const body = await res.json()

    // No bestellungen → Einfuhr row itself is 0 (not in result)
    const einfuhrEintrag = body.data.find((r: { kategorie_id: string }) => r.kategorie_id === EINFUHR_KAT_ID)
    expect(einfuhrEintrag).toBeUndefined()

    // B6 manuell: -5000 attributed to KW24 (June) → paid in KW27
    const ustEintrag = body.data.find((r: { kategorie_id: string }) => r.kategorie_id === UST_KAT_ID)
    expect(ustEintrag).toBeDefined()
    expect(ustEintrag.wert).toBeCloseTo(-5000, 1)
    expect(ustEintrag.kw_number).toBe(27)
    expect(ustEintrag.kw_year).toBe(2026)
  })

  it('uses manual Verkaufsgebühr Soll-override from Sales Plattform Planung in B1 (gross → Vorsteuer)', async () => {
    // Manual verkaufsgebuehr override 119€ (gross) for product×platform in KW3.
    // Vertrieb L1 Gesamt = 19% → Vorsteuer = extractVorsteuer(119, 19) = 19, negative (expense).
    // KW3 January → monthly payment = KW5. No vkGeb settings / absatz needed: override is applied directly.
    const VERTRIEB_L1 = 'c1c1c1c1-c1c1-4c1c-8c1c-c1c1c1c1c1c1'
    const VKGEB_L2 = 'c2c2c2c2-c2c2-4c2c-8c2c-c2c2c2c2c2c2'
    const PROD = 'c3c3c3c3-c3c3-4c3c-8c3c-c3c3c3c3c3c3'
    const PLATT = 'c4c4c4c4-c4c4-4c4c-8c4c-c4c4c4c4c4c4'
    setupMocks({
      ustEinst: DEFAULT_UST_EINST,
      ustSaetze: [{ kategorie_id: VERTRIEB_L1, ebene: 1, ust_satz: 19 }],
      kpiCats: [
        ...DEFAULT_KPI_CATS,
        { id: VERTRIEB_L1, name: 'Vertrieb', parent_id: null },
        { id: VKGEB_L2, name: 'Verkaufsgebühren', parent_id: VERTRIEB_L1 },
      ],
      salesPlattPlanung: [
        { produkt_id: PROD, sales_plattform_id: PLATT, kategorie: 'verkaufsgebuehr', kw_year: 2026, kw_number: 3, wert_manuell: 119 },
      ],
    })

    const res = await GET(buildGet(VALID_PARAMS))
    expect(res.status).toBe(200)
    const body = await res.json()

    const ustEintrag = body.data.find((r: { kategorie_id: string }) => r.kategorie_id === UST_KAT_ID)
    expect(ustEintrag).toBeDefined()
    // extractVorsteuer(119, 19) = 19, deducted as Vorsteuer → -19, paid KW5
    expect(ustEintrag.wert).toBeCloseTo(-19, 1)
    expect(ustEintrag.kw_number).toBe(5)
    expect(ustEintrag.kw_year).toBe(2026)
  })
})
