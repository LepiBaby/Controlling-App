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

function req(url: string, options?: RequestInit) {
  return new Request(url, options)
}

const POS_ID_1 = '11111111-1111-1111-1111-111111111111'
const POS_ID_2 = '22222222-2222-2222-2222-222222222222'
const KAT_ID   = '33333333-3333-3333-3333-333333333333'

const MOCK_POSITION = { id: POS_ID_1, name: 'Umsatz gesamt', type: 'position', sort_order: 0 }

beforeEach(() => {
  vi.clearAllMocks()
  mockFrom.mockReset()
})

// ─── GET ──────────────────────────────────────────────────────────────────────

describe('GET /api/report-positionen', () => {
  it('returns 200 with empty array when no positions exist', async () => {
    mockFrom.mockReturnValueOnce({
      select: () => ({ eq: () => ({ order: () => ({ data: [], error: null }) }) }),
    })

    const res = await GET()
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body).toEqual([])
  })

  it('returns 200 with assembled positions', async () => {
    // 1st call: report_positionen
    mockFrom.mockReturnValueOnce({
      select: () => ({ eq: () => ({ order: () => ({ data: [MOCK_POSITION], error: null }) }) }),
    })
    // 2nd call: report_position_kategorien
    mockFrom.mockReturnValueOnce({
      select: () => ({
        in: () => ({
          data: [{ id: 'k1', report_position_id: POS_ID_1, kpi_category_id: KAT_ID, kpi_categories: { id: KAT_ID, name: 'Nettoumsatz', type: 'umsatz' } }],
          error: null,
        }),
      }),
    })
    // 3rd call: report_summe_positionen
    mockFrom.mockReturnValueOnce({
      select: () => ({ in: () => ({ data: [], error: null }) }),
    })

    const res = await GET()
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body).toHaveLength(1)
    expect(body[0].id).toBe(POS_ID_1)
    expect(body[0].kategorien).toHaveLength(1)
    expect(body[0].kategorien[0].kpi_category.name).toBe('Nettoumsatz')
    expect(body[0].summe_positionen).toHaveLength(0)
  })

  it('returns 200 with summe position and reference', async () => {
    const SUMME_POS = { id: POS_ID_2, name: 'Gesamt', type: 'summe', sort_order: 1 }

    mockFrom.mockReturnValueOnce({
      select: () => ({ eq: () => ({ order: () => ({ data: [MOCK_POSITION, SUMME_POS], error: null }) }) }),
    })
    mockFrom.mockReturnValueOnce({
      select: () => ({ in: () => ({ data: [], error: null }) }),
    })
    mockFrom.mockReturnValueOnce({
      select: () => ({
        in: () => ({
          data: [{ id: 's1', report_position_id: POS_ID_2, referenced_position_id: POS_ID_1 }],
          error: null,
        }),
      }),
    })

    const res = await GET()
    const body = await res.json()
    const summePos = body.find((p: { id: string }) => p.id === POS_ID_2)
    expect(summePos.summe_positionen).toHaveLength(1)
    expect(summePos.summe_positionen[0].referenced_position.name).toBe('Umsatz gesamt')
  })

  it('returns 401 when unauthenticated', async () => {
    const { requireAuth } = await import('@/lib/supabase-server')
    vi.mocked(requireAuth).mockResolvedValueOnce({
      user: null, supabase: null as never,
      error: new Response('Unauthorized', { status: 401 }),
    })
    const res = await GET()
    expect(res.status).toBe(401)
  })
})

// ─── POST ─────────────────────────────────────────────────────────────────────

describe('POST /api/report-positionen', () => {
  it('returns 200 with created position on valid input (position)', async () => {
    // max sort_order query
    mockFrom.mockReturnValueOnce({
      select: () => ({ eq: () => ({ order: () => ({ limit: () => ({ maybeSingle: () => ({ data: null, error: null }) }) }) }) }),
    })
    // insert
    mockFrom.mockReturnValueOnce({
      insert: () => ({ select: () => ({ single: () => ({ data: MOCK_POSITION, error: null }) }) }),
    })

    const res = await POST(req('http://localhost/api/report-positionen', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'Umsatz gesamt', type: 'position' }),
    }))
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.id).toBe(POS_ID_1)
    expect(body.kategorien).toEqual([])
    expect(body.summe_positionen).toEqual([])
  })

  it('returns 200 with summe type', async () => {
    mockFrom.mockReturnValueOnce({
      select: () => ({ eq: () => ({ order: () => ({ limit: () => ({ maybeSingle: () => ({ data: { sort_order: 2 }, error: null }) }) }) }) }),
    })
    mockFrom.mockReturnValueOnce({
      insert: () => ({ select: () => ({ single: () => ({ data: { id: POS_ID_2, name: 'Gesamt', type: 'summe', sort_order: 3 }, error: null }) }) }),
    })

    const res = await POST(req('http://localhost/api/report-positionen', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'Gesamt', type: 'summe' }),
    }))
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.type).toBe('summe')
  })

  it('returns 400 when name is missing', async () => {
    const res = await POST(req('http://localhost/api/report-positionen', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type: 'position' }),
    }))
    expect(res.status).toBe(400)
  })

  it('returns 400 when type is invalid', async () => {
    const res = await POST(req('http://localhost/api/report-positionen', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'Test', type: 'ungueltig' }),
    }))
    expect(res.status).toBe(400)
  })

  it('returns 400 when name exceeds 100 characters', async () => {
    const res = await POST(req('http://localhost/api/report-positionen', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'x'.repeat(101), type: 'position' }),
    }))
    expect(res.status).toBe(400)
  })

  it('returns 401 when unauthenticated', async () => {
    const { requireAuth } = await import('@/lib/supabase-server')
    vi.mocked(requireAuth).mockResolvedValueOnce({
      user: null, supabase: null as never,
      error: new Response('Unauthorized', { status: 401 }),
    })
    const res = await POST(req('http://localhost/api/report-positionen', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'Test', type: 'position' }),
    }))
    expect(res.status).toBe(401)
  })
})
