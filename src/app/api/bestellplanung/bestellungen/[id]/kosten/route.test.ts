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

const BESTELLUNG_PLAN = ch({ data: { id: 'b-1', status: 'plan' }, error: null })
const BESTELLUNG_LAUFEND = ch({ data: { id: 'b-1', status: 'laufend' }, error: null })

const CAT_ID = 'a1b2c3d4-e5f6-4a7b-8c9d-e0f1a2b3c4d5'

const KOSTEN_ROW = {
  id: 'k-1',
  kpi_kategorie_id: CAT_ID,
  datum: '2026-08-01',
  nettobetrag: 500.00,
  begruendung: 'Test',
  ist_automatisch: true,
  created_at: '2026-06-12T00:00:00Z',
}

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

// ─── GET /kosten ──────────────────────────────────────────────────────────────

describe('GET /api/bestellplanung/bestellungen/[id]/kosten', () => {
  it('returns 401 when unauthenticated', async () => {
    const { requireAuth } = await import('@/lib/supabase-server')
    vi.mocked(requireAuth).mockResolvedValueOnce({
      user: null, supabase: null as never,
      error: new Response('Unauthorized', { status: 401 }),
    })
    const res = await GET(req('http://localhost/api/bestellplanung/bestellungen/b-1/kosten'), makeParams('b-1'))
    expect(res.status).toBe(401)
  })

  it('returns 404 when bestellung not found', async () => {
    mockFrom.mockReturnValueOnce(ch({ data: null, error: null }))
    const res = await GET(req('http://localhost/api/bestellplanung/bestellungen/b-1/kosten'), makeParams('b-1'))
    expect(res.status).toBe(404)
  })

  it('returns empty array when no kosten', async () => {
    mockFrom
      .mockReturnValueOnce(BESTELLUNG_PLAN)  // bestellungen verify
      .mockReturnValueOnce(EMPTY)            // bestellungen_kosten
    const res = await GET(req('http://localhost/api/bestellplanung/bestellungen/b-1/kosten'), makeParams('b-1'))
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body).toEqual([])
  })

  it('returns kosten with category names', async () => {
    mockFrom
      .mockReturnValueOnce(BESTELLUNG_PLAN)
      .mockReturnValueOnce(ch({ data: [KOSTEN_ROW], error: null }))
      .mockReturnValueOnce(ch({ data: [{ id: CAT_ID, name: 'Ware' }], error: null }))
    const res = await GET(req('http://localhost/api/bestellplanung/bestellungen/b-1/kosten'), makeParams('b-1'))
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body).toHaveLength(1)
    expect(body[0].kpi_kategorie_name).toBe('Ware')
    expect(body[0].nettobetrag).toBe(500)
  })
})

// ─── POST /kosten ─────────────────────────────────────────────────────────────

describe('POST /api/bestellplanung/bestellungen/[id]/kosten', () => {
  it('returns 401 when unauthenticated', async () => {
    const { requireAuth } = await import('@/lib/supabase-server')
    vi.mocked(requireAuth).mockResolvedValueOnce({
      user: null, supabase: null as never,
      error: new Response('Unauthorized', { status: 401 }),
    })
    const res = await POST(req('http://localhost/api/bestellplanung/bestellungen/b-1/kosten', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ datum: '2026-08-01', nettobetrag: 100 }),
    }), makeParams('b-1'))
    expect(res.status).toBe(401)
  })

  it('returns 404 when bestellung not found', async () => {
    mockFrom.mockReturnValueOnce(ch({ data: null, error: null }))
    const res = await POST(req('http://localhost/api/bestellplanung/bestellungen/b-1/kosten', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ datum: '2026-08-01', nettobetrag: 100 }),
    }), makeParams('b-1'))
    expect(res.status).toBe(404)
  })

  it('returns 403 when bestellung is not plan', async () => {
    mockFrom.mockReturnValueOnce(BESTELLUNG_LAUFEND)
    const res = await POST(req('http://localhost/api/bestellplanung/bestellungen/b-1/kosten', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ datum: '2026-08-01', nettobetrag: 100 }),
    }), makeParams('b-1'))
    expect(res.status).toBe(403)
  })

  it('returns 400 for missing required fields', async () => {
    mockFrom.mockReturnValueOnce(BESTELLUNG_PLAN)
    const res = await POST(req('http://localhost/api/bestellplanung/bestellungen/b-1/kosten', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ nettobetrag: 100 }), // missing datum
    }), makeParams('b-1'))
    expect(res.status).toBe(400)
  })

  it('returns 400 for negative nettobetrag', async () => {
    mockFrom.mockReturnValueOnce(BESTELLUNG_PLAN)
    const res = await POST(req('http://localhost/api/bestellplanung/bestellungen/b-1/kosten', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ datum: '2026-08-01', nettobetrag: -10 }),
    }), makeParams('b-1'))
    expect(res.status).toBe(400)
  })

  it('creates eintrag and returns 201', async () => {
    mockFrom
      .mockReturnValueOnce(BESTELLUNG_PLAN)
      .mockReturnValueOnce(ch({ data: { ...KOSTEN_ROW, ist_automatisch: false }, error: null }))
      .mockReturnValueOnce(ch({ data: { name: 'Ware' }, error: null }))
    const res = await POST(req('http://localhost/api/bestellplanung/bestellungen/b-1/kosten', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ kpi_kategorie_id: CAT_ID, datum: '2026-08-01', nettobetrag: 500, begruendung: 'Test' }),
    }), makeParams('b-1'))
    expect(res.status).toBe(201)
    const body = await res.json()
    expect(body.kpi_kategorie_name).toBe('Ware')
  })

  it('creates eintrag without kpi_kategorie_id', async () => {
    mockFrom
      .mockReturnValueOnce(BESTELLUNG_PLAN)
      .mockReturnValueOnce(ch({ data: { ...KOSTEN_ROW, kpi_kategorie_id: null, ist_automatisch: false }, error: null }))
    const res = await POST(req('http://localhost/api/bestellplanung/bestellungen/b-1/kosten', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ datum: '2026-08-01', nettobetrag: 100 }),
    }), makeParams('b-1'))
    expect(res.status).toBe(201)
  })

  it('returns 500 on db insert error', async () => {
    mockFrom
      .mockReturnValueOnce(BESTELLUNG_PLAN)
      .mockReturnValueOnce(ch({ data: null, error: { message: 'DB error' } }))
    const res = await POST(req('http://localhost/api/bestellplanung/bestellungen/b-1/kosten', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ datum: '2026-08-01', nettobetrag: 100 }),
    }), makeParams('b-1'))
    expect(res.status).toBe(500)
  })
})
