import { describe, it, expect, vi, beforeEach } from 'vitest'
import { GET } from './route'

const mockFrom = vi.fn()
const mockSupabase = { from: (table: string) => mockFrom(table) }

vi.mock('@/lib/supabase-server', () => ({
  requireAuth: vi.fn(),
}))

import { requireAuth } from '@/lib/supabase-server'

function setupAuth() {
  vi.mocked(requireAuth).mockResolvedValue({
    user: { id: 'user-1', email: 'test@test.com' } as never,
    supabase: mockSupabase as never,
    error: null,
  })
}

// Returns a builder that chains eq/neq/lte/not/is/in/order returning { data: [], error: null }
function emptyChain(): unknown {
  const chain: Record<string, unknown> = {}
  const terminal = { data: [], error: null }
  const self = () => chain
  chain.select = self
  chain.eq = self
  chain.neq = self
  chain.lte = self
  chain.gte = self
  chain.or = self
  chain.not = () => chain
  chain.is = () => terminal
  chain.in = self
  chain.order = () => terminal
  chain.maybeSingle = () => terminal
  chain.single = () => terminal
  chain.data = []
  chain.error = null
  return chain
}

describe('GET /api/vermoegenswerte/vorschlaege', () => {
  beforeEach(() => { vi.resetAllMocks(); setupAuth() })

  function req(url: string) {
    return new Request(url)
  }

  it('returns 400 without datum', async () => {
    const res = await GET(req('http://localhost/api/vermoegenswerte/vorschlaege'))
    expect(res.status).toBe(400)
  })

  it('returns 400 with invalid datum format', async () => {
    const res = await GET(req('http://localhost/api/vermoegenswerte/vorschlaege?datum=2026-13'))
    expect(res.status).toBe(400)
  })

  it('returns 200 with zero values when no data', async () => {
    mockFrom.mockReturnValue(emptyChain())

    const res = await GET(req('http://localhost/api/vermoegenswerte/vorschlaege?datum=2026-05-01'))
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json.verbindlichkeiten_llv).toBe(0)
    expect(json.verbindlichkeiten_sonstige).toBe(0)
    expect(json.cash_bestand).toBe(0)
    expect(json.lagerwerte).toEqual({})
    expect(json.datum).toBe('2026-05-01')
  })

  it('returns 401 when not authenticated', async () => {
    vi.mocked(requireAuth).mockResolvedValueOnce({
      user: null,
      supabase: mockSupabase as never,
      error: new Response('Unauthorized', { status: 401 }),
    })
    const res = await GET(req('http://localhost/api/vermoegenswerte/vorschlaege?datum=2026-05-01'))
    expect(res.status).toBe(401)
  })
})
