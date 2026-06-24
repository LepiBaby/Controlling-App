import { describe, it, expect, vi, beforeEach } from 'vitest'
import { GET } from './route'

const mockFrom = vi.fn()

vi.mock('@/lib/supabase-server', () => ({
  requireAuth: vi.fn().mockResolvedValue({
    user: { id: 'user-1', email: 'test@test.com' },
    supabase: { from: (table: string) => mockFrom(table) },
    error: null,
  }),
}))

const VERSION_ID = '11111111-1111-4111-8111-111111111111'
const PRODUKT_ID = '33333333-3333-4333-8333-333333333333'

function chain(result: unknown) {
  const c: Record<string, unknown> = { then: (resolve: (v: unknown) => unknown) => resolve(result) }
  for (const m of ['select', 'eq', 'in', 'or', 'order', 'limit', 'maybeSingle', 'single']) c[m] = () => c
  return c
}

function ctx(id = VERSION_ID) {
  return { params: Promise.resolve({ versionId: id }) }
}
function url(produktId: string | null) {
  const base = `http://localhost/api/langfristige-planung/${VERSION_ID}/bestellplanung/lagerbestand-verlauf`
  return produktId ? `${base}?produkt_id=${produktId}` : base
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

describe('GET lagerbestand-verlauf', () => {
  it('returns 400 when produkt_id is missing', async () => {
    mockFrom.mockReturnValueOnce(chain({ data: { id: VERSION_ID }, error: null })) // version
    const res = await GET(new Request(url(null)), ctx())
    expect(res.status).toBe(400)
  })

  it('returns 404 when product is not in the version', async () => {
    mockFrom.mockReturnValueOnce(chain({ data: { id: VERSION_ID }, error: null })) // version
    mockFrom.mockReturnValueOnce(
      chain({ data: { startmonat_monat: 6, startmonat_jahr: 2026, planungshorizont_monate: 12 }, error: null }),
    ) // grundeinstellungen
    mockFrom.mockReturnValueOnce(chain({ data: [], error: null })) // produkte (leer)
    const res = await GET(new Request(url(PRODUKT_ID)), ctx())
    expect(res.status).toBe(404)
  })

  it('returns 404 for foreign version', async () => {
    mockFrom.mockReturnValueOnce(chain({ data: null, error: null }))
    const res = await GET(new Request(url(PRODUKT_ID)), ctx())
    expect(res.status).toBe(404)
  })

  it('returns 401 when unauthenticated', async () => {
    await unauth()
    const res = await GET(new Request(url(PRODUKT_ID)), ctx())
    expect(res.status).toBe(401)
  })
})
