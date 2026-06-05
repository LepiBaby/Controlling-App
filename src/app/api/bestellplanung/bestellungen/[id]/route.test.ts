import { describe, it, expect, vi, beforeEach } from 'vitest'
import { GET, PUT, DELETE } from './route'

const mockFrom = vi.fn()

vi.mock('@/lib/supabase-server', () => ({
  requireAuth: vi.fn().mockResolvedValue({
    user: { id: 'user-1' },
    supabase: { from: (table: string) => mockFrom(table) },
    error: null,
  }),
}))

function ch(result: { data: unknown; error: unknown }): object {
  const p: object = new Proxy({} as Record<string, unknown>, {
    get(_t, prop) {
      const key = String(prop)
      if (key === 'then') return undefined
      if (key === 'data') return result.data
      if (key === 'error') return result.error
      return (..._args: unknown[]) => p
    },
  })
  return p
}

const EMPTY = ch({ data: [], error: null })
const OK_NULL = ch({ data: null, error: null })

const BASE_ROW = {
  id: 'b-1', status: 'plan', bestelldatum: '2026-07-01',
  produktionsstart_datum: null, produktionsende_datum: null,
  shippingdatum: null, ankunftsdatum: null, verfuegbarkeitsdatum: null,
  abgeschlossen_am: null, notizen: null,
  created_at: '2026-06-01T00:00:00Z', updated_at: '2026-06-01T00:00:00Z',
}

const VALID_ID = 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11'

function makeParams(id: string) {
  return { params: Promise.resolve({ id }) }
}

function req(url: string, opts?: RequestInit) {
  return new Request(url, opts)
}

beforeEach(() => {
  vi.clearAllMocks()
  mockFrom.mockReset()
})

// ─── GET [id] ─────────────────────────────────────────────────────────────────

describe('GET /api/bestellplanung/bestellungen/[id]', () => {
  it('returns 401 when unauthenticated', async () => {
    const { requireAuth } = await import('@/lib/supabase-server')
    vi.mocked(requireAuth).mockResolvedValueOnce({
      user: null, supabase: null as never,
      error: new Response('Unauthorized', { status: 401 }),
    })
    const res = await GET(req('http://localhost/api/bestellplanung/bestellungen/b-1'), makeParams('b-1'))
    expect(res.status).toBe(401)
  })

  it('returns 404 when bestellung not found', async () => {
    mockFrom.mockReturnValueOnce(ch({ data: null, error: { message: 'Not found' } }))
    const res = await GET(req('http://localhost/api/bestellplanung/bestellungen/b-1'), makeParams('b-1'))
    expect(res.status).toBe(404)
  })

  it('returns enriched bestellung on happy path', async () => {
    mockFrom
      .mockReturnValueOnce(ch({ data: BASE_ROW, error: null })) // bestellungen single
      .mockReturnValueOnce(EMPTY) // bestellungen_produkte
      .mockReturnValueOnce(EMPTY) // bestellungen_sku_mengen
      .mockReturnValueOnce(EMPTY) // bestellungen_konsolidierungen
      .mockReturnValueOnce(EMPTY) // kpi_categories names

    const res = await GET(req('http://localhost/api/bestellplanung/bestellungen/b-1'), makeParams('b-1'))
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.id).toBe('b-1')
    expect(body.status).toBe('plan')
    expect(body.produkte).toEqual([])
  })
})

// ─── PUT [id] ─────────────────────────────────────────────────────────────────

describe('PUT /api/bestellplanung/bestellungen/[id]', () => {
  it('returns 401 when unauthenticated', async () => {
    const { requireAuth } = await import('@/lib/supabase-server')
    vi.mocked(requireAuth).mockResolvedValueOnce({
      user: null, supabase: null as never,
      error: new Response('Unauthorized', { status: 401 }),
    })
    const res = await PUT(req('http://localhost/api/bestellplanung/bestellungen/b-1', {
      method: 'PUT', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'laufend' }),
    }), makeParams('b-1'))
    expect(res.status).toBe(401)
  })

  it('updates status and returns enriched bestellung', async () => {
    const updated = { ...BASE_ROW, status: 'laufend' }
    mockFrom
      .mockReturnValueOnce(OK_NULL) // bestellungen update
      .mockReturnValueOnce(ch({ data: updated, error: null })) // bestellungen re-fetch single
      .mockReturnValueOnce(EMPTY) // enrich: bestellungen_produkte
      .mockReturnValueOnce(EMPTY) // enrich: bestellungen_sku_mengen
      .mockReturnValueOnce(EMPTY) // enrich: bestellungen_konsolidierungen
      .mockReturnValueOnce(EMPTY) // kpi_categories names

    const res = await PUT(req('http://localhost/api/bestellplanung/bestellungen/b-1', {
      method: 'PUT', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'laufend' }),
    }), makeParams('b-1'))

    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.status).toBe('laufend')
  })

  it('returns 500 when db update fails', async () => {
    mockFrom.mockReturnValueOnce(ch({ data: null, error: { message: 'Update failed' } }))
    const res = await PUT(req('http://localhost/api/bestellplanung/bestellungen/b-1', {
      method: 'PUT', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'laufend' }),
    }), makeParams('b-1'))
    expect(res.status).toBe(500)
  })
})

// ─── DELETE [id] ──────────────────────────────────────────────────────────────

describe('DELETE /api/bestellplanung/bestellungen/[id]', () => {
  it('returns 401 when unauthenticated', async () => {
    const { requireAuth } = await import('@/lib/supabase-server')
    vi.mocked(requireAuth).mockResolvedValueOnce({
      user: null, supabase: null as never,
      error: new Response('Unauthorized', { status: 401 }),
    })
    const res = await DELETE(req('http://localhost/api/bestellplanung/bestellungen/b-1'), makeParams('b-1'))
    expect(res.status).toBe(401)
  })

  it('returns 200 on successful delete', async () => {
    mockFrom.mockReturnValueOnce(OK_NULL)
    const res = await DELETE(req('http://localhost/api/bestellplanung/bestellungen/b-1'), makeParams('b-1'))
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.success).toBe(true)
  })

  it('returns 500 when db delete fails', async () => {
    mockFrom.mockReturnValueOnce(ch({ data: null, error: { message: 'Delete failed' } }))
    const res = await DELETE(req('http://localhost/api/bestellplanung/bestellungen/b-1'), makeParams('b-1'))
    expect(res.status).toBe(500)
  })
})
