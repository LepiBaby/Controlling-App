import { describe, it, expect, vi, beforeEach } from 'vitest'
import { PUT, DELETE } from './route'

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

const OK_NULL = ch({ data: null, error: null })
const BESTELLUNG_PLAN = ch({ data: { id: 'b-1', status: 'plan' }, error: null })
const BESTELLUNG_LAUFEND = ch({ data: { id: 'b-1', status: 'laufend' }, error: null })
const CAT_ID = 'a1b2c3d4-e5f6-4a7b-8c9d-e0f1a2b3c4d5'

const KOSTEN_UPDATED = ch({
  data: { id: 'k-1', kpi_kategorie_id: CAT_ID, datum: '2026-09-01', nettobetrag: 750, begruendung: 'Updated', ist_automatisch: false, created_at: '2026-06-12T00:00:00Z' },
  error: null,
})

function makeParams(id: string, kostenId: string) {
  return { params: Promise.resolve({ id, kostenId }) }
}

function req(url: string, opts?: RequestInit) {
  return new Request(url, opts)
}

beforeEach(() => {
  vi.clearAllMocks()
  mockFrom.mockReset()
})

// ─── PUT /kosten/[kostenId] ───────────────────────────────────────────────────

describe('PUT /api/bestellplanung/bestellungen/[id]/kosten/[kostenId]', () => {
  it('returns 401 when unauthenticated', async () => {
    const { requireAuth } = await import('@/lib/supabase-server')
    vi.mocked(requireAuth).mockResolvedValueOnce({
      user: null, supabase: null as never,
      error: new Response('Unauthorized', { status: 401 }),
    })
    const res = await PUT(req('http://localhost/...', {
      method: 'PUT', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ nettobetrag: 750 }),
    }), makeParams('b-1', 'k-1'))
    expect(res.status).toBe(401)
  })

  it('returns 404 when bestellung not found', async () => {
    mockFrom.mockReturnValueOnce(ch({ data: null, error: null }))
    const res = await PUT(req('http://localhost/...', {
      method: 'PUT', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ nettobetrag: 750 }),
    }), makeParams('b-1', 'k-1'))
    expect(res.status).toBe(404)
  })

  it('returns 403 when bestellung is not plan', async () => {
    mockFrom.mockReturnValueOnce(BESTELLUNG_LAUFEND)
    const res = await PUT(req('http://localhost/...', {
      method: 'PUT', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ nettobetrag: 750 }),
    }), makeParams('b-1', 'k-1'))
    expect(res.status).toBe(403)
  })

  it('returns 400 for empty update body', async () => {
    mockFrom.mockReturnValueOnce(BESTELLUNG_PLAN)
    const res = await PUT(req('http://localhost/...', {
      method: 'PUT', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    }), makeParams('b-1', 'k-1'))
    expect(res.status).toBe(400)
  })

  it('returns 400 for invalid datum', async () => {
    mockFrom.mockReturnValueOnce(BESTELLUNG_PLAN)
    const res = await PUT(req('http://localhost/...', {
      method: 'PUT', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ datum: 'not-a-date' }),
    }), makeParams('b-1', 'k-1'))
    expect(res.status).toBe(400)
  })

  it('updates and returns 200 with category name', async () => {
    mockFrom
      .mockReturnValueOnce(BESTELLUNG_PLAN)
      .mockReturnValueOnce(KOSTEN_UPDATED)
      .mockReturnValueOnce(ch({ data: { name: 'Ware' }, error: null }))
    const res = await PUT(req('http://localhost/...', {
      method: 'PUT', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ nettobetrag: 750, datum: '2026-09-01' }),
    }), makeParams('b-1', 'k-1'))
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.nettobetrag).toBe(750)
    expect(body.kpi_kategorie_name).toBe('Ware')
  })
})

// ─── DELETE /kosten/[kostenId] ────────────────────────────────────────────────

describe('DELETE /api/bestellplanung/bestellungen/[id]/kosten/[kostenId]', () => {
  it('returns 401 when unauthenticated', async () => {
    const { requireAuth } = await import('@/lib/supabase-server')
    vi.mocked(requireAuth).mockResolvedValueOnce({
      user: null, supabase: null as never,
      error: new Response('Unauthorized', { status: 401 }),
    })
    const res = await DELETE(req('http://localhost/...'), makeParams('b-1', 'k-1'))
    expect(res.status).toBe(401)
  })

  it('returns 200 on successful delete', async () => {
    mockFrom.mockReturnValueOnce(OK_NULL)
    const res = await DELETE(req('http://localhost/...'), makeParams('b-1', 'k-1'))
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.success).toBe(true)
  })

  it('returns 500 on db error', async () => {
    mockFrom.mockReturnValueOnce(ch({ data: null, error: { message: 'DB error' } }))
    const res = await DELETE(req('http://localhost/...'), makeParams('b-1', 'k-1'))
    expect(res.status).toBe(500)
  })
})
