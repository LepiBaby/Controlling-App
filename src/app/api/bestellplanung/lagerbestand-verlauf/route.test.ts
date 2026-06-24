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

const PRODUKT_ID = '11111111-1111-1111-8111-111111111111'
const SKU_1_ID = '22222222-2222-2222-8222-222222222222'
const SKU_2_ID = '33333333-3333-3333-8333-333333333333'
const BESTELLUNG_ID = '44444444-4444-4444-8444-444444444444'

function req(params: Record<string, string> = {}) {
  const url = new URL('http://localhost/api/bestellplanung/lagerbestand-verlauf')
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v)
  return new Request(url.toString())
}

// Chains a fluent mock builder that returns `data` at the leaf
function chainMock(data: unknown, error: unknown = null) {
  const leaf = { data, error }
  const methods = ['select', 'eq', 'in', 'lte', 'gte', 'lt', 'not', 'order', 'limit', 'maybeSingle', 'single', 'neq']
  const proxy: Record<string, () => typeof proxy | typeof leaf> = {}
  for (const m of methods) {
    proxy[m] = () => proxy
  }
  proxy['maybeSingle'] = () => leaf as typeof proxy
  proxy['single'] = () => leaf as typeof proxy
  proxy['limit'] = () => leaf as typeof proxy
  return proxy
}

beforeEach(() => {
  vi.clearAllMocks()
  mockFrom.mockReset()
})

describe('GET /api/bestellplanung/lagerbestand-verlauf', () => {
  it('returns 400 when produkt_id is missing', async () => {
    const res = await GET(req())
    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error).toContain('produkt_id')
  })

  it('returns 400 when produkt_id is not a valid UUID', async () => {
    const res = await GET(req({ produkt_id: 'not-a-uuid' }))
    expect(res.status).toBe(400)
  })

  it('returns 401 when unauthenticated', async () => {
    const { requireAuth } = await import('@/lib/supabase-server')
    vi.mocked(requireAuth).mockResolvedValueOnce({
      user: null, supabase: null as never,
      error: new Response('Unauthorized', { status: 401 }),
    })
    const res = await GET(req({ produkt_id: PRODUKT_ID }))
    expect(res.status).toBe(401)
  })

  it('returns empty skus when no SKUs found for product', async () => {
    // grundeinstellungen
    mockFrom.mockReturnValueOnce(chainMock({ planungshorizont_wochen: 13 }))
    // kpi_categories (no SKUs)
    mockFrom.mockReturnValueOnce(chainMock([]))

    const res = await GET(req({ produkt_id: PRODUKT_ID }))
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.skus).toHaveLength(0)
    expect(body.wochen.length).toBeGreaterThan(0)
  })

  it('returns 200 with wochen and skus when data is present', async () => {
    // grundeinstellungen
    mockFrom.mockReturnValueOnce(chainMock({ planungshorizont_wochen: 4 }))
    // kpi_categories → 2 SKUs
    mockFrom.mockReturnValueOnce(chainMock([
      { id: SKU_1_ID, name: 'SKU A' },
      { id: SKU_2_ID, name: 'SKU B' },
    ]))
    // bestand_transaktionen
    mockFrom.mockReturnValueOnce(chainMock([
      {
        sku_id: SKU_1_ID, datum: '2026-05-01',
        anfangsbestand: 100, einlagerungen: 0, anpassungen_positiv: 0,
        anpassungen_negativ: 0, warenverluste: 0, sendungen_manuell: 5,
        bestand_sendungen: [{ menge: 10 }],
      },
    ]))
    // absatz_planung
    mockFrom.mockReturnValueOnce(chainMock([]))
    // bestellungen_sku_mengen
    mockFrom.mockReturnValueOnce(chainMock([]))
    // produktinformationen_bestandsverwaltung
    mockFrom.mockReturnValueOnce(chainMock({ sicherheitsbestand: 2, zielreichweite_wochen: 6 }))
    // produktinformationen_lieferzeit
    mockFrom.mockReturnValueOnce(chainMock({ pufferzeit_tage: 7, produktionszeit_tage: 14, zwischenzeit_tage: 0, shipping_zeit_tage: 21, entladungszeit_tage: 3 }))
    // absatz_einstellungen (empty → no avg calc)
    mockFrom.mockReturnValueOnce(chainMock([]))

    const res = await GET(req({ produkt_id: PRODUKT_ID }))
    expect(res.status).toBe(200)
    const body = await res.json()

    expect(body.wochen).toBeInstanceOf(Array)
    expect(body.wochen.length).toBe(13 + 4)  // historyWeeks + horizont

    expect(body.skus).toHaveLength(2)
    expect(body.skus[0].sku_id).toBe(SKU_1_ID)
    expect(body.skus[0].sku_name).toBe('SKU A')
    expect(body.skus[0].farbe_index).toBe(0)
    expect(body.skus[1].farbe_index).toBe(1)

    // Jede SKU hat für jede Woche einen Verlaufspunkt
    for (const sku of body.skus) {
      expect(sku.verlauf).toHaveLength(17)
      for (const p of sku.verlauf) {
        expect(typeof p.kw).toBe('number')
        expect(typeof p.jahr).toBe('number')
        expect(typeof p.bestand_vorher).toBe('number')
        expect(typeof p.bestand_nachher).toBe('number')
        expect(typeof p.ist_prognose).toBe('boolean')
      }
    }
  })

  it('credits incoming orders: zugang at verfuegbarkeitsdatum, kalk at bestelldatum', async () => {
    // Order with bestelldatum = today and verfuegbarkeitsdatum = today → both appear in the same week
    const today = new Date()
    today.setUTCHours(0, 0, 0, 0)
    const todayStr = today.toISOString().slice(0, 10)

    // grundeinstellungen
    mockFrom.mockReturnValueOnce(chainMock({ planungshorizont_wochen: 8 }))
    // kpi_categories
    mockFrom.mockReturnValueOnce(chainMock([{ id: SKU_1_ID, name: 'SKU A' }]))
    // bestand_transaktionen (current bestand = 50)
    mockFrom.mockReturnValueOnce(chainMock([{
      sku_id: SKU_1_ID, datum: todayStr,
      anfangsbestand: 50, einlagerungen: 0, anpassungen_positiv: 0,
      anpassungen_negativ: 0, warenverluste: 0, sendungen_manuell: 0,
      bestand_sendungen: [],
    }]))
    // absatz_planung (none)
    mockFrom.mockReturnValueOnce(chainMock([]))
    // bestellungen_sku_mengen (100 units)
    mockFrom.mockReturnValueOnce(chainMock([{
      sku_id: SKU_1_ID, menge_praktisch: 100, bestellung_id: BESTELLUNG_ID,
    }]))
    // bestandsverwaltung
    mockFrom.mockReturnValueOnce(chainMock(null))
    // lieferzeit
    mockFrom.mockReturnValueOnce(chainMock(null))
    // absatz_einstellungen
    mockFrom.mockReturnValueOnce(chainMock([]))
    // bestellungen: bestelldatum=today (kalk), verfuegbarkeitsdatum=today (zugang/bestand)
    mockFrom.mockReturnValueOnce(chainMock([{
      id: BESTELLUNG_ID, bestelldatum: todayStr, verfuegbarkeitsdatum: todayStr,
    }]))

    const res = await GET(req({ produkt_id: PRODUKT_ID }))
    expect(res.status).toBe(200)
    const body = await res.json()

    const skuVerlauf = body.skus[0].verlauf
    // verfuegbarkeitsdatum=today → ankunft appears in first prognose week
    const weekWithAnkunft = skuVerlauf.find((p: { ist_prognose: boolean; ankunft: number }) => p.ist_prognose && p.ankunft > 0)
    expect(weekWithAnkunft).toBeDefined()
    expect(weekWithAnkunft.ankunft).toBe(100)
    // bestelldatum=today → kalk also reflects the order in the same week
    expect(weekWithAnkunft.kalkulatorischer_bestand).toBeGreaterThan(weekWithAnkunft.bestand_vorher)
  })

  it('includes future-bestelldatum orders in kalkulatorischer Bestand', async () => {
    // Planbestellung with bestelldatum 12 weeks in the future (e.g. 2026-08-31)
    // must still appear in kalkulatorischer Bestand at that future week
    const today = new Date()
    today.setUTCHours(0, 0, 0, 0)
    const todayStr = today.toISOString().slice(0, 10)
    const futureDate = new Date(today.getTime() + 12 * 7 * 86_400_000)
    const futureDateStr = futureDate.toISOString().slice(0, 10)

    // grundeinstellungen
    mockFrom.mockReturnValueOnce(chainMock({ planungshorizont_wochen: 20 }))
    // kpi_categories
    mockFrom.mockReturnValueOnce(chainMock([{ id: SKU_1_ID, name: 'SKU A' }]))
    // bestand_transaktionen (current bestand = 50)
    mockFrom.mockReturnValueOnce(chainMock([{
      sku_id: SKU_1_ID, datum: todayStr,
      anfangsbestand: 50, einlagerungen: 0, anpassungen_positiv: 0,
      anpassungen_negativ: 0, warenverluste: 0, sendungen_manuell: 0,
      bestand_sendungen: [],
    }]))
    // absatz_planung (none)
    mockFrom.mockReturnValueOnce(chainMock([]))
    // bestellungen_sku_mengen (200 units)
    mockFrom.mockReturnValueOnce(chainMock([{
      sku_id: SKU_1_ID, menge_praktisch: 200, bestellung_id: BESTELLUNG_ID,
    }]))
    // bestandsverwaltung
    mockFrom.mockReturnValueOnce(chainMock(null))
    // lieferzeit
    mockFrom.mockReturnValueOnce(chainMock(null))
    // absatz_einstellungen
    mockFrom.mockReturnValueOnce(chainMock([]))
    // bestellungen: bestelldatum 12 weeks in future, no verfuegbarkeitsdatum
    mockFrom.mockReturnValueOnce(chainMock([{
      id: BESTELLUNG_ID, bestelldatum: futureDateStr, verfuegbarkeitsdatum: null,
    }]))

    const res = await GET(req({ produkt_id: PRODUKT_ID }))
    expect(res.status).toBe(200)
    const body = await res.json()

    const skuVerlauf = body.skus[0].verlauf
    // kalk should reflect the 200-unit order at the future bestelldatum week
    const weekWithKalk = skuVerlauf.find(
      (p: { ist_prognose: boolean; kalkulatorischer_bestand: number | null }) =>
        p.ist_prognose && p.kalkulatorischer_bestand !== null && p.kalkulatorischer_bestand > 50
    )
    expect(weekWithKalk).toBeDefined()
    // No verfuegbarkeitsdatum → ankunft is always 0
    const anyAnkunft = skuVerlauf.some((p: { ankunft: number }) => p.ankunft > 0)
    expect(anyAnkunft).toBe(false)
  })

  it('closing balance = anfangsbestand + einlagerungen + pos - neg - verluste - manuell - sendungen', async () => {
    // grundeinstellungen
    mockFrom.mockReturnValueOnce(chainMock({ planungshorizont_wochen: 2 }))
    // kpi_categories
    mockFrom.mockReturnValueOnce(chainMock([{ id: SKU_1_ID, name: 'SKU A' }]))
    // bestand_transaktionen: 200 + 50 + 10 - 5 - 3 - 2 - (8+4) = 238
    mockFrom.mockReturnValueOnce(chainMock([{
      sku_id: SKU_1_ID, datum: '2026-01-01',
      anfangsbestand: 200, einlagerungen: 50, anpassungen_positiv: 10,
      anpassungen_negativ: 5, warenverluste: 3, sendungen_manuell: 2,
      bestand_sendungen: [{ menge: 8 }, { menge: 4 }],
    }]))
    // absatz_planung
    mockFrom.mockReturnValueOnce(chainMock([]))
    // bestellungen_sku_mengen
    mockFrom.mockReturnValueOnce(chainMock([]))
    // bestandsverwaltung
    mockFrom.mockReturnValueOnce(chainMock(null))
    // lieferzeit
    mockFrom.mockReturnValueOnce(chainMock(null))
    // absatz_einstellungen
    mockFrom.mockReturnValueOnce(chainMock([]))

    const res = await GET(req({ produkt_id: PRODUKT_ID }))
    expect(res.status).toBe(200)
    const body = await res.json()
    const sku = body.skus[0]

    // The projection starts from the current bestand (= 238)
    // The first projection week should have bestand_vorher = 238
    const firstPrognose = sku.verlauf.find((p: { ist_prognose: boolean }) => p.ist_prognose)
    expect(firstPrognose).toBeDefined()
    expect(firstPrognose.bestand_vorher).toBe(238)
  })

  it('projection bestand never falls below 0', async () => {
    // grundeinstellungen
    mockFrom.mockReturnValueOnce(chainMock({ planungshorizont_wochen: 6 }))
    // kpi_categories
    mockFrom.mockReturnValueOnce(chainMock([{ id: SKU_1_ID, name: 'SKU A' }]))
    // bestand_transaktionen: current = 10
    mockFrom.mockReturnValueOnce(chainMock([{
      sku_id: SKU_1_ID, datum: '2026-01-01',
      anfangsbestand: 10, einlagerungen: 0, anpassungen_positiv: 0,
      anpassungen_negativ: 0, warenverluste: 0, sendungen_manuell: 0,
      bestand_sendungen: [],
    }]))
    // absatz_planung: high sales every week → bestand would go negative
    const today = new Date()
    today.setUTCHours(0, 0, 0, 0)
    const d = new Date(today.getUTCFullYear(), 0, 4)
    const dow = d.getUTCDay() || 7
    d.setUTCDate(d.getUTCDate() + 4 - dow)
    // Use current KW for planning data
    const curWeek = Math.ceil(((today.getTime() - new Date(Date.UTC(today.getUTCFullYear(), 0, 1)).getTime()) / 86_400_000 + 1) / 7)
    mockFrom.mockReturnValueOnce(chainMock([
      { sku_id: SKU_1_ID, kw_year: today.getUTCFullYear(), kw_number: curWeek, absatz_manuell: 1000 },
    ]))
    // bestellungen_sku_mengen
    mockFrom.mockReturnValueOnce(chainMock([]))
    // bestandsverwaltung
    mockFrom.mockReturnValueOnce(chainMock(null))
    // lieferzeit
    mockFrom.mockReturnValueOnce(chainMock(null))
    // absatz_einstellungen
    mockFrom.mockReturnValueOnce(chainMock([]))

    const res = await GET(req({ produkt_id: PRODUKT_ID }))
    expect(res.status).toBe(200)
    const body = await res.json()
    const verlauf = body.skus[0].verlauf

    for (const p of verlauf) {
      expect(p.bestand_nachher).toBeGreaterThanOrEqual(0)
      expect(p.bestand_vorher).toBeGreaterThanOrEqual(0)
    }
  })

  it('historical weeks have ist_prognose=false, future weeks have ist_prognose=true', async () => {
    // grundeinstellungen
    mockFrom.mockReturnValueOnce(chainMock({ planungshorizont_wochen: 4 }))
    // kpi_categories
    mockFrom.mockReturnValueOnce(chainMock([{ id: SKU_1_ID, name: 'SKU A' }]))
    // bestand_transaktionen
    mockFrom.mockReturnValueOnce(chainMock([]))
    // absatz_planung
    mockFrom.mockReturnValueOnce(chainMock([]))
    // bestellungen_sku_mengen
    mockFrom.mockReturnValueOnce(chainMock([]))
    // bestandsverwaltung
    mockFrom.mockReturnValueOnce(chainMock(null))
    // lieferzeit
    mockFrom.mockReturnValueOnce(chainMock(null))
    // absatz_einstellungen
    mockFrom.mockReturnValueOnce(chainMock([]))

    const res = await GET(req({ produkt_id: PRODUKT_ID }))
    expect(res.status).toBe(200)
    const body = await res.json()

    const wochen = body.wochen as Array<{ ist_prognose: boolean }>
    const historisch = wochen.filter(w => !w.ist_prognose)
    const prognose = wochen.filter(w => w.ist_prognose)

    expect(historisch.length).toBe(13)  // historyWeeks
    expect(prognose.length).toBe(4)     // horizont
  })
})
