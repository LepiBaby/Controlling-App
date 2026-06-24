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
const PRODUKT_ID = '33333333-3333-4333-8333-333333333333'

// Thenable-Chain: jede Methode gibt die Chain zurück; await löst zum Ergebnis auf.
function chain(result: unknown) {
  const c: Record<string, unknown> = { then: (resolve: (v: unknown) => unknown) => resolve(result) }
  for (const m of ['select', 'eq', 'maybeSingle', 'limit']) c[m] = () => c
  return c
}

function ctx(id = VERSION_ID) {
  return { params: Promise.resolve({ versionId: id }) }
}
const URL = `http://localhost/api/langfristige-planung/${VERSION_ID}/investitionsausgaben-planung/berechnet`

async function unauth() {
  const { requireAuth } = await import('@/lib/supabase-server')
  vi.mocked(requireAuth).mockResolvedValueOnce({
    user: null,
    supabase: null as never,
    error: new Response('Unauthorized', { status: 401 }),
  })
}

// Standard-Stammdaten: Einkauf-Übergruppe + Untergruppe "Ware"; globale Kategorie "Ware".
const GRUND = { startmonat_monat: 4, startmonat_jahr: 2026, planungshorizont_monate: 12 }
const INVEST_KATS = [
  { id: 'einkauf-l1', name: 'Produktinvestitionen Einkauf', parent_id: null, level: 1 },
  { id: 'ware-l2', name: 'Ware', parent_id: 'einkauf-l1', level: 2 },
  { id: 'wertverlust-l2', name: 'Wertverlust Ware', parent_id: 'einkauf-l1', level: 2 },
]
const GLOBAL_KATS = [{ id: 'g-ware', name: 'Ware' }]

// Reihenfolge der from()-Aufrufe in GET:
//   1) version check
//   2) grundeinstellungen   3) lp_investition   4) kpi_categories (global)
//   5) langfristige_bestellungen (erstbestellungen)   6) langfristige_bestellungen_kosten
function seedHappy(opts: {
  bestellungen: unknown[]
  kosten: unknown[]
  investKats?: unknown[]
}) {
  mockFrom.mockReturnValueOnce(chain({ data: { id: VERSION_ID }, error: null }))
  mockFrom.mockReturnValueOnce(chain({ data: GRUND, error: null }))
  mockFrom.mockReturnValueOnce(chain({ data: opts.investKats ?? INVEST_KATS, error: null }))
  mockFrom.mockReturnValueOnce(chain({ data: GLOBAL_KATS, error: null }))
  mockFrom.mockReturnValueOnce(chain({ data: opts.bestellungen, error: null }))
  mockFrom.mockReturnValueOnce(chain({ data: opts.kosten, error: null }))
}

beforeEach(() => {
  vi.clearAllMocks()
  mockFrom.mockReset()
})

describe('GET investitionsausgaben-planung/berechnet', () => {
  it('returns 401 when unauthenticated', async () => {
    await unauth()
    const res = await GET(new Request(URL), ctx())
    expect(res.status).toBe(401)
  })

  it('returns 400 for invalid version id', async () => {
    const res = await GET(new Request(URL), ctx('not-a-uuid'))
    expect(res.status).toBe(400)
  })

  it('returns 404 for foreign/unknown version', async () => {
    mockFrom.mockReturnValueOnce(chain({ data: null, error: null }))
    const res = await GET(new Request(URL), ctx())
    expect(res.status).toBe(404)
  })

  it('returns empty data when version has no Einkauf subgroups', async () => {
    mockFrom.mockReturnValueOnce(chain({ data: { id: VERSION_ID }, error: null }))
    mockFrom.mockReturnValueOnce(chain({ data: GRUND, error: null }))
    mockFrom.mockReturnValueOnce(chain({ data: [{ id: 'op-l1', name: 'Produktinvestitionen Operations', parent_id: null, level: 1 }], error: null }))
    mockFrom.mockReturnValueOnce(chain({ data: GLOBAL_KATS, error: null }))
    const res = await GET(new Request(URL), ctx())
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ data: [] })
  })

  it('computes Einkauf value from an Erstbestellung cost row (grouped by payment month)', async () => {
    seedHappy({
      bestellungen: [{ id: 'best-1', produkt_id: PRODUKT_ID, ist_erstbestellung: true }],
      kosten: [
        { bestellung_id: 'best-1', kpi_kategorie_id: 'g-ware', datum: '2026-04-15', nettobetrag: 1000 },
        { bestellung_id: 'best-1', kpi_kategorie_id: 'g-ware', datum: '2026-04-28', nettobetrag: 250.5 },
      ],
    })
    const res = await GET(new Request(URL), ctx())
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.data).toHaveLength(1)
    expect(body.data[0]).toEqual({
      kategorie_id: 'ware-l2',
      produkt_id: PRODUKT_ID,
      jahr: 2026,
      monat: 4,
      wert: 1250.5,
    })
  })

  it('ignores cost rows of non-Erstbestellungen', async () => {
    // Bestellungen-Query filtert bereits auf ist_erstbestellung=true → leeres Resultat,
    // d.h. die Kostenzeile findet kein Produkt und wird übersprungen.
    seedHappy({
      bestellungen: [],
      kosten: [{ bestellung_id: 'best-x', kpi_kategorie_id: 'g-ware', datum: '2026-04-15', nettobetrag: 1000 }],
    })
    const res = await GET(new Request(URL), ctx())
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ data: [] })
  })

  it('skips cost categories without a matching Einkauf subgroup (e.g. Wertverlust Ware)', async () => {
    seedHappy({
      bestellungen: [{ id: 'best-1', produkt_id: PRODUKT_ID, ist_erstbestellung: true }],
      // globale Kategorie "Zoll" existiert nicht als Einkauf-Untergruppe der Version
      kosten: [{ bestellung_id: 'best-1', kpi_kategorie_id: 'g-zoll-unknown', datum: '2026-04-15', nettobetrag: 800 }],
    })
    const res = await GET(new Request(URL), ctx())
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ data: [] })
  })

  it('skips cost rows whose payment month is outside the planning window', async () => {
    seedHappy({
      bestellungen: [{ id: 'best-1', produkt_id: PRODUKT_ID, ist_erstbestellung: true }],
      // Startmonat 04/2026, Horizont 12 → Fenster Apr 2026 .. Mär 2027; 01/2026 liegt davor
      kosten: [{ bestellung_id: 'best-1', kpi_kategorie_id: 'g-ware', datum: '2026-01-15', nettobetrag: 999 }],
    })
    const res = await GET(new Request(URL), ctx())
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ data: [] })
  })

  it('returns 500 on invest-categories db error', async () => {
    mockFrom.mockReturnValueOnce(chain({ data: { id: VERSION_ID }, error: null }))
    mockFrom.mockReturnValueOnce(chain({ data: GRUND, error: null }))
    mockFrom.mockReturnValueOnce(chain({ data: null, error: { message: 'boom' } }))
    mockFrom.mockReturnValueOnce(chain({ data: GLOBAL_KATS, error: null }))
    const res = await GET(new Request(URL), ctx())
    expect(res.status).toBe(500)
  })
})
