import { describe, it, expect, vi, beforeEach } from 'vitest'
import { GET, POST, PUT } from './route'

const mockFrom = vi.fn()

vi.mock('@/lib/supabase-server', () => ({
  requireAuth: vi.fn().mockResolvedValue({
    user: { id: 'user-1', email: 'test@test.com' },
    supabase: { from: (table: string) => mockFrom(table) },
    error: null,
  }),
}))

const VERSION_ID = '11111111-1111-4111-8111-111111111111'
const ROW_ID = '22222222-2222-4222-8222-222222222222'

// Universeller thenable Query-Builder (siehe kpi-kategorien route.test.ts).
function chain(result: unknown) {
  const c: Record<string, unknown> = { then: (resolve: (v: unknown) => unknown) => resolve(result) }
  for (const m of ['select', 'eq', 'neq', 'is', 'order', 'limit', 'insert', 'update', 'delete', 'upsert', 'maybeSingle', 'single']) {
    c[m] = () => c
  }
  return c
}

function req(url: string, options?: RequestInit) {
  return new Request(url, options)
}
function ctx(versionId: string) {
  return { params: Promise.resolve({ versionId }) }
}
const URL_BASE = `http://localhost/api/langfristige-planung/${VERSION_ID}/kapitalbedarf-finanzierung`

// Seed-Select liefert alle drei festen Zeilen → kein Insert nötig.
function seededSelect() {
  return chain({
    data: [
      { zeilen_art: 'investitionen' },
      { zeilen_art: 'betriebsmittelbedarf' },
      { zeilen_art: 'liquiditaetsreserve' },
    ],
    error: null,
  })
}

async function unauth() {
  const { requireAuth } = await import('@/lib/supabase-server')
  vi.mocked(requireAuth).mockResolvedValueOnce({
    user: null,
    supabase: null as never,
    error: new Response('Unauthorized', { status: 401 }),
  })
}

beforeEach(() => {
  vi.clearAllMocks()
  mockFrom.mockReset()
})

describe('GET /kapitalbedarf-finanzierung', () => {
  it('returns 200 with rows (after seed)', async () => {
    mockFrom.mockReturnValueOnce(chain({ data: { id: VERSION_ID }, error: null })) // ensureVersion
    mockFrom.mockReturnValueOnce(seededSelect()) // seed existence check (all present)
    mockFrom.mockReturnValueOnce(chain({ data: [{ id: ROW_ID, bereich: 'kapitalbedarf' }], error: null })) // list
    const res = await GET(req(URL_BASE), ctx(VERSION_ID))
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body).toHaveLength(1)
  })

  it('returns 400 on invalid versionId', async () => {
    const res = await GET(req(URL_BASE), ctx('not-a-uuid'))
    expect(res.status).toBe(400)
  })

  it('returns 404 when version not found / foreign', async () => {
    mockFrom.mockReturnValueOnce(chain({ data: null, error: null }))
    const res = await GET(req(URL_BASE), ctx(VERSION_ID))
    expect(res.status).toBe(404)
  })

  it('returns 401 when unauthenticated', async () => {
    await unauth()
    const res = await GET(req(URL_BASE), ctx(VERSION_ID))
    expect(res.status).toBe(401)
  })
})

describe('POST /kapitalbedarf-finanzierung', () => {
  function post(body: unknown) {
    return POST(
      req(URL_BASE, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }),
      ctx(VERSION_ID),
    )
  }

  it('creates a manual eigenkapital row (201)', async () => {
    mockFrom.mockReturnValueOnce(chain({ data: { id: VERSION_ID }, error: null })) // ensureVersion
    mockFrom.mockReturnValueOnce(chain({ data: [{ sort_order: 2 }], error: null })) // max sort_order
    mockFrom.mockReturnValueOnce(chain({ data: { id: 'new', bereich: 'eigenkapital' }, error: null })) // insert
    const res = await post({ bereich: 'eigenkapital', bezeichnung: 'Stammkapital', betrag: 25000 })
    expect(res.status).toBe(201)
  })

  it('creates a manual fremdkapital row with detail fields (201)', async () => {
    mockFrom.mockReturnValueOnce(chain({ data: { id: VERSION_ID }, error: null }))
    mockFrom.mockReturnValueOnce(chain({ data: [], error: null })) // no existing → sort 0
    mockFrom.mockReturnValueOnce(chain({ data: { id: 'new', bereich: 'fremdkapital' }, error: null }))
    const res = await post({
      bereich: 'fremdkapital',
      bezeichnung: 'Bankdarlehen',
      betrag: 100000,
      zinssatz: 4.5,
      laufzeit_jahre: 60,
      tilgungsfrei_jahre: 12,
    })
    expect(res.status).toBe(201)
  })

  it('returns 400 on empty bezeichnung', async () => {
    mockFrom.mockReturnValueOnce(chain({ data: { id: VERSION_ID }, error: null }))
    const res = await post({ bereich: 'kapitalbedarf', bezeichnung: '   ', betrag: 5 })
    expect(res.status).toBe(400)
  })

  it('returns 400 on invalid bereich', async () => {
    mockFrom.mockReturnValueOnce(chain({ data: { id: VERSION_ID }, error: null }))
    const res = await post({ bereich: 'quatsch', bezeichnung: 'X', betrag: 5 })
    expect(res.status).toBe(400)
  })

  it('returns 404 when version not found', async () => {
    mockFrom.mockReturnValueOnce(chain({ data: null, error: null }))
    const res = await post({ bereich: 'kapitalbedarf', bezeichnung: 'X', betrag: 5 })
    expect(res.status).toBe(404)
  })

  it('returns 401 when unauthenticated', async () => {
    await unauth()
    const res = await post({ bereich: 'kapitalbedarf', bezeichnung: 'X', betrag: 5 })
    expect(res.status).toBe(401)
  })
})

describe('PUT /kapitalbedarf-finanzierung (reorder)', () => {
  function put(body: unknown) {
    return PUT(
      req(URL_BASE, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }),
      ctx(VERSION_ID),
    )
  }

  it('reorders owned rows (200)', async () => {
    mockFrom.mockReturnValueOnce(chain({ data: { id: VERSION_ID }, error: null })) // ensureVersion
    mockFrom.mockReturnValueOnce(chain({ data: [{ id: ROW_ID }], error: null })) // owned ids
    mockFrom.mockReturnValueOnce(chain({ data: null, error: null })) // update
    const res = await put({ order: [{ id: ROW_ID, sort_order: 0 }] })
    expect(res.status).toBe(200)
  })

  it('returns 400 on invalid payload', async () => {
    mockFrom.mockReturnValueOnce(chain({ data: { id: VERSION_ID }, error: null }))
    const res = await put({ order: [] })
    expect(res.status).toBe(400)
  })

  it('returns 401 when unauthenticated', async () => {
    await unauth()
    const res = await put({ order: [{ id: ROW_ID, sort_order: 0 }] })
    expect(res.status).toBe(401)
  })
})
