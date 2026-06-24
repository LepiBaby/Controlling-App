// PROJ-78: Lager-Bulk „Alle Produkte gleichsetzen".
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { PUT } from './route'

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

function req(body: unknown) {
  return new Request(
    `http://localhost/api/langfristige-planung/${VERSION_ID}/vertrieb/lager-einstellungen/batch`,
    { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) },
  )
}
function ctx(versionId: string) {
  return { params: Promise.resolve({ versionId }) }
}
const validBody = { sales_plattform_id: PLATTFORM_ID, lagerkosten_euro_m3_monat: 3.5 }

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

describe('PUT lager-einstellungen/batch', () => {
  it('sets the value for all products (200)', async () => {
    mockFrom.mockReturnValueOnce(chain({ data: { id: VERSION_ID }, error: null })) // ensureVersion
    mockFrom.mockReturnValueOnce(chain({ data: { id: PLATTFORM_ID }, error: null })) // plattform check
    mockFrom.mockReturnValueOnce(chain({ data: [{ id: 'p1' }, { id: 'p2' }], error: null })) // produkte
    mockFrom.mockReturnValueOnce(chain({ data: [{ produkt_id: 'p1' }, { produkt_id: 'p2' }], error: null })) // upsert
    const res = await PUT(req(validBody), ctx(VERSION_ID))
    expect(res.status).toBe(200)
    expect(await res.json()).toHaveLength(2)
  })

  it('returns [] when the version has no products', async () => {
    mockFrom.mockReturnValueOnce(chain({ data: { id: VERSION_ID }, error: null })) // ensureVersion
    mockFrom.mockReturnValueOnce(chain({ data: { id: PLATTFORM_ID }, error: null })) // plattform check
    mockFrom.mockReturnValueOnce(chain({ data: [], error: null })) // produkte (none)
    const res = await PUT(req(validBody), ctx(VERSION_ID))
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual([])
  })

  it('returns 400 on negative value', async () => {
    const res = await PUT(req({ ...validBody, lagerkosten_euro_m3_monat: -1 }), ctx(VERSION_ID))
    expect(res.status).toBe(400)
  })

  it('returns 400 when plattform is foreign to the version', async () => {
    mockFrom.mockReturnValueOnce(chain({ data: { id: VERSION_ID }, error: null })) // ensureVersion
    mockFrom.mockReturnValueOnce(chain({ data: null, error: null })) // plattform check fails
    const res = await PUT(req(validBody), ctx(VERSION_ID))
    expect(res.status).toBe(400)
  })

  it('returns 404 when version is foreign/unknown', async () => {
    mockFrom.mockReturnValueOnce(chain({ data: null, error: null }))
    const res = await PUT(req(validBody), ctx(VERSION_ID))
    expect(res.status).toBe(404)
  })

  it('returns 401 when unauthenticated', async () => {
    await unauth()
    const res = await PUT(req(validBody), ctx(VERSION_ID))
    expect(res.status).toBe(401)
  })
})
