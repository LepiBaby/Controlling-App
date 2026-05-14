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

const SKU_ID         = '123e4567-e89b-12d3-a456-426614174000'
const PRODUKT_ID     = '223e4567-e89b-12d3-a456-426614174001'
const PLATTFORM_ID   = '323e4567-e89b-12d3-a456-426614174002'
const TRANSAKTION_ID = '423e4567-e89b-12d3-a456-426614174003'

const MOCK_TRANSAKTION = {
  id:                  TRANSAKTION_ID,
  sku_id:              SKU_ID,
  produkt_id:          PRODUKT_ID,
  datum:               '2024-05-01',
  anfangsbestand:      100,
  einlagerungen:       20,
  anpassungen_positiv: 0,
  anpassungen_negativ: 0,
  warenverluste:       0,
  sendungen_manuell:   5,
  created_at:          '2024-05-01T10:00:00Z',
}

const VALID_PATCH_BODY = {
  datum:               '2024-05-01',
  anfangsbestand:      120,
  einlagerungen:       30,
  anpassungen_positiv: 0,
  anpassungen_negativ: 0,
  warenverluste:       0,
  sendungen_manuell:   5,
  sendungen: [{ plattform_id: PLATTFORM_ID, menge: 15 }],
}

function makeParams(id: string) {
  return { params: Promise.resolve({ id }) }
}

beforeEach(() => {
  vi.clearAllMocks()
})

// ─── PATCH ────────────────────────────────────────────────────────────────────

describe('PATCH /api/bestand-transaktionen/[id]', () => {
  it('returns 200 on valid update', async () => {
    // 1. fetch current row
    mockFrom.mockReturnValueOnce({
      select: () => ({
        eq: () => ({
          single: () => ({ data: { id: TRANSAKTION_ID, sku_id: SKU_ID }, error: null }),
        }),
      }),
    })
    // 2. conflict check → no conflict
    mockFrom.mockReturnValueOnce({
      select: () => ({
        eq: () => ({
          eq: () => ({
            neq: () => ({
              limit: () => ({ data: [], error: null }),
            }),
          }),
        }),
      }),
    })
    // 3. update
    mockFrom.mockReturnValueOnce({
      update: () => ({
        eq: () => ({
          select: () => ({
            single: () => ({ data: { ...MOCK_TRANSAKTION, anfangsbestand: 120 }, error: null }),
          }),
        }),
      }),
    })
    // 4. delete existing sendungen
    mockFrom.mockReturnValueOnce({
      delete: () => ({
        eq: () => ({ error: null }),
      }),
    })
    // 5. insert new sendungen
    mockFrom.mockReturnValueOnce({
      insert: () => ({ error: null }),
    })

    const res = await PATCH(
      req(`http://localhost/api/bestand-transaktionen/${TRANSAKTION_ID}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(VALID_PATCH_BODY),
      }),
      makeParams(TRANSAKTION_ID),
    )
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body).toHaveProperty('id')
    expect(body).toHaveProperty('sendungen')
  })

  it('returns 404 when transaktion not found', async () => {
    mockFrom.mockReturnValueOnce({
      select: () => ({
        eq: () => ({
          single: () => ({ data: null, error: { message: 'not found' } }),
        }),
      }),
    })

    const res = await PATCH(
      req(`http://localhost/api/bestand-transaktionen/${TRANSAKTION_ID}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(VALID_PATCH_BODY),
      }),
      makeParams(TRANSAKTION_ID),
    )
    expect(res.status).toBe(404)
  })

  it('returns 409 when datum conflicts with another entry', async () => {
    // 1. fetch current row
    mockFrom.mockReturnValueOnce({
      select: () => ({
        eq: () => ({
          single: () => ({ data: { id: TRANSAKTION_ID, sku_id: SKU_ID }, error: null }),
        }),
      }),
    })
    // 2. conflict check → conflict found
    mockFrom.mockReturnValueOnce({
      select: () => ({
        eq: () => ({
          eq: () => ({
            neq: () => ({
              limit: () => ({ data: [{ id: 'other-id' }], error: null }),
            }),
          }),
        }),
      }),
    })

    const res = await PATCH(
      req(`http://localhost/api/bestand-transaktionen/${TRANSAKTION_ID}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(VALID_PATCH_BODY),
      }),
      makeParams(TRANSAKTION_ID),
    )
    expect(res.status).toBe(409)
    const body = await res.json()
    expect(body.error).toMatch(/bereits ein Eintrag/)
  })

  it('returns 400 when anfangsbestand is negative', async () => {
    const res = await PATCH(
      req(`http://localhost/api/bestand-transaktionen/${TRANSAKTION_ID}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...VALID_PATCH_BODY, anfangsbestand: -10 }),
      }),
      makeParams(TRANSAKTION_ID),
    )
    expect(res.status).toBe(400)
  })

  it('returns 400 when datum format is invalid', async () => {
    const res = await PATCH(
      req(`http://localhost/api/bestand-transaktionen/${TRANSAKTION_ID}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...VALID_PATCH_BODY, datum: '01-05-2024' }),
      }),
      makeParams(TRANSAKTION_ID),
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
      req(`http://localhost/api/bestand-transaktionen/${TRANSAKTION_ID}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(VALID_PATCH_BODY),
      }),
      makeParams(TRANSAKTION_ID),
    )
    expect(res.status).toBe(401)
  })
})

// ─── DELETE ───────────────────────────────────────────────────────────────────

describe('DELETE /api/bestand-transaktionen/[id]', () => {
  it('returns 204 on successful delete', async () => {
    mockFrom.mockReturnValueOnce({
      delete: () => ({
        eq: () => ({ error: null }),
      }),
    })

    const res = await DELETE(
      req(`http://localhost/api/bestand-transaktionen/${TRANSAKTION_ID}`, { method: 'DELETE' }),
      makeParams(TRANSAKTION_ID),
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
      req(`http://localhost/api/bestand-transaktionen/${TRANSAKTION_ID}`, { method: 'DELETE' }),
      makeParams(TRANSAKTION_ID),
    )
    expect(res.status).toBe(401)
  })
})
