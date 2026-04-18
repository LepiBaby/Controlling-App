import { describe, it, expect, vi, beforeEach } from 'vitest'
import { PATCH, DELETE } from './route'

vi.mock('@/lib/supabase-server', () => ({
  requireAuth: vi.fn().mockResolvedValue({
    user: { id: 'user-1' },
    supabase: {
      from: vi.fn().mockReturnValue({
        update: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            select: vi.fn().mockReturnValue({
              single: vi.fn().mockResolvedValue({
                data: { id: 'cat-1', name: 'Updated' },
                error: null,
              }),
            }),
          }),
        }),
        delete: vi.fn().mockReturnValue({
          eq: vi.fn().mockResolvedValue({ error: null }),
        }),
      }),
    },
    error: null,
  }),
}))

function makeCtx(id: string) {
  return { params: Promise.resolve({ id }) }
}

describe('PATCH /api/kpi-categories/[id]', () => {
  beforeEach(() => vi.clearAllMocks())

  it('returns 400 for empty body', async () => {
    const res = await PATCH(
      new Request('http://localhost/api/kpi-categories/cat-1', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      }),
      makeCtx('cat-1')
    )
    expect(res.status).toBe(400)
  })

  it('returns 400 for invalid name (empty string)', async () => {
    const res = await PATCH(
      new Request('http://localhost/api/kpi-categories/cat-1', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: '' }),
      }),
      makeCtx('cat-1')
    )
    expect(res.status).toBe(400)
  })

  it('returns 200 for valid name update', async () => {
    const res = await PATCH(
      new Request('http://localhost/api/kpi-categories/cat-1', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: 'Neuer Name' }),
      }),
      makeCtx('cat-1')
    )
    expect(res.status).toBe(200)
  })

  it('returns 200 for sort_order update', async () => {
    const res = await PATCH(
      new Request('http://localhost/api/kpi-categories/cat-1', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sort_order: 2 }),
      }),
      makeCtx('cat-1')
    )
    expect(res.status).toBe(200)
  })
})

describe('DELETE /api/kpi-categories/[id]', () => {
  it('returns 204 on successful delete', async () => {
    const res = await DELETE(
      new Request('http://localhost/api/kpi-categories/cat-1', { method: 'DELETE' }),
      makeCtx('cat-1')
    )
    expect(res.status).toBe(204)
  })

  it('returns 401 when unauthenticated', async () => {
    const { requireAuth } = await import('@/lib/supabase-server')
    vi.mocked(requireAuth).mockResolvedValueOnce({
      user: null,
      supabase: null as never,
      error: new Response('Unauthorized', { status: 401 }),
    })
    const res = await DELETE(
      new Request('http://localhost/api/kpi-categories/cat-1', { method: 'DELETE' }),
      makeCtx('cat-1')
    )
    expect(res.status).toBe(401)
  })
})
