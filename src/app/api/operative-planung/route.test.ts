import { describe, it, expect, vi, beforeEach } from 'vitest'
import { GET, PUT, DELETE } from './route'

const mockFrom = vi.fn()

vi.mock('@/lib/supabase-server', () => ({
  requireAuth: vi.fn().mockResolvedValue({
    user: { id: 'user-1', email: 'test@test.com' },
    supabase: { from: (table: string) => mockFrom(table) },
    error: null,
  }),
}))

const KATEGORIE_ID = '22222222-2222-2222-8222-222222222222'

const MOCK_EINTRAG = {
  kategorie_id: KATEGORIE_ID,
  kw_year: 2026,
  kw_number: 25,
  betrag_manuell: 2000.00,
}

beforeEach(() => {
  vi.clearAllMocks()
  mockFrom.mockReset()
})

// ─── GET ──────────────────────────────────────────────────────────────────────

describe('GET /api/operative-planung', () => {
  it('returns 200 with empty array when no entries exist', async () => {
    mockFrom.mockReturnValueOnce({
      select: () => ({ eq: () => ({ limit: () => ({ data: [], error: null }) }) }),
    })

    const res = await GET()
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body).toEqual([])
  })

  it('returns 200 with existing entries', async () => {
    mockFrom.mockReturnValueOnce({
      select: () => ({
        eq: () => ({ limit: () => ({ data: [MOCK_EINTRAG], error: null }) }),
      }),
    })

    const res = await GET()
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body).toHaveLength(1)
    expect(body[0].betrag_manuell).toBe(2000.00)
    expect(body[0].kw_number).toBe(25)
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

  it('returns 500 when db query fails', async () => {
    mockFrom.mockReturnValueOnce({
      select: () => ({
        eq: () => ({ limit: () => ({ data: null, error: { message: 'DB error' } }) }),
      }),
    })

    const res = await GET()
    expect(res.status).toBe(500)
  })
})

// ─── PUT ──────────────────────────────────────────────────────────────────────

describe('PUT /api/operative-planung', () => {
  function req(body: unknown) {
    return new Request('http://localhost/api/operative-planung', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
  }

  it('upserts an entry and returns 200', async () => {
    mockFrom.mockReturnValueOnce({
      upsert: () => ({
        select: () => ({ single: () => ({ data: MOCK_EINTRAG, error: null }) }),
      }),
    })

    const res = await PUT(req({
      kategorie_id: KATEGORIE_ID,
      kw_year: 2026,
      kw_number: 25,
      betrag_manuell: 2000.00,
    }))
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.betrag_manuell).toBe(2000.00)
  })

  it('deletes entry when betrag_manuell is null', async () => {
    mockFrom.mockReturnValueOnce({
      delete: () => ({
        eq: () => ({
          eq: () => ({
            eq: () => ({
              eq: () => ({ error: null }),
            }),
          }),
        }),
      }),
    })

    const res = await PUT(req({
      kategorie_id: KATEGORIE_ID,
      kw_year: 2026,
      kw_number: 25,
      betrag_manuell: null,
    }))
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.deleted).toBe(true)
  })

  it('allows betrag_manuell = 0', async () => {
    mockFrom.mockReturnValueOnce({
      upsert: () => ({
        select: () => ({ single: () => ({ data: { ...MOCK_EINTRAG, betrag_manuell: 0 }, error: null }) }),
      }),
    })

    const res = await PUT(req({
      kategorie_id: KATEGORIE_ID,
      kw_year: 2026,
      kw_number: 25,
      betrag_manuell: 0,
    }))
    expect(res.status).toBe(200)
  })

  it('returns 400 for invalid kategorie_id (not UUID)', async () => {
    const res = await PUT(req({
      kategorie_id: 'not-a-uuid',
      kw_year: 2026,
      kw_number: 25,
      betrag_manuell: 100,
    }))
    expect(res.status).toBe(400)
  })

  it('returns 400 for kw_number out of range (> 53)', async () => {
    const res = await PUT(req({
      kategorie_id: KATEGORIE_ID,
      kw_year: 2026,
      kw_number: 54,
      betrag_manuell: 100,
    }))
    expect(res.status).toBe(400)
  })

  it('returns 400 for kw_number = 0', async () => {
    const res = await PUT(req({
      kategorie_id: KATEGORIE_ID,
      kw_year: 2026,
      kw_number: 0,
      betrag_manuell: 100,
    }))
    expect(res.status).toBe(400)
  })

  it('returns 400 for negative betrag_manuell', async () => {
    const res = await PUT(req({
      kategorie_id: KATEGORIE_ID,
      kw_year: 2026,
      kw_number: 25,
      betrag_manuell: -50,
    }))
    expect(res.status).toBe(400)
  })

  it('returns 400 for missing kategorie_id', async () => {
    const res = await PUT(req({
      kw_year: 2026,
      kw_number: 25,
      betrag_manuell: 100,
    }))
    expect(res.status).toBe(400)
  })

  it('returns 401 when unauthenticated', async () => {
    const { requireAuth } = await import('@/lib/supabase-server')
    vi.mocked(requireAuth).mockResolvedValueOnce({
      user: null, supabase: null as never,
      error: new Response('Unauthorized', { status: 401 }),
    })
    const res = await PUT(req({ kategorie_id: KATEGORIE_ID, kw_year: 2026, kw_number: 25, betrag_manuell: 100 }))
    expect(res.status).toBe(401)
  })

  it('returns 500 when upsert fails', async () => {
    mockFrom.mockReturnValueOnce({
      upsert: () => ({
        select: () => ({ single: () => ({ data: null, error: { message: 'DB error' } }) }),
      }),
    })

    const res = await PUT(req({
      kategorie_id: KATEGORIE_ID,
      kw_year: 2026,
      kw_number: 25,
      betrag_manuell: 500,
    }))
    expect(res.status).toBe(500)
  })
})

// ─── DELETE ───────────────────────────────────────────────────────────────────

describe('DELETE /api/operative-planung', () => {
  function buildDelete(query = '') {
    return new Request(`http://localhost/api/operative-planung${query ? '?' + query : ''}`, {
      method: 'DELETE',
    })
  }

  it('deletes all entries when no params are given', async () => {
    mockFrom.mockReturnValueOnce({
      delete: () => ({ eq: () => ({ error: null }) }),
    })

    const res = await DELETE(buildDelete())
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.ok).toBe(true)
  })

  it('deletes future entries from given KW onwards (ab_kw_year + ab_kw_number)', async () => {
    const eqChain = {
      gt: () => ({ error: null }),
      gte: () => ({ error: null }),
      eq: () => ({ gte: () => ({ error: null }) }),
    }
    mockFrom.mockReturnValueOnce({ delete: () => ({ eq: () => eqChain }) })
    mockFrom.mockReturnValueOnce({ delete: () => ({ eq: () => eqChain }) })

    const res = await DELETE(buildDelete('ab_kw_year=2026&ab_kw_number=26'))
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.ok).toBe(true)
  })

  it('returns 401 when unauthenticated', async () => {
    const { requireAuth } = await import('@/lib/supabase-server')
    vi.mocked(requireAuth).mockResolvedValueOnce({
      user: null, supabase: null as never,
      error: new Response('Unauthorized', { status: 401 }),
    })
    const res = await DELETE(buildDelete())
    expect(res.status).toBe(401)
  })

  it('returns 500 when db delete fails', async () => {
    mockFrom.mockReturnValueOnce({
      delete: () => ({ eq: () => ({ error: { message: 'DB error' } }) }),
    })

    const res = await DELETE(buildDelete())
    expect(res.status).toBe(500)
  })
})
