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

  it('returns 200 for sales_plattform_enabled update', async () => {
    const res = await PATCH(
      new Request('http://localhost/api/kpi-categories/cat-1', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sales_plattform_enabled: true }),
      }),
      makeCtx('cat-1')
    )
    expect(res.status).toBe(200)
  })

  it('returns 200 for produkt_enabled update', async () => {
    const res = await PATCH(
      new Request('http://localhost/api/kpi-categories/cat-1', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ produkt_enabled: false }),
      }),
      makeCtx('cat-1')
    )
    expect(res.status).toBe(200)
  })

  it('returns 400 for non-boolean sales_plattform_enabled', async () => {
    const res = await PATCH(
      new Request('http://localhost/api/kpi-categories/cat-1', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sales_plattform_enabled: 'yes' }),
      }),
      makeCtx('cat-1')
    )
    expect(res.status).toBe(400)
  })

  it('returns 200 for kosten_label update', async () => {
    const res = await PATCH(
      new Request('http://localhost/api/kpi-categories/cat-1', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ kosten_label: 'Produktkosten' }),
      }),
      makeCtx('cat-1')
    )
    expect(res.status).toBe(200)
  })

  it('returns 200 for ausgaben_label update', async () => {
    const res = await PATCH(
      new Request('http://localhost/api/kpi-categories/cat-1', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ausgaben_label: 'Produktausgaben' }),
      }),
      makeCtx('cat-1')
    )
    expect(res.status).toBe(200)
  })

  it('returns 200 for kosten_label set to null (clear label)', async () => {
    const res = await PATCH(
      new Request('http://localhost/api/kpi-categories/cat-1', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ kosten_label: null }),
      }),
      makeCtx('cat-1')
    )
    expect(res.status).toBe(200)
  })

  it('returns 400 for kosten_label exceeding 100 characters', async () => {
    const res = await PATCH(
      new Request('http://localhost/api/kpi-categories/cat-1', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ kosten_label: 'x'.repeat(101) }),
      }),
      makeCtx('cat-1')
    )
    expect(res.status).toBe(400)
  })

  it('returns 200 for ist_abzugsposten true', async () => {
    const res = await PATCH(
      new Request('http://localhost/api/kpi-categories/cat-1', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ist_abzugsposten: true }),
      }),
      makeCtx('cat-1')
    )
    expect(res.status).toBe(200)
  })

  it('returns 200 for ist_abzugsposten false', async () => {
    const res = await PATCH(
      new Request('http://localhost/api/kpi-categories/cat-1', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ist_abzugsposten: false }),
      }),
      makeCtx('cat-1')
    )
    expect(res.status).toBe(200)
  })

  it('returns 400 for non-boolean ist_abzugsposten', async () => {
    const res = await PATCH(
      new Request('http://localhost/api/kpi-categories/cat-1', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ist_abzugsposten: 'true' }),
      }),
      makeCtx('cat-1')
    )
    expect(res.status).toBe(400)
  })

  // PROJ-10: weitere Edge Cases für Label-Validierung
  it('PROJ-10: accepts empty string as kosten_label', async () => {
    const res = await PATCH(
      new Request('http://localhost/api/kpi-categories/cat-1', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ kosten_label: '' }),
      }),
      makeCtx('cat-1')
    )
    expect(res.status).toBe(200)
  })

  it('PROJ-10: accepts exactly 100-char kosten_label (boundary)', async () => {
    const res = await PATCH(
      new Request('http://localhost/api/kpi-categories/cat-1', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ kosten_label: 'x'.repeat(100) }),
      }),
      makeCtx('cat-1')
    )
    expect(res.status).toBe(200)
  })

  it('PROJ-10: returns 400 for ausgaben_label exceeding 100 characters', async () => {
    const res = await PATCH(
      new Request('http://localhost/api/kpi-categories/cat-1', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ausgaben_label: 'y'.repeat(101) }),
      }),
      makeCtx('cat-1')
    )
    expect(res.status).toBe(400)
  })

  it('PROJ-10: returns 400 for non-string kosten_label', async () => {
    const res = await PATCH(
      new Request('http://localhost/api/kpi-categories/cat-1', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ kosten_label: 42 }),
      }),
      makeCtx('cat-1')
    )
    expect(res.status).toBe(400)
  })

  it('PROJ-10 + PROJ-11: accepts combined patch with labels + Abzugsposten', async () => {
    const res = await PATCH(
      new Request('http://localhost/api/kpi-categories/cat-1', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          kosten_label: 'Produktkosten',
          ausgaben_label: 'Produktausgaben',
          ist_abzugsposten: true,
        }),
      }),
      makeCtx('cat-1')
    )
    expect(res.status).toBe(200)
  })

  // ─── PROJ-2 SKU Amendment PATCH tests ───────────────────────────────────────

  it('PROJ-2 SKU: accepts sku_code update', async () => {
    const res = await PATCH(
      new Request('http://localhost/api/kpi-categories/cat-1', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sku_code: 'NEW-SKU-001' }),
      }),
      makeCtx('cat-1')
    )
    expect(res.status).toBe(200)
  })

  it('PROJ-2 SKU: accepts combined name + sku_code update', async () => {
    const res = await PATCH(
      new Request('http://localhost/api/kpi-categories/cat-1', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: 'Neuer Name', sku_code: 'NEW-SKU' }),
      }),
      makeCtx('cat-1')
    )
    expect(res.status).toBe(200)
  })

  it('PROJ-2 SKU: returns 400 for empty sku_code string', async () => {
    const res = await PATCH(
      new Request('http://localhost/api/kpi-categories/cat-1', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sku_code: '' }),
      }),
      makeCtx('cat-1')
    )
    expect(res.status).toBe(400)
  })

  it('PROJ-2 SKU: returns 400 for sku_code exceeding 100 characters', async () => {
    const res = await PATCH(
      new Request('http://localhost/api/kpi-categories/cat-1', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sku_code: 'x'.repeat(101) }),
      }),
      makeCtx('cat-1')
    )
    expect(res.status).toBe(400)
  })

  it('PROJ-2 SKU: returns 400 for non-string sku_code', async () => {
    const res = await PATCH(
      new Request('http://localhost/api/kpi-categories/cat-1', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sku_code: 123 }),
      }),
      makeCtx('cat-1')
    )
    expect(res.status).toBe(400)
  })

  it('PROJ-2 SKU: accepts exactly 100-char sku_code (boundary)', async () => {
    const res = await PATCH(
      new Request('http://localhost/api/kpi-categories/cat-1', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sku_code: 'x'.repeat(100) }),
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
