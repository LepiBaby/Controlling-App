import { describe, it, expect, vi, beforeEach } from 'vitest'
import { GET } from './route'

const mockFrom = vi.fn()

vi.mock('@/lib/supabase-server', () => ({
  requireAuth: vi.fn().mockResolvedValue({
    user: { id: 'user-1', email: 'test@test.com' },
    supabase: { from: (table: string) => mockFrom(table) },
    error: null,
  }),
}))

// ─── UUID-Fixtures ────────────────────────────────────────────────────────────

const SNAP_ID    = 'aaaaaaaa-0000-0000-0000-000000000001'
const PRODUKT_ID = 'bbbbbbbb-0000-0000-0000-000000000001'
const SKU_ID     = 'cccccccc-0000-0000-0000-000000000001'
const PKZ_ID     = 'dddddddd-0000-0000-0000-000000000001'

// ─── Mock Builder ─────────────────────────────────────────────────────────────

function chain(result: { data: unknown; error: unknown }) {
  const obj: Record<string, unknown> = {}
  const methods = ['select', 'eq', 'neq', 'not', 'is', 'gte', 'lte', 'or', 'order', 'limit', 'maybeSingle', 'single']
  for (const m of methods) {
    obj[m] = vi.fn().mockReturnValue(obj)
  }
  obj.then = (resolve: (v: unknown) => unknown) => Promise.resolve(result).then(resolve)
  return obj
}

function setupMocks({
  snapshots = [] as unknown[],
  produkte  = [] as unknown[],
  skus      = [] as unknown[],
  bestand   = [] as unknown[],
  pkZraeume = [] as unknown[],
  pkWerte   = [] as unknown[],
} = {}) {
  mockFrom.mockImplementation((table: string) => {
    if (table === 'vermoegenswarte_snapshots') return chain({ data: snapshots, error: null })
    if (table === 'kpi_categories') {
      // First call returns produkte (level=1), second returns skus (neq level=1)
      return chain({ data: [], error: null })
    }
    if (table === 'bestand_transaktionen') return chain({ data: bestand, error: null })
    if (table === 'produktkosten_zeitraeume') return chain({ data: pkZraeume, error: null })
    if (table === 'produktkosten_werte')    return chain({ data: pkWerte, error: null })
    return chain({ data: [], error: null })
  })
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('GET /api/reporting/vermoegen', () => {
  beforeEach(() => { vi.clearAllMocks() })

  it('returns latest=null and empty series when no snapshots', async () => {
    setupMocks({ snapshots: [] })
    const res = await GET()
    const body = await res.json()
    expect(body).toEqual({ latest: null, series: [] })
  })

  it('computes Warenkapital = Lager + Transit', async () => {
    setupMocks({
      snapshots: [{
        id: SNAP_ID,
        datum: '2026-05-15',
        verbindlichkeiten_llv: 0,
        verbindlichkeiten_sonstige: 0,
        darlehensvb: 0,
        cash_bestand: 0,
        anlagevermoegen: 0,
        lagerwerte: [{ produkt_id: PRODUKT_ID, lagerwert: 10000 }],
        transitwerte: [{ produkt_id: PRODUKT_ID, transitwert: 2500 }],
        forderungen: [],
      }],
    })
    const res = await GET()
    const body = await res.json()
    expect(body.latest.lager).toBe(10000)
    expect(body.latest.transit).toBe(2500)
    expect(body.latest.warenkapital).toBe(12500)
  })

  it('returns lager_anteil=null when Warenkapital=0', async () => {
    setupMocks({
      snapshots: [{
        id: SNAP_ID, datum: '2026-05-01',
        verbindlichkeiten_llv: 0, verbindlichkeiten_sonstige: 0,
        darlehensvb: 0, cash_bestand: 0, anlagevermoegen: 0,
        lagerwerte: [], transitwerte: [], forderungen: [],
      }],
    })
    const res = await GET()
    const body = await res.json()
    expect(body.latest.lager_anteil).toBeNull()
  })

  it('computes Cash Ratio correctly', async () => {
    setupMocks({
      snapshots: [{
        id: SNAP_ID, datum: '2026-04-01',
        verbindlichkeiten_llv: 8000, verbindlichkeiten_sonstige: 2000,
        darlehensvb: 0, cash_bestand: 5000, anlagevermoegen: 0,
        lagerwerte: [], transitwerte: [], forderungen: [],
      }],
    })
    const res = await GET()
    const body = await res.json()
    // cash_ratio = 5000 / (8000 + 2000) = 0.5
    expect(body.latest.cash_ratio).toBe(0.5)
  })

  it('returns cash_ratio=null when Verbindlichkeiten=0', async () => {
    setupMocks({
      snapshots: [{
        id: SNAP_ID, datum: '2026-04-01',
        verbindlichkeiten_llv: 0, verbindlichkeiten_sonstige: 0,
        darlehensvb: 0, cash_bestand: 5000, anlagevermoegen: 0,
        lagerwerte: [], transitwerte: [], forderungen: [],
      }],
    })
    const res = await GET()
    const body = await res.json()
    expect(body.latest.cash_ratio).toBeNull()
    expect(body.latest.quick_ratio).toBeNull()
    expect(body.latest.current_ratio).toBeNull()
  })

  it('computes Eigenkapital correctly', async () => {
    setupMocks({
      snapshots: [{
        id: SNAP_ID, datum: '2026-04-01',
        verbindlichkeiten_llv: 5000, verbindlichkeiten_sonstige: 3000,
        darlehensvb: 10000, cash_bestand: 8000, anlagevermoegen: 20000,
        lagerwerte: [{ produkt_id: PRODUKT_ID, lagerwert: 30000 }],
        transitwerte: [{ produkt_id: PRODUKT_ID, transitwert: 5000 }],
        forderungen: [{ plattform_id: null, betrag: 2000 }],
      }],
    })
    const res = await GET()
    const body = await res.json()
    // warenkapital = 35000, gesamt_forderungen = 2000, cash = 8000, anlage = 20000
    // EK = 35000 + 2000 + 8000 + 20000 = 65000
    expect(body.latest.eigenkapital).toBe(65000)
    // FK = 5000 + 3000 + 10000 = 18000
    expect(body.latest.fremdkapital).toBe(18000)
    // Gesamtvermögen = 65000 + 18000 = 83000
    expect(body.latest.gesamtvermoegen).toBe(83000)
  })

  it('returns ek_quote=null when Gesamtvermoegen=0', async () => {
    setupMocks({
      snapshots: [{
        id: SNAP_ID, datum: '2026-04-01',
        verbindlichkeiten_llv: 0, verbindlichkeiten_sonstige: 0,
        darlehensvb: 0, cash_bestand: 0, anlagevermoegen: 0,
        lagerwerte: [], transitwerte: [], forderungen: [],
      }],
    })
    const res = await GET()
    const body = await res.json()
    expect(body.latest.ek_quote).toBeNull()
    expect(body.latest.fk_quote).toBeNull()
    expect(body.latest.cash_quote).toBeNull()
  })

  it('returns series sorted ascending and latest = newest', async () => {
    setupMocks({
      snapshots: [
        {
          id: 'aaa', datum: '2026-03-01',
          verbindlichkeiten_llv: 0, verbindlichkeiten_sonstige: 0,
          darlehensvb: 0, cash_bestand: 1000, anlagevermoegen: 0,
          lagerwerte: [], transitwerte: [], forderungen: [],
        },
        {
          id: 'bbb', datum: '2026-05-01',
          verbindlichkeiten_llv: 0, verbindlichkeiten_sonstige: 0,
          darlehensvb: 0, cash_bestand: 3000, anlagevermoegen: 0,
          lagerwerte: [], transitwerte: [], forderungen: [],
        },
        {
          id: 'ccc', datum: '2026-04-01',
          verbindlichkeiten_llv: 0, verbindlichkeiten_sonstige: 0,
          darlehensvb: 0, cash_bestand: 2000, anlagevermoegen: 0,
          lagerwerte: [], transitwerte: [], forderungen: [],
        },
      ],
    })
    const res = await GET()
    const body = await res.json()
    expect(body.series).toHaveLength(3)
    expect(body.series[0].datum).toBe('2026-03-01')
    expect(body.series[1].datum).toBe('2026-04-01')
    expect(body.series[2].datum).toBe('2026-05-01')
    expect(body.latest.datum).toBe('2026-05-01')
  })

  it('computes Working Capital correctly', async () => {
    setupMocks({
      snapshots: [{
        id: SNAP_ID, datum: '2026-04-01',
        verbindlichkeiten_llv: 4000, verbindlichkeiten_sonstige: 1000,
        darlehensvb: 0, cash_bestand: 6000, anlagevermoegen: 0,
        lagerwerte: [{ produkt_id: PRODUKT_ID, lagerwert: 20000 }],
        transitwerte: [],
        forderungen: [{ plattform_id: null, betrag: 3000 }],
      }],
    })
    const res = await GET()
    const body = await res.json()
    // WC = 20000 + 6000 + 3000 - 4000 - 1000 = 24000
    expect(body.latest.working_capital).toBe(24000)
  })
})
