// PROJ-78: Repräsentativ für makeProduktPlattformRoute (Versand/Lager/Ersatzteile/Retouren-Plattform).
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
const PLATTFORM_ID = '22222222-2222-4222-8222-222222222222'
const PRODUKT_ID = '33333333-3333-4333-8333-333333333333'

function chain(result: unknown) {
  const c: Record<string, unknown> = { then: (resolve: (v: unknown) => unknown) => resolve(result) }
  for (const m of ['select', 'eq', 'is', 'order', 'limit', 'insert', 'update', 'upsert', 'delete', 'maybeSingle', 'single']) {
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
const baseUrl = `http://localhost/api/langfristige-planung/${VERSION_ID}/vertrieb/versand-einstellungen`

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

describe('GET versand-einstellungen', () => {
  it('returns 200 with the rows', async () => {
    mockFrom.mockReturnValueOnce(chain({ data: { id: VERSION_ID }, error: null })) // ensureVersion
    mockFrom.mockReturnValueOnce(chain({ data: [{ produkt_id: PRODUKT_ID }], error: null })) // list
    const res = await GET(req(`${baseUrl}?plattform_id=${PLATTFORM_ID}`), ctx(VERSION_ID))
    expect(res.status).toBe(200)
    expect(await res.json()).toHaveLength(1)
  })

  it('returns 400 on missing/invalid plattform_id', async () => {
    mockFrom.mockReturnValueOnce(chain({ data: { id: VERSION_ID }, error: null })) // ensureVersion
    const res = await GET(req(baseUrl), ctx(VERSION_ID))
    expect(res.status).toBe(400)
  })

  it('returns 400 on invalid versionId', async () => {
    const res = await GET(req(`${baseUrl}?plattform_id=${PLATTFORM_ID}`), ctx('not-a-uuid'))
    expect(res.status).toBe(400)
  })

  it('returns 404 when version is foreign/unknown', async () => {
    mockFrom.mockReturnValueOnce(chain({ data: null, error: null }))
    const res = await GET(req(`${baseUrl}?plattform_id=${PLATTFORM_ID}`), ctx(VERSION_ID))
    expect(res.status).toBe(404)
  })

  it('returns 401 when unauthenticated', async () => {
    await unauth()
    const res = await GET(req(`${baseUrl}?plattform_id=${PLATTFORM_ID}`), ctx(VERSION_ID))
    expect(res.status).toBe(401)
  })
})

describe('PUT versand-einstellungen', () => {
  function put(body: unknown) {
    return PUT(
      req(baseUrl, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }),
      ctx(VERSION_ID),
    )
  }
  const validBody = {
    sales_plattform_id: PLATTFORM_ID,
    produkt_id: PRODUKT_ID,
    versandgebuehr_spediteur_euro_netto: 4.5,
    versandgebuehr_3pl_euro_netto: null,
  }

  it('upserts and returns 200 (happy path)', async () => {
    mockFrom.mockReturnValueOnce(chain({ data: { id: VERSION_ID }, error: null })) // ensureVersion
    mockFrom.mockReturnValueOnce(chain({ data: { id: PLATTFORM_ID }, error: null })) // plattform check
    mockFrom.mockReturnValueOnce(chain({ data: { id: PRODUKT_ID }, error: null })) // produkt check
    mockFrom.mockReturnValueOnce(chain({ data: validBody, error: null })) // upsert
    const res = await put(validBody)
    expect(res.status).toBe(200)
  })

  it('returns 400 on negative money value', async () => {
    const res = await put({ ...validBody, versandgebuehr_spediteur_euro_netto: -1 })
    expect(res.status).toBe(400)
  })

  it('returns 400 when plattform is foreign to the version', async () => {
    mockFrom.mockReturnValueOnce(chain({ data: { id: VERSION_ID }, error: null })) // ensureVersion
    mockFrom.mockReturnValueOnce(chain({ data: null, error: null })) // plattform check fails
    const res = await put(validBody)
    expect(res.status).toBe(400)
  })

  it('returns 400 when produkt is foreign to the version', async () => {
    mockFrom.mockReturnValueOnce(chain({ data: { id: VERSION_ID }, error: null })) // ensureVersion
    mockFrom.mockReturnValueOnce(chain({ data: { id: PLATTFORM_ID }, error: null })) // plattform ok
    mockFrom.mockReturnValueOnce(chain({ data: null, error: null })) // produkt check fails
    const res = await put(validBody)
    expect(res.status).toBe(400)
  })

  it('returns 404 when version is foreign/unknown', async () => {
    mockFrom.mockReturnValueOnce(chain({ data: null, error: null }))
    const res = await put(validBody)
    expect(res.status).toBe(404)
  })

  it('returns 401 when unauthenticated', async () => {
    await unauth()
    const res = await put(validBody)
    expect(res.status).toBe(401)
  })
})
