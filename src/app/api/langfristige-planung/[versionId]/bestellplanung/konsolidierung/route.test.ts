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
const B1 = '22222222-2222-4222-8222-222222222222'
const B2 = '33333333-3333-4333-8333-333333333333'

function chain(result: unknown) {
  const c: Record<string, unknown> = { then: (resolve: (v: unknown) => unknown) => resolve(result) }
  for (const m of ['select', 'eq', 'in', 'or', 'insert', 'update', 'delete', 'single', 'maybeSingle']) c[m] = () => c
  return c
}

function ctx(id = VERSION_ID) {
  return { params: Promise.resolve({ versionId: id }) }
}
const URL = `http://localhost/api/langfristige-planung/${VERSION_ID}/bestellplanung/konsolidierung`

async function unauth() {
  const { requireAuth } = await import('@/lib/supabase-server')
  vi.mocked(requireAuth).mockResolvedValueOnce({
    user: null,
    supabase: null as never,
    error: new Response('Unauthorized', { status: 401 }),
  })
}

function post(body: unknown, id = VERSION_ID) {
  return POST(
    new Request(URL, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }),
    ctx(id),
  )
}

const VALID_BODY = {
  bestellung_ids: [B1, B2],
  aenderungen: [
    {
      bestellung_id: B1,
      neue_daten: { produktionsende_datum: '2026-07-01' },
      neue_sku_mengen: [{ sku_id: B1, menge_praktisch: 100, begruendung_anpassung: 'Konsolidierung' }],
      container_anteil: { '40HQ': 1 },
      snapshot_vor_konsolidierung: { anzahl_40hq: 1 },
    },
    {
      bestellung_id: B2,
      neue_daten: { produktionsende_datum: '2026-07-01' },
      neue_sku_mengen: [{ sku_id: B2, menge_praktisch: 80, begruendung_anpassung: 'Konsolidierung' }],
      container_anteil: { '40HQ': 1 },
      snapshot_vor_konsolidierung: { anzahl_40hq: 1 },
    },
  ],
}

beforeEach(() => {
  vi.clearAllMocks()
  mockFrom.mockReset()
})

describe('POST konsolidierung', () => {
  it('creates pairwise links and updates orders (201)', async () => {
    mockFrom.mockReturnValueOnce(chain({ data: { id: VERSION_ID }, error: null })) // version
    mockFrom.mockReturnValueOnce(
      chain({ data: [{ id: B1, anzahl_20dc: 0, anzahl_40hq: 1 }, { id: B2, anzahl_20dc: 0, anzahl_40hq: 1 }], error: null }),
    ) // check membership
    mockFrom.mockReturnValueOnce(chain({ error: null })) // update B1
    mockFrom.mockReturnValueOnce(chain({ error: null })) // update B2
    mockFrom.mockReturnValueOnce(chain({ error: null })) // insert pairs
    const res = await post(VALID_BODY)
    expect(res.status).toBe(201)
    const body = await res.json()
    expect(body.success).toBe(true)
  })

  it('returns 404 when a member is missing', async () => {
    mockFrom.mockReturnValueOnce(chain({ data: { id: VERSION_ID }, error: null })) // version
    mockFrom.mockReturnValueOnce(chain({ data: [{ id: B1, anzahl_20dc: 0, anzahl_40hq: 1 }], error: null })) // only 1 found
    const res = await post(VALID_BODY)
    expect(res.status).toBe(404)
  })

  it('returns 400 for fewer than 2 bestellung_ids', async () => {
    mockFrom.mockReturnValueOnce(chain({ data: { id: VERSION_ID }, error: null })) // version
    const res = await post({ bestellung_ids: [B1], aenderungen: VALID_BODY.aenderungen })
    expect(res.status).toBe(400)
  })

  it('returns 404 for foreign version', async () => {
    mockFrom.mockReturnValueOnce(chain({ data: null, error: null }))
    const res = await post(VALID_BODY)
    expect(res.status).toBe(404)
  })

  it('returns 401 when unauthenticated', async () => {
    await unauth()
    const res = await post(VALID_BODY)
    expect(res.status).toBe(401)
  })
})
