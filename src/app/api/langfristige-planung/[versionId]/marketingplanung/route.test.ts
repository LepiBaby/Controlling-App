import { describe, it, expect, vi, beforeEach } from 'vitest'
import { GET, PUT } from './route'

const mockFrom = vi.fn()

vi.mock('@/lib/supabase-server', () => ({
  requireAuth: vi.fn().mockResolvedValue({
    user: { id: 'user-1', email: 'test@test.com' },
    supabase: { from: (table: string) => mockFrom(table) },
    error: null,
  }),
}))

const VERSION_ID = '11111111-1111-4111-8111-111111111111'
const KANAL_ID = '22222222-2222-4222-8222-222222222222'
const PRODUKT_ID = '33333333-3333-4333-8333-333333333333'

// Thenable-Chain: jede Methode gibt die Chain zurück; await löst zum Ergebnis auf.
function chain(result: unknown) {
  const c: Record<string, unknown> = { then: (resolve: (v: unknown) => unknown) => resolve(result) }
  for (const m of ['select', 'eq', 'in', 'upsert', 'single', 'maybeSingle', 'limit', 'delete']) c[m] = () => c
  return c
}

function ctx(id = VERSION_ID) {
  return { params: Promise.resolve({ versionId: id }) }
}
const URL_BASE = `http://localhost/api/langfristige-planung/${VERSION_ID}/marketingplanung`

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
    new Request(`http://localhost/api/langfristige-planung/${id}/marketingplanung`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    }),
    ctx(id),
  )
}

const CELL = {
  marketingkanal_id: KANAL_ID,
  produkt_id: PRODUKT_ID,
  jahr: 2026,
  monat: 4,
  marketingkosten_pct: 12.5,
}

// Mockt die übliche PUT-Erfolgs-Kette: Version → Kanal-Check → Produkt-Check → Upsert.
function mockPutHappy(upsertResult: unknown) {
  mockFrom.mockReturnValueOnce(chain({ data: { id: VERSION_ID }, error: null })) // version
  mockFrom.mockReturnValueOnce(chain({ data: [{ id: KANAL_ID }], error: null })) // kanal
  mockFrom.mockReturnValueOnce(chain({ data: [{ id: PRODUKT_ID }], error: null })) // produkt
  mockFrom.mockReturnValueOnce(chain(upsertResult)) // upsert
}

beforeEach(() => {
  vi.clearAllMocks()
  mockFrom.mockReset()
})

describe('GET /api/langfristige-planung/[versionId]/marketingplanung', () => {
  it('returns 200 with stored rows', async () => {
    mockFrom.mockReturnValueOnce(chain({ data: { id: VERSION_ID }, error: null })) // version check
    mockFrom.mockReturnValueOnce(chain({ data: [CELL], error: null })) // values
    const res = await GET(new Request(URL_BASE), ctx())
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(Array.isArray(body)).toBe(true)
    expect(body[0].marketingkanal_id).toBe(KANAL_ID)
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

describe('PUT /api/langfristige-planung/[versionId]/marketingplanung', () => {
  it('upserts a single cell (200)', async () => {
    mockPutHappy({ data: [CELL], error: null })
    const res = await put(CELL)
    expect(res.status).toBe(200)
  })

  it('upserts a batch of cells (200)', async () => {
    mockPutHappy({ data: [CELL, CELL], error: null })
    const res = await put({ cells: [CELL, { ...CELL, monat: 5 }] })
    expect(res.status).toBe(200)
  })

  it('accepts null pct (clearing a cell)', async () => {
    mockPutHappy({ data: [], error: null })
    const res = await put({ ...CELL, marketingkosten_pct: null })
    expect(res.status).toBe(200)
  })

  it('returns 400 on invalid body (missing ids)', async () => {
    mockFrom.mockReturnValueOnce(chain({ data: { id: VERSION_ID }, error: null }))
    const res = await put({ jahr: 2026, monat: 4 })
    expect(res.status).toBe(400)
  })

  it('returns 400 on pct > 100', async () => {
    mockFrom.mockReturnValueOnce(chain({ data: { id: VERSION_ID }, error: null }))
    const res = await put({ ...CELL, marketingkosten_pct: 150 })
    expect(res.status).toBe(400)
  })

  it('returns 400 on negative pct', async () => {
    mockFrom.mockReturnValueOnce(chain({ data: { id: VERSION_ID }, error: null }))
    const res = await put({ ...CELL, marketingkosten_pct: -1 })
    expect(res.status).toBe(400)
  })

  it('returns 400 on invalid month', async () => {
    mockFrom.mockReturnValueOnce(chain({ data: { id: VERSION_ID }, error: null }))
    const res = await put({ ...CELL, monat: 13 })
    expect(res.status).toBe(400)
  })

  it('returns 400 on empty batch', async () => {
    mockFrom.mockReturnValueOnce(chain({ data: { id: VERSION_ID }, error: null }))
    const res = await put({ cells: [] })
    expect(res.status).toBe(400)
  })

  it('returns 400 when marketingkanal does not belong to version', async () => {
    mockFrom.mockReturnValueOnce(chain({ data: { id: VERSION_ID }, error: null })) // version
    mockFrom.mockReturnValueOnce(chain({ data: [], error: null })) // kanal check → not found
    const res = await put(CELL)
    expect(res.status).toBe(400)
  })

  it('returns 400 when produkt does not belong to version', async () => {
    mockFrom.mockReturnValueOnce(chain({ data: { id: VERSION_ID }, error: null })) // version
    mockFrom.mockReturnValueOnce(chain({ data: [{ id: KANAL_ID }], error: null })) // kanal ok
    mockFrom.mockReturnValueOnce(chain({ data: [], error: null })) // produkt → not found
    const res = await put(CELL)
    expect(res.status).toBe(400)
  })

  it('returns 404 for foreign version', async () => {
    mockFrom.mockReturnValueOnce(chain({ data: null, error: null }))
    const res = await put(CELL)
    expect(res.status).toBe(404)
  })

  it('returns 401 when unauthenticated', async () => {
    await unauth()
    const res = await put(CELL)
    expect(res.status).toBe(401)
  })

  it('returns 500 on db error during upsert', async () => {
    mockPutHappy({ data: null, error: { message: 'boom' } })
    const res = await put(CELL)
    expect(res.status).toBe(500)
  })
})
