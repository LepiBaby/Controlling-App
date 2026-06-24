import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { GET } from './route'

const mockFrom = vi.fn()

vi.mock('@/lib/supabase-server', () => ({
  requireAuth: vi.fn().mockResolvedValue({
    user: { id: 'user-1', email: 'test@test.com' },
    supabase: { from: (table: string) => mockFrom(table) },
    error: null,
  }),
}))

const VERSION_ID = '11111111-1111-4111-8111-111111111111'
const PLATT_ID = '44444444-4444-4444-8444-444444444444'
const KANAL_ID = '55555555-5555-4555-8555-555555555555'
const PROD_ID = '33333333-3333-4333-8333-333333333333'

function chain(result: unknown) {
  const c: Record<string, unknown> = { then: (resolve: (v: unknown) => unknown) => resolve(result) }
  for (const m of ['select', 'eq', 'in', 'maybeSingle', 'limit']) c[m] = () => c
  return c
}

function ctx(id = VERSION_ID) {
  return { params: Promise.resolve({ versionId: id }) }
}
const URL_BASE = `http://localhost/api/langfristige-planung/${VERSION_ID}/einnahmen-planung/produktverkaeufe-berechnet`

const GRUND = { startmonat_monat: 1, startmonat_jahr: 2026, planungshorizont_monate: 12 }

// Mock-Reihenfolge der Supabase-Aufrufe:
// 0: langfristige_planversionen (Versionsprüfung)
// 1: langfristige_grundeinstellungen (maybeSingle)
// 2: langfristige_auszahlungs_einstellungen
// 3: langfristige_auszahlungs_marketingkanaele
// 4: langfristige_sales_plattform_planung (manuelle Überschreibungen)
function setup(opts: {
  ausz?: unknown[]
  mktKanal?: unknown[]
  sppManual?: unknown[]
  grund?: unknown
  auszError?: boolean
} = {}) {
  mockFrom.mockReturnValueOnce(chain({ data: { id: VERSION_ID }, error: null }))      // version
  mockFrom.mockReturnValueOnce(chain({ data: opts.grund ?? GRUND, error: null }))     // grundeinstellungen
  mockFrom.mockReturnValueOnce(
    opts.auszError
      ? chain({ data: null, error: { message: 'Auszahlung DB error' } })
      : chain({ data: opts.ausz ?? [], error: null }),
  )                                                                                    // auszahlungs_einstellungen
  mockFrom.mockReturnValueOnce(chain({ data: opts.mktKanal ?? [], error: null }))      // marketingkanaele
  mockFrom.mockReturnValueOnce(chain({ data: opts.sppManual ?? [], error: null }))     // spp manual
}

// Stub für den internen Fetch der Sales-Plattform-Planung /berechnet-Route.
function stubSppFetch(rows: unknown[]) {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: async () => rows }))
}

beforeEach(() => {
  vi.clearAllMocks()
  mockFrom.mockReset()
  // Default: interner Fetch liefert keine SPP-Werte.
  stubSppFetch([])
})

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('GET /api/langfristige-planung/[versionId]/einnahmen-planung/produktverkaeufe-berechnet', () => {
  it('returns 401 when unauthenticated', async () => {
    const { requireAuth } = await import('@/lib/supabase-server')
    vi.mocked(requireAuth).mockResolvedValueOnce({
      user: null,
      supabase: null as never,
      error: new Response('Unauthorized', { status: 401 }),
    })
    const res = await GET(new Request(URL_BASE), ctx())
    expect(res.status).toBe(401)
  })

  it('returns 400 for invalid version id', async () => {
    const res = await GET(new Request(URL_BASE), ctx('not-a-uuid'))
    expect(res.status).toBe(400)
  })

  it('returns 404 for foreign/unknown version', async () => {
    mockFrom.mockReturnValueOnce(chain({ data: null, error: null }))
    const res = await GET(new Request(URL_BASE), ctx())
    expect(res.status).toBe(404)
  })

  it('returns empty array when no Auszahlungseinstellungen configured', async () => {
    setup({ ausz: [] })
    const res = await GET(new Request(URL_BASE), ctx())
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual([])
  })

  it('returns 500 when auszahlungs query fails', async () => {
    setup({ auszError: true })
    const res = await GET(new Request(URL_BASE), ctx())
    expect(res.status).toBe(500)
    expect((await res.json()).error).toBe('Auszahlung DB error')
  })

  it('skips platforms without an anchor month configured', async () => {
    setup({
      ausz: [{
        sales_plattform_id: PLATT_ID,
        auszahlungsrhythmus: 'monatlich',
        erster_auszahlung_monat: null,
        erster_auszahlung_jahr: null,
        verschiebung_monate: 0,
      }],
    })
    stubSppFetch([
      { kategorie: 'bruttoumsatz', produkt_id: PROD_ID, sales_plattform_id: PLATT_ID, jahr: 2026, monat: 1, wert: 100 },
    ])
    const res = await GET(new Request(URL_BASE), ctx())
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual([])
  })

  it('computes monthly payout (R=1, V=0): net lands in the same month', async () => {
    setup({
      ausz: [{
        sales_plattform_id: PLATT_ID,
        auszahlungsrhythmus: 'monatlich',
        erster_auszahlung_monat: 1,
        erster_auszahlung_jahr: 2026,
        verschiebung_monate: 0,
      }],
    })
    // Net month 1/2026 = brutto 100 − verkaufsgebuehr 10 = 90
    stubSppFetch([
      { kategorie: 'bruttoumsatz', produkt_id: PROD_ID, sales_plattform_id: PLATT_ID, jahr: 2026, monat: 1, wert: 100 },
      { kategorie: 'verkaufsgebuehr', produkt_id: PROD_ID, sales_plattform_id: PLATT_ID, jahr: 2026, monat: 1, wert: 10 },
    ])
    const res = await GET(new Request(URL_BASE), ctx())
    expect(res.status).toBe(200)
    const body = await res.json() as { jahr: number; monat: number; sales_plattform_id: string; wert: number }[]
    const m1 = body.find(r => r.jahr === 2026 && r.monat === 1 && r.sales_plattform_id === PLATT_ID)
    expect(m1?.wert).toBe(90)
  })

  it('subtracts marketing when the platform has an assigned marketing channel', async () => {
    setup({
      ausz: [{
        sales_plattform_id: PLATT_ID,
        auszahlungsrhythmus: 'monatlich',
        erster_auszahlung_monat: 1,
        erster_auszahlung_jahr: 2026,
        verschiebung_monate: 0,
      }],
      mktKanal: [{ sales_plattform_id: PLATT_ID, marketingkanal_id: KANAL_ID }],
    })
    stubSppFetch([
      { kategorie: 'bruttoumsatz', produkt_id: PROD_ID, sales_plattform_id: PLATT_ID, jahr: 2026, monat: 1, wert: 100 },
      // Marketing-Zeile: sales_plattform_id trägt die Marketingkanal-ID
      { kategorie: 'marketing', produkt_id: PROD_ID, sales_plattform_id: KANAL_ID, jahr: 2026, monat: 1, wert: 25 },
    ])
    const res = await GET(new Request(URL_BASE), ctx())
    const body = await res.json() as { jahr: number; monat: number; wert: number }[]
    const m1 = body.find(r => r.jahr === 2026 && r.monat === 1)
    expect(m1?.wert).toBe(75) // 100 − 25
  })

  it('does NOT shift marketing by V — marketing window is aligned to the payout month', async () => {
    // alle_zwei_monate (R=2), Anker 1/2026, V=1. Auszahlungsmonat März 2026:
    //   Erlös-Fenster [März−1−2+1 … März−1] = [Jan … Feb]  → Netto aus Jan
    //   Marketing-Fenster (OHNE V) [März−2+1 … März] = [Feb … März] → Marketing aus März
    setup({
      ausz: [{
        sales_plattform_id: PLATT_ID,
        auszahlungsrhythmus: 'alle_zwei_monate',
        erster_auszahlung_monat: 1,
        erster_auszahlung_jahr: 2026,
        verschiebung_monate: 1,
      }],
      mktKanal: [{ sales_plattform_id: PLATT_ID, marketingkanal_id: KANAL_ID }],
    })
    stubSppFetch([
      { kategorie: 'bruttoumsatz', produkt_id: PROD_ID, sales_plattform_id: PLATT_ID, jahr: 2026, monat: 1, wert: 100 },
      // Marketing nur im März — würde bei V-Shift (altes Verhalten) NICHT abgezogen,
      // bei payout-ausgerichtetem Fenster (gewünscht) hingegen schon.
      { kategorie: 'marketing', produkt_id: PROD_ID, sales_plattform_id: KANAL_ID, jahr: 2026, monat: 3, wert: 30 },
    ])
    const res = await GET(new Request(URL_BASE), ctx())
    const body = await res.json() as { jahr: number; monat: number; wert: number }[]
    // März-Auszahlung: Netto Jan (100) − Marketing März (30) = 70
    expect(body.find(r => r.jahr === 2026 && r.monat === 3)?.wert).toBe(70)
  })

  it('applies the month shift (V=2): revenue lands V months later', async () => {
    setup({
      ausz: [{
        sales_plattform_id: PLATT_ID,
        auszahlungsrhythmus: 'monatlich',
        erster_auszahlung_monat: 1,
        erster_auszahlung_jahr: 2026,
        verschiebung_monate: 2,
      }],
    })
    // Net only in month 1/2026 = 100 → with V=2 it is paid out in month 3/2026
    stubSppFetch([
      { kategorie: 'bruttoumsatz', produkt_id: PROD_ID, sales_plattform_id: PLATT_ID, jahr: 2026, monat: 1, wert: 100 },
    ])
    const res = await GET(new Request(URL_BASE), ctx())
    const body = await res.json() as { jahr: number; monat: number; wert: number }[]
    expect(body.find(r => r.monat === 1)).toBeUndefined()
    expect(body.find(r => r.jahr === 2026 && r.monat === 3)?.wert).toBe(100)
  })

  it('result is sorted by month ascending and has the required fields', async () => {
    setup({
      ausz: [{
        sales_plattform_id: PLATT_ID,
        auszahlungsrhythmus: 'monatlich',
        erster_auszahlung_monat: 1,
        erster_auszahlung_jahr: 2026,
        verschiebung_monate: 0,
      }],
    })
    stubSppFetch([
      { kategorie: 'bruttoumsatz', produkt_id: PROD_ID, sales_plattform_id: PLATT_ID, jahr: 2026, monat: 1, wert: 50 },
      { kategorie: 'bruttoumsatz', produkt_id: PROD_ID, sales_plattform_id: PLATT_ID, jahr: 2026, monat: 5, wert: 70 },
    ])
    const res = await GET(new Request(URL_BASE), ctx())
    const body = await res.json() as { jahr: number; monat: number; sales_plattform_id: string; wert: number }[]
    expect(body.length).toBeGreaterThanOrEqual(2)
    for (let i = 1; i < body.length; i++) {
      const prev = body[i - 1].jahr * 12 + body[i - 1].monat
      const curr = body[i].jahr * 12 + body[i].monat
      expect(curr).toBeGreaterThanOrEqual(prev)
    }
    for (const item of body) {
      expect(item).toHaveProperty('jahr')
      expect(item).toHaveProperty('monat')
      expect(item).toHaveProperty('sales_plattform_id')
      expect(item).toHaveProperty('wert')
    }
  })
})
