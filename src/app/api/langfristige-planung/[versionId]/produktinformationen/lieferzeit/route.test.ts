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
const PRODUKT_ID = '44444444-4444-4444-8444-444444444444'

function chain(result: unknown) {
  const c: Record<string, unknown> = { then: (resolve: (v: unknown) => unknown) => resolve(result) }
  for (const m of ['select', 'eq', 'limit', 'upsert', 'single', 'maybeSingle']) c[m] = () => c
  return c
}
function ctx() { return { params: Promise.resolve({ versionId: VERSION_ID }) } }
const URL_BASE = `http://localhost/api/langfristige-planung/${VERSION_ID}/produktinformationen/lieferzeit`

async function unauth() {
  const { requireAuth } = await import('@/lib/supabase-server')
  vi.mocked(requireAuth).mockResolvedValueOnce({ user: null, supabase: null as never, error: new Response('Unauthorized', { status: 401 }) })
}
function put(body: unknown) {
  return PUT(new Request(URL_BASE, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }), ctx())
}

beforeEach(() => { vi.clearAllMocks(); mockFrom.mockReset() })

describe('lieferzeit', () => {
  it('GET returns 200', async () => {
    mockFrom.mockReturnValueOnce(chain({ data: { id: VERSION_ID }, error: null }))
    mockFrom.mockReturnValueOnce(chain({ data: [], error: null }))
    expect((await GET(new Request(URL_BASE), ctx())).status).toBe(200)
  })

  it('GET returns 404 when version foreign', async () => {
    mockFrom.mockReturnValueOnce(chain({ data: null, error: null }))
    expect((await GET(new Request(URL_BASE), ctx())).status).toBe(404)
  })

  it('PUT upserts (200)', async () => {
    mockFrom.mockReturnValueOnce(chain({ data: { id: VERSION_ID }, error: null }))
    mockFrom.mockReturnValueOnce(chain({ data: { id: 'l1', produkt_id: PRODUKT_ID }, error: null }))
    expect((await put({ produkt_id: PRODUKT_ID, produktionszeit_tage: 5, shipping_zeit_tage: 30 })).status).toBe(200)
  })

  it('PUT returns 400 on negative days', async () => {
    mockFrom.mockReturnValueOnce(chain({ data: { id: VERSION_ID }, error: null }))
    expect((await put({ produkt_id: PRODUKT_ID, produktionszeit_tage: -5 })).status).toBe(400)
  })

  it('PUT returns 401 when unauthenticated', async () => {
    await unauth()
    expect((await put({ produkt_id: PRODUKT_ID, produktionszeit_tage: 5 })).status).toBe(401)
  })
})
