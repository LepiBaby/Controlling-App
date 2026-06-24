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

const ENTRY = {
  startmonat_monat: 3,
  startmonat_jahr: 2027,
  startkontostand: 5000,
  planungshorizont_monate: 24,
  planungshorizont_absatz_monate: 18,
}

function ctx(id: string) {
  return { params: Promise.resolve({ versionId: id }) }
}
function req(options?: RequestInit) {
  return new Request(
    `http://localhost/api/langfristige-planung/${VERSION_ID}/grundeinstellungen`,
    options,
  )
}
function putReq(body: unknown) {
  return req({
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
}

// Mock für ein .select(...).eq().eq().maybeSingle()
function maybeSingleMock(data: unknown, error: { message: string } | null = null) {
  mockFrom.mockReturnValueOnce({
    select: () => ({ eq: () => ({ eq: () => ({ maybeSingle: () => ({ data, error }) }) }) }),
  })
}
// Mock für ein .upsert(...).select(...).single()
function upsertMock(data: unknown, error: { message: string } | null = null) {
  mockFrom.mockReturnValueOnce({
    upsert: () => ({ select: () => ({ single: () => ({ data, error }) }) }),
  })
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

describe('GET /api/langfristige-planung/[versionId]/grundeinstellungen', () => {
  it('returns 200 with stored values', async () => {
    maybeSingleMock({ id: VERSION_ID }) // version check
    maybeSingleMock(ENTRY) // entry
    const res = await GET(req(), ctx(VERSION_ID))
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.planungshorizont_monate).toBe(24)
    expect(body.planungshorizont_absatz_monate).toBe(18)
    expect(body.startkontostand).toBe(5000)
  })

  it('returns defaults when no entry exists (no insert)', async () => {
    maybeSingleMock({ id: VERSION_ID }) // version check
    maybeSingleMock(null) // no entry
    const res = await GET(req(), ctx(VERSION_ID))
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.planungshorizont_monate).toBe(12)
    expect(body.planungshorizont_absatz_monate).toBeNull()
    expect(body.startkontostand).toBe(0)
    expect(body.startmonat_monat).toBeGreaterThanOrEqual(1)
    expect(body.startmonat_monat).toBeLessThanOrEqual(12)
  })

  it('returns 404 for foreign/unknown version', async () => {
    maybeSingleMock(null) // version check fails
    const res = await GET(req(), ctx(VERSION_ID))
    expect(res.status).toBe(404)
  })

  it('returns 400 on invalid version id', async () => {
    const res = await GET(req(), ctx('not-a-uuid'))
    expect(res.status).toBe(400)
  })

  it('returns 401 when unauthenticated', async () => {
    await unauth()
    const res = await GET(req(), ctx(VERSION_ID))
    expect(res.status).toBe(401)
  })

  it('returns 500 on db error', async () => {
    maybeSingleMock({ id: VERSION_ID })
    maybeSingleMock(null, { message: 'boom' })
    const res = await GET(req(), ctx(VERSION_ID))
    expect(res.status).toBe(500)
  })
})

describe('PUT /api/langfristige-planung/[versionId]/grundeinstellungen', () => {
  it('updates an existing entry (partial)', async () => {
    maybeSingleMock({ id: VERSION_ID }) // version check
    maybeSingleMock(ENTRY) // existing
    upsertMock({ ...ENTRY, planungshorizont_monate: 36 })
    const res = await PUT(putReq({ planungshorizont_monate: 36 }), ctx(VERSION_ID))
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.planungshorizont_monate).toBe(36)
  })

  it('creates entry from defaults when none exists', async () => {
    maybeSingleMock({ id: VERSION_ID }) // version check
    maybeSingleMock(null) // no existing
    upsertMock({
      startmonat_monat: 6,
      startmonat_jahr: 2026,
      planungshorizont_monate: 12,
      planungshorizont_absatz_monate: null,
    })
    const res = await PUT(putReq({ planungshorizont_monate: 12 }), ctx(VERSION_ID))
    expect(res.status).toBe(200)
  })

  it('accepts startmonat update', async () => {
    maybeSingleMock({ id: VERSION_ID })
    maybeSingleMock(ENTRY)
    upsertMock({ ...ENTRY, startmonat_monat: 1, startmonat_jahr: 2028 })
    const res = await PUT(putReq({ startmonat_monat: 1, startmonat_jahr: 2028 }), ctx(VERSION_ID))
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.startmonat_jahr).toBe(2028)
  })

  it('accepts startkontostand update (decimals, negative allowed)', async () => {
    maybeSingleMock({ id: VERSION_ID })
    maybeSingleMock(ENTRY)
    upsertMock({ ...ENTRY, startkontostand: -1234.56 })
    const res = await PUT(putReq({ startkontostand: -1234.56 }), ctx(VERSION_ID))
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.startkontostand).toBe(-1234.56)
  })

  it('accepts clearing the absatz horizon (null)', async () => {
    maybeSingleMock({ id: VERSION_ID })
    maybeSingleMock(ENTRY)
    upsertMock({ ...ENTRY, planungshorizont_absatz_monate: null })
    const res = await PUT(putReq({ planungshorizont_absatz_monate: null }), ctx(VERSION_ID))
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.planungshorizont_absatz_monate).toBeNull()
  })

  it('returns 400 on empty body (no field)', async () => {
    const res = await PUT(putReq({}), ctx(VERSION_ID))
    expect(res.status).toBe(400)
  })

  it('returns 400 on out-of-range horizon (> 120)', async () => {
    const res = await PUT(putReq({ planungshorizont_monate: 121 }), ctx(VERSION_ID))
    expect(res.status).toBe(400)
  })

  it('returns 400 on out-of-range horizon (< 1)', async () => {
    const res = await PUT(putReq({ planungshorizont_monate: 0 }), ctx(VERSION_ID))
    expect(res.status).toBe(400)
  })

  it('returns 400 on non-integer horizon', async () => {
    const res = await PUT(putReq({ planungshorizont_monate: 12.5 }), ctx(VERSION_ID))
    expect(res.status).toBe(400)
  })

  it('returns 400 on invalid month', async () => {
    const res = await PUT(putReq({ startmonat_monat: 13, startmonat_jahr: 2026 }), ctx(VERSION_ID))
    expect(res.status).toBe(400)
  })

  it('returns 400 on out-of-range year', async () => {
    const res = await PUT(putReq({ startmonat_monat: 6, startmonat_jahr: 1999 }), ctx(VERSION_ID))
    expect(res.status).toBe(400)
  })

  it('returns 400 on invalid version id', async () => {
    const res = await PUT(putReq({ planungshorizont_monate: 12 }), ctx('bad'))
    expect(res.status).toBe(400)
  })

  it('returns 404 for foreign/unknown version', async () => {
    maybeSingleMock(null) // version check fails
    const res = await PUT(putReq({ planungshorizont_monate: 12 }), ctx(VERSION_ID))
    expect(res.status).toBe(404)
  })

  it('returns 401 when unauthenticated', async () => {
    await unauth()
    const res = await PUT(putReq({ planungshorizont_monate: 12 }), ctx(VERSION_ID))
    expect(res.status).toBe(401)
  })

  it('returns 500 on upsert error', async () => {
    maybeSingleMock({ id: VERSION_ID })
    maybeSingleMock(ENTRY)
    upsertMock(null, { message: 'boom' })
    const res = await PUT(putReq({ planungshorizont_monate: 36 }), ctx(VERSION_ID))
    expect(res.status).toBe(500)
  })
})
