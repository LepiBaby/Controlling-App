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

// Bestellkosten-Generierung als No-Op mocken (macht sonst eigene DB-Aufrufe, die die
// sequentielle from()-Mock-Reihenfolge stören würden).
vi.mock('../../bestellplanung/bestellungen/[id]/kosten/_kosten-utils', () => ({
  generiereUndSpeichereLangfristigeBestellkosten: vi.fn().mockResolvedValue(undefined),
}))

// Bestandssimulation (Lagerausgaben) mocken — sonst eigene DB-Aufrufe + reale Logik.
vi.mock('../../bestellplanung/_utils', () => ({
  ladeVersionsDaten: vi.fn(),
}))
vi.mock('@/lib/langfristige-bestelllauf-algorithmus', () => ({
  computeLagerbestandVerlauf: vi.fn(),
}))

const VERSION_ID = '11111111-1111-4111-8111-111111111111'
const PRODUKT_ID = '33333333-3333-4333-8333-333333333333'
const PLATTFORM_ID = '44444444-4444-4444-8444-444444444444'
const VERTRIEB_L1 = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
const VERSAND_L2 = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'

function chain(result: unknown) {
  const c: Record<string, unknown> = { then: (resolve: (v: unknown) => unknown) => resolve(result) }
  for (const m of ['select', 'eq', 'in', 'upsert', 'single', 'maybeSingle', 'limit', 'delete', 'order']) c[m] = () => c
  return c
}

function ctx(id = VERSION_ID) {
  return { params: Promise.resolve({ versionId: id }) }
}
const URL_BASE = `http://localhost/api/langfristige-planung/${VERSION_ID}/umsatzausgaben/berechnet`

async function unauth() {
  const { requireAuth } = await import('@/lib/supabase-server')
  vi.mocked(requireAuth).mockResolvedValueOnce({
    user: null,
    supabase: null as never,
    error: new Response('Unauthorized', { status: 401 }),
  })
}

// Reihenfolge der from()-Aufrufe in berechnet:
//  1) version check (langfristige_planversionen)
//  2) Promise.all #1: grundeinstellungen, kpi_categories
//  3) Promise.all #2 (19): prod, kanal, absatz, versand, versandGrp, lager, lagerGrp,
//     kulanz, kulanzGrp, retourenProd, retourenGrp, container, mktPlan, mktEinst,
//     auszKanal, ustSatz, ustEbene, bestellungen, bestellKost
function setupMocks(opts: {
  grund?: unknown
  kats?: unknown[]
  prod?: unknown[]
  kanal?: unknown[]
  absatz?: unknown[]
  versand?: unknown[]
  versandGrp?: unknown[]
  lager?: unknown[]
  container?: unknown[]
  bestellungen?: unknown[]
  bestellKost?: unknown[]
} = {}) {
  mockFrom.mockReturnValueOnce(chain({ data: { id: VERSION_ID }, error: null })) // version check
  // Promise.all #1
  mockFrom.mockReturnValueOnce(chain({ data: opts.grund ?? null, error: null })) // grundeinstellungen
  mockFrom.mockReturnValueOnce(chain({ data: opts.kats ?? [], error: null })) // kpi_categories
  // Promise.all #2 (19)
  mockFrom.mockReturnValueOnce(chain({ data: opts.prod ?? [], error: null })) // prod
  mockFrom.mockReturnValueOnce(chain({ data: opts.kanal ?? [], error: null })) // kanal
  mockFrom.mockReturnValueOnce(chain({ data: opts.absatz ?? [], error: null })) // absatz
  mockFrom.mockReturnValueOnce(chain({ data: opts.versand ?? [], error: null })) // versand
  mockFrom.mockReturnValueOnce(chain({ data: opts.versandGrp ?? [], error: null })) // versandGrp
  mockFrom.mockReturnValueOnce(chain({ data: opts.lager ?? [], error: null })) // lager
  mockFrom.mockReturnValueOnce(chain({ data: [], error: null })) // lagerGrp
  mockFrom.mockReturnValueOnce(chain({ data: [], error: null })) // kulanz
  mockFrom.mockReturnValueOnce(chain({ data: [], error: null })) // kulanzGrp
  mockFrom.mockReturnValueOnce(chain({ data: [], error: null })) // retourenProd
  mockFrom.mockReturnValueOnce(chain({ data: null, error: null })) // retourenGrp (maybeSingle)
  mockFrom.mockReturnValueOnce(chain({ data: opts.container ?? [], error: null })) // container
  mockFrom.mockReturnValueOnce(chain({ data: [], error: null })) // mktPlan
  mockFrom.mockReturnValueOnce(chain({ data: [], error: null })) // mktEinst
  mockFrom.mockReturnValueOnce(chain({ data: [], error: null })) // auszKanal
  mockFrom.mockReturnValueOnce(chain({ data: [], error: null })) // ustSatz
  mockFrom.mockReturnValueOnce(chain({ data: [], error: null })) // ustEbene
  mockFrom.mockReturnValueOnce(chain({ data: opts.bestellungen ?? [], error: null })) // bestellungen
  mockFrom.mockReturnValueOnce(chain({ data: opts.bestellKost ?? [], error: null })) // bestellKost
}

beforeEach(async () => {
  vi.clearAllMocks()
  mockFrom.mockReset()
  // Standard: keine Bestandssimulation (keine Produkte) → Lagerausgaben leer.
  const { ladeVersionsDaten } = await import('../../bestellplanung/_utils')
  vi.mocked(ladeVersionsDaten).mockResolvedValue({
    startMonat: new Date(Date.UTC(2026, 5, 1)),
    horizontMonate: 12,
    produkte: [],
    bestehende: [],
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } as any)
})

describe('GET /api/langfristige-planung/[versionId]/umsatzausgaben/berechnet', () => {
  it('returns 401 when unauthenticated', async () => {
    await unauth()
    const res = await GET(new Request(URL_BASE), ctx())
    expect(res.status).toBe(401)
  })

  it('returns 400 for invalid version id', async () => {
    const res = await GET(new Request(URL_BASE), ctx('not-a-uuid'))
    expect(res.status).toBe(400)
  })

  it('returns 404 for foreign/unknown version', async () => {
    mockFrom.mockReturnValueOnce(chain({ data: null, error: null }))
    const res = await GET(new Request(URL_BASE), ctx())
    expect(res.status).toBe(404)
  })

  it('returns 500 on kpi_categories error', async () => {
    mockFrom.mockReturnValueOnce(chain({ data: { id: VERSION_ID }, error: null })) // version check
    mockFrom.mockReturnValueOnce(chain({ data: null, error: null })) // grund
    mockFrom.mockReturnValueOnce(chain({ data: null, error: { message: 'boom' } })) // kats
    const res = await GET(new Request(URL_BASE), ctx())
    expect(res.status).toBe(500)
  })

  it('returns empty data + unassigned channels when no products', async () => {
    setupMocks({ kanal: [{ id: 'k-1' }] })
    const res = await GET(new Request(URL_BASE), ctx())
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.data).toEqual([])
    expect(body.unassigned_marketing_kat_ids).toEqual(['k-1'])
  })

  it('keeps Versand in the source month (monatlich, no Zahlungsziel)', async () => {
    setupMocks({
      grund: { startmonat_monat: 1, startmonat_jahr: 2026, planungshorizont_monate: 3 },
      kats: [
        { id: VERTRIEB_L1, name: 'Vertrieb', parent_id: null, type: 'ausgaben_kosten', level: 1 },
        { id: VERSAND_L2, name: 'Versandausgaben', parent_id: VERTRIEB_L1, type: 'ausgaben_kosten', level: 2 },
      ],
      prod: [{ id: PRODUKT_ID }],
      absatz: [{ sales_plattform_id: PLATTFORM_ID, produkt_id: PRODUKT_ID, jahr: 2026, monat: 1, absatz: 10, effektiver_vk: 5 }],
      versand: [{ produkt_id: PRODUKT_ID, versandgebuehr_spediteur_euro_netto: 2, versandgebuehr_3pl_euro_netto: 1 }],
      versandGrp: [{ gruppierung: 'monatlich', zahlungsziel_tage: 0 }],
    })
    const res = await GET(new Request(URL_BASE), ctx())
    expect(res.status).toBe(200)
    const body = await res.json()
    // Absatz 10 × (2+1) = 30, USt 0%, monatlich + 0 Tage → bleibt im Anfallsmonat Jan 2026.
    expect(body.data).toHaveLength(1)
    expect(body.data[0]).toMatchObject({
      kategorie_id: VERSAND_L2,
      produkt_id: PRODUKT_ID,
      jahr: 2026,
      monat: 1,
      wert: 30,
    })
  })

  it('shifts Versand by Zahlungsziel only (30 Tage → +1 Monat)', async () => {
    setupMocks({
      grund: { startmonat_monat: 1, startmonat_jahr: 2026, planungshorizont_monate: 3 },
      kats: [
        { id: VERTRIEB_L1, name: 'Vertrieb', parent_id: null, type: 'ausgaben_kosten', level: 1 },
        { id: VERSAND_L2, name: 'Versandausgaben', parent_id: VERTRIEB_L1, type: 'ausgaben_kosten', level: 2 },
      ],
      prod: [{ id: PRODUKT_ID }],
      absatz: [{ sales_plattform_id: PLATTFORM_ID, produkt_id: PRODUKT_ID, jahr: 2026, monat: 1, absatz: 10, effektiver_vk: 5 }],
      versand: [{ produkt_id: PRODUKT_ID, versandgebuehr_spediteur_euro_netto: 2, versandgebuehr_3pl_euro_netto: 1 }],
      versandGrp: [{ gruppierung: 'monatlich', zahlungsziel_tage: 30 }],
    })
    const res = await GET(new Request(URL_BASE), ctx())
    expect(res.status).toBe(200)
    const body = await res.json()
    // monatlich + 30 Tage → Anfallsmonat Jan + ceil(30/30)=1 → fällig Feb 2026.
    expect(body.data).toHaveLength(1)
    expect(body.data[0]).toMatchObject({ kategorie_id: VERSAND_L2, jahr: 2026, monat: 2, wert: 30 })
  })

  it('bundles quartalsweise into the last month of the quarter (no Folgemonat)', async () => {
    setupMocks({
      grund: { startmonat_monat: 1, startmonat_jahr: 2026, planungshorizont_monate: 6 }, // Jan–Jun
      kats: [
        { id: VERTRIEB_L1, name: 'Vertrieb', parent_id: null, type: 'ausgaben_kosten', level: 1 },
        { id: VERSAND_L2, name: 'Versandausgaben', parent_id: VERTRIEB_L1, type: 'ausgaben_kosten', level: 2 },
      ],
      prod: [{ id: PRODUKT_ID }],
      // Absatz im Februar (Q1); quartalsweise ohne Zahlungsziel → gebündelt im letzten
      // Q1-Monat = März (kein Folgemonat).
      absatz: [{ sales_plattform_id: PLATTFORM_ID, produkt_id: PRODUKT_ID, jahr: 2026, monat: 2, absatz: 10, effektiver_vk: 5 }],
      versand: [{ produkt_id: PRODUKT_ID, versandgebuehr_spediteur_euro_netto: 2, versandgebuehr_3pl_euro_netto: 1 }],
      versandGrp: [{ gruppierung: 'quartalsweise', zahlungsziel_tage: 0 }],
    })
    const res = await GET(new Request(URL_BASE), ctx())
    expect(res.status).toBe(200)
    const body = await res.json()
    // Q1 (Feb) → gebündelt fällig März 2026 (Monat 3), kein Folgemonat.
    expect(body.data).toHaveLength(1)
    expect(body.data[0]).toMatchObject({ kategorie_id: VERSAND_L2, jahr: 2026, monat: 3, wert: 30 })
  })

  it('fills an in-window month from a pre-window source month via Zahlungsziel (Vorlauf)', async () => {
    const VERTRIEB = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc'
    const VERSAND = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'
    setupMocks({
      grund: { startmonat_monat: 6, startmonat_jahr: 2026, planungshorizont_monate: 3 }, // Fenster Jun–Aug
      kats: [
        { id: VERTRIEB, name: 'Vertrieb', parent_id: null, type: 'ausgaben_kosten', level: 1 },
        { id: VERSAND, name: 'Versand', parent_id: VERTRIEB, type: 'ausgaben_kosten', level: 2 },
      ],
      prod: [{ id: PRODUKT_ID }],
      // Absatz NUR im Mai (vor dem Startmonat Juni); Zahlungsziel 30 Tage → fällig Juni.
      absatz: [{ sales_plattform_id: PLATTFORM_ID, produkt_id: PRODUKT_ID, jahr: 2026, monat: 5, absatz: 10, effektiver_vk: 5 }],
      versand: [{ produkt_id: PRODUKT_ID, versandgebuehr_spediteur_euro_netto: 10, versandgebuehr_3pl_euro_netto: 0 }],
      versandGrp: [{ gruppierung: 'monatlich', zahlungsziel_tage: 30 }],
    })
    const res = await GET(new Request(URL_BASE), ctx())
    expect(res.status).toBe(200)
    const body = await res.json()
    // Mai-Absatz 10 × 10 € = 100, monatlich + 30 Tage → fällig Juni (Startmonat wird befüllt).
    expect(body.data).toHaveLength(1)
    expect(body.data[0]).toMatchObject({ kategorie_id: VERSAND, jahr: 2026, monat: 6, wert: 100 })
  })

  it('computes Produktausgaben from Bestellkosten without payment shift', async () => {
    const BEST_ID = '55555555-5555-4555-8555-555555555555'
    const KOST_KAT = '66666666-6666-4666-8666-666666666666'
    setupMocks({
      grund: { startmonat_monat: 1, startmonat_jahr: 2026, planungshorizont_monate: 3 },
      kats: [{ id: KOST_KAT, name: 'Ware', parent_id: null, type: 'ausgaben_kosten', level: 2 }],
      prod: [{ id: PRODUKT_ID }],
      bestellungen: [{ id: BEST_ID, produkt_id: PRODUKT_ID, bestelldatum: '2026-02-10', ankunftsdatum: null, verfuegbarkeitsdatum: null, ist_erstbestellung: false }],
      bestellKost: [{ bestellung_id: BEST_ID, kpi_kategorie_id: KOST_KAT, datum: '2026-02-10', nettobetrag: 1000 }],
    })
    const res = await GET(new Request(URL_BASE), ctx())
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.data).toHaveLength(1)
    expect(body.data[0]).toMatchObject({
      kategorie_id: KOST_KAT,
      produkt_id: PRODUKT_ID,
      jahr: 2026,
      monat: 2,
      wert: 1000,
    })
  })

  it('computes Lagerausgaben from monthly stock (Bestand), not Absatz', async () => {
    const VERTRIEB_L1B = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc'
    const LAGER_L2 = 'dddddddd-dddd-4ddd-8ddd-dddddddddddd'
    const { ladeVersionsDaten } = await import('../../bestellplanung/_utils')
    const { computeLagerbestandVerlauf } = await import('@/lib/langfristige-bestelllauf-algorithmus')
    // Bestand des Quellmonats Juni 2026 = 200 Stück (unabhängig vom Absatz).
    vi.mocked(ladeVersionsDaten).mockResolvedValueOnce({
      startMonat: new Date(Date.UTC(2026, 5, 1)),
      horizontMonate: 3,
      produkte: [{ produkt_id: PRODUKT_ID }],
      bestehende: [],
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any)
    vi.mocked(computeLagerbestandVerlauf).mockReturnValueOnce({
      start_label: 'Jun 26',
      monate: [{ jahr: 2026, monat: 6, bestand_nachher: 200 }],
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any)
    setupMocks({
      grund: { startmonat_monat: 6, startmonat_jahr: 2026, planungshorizont_monate: 3 },
      kats: [
        { id: VERTRIEB_L1B, name: 'Vertrieb', parent_id: null, type: 'ausgaben_kosten', level: 1 },
        { id: LAGER_L2, name: 'Lagerung', parent_id: VERTRIEB_L1B, type: 'ausgaben_kosten', level: 2 },
      ],
      prod: [{ id: PRODUKT_ID }],
      // KEIN Absatz im Juni → bei absatzbasierter Logik wäre Lager 0; bestandbasiert > 0.
      absatz: [],
      lager: [{ produkt_id: PRODUKT_ID, lagerkosten_euro_m3_monat: 10 }],
      container: [{ produkt_id: PRODUKT_ID, laenge_cm: 50, breite_cm: 25, hoehe_cm: 50 }],
    })
    const res = await GET(new Request(URL_BASE), ctx())
    expect(res.status).toBe(200)
    const body = await res.json()
    // Bestand 200 × 10 €/m³/Mon × 0,0625 m³ = 125; Quellmonat Juni, monatlich + 0 Tage
    // → bleibt im Anfallsmonat Juni 2026.
    expect(body.data).toHaveLength(1)
    expect(body.data[0]).toMatchObject({ kategorie_id: LAGER_L2, jahr: 2026, monat: 6, wert: 125 })
  })

  it('excludes Bestellkosten of Erstbestellungen (ist_erstbestellung = true)', async () => {
    const BEST_NORMAL = '55555555-5555-4555-8555-555555555555'
    const BEST_ERST = '77777777-7777-4777-8777-777777777777'
    const KOST_KAT = '66666666-6666-4666-8666-666666666666'
    setupMocks({
      grund: { startmonat_monat: 1, startmonat_jahr: 2026, planungshorizont_monate: 3 },
      kats: [{ id: KOST_KAT, name: 'Ware', parent_id: null, type: 'ausgaben_kosten', level: 2 }],
      prod: [{ id: PRODUKT_ID }],
      bestellungen: [
        { id: BEST_NORMAL, produkt_id: PRODUKT_ID, bestelldatum: '2026-02-10', ankunftsdatum: null, verfuegbarkeitsdatum: null, ist_erstbestellung: false },
        { id: BEST_ERST, produkt_id: PRODUKT_ID, bestelldatum: '2026-02-10', ankunftsdatum: null, verfuegbarkeitsdatum: null, ist_erstbestellung: true },
      ],
      bestellKost: [
        { bestellung_id: BEST_NORMAL, kpi_kategorie_id: KOST_KAT, datum: '2026-02-10', nettobetrag: 1000 },
        { bestellung_id: BEST_ERST, kpi_kategorie_id: KOST_KAT, datum: '2026-02-10', nettobetrag: 9999 },
      ],
    })
    const res = await GET(new Request(URL_BASE), ctx())
    expect(res.status).toBe(200)
    const body = await res.json()
    // Nur die normale Bestellung zählt; die Erstbestellung (9999) wird ignoriert.
    expect(body.data).toHaveLength(1)
    expect(body.data[0].wert).toBe(1000)
  })
})
