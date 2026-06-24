import { describe, it, expect, vi, beforeEach } from 'vitest'

const mockFrom = vi.fn()

vi.mock('@/lib/supabase-server', () => ({
  requireAuth: vi.fn().mockResolvedValue({
    user: { id: 'user-1', email: 'test@test.com' },
    supabase: { from: (table: string) => mockFrom(table) },
    error: null,
  }),
}))

// Quell-berechnet-Handler werden in-process aufgerufen → für den Smoke-Test stubben.
vi.mock('../../sales-plattform-planung/berechnet/route', () => ({
  GET: vi.fn().mockResolvedValue(new Response(JSON.stringify([]), { status: 200 })),
}))
vi.mock('../../umsatzausgaben/berechnet/route', () => ({
  GET: vi.fn().mockResolvedValue(new Response(JSON.stringify({ data: [] }), { status: 200 })),
}))
vi.mock('../../investitionsausgaben-planung/berechnet/route', () => ({
  GET: vi.fn().mockResolvedValue(new Response(JSON.stringify({ data: [] }), { status: 200 })),
}))

import { GET } from './route'

const VERSION_ID = '11111111-1111-4111-8111-111111111111'

function chain(result: unknown) {
  const c: Record<string, unknown> = { then: (resolve: (v: unknown) => unknown) => resolve(result) }
  for (const m of ['select', 'eq', 'in', 'upsert', 'single', 'maybeSingle', 'limit', 'delete']) c[m] = () => c
  return c
}

function ctx(id = VERSION_ID) {
  return { params: Promise.resolve({ versionId: id }) }
}
const URL_BASE = `http://localhost/api/langfristige-planung/${VERSION_ID}/steuerausgaben/berechnet`

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
  // Tabellen-bewusster Default: Version existiert, alle übrigen Tabellen leer.
  mockFrom.mockImplementation((table: string) => {
    if (table === 'langfristige_planversionen') return chain({ data: { id: VERSION_ID }, error: null })
    return chain({ data: [], error: null })
  })
})

describe('GET /api/langfristige-planung/[versionId]/steuerausgaben/berechnet', () => {
  it('returns 200 with empty data when no KPI/Steuern categories exist', async () => {
    const res = await GET(new Request(URL_BASE), ctx())
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.data).toEqual([])
  })

  it('returns 400 for invalid version id', async () => {
    const res = await GET(new Request(URL_BASE), ctx('not-a-uuid'))
    expect(res.status).toBe(400)
  })

  it('returns 404 for foreign/unknown version', async () => {
    mockFrom.mockImplementation(() => chain({ data: null, error: null }))
    const res = await GET(new Request(URL_BASE), ctx())
    expect(res.status).toBe(404)
  })

  it('returns 401 when unauthenticated', async () => {
    await unauth()
    const res = await GET(new Request(URL_BASE), ctx())
    expect(res.status).toBe(401)
  })

  it('returns 500 when kpi_categories load fails', async () => {
    mockFrom.mockImplementation((table: string) => {
      if (table === 'langfristige_planversionen') return chain({ data: { id: VERSION_ID }, error: null })
      if (table === 'kpi_categories') return chain({ data: null, error: { message: 'boom' } })
      return chain({ data: [], error: null })
    })
    const res = await GET(new Request(URL_BASE), ctx())
    expect(res.status).toBe(500)
  })
})
