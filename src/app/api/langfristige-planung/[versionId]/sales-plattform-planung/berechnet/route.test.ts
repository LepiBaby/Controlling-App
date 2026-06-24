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

const VERSION_ID = '11111111-1111-4111-8111-111111111111'
const PLATT_ID = '44444444-4444-4444-8444-444444444444'
const PRODUKT_ID = '33333333-3333-4333-8333-333333333333'

// Thenable-Chain: jede Methode gibt die Chain zurück; await löst zum Ergebnis auf.
function chain(result: unknown) {
  const c: Record<string, unknown> = { then: (resolve: (v: unknown) => unknown) => resolve(result) }
  for (const m of ['select', 'eq', 'in', 'limit', 'maybeSingle']) c[m] = () => c
  return c
}

function ctx(id = VERSION_ID) {
  return { params: Promise.resolve({ versionId: id }) }
}
const URL_BASE = `http://localhost/api/langfristige-planung/${VERSION_ID}/sales-plattform-planung/berechnet`

async function unauth() {
  const { requireAuth } = await import('@/lib/supabase-server')
  vi.mocked(requireAuth).mockResolvedValueOnce({
    user: null,
    supabase: null as never,
    error: new Response('Unauthorized', { status: 401 }),
  })
}

// Mockt die volle Lade-Sequenz: version → grund → kats → (11 Settings-Queries).
// Reihenfolge der 11: platt, prod, absatz, retourenAllg, retouren, vkGeb,
// marketingPlan, marketingEinst, auszahlung, ustSatz, ustEbene.
function mockLoad(opts: {
  grund?: unknown
  kats?: unknown[]
  platt?: unknown[]
  prod?: unknown[]
  absatz?: unknown[]
  retourenAllg?: unknown[]
  retouren?: unknown[]
  vkGeb?: unknown[]
  marketingPlan?: unknown[]
  marketingEinst?: unknown[]
  auszahlung?: unknown[]
  ustSatz?: unknown[]
  ustEbene?: unknown[]
}) {
  mockFrom.mockReturnValueOnce(chain({ data: { id: VERSION_ID }, error: null })) // version
  mockFrom.mockReturnValueOnce(chain({ data: opts.grund ?? null, error: null })) // grund
  mockFrom.mockReturnValueOnce(chain({ data: opts.kats ?? [], error: null })) // kpi_categories
  mockFrom.mockReturnValueOnce(chain({ data: opts.platt ?? [], error: null }))
  mockFrom.mockReturnValueOnce(chain({ data: opts.prod ?? [], error: null }))
  mockFrom.mockReturnValueOnce(chain({ data: opts.absatz ?? [], error: null }))
  mockFrom.mockReturnValueOnce(chain({ data: opts.retourenAllg ?? [], error: null }))
  mockFrom.mockReturnValueOnce(chain({ data: opts.retouren ?? [], error: null }))
  mockFrom.mockReturnValueOnce(chain({ data: opts.vkGeb ?? [], error: null }))
  mockFrom.mockReturnValueOnce(chain({ data: opts.marketingPlan ?? [], error: null }))
  mockFrom.mockReturnValueOnce(chain({ data: opts.marketingEinst ?? [], error: null }))
  mockFrom.mockReturnValueOnce(chain({ data: opts.auszahlung ?? [], error: null }))
  mockFrom.mockReturnValueOnce(chain({ data: opts.ustSatz ?? [], error: null }))
  mockFrom.mockReturnValueOnce(chain({ data: opts.ustEbene ?? [], error: null }))
}

const GRUND = { startmonat_monat: 4, startmonat_jahr: 2026, planungshorizont_monate: 1 }

beforeEach(() => {
  vi.clearAllMocks()
  mockFrom.mockReset()
})

describe('GET /api/langfristige-planung/[versionId]/sales-plattform-planung/berechnet', () => {
  it('computes bruttoumsatz, rueckerstattungen, verkaufsgebuehr and retouren', async () => {
    mockLoad({
      grund: GRUND,
      kats: [], // keine USt-Parent-Kategorien → Multiplikator 1
      platt: [{ id: PLATT_ID }],
      prod: [{ id: PRODUKT_ID }],
      absatz: [{ sales_plattform_id: PLATT_ID, produkt_id: PRODUKT_ID, jahr: 2026, monat: 4, absatz: 10, effektiver_vk: 20 }],
      retourenAllg: [{ produkt_id: PRODUKT_ID, retourenquote_prozent: 10 }],
      retouren: [{ sales_plattform_id: PLATT_ID, produkt_id: PRODUKT_ID, erstattung_verkaufsgebuehr_prozent: 50, rueckversandkosten_euro_netto: 5 }],
      vkGeb: [{ sales_plattform_id: PLATT_ID, produkt_id: PRODUKT_ID, verkaufsgebuehr_prozent: 15 }],
    })

    const res = await GET(new Request(URL_BASE), ctx())
    expect(res.status).toBe(200)
    const body = await res.json() as Array<{ kategorie: string; wert: number; monat: number }>

    const brutto = body.find(r => r.kategorie === 'bruttoumsatz' && r.monat === 4)
    expect(brutto?.wert).toBe(200) // 10 × 20

    const rueck = body.find(r => r.kategorie === 'rueckerstattungen' && r.monat === 4)
    expect(rueck?.wert).toBe(20) // 0.10 × 200

    // vkGeb = 200×0.15 − 200×0.10×0.5 = 30 − 10 = 20 (USt ×1)
    const vkGeb = body.find(r => r.kategorie === 'verkaufsgebuehr' && r.monat === 4)
    expect(vkGeb?.wert).toBe(20)

    // Retouren = 0.10 × 10 × 5 = 5 (USt ×1)
    const ret = body.find(r => r.kategorie === 'retouren' && r.monat === 4)
    expect(ret?.wert).toBe(5)
  })

  it('applies the USt multiplier on cost categories (Gesamt rate)', async () => {
    const VERTRIEB = '55555555-5555-4555-8555-555555555555'
    const VKGEB_KAT = '66666666-6666-4666-8666-666666666666'
    mockLoad({
      grund: GRUND,
      kats: [
        { id: VERTRIEB, name: 'Vertrieb', parent_id: null, type: 'ausgaben_kosten', level: 1 },
        { id: VKGEB_KAT, name: 'Verkaufsgebühr', parent_id: VERTRIEB, type: 'ausgaben_kosten', level: 2 },
      ],
      platt: [{ id: PLATT_ID }],
      prod: [{ id: PRODUKT_ID }],
      absatz: [{ sales_plattform_id: PLATT_ID, produkt_id: PRODUKT_ID, jahr: 2026, monat: 4, absatz: 10, effektiver_vk: 20 }],
      vkGeb: [{ sales_plattform_id: PLATT_ID, produkt_id: PRODUKT_ID, verkaufsgebuehr_prozent: 15 }],
      // Vertrieb-Parent auf Gesamt (ebene 1) mit 19% → Faktor 1.19
      ustSatz: [{ kategorie_id: VERTRIEB, ebene: 1, ust_satz: 19 }],
      ustEbene: [{ kategorie_id: VERTRIEB, ebene: 1 }],
    })

    const res = await GET(new Request(URL_BASE), ctx())
    expect(res.status).toBe(200)
    const body = await res.json() as Array<{ kategorie: string; wert: number }>
    // vkGeb = 200×0.15 = 30; ×1.19 = 35.70 (keine Retourenquote)
    const vkGeb = body.find(r => r.kategorie === 'verkaufsgebuehr')
    expect(vkGeb?.wert).toBe(35.7)
  })

  it('computes marketing only for channels assigned in Auszahlungseinstellungen', async () => {
    const KANAL_ID = '77777777-7777-4777-8777-777777777777'
    mockLoad({
      grund: GRUND,
      kats: [],
      platt: [{ id: PLATT_ID }],
      prod: [{ id: PRODUKT_ID }],
      absatz: [{ sales_plattform_id: PLATT_ID, produkt_id: PRODUKT_ID, jahr: 2026, monat: 4, absatz: 10, effektiver_vk: 20 }],
      marketingPlan: [{ marketingkanal_id: KANAL_ID, produkt_id: PRODUKT_ID, jahr: 2026, monat: 4, marketingkosten_pct: 10 }],
      marketingEinst: [{ marketingkanal_id: KANAL_ID, sales_plattform_id: PLATT_ID }],
      auszahlung: [{ marketingkanal_id: KANAL_ID }], // Kanal ist zugeordnet
    })

    const res = await GET(new Request(URL_BASE), ctx())
    const body = await res.json() as Array<{ kategorie: string; wert: number; sales_plattform_id: string }>
    const mkt = body.find(r => r.kategorie === 'marketing')
    expect(mkt?.wert).toBe(20) // base 200 × 10% = 20
    expect(mkt?.sales_plattform_id).toBe(KANAL_ID) // Marketing-Zeile trägt die Kanal-ID
  })

  it('omits marketing for channels NOT assigned in Auszahlungseinstellungen', async () => {
    const KANAL_ID = '77777777-7777-4777-8777-777777777777'
    mockLoad({
      grund: GRUND,
      kats: [],
      platt: [{ id: PLATT_ID }],
      prod: [{ id: PRODUKT_ID }],
      absatz: [{ sales_plattform_id: PLATT_ID, produkt_id: PRODUKT_ID, jahr: 2026, monat: 4, absatz: 10, effektiver_vk: 20 }],
      marketingPlan: [{ marketingkanal_id: KANAL_ID, produkt_id: PRODUKT_ID, jahr: 2026, monat: 4, marketingkosten_pct: 10 }],
      marketingEinst: [{ marketingkanal_id: KANAL_ID, sales_plattform_id: PLATT_ID }],
      auszahlung: [], // kein Kanal zugeordnet
    })

    const res = await GET(new Request(URL_BASE), ctx())
    const body = await res.json() as Array<{ kategorie: string }>
    expect(body.find(r => r.kategorie === 'marketing')).toBeUndefined()
  })

  it('returns [] when no platforms or products exist', async () => {
    mockLoad({ grund: GRUND, platt: [], prod: [] })
    const res = await GET(new Request(URL_BASE), ctx())
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual([])
  })

  it('skips cells without an effektiver VK', async () => {
    mockLoad({
      grund: GRUND,
      platt: [{ id: PLATT_ID }],
      prod: [{ id: PRODUKT_ID }],
      absatz: [{ sales_plattform_id: PLATT_ID, produkt_id: PRODUKT_ID, jahr: 2026, monat: 4, absatz: 10, effektiver_vk: null }],
    })
    const res = await GET(new Request(URL_BASE), ctx())
    expect(await res.json()).toEqual([])
  })

  it('returns 404 for foreign/unknown version', async () => {
    mockFrom.mockReturnValueOnce(chain({ data: null, error: null }))
    const res = await GET(new Request(URL_BASE), ctx())
    expect(res.status).toBe(404)
  })

  it('returns 400 for invalid version id', async () => {
    const res = await GET(new Request(URL_BASE), ctx('not-a-uuid'))
    expect(res.status).toBe(400)
  })

  it('returns 401 when unauthenticated', async () => {
    await unauth()
    const res = await GET(new Request(URL_BASE), ctx())
    expect(res.status).toBe(401)
  })
})
