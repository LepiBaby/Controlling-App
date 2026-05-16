import { describe, it, expect, vi, beforeEach } from 'vitest'
import { GET } from './route'

const mockFrom = vi.fn()

vi.mock('@/lib/supabase-server', () => ({
  requireAuth: vi.fn().mockResolvedValue({
    user: { id: 'user-1', email: 'test@test.com' },
    supabase: { from: (table: string) => mockFrom(table) },
    error: null,
  }),
}))

function req(params: Record<string, string> = {}) {
  const qs = new URLSearchParams(params).toString()
  return new Request(`http://localhost/api/reporting/absatz?${qs}`)
}

function chain(result: { data: unknown; error: unknown }) {
  const obj: Record<string, unknown> = {}
  const methods = ['select', 'eq', 'in', 'not', 'is', 'gte', 'lte', 'or', 'order', 'limit']
  for (const m of methods) obj[m] = () => obj
  ;(obj as { then: (fn: (r: unknown) => unknown) => unknown }).then =
    (fn: (r: unknown) => unknown) => Promise.resolve(result).then(fn)
  return obj
}

const PRODUKT_ID_1 = 'eeeeeeee-0000-0000-0000-000000000001'
const PRODUKT_ID_2 = 'eeeeeeee-0000-0000-0000-000000000002'
const PLT_ID_1     = 'ffffffff-0000-0000-0000-000000000001'
const PLT_ID_2     = 'ffffffff-0000-0000-0000-000000000002'

function setupMocks(transaktionen: unknown[], produkte: unknown[], plattformen: unknown[] = []) {
  mockFrom
    .mockReturnValueOnce(chain({ data: transaktionen, error: null }))
    .mockReturnValueOnce(chain({ data: produkte, error: null }))
    .mockReturnValueOnce(chain({ data: plattformen, error: null }))
}

beforeEach(() => {
  vi.clearAllMocks()
  mockFrom.mockReset()
})

const BASE = { von: '2026-01', bis: '2026-03', granularitaet: 'monat' }

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('GET /api/reporting/absatz', () => {

  // ── Authentifizierung ───────────────────────────────────────────────────────

  it('returns 401 when unauthenticated', async () => {
    const { requireAuth } = await import('@/lib/supabase-server')
    vi.mocked(requireAuth).mockResolvedValueOnce({
      user: null, supabase: null as never,
      error: new Response('Unauthorized', { status: 401 }),
    })
    const res = await GET(req(BASE))
    expect(res.status).toBe(401)
  })

  // ── Parameter-Validierung ───────────────────────────────────────────────────

  it('returns 400 when von is missing', async () => {
    const res = await GET(req({ bis: '2026-03' }))
    expect(res.status).toBe(400)
  })

  it('returns 400 when bis is missing', async () => {
    const res = await GET(req({ von: '2026-01' }))
    expect(res.status).toBe(400)
  })

  it('returns 400 when von has wrong format', async () => {
    const res = await GET(req({ von: '2026-01-01', bis: '2026-03' }))
    expect(res.status).toBe(400)
  })

  it('returns 400 when granularitaet is invalid', async () => {
    const res = await GET(req({ ...BASE, granularitaet: 'woche' }))
    expect(res.status).toBe(400)
  })

  it('returns 400 when von > bis', async () => {
    const res = await GET(req({ von: '2026-06', bis: '2026-01', granularitaet: 'monat' }))
    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error).toMatch(/von.*bis/i)
  })

  // ── Perioden-Generierung ────────────────────────────────────────────────────

  it('returns correct monthly perioden', async () => {
    setupMocks([], [])
    const res = await GET(req(BASE))
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.perioden).toEqual(['2026-01', '2026-02', '2026-03'])
  })

  it('returns correct quarterly perioden', async () => {
    setupMocks([], [])
    const res = await GET(req({ von: '2026-01', bis: '2026-06', granularitaet: 'quartal' }))
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.perioden).toEqual(['2026-Q1', '2026-Q2'])
  })

  it('returns correct yearly perioden', async () => {
    setupMocks([], [])
    const res = await GET(req({ von: '2025-01', bis: '2026-06', granularitaet: 'jahr' }))
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.perioden).toEqual(['2025', '2026'])
  })

  // ── Basisberechnung ─────────────────────────────────────────────────────────

  it('aggregates plattform sendungen + sendungen_manuell correctly', async () => {
    setupMocks(
      [
        {
          produkt_id: PRODUKT_ID_1,
          datum: '2026-01-15',
          sendungen_manuell: 10,
          sendungen: [
            { plattform_id: PLT_ID_1, menge: 20 },
            { plattform_id: PLT_ID_2, menge: 5 },
          ],
        },
      ],
      [{ id: PRODUKT_ID_1, name: 'Produkt A', sort_order: 1 }],
    )
    const res = await GET(req(BASE))
    expect(res.status).toBe(200)
    const body = await res.json()
    // 20 + 5 + 10 = 35 Sendungen
    expect(body.gesamt['2026-01']).toBe(35)
    expect(body.gesamt['2026-02']).toBe(0)
    expect(body.gesamt['2026-03']).toBe(0)
    expect(body.produkte).toHaveLength(1)
    expect(body.produkte[0].values['2026-01']).toBe(35)
  })

  it('returns gesamt=0 and empty produkte when no transactions', async () => {
    setupMocks([], [])
    const res = await GET(req(BASE))
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.gesamt).toEqual({ '2026-01': 0, '2026-02': 0, '2026-03': 0 })
    expect(body.produkte).toHaveLength(0)
  })

  it('aggregates multiple transactions across periods', async () => {
    setupMocks(
      [
        { produkt_id: PRODUKT_ID_1, datum: '2026-01-10', sendungen_manuell: 5, sendungen: [] },
        { produkt_id: PRODUKT_ID_1, datum: '2026-02-05', sendungen_manuell: 8, sendungen: [] },
        { produkt_id: PRODUKT_ID_2, datum: '2026-01-20', sendungen_manuell: 3, sendungen: [{ plattform_id: PLT_ID_1, menge: 7 }] },
      ],
      [
        { id: PRODUKT_ID_1, name: 'Produkt A', sort_order: 1 },
        { id: PRODUKT_ID_2, name: 'Produkt B', sort_order: 2 },
      ],
    )
    const res = await GET(req(BASE))
    expect(res.status).toBe(200)
    const body = await res.json()
    // Jan: P1=5, P2=10 → gesamt=15
    expect(body.gesamt['2026-01']).toBe(15)
    // Feb: P1=8 → gesamt=8
    expect(body.gesamt['2026-02']).toBe(8)
    expect(body.produkte).toHaveLength(2)
    const p1 = body.produkte.find((p: { id: string }) => p.id === PRODUKT_ID_1)
    expect(p1.values['2026-01']).toBe(5)
    expect(p1.values['2026-02']).toBe(8)
    const p2 = body.produkte.find((p: { id: string }) => p.id === PRODUKT_ID_2)
    expect(p2.values['2026-01']).toBe(10)
    expect(p2.values['2026-02']).toBe(0)
  })

  // ── Produkt-Filter ──────────────────────────────────────────────────────────

  it('applies produkt_ids filter — only filtered product counted in gesamt', async () => {
    setupMocks(
      // API gibt nur PRODUKT_ID_1 zurück, weil .in('produkt_id', ...) angewendet wurde
      [{ produkt_id: PRODUKT_ID_1, datum: '2026-01-10', sendungen_manuell: 12, sendungen: [] }],
      [{ id: PRODUKT_ID_1, name: 'Produkt A', sort_order: 1 }],
    )
    const res = await GET(req({ ...BASE, produkt_ids: PRODUKT_ID_1 }))
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.gesamt['2026-01']).toBe(12)
    expect(body.produkte).toHaveLength(1)
    expect(body.produkte[0].id).toBe(PRODUKT_ID_1)
  })

  // ── Plattform-Filter ────────────────────────────────────────────────────────

  it('applies plattform_ids filter — counts only filtered plattform menge + sendungen_manuell', async () => {
    setupMocks(
      [
        {
          produkt_id: PRODUKT_ID_1,
          datum: '2026-01-15',
          sendungen_manuell: 5,
          sendungen: [
            { plattform_id: PLT_ID_1, menge: 20 },
            { plattform_id: PLT_ID_2, menge: 8 }, // gefiltert heraus
          ],
        },
      ],
      [{ id: PRODUKT_ID_1, name: 'Produkt A', sort_order: 1 }],
    )
    const res = await GET(req({ ...BASE, plattform_ids: PLT_ID_1 }))
    expect(res.status).toBe(200)
    const body = await res.json()
    // PLT_ID_1=20 + manuell=5 = 25 (PLT_ID_2=8 wird ignoriert)
    expect(body.gesamt['2026-01']).toBe(25)
  })

  it('combined filter: produkt + plattform', async () => {
    setupMocks(
      [
        {
          produkt_id: PRODUKT_ID_1,
          datum: '2026-01-15',
          sendungen_manuell: 2,
          sendungen: [
            { plattform_id: PLT_ID_1, menge: 10 },
            { plattform_id: PLT_ID_2, menge: 99 }, // rausgefiltert
          ],
        },
      ],
      [{ id: PRODUKT_ID_1, name: 'Produkt A', sort_order: 1 }],
    )
    const res = await GET(req({ ...BASE, produkt_ids: PRODUKT_ID_1, plattform_ids: PLT_ID_1 }))
    expect(res.status).toBe(200)
    const body = await res.json()
    // PLT_ID_1=10 + manuell=2 = 12
    expect(body.gesamt['2026-01']).toBe(12)
  })

  // ── Quartal-Aggregation ─────────────────────────────────────────────────────

  it('aggregates correctly by quarter', async () => {
    setupMocks(
      [
        { produkt_id: PRODUKT_ID_1, datum: '2026-01-10', sendungen_manuell: 10, sendungen: [] },
        { produkt_id: PRODUKT_ID_1, datum: '2026-03-20', sendungen_manuell: 5, sendungen: [] },
        { produkt_id: PRODUKT_ID_1, datum: '2026-04-05', sendungen_manuell: 8, sendungen: [] },
      ],
      [{ id: PRODUKT_ID_1, name: 'Produkt A', sort_order: 1 }],
    )
    const res = await GET(req({ von: '2026-01', bis: '2026-06', granularitaet: 'quartal' }))
    expect(res.status).toBe(200)
    const body = await res.json()
    // Q1: 10 + 5 = 15
    expect(body.gesamt['2026-Q1']).toBe(15)
    // Q2: 8
    expect(body.gesamt['2026-Q2']).toBe(8)
  })

  // ── Produkte nur mit Daten ──────────────────────────────────────────────────

  it('does not include products without transactions in the period', async () => {
    setupMocks(
      [{ produkt_id: PRODUKT_ID_1, datum: '2026-01-10', sendungen_manuell: 3, sendungen: [] }],
      [
        { id: PRODUKT_ID_1, name: 'Produkt A', sort_order: 1 },
        { id: PRODUKT_ID_2, name: 'Produkt B', sort_order: 2 }, // kein Eintrag
      ],
    )
    const res = await GET(req(BASE))
    expect(res.status).toBe(200)
    const body = await res.json()
    // Nur PRODUKT_ID_1 hat Daten
    expect(body.produkte).toHaveLength(1)
    expect(body.produkte[0].id).toBe(PRODUKT_ID_1)
  })

  // ── Plattform-Unterzeilen ───────────────────────────────────────────────────

  it('includes platform breakdown per product', async () => {
    setupMocks(
      [
        {
          produkt_id: PRODUKT_ID_1,
          datum: '2026-01-15',
          sendungen_manuell: 5,
          sendungen: [
            { plattform_id: PLT_ID_1, menge: 20 },
            { plattform_id: PLT_ID_2, menge: 8 },
          ],
        },
      ],
      [{ id: PRODUKT_ID_1, name: 'Produkt A', sort_order: 1 }],
      [
        { id: PLT_ID_1, name: 'Amazon', sort_order: 1 },
        { id: PLT_ID_2, name: 'eBay', sort_order: 2 },
      ],
    )
    const res = await GET(req(BASE))
    expect(res.status).toBe(200)
    const body = await res.json()
    const produkt = body.produkte[0]
    expect(produkt.plattformen).toHaveLength(3) // Amazon + eBay + Manuell
    const amazon = produkt.plattformen.find((p: { id: string }) => p.id === PLT_ID_1)
    expect(amazon.values['2026-01']).toBe(20)
    const ebay = produkt.plattformen.find((p: { id: string }) => p.id === PLT_ID_2)
    expect(ebay.values['2026-01']).toBe(8)
    const manuell = produkt.plattformen.find((p: { id: string }) => p.id === '__manuell__')
    expect(manuell.values['2026-01']).toBe(5)
  })

  it('omits manuell row when sendungen_manuell is 0', async () => {
    setupMocks(
      [
        {
          produkt_id: PRODUKT_ID_1,
          datum: '2026-01-15',
          sendungen_manuell: 0,
          sendungen: [{ plattform_id: PLT_ID_1, menge: 10 }],
        },
      ],
      [{ id: PRODUKT_ID_1, name: 'Produkt A', sort_order: 1 }],
      [{ id: PLT_ID_1, name: 'Amazon', sort_order: 1 }],
    )
    const res = await GET(req(BASE))
    expect(res.status).toBe(200)
    const body = await res.json()
    const produkt = body.produkte[0]
    expect(produkt.plattformen).toHaveLength(1)
    expect(produkt.plattformen[0].id).toBe(PLT_ID_1)
  })

})
