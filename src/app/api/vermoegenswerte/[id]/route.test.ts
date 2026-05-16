import { describe, it, expect, vi, beforeEach } from 'vitest'
import { DELETE } from './route'

const mockFrom = vi.fn()

vi.mock('@/lib/supabase-server', () => ({
  requireAuth: vi.fn().mockResolvedValue({
    user: { id: 'user-1', email: 'test@test.com' } as never,
    supabase: { from: (table: string) => mockFrom(table) },
    error: null,
  }),
}))

const SNAPSHOT_ID = '123e4567-e89b-12d3-a456-426614174000'

function req(id: string) {
  return {
    request: new Request(`http://localhost/api/vermoegenswerte/${id}`, { method: 'DELETE' }),
    params: Promise.resolve({ id }),
  }
}

describe('DELETE /api/vermoegenswerte/[id]', () => {
  beforeEach(() => vi.clearAllMocks())

  it('returns 204 on successful delete', async () => {
    mockFrom.mockReturnValue({
      delete: () => ({ eq: () => ({ error: null }) }),
    })
    const { request, params } = req(SNAPSHOT_ID)
    const res = await DELETE(request, { params })
    expect(res.status).toBe(204)
  })

  it('returns 500 on DB error', async () => {
    mockFrom.mockReturnValue({
      delete: () => ({ eq: () => ({ error: { message: 'DB failure' } }) }),
    })
    const { request, params } = req(SNAPSHOT_ID)
    const res = await DELETE(request, { params })
    expect(res.status).toBe(500)
  })

  it('returns 401 when not authenticated', async () => {
    vi.mocked(
      (await import('@/lib/supabase-server')).requireAuth
    ).mockResolvedValueOnce({
      user: null,
      supabase: { from: mockFrom } as never,
      error: new Response('Unauthorized', { status: 401 }),
    })
    const { request, params } = req(SNAPSHOT_ID)
    const res = await DELETE(request, { params })
    expect(res.status).toBe(401)
  })
})
