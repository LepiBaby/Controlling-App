import { describe, it, expect, vi, beforeEach } from 'vitest'
import { PATCH, DELETE } from './route'

const mockFrom = vi.fn()

vi.mock('@/lib/supabase-server', () => ({
  requireAuth: vi.fn().mockResolvedValue({
    user: { id: 'user-1', email: 'test@test.com' },
    supabase: { from: (table: string) => mockFrom(table) },
    error: null,
  }),
}))

const VERSION_ID = '11111111-1111-4111-8111-111111111111'
const HERSTELLER_ID = '33333333-3333-4333-8333-333333333333'

function chain(result: unknown) {
  const c: Record<string, unknown> = { then: (resolve: (v: unknown) => unknown) => resolve(result) }
  for (const m of ['select', 'eq', 'update', 'delete', 'maybeSingle', 'single']) {
    c[m] = () => c
  }
  return c
}
function ctx() {
  return { params: Promise.resolve({ versionId: VERSION_ID, id: HERSTELLER_ID }) }
}
const URL_BASE = `http://localhost/api/langfristige-planung/${VERSION_ID}/produktinformationen/hersteller/${HERSTELLER_ID}`

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

describe('PATCH hersteller/[id]', () => {
  function patch(body: unknown) {
    return PATCH(
      new Request(URL_BASE, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }),
      ctx(),
    )
  }

  it('renames (200)', async () => {
    mockFrom.mockReturnValueOnce(chain({ data: { id: VERSION_ID }, error: null }))
    mockFrom.mockReturnValueOnce(chain({ data: { id: HERSTELLER_ID, name: 'Neu' }, error: null }))
    const res = await patch({ name: 'Neu' })
    expect(res.status).toBe(200)
  })

  it('returns 400 on empty name', async () => {
    mockFrom.mockReturnValueOnce(chain({ data: { id: VERSION_ID }, error: null }))
    const res = await patch({ name: '  ' })
    expect(res.status).toBe(400)
  })

  it('returns 404 when row not found', async () => {
    mockFrom.mockReturnValueOnce(chain({ data: { id: VERSION_ID }, error: null }))
    mockFrom.mockReturnValueOnce(chain({ data: null, error: null }))
    const res = await patch({ name: 'Neu' })
    expect(res.status).toBe(404)
  })

  it('returns 401 when unauthenticated', async () => {
    await unauth()
    const res = await patch({ name: 'Neu' })
    expect(res.status).toBe(401)
  })
})

describe('DELETE hersteller/[id]', () => {
  it('deletes (204)', async () => {
    mockFrom.mockReturnValueOnce(chain({ data: { id: VERSION_ID }, error: null }))
    mockFrom.mockReturnValueOnce(chain({ error: null }))
    const res = await DELETE(new Request(URL_BASE, { method: 'DELETE' }), ctx())
    expect(res.status).toBe(204)
  })

  it('returns 404 when version foreign', async () => {
    mockFrom.mockReturnValueOnce(chain({ data: null, error: null }))
    const res = await DELETE(new Request(URL_BASE, { method: 'DELETE' }), ctx())
    expect(res.status).toBe(404)
  })

  it('returns 401 when unauthenticated', async () => {
    await unauth()
    const res = await DELETE(new Request(URL_BASE, { method: 'DELETE' }), ctx())
    expect(res.status).toBe(401)
  })
})
