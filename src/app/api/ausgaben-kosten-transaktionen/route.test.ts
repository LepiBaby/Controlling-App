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

const KAT_ID = '123e4567-e89b-12d3-a456-426614174000'

const VALID_TRANSAKTION = {
  leistungsdatum: '2024-01-15',
  betrag_brutto:  1190.00,
  ust_satz:       '19',
  ust_betrag:     190.00,
  kategorie_id:   KAT_ID,
  relevanz:       'beides',
}

const MOCK_ROW = {
  id:                          'txn-1',
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
  relevanz:                    'beides',
  abschreibung:                null,
  created_at:                  '2024-01-15T10:00:00Z',
}

// ─── GET ──────────────────────────────────────────────────────────────────────

describe('GET /api/ausgaben-kosten-transaktionen', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockFrom.mockReturnValue({
      select: () => ({
        order: () => ({
          range: () => ({ data: [], error: null, count: 0 }),
        }),
      }),
    })
  })

  function mockSellerboardCount(n: number) {
    return { select: () => ({ eq: () => ({ count: n, error: null }) }) }
  }

  it('returns 200 with data/total/totalBrutto/totalNetto shape', async () => {
    mockFrom
      .mockReturnValueOnce({
        select: () => ({
          order: () => ({
            range: () => ({ data: [MOCK_ROW], error: null, count: 1 }),
          }),
        }),
      })
      .mockReturnValueOnce({
        select: () => ({ data: [{ betrag_brutto: 1190, betrag_netto: 1000 }], error: null }),
      })
      .mockReturnValueOnce(mockSellerboardCount(0))

    const res = await GET(req('http://localhost/api/ausgaben-kosten-transaktionen'))
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body).toHaveProperty('data')
    expect(body).toHaveProperty('total')
    expect(body).toHaveProperty('totalBrutto')
    expect(body).toHaveProperty('totalNetto')
    expect(Array.isArray(body.data)).toBe(true)
  })

  it('returns 200 with empty arrays and zero sums for no data', async () => {
    mockFrom
      .mockReturnValueOnce({
        select: () => ({
          order: () => ({
            range: () => ({ data: [], error: null, count: 0 }),
          }),
        }),
      })
      .mockReturnValueOnce({
        select: () => ({ data: [], error: null }),
      })
      .mockReturnValueOnce(mockSellerboardCount(0))

    const res = await GET(req('http://localhost/api/ausgaben-kosten-transaktionen'))
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.total).toBe(0)
    expect(body.totalBrutto).toBe(0)
    expect(body.totalNetto).toBe(0)
  })

  it('includes sellerboardCount in response (PROJ-38)', async () => {
    mockFrom
      .mockReturnValueOnce({
        select: () => ({
          order: () => ({
            range: () => ({ data: [MOCK_ROW], error: null, count: 1 }),
          }),
        }),
      })
      .mockReturnValueOnce({
        select: () => ({ data: [{ betrag_brutto: 1190, betrag_netto: 1000 }], error: null }),
      })
      .mockReturnValueOnce(mockSellerboardCount(5))

    const res = await GET(req('http://localhost/api/ausgaben-kosten-transaktionen'))
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body).toHaveProperty('sellerboardCount', 5)
  })

  it('applies excludeImportSource filter via OR IS NULL (PROJ-38)', async () => {
    // When excludeImportSource=sellerboard, the route uses .or('import_source.is.null,...')
    // which means manual transactions (NULL) are still shown
    const orMock = vi.fn().mockReturnValue({ data: [MOCK_ROW], error: null, count: 1 })
    const orMockSum = vi.fn().mockReturnValue({ data: [{ betrag_brutto: 1190, betrag_netto: 1000 }], error: null })

    mockFrom
      .mockReturnValueOnce({
        select: () => ({
          order: () => ({
            range: () => ({
              gte: () => ({ lte: () => ({ or: orMock }) }),
              or: orMock,
            }),
          }),
        }),
      })
      .mockReturnValueOnce({
        select: () => ({ or: orMockSum }),
      })
      .mockReturnValueOnce(mockSellerboardCount(3))

    const res = await GET(req('http://localhost/api/ausgaben-kosten-transaktionen?excludeImportSource=sellerboard'))
    expect(res.status).toBe(200)
    // orMock should have been called with the IS NULL condition
    expect(orMock).toHaveBeenCalledWith(expect.stringContaining('import_source.is.null'))
    expect(orMock).toHaveBeenCalledWith(expect.stringContaining('import_source.neq.sellerboard'))
  })

  it('returns 401 when unauthenticated', async () => {
    const { requireAuth } = await import('@/lib/supabase-server')
    vi.mocked(requireAuth).mockResolvedValueOnce({
      user: null,
      supabase: null as never,
      error: new Response('Unauthorized', { status: 401 }),
    })
    const res = await GET(req('http://localhost/api/ausgaben-kosten-transaktionen'))
    expect(res.status).toBe(401)
  })
})

// ─── POST ─────────────────────────────────────────────────────────────────────

describe('POST /api/ausgaben-kosten-transaktionen', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockFrom.mockReturnValue({
      insert: () => ({
        select: () => ({
          single: () => ({ data: MOCK_ROW, error: null }),
        }),
      }),
    })
  })

  it('returns 201 with valid payload (19% USt)', async () => {
    const res = await POST(req('http://localhost/api/ausgaben-kosten-transaktionen', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(VALID_TRANSAKTION),
    }))
    expect(res.status).toBe(201)
    const body = await res.json()
    expect(body.id).toBe('txn-1')
  })

  it('returns 201 with 0% USt', async () => {
    const res = await POST(req('http://localhost/api/ausgaben-kosten-transaktionen', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...VALID_TRANSAKTION, ust_satz: '0', ust_betrag: 0 }),
    }))
    expect(res.status).toBe(201)
  })

  it('returns 201 with individuell USt and optional fields', async () => {
    const res = await POST(req('http://localhost/api/ausgaben-kosten-transaktionen', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ...VALID_TRANSAKTION,
        ust_satz: 'individuell',
        ust_betrag: 50,
        zahlungsdatum: '2024-01-20',
        beschreibung: 'Test',
        relevanz: 'rentabilitaet',
        abschreibung: '5_jahre',
      }),
    }))
    expect(res.status).toBe(201)
  })

  it('returns 400 for missing leistungsdatum', async () => {
    const { leistungsdatum: _, ...rest } = VALID_TRANSAKTION
    const res = await POST(req('http://localhost/api/ausgaben-kosten-transaktionen', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(rest),
    }))
    expect(res.status).toBe(400)
  })

  it('returns 400 for missing betrag_brutto', async () => {
    const { betrag_brutto: _, ...rest } = VALID_TRANSAKTION
    const res = await POST(req('http://localhost/api/ausgaben-kosten-transaktionen', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(rest),
    }))
    expect(res.status).toBe(400)
  })

  it('returns 400 for betrag_brutto = 0', async () => {
    const res = await POST(req('http://localhost/api/ausgaben-kosten-transaktionen', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...VALID_TRANSAKTION, betrag_brutto: 0 }),
    }))
    expect(res.status).toBe(400)
  })

  it('returns 400 for negative betrag_brutto', async () => {
    const res = await POST(req('http://localhost/api/ausgaben-kosten-transaktionen', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...VALID_TRANSAKTION, betrag_brutto: -100 }),
    }))
    expect(res.status).toBe(400)
  })

  it('returns 400 for invalid ust_satz', async () => {
    const res = await POST(req('http://localhost/api/ausgaben-kosten-transaktionen', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...VALID_TRANSAKTION, ust_satz: '16' }),
    }))
    expect(res.status).toBe(400)
  })

  it('returns 400 for invalid date format', async () => {
    const res = await POST(req('http://localhost/api/ausgaben-kosten-transaktionen', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...VALID_TRANSAKTION, leistungsdatum: '15.01.2024' }),
    }))
    expect(res.status).toBe(400)
  })

  it('returns 400 for invalid kategorie_id', async () => {
    const res = await POST(req('http://localhost/api/ausgaben-kosten-transaktionen', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...VALID_TRANSAKTION, kategorie_id: 'not-a-uuid' }),
    }))
    expect(res.status).toBe(400)
  })

  it('returns 400 for invalid relevanz value', async () => {
    const res = await POST(req('http://localhost/api/ausgaben-kosten-transaktionen', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...VALID_TRANSAKTION, relevanz: 'ja' }),
    }))
    expect(res.status).toBe(400)
  })

  it('returns 400 when relevanz is missing', async () => {
    const { relevanz: _, ...withoutRelevanz } = VALID_TRANSAKTION
    const res = await POST(req('http://localhost/api/ausgaben-kosten-transaktionen', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(withoutRelevanz),
    }))
    expect(res.status).toBe(400)
  })

  it('returns 400 for invalid abschreibung', async () => {
    const res = await POST(req('http://localhost/api/ausgaben-kosten-transaktionen', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...VALID_TRANSAKTION, abschreibung: '2_jahre' }),
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
    const res = await POST(req('http://localhost/api/ausgaben-kosten-transaktionen', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(VALID_TRANSAKTION),
    }))
    expect(res.status).toBe(401)
  })
})
