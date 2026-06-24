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
const PRODUKT_ID = '33333333-3333-4333-8333-333333333333'

const EINTRAG = {
  id: '44444444-4444-4444-8444-444444444444',
  sales_plattform_id: PLATTFORM_ID,
  produkt_id: PRODUKT_ID,
  verkaufsgebuehr_prozent: 15,
}

function ctx(id: string) {
  return { params: Promise.resolve({ versionId: id }) }
}

function getReq(plattformId: string | null = PLATTFORM_ID) {
  const base = `http://localhost/api/langfristige-planung/${VERSION_ID}/verkaufsgebuehr-einstellungen`
  return new Request(plattformId ? `${base}?plattform_id=${plattformId}` : base)
}

function putReq(body: unknown) {
  return new Request(
    `http://localhost/api/langfristige-planung/${VERSION_ID}/verkaufsgebuehr-einstellungen`,
    {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    },
  )
}

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

describe('GET /api/langfristige-planung/[versionId]/verkaufsgebuehr-einstellungen', () => {
  it('returns 200 with the list of settings for a platform', async () => {
    queue({ id: VERSION_ID }) // version check
    queue([EINTRAG]) // einstellungen
    const res = await GET(getReq(), ctx(VERSION_ID))
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body).toEqual([EINTRAG])
  })

  it('returns empty array when nothing is stored yet', async () => {
    queue({ id: VERSION_ID })
    queue([])
    const res = await GET(getReq(), ctx(VERSION_ID))
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual([])
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
    queue(null, { message: 'boom' })
    const res = await GET(getReq(), ctx(VERSION_ID))
    expect(res.status).toBe(500)
  })
})

describe('PUT /api/langfristige-planung/[versionId]/verkaufsgebuehr-einstellungen', () => {
  const validBody = {
    sales_plattform_id: PLATTFORM_ID,
    produkt_id: PRODUKT_ID,
    verkaufsgebuehr_prozent: 15,
  }

  it('upserts a single platform-product value', async () => {
    queue({ id: VERSION_ID }) // version check
    queue({ id: PLATTFORM_ID }) // plattform belongs to version
    queue({ id: PRODUKT_ID }) // produkt belongs to version
    queue(EINTRAG) // upsert
    const res = await PUT(putReq(validBody), ctx(VERSION_ID))
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.verkaufsgebuehr_prozent).toBe(15)
  })

  it('accepts null to clear a value', async () => {
    queue({ id: VERSION_ID })
    queue({ id: PLATTFORM_ID })
    queue({ id: PRODUKT_ID })
    queue({ ...EINTRAG, verkaufsgebuehr_prozent: null })
    const res = await PUT(
      putReq({ ...validBody, verkaufsgebuehr_prozent: null }),
      ctx(VERSION_ID),
    )
    expect(res.status).toBe(200)
    expect((await res.json()).verkaufsgebuehr_prozent).toBeNull()
  })

  it('accepts values over 100 (no upper bound)', async () => {
    queue({ id: VERSION_ID })
    queue({ id: PLATTFORM_ID })
    queue({ id: PRODUKT_ID })
    queue({ ...EINTRAG, verkaufsgebuehr_prozent: 120 })
    const res = await PUT(
      putReq({ ...validBody, verkaufsgebuehr_prozent: 120 }),
      ctx(VERSION_ID),
    )
    expect(res.status).toBe(200)
    expect((await res.json()).verkaufsgebuehr_prozent).toBe(120)
  })

  it('returns 400 on negative value', async () => {
    const res = await PUT(
      putReq({ ...validBody, verkaufsgebuehr_prozent: -1 }),
      ctx(VERSION_ID),
    )
    expect(res.status).toBe(400)
  })

  it('returns 400 on missing sales_plattform_id', async () => {
    const res = await PUT(putReq({ produkt_id: PRODUKT_ID }), ctx(VERSION_ID))
    expect(res.status).toBe(400)
  })

  it('returns 400 on missing produkt_id', async () => {
    const res = await PUT(putReq({ sales_plattform_id: PLATTFORM_ID }), ctx(VERSION_ID))
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
    queue({ id: VERSION_ID })
    queue(null) // plattform check fails
    const res = await PUT(putReq(validBody), ctx(VERSION_ID))
    expect(res.status).toBe(400)
  })

  it('returns 400 when produkt does not belong to version', async () => {
    queue({ id: VERSION_ID })
    queue({ id: PLATTFORM_ID })
    queue(null) // produkt check fails
    const res = await PUT(putReq(validBody), ctx(VERSION_ID))
    expect(res.status).toBe(400)
  })

  it('returns 401 when unauthenticated', async () => {
    await unauth()
    const res = await PUT(putReq(validBody), ctx(VERSION_ID))
    expect(res.status).toBe(401)
  })

  it('returns 500 on upsert error', async () => {
    queue({ id: VERSION_ID })
    queue({ id: PLATTFORM_ID })
    queue({ id: PRODUKT_ID })
    queue(null, { message: 'boom' }) // upsert error
    const res = await PUT(putReq(validBody), ctx(VERSION_ID))
    expect(res.status).toBe(500)
  })
})
