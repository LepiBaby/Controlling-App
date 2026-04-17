import { describe, it, expect, vi, beforeEach } from 'vitest'
import { GET } from './route'

vi.mock('@supabase/ssr', () => ({
  createServerClient: vi.fn(() => ({
    auth: {
      exchangeCodeForSession: vi.fn().mockResolvedValue({ error: null }),
    },
  })),
}))

vi.mock('next/headers', () => ({
  cookies: vi.fn().mockResolvedValue({
    getAll: vi.fn().mockReturnValue([]),
    set: vi.fn(),
  }),
}))

function makeRequest(params: Record<string, string>) {
  const url = new URL('http://localhost/auth/callback')
  Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v))
  return new Request(url.toString())
}

describe('GET /auth/callback', () => {
  beforeEach(() => vi.clearAllMocks())

  it('redirects to /dashboard on valid code', async () => {
    const res = await GET(makeRequest({ code: 'valid-code' }))
    expect(res.status).toBe(307)
    expect(res.headers.get('location')).toBe('http://localhost/dashboard')
  })

  it('redirects to ?next= path on valid code with next param', async () => {
    const res = await GET(makeRequest({ code: 'valid-code', next: '/some-page' }))
    expect(res.status).toBe(307)
    expect(res.headers.get('location')).toBe('http://localhost/some-page')
  })

  it('redirects to /login?error=auth_error when no code provided', async () => {
    const res = await GET(makeRequest({}))
    expect(res.status).toBe(307)
    expect(res.headers.get('location')).toBe('http://localhost/login?error=auth_error')
  })

  it('redirects to /login?error=auth_error when exchange fails', async () => {
    const { createServerClient } = await import('@supabase/ssr')
    vi.mocked(createServerClient).mockReturnValueOnce({
      auth: {
        exchangeCodeForSession: vi.fn().mockResolvedValue({ error: new Error('invalid token') }),
      },
    } as never)

    const res = await GET(makeRequest({ code: 'bad-code' }))
    expect(res.status).toBe(307)
    expect(res.headers.get('location')).toBe('http://localhost/login?error=auth_error')
  })
})
