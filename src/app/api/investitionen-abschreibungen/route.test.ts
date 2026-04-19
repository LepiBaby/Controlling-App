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

function req(url: string) {
  return new Request(url)
}

const PROD_KAT_ID = 'aaaaaaaa-0000-0000-0000-000000000001'
const GRP_A       = '333e4567-e89b-12d3-a456-426614174000'
const GRP_B       = '444e4567-e89b-12d3-a456-426614174000'
const UGP_A       = '555e4567-e89b-12d3-a456-426614174000'
const UGP_B       = '666e4567-e89b-12d3-a456-426614174000'
const PRD_A       = '777e4567-e89b-12d3-a456-426614174000'
const PRD_B       = '888e4567-e89b-12d3-a456-426614174000'

/**
 * Thenable, chainable Mock des Supabase-Query-Builders.
 */
function makeChain(result: { data: unknown; error: unknown }) {
  const chain: Record<string, unknown> = {}
  const methods = ['select', 'gte', 'lte', 'in', 'not', 'is', 'or', 'neq', 'eq']
  for (const m of methods) chain[m] = () => chain
  ;(chain as { then: (onFulfilled: (r: unknown) => unknown) => unknown }).then =
    (onFulfilled: (r: unknown) => unknown) => Promise.resolve(result).then(onFulfilled)
  return chain
}

function setupMockData(opts: {
  transaktionen?: Array<Record<string, unknown>>
  dbError?: unknown
  katError?: unknown
  katFound?: boolean
}) {
  const katFound = opts.katFound !== false
  mockFrom.mockImplementation((table: string) => {
    if (table === 'kpi_categories') {
      return makeChain({
        data: katFound ? [{ id: PROD_KAT_ID }] : [],
        error: opts.katError ?? null,
      })
    }
    if (table === 'ausgaben_kosten_transaktionen') {
      return makeChain({ data: opts.transaktionen ?? [], error: opts.dbError ?? null })
    }
    return makeChain({ data: [], error: null })
  })
}

describe('GET /api/investitionen-abschreibungen', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  // ─── 1. Berechnungslogik 12 Monate: Anzahl, Beträge, Datumsfolge ─────────
  it('berechnet 12 Raten mit korrektem Betrag und Datumsfolge', async () => {
    // 09.04.2026, 1200 € / 12 = 100 €
    setupMockData({
      transaktionen: [{
        id: 't1',
        leistungsdatum: '2026-04-09',
        betrag_netto: 1200,
        gruppe_id: null,
        untergruppe_id: null,
        beschreibung: 'Server',
      }],
    })

    const res = await GET(req('http://localhost/api/investitionen-abschreibungen?page=1'))
    expect(res.status).toBe(200)
    const body = await res.json()

    expect(body.total).toBe(12)
    expect(body.data).toHaveLength(12)

    // Rate 1: 09.04.2026
    expect(body.data[0].datum).toBe('2026-04-09')
    expect(body.data[0].ursprung_datum).toBe('2026-04-09')
    expect(body.data[0].betrag).toBe(100)

    // Rate 2: 09.05.2026
    expect(body.data[1].datum).toBe('2026-05-09')

    // Rate 12: 09.03.2027
    expect(body.data[11].datum).toBe('2027-03-09')
    expect(body.data[11].betrag).toBe(100)

    // totalBetrag = genau betrag_netto
    expect(body.totalBetrag).toBe(1200)
  })

  // ─── 2. Rundungsrest: letzte Rate erhält Rest ────────────────────────────
  it('letzte Rate erhält Rundungsrest — Summe = betrag_netto', async () => {
    // 500 / 12 = 41.666... → 41.67 (11×), letzte = 500 - 11 × 41.67 = 41.63
    setupMockData({
      transaktionen: [{
        id: 't1',
        leistungsdatum: '2026-01-15',
        betrag_netto: 500,
        gruppe_id: null,
        untergruppe_id: null,
        beschreibung: null,
      }],
    })

    const res = await GET(req('http://localhost/api/investitionen-abschreibungen'))
    const body = await res.json()

    expect(body.data[0].betrag).toBe(41.67)
    expect(body.data[10].betrag).toBe(41.67)
    expect(body.data[11].betrag).toBeCloseTo(41.63, 2)

    const summe = body.data.reduce((acc: number, r: { betrag: number }) => acc + r.betrag, 0)
    expect(Math.round(summe * 100) / 100).toBe(500)
    expect(body.totalBetrag).toBe(500)
  })

  // ─── 3. Monatsende-Clamp: 31.01 → 28.02 ────────────────────────────────
  it('clampt den Tag bei kürzeren Folgemonaten (31.01 → 28.02.2025)', async () => {
    setupMockData({
      transaktionen: [{
        id: 't1',
        leistungsdatum: '2025-01-31',
        betrag_netto: 1200,
        gruppe_id: null,
        untergruppe_id: null,
        beschreibung: null,
      }],
    })

    const res = await GET(req('http://localhost/api/investitionen-abschreibungen'))
    const body = await res.json()

    expect(body.data[0].datum).toBe('2025-01-31')
    expect(body.data[1].datum).toBe('2025-02-28') // kein 31.02.
    expect(body.data[2].datum).toBe('2025-03-31')
    expect(body.data[3].datum).toBe('2025-04-30') // April hat 30 Tage
  })

  // ─── 4. Schaltjahr-Clamp: 31.01.2024 → 29.02.2024 ──────────────────────
  it('clampt den Tag auf 29.02 in Schaltjahren', async () => {
    setupMockData({
      transaktionen: [{
        id: 't1',
        leistungsdatum: '2024-01-31',
        betrag_netto: 1200,
        gruppe_id: null,
        untergruppe_id: null,
        beschreibung: null,
      }],
    })

    const res = await GET(req('http://localhost/api/investitionen-abschreibungen'))
    const body = await res.json()

    expect(body.data[1].datum).toBe('2024-02-29')
  })

  // ─── 5. Filter von/bis (auf Ratendatum) ─────────────────────────────────
  it('filtert Raten nach von/bis (auf Ratendatum)', async () => {
    // 12 Raten: 15.01.2026 – 15.12.2026
    setupMockData({
      transaktionen: [{
        id: 't1',
        leistungsdatum: '2026-01-15',
        betrag_netto: 1200,
        gruppe_id: null,
        untergruppe_id: null,
        beschreibung: null,
      }],
    })

    const res = await GET(req('http://localhost/api/investitionen-abschreibungen?von=2026-06-01&bis=2026-12-31'))
    const body = await res.json()

    expect(body.total).toBe(7) // Jun–Dez = 7 Raten
    for (const rate of body.data) {
      expect(rate.datum >= '2026-06-01').toBe(true)
      expect(rate.datum <= '2026-12-31').toBe(true)
    }
  })

  // ─── 6. Filter gruppe_ids ────────────────────────────────────────────────
  it('filtert Raten nach gruppe_ids', async () => {
    setupMockData({
      transaktionen: [
        {
          id: 't1',
          leistungsdatum: '2026-01-15',
          betrag_netto: 1200,
          gruppe_id: GRP_A,
          untergruppe_id: null,
          beschreibung: 'Gruppe A',
        },
        {
          id: 't2',
          leistungsdatum: '2026-01-15',
          betrag_netto: 2400,
          gruppe_id: GRP_B,
          untergruppe_id: null,
          beschreibung: 'Gruppe B',
        },
      ],
    })

    const res = await GET(req(`http://localhost/api/investitionen-abschreibungen?gruppe_ids=${GRP_A}`))
    const body = await res.json()

    expect(body.total).toBe(12) // nur t1
    for (const rate of body.data) {
      expect(rate.gruppe_id).toBe(GRP_A)
      expect(rate.beschreibung).toBe('Gruppe A')
    }
  })

  // ─── 7. Filter untergruppe_ids ───────────────────────────────────────────
  it('filtert Raten nach untergruppe_ids', async () => {
    setupMockData({
      transaktionen: [
        {
          id: 't1',
          leistungsdatum: '2026-01-15',
          betrag_netto: 1200,
          gruppe_id: GRP_A,
          untergruppe_id: UGP_A,
          beschreibung: 'Untergruppe A',
        },
        {
          id: 't2',
          leistungsdatum: '2026-01-15',
          betrag_netto: 2400,
          gruppe_id: GRP_A,
          untergruppe_id: UGP_B,
          beschreibung: 'Untergruppe B',
        },
      ],
    })

    const res = await GET(req(`http://localhost/api/investitionen-abschreibungen?untergruppe_ids=${UGP_B}`))
    const body = await res.json()

    expect(body.total).toBe(12) // nur t2
    for (const rate of body.data) {
      expect(rate.untergruppe_id).toBe(UGP_B)
      expect(rate.beschreibung).toBe('Untergruppe B')
    }
  })

  // ─── 8. Sortierung datum asc/desc ────────────────────────────────────────
  it('sortiert nach datum aufsteigend (Standard)', async () => {
    setupMockData({
      transaktionen: [{
        id: 't1',
        leistungsdatum: '2026-06-15',
        betrag_netto: 1200,
        gruppe_id: null,
        untergruppe_id: null,
        beschreibung: null,
      }],
    })

    const res = await GET(req('http://localhost/api/investitionen-abschreibungen?sortColumn=datum&sortDirection=asc'))
    const body = await res.json()

    for (let i = 1; i < body.data.length; i++) {
      expect(body.data[i].datum >= body.data[i - 1].datum).toBe(true)
    }
    expect(body.data[0].datum).toBe('2026-06-15')
  })

  it('sortiert nach datum absteigend', async () => {
    setupMockData({
      transaktionen: [{
        id: 't1',
        leistungsdatum: '2026-01-15',
        betrag_netto: 1200,
        gruppe_id: null,
        untergruppe_id: null,
        beschreibung: null,
      }],
    })

    const res = await GET(req('http://localhost/api/investitionen-abschreibungen?sortColumn=datum&sortDirection=desc'))
    const body = await res.json()

    expect(body.data[0].datum).toBe('2026-12-15')
    for (let i = 1; i < body.data.length; i++) {
      expect(body.data[i].datum <= body.data[i - 1].datum).toBe(true)
    }
  })

  // ─── 9. Sortierung betrag ────────────────────────────────────────────────
  it('sortiert nach betrag asc/desc', async () => {
    // 500 / 12 → 41.67 (11×) + 41.63 (1×)
    setupMockData({
      transaktionen: [{
        id: 't1',
        leistungsdatum: '2026-01-15',
        betrag_netto: 500,
        gruppe_id: null,
        untergruppe_id: null,
        beschreibung: null,
      }],
    })

    const resAsc = await GET(req('http://localhost/api/investitionen-abschreibungen?sortColumn=betrag&sortDirection=asc'))
    const bodyAsc = await resAsc.json()
    expect(bodyAsc.data[0].betrag).toBeCloseTo(41.63, 2)

    const resDesc = await GET(req('http://localhost/api/investitionen-abschreibungen?sortColumn=betrag&sortDirection=desc'))
    const bodyDesc = await resDesc.json()
    expect(bodyDesc.data[0].betrag).toBe(41.67)
  })

  // ─── 10. Paginierung ─────────────────────────────────────────────────────
  it('paginierung liefert 50 Einträge pro Seite (5 Transaktionen × 12 = 60 Raten)', async () => {
    const transaktionen = Array.from({ length: 5 }, (_, i) => ({
      id: `t${i}`,
      leistungsdatum: `2026-0${i + 1}-01`,
      betrag_netto: 1200,
      gruppe_id: null,
      untergruppe_id: null,
      beschreibung: `T${i}`,
    }))
    setupMockData({ transaktionen })

    const res1 = await GET(req('http://localhost/api/investitionen-abschreibungen?page=1'))
    const body1 = await res1.json()
    expect(body1.total).toBe(60)
    expect(body1.data).toHaveLength(50)

    const res2 = await GET(req('http://localhost/api/investitionen-abschreibungen?page=2'))
    const body2 = await res2.json()
    expect(body2.data).toHaveLength(10)
  })

  // ─── 11. Unauthenticated → 401 ───────────────────────────────────────────
  it('returns 401 when unauthenticated', async () => {
    const { requireAuth } = await import('@/lib/supabase-server')
    vi.mocked(requireAuth).mockResolvedValueOnce({
      user: null,
      supabase: null as never,
      error: new Response('Unauthorized', { status: 401 }),
    })
    const res = await GET(req('http://localhost/api/investitionen-abschreibungen'))
    expect(res.status).toBe(401)
  })

  // ─── 12. betrag_netto = 0 → keine Raten ──────────────────────────────────
  it('überspringt Transaktionen mit betrag_netto = 0', async () => {
    setupMockData({
      transaktionen: [
        {
          id: 't0',
          leistungsdatum: '2026-01-15',
          betrag_netto: 0,
          gruppe_id: null,
          untergruppe_id: null,
          beschreibung: 'null-Betrag',
        },
        {
          id: 't1',
          leistungsdatum: '2026-01-15',
          betrag_netto: 1200,
          gruppe_id: null,
          untergruppe_id: null,
          beschreibung: 'normaler Betrag',
        },
      ],
    })

    const res = await GET(req('http://localhost/api/investitionen-abschreibungen'))
    const body = await res.json()

    expect(body.total).toBe(12) // nur t1
    for (const rate of body.data) {
      expect(rate.beschreibung).toBe('normaler Betrag')
    }
  })

  // ─── 13. Keine "Produktinvestitionen"-Kategorie → leeres Ergebnis ─────────
  it('gibt leeres Ergebnis zurück wenn Produktinvestitionen-Kategorie fehlt', async () => {
    setupMockData({ katFound: false, transaktionen: [] })

    const res = await GET(req('http://localhost/api/investitionen-abschreibungen'))
    expect(res.status).toBe(200)
    const body = await res.json()

    expect(body.total).toBe(0)
    expect(body.totalBetrag).toBe(0)
    expect(body.data).toEqual([])
  })

  // ─── 14. Leere Daten → leeres Ergebnis ───────────────────────────────────
  it('gibt leeres Array zurück wenn keine Transaktionen existieren', async () => {
    setupMockData({ transaktionen: [] })

    const res = await GET(req('http://localhost/api/investitionen-abschreibungen'))
    const body = await res.json()

    expect(body.total).toBe(0)
    expect(body.totalBetrag).toBe(0)
    expect(body.data).toEqual([])
  })

  // ─── 15. DB-Fehler (Transaktionen) → 500 ─────────────────────────────────
  it('gibt 500 zurück wenn Transaktionen-Query fehlschlägt', async () => {
    setupMockData({ dbError: { message: 'DB down' } })

    const res = await GET(req('http://localhost/api/investitionen-abschreibungen'))
    expect(res.status).toBe(500)
    const body = await res.json()
    expect(body.error).toBe('DB down')
  })

  // ─── 16. DB-Fehler (kpi_categories) → 500 ────────────────────────────────
  it('gibt 500 zurück wenn kpi_categories-Query fehlschlägt', async () => {
    setupMockData({ katError: { message: 'Categories unavailable' } })

    const res = await GET(req('http://localhost/api/investitionen-abschreibungen'))
    expect(res.status).toBe(500)
    const body = await res.json()
    expect(body.error).toBe('Categories unavailable')
  })

  // ─── 17. Filter produkt_ids ───────────────────────────────────────────────
  it('filtert Raten nach produkt_ids', async () => {
    setupMockData({
      transaktionen: [
        {
          id: 't1',
          leistungsdatum: '2026-01-15',
          betrag_netto: 1200,
          gruppe_id: GRP_A,
          untergruppe_id: UGP_A,
          produkt_id: PRD_A,
          beschreibung: 'Produkt A',
        },
        {
          id: 't2',
          leistungsdatum: '2026-01-15',
          betrag_netto: 2400,
          gruppe_id: GRP_A,
          untergruppe_id: UGP_A,
          produkt_id: PRD_B,
          beschreibung: 'Produkt B',
        },
        {
          id: 't3',
          leistungsdatum: '2026-01-15',
          betrag_netto: 600,
          gruppe_id: GRP_B,
          untergruppe_id: null,
          produkt_id: null,
          beschreibung: 'Kein Produkt',
        },
      ],
    })

    const res = await GET(req(`http://localhost/api/investitionen-abschreibungen?produkt_ids=${PRD_A}`))
    const body = await res.json()

    expect(body.total).toBe(12) // nur t1
    for (const rate of body.data) {
      expect(rate.produkt_id).toBe(PRD_A)
      expect(rate.beschreibung).toBe('Produkt A')
    }
  })

  // ─── 18. produkt_id wird in jede Rate übertragen ─────────────────────────
  it('überträgt produkt_id korrekt in jede Rate', async () => {
    setupMockData({
      transaktionen: [{
        id: 't1',
        leistungsdatum: '2026-04-09',
        betrag_netto: 1200,
        gruppe_id: null,
        untergruppe_id: null,
        produkt_id: PRD_A,
        beschreibung: 'Mit Produkt',
      }],
    })

    const res = await GET(req('http://localhost/api/investitionen-abschreibungen'))
    const body = await res.json()

    expect(body.total).toBe(12)
    for (const rate of body.data) {
      expect(rate.produkt_id).toBe(PRD_A)
    }
  })
})
