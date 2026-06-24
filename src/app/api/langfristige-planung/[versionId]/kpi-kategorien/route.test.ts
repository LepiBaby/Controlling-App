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
const PARENT_ID = '22222222-2222-4222-8222-222222222222'

// Universeller thenable Query-Builder: jede Methode liefert die Kette zurück,
// `await kette` löst auf das hinterlegte Ergebnis auf. Pro from()-Aufruf einen
// Eintrag via mockFrom.mockReturnValueOnce in Aufrufreihenfolge bereitstellen.
function chain(result: unknown) {
  const c: Record<string, unknown> = { then: (resolve: (v: unknown) => unknown) => resolve(result) }
  for (const m of ['select', 'eq', 'is', 'order', 'limit', 'insert', 'update', 'delete', 'maybeSingle', 'single']) {
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
function url(art?: string) {
  const base = `http://localhost/api/langfristige-planung/${VERSION_ID}/kpi-kategorien`
  return art ? `${base}?art=${art}` : base
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

describe('GET /api/langfristige-planung/[versionId]/kpi-kategorien', () => {
  it('returns 200 with the categories', async () => {
    mockFrom.mockReturnValueOnce(chain({ data: { id: VERSION_ID }, error: null })) // ensureVersion
    mockFrom.mockReturnValueOnce(chain({ data: [{ id: 'a', art: 'lp_marketingkanal' }], error: null })) // list
    const res = await GET(req(url('lp_marketingkanal')), ctx(VERSION_ID))
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body).toHaveLength(1)
  })

  it('returns 400 on invalid art', async () => {
    mockFrom.mockReturnValueOnce(chain({ data: { id: VERSION_ID }, error: null }))
    const res = await GET(req(url('quatsch')), ctx(VERSION_ID))
    expect(res.status).toBe(400)
  })

  it('returns 400 on invalid versionId', async () => {
    const res = await GET(req(url('lp_produkt')), ctx('not-a-uuid'))
    expect(res.status).toBe(400)
  })

  it('returns 404 when version not found / foreign', async () => {
    mockFrom.mockReturnValueOnce(chain({ data: null, error: null }))
    const res = await GET(req(url('lp_produkt')), ctx(VERSION_ID))
    expect(res.status).toBe(404)
  })

  it('returns 401 when unauthenticated', async () => {
    await unauth()
    const res = await GET(req(url('lp_produkt')), ctx(VERSION_ID))
    expect(res.status).toBe(401)
  })
})

describe('POST /api/langfristige-planung/[versionId]/kpi-kategorien', () => {
  function post(body: unknown) {
    return POST(
      req(url(), { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }),
      ctx(VERSION_ID),
    )
  }

  it('creates a flat entry (201)', async () => {
    mockFrom.mockReturnValueOnce(chain({ data: { id: VERSION_ID }, error: null })) // ensureVersion
    mockFrom.mockReturnValueOnce(chain({ data: [], error: null })) // dup check
    mockFrom.mockReturnValueOnce(chain({ data: { id: 'new', name: 'Amazon' }, error: null })) // insert
    const res = await post({ art: 'lp_sales_plattform', name: 'Amazon', parent_id: null, level: 1 })
    expect(res.status).toBe(201)
  })

  it('creates a subgroup with valid parent (201)', async () => {
    mockFrom.mockReturnValueOnce(chain({ data: { id: VERSION_ID }, error: null })) // ensureVersion
    mockFrom.mockReturnValueOnce(chain({ data: { id: PARENT_ID, level: 1 }, error: null })) // parent check
    mockFrom.mockReturnValueOnce(chain({ data: [], error: null })) // dup check
    mockFrom.mockReturnValueOnce(chain({ data: { id: 'new' }, error: null })) // insert
    const res = await post({ art: 'lp_investition', name: 'Maschine A', parent_id: PARENT_ID, level: 2 })
    expect(res.status).toBe(201)
  })

  it('returns 400 on empty name', async () => {
    mockFrom.mockReturnValueOnce(chain({ data: { id: VERSION_ID }, error: null }))
    const res = await post({ art: 'lp_produkt', name: '   ', parent_id: null, level: 1 })
    expect(res.status).toBe(400)
  })

  it('returns 400 when flat art gets a parent/level 2', async () => {
    mockFrom.mockReturnValueOnce(chain({ data: { id: VERSION_ID }, error: null }))
    const res = await post({ art: 'lp_sales_plattform', name: 'X', parent_id: PARENT_ID, level: 2 })
    expect(res.status).toBe(400)
  })

  it('returns 409 on duplicate name on same level', async () => {
    mockFrom.mockReturnValueOnce(chain({ data: { id: VERSION_ID }, error: null })) // ensureVersion
    mockFrom.mockReturnValueOnce(chain({ data: [{ id: 'dup' }], error: null })) // dup check
    const res = await post({ art: 'lp_produkt', name: 'Doppelt', parent_id: null, level: 1 })
    expect(res.status).toBe(409)
  })

  it('returns 404 when version not found', async () => {
    mockFrom.mockReturnValueOnce(chain({ data: null, error: null }))
    const res = await post({ art: 'lp_produkt', name: 'X', parent_id: null, level: 1 })
    expect(res.status).toBe(404)
  })

  it('returns 401 when unauthenticated', async () => {
    await unauth()
    const res = await post({ art: 'lp_produkt', name: 'X', parent_id: null, level: 1 })
    expect(res.status).toBe(401)
  })

  it('returns 403 when adding an own entry under a fixed system group', async () => {
    mockFrom.mockReturnValueOnce(chain({ data: { id: VERSION_ID }, error: null })) // ensureVersion
    mockFrom.mockReturnValueOnce(chain({ data: { id: PARENT_ID, level: 1, is_system: true }, error: null })) // parent → system
    const res = await post({ art: 'lp_investition', name: 'Eigene Gruppe', parent_id: PARENT_ID, level: 2 })
    expect(res.status).toBe(403)
  })
})
