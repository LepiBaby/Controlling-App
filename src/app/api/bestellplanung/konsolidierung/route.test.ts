import { describe, it, expect, vi, beforeEach } from 'vitest'
import { POST } from './route'

const mockFrom = vi.fn()

vi.mock('@/lib/supabase-server', () => ({
  requireAuth: vi.fn().mockResolvedValue({
    user: { id: 'user-1' },
    supabase: { from: (table: string) => mockFrom(table) },
    error: null,
  }),
}))

function ch(result: { data: unknown; error: unknown }): object {
  const p: object = new Proxy({} as Record<string, unknown>, {
    get(_t, prop) {
      const key = String(prop)
      if (key === 'then') return undefined
      if (key === 'data') return result.data
      if (key === 'error') return result.error
      return (..._args: unknown[]) => p
    },
  })
  return p
}

const EMPTY = ch({ data: [], error: null })
const OK_NULL = ch({ data: null, error: null })

const BID_1 = 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11'
const BID_2 = 'b1eecb00-0d1c-4ef8-bb6d-6bb9bd380b22'
const GRP_ID = 'c2ffdc11-1e2d-4110-ad8f-8dd1df502c33'
const SKU_ID = 'd3001d22-2f3e-4221-be90-9ee2e0613d44'

const SNAPSHOT = {
  bestelldatum: null,
  produktionsstart_datum: null,
  produktionsende_datum: '2026-08-01',
  shippingdatum: null,
  ankunftsdatum: null,
  verfuegbarkeitsdatum: null,
  anzahl_40hq: 1,
  anzahl_20dc: 0,
  sku_mengen: [{ sku_id: SKU_ID, menge_praktisch: 500, begruendung_anpassung: null }],
}

const makeAenderung = (id: string) => ({
  bestellung_id: id,
  neue_daten: {
    bestelldatum: null,
    produktionsstart_datum: null,
    produktionsende_datum: '2026-08-01',
    shippingdatum: null,
    ankunftsdatum: null,
    verfuegbarkeitsdatum: null,
  },
  neue_sku_mengen: [{ sku_id: SKU_ID, menge_praktisch: 600, begruendung_anpassung: 'Konsolidierung' }],
  container_anteil: { '40HQ': 0.5 },
  snapshot_vor_konsolidierung: SNAPSHOT,
})

function req(body: unknown) {
  return new Request('http://localhost/api/bestellplanung/konsolidierung', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
}

beforeEach(() => {
  vi.clearAllMocks()
  mockFrom.mockReset()
})

describe('POST /api/bestellplanung/konsolidierung', () => {
  it('returns 401 when unauthenticated', async () => {
    const { requireAuth } = await import('@/lib/supabase-server')
    vi.mocked(requireAuth).mockResolvedValueOnce({
      user: null, supabase: null as never,
      error: new Response('Unauthorized', { status: 401 }),
    })
    const res = await POST(req({ bestellung_ids: [BID_1, BID_2], aenderungen: [makeAenderung(BID_1)] }))
    expect(res.status).toBe(401)
  })

  it('returns 400 when bestellung_ids has fewer than 2 items', async () => {
    const res = await POST(req({ bestellung_ids: [BID_1], aenderungen: [makeAenderung(BID_1)] }))
    expect(res.status).toBe(400)
  })

  it('returns 400 when aenderungen is empty', async () => {
    const res = await POST(req({ bestellung_ids: [BID_1, BID_2], aenderungen: [] }))
    expect(res.status).toBe(400)
  })

  it('returns 404 when bestellungen not found for user', async () => {
    // DB call order: from('bestellungen') → only BID_1 found (not 2)
    mockFrom.mockReturnValueOnce(ch({ data: [{ id: BID_1 }], error: null }))

    const res = await POST(req({
      bestellung_ids: [BID_1, BID_2],
      aenderungen: [makeAenderung(BID_1), makeAenderung(BID_2)],
    }))
    expect(res.status).toBe(404)
  })

  it('returns 409 when a bestellung is already in a group', async () => {
    mockFrom
      .mockReturnValueOnce(ch({ data: [{ id: BID_1 }, { id: BID_2 }], error: null })) // bestellungen verify
      .mockReturnValueOnce(ch({ data: [{ bestellung_id: BID_1, gruppe_id: GRP_ID }], error: null })) // existing mitglieder

    const res = await POST(req({
      bestellung_ids: [BID_1, BID_2],
      aenderungen: [makeAenderung(BID_1), makeAenderung(BID_2)],
    }))
    expect(res.status).toBe(409)
  })

  it('creates group and members successfully', async () => {
    mockFrom
      .mockReturnValueOnce(ch({ data: [{ id: BID_1 }, { id: BID_2 }], error: null })) // bestellungen verify
      .mockReturnValueOnce(ch({ data: [], error: null }))                               // bestellungen_konsolidierungsmitglieder check
      .mockReturnValueOnce(ch({ data: { id: GRP_ID }, error: null }))                  // bestellungen_konsolidierungsgruppen insert
      .mockReturnValueOnce(OK_NULL)   // bestellungen update (aenderung 1)
      .mockReturnValueOnce(OK_NULL)   // bestellungen_sku_mengen upsert (aenderung 1)
      .mockReturnValueOnce(OK_NULL)   // bestellungen_konsolidierungsmitglieder insert (aenderung 1)
      .mockReturnValueOnce(OK_NULL)   // bestellungen update (aenderung 2)
      .mockReturnValueOnce(OK_NULL)   // bestellungen_sku_mengen upsert (aenderung 2)
      .mockReturnValueOnce(OK_NULL)   // bestellungen_konsolidierungsmitglieder insert (aenderung 2)

    const res = await POST(req({
      bestellung_ids: [BID_1, BID_2],
      aenderungen: [makeAenderung(BID_1), makeAenderung(BID_2)],
    }))
    expect(res.status).toBe(201)
    const body = await res.json()
    expect(body).toHaveProperty('success', true)
    expect(body).toHaveProperty('gruppe_id', GRP_ID)
  })
})
