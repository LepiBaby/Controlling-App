// PROJ-78: Repräsentativ für makeGruppierungPlattformRoute (Versand/Lager/Ersatzteile).
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
const baseUrl = `http://localhost/api/langfristige-planung/${VERSION_ID}/vertrieb/versand-plattform-einstellungen`

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

describe('GET versand-plattform-einstellungen', () => {
  it('returns 200 with stored grouping', async () => {
    mockFrom.mockReturnValueOnce(chain({ data: { id: VERSION_ID }, error: null })) // ensureVersion
    mockFrom.mockReturnValueOnce(chain({ data: { gruppierung: 'quartalsweise', zahlungsziel_tage: 14 }, error: null }))
    const res = await GET(req(`${baseUrl}?plattform_id=${PLATTFORM_ID}`), ctx(VERSION_ID))
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ gruppierung: 'quartalsweise', zahlungsziel_tage: 14 })
  })

  it('returns 200 with null when no entry yet', async () => {
    mockFrom.mockReturnValueOnce(chain({ data: { id: VERSION_ID }, error: null })) // ensureVersion
    mockFrom.mockReturnValueOnce(chain({ data: null, error: null }))
    const res = await GET(req(`${baseUrl}?plattform_id=${PLATTFORM_ID}`), ctx(VERSION_ID))
    expect(res.status).toBe(200)
    expect(await res.json()).toBeNull()
  })

  it('returns 400 on missing plattform_id', async () => {
    mockFrom.mockReturnValueOnce(chain({ data: { id: VERSION_ID }, error: null }))
    const res = await GET(req(baseUrl), ctx(VERSION_ID))
    expect(res.status).toBe(400)
  })
})

describe('PUT versand-plattform-einstellungen', () => {
  function put(body: unknown) {
    return PUT(
      req(baseUrl, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }),
      ctx(VERSION_ID),
    )
  }

  it('merges + upserts a partial patch (200)', async () => {
    mockFrom.mockReturnValueOnce(chain({ data: { id: VERSION_ID }, error: null })) // ensureVersion
    mockFrom.mockReturnValueOnce(chain({ data: { id: PLATTFORM_ID }, error: null })) // plattform check
    mockFrom.mockReturnValueOnce(chain({ data: { gruppierung: 'monatlich', zahlungsziel_tage: null }, error: null })) // existing
    mockFrom.mockReturnValueOnce(chain({ data: { gruppierung: 'quartalsweise', zahlungsziel_tage: null }, error: null })) // upsert
    const res = await put({ sales_plattform_id: PLATTFORM_ID, gruppierung: 'quartalsweise' })
    expect(res.status).toBe(200)
  })

  it('rejects "woechentlich" (400)', async () => {
    const res = await put({ sales_plattform_id: PLATTFORM_ID, gruppierung: 'woechentlich' })
    expect(res.status).toBe(400)
  })

  it('rejects an empty patch (400)', async () => {
    const res = await put({ sales_plattform_id: PLATTFORM_ID })
    expect(res.status).toBe(400)
  })

  it('returns 400 when plattform is foreign to the version', async () => {
    mockFrom.mockReturnValueOnce(chain({ data: { id: VERSION_ID }, error: null })) // ensureVersion
    mockFrom.mockReturnValueOnce(chain({ data: null, error: null })) // plattform check fails
    const res = await put({ sales_plattform_id: PLATTFORM_ID, gruppierung: 'monatlich' })
    expect(res.status).toBe(400)
  })

  it('returns 401 when unauthenticated', async () => {
    await unauth()
    const res = await put({ sales_plattform_id: PLATTFORM_ID, gruppierung: 'monatlich' })
    expect(res.status).toBe(401)
  })
})
