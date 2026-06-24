import { describe, it, expect, vi, beforeEach } from 'vitest'
import { GET, POST } from './route'

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

function chain(result: unknown) {
  const c: Record<string, unknown> = { then: (resolve: (v: unknown) => unknown) => resolve(result) }
  for (const m of ['select', 'eq', 'upsert', 'single', 'maybeSingle', 'limit']) c[m] = () => c
  return c
}
function ctx() { return { params: Promise.resolve({ versionId: VERSION_ID }) } }
const URL_BASE = `http://localhost/api/langfristige-planung/${VERSION_ID}/steuereinstellungen/ebene-auswahl`

async function unauth() {
  const { requireAuth } = await import('@/lib/supabase-server')
  vi.mocked(requireAuth).mockResolvedValueOnce({ user: null, supabase: null as never, error: new Response('Unauthorized', { status: 401 }) })
}
function post(body: unknown) {
  return POST(new Request(URL_BASE, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }), ctx())
}

beforeEach(() => { vi.clearAllMocks(); mockFrom.mockReset() })

describe('langfristige steuereinstellungen/ebene-auswahl', () => {
  it('GET returns 200 as keyed record', async () => {
    mockFrom.mockReturnValueOnce(chain({ data: { id: VERSION_ID }, error: null }))
    mockFrom.mockReturnValueOnce(chain({ data: [{ kategorie_id: KAT_ID, ebene: 2 }], error: null }))
    const res = await GET(new Request(URL_BASE), ctx())
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ [KAT_ID]: 2 })
  })

  it('GET returns 404 when version foreign/unknown', async () => {
    mockFrom.mockReturnValueOnce(chain({ data: null, error: null }))
    expect((await GET(new Request(URL_BASE), ctx())).status).toBe(404)
  })

  it('POST upserts (200)', async () => {
    mockFrom.mockReturnValueOnce(chain({ data: { id: VERSION_ID }, error: null }))
    mockFrom.mockReturnValueOnce(chain({ error: null }))
    expect((await post([{ kategorie_id: KAT_ID, ebene: 2 }])).status).toBe(200)
  })

  it('POST returns 400 on invalid ebene', async () => {
    mockFrom.mockReturnValueOnce(chain({ data: { id: VERSION_ID }, error: null }))
    expect((await post([{ kategorie_id: KAT_ID, ebene: 3 }])).status).toBe(400)
  })

  it('POST returns 400 on non-uuid kategorie_id', async () => {
    mockFrom.mockReturnValueOnce(chain({ data: { id: VERSION_ID }, error: null }))
    expect((await post([{ kategorie_id: 'nope', ebene: 1 }])).status).toBe(400)
  })

  it('POST returns 401 when unauthenticated', async () => {
    await unauth()
    expect((await post([{ kategorie_id: KAT_ID, ebene: 2 }])).status).toBe(401)
  })
})
