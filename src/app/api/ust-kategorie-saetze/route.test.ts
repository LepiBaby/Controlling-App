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

const BASE_URL    = 'http://localhost/api/ust-kategorie-saetze'
const KAT_ID_1   = '11111111-1111-1111-8111-111111111111'
const KAT_ID_2   = '22222222-2222-2222-8222-222222222222'

const MOCK_SAETZE = [
  { kategorie_id: KAT_ID_1, ebene: 1, ust_satz: 19 },
  { kategorie_id: KAT_ID_2, ebene: 1, ust_satz: 7  },
]

beforeEach(() => {
  vi.clearAllMocks()
  mockFrom.mockReset()
})

// ─── GET ──────────────────────────────────────────────────────────────────────

describe('GET /api/ust-kategorie-saetze', () => {
  it('returns 200 with empty array when no rates exist', async () => {
    mockFrom.mockReturnValueOnce({
      select: () => ({ eq: () => ({ limit: () => ({ data: [], error: null }) }) }),
    })
    const res = await GET()
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual([])
  })

  it('returns 200 with existing rates', async () => {
    mockFrom.mockReturnValueOnce({
      select: () => ({ eq: () => ({ limit: () => ({ data: MOCK_SAETZE, error: null }) }) }),
    })
    const res = await GET()
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body).toHaveLength(2)
    expect(body[0].ust_satz).toBe(19)
    expect(body[1].ust_satz).toBe(7)
  })

  it('returns 401 when unauthenticated', async () => {
    const { requireAuth } = await import('@/lib/supabase-server')
    vi.mocked(requireAuth).mockResolvedValueOnce({
      user: null,
      supabase: null as never,
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

// ─── POST (batch upsert) ──────────────────────────────────────────────────────

describe('POST /api/ust-kategorie-saetze', () => {
  function mockUpsert(result: unknown, err: { message: string } | null = null) {
    mockFrom.mockReturnValueOnce({
      upsert: () => ({
        select: () => ({ data: result, error: err }),
      }),
    })
  }

  it('returns 200 with upserted rates', async () => {
    mockUpsert(MOCK_SAETZE)
    const res = await POST(req(BASE_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify([
        { kategorie_id: KAT_ID_1, ebene: 1, ust_satz: 19 },
        { kategorie_id: KAT_ID_2, ebene: 1, ust_satz: 7  },
      ]),
    }))
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body).toHaveLength(2)
    expect(body[0].ust_satz).toBe(19)
  })

  it('returns 200 when ust_satz is null (clearing a rate)', async () => {
    const cleared = [{ kategorie_id: KAT_ID_1, ebene: 1, ust_satz: null }]
    mockUpsert(cleared)
    const res = await POST(req(BASE_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify([{ kategorie_id: KAT_ID_1, ebene: 1, ust_satz: null }]),
    }))
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body[0].ust_satz).toBeNull()
  })

  it('returns 200 with ebene 2 rates', async () => {
    const ebene2 = [{ kategorie_id: KAT_ID_1, ebene: 2, ust_satz: 19 }]
    mockUpsert(ebene2)
    const res = await POST(req(BASE_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify([{ kategorie_id: KAT_ID_1, ebene: 2, ust_satz: 19 }]),
    }))
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body[0].ebene).toBe(2)
  })

  it('returns 400 when body is empty array', async () => {
    const res = await POST(req(BASE_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify([]),
    }))
    expect(res.status).toBe(400)
  })

  it('returns 400 when kategorie_id is not a valid UUID', async () => {
    const res = await POST(req(BASE_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify([{ kategorie_id: 'not-a-uuid', ebene: 1, ust_satz: 19 }]),
    }))
    expect(res.status).toBe(400)
  })

  it('returns 400 when ebene is not 1 or 2', async () => {
    const res = await POST(req(BASE_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify([{ kategorie_id: KAT_ID_1, ebene: 3, ust_satz: 19 }]),
    }))
    expect(res.status).toBe(400)
  })

  it('returns 400 when ust_satz exceeds 100', async () => {
    const res = await POST(req(BASE_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify([{ kategorie_id: KAT_ID_1, ebene: 1, ust_satz: 101 }]),
    }))
    expect(res.status).toBe(400)
  })

  it('returns 400 when ust_satz is negative', async () => {
    const res = await POST(req(BASE_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify([{ kategorie_id: KAT_ID_1, ebene: 1, ust_satz: -1 }]),
    }))
    expect(res.status).toBe(400)
  })

  it('returns 400 when body is not an array', async () => {
    const res = await POST(req(BASE_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ kategorie_id: KAT_ID_1, ebene: 1, ust_satz: 19 }),
    }))
    expect(res.status).toBe(400)
  })

  it('returns 401 when unauthenticated', async () => {
    const { requireAuth } = await import('@/lib/supabase-server')
    vi.mocked(requireAuth).mockResolvedValueOnce({
      user: null,
      supabase: null as never,
      error: new Response('Unauthorized', { status: 401 }),
    })
    const res = await POST(req(BASE_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify([{ kategorie_id: KAT_ID_1, ebene: 1, ust_satz: 19 }]),
    }))
    expect(res.status).toBe(401)
  })

  it('returns 500 when db upsert fails', async () => {
    mockUpsert(null, { message: 'DB error' })
    const res = await POST(req(BASE_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify([{ kategorie_id: KAT_ID_1, ebene: 1, ust_satz: 19 }]),
    }))
    expect(res.status).toBe(500)
  })
})
