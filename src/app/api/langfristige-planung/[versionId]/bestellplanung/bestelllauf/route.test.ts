import { describe, it, expect, vi, beforeEach } from 'vitest'
import { POST } from './route'

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
  for (const m of ['select', 'eq', 'in', 'or', 'order', 'limit', 'maybeSingle', 'single']) c[m] = () => c
  return c
}

function ctx(id = VERSION_ID) {
  return { params: Promise.resolve({ versionId: id }) }
}
const URL = `http://localhost/api/langfristige-planung/${VERSION_ID}/bestellplanung/bestelllauf`

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

describe('POST bestelllauf', () => {
  it('runs and returns kurzfristiges shape (empty products → empty result)', async () => {
    mockFrom.mockReturnValueOnce(chain({ data: { id: VERSION_ID }, error: null })) // version
    mockFrom.mockReturnValueOnce(
      chain({ data: { startmonat_monat: 6, startmonat_jahr: 2026, planungshorizont_monate: 12 }, error: null }),
    ) // grundeinstellungen
    mockFrom.mockReturnValueOnce(chain({ data: [], error: null })) // produkte (leer)
    mockFrom.mockReturnValueOnce(chain({ data: { volumen_20dc: 30, volumen_40hq: 70 }, error: null })) // container_global (ladeStammdaten)
    const res = await POST(new Request(URL, { method: 'POST' }), ctx())
    expect(res.status).toBe(200)
    const body = await res.json()
    // Kurzfristiges Shape: neue_planbestellungen + produkt_stammdaten + container_global.
    expect(body.neue_planbestellungen).toEqual([])
    expect(body.aenderungen_bestehende).toEqual([])
    expect(body.produkt_stammdaten).toEqual([])
    expect(body.container_global).toEqual({ volumen_20dc: 30, volumen_40hq: 70 })
  })

  it('returns 404 for foreign version', async () => {
    mockFrom.mockReturnValueOnce(chain({ data: null, error: null }))
    const res = await POST(new Request(URL, { method: 'POST' }), ctx())
    expect(res.status).toBe(404)
  })

  it('returns 400 for invalid version id', async () => {
    const res = await POST(new Request(URL, { method: 'POST' }), ctx('not-a-uuid'))
    expect(res.status).toBe(400)
  })

  it('returns 401 when unauthenticated', async () => {
    await unauth()
    const res = await POST(new Request(URL, { method: 'POST' }), ctx())
    expect(res.status).toBe(401)
  })
})
