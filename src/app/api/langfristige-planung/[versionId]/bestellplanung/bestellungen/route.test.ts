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
const PRODUKT_ID = '33333333-3333-4333-8333-333333333333'

function chain(result: unknown) {
  const c: Record<string, unknown> = { then: (resolve: (v: unknown) => unknown) => resolve(result) }
  for (const m of ['select', 'eq', 'in', 'or', 'order', 'limit', 'maybeSingle', 'single', 'insert', 'update', 'delete', 'upsert'])
    c[m] = () => c
  return c
}

function ctx(id = VERSION_ID) {
  return { params: Promise.resolve({ versionId: id }) }
}
const URL_BASE = `http://localhost/api/langfristige-planung/${VERSION_ID}/bestellplanung/bestellungen`

async function unauth() {
  const { requireAuth } = await import('@/lib/supabase-server')
  vi.mocked(requireAuth).mockResolvedValueOnce({
    user: null,
    supabase: null as never,
    error: new Response('Unauthorized', { status: 401 }),
  })
}

function post(body: unknown, id = VERSION_ID) {
  return POST(
    new Request(`http://localhost/api/langfristige-planung/${id}/bestellplanung/bestellungen`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    }),
    ctx(id),
  )
}

beforeEach(() => {
  vi.clearAllMocks()
  mockFrom.mockReset()
})

describe('GET bestellungen', () => {
  it('returns 200 with an empty list', async () => {
    mockFrom.mockReturnValueOnce(chain({ data: { id: VERSION_ID }, error: null })) // version check
    mockFrom.mockReturnValueOnce(chain({ data: [], error: null })) // bestellungen
    const res = await GET(new Request(URL_BASE), ctx())
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual([])
  })

  it('returns 200 with rows incl. produkt_name + konsolidiert_mit', async () => {
    mockFrom.mockReturnValueOnce(chain({ data: { id: VERSION_ID }, error: null })) // version
    mockFrom.mockReturnValueOnce(chain({ data: [{ id: 'b1', produkt_id: PRODUKT_ID }], error: null })) // bestellungen
    mockFrom.mockReturnValueOnce(chain({ data: [{ id: PRODUKT_ID, name: 'Produkt 1' }], error: null })) // names
    mockFrom.mockReturnValueOnce(chain({ data: [], error: null })) // konsolidierungen
    const res = await GET(new Request(URL_BASE), ctx())
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body[0].produkt_name).toBe('Produkt 1')
    expect(body[0].konsolidiert_mit).toEqual([])
  })

  it('enriches konsolidiert_mit partners with container_anteil + bestelldatum', async () => {
    const b1 = { id: 'b1', produkt_id: PRODUKT_ID, bestelldatum: '2026-06-21', anzahl_40hq: 0, anzahl_20dc: 1, container_anteil: { '40HQ': 0.35 } }
    const b2 = { id: 'b2', produkt_id: 'p2', bestelldatum: '2026-06-22', anzahl_40hq: 0, anzahl_20dc: 1, container_anteil: { '40HQ': 0.65 } }
    mockFrom.mockReturnValueOnce(chain({ data: { id: VERSION_ID }, error: null })) // version
    mockFrom.mockReturnValueOnce(chain({ data: [b1, b2], error: null })) // bestellungen
    mockFrom.mockReturnValueOnce(chain({ data: [{ id: PRODUKT_ID, name: 'FlexiCo' }, { id: 'p2', name: 'MaliDa' }], error: null })) // names
    mockFrom.mockReturnValueOnce(chain({ data: [{ bestellung_id_1: 'b1', bestellung_id_2: 'b2', containerart: '20DC' }], error: null })) // konsolidierungen
    const res = await GET(new Request(URL_BASE), ctx())
    expect(res.status).toBe(200)
    const body = await res.json()
    const partner = body.find((x: { id: string }) => x.id === 'b1').konsolidiert_mit[0]
    expect(partner.bestellung_id).toBe('b2')
    expect(partner.produkt_name).toBe('MaliDa')
    expect(partner.bestelldatum).toBe('2026-06-22')
    expect(partner.container_anteil).toEqual({ '40HQ': 0.65 })
    expect(partner.anzahl_20dc).toBe(1)
  })

  it('returns 404 for foreign version', async () => {
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

describe('POST bestellungen', () => {
  it('creates a manual order (201)', async () => {
    mockFrom.mockReturnValueOnce(chain({ data: { id: VERSION_ID }, error: null })) // version
    mockFrom.mockReturnValueOnce(chain({ data: { id: 'new-id' }, error: null })) // insert
    const res = await post({ produkt_id: PRODUKT_ID, menge_praktisch: 100, bestelldatum: '2026-06-01' })
    expect(res.status).toBe(201)
    expect((await res.json()).id).toBe('new-id')
  })

  it('returns 400 on missing produkt_id', async () => {
    mockFrom.mockReturnValueOnce(chain({ data: { id: VERSION_ID }, error: null }))
    const res = await post({ menge_praktisch: 100 })
    expect(res.status).toBe(400)
  })

  it('returns 400 on bad date format', async () => {
    mockFrom.mockReturnValueOnce(chain({ data: { id: VERSION_ID }, error: null }))
    const res = await post({ produkt_id: PRODUKT_ID, bestelldatum: '01.06.2026' })
    expect(res.status).toBe(400)
  })

  it('returns 404 for foreign version', async () => {
    mockFrom.mockReturnValueOnce(chain({ data: null, error: null }))
    const res = await post({ produkt_id: PRODUKT_ID })
    expect(res.status).toBe(404)
  })

  it('returns 401 when unauthenticated', async () => {
    await unauth()
    const res = await post({ produkt_id: PRODUKT_ID })
    expect(res.status).toBe(401)
  })
})
