import { describe, it, expect, vi, beforeEach } from 'vitest'
import { GET, POST } from './route'

const mockFrom = vi.fn()

vi.mock('@/lib/supabase-server', () => ({
  requireAuth: vi.fn().mockResolvedValue({
    user: { id: 'user-1', email: 'test@test.com' },
    supabase: { from: (table: string) => mockFrom(table) },
    error: null,
  }),
}))

const VERSION_ID = '11111111-1111-4111-8111-111111111111'
const BESTELL_ID = '44444444-4444-4444-8444-444444444444'
const PRODUKT_ID = '33333333-3333-4333-8333-333333333333'

function chain(result: unknown) {
  const c: Record<string, unknown> = { then: (resolve: (v: unknown) => unknown) => resolve(result) }
  for (const m of ['select', 'eq', 'in', 'order', 'limit', 'maybeSingle', 'single', 'delete', 'insert'])
    c[m] = () => c
  return c
}

function ctx(versionId = VERSION_ID, id = BESTELL_ID) {
  return { params: Promise.resolve({ versionId, id }) }
}
const URL = `http://localhost/api/langfristige-planung/${VERSION_ID}/bestellplanung/bestellungen/${BESTELL_ID}/kosten`

async function unauth() {
  const { requireAuth } = await import('@/lib/supabase-server')
  vi.mocked(requireAuth).mockResolvedValueOnce({
    user: null,
    supabase: null as never,
    error: new Response('Unauthorized', { status: 401 }),
  })
}

const BESTELLUNG = {
  id: BESTELL_ID,
  produkt_id: PRODUKT_ID,
  menge_praktisch: 100,
  bestelldatum: '2026-06-01',
  produktionsende_datum: '2026-07-01',
  shippingdatum: '2026-07-01',
  ankunftsdatum: '2026-09-01',
  verfuegbarkeitsdatum: '2026-09-04',
  anzahl_20dc: 1,
  anzahl_40hq: 0,
  container_anteil: null,
}

beforeEach(() => {
  vi.clearAllMocks()
  mockFrom.mockReset()
})

describe('GET bestellungen/[id]/kosten', () => {
  it('regenerates and returns costs (200)', async () => {
    mockFrom.mockReturnValueOnce(chain({ data: { id: VERSION_ID }, error: null })) // version
    mockFrom.mockReturnValueOnce(chain({ data: BESTELLUNG, error: null })) // load bestellung
    // generiere: delete auto, manuell select, pk, zk, kg
    mockFrom.mockReturnValueOnce(chain({ error: null })) // delete auto
    mockFrom.mockReturnValueOnce(chain({ data: [], error: null })) // manuell slots
    mockFrom.mockReturnValueOnce(chain({ data: [{ produkt_id: PRODUKT_ID, warenkosten: 10, zollsatz_pct: 5 }], error: null })) // produktkosten
    mockFrom.mockReturnValueOnce(chain({ data: [{ produkt_id: PRODUKT_ID, vor_produktion_pct: 100, nach_produktion_pct: 0, nach_ankunft_pct: 0, zahlungsziel_vor_produktion_tage: 0, zahlungsziel_nach_produktion_tage: 0, zahlungsziel_nach_ankunft_tage: 0 }], error: null })) // zahlungskonditionen
    mockFrom.mockReturnValueOnce(chain({ data: null, error: null })) // kosten_global
    mockFrom.mockReturnValueOnce(chain({ data: [], error: null })) // kpi_categories (produktUnterkategorien)
    mockFrom.mockReturnValueOnce(chain({ error: null })) // insert auto
    mockFrom.mockReturnValueOnce(chain({ data: [{ id: 'k1', kpi_kategorie_id: null, datum: '2026-06-01', nettobetrag: 1000, begruendung: 'Ware', ist_automatisch: true, created_at: 'x' }], error: null })) // kosten select
    const res = await GET(new Request(URL), ctx())
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(Array.isArray(body)).toBe(true)
    expect(body[0].nettobetrag).toBe(1000)
  })

  it('returns 404 when bestellung not found', async () => {
    mockFrom.mockReturnValueOnce(chain({ data: { id: VERSION_ID }, error: null })) // version
    mockFrom.mockReturnValueOnce(chain({ data: null, error: null })) // bestellung missing
    const res = await GET(new Request(URL), ctx())
    expect(res.status).toBe(404)
  })

  it('returns 400 on invalid bestellung id', async () => {
    mockFrom.mockReturnValueOnce(chain({ data: { id: VERSION_ID }, error: null })) // version
    const res = await GET(new Request(URL), ctx(VERSION_ID, 'not-a-uuid'))
    expect(res.status).toBe(400)
  })

  it('returns 404 for foreign version', async () => {
    mockFrom.mockReturnValueOnce(chain({ data: null, error: null }))
    const res = await GET(new Request(URL), ctx())
    expect(res.status).toBe(404)
  })

  it('returns 401 when unauthenticated', async () => {
    await unauth()
    const res = await GET(new Request(URL), ctx())
    expect(res.status).toBe(401)
  })
})

describe('POST bestellungen/[id]/kosten', () => {
  function postReq(body: unknown) {
    return new Request(URL, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
  }
  const VALID = { datum: '2026-06-10', nettobetrag: 50, kpi_kategorie_id: null, begruendung: 'Test' }

  it('creates a manual entry (201)', async () => {
    mockFrom.mockReturnValueOnce(chain({ data: { id: VERSION_ID }, error: null })) // version
    mockFrom.mockReturnValueOnce(chain({ data: { id: BESTELL_ID }, error: null })) // bestellung exists
    mockFrom.mockReturnValueOnce(chain({ data: { id: 'k9', kpi_kategorie_id: null, datum: '2026-06-10', nettobetrag: 50, begruendung: 'Test', ist_automatisch: false, created_at: 'x' }, error: null })) // insert
    const res = await POST(postReq(VALID), ctx())
    expect(res.status).toBe(201)
    expect((await res.json()).ist_automatisch).toBe(false)
  })

  it('returns 400 for invalid body', async () => {
    mockFrom.mockReturnValueOnce(chain({ data: { id: VERSION_ID }, error: null })) // version
    mockFrom.mockReturnValueOnce(chain({ data: { id: BESTELL_ID }, error: null })) // bestellung exists
    const res = await POST(postReq({ datum: 'bad', nettobetrag: -1 }), ctx())
    expect(res.status).toBe(400)
  })

  it('returns 404 when bestellung not found', async () => {
    mockFrom.mockReturnValueOnce(chain({ data: { id: VERSION_ID }, error: null })) // version
    mockFrom.mockReturnValueOnce(chain({ data: null, error: null })) // bestellung missing
    const res = await POST(postReq(VALID), ctx())
    expect(res.status).toBe(404)
  })

  it('returns 401 when unauthenticated', async () => {
    await unauth()
    const res = await POST(postReq(VALID), ctx())
    expect(res.status).toBe(401)
  })
})
