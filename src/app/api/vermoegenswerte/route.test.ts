import { describe, it, expect, vi, beforeEach } from 'vitest'
import { GET, POST } from './route'

const mockFrom = vi.fn()

const mockSupabase = { from: (table: string) => mockFrom(table) }

vi.mock('@/lib/supabase-server', () => ({
  requireAuth: vi.fn(),
}))

import { requireAuth } from '@/lib/supabase-server'

function setupAuth() {
  vi.mocked(requireAuth).mockResolvedValue({
    user: { id: 'user-1', email: 'test@test.com' } as never,
    supabase: mockSupabase as never,
    error: null,
  })
}

const SNAPSHOT_ID  = '123e4567-e89b-12d3-a456-426614174000'
const PRODUKT_ID   = '223e4567-e89b-12d3-a456-426614174001'
const PLATTFORM_ID = '323e4567-e89b-12d3-a456-426614174002'

const MOCK_SNAPSHOT = {
  id:                        SNAPSHOT_ID,
  datum:                     '2026-05-01',
  verbindlichkeiten_llv:     1000,
  verbindlichkeiten_sonstige: 500,
  darlehensvb:               2000,
  steuersaldo_typ:           'verbindlichkeit',
  steuersaldo:               200,
  steuersaldo_von:           '2026-01-01',
  steuersaldo_bis:           '2026-04-30',
  cash_bestand:              5000,
  anlagevermoegen:           8000,
  created_at:                '2026-05-01T10:00:00Z',
  lagerwerte:   [{ id: 'lw-1', produkt_id: PRODUKT_ID,   lagerwert: 3000 }],
  transitwerte: [{ id: 'tw-1', produkt_id: PRODUKT_ID,   ausgaben_transaktion_id: null, transitwert: 0 }],
  forderungen:  [{ id: 'frd-1', plattform_id: PLATTFORM_ID, betrag: 100 }],
}

const VALID_INPUT = {
  datum:                     '2026-05-01',
  lagerwerte:                [{ produkt_id: PRODUKT_ID, lagerwert: 3000 }],
  transitwerte:              [{ produkt_id: PRODUKT_ID, ausgaben_transaktion_id: null, transitwert: 0 }],
  verbindlichkeiten_llv:     1000,
  verbindlichkeiten_sonstige: 500,
  darlehensvb:               2000,
  forderungen:               [{ plattform_id: PLATTFORM_ID, betrag: 100 }, { plattform_id: null, betrag: 0 }],
  steuersaldo_typ:           'verbindlichkeit',
  steuersaldo:               200,
  steuersaldo_von:           '2026-01-01',
  steuersaldo_bis:           '2026-04-30',
  cash_bestand:              5000,
  anlagevermoegen:           8000,
}

function postReq(body: unknown) {
  return new Request('http://localhost/api/vermoegenswerte', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
}

// ─── GET ──────────────────────────────────────────────────────────────────────

describe('GET /api/vermoegenswerte', () => {
  beforeEach(() => { vi.resetAllMocks(); setupAuth() })

  it('returns 200 with snapshot array', async () => {
    mockFrom.mockReturnValue({
      select: () => ({ order: () => ({ data: [MOCK_SNAPSHOT], error: null }) }),
    })
    const res = await GET()
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(Array.isArray(json)).toBe(true)
    expect(json[0].id).toBe(SNAPSHOT_ID)
  })

  it('returns 500 on DB error', async () => {
    mockFrom.mockReturnValue({
      select: () => ({ order: () => ({ data: null, error: { message: 'DB failure' } }) }),
    })
    const res = await GET()
    expect(res.status).toBe(500)
  })
})

// ─── POST ─────────────────────────────────────────────────────────────────────

describe('POST /api/vermoegenswerte', () => {
  beforeEach(() => { vi.resetAllMocks(); setupAuth() })

  it('returns 201 on valid input', async () => {
    let callCount = 0
    mockFrom.mockImplementation(() => {
      callCount++
      if (callCount === 1) {
        return { select: () => ({ eq: () => ({ maybeSingle: () => ({ data: null, error: null }) }) }) }
      }
      if (callCount === 2) {
        return {
          insert: () => ({
            select: () => ({ single: () => ({ data: { id: SNAPSHOT_ID }, error: null }) }),
          }),
        }
      }
      return { insert: () => ({ error: null }) }
    })
    const res = await POST(postReq(VALID_INPUT))
    expect(res.status).toBe(201)
    const json = await res.json()
    expect(json.id).toBe(SNAPSHOT_ID)
  })

  it('returns 409 on duplicate datum', async () => {
    mockFrom.mockReturnValue({
      select: () => ({ eq: () => ({ maybeSingle: () => ({ data: { id: SNAPSHOT_ID }, error: null }) }) }),
    })
    const res = await POST(postReq(VALID_INPUT))
    expect(res.status).toBe(409)
  })

  it('returns 400 on invalid input — missing datum', async () => {
    const { datum: _d, ...rest } = VALID_INPUT
    const res = await POST(postReq(rest))
    expect(res.status).toBe(400)
  })

  it('returns 400 when verbindlichkeiten_llv is negative', async () => {
    const res = await POST(postReq({ ...VALID_INPUT, verbindlichkeiten_llv: -1 }))
    expect(res.status).toBe(400)
  })
})

// ─── AUTH ─────────────────────────────────────────────────────────────────────

describe('Auth protection', () => {
  beforeEach(() => { vi.resetAllMocks() })

  it('GET returns 401 when not authenticated', async () => {
    vi.mocked(requireAuth).mockResolvedValueOnce({
      user: null,
      supabase: mockSupabase as never,
      error: new Response('Unauthorized', { status: 401 }),
    })
    const res = await GET()
    expect(res.status).toBe(401)
  })
})
