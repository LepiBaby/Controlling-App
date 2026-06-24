// PROJ-78: Repräsentativ für makeGruppierungVersionRoute (Retouren-Allgemein, versionsweit).
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
  for (const m of ['select', 'eq', 'limit', 'upsert', 'maybeSingle', 'single']) {
    c[m] = () => c
  }
  return c
}

function req(url: string, options?: RequestInit) {
  return new Request(url, options)
}
function ctx(versionId: string) {
  return { params: Promise.resolve({ versionId }) }
}
const baseUrl = `http://localhost/api/langfristige-planung/${VERSION_ID}/vertrieb/retouren-allgemein-einstellungen`

async function unauth() {
  const { requireAuth } = await import('@/lib/supabase-server')
  vi.mocked(requireAuth).mockResolvedValueOnce({
    user: null,
    supabase: null as never,
    error: new Response('Unauthorized', { status: 401 }),
  })
}

beforeEach(() => {
  vi.clearAllMocks()
  mockFrom.mockReset()
})

describe('GET retouren-allgemein-einstellungen', () => {
  it('returns 200 with stored grouping', async () => {
    mockFrom.mockReturnValueOnce(chain({ data: { id: VERSION_ID }, error: null })) // ensureVersion
    mockFrom.mockReturnValueOnce(chain({ data: { gruppierung: 'monatlich', zahlungsziel_tage: 7 }, error: null }))
    const res = await GET(req(baseUrl), ctx(VERSION_ID))
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ gruppierung: 'monatlich', zahlungsziel_tage: 7 })
  })

  it('returns 404 when version is foreign/unknown', async () => {
    mockFrom.mockReturnValueOnce(chain({ data: null, error: null }))
    const res = await GET(req(baseUrl), ctx(VERSION_ID))
    expect(res.status).toBe(404)
  })

  it('returns 401 when unauthenticated', async () => {
    await unauth()
    const res = await GET(req(baseUrl), ctx(VERSION_ID))
    expect(res.status).toBe(401)
  })
})

describe('PUT retouren-allgemein-einstellungen', () => {
  function put(body: unknown) {
    return PUT(
      req(baseUrl, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }),
      ctx(VERSION_ID),
    )
  }

  it('merges + upserts a partial patch (200)', async () => {
    mockFrom.mockReturnValueOnce(chain({ data: { id: VERSION_ID }, error: null })) // ensureVersion
    mockFrom.mockReturnValueOnce(chain({ data: null, error: null })) // existing (none)
    mockFrom.mockReturnValueOnce(chain({ data: { gruppierung: 'quartalsweise', zahlungsziel_tage: null }, error: null })) // upsert
    const res = await put({ gruppierung: 'quartalsweise' })
    expect(res.status).toBe(200)
  })

  it('rejects negative zahlungsziel (400)', async () => {
    const res = await put({ zahlungsziel_tage: -3 })
    expect(res.status).toBe(400)
  })

  it('rejects an empty patch (400)', async () => {
    const res = await put({})
    expect(res.status).toBe(400)
  })
})
