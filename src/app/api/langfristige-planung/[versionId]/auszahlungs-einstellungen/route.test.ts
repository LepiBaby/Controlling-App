import { describe, it, expect, vi, beforeEach } from 'vitest'
import { GET, PUT } from './route'

const mockFrom = vi.fn()

vi.mock('@/lib/supabase-server', () => ({
  requireAuth: vi.fn().mockResolvedValue({
    user: { id: 'user-1', email: 'test@test.com' },
    supabase: { from: (table: string) => mockFrom(table) },
    error: null,
  }),
}))

const VERSION_ID = '11111111-1111-4111-8111-111111111111'
const PLATTFORM_ID = '22222222-2222-4222-8222-222222222222'
const KANAL_ID = '33333333-3333-4333-8333-333333333333'

const EINSTELLUNG = {
  sales_plattform_id: PLATTFORM_ID,
  auszahlungsrhythmus: 'alle_zwei_monate',
  erster_auszahlung_monat: 3,
  erster_auszahlung_jahr: 2027,
  verschiebung_monate: 2,
}

function ctx(id: string) {
  return { params: Promise.resolve({ versionId: id }) }
}

function getReq(plattformId: string | null = PLATTFORM_ID) {
  const url = plattformId
    ? `http://localhost/api/langfristige-planung/${VERSION_ID}/auszahlungs-einstellungen?plattform_id=${plattformId}`
    : `http://localhost/api/langfristige-planung/${VERSION_ID}/auszahlungs-einstellungen`
  return new Request(url)
}

function putReq(body: unknown) {
  return new Request(
    `http://localhost/api/langfristige-planung/${VERSION_ID}/auszahlungs-einstellungen`,
    {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    },
  )
}

// Flexibler, verkettbarer Supabase-Mock: jede from()-Antwort liefert ein
// terminales { data, error }, egal über welche Kette (eq/in/order/limit/
// maybeSingle/single) oder ob die Kette direkt awaited wird (delete/insert).
function chainResult(data: unknown, error: { message: string } | null = null) {
  const terminal = { data, error }
  const chain: Record<string, unknown> = {}
  const self = () => chain
  Object.assign(chain, {
    select: self,
    eq: self,
    in: self,
    order: self,
    upsert: self,
    update: self,
    delete: self,
    insert: () => terminal,
    limit: () => terminal,
    maybeSingle: () => terminal,
    single: () => terminal,
    then: (resolve: (v: unknown) => unknown) => resolve(terminal),
  })
  return chain
}

function queue(data: unknown, error: { message: string } | null = null) {
  mockFrom.mockReturnValueOnce(chainResult(data, error))
}

async function unauth() {
  const { requireAuth } = await import('@/lib/supabase-server')
  vi.mocked(requireAuth).mockResolvedValueOnce({
    user: null,
    supabase: null as never,
    error: new Response('Unauthorized', { status: 401 }),
  })
}

beforeEach(() => {
  vi.clearAllMocks()
  mockFrom.mockReset()
})

describe('GET /api/langfristige-planung/[versionId]/auszahlungs-einstellungen', () => {
  it('returns 200 with settings + marketing channel ids', async () => {
    queue({ id: VERSION_ID }) // version check
    queue(EINSTELLUNG) // einstellung
    queue([{ marketingkanal_id: KANAL_ID }]) // kanäle
    const res = await GET(getReq(), ctx(VERSION_ID))
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.auszahlungsrhythmus).toBe('alle_zwei_monate')
    expect(body.erster_auszahlung_monat).toBe(3)
    expect(body.marketingkanal_ids).toEqual([KANAL_ID])
  })

  it('returns null when no entry and no channels exist', async () => {
    queue({ id: VERSION_ID })
    queue(null) // no einstellung
    queue([]) // no kanäle
    const res = await GET(getReq(), ctx(VERSION_ID))
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body).toBeNull()
  })

  it('returns settings when only channels exist (no scalar entry)', async () => {
    queue({ id: VERSION_ID })
    queue(null) // no einstellung
    queue([{ marketingkanal_id: KANAL_ID }]) // kanäle present
    const res = await GET(getReq(), ctx(VERSION_ID))
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.auszahlungsrhythmus).toBe('monatlich')
    expect(body.marketingkanal_ids).toEqual([KANAL_ID])
  })

  it('returns 400 when plattform_id is missing', async () => {
    queue({ id: VERSION_ID })
    const res = await GET(getReq(null), ctx(VERSION_ID))
    expect(res.status).toBe(400)
  })

  it('returns 400 on invalid plattform_id', async () => {
    queue({ id: VERSION_ID })
    const res = await GET(getReq('not-a-uuid'), ctx(VERSION_ID))
    expect(res.status).toBe(400)
  })

  it('returns 400 on invalid version id', async () => {
    const res = await GET(getReq(), ctx('bad'))
    expect(res.status).toBe(400)
  })

  it('returns 404 for foreign/unknown version', async () => {
    queue(null) // version check fails
    const res = await GET(getReq(), ctx(VERSION_ID))
    expect(res.status).toBe(404)
  })

  it('returns 401 when unauthenticated', async () => {
    await unauth()
    const res = await GET(getReq(), ctx(VERSION_ID))
    expect(res.status).toBe(401)
  })

  it('returns 500 on db error', async () => {
    queue({ id: VERSION_ID })
    queue(null, { message: 'boom' }) // einstellung error
    const res = await GET(getReq(), ctx(VERSION_ID))
    expect(res.status).toBe(500)
  })
})

describe('PUT /api/langfristige-planung/[versionId]/auszahlungs-einstellungen', () => {
  const validBody = {
    sales_plattform_id: PLATTFORM_ID,
    auszahlungsrhythmus: 'quartalsweise',
    erster_auszahlung_monat: 4,
    erster_auszahlung_jahr: 2027,
    verschiebung_monate: 1,
    marketingkanal_ids: [KANAL_ID],
  }

  it('upserts settings and syncs marketing channels', async () => {
    queue({ id: VERSION_ID }) // version check
    queue({ id: PLATTFORM_ID }) // plattform check
    queue([{ id: KANAL_ID }]) // kanäle gültig
    queue({ ...EINSTELLUNG, auszahlungsrhythmus: 'quartalsweise' }) // upsert
    queue(null) // delete
    queue(null) // insert
    const res = await PUT(putReq(validBody), ctx(VERSION_ID))
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.auszahlungsrhythmus).toBe('quartalsweise')
    expect(body.marketingkanal_ids).toEqual([KANAL_ID])
  })

  it('upserts with empty channel selection', async () => {
    queue({ id: VERSION_ID }) // version check
    queue({ id: PLATTFORM_ID }) // plattform check
    queue(EINSTELLUNG) // upsert
    queue(null) // delete
    const res = await PUT(
      putReq({ sales_plattform_id: PLATTFORM_ID, auszahlungsrhythmus: 'monatlich', marketingkanal_ids: [] }),
      ctx(VERSION_ID),
    )
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.marketingkanal_ids).toEqual([])
  })

  it('returns 400 on invalid rhythmus', async () => {
    const res = await PUT(
      putReq({ sales_plattform_id: PLATTFORM_ID, auszahlungsrhythmus: 'taeglich' }),
      ctx(VERSION_ID),
    )
    expect(res.status).toBe(400)
  })

  it('returns 400 when only month is set (anchor both-or-neither)', async () => {
    const res = await PUT(
      putReq({ sales_plattform_id: PLATTFORM_ID, erster_auszahlung_monat: 5 }),
      ctx(VERSION_ID),
    )
    expect(res.status).toBe(400)
  })

  it('returns 400 on verschiebung out of range (> 60)', async () => {
    const res = await PUT(
      putReq({ sales_plattform_id: PLATTFORM_ID, verschiebung_monate: 61 }),
      ctx(VERSION_ID),
    )
    expect(res.status).toBe(400)
  })

  it('returns 400 on negative verschiebung', async () => {
    const res = await PUT(
      putReq({ sales_plattform_id: PLATTFORM_ID, verschiebung_monate: -1 }),
      ctx(VERSION_ID),
    )
    expect(res.status).toBe(400)
  })

  it('returns 400 on missing sales_plattform_id', async () => {
    const res = await PUT(putReq({ auszahlungsrhythmus: 'monatlich' }), ctx(VERSION_ID))
    expect(res.status).toBe(400)
  })

  it('returns 400 on invalid version id', async () => {
    const res = await PUT(putReq(validBody), ctx('bad'))
    expect(res.status).toBe(400)
  })

  it('returns 404 for foreign/unknown version', async () => {
    queue(null) // version check fails
    const res = await PUT(putReq(validBody), ctx(VERSION_ID))
    expect(res.status).toBe(404)
  })

  it('returns 400 when plattform does not belong to version', async () => {
    queue({ id: VERSION_ID }) // version check
    queue(null) // plattform check fails
    const res = await PUT(putReq(validBody), ctx(VERSION_ID))
    expect(res.status).toBe(400)
  })

  it('returns 400 when a marketing channel does not belong to version', async () => {
    queue({ id: VERSION_ID }) // version check
    queue({ id: PLATTFORM_ID }) // plattform check
    queue([]) // no valid channels found (mismatch)
    const res = await PUT(putReq(validBody), ctx(VERSION_ID))
    expect(res.status).toBe(400)
  })

  it('returns 401 when unauthenticated', async () => {
    await unauth()
    const res = await PUT(putReq(validBody), ctx(VERSION_ID))
    expect(res.status).toBe(401)
  })

  it('returns 500 on upsert error', async () => {
    queue({ id: VERSION_ID }) // version check
    queue({ id: PLATTFORM_ID }) // plattform check
    queue([{ id: KANAL_ID }]) // kanäle gültig
    queue(null, { message: 'boom' }) // upsert error
    const res = await PUT(putReq(validBody), ctx(VERSION_ID))
    expect(res.status).toBe(500)
  })
})
