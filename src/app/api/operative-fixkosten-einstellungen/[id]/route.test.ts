import { describe, it, expect, vi, beforeEach } from 'vitest'
import { PUT, DELETE } from './route'

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
  name: 'Miete Lager aktualisiert',
  zahlungsfrequenz: 'monatlich',
  faelligkeits_monate: [],
  zeitpunkt_im_monat: 'mitte',
  betrag_netto: 2000,
  ust_satz: '19',
  ust_betrag: 380,
  bruttobetrag: 2380,
  aktiv: true,
  created_at: '2026-06-04T00:00:00Z',
  updated_at: '2026-06-04T00:00:00Z',
  kpi_categories: { name: 'Raumkosten' },
}

const VALID_PUT_BODY = {
  kategorie_id: KATEGORIE_ID,
  name: 'Miete Lager aktualisiert',
  zahlungsfrequenz: 'monatlich',
  faelligkeits_monate: [],
  zeitpunkt_im_monat: 'mitte',
  betrag_netto: 2000,
  ust_satz: '19',
  aktiv: true,
}

function makeCtx(id: string) {
  return { params: Promise.resolve({ id }) }
}

beforeEach(() => {
  vi.clearAllMocks()
  mockFrom.mockReset()
})

// ─── PUT ─────────────────────────────────────────────────────────────────────

describe('PUT /api/operative-fixkosten-einstellungen/[id]', () => {
  it('updates eintrag and returns it with kategorie_name and computed brutto', async () => {
    mockFrom.mockReturnValueOnce({
      update: () => ({
        eq: () => ({
          eq: () => ({
            select: () => ({
              single: () => ({ data: MOCK_DB_ROW, error: null }),
            }),
          }),
        }),
      }),
    })

    const res = await PUT(
      req(`http://localhost/api/operative-fixkosten-einstellungen/${EINTRAG_ID}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(VALID_PUT_BODY),
      }),
      makeCtx(EINTRAG_ID),
    )
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.name).toBe('Miete Lager aktualisiert')
    expect(body.kategorie_name).toBe('Raumkosten')
    expect(body.kpi_categories).toBeUndefined()
  })

  it('returns 404 when eintrag not found (no data from db)', async () => {
    mockFrom.mockReturnValueOnce({
      update: () => ({
        eq: () => ({
          eq: () => ({
            select: () => ({
              single: () => ({ data: null, error: null }),
            }),
          }),
        }),
      }),
    })

    const res = await PUT(
      req(`http://localhost/api/operative-fixkosten-einstellungen/${EINTRAG_ID}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(VALID_PUT_BODY),
      }),
      makeCtx(EINTRAG_ID),
    )
    expect(res.status).toBe(404)
  })

  it('returns 400 when betrag_netto is zero', async () => {
    const res = await PUT(
      req(`http://localhost/api/operative-fixkosten-einstellungen/${EINTRAG_ID}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...VALID_PUT_BODY, betrag_netto: 0 }),
      }),
      makeCtx(EINTRAG_ID),
    )
    expect(res.status).toBe(400)
  })

  it('returns 400 when zahlungsfrequenz is invalid', async () => {
    const res = await PUT(
      req(`http://localhost/api/operative-fixkosten-einstellungen/${EINTRAG_ID}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...VALID_PUT_BODY, zahlungsfrequenz: 'halbjaehrlich' }),
      }),
      makeCtx(EINTRAG_ID),
    )
    expect(res.status).toBe(400)
  })

  it('returns 400 when jaehrlich has no monat', async () => {
    const res = await PUT(
      req(`http://localhost/api/operative-fixkosten-einstellungen/${EINTRAG_ID}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...VALID_PUT_BODY, zahlungsfrequenz: 'jaehrlich', faelligkeits_monate: [] }),
      }),
      makeCtx(EINTRAG_ID),
    )
    expect(res.status).toBe(400)
  })

  it('returns 400 on invalid JSON', async () => {
    const res = await PUT(
      req(`http://localhost/api/operative-fixkosten-einstellungen/${EINTRAG_ID}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: 'not-json',
      }),
      makeCtx(EINTRAG_ID),
    )
    expect(res.status).toBe(400)
  })
})

// ─── DELETE ──────────────────────────────────────────────────────────────────

describe('DELETE /api/operative-fixkosten-einstellungen/[id]', () => {
  it('deletes eintrag and returns 204', async () => {
    mockFrom.mockReturnValueOnce({
      delete: () => ({
        eq: () => ({
          eq: () => ({ error: null }),
        }),
      }),
    })

    const res = await DELETE(
      req(`http://localhost/api/operative-fixkosten-einstellungen/${EINTRAG_ID}`, { method: 'DELETE' }),
      makeCtx(EINTRAG_ID),
    )
    expect(res.status).toBe(204)
  })

  it('returns 500 on database error', async () => {
    mockFrom.mockReturnValueOnce({
      delete: () => ({
        eq: () => ({
          eq: () => ({ error: { message: 'DB-Fehler' } }),
        }),
      }),
    })

    const res = await DELETE(
      req(`http://localhost/api/operative-fixkosten-einstellungen/${EINTRAG_ID}`, { method: 'DELETE' }),
      makeCtx(EINTRAG_ID),
    )
    expect(res.status).toBe(500)
  })
})
