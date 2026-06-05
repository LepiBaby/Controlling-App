import { describe, it, expect, vi, beforeEach } from 'vitest'
import { GET, POST } from './route'

const mockFrom = vi.fn()

vi.mock('@/lib/supabase-server', () => ({
  requireAuth: vi.fn().mockResolvedValue({
    user: { id: 'user-1' },
    supabase: { from: (table: string) => mockFrom(table) },
    error: null,
  }),
}))

// Returns a proxy where any chain of method calls returns the same proxy,
// and { data, error } are accessible directly on it (works with destructuring after await).
function ch(result: { data: unknown; error: unknown }): object {
  const p: object = new Proxy({} as Record<string, unknown>, {
    get(_t, prop) {
      const key = String(prop)
      if (key === 'then') return undefined // not a thenable
      if (key === 'data') return result.data
      if (key === 'error') return result.error
      return (..._args: unknown[]) => p
    },
  })
  return p
}

const EMPTY = ch({ data: [], error: null })
const OK_NULL = ch({ data: null, error: null })

function req(url: string, opts?: RequestInit) {
  return new Request(url, opts)
}

beforeEach(() => {
  vi.clearAllMocks()
  mockFrom.mockReset()
})

// ─── GET ──────────────────────────────────────────────────────────────────────

describe('GET /api/bestellplanung/bestellungen', () => {
  it('returns 400 when status param is missing', async () => {
    const res = await GET(req('http://localhost/api/bestellplanung/bestellungen'))
    expect(res.status).toBe(400)
  })

  it('returns 400 when status param is invalid', async () => {
    const res = await GET(req('http://localhost/api/bestellplanung/bestellungen?status=invalid'))
    expect(res.status).toBe(400)
  })

  it('returns 401 when unauthenticated', async () => {
    const { requireAuth } = await import('@/lib/supabase-server')
    vi.mocked(requireAuth).mockResolvedValueOnce({
      user: null, supabase: null as never,
      error: new Response('Unauthorized', { status: 401 }),
    })
    const res = await GET(req('http://localhost/api/bestellplanung/bestellungen?status=plan'))
    expect(res.status).toBe(401)
  })

  it('returns empty array when no bestellungen exist', async () => {
    mockFrom.mockReturnValueOnce(EMPTY) // bestellungen query
    const res = await GET(req('http://localhost/api/bestellplanung/bestellungen?status=plan'))
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body).toEqual([])
  })

  it('returns enriched bestellung on happy path', async () => {
    const baseRow = {
      id: 'b-1', status: 'plan', bestelldatum: '2026-07-01',
      produktionsstart_datum: null, produktionsende_datum: null,
      shippingdatum: null, ankunftsdatum: null, verfuegbarkeitsdatum: null,
      abgeschlossen_am: null, notizen: null, created_at: '2026-06-01T00:00:00Z', updated_at: '2026-06-01T00:00:00Z',
    }
    mockFrom
      .mockReturnValueOnce(ch({ data: [baseRow], error: null })) // bestellungen
      .mockReturnValueOnce(ch({ data: [{ id: 'bp-1', bestellung_id: 'b-1', produkt_id: 'prod-1' }], error: null })) // bestellungen_produkte
      .mockReturnValueOnce(EMPTY) // bestellungen_sku_mengen
      .mockReturnValueOnce(EMPTY) // bestellungen_konsolidierungen
      .mockReturnValueOnce(ch({ data: [{ id: 'prod-1', name: 'Produkt A' }], error: null })) // kpi_categories

    const res = await GET(req('http://localhost/api/bestellplanung/bestellungen?status=plan'))
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body).toHaveLength(1)
    expect(body[0].id).toBe('b-1')
    expect(body[0].produkte[0].produkt_name).toBe('Produkt A')
    expect(body[0].sku_mengen).toEqual([])
    expect(body[0].konsolidierungen).toEqual([])
  })

  it('returns 500 when db query fails', async () => {
    mockFrom.mockReturnValueOnce(ch({ data: null, error: { message: 'DB error' } }))
    const res = await GET(req('http://localhost/api/bestellplanung/bestellungen?status=plan'))
    expect(res.status).toBe(500)
  })
})

// ─── POST ─────────────────────────────────────────────────────────────────────

describe('POST /api/bestellplanung/bestellungen', () => {
  it('returns 400 when produkt_ids is missing', async () => {
    const res = await POST(req('http://localhost/api/bestellplanung/bestellungen', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ bestelldatum: '2026-07-01' }),
    }))
    expect(res.status).toBe(400)
  })

  it('returns 400 when produkt_ids is empty', async () => {
    const res = await POST(req('http://localhost/api/bestellplanung/bestellungen', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ produkt_ids: [] }),
    }))
    expect(res.status).toBe(400)
  })

  it('returns 401 when unauthenticated', async () => {
    const { requireAuth } = await import('@/lib/supabase-server')
    vi.mocked(requireAuth).mockResolvedValueOnce({
      user: null, supabase: null as never,
      error: new Response('Unauthorized', { status: 401 }),
    })
    const res = await POST(req('http://localhost/api/bestellplanung/bestellungen', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ produkt_ids: ['a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11'] }),
    }))
    expect(res.status).toBe(401)
  })

  it('creates bestellung and returns 201 on happy path', async () => {
    const newBestellung = {
      id: 'new-b-1', status: 'plan', bestelldatum: '2026-07-01',
      produktionsstart_datum: null, produktionsende_datum: null,
      shippingdatum: null, ankunftsdatum: null, verfuegbarkeitsdatum: null,
      abgeschlossen_am: null, notizen: null, created_at: '2026-06-01T00:00:00Z', updated_at: '2026-06-01T00:00:00Z',
    }
    mockFrom
      .mockReturnValueOnce(ch({ data: newBestellung, error: null })) // bestellungen insert
      .mockReturnValueOnce(OK_NULL) // bestellungen_produkte insert
      .mockReturnValueOnce(EMPTY) // enrich: bestellungen_produkte select
      .mockReturnValueOnce(EMPTY) // enrich: bestellungen_sku_mengen select
      .mockReturnValueOnce(EMPTY) // enrich: bestellungen_konsolidierungen select
      .mockReturnValueOnce(EMPTY) // kpi_categories names

    const res = await POST(req('http://localhost/api/bestellplanung/bestellungen', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        produkt_ids: ['a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11'],
        bestelldatum: '2026-07-01',
      }),
    }))
    expect(res.status).toBe(201)
    const body = await res.json()
    expect(body.id).toBe('new-b-1')
    expect(body.status).toBe('plan')
  })

  it('returns 500 when db insert fails', async () => {
    mockFrom.mockReturnValueOnce(ch({ data: null, error: { message: 'Insert failed' } }))
    const res = await POST(req('http://localhost/api/bestellplanung/bestellungen', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ produkt_ids: ['a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11'] }),
    }))
    expect(res.status).toBe(500)
  })
})
