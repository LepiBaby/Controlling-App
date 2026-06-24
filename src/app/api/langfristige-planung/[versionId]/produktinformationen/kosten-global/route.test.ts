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

function chain(result: unknown) {
  const c: Record<string, unknown> = { then: (resolve: (v: unknown) => unknown) => resolve(result) }
  for (const m of ['select', 'eq', 'upsert', 'single', 'maybeSingle']) c[m] = () => c
  return c
}
function ctx() { return { params: Promise.resolve({ versionId: VERSION_ID }) } }
const URL_BASE = `http://localhost/api/langfristige-planung/${VERSION_ID}/produktinformationen/kosten-global`

async function unauth() {
  const { requireAuth } = await import('@/lib/supabase-server')
  vi.mocked(requireAuth).mockResolvedValueOnce({ user: null, supabase: null as never, error: new Response('Unauthorized', { status: 401 }) })
}
function put(body: unknown) {
  return PUT(new Request(URL_BASE, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }), ctx())
}

beforeEach(() => { vi.clearAllMocks(); mockFrom.mockReset() })

describe('kosten-global', () => {
  it('GET returns 200 (null when empty)', async () => {
    mockFrom.mockReturnValueOnce(chain({ data: { id: VERSION_ID }, error: null }))
    mockFrom.mockReturnValueOnce(chain({ data: null, error: null }))
    const res = await GET(new Request(URL_BASE), ctx())
    expect(res.status).toBe(200)
    expect(await res.json()).toBeNull()
  })

  it('GET returns 404 when version foreign', async () => {
    mockFrom.mockReturnValueOnce(chain({ data: null, error: null }))
    expect((await GET(new Request(URL_BASE), ctx())).status).toBe(404)
  })

  it('PUT upserts (200)', async () => {
    mockFrom.mockReturnValueOnce(chain({ data: { id: VERSION_ID }, error: null }))
    mockFrom.mockReturnValueOnce(chain({ data: { id: 'kg1', shipping_kosten_20dc: 1000 }, error: null }))
    expect((await put({ shipping_kosten_20dc: 1000, zoll_zahlungsziel_tage: 30 })).status).toBe(200)
  })

  it('PUT returns 400 on negative cost', async () => {
    mockFrom.mockReturnValueOnce(chain({ data: { id: VERSION_ID }, error: null }))
    expect((await put({ shipping_kosten_20dc: -1 })).status).toBe(400)
  })

  it('PUT returns 401 when unauthenticated', async () => {
    await unauth()
    expect((await put({ shipping_kosten_20dc: 1000 })).status).toBe(401)
  })
})
