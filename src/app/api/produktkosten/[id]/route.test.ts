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

function makeParams(id: string) {
  return { params: Promise.resolve({ id }) }
}

const ZEITRAUM_ID = '123e4567-e89b-12d3-a456-426614174000'
const PRODUKT_ID  = '223e4567-e89b-12d3-a456-426614174001'
const KAT_ID      = '323e4567-e89b-12d3-a456-426614174002'

const MOCK_CURRENT = { id: ZEITRAUM_ID, produkt_id: PRODUKT_ID }
const MOCK_UPDATED = {
  id:          ZEITRAUM_ID,
  produkt_id:  PRODUKT_ID,
  gueltig_von: '2024-01-01',
  gueltig_bis: '2024-12-31',
  created_at:  '2024-01-01T10:00:00Z',
}

const VALID_PATCH_BODY = {
  gueltig_von: '2024-01-01',
  gueltig_bis: '2024-12-31',
  werte: [{ kategorie_id: KAT_ID, wert: 7.00 }],
}

function mockHappyPath() {
  mockFrom
    .mockReturnValueOnce({
      select: () => ({
        eq: () => ({
          single: () => ({ data: MOCK_CURRENT, error: null }),
        }),
      }),
    })
    .mockReturnValueOnce({
      select: () => ({
        eq: () => ({
          neq: () => ({
            or: () => ({
              lte: () => ({ data: [], error: null }),
            }),
          }),
        }),
      }),
    })
    .mockReturnValueOnce({
      update: () => ({
        eq: () => ({
          select: () => ({
            single: () => ({ data: MOCK_UPDATED, error: null }),
          }),
        }),
      }),
    })
    .mockReturnValueOnce({
      delete: () => ({
        eq: () => ({ error: null }),
      }),
    })
    .mockReturnValueOnce({
      insert: () => ({ error: null }),
    })
}

beforeEach(() => {
  vi.clearAllMocks()
})

// ─── PATCH ────────────────────────────────────────────────────────────────────

describe('PATCH /api/produktkosten/[id]', () => {
  it('returns 200 on valid update', async () => {
    mockHappyPath()

    const res = await PATCH(
      req(`http://localhost/api/produktkosten/${ZEITRAUM_ID}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(VALID_PATCH_BODY),
      }),
      makeParams(ZEITRAUM_ID)
    )
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body).toHaveProperty('id', ZEITRAUM_ID)
    expect(body).toHaveProperty('werte')
  })

  it('returns 400 when gueltig_bis is before gueltig_von', async () => {
    const res = await PATCH(
      req(`http://localhost/api/produktkosten/${ZEITRAUM_ID}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...VALID_PATCH_BODY, gueltig_von: '2024-06-01', gueltig_bis: '2024-01-01' }),
      }),
      makeParams(ZEITRAUM_ID)
    )
    expect(res.status).toBe(400)
  })

  it('returns 400 when wert is negative', async () => {
    const res = await PATCH(
      req(`http://localhost/api/produktkosten/${ZEITRAUM_ID}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...VALID_PATCH_BODY, werte: [{ kategorie_id: KAT_ID, wert: -5 }] }),
      }),
      makeParams(ZEITRAUM_ID)
    )
    expect(res.status).toBe(400)
  })

  it('returns 404 when record does not exist', async () => {
    mockFrom.mockReturnValueOnce({
      select: () => ({
        eq: () => ({
          single: () => ({ data: null, error: { message: 'No rows' } }),
        }),
      }),
    })

    const res = await PATCH(
      req(`http://localhost/api/produktkosten/${ZEITRAUM_ID}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(VALID_PATCH_BODY),
      }),
      makeParams(ZEITRAUM_ID)
    )
    expect(res.status).toBe(404)
  })

  it('returns 409 when period overlaps existing entry', async () => {
    mockFrom
      .mockReturnValueOnce({
        select: () => ({
          eq: () => ({
            single: () => ({ data: MOCK_CURRENT, error: null }),
          }),
        }),
      })
      .mockReturnValueOnce({
        select: () => ({
          eq: () => ({
            neq: () => ({
              or: () => ({
                lte: () => ({
                  data: [{ id: 'other', gueltig_von: '2024-03-01', gueltig_bis: '2025-02-28' }],
                  error: null,
                }),
              }),
            }),
          }),
        }),
      })

    const res = await PATCH(
      req(`http://localhost/api/produktkosten/${ZEITRAUM_ID}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(VALID_PATCH_BODY),
      }),
      makeParams(ZEITRAUM_ID)
    )
    expect(res.status).toBe(409)
    const body = await res.json()
    expect(body.error).toMatch(/überschneidet/)
  })

  it('returns 401 when unauthenticated', async () => {
    const { requireAuth } = await import('@/lib/supabase-server')
    vi.mocked(requireAuth).mockResolvedValueOnce({
      user: null,
      supabase: null as never,
      error: new Response('Unauthorized', { status: 401 }),
    })
    const res = await PATCH(
      req(`http://localhost/api/produktkosten/${ZEITRAUM_ID}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(VALID_PATCH_BODY),
      }),
      makeParams(ZEITRAUM_ID)
    )
    expect(res.status).toBe(401)
  })
})

// ─── DELETE ───────────────────────────────────────────────────────────────────

describe('DELETE /api/produktkosten/[id]', () => {
  it('returns 204 on success', async () => {
    mockFrom.mockReturnValueOnce({
      delete: () => ({
        eq: () => ({ error: null }),
      }),
    })

    const res = await DELETE(
      req(`http://localhost/api/produktkosten/${ZEITRAUM_ID}`, { method: 'DELETE' }),
      makeParams(ZEITRAUM_ID)
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
      req(`http://localhost/api/produktkosten/${ZEITRAUM_ID}`, { method: 'DELETE' }),
      makeParams(ZEITRAUM_ID)
    )
    expect(res.status).toBe(401)
  })
})
