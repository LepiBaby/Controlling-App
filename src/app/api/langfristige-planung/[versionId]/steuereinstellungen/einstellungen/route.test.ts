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
  for (const m of ['select', 'eq', 'upsert', 'single', 'maybeSingle', 'limit']) c[m] = () => c
  return c
}
function ctx() { return { params: Promise.resolve({ versionId: VERSION_ID }) } }
const URL_BASE = `http://localhost/api/langfristige-planung/${VERSION_ID}/steuereinstellungen/einstellungen`

async function unauth() {
  const { requireAuth } = await import('@/lib/supabase-server')
  vi.mocked(requireAuth).mockResolvedValueOnce({ user: null, supabase: null as never, error: new Response('Unauthorized', { status: 401 }) })
}
function put(body: unknown) {
  return PUT(new Request(URL_BASE, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }), ctx())
}

beforeEach(() => { vi.clearAllMocks(); mockFrom.mockReset() })

describe('langfristige steuereinstellungen/einstellungen', () => {
  it('GET returns 200 with defaults when empty', async () => {
    mockFrom.mockReturnValueOnce(chain({ data: { id: VERSION_ID }, error: null }))
    mockFrom.mockReturnValueOnce(chain({ data: null, error: null }))
    const res = await GET(new Request(URL_BASE), ctx())
    expect(res.status).toBe(200)
    expect(await res.json()).toMatchObject({ zahlungsfrequenz: 'monatlich', einfuhrust_satz: 0 })
  })

  it('GET returns 404 when version foreign/unknown', async () => {
    mockFrom.mockReturnValueOnce(chain({ data: null, error: null }))
    expect((await GET(new Request(URL_BASE), ctx())).status).toBe(404)
  })

  it('PUT upserts (200)', async () => {
    mockFrom.mockReturnValueOnce(chain({ data: { id: VERSION_ID }, error: null }))
    mockFrom.mockReturnValueOnce(chain({ data: { zahlungsfrequenz: 'quartalsweise', zahlungsverschiebung_tage: 5, einfuhrust_zahlungsziel_tage: 30, einfuhrust_satz: 19, ust_satz_pflegeebene: 1 }, error: null }))
    expect((await put({ zahlungsfrequenz: 'quartalsweise', einfuhrust_satz: 19 })).status).toBe(200)
  })

  it('PUT returns 400 on empty body', async () => {
    mockFrom.mockReturnValueOnce(chain({ data: { id: VERSION_ID }, error: null }))
    expect((await put({})).status).toBe(400)
  })

  it('PUT returns 400 on invalid frequency', async () => {
    mockFrom.mockReturnValueOnce(chain({ data: { id: VERSION_ID }, error: null }))
    expect((await put({ zahlungsfrequenz: 'woechentlich' })).status).toBe(400)
  })

  it('PUT returns 400 on out-of-range einfuhrust_satz', async () => {
    mockFrom.mockReturnValueOnce(chain({ data: { id: VERSION_ID }, error: null }))
    expect((await put({ einfuhrust_satz: 150 })).status).toBe(400)
  })

  it('PUT returns 401 when unauthenticated', async () => {
    await unauth()
    expect((await put({ einfuhrust_satz: 19 })).status).toBe(401)
  })
})
