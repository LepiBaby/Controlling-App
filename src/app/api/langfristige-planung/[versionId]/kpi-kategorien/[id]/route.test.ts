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
const ID = '33333333-3333-4333-8333-333333333333'
const PARENT_ID = '22222222-2222-4222-8222-222222222222'

function chain(result: unknown) {
  const c: Record<string, unknown> = { then: (resolve: (v: unknown) => unknown) => resolve(result) }
  for (const m of ['select', 'eq', 'is', 'order', 'limit', 'insert', 'update', 'delete', 'maybeSingle', 'single']) {
    c[m] = () => c
  }
  return c
}

function req(options?: RequestInit) {
  return new Request(`http://localhost/api/langfristige-planung/${VERSION_ID}/kpi-kategorien/${ID}`, options)
}
function ctx(versionId: string, id: string) {
  return { params: Promise.resolve({ versionId, id }) }
}
function patchReq(body: unknown) {
  return req({ method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
}

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

describe('PATCH /api/langfristige-planung/[versionId]/kpi-kategorien/[id]', () => {
  it('renames successfully (200)', async () => {
    mockFrom.mockReturnValueOnce(chain({ data: { id: VERSION_ID }, error: null })) // ensureVersion
    mockFrom.mockReturnValueOnce(chain({ data: { id: ID, art: 'lp_produkt', level: 1 }, error: null })) // existing
    mockFrom.mockReturnValueOnce(chain({ data: { id: ID, name: 'Neu' }, error: null })) // update
    const res = await PATCH(patchReq({ name: 'Neu' }), ctx(VERSION_ID, ID))
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.name).toBe('Neu')
  })

  it('reparents with valid parent (200)', async () => {
    mockFrom.mockReturnValueOnce(chain({ data: { id: VERSION_ID }, error: null })) // ensureVersion
    mockFrom.mockReturnValueOnce(chain({ data: { id: ID, art: 'lp_investition', level: 1 }, error: null })) // existing
    mockFrom.mockReturnValueOnce(chain({ data: { id: PARENT_ID, level: 1 }, error: null })) // parent check
    mockFrom.mockReturnValueOnce(chain({ data: { id: ID, level: 2 }, error: null })) // update
    const res = await PATCH(patchReq({ parent_id: PARENT_ID, level: 2 }), ctx(VERSION_ID, ID))
    expect(res.status).toBe(200)
  })

  it('returns 400 on empty name', async () => {
    mockFrom.mockReturnValueOnce(chain({ data: { id: VERSION_ID }, error: null }))
    const res = await PATCH(patchReq({ name: '   ' }), ctx(VERSION_ID, ID))
    expect(res.status).toBe(400)
  })

  it('returns 400 on invalid id', async () => {
    mockFrom.mockReturnValueOnce(chain({ data: { id: VERSION_ID }, error: null }))
    const res = await PATCH(patchReq({ name: 'X' }), ctx(VERSION_ID, 'bad-id'))
    expect(res.status).toBe(400)
  })

  it('returns 404 when entry not found', async () => {
    mockFrom.mockReturnValueOnce(chain({ data: { id: VERSION_ID }, error: null })) // ensureVersion
    mockFrom.mockReturnValueOnce(chain({ data: null, error: null })) // existing → not found
    const res = await PATCH(patchReq({ name: 'X' }), ctx(VERSION_ID, ID))
    expect(res.status).toBe(404)
  })

  it('returns 404 when version not found', async () => {
    mockFrom.mockReturnValueOnce(chain({ data: null, error: null }))
    const res = await PATCH(patchReq({ name: 'X' }), ctx(VERSION_ID, ID))
    expect(res.status).toBe(404)
  })

  it('returns 401 when unauthenticated', async () => {
    await unauth()
    const res = await PATCH(patchReq({ name: 'X' }), ctx(VERSION_ID, ID))
    expect(res.status).toBe(401)
  })

  it('returns 403 when editing a fixed system group', async () => {
    mockFrom.mockReturnValueOnce(chain({ data: { id: VERSION_ID }, error: null })) // ensureVersion
    mockFrom.mockReturnValueOnce(chain({ data: { id: ID, art: 'lp_investition', level: 1, is_system: true }, error: null })) // existing → system
    const res = await PATCH(patchReq({ name: 'Umbenannt' }), ctx(VERSION_ID, ID))
    expect(res.status).toBe(403)
  })

  it('returns 403 when reparenting under a fixed system group', async () => {
    mockFrom.mockReturnValueOnce(chain({ data: { id: VERSION_ID }, error: null })) // ensureVersion
    mockFrom.mockReturnValueOnce(chain({ data: { id: ID, art: 'lp_investition', level: 2, is_system: false }, error: null })) // existing → own
    mockFrom.mockReturnValueOnce(chain({ data: { id: PARENT_ID, level: 1, is_system: true }, error: null })) // parent → system
    const res = await PATCH(patchReq({ parent_id: PARENT_ID, level: 2 }), ctx(VERSION_ID, ID))
    expect(res.status).toBe(403)
  })
})

describe('DELETE /api/langfristige-planung/[versionId]/kpi-kategorien/[id]', () => {
  it('deletes successfully (200)', async () => {
    mockFrom.mockReturnValueOnce(chain({ data: { id: VERSION_ID }, error: null })) // ensureVersion
    mockFrom.mockReturnValueOnce(chain({ data: { id: ID }, error: null })) // existing
    mockFrom.mockReturnValueOnce(chain({ error: null })) // delete
    const res = await DELETE(req({ method: 'DELETE' }), ctx(VERSION_ID, ID))
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.success).toBe(true)
  })

  it('returns 404 when entry not found', async () => {
    mockFrom.mockReturnValueOnce(chain({ data: { id: VERSION_ID }, error: null }))
    mockFrom.mockReturnValueOnce(chain({ data: null, error: null }))
    const res = await DELETE(req({ method: 'DELETE' }), ctx(VERSION_ID, ID))
    expect(res.status).toBe(404)
  })

  it('returns 400 on invalid id', async () => {
    mockFrom.mockReturnValueOnce(chain({ data: { id: VERSION_ID }, error: null }))
    const res = await DELETE(req({ method: 'DELETE' }), ctx(VERSION_ID, 'bad'))
    expect(res.status).toBe(400)
  })

  it('returns 401 when unauthenticated', async () => {
    await unauth()
    const res = await DELETE(req({ method: 'DELETE' }), ctx(VERSION_ID, ID))
    expect(res.status).toBe(401)
  })

  it('returns 403 when deleting a fixed system group', async () => {
    mockFrom.mockReturnValueOnce(chain({ data: { id: VERSION_ID }, error: null })) // ensureVersion
    mockFrom.mockReturnValueOnce(chain({ data: { id: ID, is_system: true }, error: null })) // existing → system
    const res = await DELETE(req({ method: 'DELETE' }), ctx(VERSION_ID, ID))
    expect(res.status).toBe(403)
  })
})
