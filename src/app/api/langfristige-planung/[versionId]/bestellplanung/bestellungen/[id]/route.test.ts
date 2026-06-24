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
const BESTELL_ID = '44444444-4444-4444-8444-444444444444'

function chain(result: unknown) {
  const c: Record<string, unknown> = { then: (resolve: (v: unknown) => unknown) => resolve(result) }
  for (const m of ['select', 'eq', 'maybeSingle', 'single', 'update', 'delete']) c[m] = () => c
  return c
}

function ctx(versionId = VERSION_ID, id = BESTELL_ID) {
  return { params: Promise.resolve({ versionId, id }) }
}
const URL = `http://localhost/api/langfristige-planung/${VERSION_ID}/bestellplanung/bestellungen/${BESTELL_ID}`

async function unauth() {
  const { requireAuth } = await import('@/lib/supabase-server')
  vi.mocked(requireAuth).mockResolvedValueOnce({
    user: null,
    supabase: null as never,
    error: new Response('Unauthorized', { status: 401 }),
  })
}

function put(body: unknown, id = BESTELL_ID) {
  return PUT(
    new Request(URL, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }),
    ctx(VERSION_ID, id),
  )
}

const ROW = { id: BESTELL_ID, produkt_id: 'p1', menge_praktisch: 60 }

beforeEach(() => {
  vi.clearAllMocks()
  mockFrom.mockReset()
})

describe('GET bestellungen/[id]', () => {
  it('returns the order (200)', async () => {
    mockFrom.mockReturnValueOnce(chain({ data: { id: VERSION_ID }, error: null }))
    mockFrom.mockReturnValueOnce(chain({ data: ROW, error: null }))
    const res = await GET(new Request(URL), ctx())
    expect(res.status).toBe(200)
    expect((await res.json()).id).toBe(BESTELL_ID)
  })

  it('returns 404 when not found', async () => {
    mockFrom.mockReturnValueOnce(chain({ data: { id: VERSION_ID }, error: null }))
    mockFrom.mockReturnValueOnce(chain({ data: null, error: null }))
    const res = await GET(new Request(URL), ctx())
    expect(res.status).toBe(404)
  })

  it('returns 400 on invalid id', async () => {
    mockFrom.mockReturnValueOnce(chain({ data: { id: VERSION_ID }, error: null }))
    const res = await GET(new Request(URL), ctx(VERSION_ID, 'bad-id'))
    expect(res.status).toBe(400)
  })

  it('returns 401 when unauthenticated', async () => {
    await unauth()
    const res = await GET(new Request(URL), ctx())
    expect(res.status).toBe(401)
  })
})

describe('PUT bestellungen/[id]', () => {
  it('updates dates + menge (200)', async () => {
    mockFrom.mockReturnValueOnce(chain({ data: { id: VERSION_ID }, error: null }))
    mockFrom.mockReturnValueOnce(chain({ data: { ...ROW, menge_praktisch: 80 }, error: null }))
    const res = await put({ menge_praktisch: 80, bestelldatum: '2026-06-15', manuell_geaendert: true })
    expect(res.status).toBe(200)
    expect((await res.json()).menge_praktisch).toBe(80)
  })

  it('returns 404 when not found', async () => {
    mockFrom.mockReturnValueOnce(chain({ data: { id: VERSION_ID }, error: null }))
    mockFrom.mockReturnValueOnce(chain({ data: null, error: null }))
    const res = await put({ menge_praktisch: 80 })
    expect(res.status).toBe(404)
  })

  it('returns 400 on negative menge', async () => {
    mockFrom.mockReturnValueOnce(chain({ data: { id: VERSION_ID }, error: null }))
    const res = await put({ menge_praktisch: -5 })
    expect(res.status).toBe(400)
  })

  it('returns 401 when unauthenticated', async () => {
    await unauth()
    const res = await put({ menge_praktisch: 80 })
    expect(res.status).toBe(401)
  })
})

describe('DELETE bestellungen/[id]', () => {
  it('deletes the order (200)', async () => {
    mockFrom.mockReturnValueOnce(chain({ data: { id: VERSION_ID }, error: null }))
    mockFrom.mockReturnValueOnce(chain({ error: null }))
    const res = await DELETE(new Request(URL, { method: 'DELETE' }), ctx())
    expect(res.status).toBe(200)
  })

  it('returns 404 for foreign version', async () => {
    mockFrom.mockReturnValueOnce(chain({ data: null, error: null }))
    const res = await DELETE(new Request(URL, { method: 'DELETE' }), ctx())
    expect(res.status).toBe(404)
  })

  it('returns 401 when unauthenticated', async () => {
    await unauth()
    const res = await DELETE(new Request(URL, { method: 'DELETE' }), ctx())
    expect(res.status).toBe(401)
  })
})
