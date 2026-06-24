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

const KATEGORIE_ID = '11111111-1111-1111-8111-111111111111'
const EINTRAG_ID   = '22222222-2222-2222-8222-222222222222'

const MOCK_DB_ROW = {
  id: EINTRAG_ID,
  user_id: 'user-1',
  kategorie_id: KATEGORIE_ID,
  name: 'Miete Lager',
  zahlungsfrequenz: 'monatlich',
  faelligkeits_monate: [],
  zeitpunkt_im_monat: 'anfang',
  betrag_netto: 1260.50,
  ust_satz: '19',
  ust_betrag: 239.50,
  bruttobetrag: 1500,
  aktiv: true,
  created_at: '2026-06-04T00:00:00Z',
  updated_at: '2026-06-04T00:00:00Z',
  kpi_categories: { name: 'Raumkosten' },
}

const VALID_POST_BODY = {
  kategorie_id: KATEGORIE_ID,
  name: 'Miete Lager',
  zahlungsfrequenz: 'monatlich',
  faelligkeits_monate: [],
  zeitpunkt_im_monat: 'anfang',
  betrag_netto: 1260.50,
  ust_satz: '19',
  aktiv: true,
}

beforeEach(() => {
  vi.clearAllMocks()
  mockFrom.mockReset()
})

// ─── GET ─────────────────────────────────────────────────────────────────────

describe('GET /api/operative-fixkosten-einstellungen', () => {
  it('returns 200 with mapped eintraege (kategorie_name flattened)', async () => {
    mockFrom.mockReturnValueOnce({
      select: () => ({
        eq: () => ({
          order: () => ({
            limit: () => ({ data: [MOCK_DB_ROW], error: null }),
          }),
        }),
      }),
    })

    const res = await GET()
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body).toHaveLength(1)
    expect(body[0].kategorie_name).toBe('Raumkosten')
    expect(body[0].kpi_categories).toBeUndefined()
  })

  it('returns 200 with empty array when no data', async () => {
    mockFrom.mockReturnValueOnce({
      select: () => ({
        eq: () => ({
          order: () => ({
            limit: () => ({ data: [], error: null }),
          }),
        }),
      }),
    })

    const res = await GET()
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual([])
  })

  it('returns 500 on database error', async () => {
    mockFrom.mockReturnValueOnce({
      select: () => ({
        eq: () => ({
          order: () => ({
            limit: () => ({ data: null, error: { message: 'DB error' } }),
          }),
        }),
      }),
    })

    const res = await GET()
    expect(res.status).toBe(500)
  })
})

// ─── POST ────────────────────────────────────────────────────────────────────

describe('POST /api/operative-fixkosten-einstellungen', () => {
  it('creates eintrag with monatlich frequency and computes brutto', async () => {
    mockFrom.mockReturnValueOnce({
      insert: () => ({
        select: () => ({
          single: () => ({ data: MOCK_DB_ROW, error: null }),
        }),
      }),
    })

    const res = await POST(req('http://localhost/api/operative-fixkosten-einstellungen', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(VALID_POST_BODY),
    }))
    expect(res.status).toBe(201)
    const body = await res.json()
    expect(body.kategorie_name).toBe('Raumkosten')
    expect(body.kpi_categories).toBeUndefined()
  })

  it('creates eintrag with jaehrlich frequency', async () => {
    const row = { ...MOCK_DB_ROW, zahlungsfrequenz: 'jaehrlich', faelligkeits_monate: [3] }
    mockFrom.mockReturnValueOnce({
      insert: () => ({
        select: () => ({ single: () => ({ data: row, error: null }) }),
      }),
    })

    const res = await POST(req('http://localhost/api/operative-fixkosten-einstellungen', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...VALID_POST_BODY, zahlungsfrequenz: 'jaehrlich', faelligkeits_monate: [3] }),
    }))
    expect(res.status).toBe(201)
  })

  it('creates eintrag with quartalsweise frequency', async () => {
    const row = { ...MOCK_DB_ROW, zahlungsfrequenz: 'quartalsweise', faelligkeits_monate: [2, 5, 8, 11] }
    mockFrom.mockReturnValueOnce({
      insert: () => ({
        select: () => ({ single: () => ({ data: row, error: null }) }),
      }),
    })

    const res = await POST(req('http://localhost/api/operative-fixkosten-einstellungen', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...VALID_POST_BODY, zahlungsfrequenz: 'quartalsweise', faelligkeits_monate: [2, 5, 8, 11] }),
    }))
    expect(res.status).toBe(201)
  })

  it('creates eintrag with individuell USt', async () => {
    mockFrom.mockReturnValueOnce({
      insert: () => ({
        select: () => ({ single: () => ({ data: MOCK_DB_ROW, error: null }) }),
      }),
    })

    const res = await POST(req('http://localhost/api/operative-fixkosten-einstellungen', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...VALID_POST_BODY, ust_satz: 'individuell', ust_betrag_individuell: 50 }),
    }))
    expect(res.status).toBe(201)
  })

  it('returns 400 when kategorie_id is missing', async () => {
    const { kategorie_id: _k, ...body } = VALID_POST_BODY
    const res = await POST(req('http://localhost/api/operative-fixkosten-einstellungen', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    }))
    expect(res.status).toBe(400)
  })

  it('returns 400 when betrag_netto is zero', async () => {
    const res = await POST(req('http://localhost/api/operative-fixkosten-einstellungen', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...VALID_POST_BODY, betrag_netto: 0 }),
    }))
    expect(res.status).toBe(400)
  })

  it('returns 400 when individuell USt has no betrag', async () => {
    const res = await POST(req('http://localhost/api/operative-fixkosten-einstellungen', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...VALID_POST_BODY, ust_satz: 'individuell', ust_betrag_individuell: 0 }),
    }))
    expect(res.status).toBe(400)
  })

  it('returns 400 when jaehrlich has wrong number of monate', async () => {
    const res = await POST(req('http://localhost/api/operative-fixkosten-einstellungen', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...VALID_POST_BODY, zahlungsfrequenz: 'jaehrlich', faelligkeits_monate: [1, 2] }),
    }))
    expect(res.status).toBe(400)
  })

  it('returns 400 when quartalsweise has wrong quartal distribution', async () => {
    const res = await POST(req('http://localhost/api/operative-fixkosten-einstellungen', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...VALID_POST_BODY, zahlungsfrequenz: 'quartalsweise', faelligkeits_monate: [1, 2, 3, 4] }),
    }))
    expect(res.status).toBe(400)
  })

  it('returns 400 on invalid JSON body', async () => {
    const res = await POST(req('http://localhost/api/operative-fixkosten-einstellungen', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: 'not-json',
    }))
    expect(res.status).toBe(400)
  })
})
