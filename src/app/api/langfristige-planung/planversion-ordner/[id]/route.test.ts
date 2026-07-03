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

const ID = '22222222-2222-4222-8222-222222222222'
const ORDNER = {
  id: ID,
  name: 'Szenarien 2027',
  created_at: '2026-07-03T00:00:00Z',
  updated_at: '2026-07-03T00:00:00Z',
}

function ctx(id: string) {
  return { params: Promise.resolve({ id }) }
}
function req(options?: RequestInit) {
  return new Request(`http://localhost/api/langfristige-planung/planversion-ordner/${ID}`, options)
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

describe('PATCH /api/langfristige-planung/planversion-ordner/[id]', () => {
  function updateMock(data: unknown, error: { code?: string; message: string } | null = null) {
    mockFrom.mockReturnValueOnce({
      update: () => ({ eq: () => ({ eq: () => ({ select: () => ({ maybeSingle: () => ({ data, error }) }) }) }) }),
    })
  }

  it('returns 200 on successful rename', async () => {
    updateMock({ ...ORDNER, name: 'Neu' })
    const res = await PATCH(
      req({ method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name: 'Neu' }) }),
      ctx(ID),
    )
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.name).toBe('Neu')
  })

  it('returns 400 on empty name', async () => {
    const res = await PATCH(
      req({ method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name: '  ' }) }),
      ctx(ID),
    )
    expect(res.status).toBe(400)
  })

  it('returns 400 on invalid uuid', async () => {
    const res = await PATCH(
      req({ method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name: 'X' }) }),
      ctx('not-a-uuid'),
    )
    expect(res.status).toBe(400)
  })

  it('returns 409 on duplicate name', async () => {
    updateMock(null, { code: '23505', message: 'duplicate key' })
    const res = await PATCH(
      req({ method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name: 'Dup' }) }),
      ctx(ID),
    )
    expect(res.status).toBe(409)
  })

  it('returns 404 when not found / foreign', async () => {
    updateMock(null)
    const res = await PATCH(
      req({ method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name: 'X' }) }),
      ctx(ID),
    )
    expect(res.status).toBe(404)
  })

  it('returns 401 when unauthenticated', async () => {
    await unauth()
    const res = await PATCH(
      req({ method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name: 'X' }) }),
      ctx(ID),
    )
    expect(res.status).toBe(401)
  })
})

describe('DELETE /api/langfristige-planung/planversion-ordner/[id]', () => {
  function findMock(data: unknown, error: { message: string } | null = null) {
    mockFrom.mockReturnValueOnce({
      select: () => ({ eq: () => ({ eq: () => ({ maybeSingle: () => ({ data, error }) }) }) }),
    })
  }
  function countMock(count: number, error: { message: string } | null = null) {
    mockFrom.mockReturnValueOnce({
      select: () => ({ eq: () => ({ eq: () => ({ count, error }) }) }),
    })
  }
  function deleteMock(error: { code?: string; message: string } | null = null) {
    mockFrom.mockReturnValueOnce({
      delete: () => ({ eq: () => ({ eq: () => ({ error }) }) }),
    })
  }

  it('returns 200 when deleting an empty folder', async () => {
    findMock({ id: ID })
    countMock(0)
    deleteMock(null)
    const res = await DELETE(req({ method: 'DELETE' }), ctx(ID))
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.success).toBe(true)
  })

  it('returns 409 when the folder still contains plan versions', async () => {
    findMock({ id: ID })
    countMock(2)
    const res = await DELETE(req({ method: 'DELETE' }), ctx(ID))
    expect(res.status).toBe(409)
  })

  it('returns 404 when not found / foreign', async () => {
    findMock(null)
    const res = await DELETE(req({ method: 'DELETE' }), ctx(ID))
    expect(res.status).toBe(404)
  })

  it('returns 400 on invalid uuid', async () => {
    const res = await DELETE(req({ method: 'DELETE' }), ctx('bad'))
    expect(res.status).toBe(400)
  })

  it('returns 401 when unauthenticated', async () => {
    await unauth()
    const res = await DELETE(req({ method: 'DELETE' }), ctx(ID))
    expect(res.status).toBe(401)
  })
})
