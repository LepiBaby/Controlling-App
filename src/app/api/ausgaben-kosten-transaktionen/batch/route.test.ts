import { describe, it, expect, vi, beforeEach } from 'vitest'
import { POST } from './route'

const mockFrom = vi.fn()

vi.mock('@/lib/supabase-server', () => ({
  requireAuth: vi.fn().mockResolvedValue({
    user: { id: 'user-1', email: 'test@test.com' },
    supabase: { from: (table: string) => mockFrom(table) },
    error: null,
  }),
}))

function req(body: unknown) {
  return new Request('http://localhost/api/ausgaben-kosten-transaktionen/batch', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
}

const KAT_ID = '123e4567-e89b-12d3-a456-426614174000'

const VALID_ITEM = {
  leistungsdatum: '2024-01-15',
  betrag_brutto:  556.73,
  ust_satz:       'individuell',
  ust_betrag:     3.60,
  kategorie_id:   KAT_ID,
  relevanz:       'rentabilitaet',
  beschreibung:   'Amazon Ads',
}

const MOCK_ROW = {
  id:                 'txn-batch-1',
  leistungsdatum:     '2024-01-15',
  zahlungsdatum:      null,
  betrag_brutto:      556.73,
  betrag_netto:       553.13,
  ust_satz:           'individuell',
  ust_betrag:         3.60,
  kategorie_id:       KAT_ID,
  gruppe_id:          null,
  untergruppe_id:     null,
  sales_plattform_id: null,
  produkt_id:         null,
  beschreibung:       'Amazon Ads',
  relevanz:           'rentabilitaet',
  abschreibung:       null,
  created_at:         '2024-01-15T10:00:00Z',
}

function mockInsertSuccess(row = MOCK_ROW) {
  mockFrom.mockReturnValue({
    insert: () => ({
      select: () => ({
        single: () => Promise.resolve({ data: row, error: null }),
      }),
    }),
  })
}

// ─── POST (happy path) ─────────────────────────────────────────────────────────

describe('POST /api/ausgaben-kosten-transaktionen/batch', () => {
  beforeEach(() => vi.clearAllMocks())

  it('returns 201 with successCount for a single valid item', async () => {
    mockInsertSuccess()
    const res = await POST(req([VALID_ITEM]))
    expect(res.status).toBe(201)
    const body = await res.json()
    expect(body.successCount).toBe(1)
    expect(body.errorCount).toBe(0)
  })

  it('returns 201 with correct successCount for multiple valid items', async () => {
    mockFrom.mockReturnValue({
      insert: () => ({
        select: () => ({
          single: () => Promise.resolve({ data: MOCK_ROW, error: null }),
        }),
      }),
    })
    const items = [VALID_ITEM, { ...VALID_ITEM, beschreibung: 'Item 2' }, { ...VALID_ITEM, beschreibung: 'Item 3' }]
    const res = await POST(req(items))
    expect(res.status).toBe(201)
    const body = await res.json()
    expect(body.successCount).toBe(3)
    expect(body.errorCount).toBe(0)
  })

  it('computes betrag_netto server-side for individuell ust', async () => {
    let capturedInsert: unknown = null
    mockFrom.mockReturnValue({
      insert: (data: unknown) => {
        capturedInsert = data
        return {
          select: () => ({
            single: () => Promise.resolve({ data: MOCK_ROW, error: null }),
          }),
        }
      },
    })

    await POST(req([{ ...VALID_ITEM, betrag_brutto: 100, ust_betrag: 19, ust_satz: 'individuell' }]))
    expect(capturedInsert).toMatchObject({ betrag_netto: 81, ust_betrag: 19 })
  })

  it('computes betrag_netto server-side for 19% ust', async () => {
    let capturedInsert: unknown = null
    mockFrom.mockReturnValue({
      insert: (data: unknown) => {
        capturedInsert = data
        return {
          select: () => ({
            single: () => Promise.resolve({ data: MOCK_ROW, error: null }),
          }),
        }
      },
    })

    await POST(req([{ ...VALID_ITEM, betrag_brutto: 1190, ust_betrag: 0, ust_satz: '19' }]))
    expect(capturedInsert).toMatchObject({ betrag_netto: 1000, ust_betrag: 190 })
  })

  // ─── Partial success ──────────────────────────────────────────────────────

  it('returns 207 when some rows fail DB insert', async () => {
    mockFrom
      .mockReturnValueOnce({
        insert: () => ({
          select: () => ({
            single: () => Promise.resolve({ data: MOCK_ROW, error: null }),
          }),
        }),
      })
      .mockReturnValueOnce({
        insert: () => ({
          select: () => ({
            single: () => Promise.resolve({ data: null, error: { message: 'FK violation' } }),
          }),
        }),
      })

    const res = await POST(req([VALID_ITEM, VALID_ITEM]))
    expect(res.status).toBe(207)
    const body = await res.json()
    expect(body.successCount).toBe(1)
    expect(body.errorCount).toBe(1)
    expect(body.errors).toHaveLength(1)
  })

  // ─── Validation errors ────────────────────────────────────────────────────

  it('returns 400 when body is not an array', async () => {
    const res = await POST(req({ single: 'object' }))
    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error).toContain('Array')
  })

  it('returns 400 when array is empty', async () => {
    const res = await POST(req([]))
    expect(res.status).toBe(400)
  })

  it('returns 400 for missing required fields', async () => {
    const res = await POST(req([{ betrag_brutto: 100 }]))
    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.validationErrors).toBeDefined()
    expect(body.validationErrors[0].index).toBe(0)
  })

  it('returns 400 for invalid leistungsdatum format', async () => {
    const res = await POST(req([{ ...VALID_ITEM, leistungsdatum: '15.01.2024' }]))
    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.validationErrors).toBeDefined()
  })

  it('returns 400 for negative betrag_brutto', async () => {
    const res = await POST(req([{ ...VALID_ITEM, betrag_brutto: -100 }]))
    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.validationErrors).toBeDefined()
  })

  it('returns 400 for invalid relevanz value', async () => {
    const res = await POST(req([{ ...VALID_ITEM, relevanz: 'invalid' }]))
    expect(res.status).toBe(400)
  })

  it('returns 400 when batch size exceeds 500', async () => {
    const items = Array.from({ length: 501 }, () => VALID_ITEM)
    const res = await POST(req(items))
    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error).toContain('500')
  })

  it('returns 400 for invalid JSON', async () => {
    const badReq = new Request('http://localhost/api/ausgaben-kosten-transaktionen/batch', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: 'not-json',
    })
    const res = await POST(badReq)
    expect(res.status).toBe(400)
  })

  // ─── Authentication ────────────────────────────────────────────────────────

  it('returns 401 when not authenticated', async () => {
    const { requireAuth } = await import('@/lib/supabase-server')
    vi.mocked(requireAuth).mockResolvedValueOnce({
      user: null as unknown as ReturnType<typeof requireAuth> extends Promise<infer T> ? T['user'] : never,
      supabase: null as unknown as ReturnType<typeof requireAuth> extends Promise<infer T> ? T['supabase'] : never,
      error: new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 }),
    })

    const res = await POST(req([VALID_ITEM]))
    expect(res.status).toBe(401)
  })

  // ─── All-fail case ─────────────────────────────────────────────────────────

  it('returns 500 when all rows fail DB insert', async () => {
    mockFrom.mockReturnValue({
      insert: () => ({
        select: () => ({
          single: () => Promise.resolve({ data: null, error: { message: 'DB error' } }),
        }),
      }),
    })
    const res = await POST(req([VALID_ITEM]))
    expect(res.status).toBe(500)
  })

  it('accepts import_source field and stores it (PROJ-38)', async () => {
    let capturedInsert: Record<string, unknown> | null = null
    mockFrom.mockReturnValue({
      insert: (data: Record<string, unknown>) => {
        capturedInsert = data
        return {
          select: () => ({
            single: () => Promise.resolve({ data: MOCK_ROW, error: null }),
          }),
        }
      },
    })
    const res = await POST(req([{ ...VALID_ITEM, import_source: 'sellerboard' }]))
    expect(res.status).toBe(201)
    expect(capturedInsert).toHaveProperty('import_source', 'sellerboard')
  })

  it('stores import_source as null when not provided (PROJ-38)', async () => {
    let capturedInsert: Record<string, unknown> | null = null
    mockFrom.mockReturnValue({
      insert: (data: Record<string, unknown>) => {
        capturedInsert = data
        return {
          select: () => ({
            single: () => Promise.resolve({ data: MOCK_ROW, error: null }),
          }),
        }
      },
    })
    const res = await POST(req([VALID_ITEM]))
    expect(res.status).toBe(201)
    expect(capturedInsert).toHaveProperty('import_source', null)
  })
})
