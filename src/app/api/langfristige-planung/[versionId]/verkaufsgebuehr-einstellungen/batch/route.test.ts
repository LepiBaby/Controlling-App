import { describe, it, expect, vi, beforeEach } from 'vitest'
import { PUT } from './route'

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
const PRODUKT_A = '33333333-3333-4333-8333-333333333333'
const PRODUKT_B = '44444444-4444-4444-8444-444444444444'

function ctx(id: string) {
  return { params: Promise.resolve({ versionId: id }) }
}

function putReq(body: unknown) {
  return new Request(
    `http://localhost/api/langfristige-planung/${VERSION_ID}/verkaufsgebuehr-einstellungen/batch`,
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

describe('PUT /api/langfristige-planung/[versionId]/verkaufsgebuehr-einstellungen/batch', () => {
  const validBody = { sales_plattform_id: PLATTFORM_ID, verkaufsgebuehr_prozent: 12.5 }

  it('sets the same value for all products of the version', async () => {
    queue({ id: VERSION_ID }) // version check
    queue({ id: PLATTFORM_ID }) // plattform belongs to version
    queue([{ id: PRODUKT_A }, { id: PRODUKT_B }]) // produkte of version
    queue([
      { id: 'r1', sales_plattform_id: PLATTFORM_ID, produkt_id: PRODUKT_A, verkaufsgebuehr_prozent: 12.5 },
      { id: 'r2', sales_plattform_id: PLATTFORM_ID, produkt_id: PRODUKT_B, verkaufsgebuehr_prozent: 12.5 },
    ]) // upsert result
    const res = await PUT(putReq(validBody), ctx(VERSION_ID))
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body).toHaveLength(2)
    expect(body[0].verkaufsgebuehr_prozent).toBe(12.5)
  })

  it('returns empty array when version has no products', async () => {
    queue({ id: VERSION_ID })
    queue({ id: PLATTFORM_ID })
    queue([]) // no produkte
    const res = await PUT(putReq(validBody), ctx(VERSION_ID))
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual([])
  })

  it('accepts null to clear all products', async () => {
    queue({ id: VERSION_ID })
    queue({ id: PLATTFORM_ID })
    queue([{ id: PRODUKT_A }])
    queue([{ id: 'r1', sales_plattform_id: PLATTFORM_ID, produkt_id: PRODUKT_A, verkaufsgebuehr_prozent: null }])
    const res = await PUT(
      putReq({ sales_plattform_id: PLATTFORM_ID, verkaufsgebuehr_prozent: null }),
      ctx(VERSION_ID),
    )
    expect(res.status).toBe(200)
  })

  it('returns 400 on negative value', async () => {
    const res = await PUT(
      putReq({ sales_plattform_id: PLATTFORM_ID, verkaufsgebuehr_prozent: -5 }),
      ctx(VERSION_ID),
    )
    expect(res.status).toBe(400)
  })

  it('returns 400 on missing sales_plattform_id', async () => {
    const res = await PUT(putReq({ verkaufsgebuehr_prozent: 10 }), ctx(VERSION_ID))
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

  it('returns 401 when unauthenticated', async () => {
    await unauth()
    const res = await PUT(putReq(validBody), ctx(VERSION_ID))
    expect(res.status).toBe(401)
  })

  it('returns 500 on upsert error', async () => {
    queue({ id: VERSION_ID })
    queue({ id: PLATTFORM_ID })
    queue([{ id: PRODUKT_A }])
    queue(null, { message: 'boom' }) // upsert error
    const res = await PUT(putReq(validBody), ctx(VERSION_ID))
    expect(res.status).toBe(500)
  })
})
