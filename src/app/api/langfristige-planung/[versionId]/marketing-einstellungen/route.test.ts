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
const KANAL_ID = '22222222-2222-4222-8222-222222222222'
const PLATTFORM_ID = '33333333-3333-4333-8333-333333333333'

const EINSTELLUNG = {
  marketingkanal_id: KANAL_ID,
  sales_plattform_id: PLATTFORM_ID,
  gruppierung: 'quartalsweise',
  zahlungsziel_tage: 30,
}

function ctx(id: string) {
  return { params: Promise.resolve({ versionId: id }) }
}

function getReq(kanalId: string | null = KANAL_ID) {
  const url = kanalId
    ? `http://localhost/api/langfristige-planung/${VERSION_ID}/marketing-einstellungen?marketingkanal_id=${kanalId}`
    : `http://localhost/api/langfristige-planung/${VERSION_ID}/marketing-einstellungen`
  return new Request(url)
}

function putReq(body: unknown) {
  return new Request(
    `http://localhost/api/langfristige-planung/${VERSION_ID}/marketing-einstellungen`,
    {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    },
  )
}

// Flexibler, verkettbarer Supabase-Mock (siehe auszahlungs-einstellungen.test.ts).
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

describe('GET /api/langfristige-planung/[versionId]/marketing-einstellungen', () => {
  it('returns 200 with the stored settings', async () => {
    queue({ id: VERSION_ID }) // version check
    queue(EINSTELLUNG) // einstellung
    const res = await GET(getReq(), ctx(VERSION_ID))
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.gruppierung).toBe('quartalsweise')
    expect(body.sales_plattform_id).toBe(PLATTFORM_ID)
    expect(body.zahlungsziel_tage).toBe(30)
  })

  it('returns null when no entry exists', async () => {
    queue({ id: VERSION_ID })
    queue(null) // no einstellung
    const res = await GET(getReq(), ctx(VERSION_ID))
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body).toBeNull()
  })

  it('returns 400 when marketingkanal_id is missing', async () => {
    queue({ id: VERSION_ID })
    const res = await GET(getReq(null), ctx(VERSION_ID))
    expect(res.status).toBe(400)
  })

  it('returns 400 on invalid marketingkanal_id', async () => {
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

describe('PUT /api/langfristige-planung/[versionId]/marketing-einstellungen', () => {
  const validBody = {
    marketingkanal_id: KANAL_ID,
    sales_plattform_id: PLATTFORM_ID,
    gruppierung: 'quartalsweise',
    zahlungsziel_tage: 30,
  }

  it('upserts settings with a platform', async () => {
    queue({ id: VERSION_ID }) // version check
    queue({ id: KANAL_ID }) // kanal check
    queue({ id: PLATTFORM_ID }) // plattform check
    queue(EINSTELLUNG) // upsert
    const res = await PUT(putReq(validBody), ctx(VERSION_ID))
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.gruppierung).toBe('quartalsweise')
    expect(body.sales_plattform_id).toBe(PLATTFORM_ID)
  })

  it('upserts settings without a platform (sales_plattform_id null)', async () => {
    queue({ id: VERSION_ID }) // version check
    queue({ id: KANAL_ID }) // kanal check
    queue({ ...EINSTELLUNG, sales_plattform_id: null }) // upsert
    const res = await PUT(
      putReq({ marketingkanal_id: KANAL_ID, gruppierung: 'monatlich' }),
      ctx(VERSION_ID),
    )
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.sales_plattform_id).toBeNull()
  })

  it('returns 400 on invalid gruppierung', async () => {
    const res = await PUT(
      putReq({ marketingkanal_id: KANAL_ID, gruppierung: 'woechentlich' }),
      ctx(VERSION_ID),
    )
    expect(res.status).toBe(400)
  })

  it('returns 400 on negative zahlungsziel_tage', async () => {
    const res = await PUT(
      putReq({ marketingkanal_id: KANAL_ID, zahlungsziel_tage: -1 }),
      ctx(VERSION_ID),
    )
    expect(res.status).toBe(400)
  })

  it('returns 400 on missing marketingkanal_id', async () => {
    const res = await PUT(putReq({ gruppierung: 'monatlich' }), ctx(VERSION_ID))
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

  it('returns 400 when marketingkanal does not belong to version', async () => {
    queue({ id: VERSION_ID }) // version check
    queue(null) // kanal check fails
    const res = await PUT(putReq(validBody), ctx(VERSION_ID))
    expect(res.status).toBe(400)
  })

  it('returns 400 when platform does not belong to version', async () => {
    queue({ id: VERSION_ID }) // version check
    queue({ id: KANAL_ID }) // kanal check
    queue(null) // plattform check fails
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
    queue({ id: KANAL_ID }) // kanal check
    queue({ id: PLATTFORM_ID }) // plattform check
    queue(null, { message: 'boom' }) // upsert error
    const res = await PUT(putReq(validBody), ctx(VERSION_ID))
    expect(res.status).toBe(500)
  })
})
