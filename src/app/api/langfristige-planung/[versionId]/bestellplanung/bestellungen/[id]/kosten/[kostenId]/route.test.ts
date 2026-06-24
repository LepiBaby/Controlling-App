import { describe, it, expect, vi, beforeEach } from 'vitest'
import { PUT, DELETE } from './route'

const mockFrom = vi.fn()

vi.mock('@/lib/supabase-server', () => ({
  requireAuth: vi.fn().mockResolvedValue({
    user: { id: 'user-1', email: 'test@test.com' },
    supabase: { from: (table: string) => mockFrom(table) },
    error: null,
  }),
}))

const VERSION_ID = '11111111-1111-4111-8111-111111111111'
const BESTELL_ID = '44444444-4444-4444-8444-444444444444'
const KOSTEN_ID = '55555555-5555-4555-8555-555555555555'

function chain(result: unknown) {
  const c: Record<string, unknown> = { then: (resolve: (v: unknown) => unknown) => resolve(result) }
  for (const m of ['select', 'eq', 'in', 'maybeSingle', 'single', 'delete', 'update', 'insert']) c[m] = () => c
  return c
}

function ctx() {
  return { params: Promise.resolve({ versionId: VERSION_ID, id: BESTELL_ID, kostenId: KOSTEN_ID }) }
}
const URL = `http://localhost/api/langfristige-planung/${VERSION_ID}/bestellplanung/bestellungen/${BESTELL_ID}/kosten/${KOSTEN_ID}`

function putReq(body: unknown) {
  return new Request(URL, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
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

describe('PUT kosten/[kostenId]', () => {
  it('updates an entry (200)', async () => {
    mockFrom.mockReturnValueOnce(chain({ data: { id: VERSION_ID }, error: null })) // version
    mockFrom.mockReturnValueOnce(chain({ data: { id: KOSTEN_ID, kpi_kategorie_id: null, datum: '2026-06-10', nettobetrag: 99, begruendung: 'x', ist_automatisch: false, created_at: 'x' }, error: null })) // update
    const res = await PUT(putReq({ nettobetrag: 99 }), ctx())
    expect(res.status).toBe(200)
    expect((await res.json()).nettobetrag).toBe(99)
  })

  it('toggles ist_automatisch (200)', async () => {
    mockFrom.mockReturnValueOnce(chain({ data: { id: VERSION_ID }, error: null })) // version
    mockFrom.mockReturnValueOnce(chain({ data: { id: KOSTEN_ID, kpi_kategorie_id: null, datum: '2026-06-10', nettobetrag: 99, begruendung: 'x', ist_automatisch: true, created_at: 'x' }, error: null })) // update
    const res = await PUT(putReq({ ist_automatisch: true }), ctx())
    expect(res.status).toBe(200)
  })

  it('returns 400 when no fields', async () => {
    mockFrom.mockReturnValueOnce(chain({ data: { id: VERSION_ID }, error: null })) // version
    const res = await PUT(putReq({}), ctx())
    expect(res.status).toBe(400)
  })

  it('returns 401 when unauthenticated', async () => {
    await unauth()
    const res = await PUT(putReq({ nettobetrag: 1 }), ctx())
    expect(res.status).toBe(401)
  })
})

describe('DELETE kosten/[kostenId]', () => {
  it('deletes an entry (200)', async () => {
    mockFrom.mockReturnValueOnce(chain({ data: { id: VERSION_ID }, error: null })) // version
    mockFrom.mockReturnValueOnce(chain({ error: null })) // delete
    const res = await DELETE(new Request(URL, { method: 'DELETE' }), ctx())
    expect(res.status).toBe(200)
    expect((await res.json()).success).toBe(true)
  })

  it('returns 401 when unauthenticated', async () => {
    await unauth()
    const res = await DELETE(new Request(URL, { method: 'DELETE' }), ctx())
    expect(res.status).toBe(401)
  })
})
