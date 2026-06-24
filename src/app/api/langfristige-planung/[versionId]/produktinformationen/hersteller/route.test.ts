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

function chain(result: unknown) {
  const c: Record<string, unknown> = { then: (resolve: (v: unknown) => unknown) => resolve(result) }
  for (const m of ['select', 'eq', 'order', 'limit', 'insert', 'update', 'delete', 'maybeSingle', 'single']) {
    c[m] = () => c
  }
  return c
}
function ctx(versionId: string) {
  return { params: Promise.resolve({ versionId }) }
}
const URL_BASE = `http://localhost/api/langfristige-planung/${VERSION_ID}/produktinformationen/hersteller`

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

describe('GET hersteller', () => {
  it('returns 200 with list', async () => {
    mockFrom.mockReturnValueOnce(chain({ data: { id: VERSION_ID }, error: null }))
    mockFrom.mockReturnValueOnce(chain({ data: [{ id: 'h1', name: 'Acme' }], error: null }))
    const res = await GET(new Request(URL_BASE), ctx(VERSION_ID))
    expect(res.status).toBe(200)
    expect(await res.json()).toHaveLength(1)
  })

  it('returns 400 on invalid versionId', async () => {
    const res = await GET(new Request(URL_BASE), ctx('not-a-uuid'))
    expect(res.status).toBe(400)
  })

  it('returns 404 when version foreign/unknown', async () => {
    mockFrom.mockReturnValueOnce(chain({ data: null, error: null }))
    const res = await GET(new Request(URL_BASE), ctx(VERSION_ID))
    expect(res.status).toBe(404)
  })

  it('returns 401 when unauthenticated', async () => {
    await unauth()
    const res = await GET(new Request(URL_BASE), ctx(VERSION_ID))
    expect(res.status).toBe(401)
  })
})

describe('POST hersteller', () => {
  function post(body: unknown) {
    return POST(
      new Request(URL_BASE, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }),
      ctx(VERSION_ID),
    )
  }

  it('creates (201)', async () => {
    mockFrom.mockReturnValueOnce(chain({ data: { id: VERSION_ID }, error: null }))
    mockFrom.mockReturnValueOnce(chain({ data: { id: 'h-new', name: 'Acme' }, error: null }))
    const res = await post({ name: 'Acme' })
    expect(res.status).toBe(201)
  })

  it('returns 400 on empty name', async () => {
    mockFrom.mockReturnValueOnce(chain({ data: { id: VERSION_ID }, error: null }))
    const res = await post({ name: '   ' })
    expect(res.status).toBe(400)
  })

  it('returns 409 on duplicate', async () => {
    mockFrom.mockReturnValueOnce(chain({ data: { id: VERSION_ID }, error: null }))
    mockFrom.mockReturnValueOnce(chain({ data: null, error: { code: '23505', message: 'dup' } }))
    const res = await post({ name: 'Acme' })
    expect(res.status).toBe(409)
  })

  it('returns 404 when version foreign', async () => {
    mockFrom.mockReturnValueOnce(chain({ data: null, error: null }))
    const res = await post({ name: 'Acme' })
    expect(res.status).toBe(404)
  })

  it('returns 401 when unauthenticated', async () => {
    await unauth()
    const res = await post({ name: 'Acme' })
    expect(res.status).toBe(401)
  })
})
