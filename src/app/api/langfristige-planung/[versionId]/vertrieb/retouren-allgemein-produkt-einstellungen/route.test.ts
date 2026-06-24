// PROJ-78: Repräsentativ für makeProduktVersionRoute (Retouren-Allgemein-Produkt, manuelle Quote).
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
const baseUrl = `http://localhost/api/langfristige-planung/${VERSION_ID}/vertrieb/retouren-allgemein-produkt-einstellungen`

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

describe('GET retouren-allgemein-produkt-einstellungen', () => {
  it('returns 200 with the rows', async () => {
    mockFrom.mockReturnValueOnce(chain({ data: { id: VERSION_ID }, error: null })) // ensureVersion
    mockFrom.mockReturnValueOnce(chain({ data: [{ produkt_id: PRODUKT_ID, retourenquote_prozent: 5 }], error: null }))
    const res = await GET(req(baseUrl), ctx(VERSION_ID))
    expect(res.status).toBe(200)
    expect(await res.json()).toHaveLength(1)
  })

  it('returns 401 when unauthenticated', async () => {
    await unauth()
    const res = await GET(req(baseUrl), ctx(VERSION_ID))
    expect(res.status).toBe(401)
  })
})

describe('PUT retouren-allgemein-produkt-einstellungen', () => {
  function put(body: unknown) {
    return PUT(
      req(baseUrl, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }),
      ctx(VERSION_ID),
    )
  }
  const validBody = {
    produkt_id: PRODUKT_ID,
    retourenquote_prozent: 12.5,
    retourenhandling_kosten_euro_netto: 1.2,
  }

  it('upserts and returns 200 (happy path)', async () => {
    mockFrom.mockReturnValueOnce(chain({ data: { id: VERSION_ID }, error: null })) // ensureVersion
    mockFrom.mockReturnValueOnce(chain({ data: { id: PRODUKT_ID }, error: null })) // produkt check
    mockFrom.mockReturnValueOnce(chain({ data: validBody, error: null })) // upsert
    const res = await put(validBody)
    expect(res.status).toBe(200)
  })

  it('rejects retourenquote > 100 (400)', async () => {
    const res = await put({ ...validBody, retourenquote_prozent: 150 })
    expect(res.status).toBe(400)
  })

  it('returns 400 when produkt is foreign to the version', async () => {
    mockFrom.mockReturnValueOnce(chain({ data: { id: VERSION_ID }, error: null })) // ensureVersion
    mockFrom.mockReturnValueOnce(chain({ data: null, error: null })) // produkt check fails
    const res = await put(validBody)
    expect(res.status).toBe(400)
  })
})
