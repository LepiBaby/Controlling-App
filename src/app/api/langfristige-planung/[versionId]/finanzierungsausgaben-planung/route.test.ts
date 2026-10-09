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
const KATEGORIE_ID = '22222222-2222-4222-8222-222222222222'

// Thenable-Chain: jede Methode gibt die Chain zurück; await löst zum Ergebnis auf.
function chain(result: unknown) {
  const c: Record<string, unknown> = { then: (resolve: (v: unknown) => unknown) => resolve(result) }
  for (const m of ['select', 'eq', 'upsert', 'single', 'maybeSingle', 'limit', 'delete', 'order', 'range']) c[m] = () => c
  return c
}

function ctx(id = VERSION_ID) {
  return { params: Promise.resolve({ versionId: id }) }
}
const URL_BASE = `http://localhost/api/langfristige-planung/${VERSION_ID}/finanzierungsausgaben-planung`

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
    new Request(`http://localhost/api/langfristige-planung/${id}/finanzierungsausgaben-planung`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    }),
    ctx(id),
  )
}

const CELL = {
  kategorie_id: KATEGORIE_ID,
  jahr: 2026,
  monat: 4,
  betrag: 1500.5,
}

beforeEach(() => {
  vi.clearAllMocks()
  mockFrom.mockReset()
})

describe('GET /api/langfristige-planung/[versionId]/finanzierungsausgaben-planung', () => {
  it('returns 200 with stored rows', async () => {
    mockFrom.mockReturnValueOnce(chain({ data: { id: VERSION_ID }, error: null })) // version check
    mockFrom.mockReturnValueOnce(chain({ data: [CELL], error: null })) // manuelle Werte
    mockFrom.mockReturnValueOnce(chain({ data: [], error: null })) // Finanzierungen
    const res = await GET(new Request(URL_BASE), ctx())
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(Array.isArray(body)).toBe(true)
    expect(body[0].kategorie_id).toBe(KATEGORIE_ID)
  })

  it('returns [] when no rows', async () => {
    mockFrom.mockReturnValueOnce(chain({ data: { id: VERSION_ID }, error: null }))
    mockFrom.mockReturnValueOnce(chain({ data: [], error: null }))
    mockFrom.mockReturnValueOnce(chain({ data: [], error: null }))
    const res = await GET(new Request(URL_BASE), ctx())
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual([])
  })

  it('adds interest/repayment from financings onto manual values (PROJ-107)', async () => {
    const ZINS = '33333333-3333-4333-8333-333333333333'
    const TILG = '44444444-4444-4444-8444-444444444444'
    mockFrom.mockReturnValueOnce(chain({ data: { id: VERSION_ID }, error: null }))
    mockFrom.mockReturnValueOnce(chain({ data: [{ kategorie_id: ZINS, jahr: 2026, monat: 1, betrag: 10 }], error: null }))
    mockFrom.mockReturnValueOnce(chain({
      data: [{
        id: 'd1', quelle_kbf_id: null, zinsen_kategorie_id: ZINS, tilgung_kategorie_id: TILG, name: 'KfW',
        betrag: 1200, zinssatz: 12, laufzeit_monate: 2, tilgungsfrei_monate: 0, start_jahr: 2026, start_monat: 1, sort_order: 0,
      }],
      error: null,
    }))
    const res = await GET(new Request(URL_BASE), ctx())
    const body = (await res.json()) as Array<{ kategorie_id: string; jahr: number; monat: number; betrag: number }>
    const find = (k: string, m: number) => body.find(r => r.kategorie_id === k && r.monat === m)?.betrag
    expect(find(ZINS, 1)).toBe(22) // 10 manuell + 1200 × 1 %
    expect(find(ZINS, 2)).toBe(6)
    expect(find(TILG, 1)).toBe(600)
    expect(find(TILG, 2)).toBe(600)
  })

  it('returns only manual values with ?nur_manuell=1', async () => {
    mockFrom.mockReturnValueOnce(chain({ data: { id: VERSION_ID }, error: null }))
    mockFrom.mockReturnValueOnce(chain({ data: [CELL], error: null }))
    const res = await GET(new Request(`${URL_BASE}?nur_manuell=1`), ctx())
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual([CELL])
    expect(mockFrom).toHaveBeenCalledTimes(2)
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
    mockFrom.mockReturnValueOnce(chain({ data: [], error: null }))
    const res = await GET(new Request(URL_BASE), ctx())
    expect(res.status).toBe(500)
  })
})

describe('PUT /api/langfristige-planung/[versionId]/finanzierungsausgaben-planung', () => {
  it('upserts a single cell (200)', async () => {
    mockFrom.mockReturnValueOnce(chain({ data: { id: VERSION_ID }, error: null })) // version check
    mockFrom.mockReturnValueOnce(chain({ data: [CELL], error: null })) // upsert
    const res = await put(CELL)
    expect(res.status).toBe(200)
  })

  it('upserts a batch of cells (200)', async () => {
    mockFrom.mockReturnValueOnce(chain({ data: { id: VERSION_ID }, error: null }))
    mockFrom.mockReturnValueOnce(chain({ data: [CELL, CELL], error: null }))
    const res = await put({ cells: [CELL, { ...CELL, monat: 5 }] })
    expect(res.status).toBe(200)
  })

  it('accepts null betrag (clearing a cell)', async () => {
    mockFrom.mockReturnValueOnce(chain({ data: { id: VERSION_ID }, error: null }))
    mockFrom.mockReturnValueOnce(chain({ data: [], error: null }))
    const res = await put({ ...CELL, betrag: null })
    expect(res.status).toBe(200)
  })

  it('accepts betrag = 0 (explicit zero)', async () => {
    mockFrom.mockReturnValueOnce(chain({ data: { id: VERSION_ID }, error: null }))
    mockFrom.mockReturnValueOnce(chain({ data: [{ ...CELL, betrag: 0 }], error: null }))
    const res = await put({ ...CELL, betrag: 0 })
    expect(res.status).toBe(200)
  })

  it('returns 400 on invalid body (missing kategorie_id)', async () => {
    mockFrom.mockReturnValueOnce(chain({ data: { id: VERSION_ID }, error: null }))
    const res = await put({ jahr: 2026, monat: 4, betrag: 100 })
    expect(res.status).toBe(400)
  })

  it('returns 400 on negative betrag', async () => {
    mockFrom.mockReturnValueOnce(chain({ data: { id: VERSION_ID }, error: null }))
    const res = await put({ ...CELL, betrag: -5 })
    expect(res.status).toBe(400)
  })

  it('returns 400 on invalid month', async () => {
    mockFrom.mockReturnValueOnce(chain({ data: { id: VERSION_ID }, error: null }))
    const res = await put({ ...CELL, monat: 13 })
    expect(res.status).toBe(400)
  })

  it('returns 400 on invalid kategorie_id (not uuid)', async () => {
    mockFrom.mockReturnValueOnce(chain({ data: { id: VERSION_ID }, error: null }))
    const res = await put({ ...CELL, kategorie_id: 'nope' })
    expect(res.status).toBe(400)
  })

  it('returns 400 on empty batch', async () => {
    mockFrom.mockReturnValueOnce(chain({ data: { id: VERSION_ID }, error: null }))
    const res = await put({ cells: [] })
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

  it('returns 500 on db error', async () => {
    mockFrom.mockReturnValueOnce(chain({ data: { id: VERSION_ID }, error: null }))
    mockFrom.mockReturnValueOnce(chain({ data: null, error: { message: 'boom' } }))
    const res = await put(CELL)
    expect(res.status).toBe(500)
  })
})
