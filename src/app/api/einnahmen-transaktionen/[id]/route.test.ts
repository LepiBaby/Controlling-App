import { describe, it, expect, vi, beforeEach } from 'vitest'
import { PATCH, DELETE } from './route'

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

const ROUTE_CTX = { params: Promise.resolve({ id: 'txn-1' }) }

const KAT_ID = '123e4567-e89b-12d3-a456-426614174000'

const MOCK_ROW = {
  id: 'txn-1',
  zahlungsdatum: '2024-01-15',
  betrag: 1250.00,
  kategorie_id: KAT_ID,
  gruppe_id: null,
  untergruppe_id: null,
  sales_plattform_id: null,
  produkt_id: null,
  beschreibung: null,
  created_at: '2024-01-15T10:00:00Z',
}

// ─── PATCH ────────────────────────────────────────────────────────────────────

describe('PATCH /api/einnahmen-transaktionen/[id]', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockFrom.mockReturnValue({
      update: () => ({
        eq: () => ({
          select: () => ({
            single: () => ({ data: MOCK_ROW, error: null }),
          }),
        }),
      }),
    })
  })

  it('returns 200 when updating betrag', async () => {
    const res = await PATCH(
      req('http://localhost/api/einnahmen-transaktionen/txn-1', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ betrag: 2000 }),
      }),
      ROUTE_CTX,
    )
    expect(res.status).toBe(200)
  })

  it('returns 200 when updating zahlungsdatum', async () => {
    const res = await PATCH(
      req('http://localhost/api/einnahmen-transaktionen/txn-1', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ zahlungsdatum: '2024-02-01' }),
      }),
      ROUTE_CTX,
    )
    expect(res.status).toBe(200)
  })

  it('returns 200 when clearing nullable fields', async () => {
    const res = await PATCH(
      req('http://localhost/api/einnahmen-transaktionen/txn-1', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ gruppe_id: null, beschreibung: null }),
      }),
      ROUTE_CTX,
    )
    expect(res.status).toBe(200)
  })

  it('returns 400 for empty body', async () => {
    const res = await PATCH(
      req('http://localhost/api/einnahmen-transaktionen/txn-1', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      }),
      ROUTE_CTX,
    )
    expect(res.status).toBe(400)
  })

  it('returns 400 for negative betrag', async () => {
    const res = await PATCH(
      req('http://localhost/api/einnahmen-transaktionen/txn-1', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ betrag: -100 }),
      }),
      ROUTE_CTX,
    )
    expect(res.status).toBe(400)
  })

  it('returns 400 for invalid date format', async () => {
    const res = await PATCH(
      req('http://localhost/api/einnahmen-transaktionen/txn-1', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ zahlungsdatum: '15.01.2024' }),
      }),
      ROUTE_CTX,
    )
    expect(res.status).toBe(400)
  })

  it('returns 401 when unauthenticated', async () => {
    const { requireAuth } = await import('@/lib/supabase-server')
    vi.mocked(requireAuth).mockResolvedValueOnce({
      user: null,
      supabase: null as never,
      error: new Response('Unauthorized', { status: 401 }),
    })
    const res = await PATCH(
      req('http://localhost/api/einnahmen-transaktionen/txn-1', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ betrag: 500 }),
      }),
      ROUTE_CTX,
    )
    expect(res.status).toBe(401)
  })
})

// ─── DELETE ───────────────────────────────────────────────────────────────────

describe('DELETE /api/einnahmen-transaktionen/[id]', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockFrom.mockReturnValue({
      delete: () => ({
        eq: () => ({ error: null }),
      }),
    })
  })

  it('returns 204 on successful delete', async () => {
    const res = await DELETE(
      req('http://localhost/api/einnahmen-transaktionen/txn-1', { method: 'DELETE' }),
      ROUTE_CTX,
    )
    expect(res.status).toBe(204)
  })

  it('returns 401 when unauthenticated', async () => {
    const { requireAuth } = await import('@/lib/supabase-server')
    vi.mocked(requireAuth).mockResolvedValueOnce({
      user: null,
      supabase: null as never,
      error: new Response('Unauthorized', { status: 401 }),
    })
    const res = await DELETE(
      req('http://localhost/api/einnahmen-transaktionen/txn-1', { method: 'DELETE' }),
      ROUTE_CTX,
    )
    expect(res.status).toBe(401)
  })
})
