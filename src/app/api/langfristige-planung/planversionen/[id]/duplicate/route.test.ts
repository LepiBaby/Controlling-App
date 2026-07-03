import { describe, it, expect, vi, beforeEach } from 'vitest'
import { POST } from './route'

const mockRpc = vi.fn()

vi.mock('@/lib/supabase-server', () => ({
  requireAuth: vi.fn().mockResolvedValue({
    user: { id: 'user-1', email: 'test@test.com' },
    supabase: { rpc: (fn: string, args: unknown) => mockRpc(fn, args) },
    error: null,
  }),
}))

const ID = '11111111-1111-4111-8111-111111111111'
const NEW_VERSION = {
  id: '99999999-9999-4999-8999-999999999999',
  name: 'Basisszenario (Kopie)',
  ordner_id: null,
  created_at: '2026-07-03T00:00:00Z',
  updated_at: '2026-07-03T00:00:00Z',
}

function ctx(id: string) {
  return { params: Promise.resolve({ id }) }
}
function req() {
  return new Request(`http://localhost/api/langfristige-planung/planversionen/${ID}/duplicate`, {
    method: 'POST',
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
  mockRpc.mockReset()
})

describe('POST /api/langfristige-planung/planversionen/[id]/duplicate', () => {
  it('returns 201 with the new (copied) version', async () => {
    mockRpc.mockResolvedValueOnce({ data: NEW_VERSION, error: null })
    const res = await POST(req(), ctx(ID))
    expect(res.status).toBe(201)
    const body = await res.json()
    expect(body.name).toBe('Basisszenario (Kopie)')
    expect(mockRpc).toHaveBeenCalledWith('duplicate_langfristige_planversion', { p_source_id: ID })
  })

  it('returns 400 on invalid uuid', async () => {
    const res = await POST(req(), ctx('not-a-uuid'))
    expect(res.status).toBe(400)
    expect(mockRpc).not.toHaveBeenCalled()
  })

  it('returns 404 when the source version is unknown / foreign (P0002)', async () => {
    mockRpc.mockResolvedValueOnce({ data: null, error: { code: 'P0002', message: 'planversion_not_found' } })
    const res = await POST(req(), ctx(ID))
    expect(res.status).toBe(404)
  })

  it('returns 404 when the error message signals not_found without code', async () => {
    mockRpc.mockResolvedValueOnce({ data: null, error: { message: 'planversion_not_found' } })
    const res = await POST(req(), ctx(ID))
    expect(res.status).toBe(404)
  })

  it('returns 500 on a generic db error', async () => {
    mockRpc.mockResolvedValueOnce({ data: null, error: { code: 'XX000', message: 'boom' } })
    const res = await POST(req(), ctx(ID))
    expect(res.status).toBe(500)
  })

  it('returns 401 when unauthenticated', async () => {
    await unauth()
    const res = await POST(req(), ctx(ID))
    expect(res.status).toBe(401)
    expect(mockRpc).not.toHaveBeenCalled()
  })
})
