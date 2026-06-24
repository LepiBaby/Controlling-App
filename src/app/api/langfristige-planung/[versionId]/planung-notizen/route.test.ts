import { describe, it, expect, vi, beforeEach } from 'vitest'
import { GET, PUT, DELETE } from './route'

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
  for (const m of ['select', 'eq', 'upsert', 'single', 'maybeSingle', 'limit', 'delete']) c[m] = () => c
  return c
}

function ctx(id = VERSION_ID) {
  return { params: Promise.resolve({ versionId: id }) }
}
const URL_BASE = `http://localhost/api/langfristige-planung/${VERSION_ID}/planung-notizen`

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

describe('GET planung-notizen', () => {
  it('returns 200 with { data }', async () => {
    mockFrom.mockReturnValueOnce(chain({ data: { id: VERSION_ID }, error: null }))
    mockFrom.mockReturnValueOnce(chain({ data: [{ zellen_schluessel: 'k1', notiz_text: 'hi' }], error: null }))
    const res = await GET(new Request(`${URL_BASE}?seite=absatzplanung`), ctx())
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.data[0].notiz_text).toBe('hi')
  })

  it('returns 400 when seite missing', async () => {
    mockFrom.mockReturnValueOnce(chain({ data: { id: VERSION_ID }, error: null }))
    const res = await GET(new Request(URL_BASE), ctx())
    expect(res.status).toBe(400)
  })

  it('returns 404 for foreign version', async () => {
    mockFrom.mockReturnValueOnce(chain({ data: null, error: null }))
    const res = await GET(new Request(`${URL_BASE}?seite=absatzplanung`), ctx())
    expect(res.status).toBe(404)
  })

  it('returns 401 when unauthenticated', async () => {
    await unauth()
    const res = await GET(new Request(`${URL_BASE}?seite=absatzplanung`), ctx())
    expect(res.status).toBe(401)
  })
})

describe('PUT planung-notizen', () => {
  function put(body: unknown) {
    return PUT(
      new Request(URL_BASE, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      }),
      ctx(),
    )
  }

  it('upserts a notiz (200)', async () => {
    mockFrom.mockReturnValueOnce(chain({ data: { id: VERSION_ID }, error: null }))
    mockFrom.mockReturnValueOnce(chain({ data: { zellen_schluessel: 'k1', notiz_text: 'text' }, error: null }))
    const res = await put({ seite: 'absatzplanung', zellen_schluessel: 'k1', notiz_text: 'text' })
    expect(res.status).toBe(200)
  })

  it('returns 400 on empty notiz_text', async () => {
    mockFrom.mockReturnValueOnce(chain({ data: { id: VERSION_ID }, error: null }))
    const res = await put({ seite: 'absatzplanung', zellen_schluessel: 'k1', notiz_text: '' })
    expect(res.status).toBe(400)
  })

  it('returns 404 for foreign version', async () => {
    mockFrom.mockReturnValueOnce(chain({ data: null, error: null }))
    const res = await put({ seite: 'absatzplanung', zellen_schluessel: 'k1', notiz_text: 'text' })
    expect(res.status).toBe(404)
  })

  it('returns 401 when unauthenticated', async () => {
    await unauth()
    const res = await put({ seite: 'absatzplanung', zellen_schluessel: 'k1', notiz_text: 'text' })
    expect(res.status).toBe(401)
  })
})

describe('DELETE planung-notizen', () => {
  it('deletes a single notiz (200)', async () => {
    mockFrom.mockReturnValueOnce(chain({ data: { id: VERSION_ID }, error: null }))
    mockFrom.mockReturnValueOnce(chain({ error: null }))
    const res = await DELETE(new Request(`${URL_BASE}?seite=absatzplanung&zellen_schluessel=k1`, { method: 'DELETE' }), ctx())
    expect(res.status).toBe(200)
  })

  it('deletes all notizen of a seite (200)', async () => {
    mockFrom.mockReturnValueOnce(chain({ data: { id: VERSION_ID }, error: null }))
    mockFrom.mockReturnValueOnce(chain({ error: null }))
    const res = await DELETE(new Request(`${URL_BASE}?seite=absatzplanung`, { method: 'DELETE' }), ctx())
    expect(res.status).toBe(200)
  })

  it('returns 400 when seite missing', async () => {
    mockFrom.mockReturnValueOnce(chain({ data: { id: VERSION_ID }, error: null }))
    const res = await DELETE(new Request(URL_BASE, { method: 'DELETE' }), ctx())
    expect(res.status).toBe(400)
  })

  it('returns 404 for foreign version', async () => {
    mockFrom.mockReturnValueOnce(chain({ data: null, error: null }))
    const res = await DELETE(new Request(`${URL_BASE}?seite=absatzplanung`, { method: 'DELETE' }), ctx())
    expect(res.status).toBe(404)
  })

  it('returns 401 when unauthenticated', async () => {
    await unauth()
    const res = await DELETE(new Request(`${URL_BASE}?seite=absatzplanung`, { method: 'DELETE' }), ctx())
    expect(res.status).toBe(401)
  })
})
