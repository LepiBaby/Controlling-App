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
const PRODUKT_ID = '33333333-3333-4333-8333-333333333333'

function chain(result: unknown) {
  const c: Record<string, unknown> = { then: (resolve: (v: unknown) => unknown) => resolve(result) }
  for (const m of ['select', 'eq', 'upsert', 'single', 'maybeSingle', 'limit']) c[m] = () => c
  return c
}
function ctx() { return { params: Promise.resolve({ versionId: VERSION_ID }) } }
const URL_BASE = `http://localhost/api/langfristige-planung/${VERSION_ID}/steuereinstellungen/fiskalverzollung`

async function unauth() {
  const { requireAuth } = await import('@/lib/supabase-server')
  vi.mocked(requireAuth).mockResolvedValueOnce({ user: null, supabase: null as never, error: new Response('Unauthorized', { status: 401 }) })
}
function put(body: unknown) {
  return PUT(new Request(URL_BASE, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }), ctx())
}

beforeEach(() => { vi.clearAllMocks(); mockFrom.mockReset() })

describe('langfristige steuereinstellungen/fiskalverzollung', () => {
  it('GET returns 200 (empty array)', async () => {
    mockFrom.mockReturnValueOnce(chain({ data: { id: VERSION_ID }, error: null }))
    mockFrom.mockReturnValueOnce(chain({ data: [], error: null }))
    const res = await GET(new Request(URL_BASE), ctx())
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual([])
  })

  it('GET returns 404 when version foreign/unknown', async () => {
    mockFrom.mockReturnValueOnce(chain({ data: null, error: null }))
    expect((await GET(new Request(URL_BASE), ctx())).status).toBe(404)
  })

  it('PUT upserts (200)', async () => {
    mockFrom.mockReturnValueOnce(chain({ data: { id: VERSION_ID }, error: null }))
    mockFrom.mockReturnValueOnce(chain({ data: { produkt_id: PRODUKT_ID, fiskalverzollung: true }, error: null }))
    expect((await put({ produkt_id: PRODUKT_ID, fiskalverzollung: true })).status).toBe(200)
  })

  it('PUT returns 400 on non-uuid produkt_id', async () => {
    mockFrom.mockReturnValueOnce(chain({ data: { id: VERSION_ID }, error: null }))
    expect((await put({ produkt_id: 'nope', fiskalverzollung: true })).status).toBe(400)
  })

  it('PUT returns 400 on missing fiskalverzollung', async () => {
    mockFrom.mockReturnValueOnce(chain({ data: { id: VERSION_ID }, error: null }))
    expect((await put({ produkt_id: PRODUKT_ID })).status).toBe(400)
  })

  it('PUT returns 401 when unauthenticated', async () => {
    await unauth()
    expect((await put({ produkt_id: PRODUKT_ID, fiskalverzollung: true })).status).toBe(401)
  })
})
