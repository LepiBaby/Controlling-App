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

const TXN_ID  = '123e4567-e89b-12d3-a456-426614174000'
const KAT_ID  = '223e4567-e89b-12d3-a456-426614174001'

const MOCK_ROW = {
  id:                          TXN_ID,
  leistungsdatum:              '2024-01-15',
  zahlungsdatum:               null,
  betrag_brutto:               1190.00,
  betrag_netto:                1000.00,
  ust_satz:                    '19',
  ust_betrag:                  190.00,
  kategorie_id:                KAT_ID,
  gruppe_id:                   null,
  untergruppe_id:              null,
  sales_plattform_id:          null,
  produkt_id:                  null,
  beschreibung:                null,
  relevant_fuer_rentabilitaet: null,
  abschreibung:                null,
  created_at:                  '2024-01-15T10:00:00Z',
}

const CURRENT_ROW = {
  betrag_brutto: 1190.00,
  ust_satz:      '19',
  ust_betrag:    190.00,
}

function makeParams(id: string) {
  return { params: Promise.resolve({ id }) }
}

// ─── PATCH ────────────────────────────────────────────────────────────────────

describe('PATCH /api/ausgaben-kosten-transaktionen/[id]', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockFrom.mockReturnValue({
      select: () => ({
        eq: () => ({
          single: () => ({ data: CURRENT_ROW, error: null }),
        }),
      }),
      update: () => ({
        eq: () => ({
          select: () => ({
            single: () => ({ data: MOCK_ROW, error: null }),
          }),
        }),
      }),
    })
  })

  it('returns 200 when updating beschreibung only', async () => {
    // beschreibung alone doesn't trigger netto recalc
    mockFrom.mockReturnValue({
      update: () => ({
        eq: () => ({
          select: () => ({
            single: () => ({ data: MOCK_ROW, error: null }),
          }),
        }),
      }),
    })

    const res = await PATCH(
      req(`http://localhost/api/ausgaben-kosten-transaktionen/${TXN_ID}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ beschreibung: 'Aktualisiert' }),
      }),
      makeParams(TXN_ID)
    )
    expect(res.status).toBe(200)
  })

  it('returns 200 when updating betrag_brutto (triggers netto recalc)', async () => {
    mockFrom
      .mockReturnValueOnce({
        select: () => ({
          eq: () => ({
            single: () => ({ data: CURRENT_ROW, error: null }),
          }),
        }),
      })
      .mockReturnValueOnce({
        update: () => ({
          eq: () => ({
            select: () => ({
              single: () => ({ data: MOCK_ROW, error: null }),
            }),
          }),
        }),
      })

    const res = await PATCH(
      req(`http://localhost/api/ausgaben-kosten-transaktionen/${TXN_ID}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ betrag_brutto: 2380 }),
      }),
      makeParams(TXN_ID)
    )
    expect(res.status).toBe(200)
  })

  it('returns 400 for empty patch body', async () => {
    const res = await PATCH(
      req(`http://localhost/api/ausgaben-kosten-transaktionen/${TXN_ID}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      }),
      makeParams(TXN_ID)
    )
    expect(res.status).toBe(400)
  })

  it('returns 400 for invalid ust_satz', async () => {
    const res = await PATCH(
      req(`http://localhost/api/ausgaben-kosten-transaktionen/${TXN_ID}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ust_satz: '16' }),
      }),
      makeParams(TXN_ID)
    )
    expect(res.status).toBe(400)
  })

  it('returns 400 for invalid abschreibung', async () => {
    const res = await PATCH(
      req(`http://localhost/api/ausgaben-kosten-transaktionen/${TXN_ID}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ abschreibung: '4_jahre' }),
      }),
      makeParams(TXN_ID)
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
      req(`http://localhost/api/ausgaben-kosten-transaktionen/${TXN_ID}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ beschreibung: 'test' }),
      }),
      makeParams(TXN_ID)
    )
    expect(res.status).toBe(401)
  })
})

// ─── DELETE ───────────────────────────────────────────────────────────────────

describe('DELETE /api/ausgaben-kosten-transaktionen/[id]', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockFrom.mockReturnValue({
      delete: () => ({
        eq: () => ({ error: null }),
      }),
    })
  })

  it('returns 204 on success', async () => {
    const res = await DELETE(
      req(`http://localhost/api/ausgaben-kosten-transaktionen/${TXN_ID}`, { method: 'DELETE' }),
      makeParams(TXN_ID)
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
      req(`http://localhost/api/ausgaben-kosten-transaktionen/${TXN_ID}`, { method: 'DELETE' }),
      makeParams(TXN_ID)
    )
    expect(res.status).toBe(401)
  })
})
