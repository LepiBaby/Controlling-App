import { describe, it, expect, vi, beforeEach } from 'vitest'
import { DELETE } from './route'

const mockFrom = vi.fn()

vi.mock('@/lib/supabase-server', () => ({
  requireAuth: vi.fn().mockResolvedValue({
    user: { id: 'user-1', email: 'test@test.com' },
    supabase: { from: (table: string) => mockFrom(table) },
    error: null,
  }),
}))

const VERSION_ID = '11111111-1111-4111-8111-111111111111'
const B1 = '22222222-2222-4222-8222-222222222222'
const B2 = '33333333-3333-4333-8333-333333333333'

function chain(result: unknown) {
  const c: Record<string, unknown> = { then: (resolve: (v: unknown) => unknown) => resolve(result) }
  for (const m of ['select', 'eq', 'in', 'or', 'delete', 'update', 'single', 'maybeSingle']) c[m] = () => c
  return c
}

function ctx(versionId = VERSION_ID, gruppe_id = B1) {
  return { params: Promise.resolve({ versionId, gruppe_id }) }
}
const URL = `http://localhost/api/langfristige-planung/${VERSION_ID}/bestellplanung/konsolidierung/${B1}`

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

describe('DELETE konsolidierung/[gruppe_id]', () => {
  it('dissolves the group (200)', async () => {
    mockFrom.mockReturnValueOnce(chain({ data: { id: VERSION_ID }, error: null })) // version
    mockFrom.mockReturnValueOnce(
      chain({ data: [{ bestellung_id_1: B1, bestellung_id_2: B2 }], error: null }),
    ) // load partners
    mockFrom.mockReturnValueOnce(chain({ error: null })) // delete pairs
    mockFrom.mockReturnValueOnce(chain({ error: null })) // reset container_anteil/menge_vor_konsolidierung
    const res = await DELETE(new Request(URL, { method: 'DELETE' }), ctx())
    expect(res.status).toBe(200)
    expect((await res.json()).success).toBe(true)
  })

  it('returns 400 for invalid gruppe_id', async () => {
    mockFrom.mockReturnValueOnce(chain({ data: { id: VERSION_ID }, error: null })) // version
    const res = await DELETE(new Request(URL, { method: 'DELETE' }), ctx(VERSION_ID, 'not-a-uuid'))
    expect(res.status).toBe(400)
  })

  it('returns 404 for foreign version', async () => {
    mockFrom.mockReturnValueOnce(chain({ data: null, error: null }))
    const res = await DELETE(new Request(URL, { method: 'DELETE' }), ctx())
    expect(res.status).toBe(404)
  })

  it('returns 401 when unauthenticated', async () => {
    await unauth()
    const res = await DELETE(new Request(URL, { method: 'DELETE' }), ctx())
    expect(res.status).toBe(401)
  })
})
