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

function req(params: Record<string, string> = {}) {
  const qs = new URLSearchParams(params).toString()
  return new Request(`http://localhost/api/liquiditaetsauswertung/anfangsbestand?${qs}`)
}

function chain(result: { data: unknown; error: unknown }) {
  const obj: Record<string, unknown> = {}
  const methods = ['select', 'eq', 'in', 'not', 'is', 'gte', 'lte', 'lt', 'or', 'order', 'range', 'limit', 'maybeSingle', 'single']
  for (const m of methods) obj[m] = () => obj
  ;(obj as { then: (fn: (r: unknown) => unknown) => unknown }).then =
    (fn: (r: unknown) => unknown) => Promise.resolve(result).then(fn)
  return obj
}

// Two sequential queries: 1. einnahmen_transaktionen, 2. ausgaben_kosten_transaktionen
function setupMocks({
  einnahmenRows = [] as unknown[],
  ausgabenRows = [] as unknown[],
} = {}) {
  mockFrom
    .mockReturnValueOnce(chain({ data: einnahmenRows, error: null }))
    .mockReturnValueOnce(chain({ data: ausgabenRows, error: null }))
}

describe('GET /api/liquiditaetsauswertung/anfangsbestand', () => {
  beforeEach(() => mockFrom.mockReset())

  // ── Auth ──
  it('returns 401 when unauthenticated', async () => {
    const { requireAuth } = await import('@/lib/supabase-server')
    vi.mocked(requireAuth).mockResolvedValueOnce({
      user: null,
      supabase: null as never,
      error: new Response(null, { status: 401 }),
    })
    const res = await GET(req({ vor_jahr: '2026', vor_kw: '10' }))
    expect(res.status).toBe(401)
  })

  // ── Validierung ──
  it('returns 400 when vor_jahr is missing', async () => {
    const res = await GET(req({ vor_kw: '10' }))
    expect(res.status).toBe(400)
  })

  it('returns 400 when vor_kw is missing', async () => {
    const res = await GET(req({ vor_jahr: '2026' }))
    expect(res.status).toBe(400)
  })

  it('returns 400 when vor_kw is out of range', async () => {
    const res = await GET(req({ vor_jahr: '2026', vor_kw: '54' }))
    expect(res.status).toBe(400)
  })

  // ── Berechnung ──
  it('computes anfangsbestand = sum(einnahmen) − sum(ausgaben)', async () => {
    setupMocks({
      einnahmenRows: [{ betrag: 1000 }, { betrag: 500 }],
      ausgabenRows: [{ betrag_brutto: 300 }, { betrag_brutto: 200 }],
    })
    const res = await GET(req({ vor_jahr: '2026', vor_kw: '10' }))
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.anfangsbestand).toBe(1000)
  })

  it('returns 0 when there are no prior transactions', async () => {
    setupMocks({ einnahmenRows: [], ausgabenRows: [] })
    const res = await GET(req({ vor_jahr: '2026', vor_kw: '1' }))
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.anfangsbestand).toBe(0)
  })

  it('can be negative when expenses exceed income', async () => {
    setupMocks({
      einnahmenRows: [{ betrag: 100 }],
      ausgabenRows: [{ betrag_brutto: 450 }],
    })
    const res = await GET(req({ vor_jahr: '2026', vor_kw: '20' }))
    const body = await res.json()
    expect(body.anfangsbestand).toBe(-350)
  })

  it('returns the correct ISO-week Monday as stichtag', async () => {
    setupMocks({ einnahmenRows: [], ausgabenRows: [] })
    // KW10 / 2026 starts Monday 2026-03-02
    const res = await GET(req({ vor_jahr: '2026', vor_kw: '10' }))
    const body = await res.json()
    expect(body.stichtag).toBe('2026-03-02')
  })
})
