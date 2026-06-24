import { describe, it, expect, vi, beforeEach } from 'vitest'
import { GET, PUT, DELETE } from './route'

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
const PLATT_ID = '44444444-4444-4444-8444-444444444444'

// Thenable-Chain: jede Methode gibt die Chain zurück; await löst zum Ergebnis auf.
function chain(result: unknown) {
  const c: Record<string, unknown> = { then: (resolve: (v: unknown) => unknown) => resolve(result) }
  for (const m of ['select', 'eq', 'in', 'upsert', 'single', 'maybeSingle', 'limit', 'delete']) c[m] = () => c
  return c
}

function ctx(id = VERSION_ID) {
  return { params: Promise.resolve({ versionId: id }) }
}
const URL_BASE = `http://localhost/api/langfristige-planung/${VERSION_ID}/sales-plattform-planung`

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
    new Request(`http://localhost/api/langfristige-planung/${id}/sales-plattform-planung`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    }),
    ctx(id),
  )
}

const CELL = {
  kategorie: 'bruttoumsatz',
  produkt_id: PRODUKT_ID,
  sales_plattform_id: PLATT_ID,
  jahr: 2026,
  monat: 4,
  wert_manuell: 199.99,
}

beforeEach(() => {
  vi.clearAllMocks()
  mockFrom.mockReset()
})

describe('GET /api/langfristige-planung/[versionId]/sales-plattform-planung', () => {
  it('returns 200 with stored rows', async () => {
    mockFrom.mockReturnValueOnce(chain({ data: { id: VERSION_ID }, error: null })) // version
    mockFrom.mockReturnValueOnce(chain({ data: [CELL], error: null })) // values
    const res = await GET(new Request(URL_BASE), ctx())
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(Array.isArray(body)).toBe(true)
    expect(body[0].produkt_id).toBe(PRODUKT_ID)
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

describe('PUT /api/langfristige-planung/[versionId]/sales-plattform-planung', () => {
  it('upserts a single cell (200)', async () => {
    mockFrom.mockReturnValueOnce(chain({ data: { id: VERSION_ID }, error: null })) // version
    mockFrom.mockReturnValueOnce(chain({ data: CELL, error: null })) // upsert
    const res = await put(CELL)
    expect(res.status).toBe(200)
  })

  it('deletes the cell when wert_manuell is null (200)', async () => {
    mockFrom.mockReturnValueOnce(chain({ data: { id: VERSION_ID }, error: null })) // version
    mockFrom.mockReturnValueOnce(chain({ error: null })) // delete
    const res = await put({ ...CELL, wert_manuell: null })
    expect(res.status).toBe(200)
  })

  it('returns 400 on invalid body (missing ids)', async () => {
    const res = await put({ jahr: 2026, monat: 4 })
    expect(res.status).toBe(400)
  })

  it('returns 400 on invalid kategorie', async () => {
    const res = await put({ ...CELL, kategorie: 'unsinn' })
    expect(res.status).toBe(400)
  })

  it('returns 400 on invalid month', async () => {
    const res = await put({ ...CELL, monat: 13 })
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
    mockFrom.mockReturnValueOnce(chain({ data: { id: VERSION_ID }, error: null }))
    mockFrom.mockReturnValueOnce(chain({ data: null, error: { message: 'boom' } }))
    const res = await put(CELL)
    expect(res.status).toBe(500)
  })
})

describe('DELETE /api/langfristige-planung/[versionId]/sales-plattform-planung', () => {
  it('deletes all manual values and notes (200)', async () => {
    mockFrom.mockReturnValueOnce(chain({ data: { id: VERSION_ID }, error: null })) // version
    mockFrom.mockReturnValueOnce(chain({ error: null })) // delete planung
    mockFrom.mockReturnValueOnce(chain({ error: null })) // delete notizen
    const res = await DELETE(new Request(URL_BASE, { method: 'DELETE' }), ctx())
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ ok: true })
  })

  it('returns 500 when deleting planung fails', async () => {
    mockFrom.mockReturnValueOnce(chain({ data: { id: VERSION_ID }, error: null }))
    mockFrom.mockReturnValueOnce(chain({ error: { message: 'boom' } }))
    const res = await DELETE(new Request(URL_BASE, { method: 'DELETE' }), ctx())
    expect(res.status).toBe(500)
  })

  it('returns 404 for foreign version', async () => {
    mockFrom.mockReturnValueOnce(chain({ data: null, error: null }))
    const res = await DELETE(new Request(URL_BASE, { method: 'DELETE' }), ctx())
    expect(res.status).toBe(404)
  })

  it('returns 401 when unauthenticated', async () => {
    await unauth()
    const res = await DELETE(new Request(URL_BASE, { method: 'DELETE' }), ctx())
    expect(res.status).toBe(401)
  })
})
