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
const KAT_ID = '22222222-2222-4222-8222-222222222222'

// Thenable-Chain: jede Methode gibt die Chain zurück; await löst zum Ergebnis auf.
function chain(result: unknown) {
  const c: Record<string, unknown> = { then: (resolve: (v: unknown) => unknown) => resolve(result) }
  for (const m of ['select', 'eq', 'in', 'upsert', 'single', 'maybeSingle', 'limit', 'delete']) c[m] = () => c
  return c
}

function ctx(id = VERSION_ID) {
  return { params: Promise.resolve({ versionId: id }) }
}
const URL_BASE = `http://localhost/api/langfristige-planung/${VERSION_ID}/einnahmen-planung`

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
    new Request(`http://localhost/api/langfristige-planung/${id}/einnahmen-planung`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    }),
    ctx(id),
  )
}

const CELL = { kategorie_id: KAT_ID, jahr: 2026, monat: 4, betrag_manuell: 1500.5 }

beforeEach(() => {
  vi.clearAllMocks()
  mockFrom.mockReset()
})

describe('GET /api/langfristige-planung/[versionId]/einnahmen-planung', () => {
  it('returns 200 with stored rows', async () => {
    mockFrom.mockReturnValueOnce(chain({ data: { id: VERSION_ID }, error: null })) // version
    mockFrom.mockReturnValueOnce(chain({ data: [CELL], error: null })) // values
    const res = await GET(new Request(URL_BASE), ctx())
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(Array.isArray(body)).toBe(true)
    expect(body[0].kategorie_id).toBe(KAT_ID)
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

  it('returns 500 when query fails', async () => {
    mockFrom.mockReturnValueOnce(chain({ data: { id: VERSION_ID }, error: null }))
    mockFrom.mockReturnValueOnce(chain({ data: null, error: { message: 'DB error' } }))
    const res = await GET(new Request(URL_BASE), ctx())
    expect(res.status).toBe(500)
  })
})

describe('PUT /api/langfristige-planung/[versionId]/einnahmen-planung', () => {
  it('upserts a value and returns the stored row', async () => {
    mockFrom.mockReturnValueOnce(chain({ data: { id: VERSION_ID }, error: null })) // version
    mockFrom.mockReturnValueOnce(chain({ data: CELL, error: null })) // upsert
    const res = await put(CELL)
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.betrag_manuell).toBe(1500.5)
  })

  it('deletes the entry when betrag_manuell is null (einzelnes Zurücksetzen)', async () => {
    mockFrom.mockReturnValueOnce(chain({ data: { id: VERSION_ID }, error: null })) // version
    mockFrom.mockReturnValueOnce(chain({ data: null, error: null })) // delete
    const res = await put({ ...CELL, betrag_manuell: null })
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ ok: true })
  })

  it('returns 400 for invalid body (bad month)', async () => {
    const res = await put({ ...CELL, monat: 13 })
    expect(res.status).toBe(400)
  })

  it('returns 400 for non-uuid kategorie_id', async () => {
    const res = await put({ ...CELL, kategorie_id: 'nope' })
    expect(res.status).toBe(400)
  })

  it('returns 404 for foreign version (after validation passes)', async () => {
    mockFrom.mockReturnValueOnce(chain({ data: null, error: null })) // version not found
    const res = await put(CELL)
    expect(res.status).toBe(404)
  })

  it('returns 401 when unauthenticated', async () => {
    await unauth()
    const res = await put(CELL)
    expect(res.status).toBe(401)
  })

  it('returns 500 when upsert fails', async () => {
    mockFrom.mockReturnValueOnce(chain({ data: { id: VERSION_ID }, error: null }))
    mockFrom.mockReturnValueOnce(chain({ data: null, error: { message: 'upsert failed' } }))
    const res = await put(CELL)
    expect(res.status).toBe(500)
  })
})

describe('DELETE /api/langfristige-planung/[versionId]/einnahmen-planung', () => {
  it('deletes all values and notes of the version', async () => {
    mockFrom.mockReturnValueOnce(chain({ data: { id: VERSION_ID }, error: null })) // version
    mockFrom.mockReturnValueOnce(chain({ data: null, error: null })) // delete values
    mockFrom.mockReturnValueOnce(chain({ data: null, error: null })) // delete notizen
    const res = await DELETE(new Request(URL_BASE, { method: 'DELETE' }), ctx())
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ ok: true })
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

  it('returns 500 when delete fails', async () => {
    mockFrom.mockReturnValueOnce(chain({ data: { id: VERSION_ID }, error: null }))
    mockFrom.mockReturnValueOnce(chain({ data: null, error: { message: 'delete failed' } }))
    const res = await DELETE(new Request(URL_BASE, { method: 'DELETE' }), ctx())
    expect(res.status).toBe(500)
  })
})
