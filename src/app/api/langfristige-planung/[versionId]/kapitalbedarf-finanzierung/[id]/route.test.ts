import { describe, it, expect, vi, beforeEach } from 'vitest'
import { PATCH, DELETE } from './route'

const mockFrom = vi.fn()

vi.mock('@/lib/supabase-server', () => ({
  requireAuth: vi.fn().mockResolvedValue({
    user: { id: 'user-1', email: 'test@test.com' },
    supabase: { from: (table: string) => mockFrom(table) },
    error: null,
  }),
}))

const VERSION_ID = '11111111-1111-4111-8111-111111111111'
const ROW_ID = '22222222-2222-4222-8222-222222222222'

function chain(result: unknown) {
  const c: Record<string, unknown> = { then: (resolve: (v: unknown) => unknown) => resolve(result) }
  for (const m of ['select', 'eq', 'neq', 'is', 'order', 'limit', 'insert', 'update', 'delete', 'upsert', 'maybeSingle', 'single']) {
    c[m] = () => c
  }
  return c
}

function req(url: string, options?: RequestInit) {
  return new Request(url, options)
}
function ctx(versionId: string, id: string) {
  return { params: Promise.resolve({ versionId, id }) }
}
const URL_BASE = `http://localhost/api/langfristige-planung/${VERSION_ID}/kapitalbedarf-finanzierung/${ROW_ID}`

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

describe('PATCH /kapitalbedarf-finanzierung/[id]', () => {
  function patch(body: unknown, id = ROW_ID) {
    return PATCH(
      req(URL_BASE, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }),
      ctx(VERSION_ID, id),
    )
  }

  it('overrides the amount of a fixed (system) auto row (200)', async () => {
    mockFrom.mockReturnValueOnce(chain({ data: { id: VERSION_ID }, error: null })) // ensureVersion
    mockFrom.mockReturnValueOnce(chain({ data: { id: ROW_ID, bereich: 'kapitalbedarf', zeilen_art: 'investitionen', is_system: true }, error: null })) // existing
    mockFrom.mockReturnValueOnce(chain({ data: { id: ROW_ID, betrag: 9999 }, error: null })) // update
    const res = await patch({ betrag: 9999 })
    expect(res.status).toBe(200)
  })

  it('resets a fixed auto row to its auto value via betrag=null (200)', async () => {
    mockFrom.mockReturnValueOnce(chain({ data: { id: VERSION_ID }, error: null }))
    mockFrom.mockReturnValueOnce(chain({ data: { id: ROW_ID, bereich: 'kapitalbedarf', zeilen_art: 'betriebsmittelbedarf', is_system: true }, error: null }))
    mockFrom.mockReturnValueOnce(chain({ data: { id: ROW_ID, betrag: null }, error: null }))
    const res = await patch({ betrag: null })
    expect(res.status).toBe(200)
  })

  it('rejects renaming a fixed (system) row (403)', async () => {
    mockFrom.mockReturnValueOnce(chain({ data: { id: VERSION_ID }, error: null }))
    mockFrom.mockReturnValueOnce(chain({ data: { id: ROW_ID, bereich: 'kapitalbedarf', zeilen_art: 'investitionen', is_system: true }, error: null }))
    const res = await patch({ bezeichnung: 'Umbenannt' })
    expect(res.status).toBe(403)
  })

  it('updates a manual row name + amount (200)', async () => {
    mockFrom.mockReturnValueOnce(chain({ data: { id: VERSION_ID }, error: null }))
    mockFrom.mockReturnValueOnce(chain({ data: { id: ROW_ID, bereich: 'eigenkapital', zeilen_art: 'manuell', is_system: false }, error: null }))
    mockFrom.mockReturnValueOnce(chain({ data: { id: ROW_ID, bezeichnung: 'Neu', betrag: 100 }, error: null }))
    const res = await patch({ bezeichnung: 'Neu', betrag: 100 })
    expect(res.status).toBe(200)
  })

  it('returns 404 for foreign/unknown row id', async () => {
    mockFrom.mockReturnValueOnce(chain({ data: { id: VERSION_ID }, error: null }))
    mockFrom.mockReturnValueOnce(chain({ data: null, error: null })) // existing not found
    const res = await patch({ betrag: 1 })
    expect(res.status).toBe(404)
  })

  it('returns 400 on invalid id', async () => {
    mockFrom.mockReturnValueOnce(chain({ data: { id: VERSION_ID }, error: null }))
    const res = await patch({ betrag: 1 }, 'not-a-uuid')
    expect(res.status).toBe(400)
  })

  it('returns 401 when unauthenticated', async () => {
    await unauth()
    const res = await patch({ betrag: 1 })
    expect(res.status).toBe(401)
  })
})

describe('DELETE /kapitalbedarf-finanzierung/[id]', () => {
  function del(id = ROW_ID) {
    return DELETE(req(URL_BASE, { method: 'DELETE' }), ctx(VERSION_ID, id))
  }

  it('deletes a manual row (200)', async () => {
    mockFrom.mockReturnValueOnce(chain({ data: { id: VERSION_ID }, error: null })) // ensureVersion
    mockFrom.mockReturnValueOnce(chain({ data: { id: ROW_ID, is_system: false }, error: null })) // existing
    mockFrom.mockReturnValueOnce(chain({ data: null, error: null })) // delete
    const res = await del()
    expect(res.status).toBe(200)
  })

  it('rejects deleting a fixed (system) row (403)', async () => {
    mockFrom.mockReturnValueOnce(chain({ data: { id: VERSION_ID }, error: null }))
    mockFrom.mockReturnValueOnce(chain({ data: { id: ROW_ID, is_system: true }, error: null }))
    const res = await del()
    expect(res.status).toBe(403)
  })

  it('returns 404 for foreign/unknown row id', async () => {
    mockFrom.mockReturnValueOnce(chain({ data: { id: VERSION_ID }, error: null }))
    mockFrom.mockReturnValueOnce(chain({ data: null, error: null }))
    const res = await del()
    expect(res.status).toBe(404)
  })

  it('returns 401 when unauthenticated', async () => {
    await unauth()
    const res = await del()
    expect(res.status).toBe(401)
  })
})
