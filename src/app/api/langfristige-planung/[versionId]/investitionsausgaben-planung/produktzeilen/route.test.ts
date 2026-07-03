import { describe, it, expect, vi, beforeEach } from 'vitest'
import { GET, PUT, DELETE } from './route'

// PROJ-105: Tests der versions- & nutzergebundenen Produktzeilen-Route.
// Muster gespiegelt aus der Schwester-Route (investitionsausgaben-planung/route.test.ts),
// aber die Thenable-Chain implementiert zusätzlich `order`/`range`, weil GET über
// fetchAllRows paginiert.

const mockFrom = vi.fn()

vi.mock('@/lib/supabase-server', () => ({
  requireAuth: vi.fn().mockResolvedValue({
    user: { id: 'user-1', email: 'test@test.com' },
    supabase: { from: (table: string) => mockFrom(table) },
    error: null,
  }),
}))

const VERSION_ID = '11111111-1111-4111-8111-111111111111'
const KATEGORIE_ID = '22222222-2222-4222-8222-222222222222'
const PRODUKT_ID = '33333333-3333-4333-8333-333333333333'

// Thenable-Chain: jede Methode gibt die Chain zurück; await löst zum Ergebnis auf.
function chain(result: unknown) {
  const c: Record<string, unknown> = { then: (resolve: (v: unknown) => unknown) => resolve(result) }
  for (const m of ['select', 'eq', 'upsert', 'single', 'maybeSingle', 'limit', 'delete', 'order', 'range']) {
    c[m] = () => c
  }
  return c
}

function ctx(id = VERSION_ID) {
  return { params: Promise.resolve({ versionId: id }) }
}
const URL_BASE = `http://localhost/api/langfristige-planung/${VERSION_ID}/investitionsausgaben-planung/produktzeilen`

async function unauth() {
  const { requireAuth } = await import('@/lib/supabase-server')
  vi.mocked(requireAuth).mockResolvedValueOnce({
    user: null,
    supabase: null as never,
    error: new Response('Unauthorized', { status: 401 }),
  })
}

function put(body: unknown, id = VERSION_ID) {
  return PUT(
    new Request(`http://localhost/api/langfristige-planung/${id}/investitionsausgaben-planung/produktzeilen`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    }),
    ctx(id),
  )
}

function del(body: unknown, id = VERSION_ID) {
  return DELETE(
    new Request(`http://localhost/api/langfristige-planung/${id}/investitionsausgaben-planung/produktzeilen`, {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    }),
    ctx(id),
  )
}

const ROW = { kategorie_id: KATEGORIE_ID, produkt_id: PRODUKT_ID }

beforeEach(() => {
  vi.clearAllMocks()
  mockFrom.mockReset()
})

describe('GET produktzeilen', () => {
  it('returns 200 with stored rows', async () => {
    mockFrom.mockReturnValueOnce(chain({ data: { id: VERSION_ID }, error: null })) // version check
    mockFrom.mockReturnValueOnce(chain({ data: [ROW], error: null })) // rows (paginated)
    const res = await GET(new Request(URL_BASE), ctx())
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(Array.isArray(body)).toBe(true)
    expect(body[0]).toEqual(ROW)
  })

  it('returns [] when no rows', async () => {
    mockFrom.mockReturnValueOnce(chain({ data: { id: VERSION_ID }, error: null }))
    mockFrom.mockReturnValueOnce(chain({ data: [], error: null }))
    const res = await GET(new Request(URL_BASE), ctx())
    expect(res.status).toBe(200)
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

  it('returns 500 on db error', async () => {
    mockFrom.mockReturnValueOnce(chain({ data: { id: VERSION_ID }, error: null }))
    mockFrom.mockReturnValueOnce(chain({ data: null, error: { message: 'boom' } }))
    const res = await GET(new Request(URL_BASE), ctx())
    expect(res.status).toBe(500)
  })
})

describe('PUT produktzeilen', () => {
  it('adds a row (200)', async () => {
    mockFrom.mockReturnValueOnce(chain({ data: { id: VERSION_ID }, error: null })) // version check
    mockFrom.mockReturnValueOnce(chain({ data: ROW, error: null })) // upsert
    const res = await put(ROW)
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual(ROW)
  })

  it('is idempotent: returns row payload even when upsert ignores duplicate (null)', async () => {
    mockFrom.mockReturnValueOnce(chain({ data: { id: VERSION_ID }, error: null }))
    mockFrom.mockReturnValueOnce(chain({ data: null, error: null })) // ignoreDuplicates → no row returned
    const res = await put(ROW)
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual(ROW)
  })

  it('returns 400 on missing produkt_id', async () => {
    const res = await put({ kategorie_id: KATEGORIE_ID })
    expect(res.status).toBe(400)
  })

  it('returns 400 on invalid kategorie_id (not uuid)', async () => {
    const res = await put({ kategorie_id: 'nope', produkt_id: PRODUKT_ID })
    expect(res.status).toBe(400)
  })

  it('returns 404 for foreign version', async () => {
    mockFrom.mockReturnValueOnce(chain({ data: null, error: null }))
    const res = await put(ROW)
    expect(res.status).toBe(404)
  })

  it('returns 401 when unauthenticated', async () => {
    await unauth()
    const res = await put(ROW)
    expect(res.status).toBe(401)
  })

  it('returns 500 on db error', async () => {
    mockFrom.mockReturnValueOnce(chain({ data: { id: VERSION_ID }, error: null }))
    mockFrom.mockReturnValueOnce(chain({ data: null, error: { message: 'boom' } }))
    const res = await put(ROW)
    expect(res.status).toBe(500)
  })
})

describe('DELETE produktzeilen', () => {
  it('removes a row (200)', async () => {
    mockFrom.mockReturnValueOnce(chain({ data: { id: VERSION_ID }, error: null })) // version check
    mockFrom.mockReturnValueOnce(chain({ error: null })) // delete
    const res = await del(ROW)
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ ok: true })
  })

  it('returns 400 on invalid body', async () => {
    const res = await del({ kategorie_id: KATEGORIE_ID })
    expect(res.status).toBe(400)
  })

  it('returns 404 for foreign version', async () => {
    mockFrom.mockReturnValueOnce(chain({ data: null, error: null }))
    const res = await del(ROW)
    expect(res.status).toBe(404)
  })

  it('returns 401 when unauthenticated', async () => {
    await unauth()
    const res = await del(ROW)
    expect(res.status).toBe(401)
  })

  it('returns 500 on db error', async () => {
    mockFrom.mockReturnValueOnce(chain({ data: { id: VERSION_ID }, error: null }))
    mockFrom.mockReturnValueOnce(chain({ error: { message: 'boom' } }))
    const res = await del(ROW)
    expect(res.status).toBe(500)
  })
})
