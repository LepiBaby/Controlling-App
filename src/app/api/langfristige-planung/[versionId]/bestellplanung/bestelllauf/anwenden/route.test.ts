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

const VERSION_ID = '11111111-1111-4111-8111-111111111111'
const PRODUKT_ID = '33333333-3333-4333-8333-333333333333'

function chain(result: unknown) {
  const c: Record<string, unknown> = { then: (resolve: (v: unknown) => unknown) => resolve(result) }
  for (const m of ['select', 'eq', 'insert', 'update', 'delete', 'single', 'maybeSingle']) c[m] = () => c
  return c
}

function ctx(id = VERSION_ID) {
  return { params: Promise.resolve({ versionId: id }) }
}
const URL = `http://localhost/api/langfristige-planung/${VERSION_ID}/bestellplanung/bestelllauf/anwenden`

async function unauth() {
  const { requireAuth } = await import('@/lib/supabase-server')
  vi.mocked(requireAuth).mockResolvedValueOnce({
    user: null,
    supabase: null as never,
    error: new Response('Unauthorized', { status: 401 }),
  })
}

function post(body: unknown, id = VERSION_ID) {
  return POST(
    new Request(URL, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }),
    ctx(id),
  )
}

// PROJ-86: kurzfristiges Shape — produkt_ids[] + sku_mengen[] (Produktebene: 1 Eintrag).
const NEUE = {
  temp_id: 'temp-1',
  produkt_ids: [PRODUKT_ID],
  produkt_namen: ['Produkt 1'],
  bestelldatum: '2026-06-01',
  produktionsstart_datum: null,
  produktionsende_datum: null,
  shippingdatum: null,
  ankunftsdatum: null,
  verfuegbarkeitsdatum: '2026-07-01',
  sku_mengen: [
    {
      sku_id: PRODUKT_ID,
      sku_name: 'Produkt 1',
      menge_theoretisch: 60,
      menge_nach_moq: 60,
      menge_praktisch: 60,
      begruendung_anpassung: '',
      is_trigger: true,
    },
  ],
  warnungen: [],
  container: [],
  konsolidiert_mit_temp_ids: [],
}

beforeEach(() => {
  vi.clearAllMocks()
  mockFrom.mockReset()
})

describe('POST bestelllauf/anwenden', () => {
  it('applies empty payload (200)', async () => {
    mockFrom.mockReturnValueOnce(chain({ data: { id: VERSION_ID }, error: null })) // version
    mockFrom.mockReturnValueOnce(chain({ error: null })) // clear bestehende Algorithmus-Bestellungen
    const res = await post({ akzeptierte_aenderungen: [], neue_bestellungen: [] })
    expect(res.status).toBe(200)
    expect((await res.json()).ok).toBe(true)
  })

  it('inserts a new order and returns tempToReal (200)', async () => {
    mockFrom.mockReturnValueOnce(chain({ data: { id: VERSION_ID }, error: null })) // version
    mockFrom.mockReturnValueOnce(chain({ error: null })) // clear bestehende Algorithmus-Bestellungen
    mockFrom.mockReturnValueOnce(chain({ data: { id: 'new-1' }, error: null })) // insert
    const res = await post({ akzeptierte_aenderungen: [], neue_planbestellungen: [NEUE] })
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.angelegt).toBe(1)
    expect(body.tempToReal).toEqual({ 'temp-1': 'new-1' })
  })

  it('still accepts legacy key neue_bestellungen (200)', async () => {
    mockFrom.mockReturnValueOnce(chain({ data: { id: VERSION_ID }, error: null })) // version
    mockFrom.mockReturnValueOnce(chain({ error: null })) // clear bestehende Algorithmus-Bestellungen
    mockFrom.mockReturnValueOnce(chain({ data: { id: 'new-1' }, error: null })) // insert
    const res = await post({ akzeptierte_aenderungen: [], neue_bestellungen: [NEUE] })
    expect(res.status).toBe(200)
    expect((await res.json()).angelegt).toBe(1)
  })

  it('deletes an order via accepted "kein_bedarf" change without neue_daten (200)', async () => {
    mockFrom.mockReturnValueOnce(chain({ data: { id: VERSION_ID }, error: null })) // version
    mockFrom.mockReturnValueOnce(chain({ error: null })) // clear bestehende Algorithmus-Bestellungen
    mockFrom.mockReturnValueOnce(chain({ error: null })) // delete
    const res = await post({
      akzeptierte_aenderungen: [
        { bestellung_id: '44444444-4444-4444-8444-444444444444', aenderungsart: 'kein_bedarf' },
      ],
      neue_planbestellungen: [],
    })
    expect(res.status).toBe(200)
  })

  it('deletes an order via accepted "kein_bedarf" change (200)', async () => {
    mockFrom.mockReturnValueOnce(chain({ data: { id: VERSION_ID }, error: null })) // version
    mockFrom.mockReturnValueOnce(chain({ error: null })) // clear bestehende Algorithmus-Bestellungen
    mockFrom.mockReturnValueOnce(chain({ error: null })) // delete
    const res = await post({
      akzeptierte_aenderungen: [{ bestellung_id: '44444444-4444-4444-8444-444444444444', loeschen: true }],
      neue_bestellungen: [],
    })
    expect(res.status).toBe(200)
  })

  it('returns 400 on invalid new order (missing menge)', async () => {
    mockFrom.mockReturnValueOnce(chain({ data: { id: VERSION_ID }, error: null }))
    const res = await post({ neue_bestellungen: [{ temp_id: 't', produkt_id: PRODUKT_ID }] })
    expect(res.status).toBe(400)
  })

  it('returns 404 for foreign version', async () => {
    mockFrom.mockReturnValueOnce(chain({ data: null, error: null }))
    const res = await post({ akzeptierte_aenderungen: [], neue_bestellungen: [] })
    expect(res.status).toBe(404)
  })

  it('returns 401 when unauthenticated', async () => {
    await unauth()
    const res = await post({ akzeptierte_aenderungen: [], neue_bestellungen: [] })
    expect(res.status).toBe(401)
  })
})
