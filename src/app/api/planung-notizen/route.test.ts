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

function req(url: string, options?: RequestInit) {
  return new Request(url, options)
}

const MOCK_NOTIZ = {
  zellen_schluessel: 'sku:abc:def:2026:24:absatz',
  notiz_text: 'Testnotiz',
}

beforeEach(() => {
  vi.clearAllMocks()
  mockFrom.mockReset()
})

// ─── GET ──────────────────────────────────────────────────────────────────────

describe('GET /api/planung-notizen', () => {
  it('returns 200 with empty array when no notes exist', async () => {
    mockFrom.mockReturnValueOnce({
      select: () => ({ eq: () => ({ limit: () => ({ data: [], error: null }) }) }),
    })

    const res = await GET(req('http://localhost/api/planung-notizen?seite=absatzplanung'))
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body).toEqual({ data: [] })
  })

  it('returns 200 with existing notes', async () => {
    mockFrom.mockReturnValueOnce({
      select: () => ({ eq: () => ({ limit: () => ({ data: [MOCK_NOTIZ], error: null }) }) }),
    })

    const res = await GET(req('http://localhost/api/planung-notizen?seite=absatzplanung'))
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.data).toHaveLength(1)
    expect(body.data[0].notiz_text).toBe('Testnotiz')
  })

  it('returns 400 when seite is missing', async () => {
    const res = await GET(req('http://localhost/api/planung-notizen'))
    expect(res.status).toBe(400)
  })

  it('returns 401 when unauthenticated', async () => {
    const { requireAuth } = await import('@/lib/supabase-server')
    vi.mocked(requireAuth).mockResolvedValueOnce({
      user: null, supabase: null as never,
      error: new Response('Unauthorized', { status: 401 }),
    })
    const res = await GET(req('http://localhost/api/planung-notizen?seite=absatzplanung'))
    expect(res.status).toBe(401)
  })

  it('returns 500 when db query fails', async () => {
    mockFrom.mockReturnValueOnce({
      select: () => ({
        eq: () => ({ limit: () => ({ data: null, error: { message: 'DB error' } }) }),
      }),
    })

    const res = await GET(req('http://localhost/api/planung-notizen?seite=absatzplanung'))
    expect(res.status).toBe(500)
  })
})

// ─── PUT ──────────────────────────────────────────────────────────────────────

describe('PUT /api/planung-notizen', () => {
  function upsertMock(
    returnData: Record<string, unknown> | null,
    returnError: { message: string } | null = null,
  ) {
    mockFrom.mockReturnValueOnce({
      upsert: () => ({
        select: () => ({ single: () => ({ data: returnData, error: returnError }) }),
      }),
    })
  }

  it('returns 200 on valid upsert', async () => {
    upsertMock(MOCK_NOTIZ)

    const res = await PUT(req('http://localhost/api/planung-notizen', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        seite: 'absatzplanung',
        zellen_schluessel: 'sku:abc:def:2026:24:absatz',
        notiz_text: 'Testnotiz',
      }),
    }))
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.notiz_text).toBe('Testnotiz')
  })

  it('returns 200 on upsert for einnahmenplanung', async () => {
    upsertMock({ zellen_schluessel: 'einnahmen:xyz:2026:25', notiz_text: 'Planung ok' })

    const res = await PUT(req('http://localhost/api/planung-notizen', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        seite: 'einnahmenplanung',
        zellen_schluessel: 'einnahmen:xyz:2026:25',
        notiz_text: 'Planung ok',
      }),
    }))
    expect(res.status).toBe(200)
  })

  it('returns 400 when seite is missing', async () => {
    const res = await PUT(req('http://localhost/api/planung-notizen', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        zellen_schluessel: 'sku:abc:def:2026:24:absatz',
        notiz_text: 'Testnotiz',
      }),
    }))
    expect(res.status).toBe(400)
  })

  it('returns 400 when notiz_text is empty string', async () => {
    const res = await PUT(req('http://localhost/api/planung-notizen', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        seite: 'absatzplanung',
        zellen_schluessel: 'sku:abc:def:2026:24:absatz',
        notiz_text: '',
      }),
    }))
    expect(res.status).toBe(400)
  })

  it('returns 400 when body is invalid JSON', async () => {
    const res = await PUT(req('http://localhost/api/planung-notizen', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: 'not json',
    }))
    expect(res.status).toBe(400)
  })

  it('returns 401 when unauthenticated', async () => {
    const { requireAuth } = await import('@/lib/supabase-server')
    vi.mocked(requireAuth).mockResolvedValueOnce({
      user: null, supabase: null as never,
      error: new Response('Unauthorized', { status: 401 }),
    })
    const res = await PUT(req('http://localhost/api/planung-notizen', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        seite: 'absatzplanung',
        zellen_schluessel: 'sku:abc:def:2026:24:absatz',
        notiz_text: 'Testnotiz',
      }),
    }))
    expect(res.status).toBe(401)
  })

  it('returns 500 when db upsert fails', async () => {
    upsertMock(null, { message: 'DB constraint' })

    const res = await PUT(req('http://localhost/api/planung-notizen', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        seite: 'absatzplanung',
        zellen_schluessel: 'sku:abc:def:2026:24:absatz',
        notiz_text: 'Testnotiz',
      }),
    }))
    expect(res.status).toBe(500)
  })
})

// ─── DELETE ───────────────────────────────────────────────────────────────────

describe('DELETE /api/planung-notizen', () => {
  function deleteMock(returnError: { message: string } | null = null) {
    mockFrom.mockReturnValueOnce({
      delete: () => ({ eq: () => ({ eq: () => ({ error: returnError }) }) }),
    })
  }

  it('returns 200 on successful delete', async () => {
    deleteMock()

    const res = await DELETE(req(
      'http://localhost/api/planung-notizen?seite=absatzplanung&zellen_schluessel=sku:abc:def:2026:24:absatz',
      { method: 'DELETE' },
    ))
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.success).toBe(true)
  })

  it('returns 200 even if note does not exist (idempotent)', async () => {
    deleteMock()

    const res = await DELETE(req(
      'http://localhost/api/planung-notizen?seite=absatzplanung&zellen_schluessel=nonexistent',
      { method: 'DELETE' },
    ))
    expect(res.status).toBe(200)
  })

  it('returns 400 when seite is missing', async () => {
    const res = await DELETE(req(
      'http://localhost/api/planung-notizen?zellen_schluessel=sku:abc:def:2026:24:absatz',
      { method: 'DELETE' },
    ))
    expect(res.status).toBe(400)
  })

  it('returns 400 when zellen_schluessel is missing', async () => {
    const res = await DELETE(req(
      'http://localhost/api/planung-notizen?seite=absatzplanung',
      { method: 'DELETE' },
    ))
    expect(res.status).toBe(400)
  })

  it('returns 401 when unauthenticated', async () => {
    const { requireAuth } = await import('@/lib/supabase-server')
    vi.mocked(requireAuth).mockResolvedValueOnce({
      user: null, supabase: null as never,
      error: new Response('Unauthorized', { status: 401 }),
    })
    const res = await DELETE(req(
      'http://localhost/api/planung-notizen?seite=absatzplanung&zellen_schluessel=sku:abc:def:2026:24:absatz',
      { method: 'DELETE' },
    ))
    expect(res.status).toBe(401)
  })

  it('returns 500 when db delete fails', async () => {
    deleteMock({ message: 'DB error' })

    const res = await DELETE(req(
      'http://localhost/api/planung-notizen?seite=absatzplanung&zellen_schluessel=sku:abc:def:2026:24:absatz',
      { method: 'DELETE' },
    ))
    expect(res.status).toBe(500)
  })
})
