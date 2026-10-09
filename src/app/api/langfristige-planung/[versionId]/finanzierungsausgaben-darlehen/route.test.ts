import { describe, it, expect, vi, beforeEach } from 'vitest'
import { GET, POST } from './route'
import { PUT, DELETE } from './[id]/route'

const mockFrom = vi.fn()

vi.mock('@/lib/supabase-server', () => ({
  requireAuth: vi.fn().mockResolvedValue({
    user: { id: 'user-1', email: 'test@test.com' },
    supabase: { from: (table: string) => mockFrom(table) },
    error: null,
  }),
}))

const VERSION_ID = '11111111-1111-4111-8111-111111111111'
const DARLEHEN_ID = '55555555-5555-4555-8555-555555555555'

function chain(result: unknown) {
  const c: Record<string, unknown> = { then: (resolve: (v: unknown) => unknown) => resolve(result) }
  for (const m of ['select', 'eq', 'insert', 'update', 'delete', 'single', 'maybeSingle', 'limit', 'order', 'range']) c[m] = () => c
  return c
}

const URL_BASE = `http://localhost/api/langfristige-planung/${VERSION_ID}/finanzierungsausgaben-darlehen`
const ctx = () => ({ params: Promise.resolve({ versionId: VERSION_ID }) })
const idCtx = (id = DARLEHEN_ID) => ({ params: Promise.resolve({ versionId: VERSION_ID, id }) })
const json = (method: string, body: unknown, url = URL_BASE) =>
  new Request(url, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })

const DARLEHEN = {
  zinsen_kategorie_id: '33333333-3333-4333-8333-333333333333',
  tilgung_kategorie_id: '44444444-4444-4444-8444-444444444444',
  name: 'KfW-Darlehen',
  betrag: 100000,
  zinssatz: 4.5,
  laufzeit_monate: 60,
  tilgungsfrei_monate: 12,
  start_jahr: 2026,
  start_monat: 4,
}

const versionOk = () => mockFrom.mockReturnValueOnce(chain({ data: { id: VERSION_ID }, error: null }))

beforeEach(() => {
  vi.clearAllMocks()
  mockFrom.mockReset()
})

describe('finanzierungsausgaben-darlehen routes', () => {
  it('GET lists financings of the version', async () => {
    versionOk()
    mockFrom.mockReturnValueOnce(chain({ data: [{ id: DARLEHEN_ID, ...DARLEHEN }], error: null }))
    const res = await GET(new Request(URL_BASE), ctx())
    expect(res.status).toBe(200)
    expect((await res.json())[0].name).toBe('KfW-Darlehen')
  })

  it('GET returns 404 for a foreign version', async () => {
    mockFrom.mockReturnValueOnce(chain({ data: null, error: null }))
    const res = await GET(new Request(URL_BASE), ctx())
    expect(res.status).toBe(404)
  })

  it('POST creates a financing (201)', async () => {
    versionOk()
    mockFrom.mockReturnValueOnce(chain({ data: { sort_order: 2 }, error: null }))
    mockFrom.mockReturnValueOnce(chain({ data: { id: DARLEHEN_ID, ...DARLEHEN, sort_order: 3 }, error: null }))
    const res = await POST(json('POST', DARLEHEN), ctx())
    expect(res.status).toBe(201)
  })

  it('POST rejects a grace period that is not shorter than the term (400)', async () => {
    versionOk()
    const res = await POST(json('POST', { ...DARLEHEN, tilgungsfrei_monate: 60 }), ctx())
    expect(res.status).toBe(400)
  })

  it('POST rejects a missing name and negative amount (400)', async () => {
    versionOk()
    expect((await POST(json('POST', { ...DARLEHEN, name: '  ' }), ctx())).status).toBe(400)
    versionOk()
    expect((await POST(json('POST', { ...DARLEHEN, betrag: -1 }), ctx())).status).toBe(400)
  })

  it('PUT updates a financing and returns 404 if it does not exist', async () => {
    versionOk()
    mockFrom.mockReturnValueOnce(chain({ data: { id: DARLEHEN_ID, ...DARLEHEN }, error: null }))
    expect((await PUT(json('PUT', DARLEHEN), idCtx())).status).toBe(200)
    versionOk()
    mockFrom.mockReturnValueOnce(chain({ data: null, error: null }))
    expect((await PUT(json('PUT', DARLEHEN), idCtx())).status).toBe(404)
  })

  it('DELETE removes a financing, rejects invalid ids', async () => {
    versionOk()
    mockFrom.mockReturnValueOnce(chain({ data: { id: DARLEHEN_ID }, error: null }))
    expect((await DELETE(new Request(URL_BASE), idCtx())).status).toBe(200)
    versionOk()
    expect((await DELETE(new Request(URL_BASE), idCtx('nope'))).status).toBe(400)
  })
})
