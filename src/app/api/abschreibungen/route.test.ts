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

const KAT_A = '111e4567-e89b-12d3-a456-426614174000'
const KAT_B = '222e4567-e89b-12d3-a456-426614174000'
const GRP_A = '333e4567-e89b-12d3-a456-426614174000'
const GRP_B = '444e4567-e89b-12d3-a456-426614174000'
const UGP_A = '555e4567-e89b-12d3-a456-426614174000'
const UGP_B = '666e4567-e89b-12d3-a456-426614174000'

/**
 * Thenable, chainable Mock des Supabase-Query-Builders.
 * Alle Methoden returnen die Kette; await löst mit { data, error } auf.
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
}) {
  mockFrom.mockImplementation((table: string) => {
    if (table === 'ausgaben_kosten_transaktionen') {
      return makeChain({ data: opts.transaktionen ?? [], error: opts.dbError ?? null })
    }
    return makeChain({ data: [], error: null })
  })
}

describe('GET /api/abschreibungen', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  // ─── 1. Berechnungslogik 3_jahre: Anzahl, Beträge, Datumsfolge ─────────────
  it('berechnet für 3_jahre 36 Raten mit korrektem Betrag und Datumsfolge', async () => {
    // Beispiel aus Feature-Spec:
    // 09.04.2026, 587.39 € / 36 = 16.3163... → gerundet 16.32 €
    // Letzte Rate: 587.39 - 16.32 * 35 = 587.39 - 571.20 = 16.19 €
    setupMockData({
      transaktionen: [{
        id: 't1',
        leistungsdatum: '2026-04-09',
        betrag_netto: 587.39,
        kategorie_id: KAT_A,
        beschreibung: 'Laptop',
        abschreibung: '3_jahre',
      }],
    })

    const res = await GET(req('http://localhost/api/abschreibungen?page=1'))
    expect(res.status).toBe(200)
    const body = await res.json()

    // Gesamt 36 Raten, 50er-Seite → alle auf Seite 1
    expect(body.total).toBe(36)
    expect(body.data).toHaveLength(36)

    // Erste Rate: 09.04.2026
    expect(body.data[0].datum).toBe('2026-04-09')
    expect(body.data[0].ursprung_datum).toBe('2026-04-09')
    expect(body.data[0].betrag).toBe(16.32)
    expect(body.data[0].kategorie_id).toBe(KAT_A)
    expect(body.data[0].beschreibung).toBe('Laptop')

    // Rate 2: 09.05.2026
    expect(body.data[1].datum).toBe('2026-05-09')
    expect(body.data[1].betrag).toBe(16.32)

    // Rate 13 (Index 12): 09.04.2027 (ein Jahr später)
    expect(body.data[12].datum).toBe('2027-04-09')

    // Rate 36 (Index 35): 09.03.2029
    expect(body.data[35].datum).toBe('2029-03-09')
    // Letzte Rate = Rest: 587.39 - 16.32 * 35 = 16.19
    expect(body.data[35].betrag).toBeCloseTo(16.19, 2)

    // totalBetrag = genau betrag_netto
    expect(body.totalBetrag).toBeCloseTo(587.39, 2)
  })

  // ─── 2. Monatsende-Clamp: 31.01 → 28.02 (oder 29.02) ───────────────────────
  it('clampt den Tag bei kürzeren Folgemonaten (31.01 → 28.02.2025)', async () => {
    setupMockData({
      transaktionen: [{
        id: 't1',
        leistungsdatum: '2025-01-31',
        betrag_netto: 3600,
        kategorie_id: KAT_A,
        beschreibung: null,
        abschreibung: '3_jahre', // 36 Monate
      }],
    })

    const res = await GET(req('http://localhost/api/abschreibungen'))
    const body = await res.json()

    // Rate 1: 31.01.2025
    expect(body.data[0].datum).toBe('2025-01-31')
    // Rate 2: 28.02.2025 (kein 31.02.)
    expect(body.data[1].datum).toBe('2025-02-28')
    // Rate 3: 31.03.2025 (März hat 31 Tage → Tag nicht geclampt)
    expect(body.data[2].datum).toBe('2025-03-31')
    // Rate 4: 30.04.2025 (April hat nur 30 Tage)
    expect(body.data[3].datum).toBe('2025-04-30')
  })

  it('clampt den Tag auf 29.02 in Schaltjahren', async () => {
    setupMockData({
      transaktionen: [{
        id: 't1',
        leistungsdatum: '2024-01-31', // 2024 ist Schaltjahr
        betrag_netto: 1200,
        kategorie_id: KAT_A,
        beschreibung: null,
        abschreibung: '3_jahre',
      }],
    })

    const res = await GET(req('http://localhost/api/abschreibungen'))
    const body = await res.json()

    // Rate 2: 29.02.2024 (Schaltjahr)
    expect(body.data[1].datum).toBe('2024-02-29')
  })

  // ─── 3. Letzte Rate erhält Rundungsrest (Summe = betrag_netto) ─────────────
  it('letzte Rate erhält Rundungsrest — Summe aller Raten = betrag_netto', async () => {
    setupMockData({
      transaktionen: [{
        id: 't1',
        leistungsdatum: '2025-01-15',
        betrag_netto: 1000, // 1000 / 36 = 27.777... → 27.78
        kategorie_id: KAT_A,
        beschreibung: null,
        abschreibung: '3_jahre',
      }],
    })

    const res = await GET(req('http://localhost/api/abschreibungen'))
    const body = await res.json()

    // baseRate = round(1000/36 * 100)/100 = 27.78
    // letzte = 1000 - 27.78 * 35 = 1000 - 972.30 = 27.70
    expect(body.data[0].betrag).toBe(27.78)
    expect(body.data[34].betrag).toBe(27.78)
    expect(body.data[35].betrag).toBeCloseTo(27.70, 2)

    // Gesamtsumme exakt
    const summe = body.data.reduce((acc: number, r: { betrag: number }) => acc + r.betrag, 0)
    expect(Math.round(summe * 100) / 100).toBe(1000)
    expect(body.totalBetrag).toBe(1000)
  })

  // ─── 4. Filter von/bis ────────────────────────────────────────────────────
  it('filtert Raten nach von/bis (auf Ratendatum)', async () => {
    setupMockData({
      transaktionen: [{
        id: 't1',
        leistungsdatum: '2025-01-15',
        betrag_netto: 3600,
        kategorie_id: KAT_A,
        beschreibung: null,
        abschreibung: '3_jahre', // 36 Raten → 01/2025 bis 12/2027
      }],
    })

    // Nur Raten in 2026 (12 Stück)
    const res = await GET(req('http://localhost/api/abschreibungen?von=2026-01-01&bis=2026-12-31&page=1'))
    const body = await res.json()

    expect(body.total).toBe(12)
    expect(body.data).toHaveLength(12)
    // Alle Raten im Jahr 2026
    for (const rate of body.data) {
      expect(rate.datum >= '2026-01-01').toBe(true)
      expect(rate.datum <= '2026-12-31').toBe(true)
    }
  })

  // ─── 5. Filter kategorie_ids ──────────────────────────────────────────────
  it('filtert Raten nach kategorie_ids', async () => {
    setupMockData({
      transaktionen: [
        {
          id: 't1',
          leistungsdatum: '2025-01-15',
          betrag_netto: 3600,
          kategorie_id: KAT_A,
          beschreibung: null,
          abschreibung: '3_jahre',
        },
        {
          id: 't2',
          leistungsdatum: '2025-01-15',
          betrag_netto: 6000,
          kategorie_id: KAT_B,
          beschreibung: null,
          abschreibung: '5_jahre',
        },
      ],
    })

    const res = await GET(req(`http://localhost/api/abschreibungen?kategorie_ids=${KAT_A}`))
    const body = await res.json()

    expect(body.total).toBe(36) // Nur t1 (3_jahre)
    for (const rate of body.data) {
      expect(rate.kategorie_id).toBe(KAT_A)
    }
  })

  // ─── 6. Filter gruppe_ids ────────────────────────────────────────────────
  it('filtert Raten nach gruppe_ids', async () => {
    setupMockData({
      transaktionen: [
        {
          id: 't1',
          leistungsdatum: '2025-01-15',
          betrag_netto: 3600,
          kategorie_id: KAT_A,
          gruppe_id: GRP_A,
          untergruppe_id: null,
          beschreibung: 'Gruppe A',
          abschreibung: '3_jahre',
        },
        {
          id: 't2',
          leistungsdatum: '2025-01-15',
          betrag_netto: 6000,
          kategorie_id: KAT_A,
          gruppe_id: GRP_B,
          untergruppe_id: null,
          beschreibung: 'Gruppe B',
          abschreibung: '5_jahre',
        },
      ],
    })

    const res = await GET(req(`http://localhost/api/abschreibungen?gruppe_ids=${GRP_A}`))
    const body = await res.json()

    expect(body.total).toBe(36) // Nur t1 (3_jahre)
    for (const rate of body.data) {
      expect(rate.gruppe_id).toBe(GRP_A)
      expect(rate.beschreibung).toBe('Gruppe A')
    }
  })

  // ─── 7. Filter untergruppe_ids ────────────────────────────────────────────
  it('filtert Raten nach untergruppe_ids', async () => {
    setupMockData({
      transaktionen: [
        {
          id: 't1',
          leistungsdatum: '2025-01-15',
          betrag_netto: 3600,
          kategorie_id: KAT_A,
          gruppe_id: GRP_A,
          untergruppe_id: UGP_A,
          beschreibung: 'Untergruppe A',
          abschreibung: '3_jahre',
        },
        {
          id: 't2',
          leistungsdatum: '2025-01-15',
          betrag_netto: 7200,
          kategorie_id: KAT_A,
          gruppe_id: GRP_A,
          untergruppe_id: UGP_B,
          beschreibung: 'Untergruppe B',
          abschreibung: '5_jahre',
        },
      ],
    })

    const res = await GET(req(`http://localhost/api/abschreibungen?untergruppe_ids=${UGP_B}`))
    const body = await res.json()

    expect(body.total).toBe(60) // Nur t2 (5_jahre)
    for (const rate of body.data) {
      expect(rate.untergruppe_id).toBe(UGP_B)
      expect(rate.beschreibung).toBe('Untergruppe B')
    }
  })

  // ─── 8. Kaskaden-Filter kategorie + gruppe kombiniert ─────────────────────
  it('kombiniert kategorie_ids und gruppe_ids als AND-Filter', async () => {
    setupMockData({
      transaktionen: [
        {
          id: 't1',
          leistungsdatum: '2025-01-15',
          betrag_netto: 3600,
          kategorie_id: KAT_A,
          gruppe_id: GRP_A,
          untergruppe_id: UGP_A,
          beschreibung: 'Match',
          abschreibung: '3_jahre',
        },
        {
          id: 't2',
          leistungsdatum: '2025-01-15',
          betrag_netto: 6000,
          kategorie_id: KAT_A,
          gruppe_id: GRP_B,
          untergruppe_id: null,
          beschreibung: 'Andere Gruppe',
          abschreibung: '3_jahre',
        },
        {
          id: 't3',
          leistungsdatum: '2025-01-15',
          betrag_netto: 2400,
          kategorie_id: KAT_B,
          gruppe_id: GRP_A,
          untergruppe_id: null,
          beschreibung: 'Andere Kategorie',
          abschreibung: '3_jahre',
        },
      ],
    })

    const res = await GET(req(
      `http://localhost/api/abschreibungen?kategorie_ids=${KAT_A}&gruppe_ids=${GRP_A}`
    ))
    const body = await res.json()

    // Nur t1 trifft beide Filter
    expect(body.total).toBe(36)
    for (const rate of body.data) {
      expect(rate.beschreibung).toBe('Match')
    }
  })

  // ─── 9. Sortierung datum asc/desc ─────────────────────────────────────────
  it('sortiert nach datum aufsteigend (Standard)', async () => {
    setupMockData({
      transaktionen: [{
        id: 't1',
        leistungsdatum: '2025-06-15',
        betrag_netto: 3600,
        kategorie_id: KAT_A,
        beschreibung: null,
        abschreibung: '3_jahre',
      }],
    })

    const res = await GET(req('http://localhost/api/abschreibungen?sortColumn=datum&sortDirection=asc'))
    const body = await res.json()

    for (let i = 1; i < body.data.length; i++) {
      expect(body.data[i].datum >= body.data[i - 1].datum).toBe(true)
    }
  })

  it('sortiert nach datum absteigend', async () => {
    setupMockData({
      transaktionen: [{
        id: 't1',
        leistungsdatum: '2025-01-15',
        betrag_netto: 3600,
        kategorie_id: KAT_A,
        beschreibung: null,
        abschreibung: '3_jahre',
      }],
    })

    const res = await GET(req('http://localhost/api/abschreibungen?sortColumn=datum&sortDirection=desc'))
    const body = await res.json()

    // Erste Seite enthält die spätesten Daten
    expect(body.data[0].datum).toBe('2027-12-15')
    for (let i = 1; i < body.data.length; i++) {
      expect(body.data[i].datum <= body.data[i - 1].datum).toBe(true)
    }
  })

  // ─── 7. Sortierung betrag ─────────────────────────────────────────────────
  it('sortiert nach betrag aufsteigend / absteigend', async () => {
    // 1000 / 36 → 27.78 (35×) + 27.70 (1×)
    setupMockData({
      transaktionen: [{
        id: 't1',
        leistungsdatum: '2025-01-15',
        betrag_netto: 1000,
        kategorie_id: KAT_A,
        beschreibung: null,
        abschreibung: '3_jahre',
      }],
    })

    const resAsc = await GET(req('http://localhost/api/abschreibungen?sortColumn=betrag&sortDirection=asc'))
    const bodyAsc = await resAsc.json()
    // Kleinster Betrag zuerst (letzte Rate = 27.70)
    expect(bodyAsc.data[0].betrag).toBeCloseTo(27.70, 2)

    const resDesc = await GET(req('http://localhost/api/abschreibungen?sortColumn=betrag&sortDirection=desc'))
    const bodyDesc = await resDesc.json()
    // Größter Betrag zuerst (27.78)
    expect(bodyDesc.data[0].betrag).toBe(27.78)
  })

  // ─── 8. Paginierung ───────────────────────────────────────────────────────
  it('paginierung liefert 50 Einträge pro Seite', async () => {
    // 120 Raten aus einer 10_jahre-Transaktion
    setupMockData({
      transaktionen: [{
        id: 't1',
        leistungsdatum: '2025-01-15',
        betrag_netto: 12000,
        kategorie_id: KAT_A,
        beschreibung: null,
        abschreibung: '10_jahre', // 120 Raten
      }],
    })

    const res1 = await GET(req('http://localhost/api/abschreibungen?page=1'))
    const body1 = await res1.json()
    expect(body1.total).toBe(120)
    expect(body1.data).toHaveLength(50)

    const res2 = await GET(req('http://localhost/api/abschreibungen?page=2'))
    const body2 = await res2.json()
    expect(body2.data).toHaveLength(50)

    const res3 = await GET(req('http://localhost/api/abschreibungen?page=3'))
    const body3 = await res3.json()
    expect(body3.data).toHaveLength(20)

    // Keine Überschneidung zwischen den Seiten
    const daten1 = new Set(body1.data.map((r: { datum: string }) => r.datum))
    for (const r of body2.data) {
      expect(daten1.has(r.datum)).toBe(false)
    }
  })

  // ─── 9. Unauthenticated → 401 ─────────────────────────────────────────────
  it('returns 401 when unauthenticated', async () => {
    const { requireAuth } = await import('@/lib/supabase-server')
    vi.mocked(requireAuth).mockResolvedValueOnce({
      user: null,
      supabase: null as never,
      error: new Response('Unauthorized', { status: 401 }),
    })
    const res = await GET(req('http://localhost/api/abschreibungen'))
    expect(res.status).toBe(401)
  })

  // ─── 10. betrag_netto = 0 → keine Raten ───────────────────────────────────
  it('überspringt Transaktionen mit betrag_netto = 0 (keine Raten)', async () => {
    setupMockData({
      transaktionen: [
        {
          id: 't0',
          leistungsdatum: '2025-01-15',
          betrag_netto: 0,
          kategorie_id: KAT_A,
          beschreibung: 'null-Betrag',
          abschreibung: '3_jahre',
        },
        {
          id: 't1',
          leistungsdatum: '2025-01-15',
          betrag_netto: 1200,
          kategorie_id: KAT_A,
          beschreibung: 'normaler Betrag',
          abschreibung: '3_jahre',
        },
      ],
    })

    const res = await GET(req('http://localhost/api/abschreibungen'))
    const body = await res.json()

    // Nur Raten aus t1 (36 Stück), nicht aus t0
    expect(body.total).toBe(36)
    for (const rate of body.data) {
      expect(rate.beschreibung).toBe('normaler Betrag')
    }
  })

  // ─── Weitere: leere Daten → leere Antwort ─────────────────────────────────
  it('gibt leeres Array und 0 zurück, wenn keine Transaktionen existieren', async () => {
    setupMockData({ transaktionen: [] })

    const res = await GET(req('http://localhost/api/abschreibungen'))
    const body = await res.json()

    expect(body.total).toBe(0)
    expect(body.totalBetrag).toBe(0)
    expect(body.data).toEqual([])
  })

  // ─── Weitere: DB-Fehler → 500 ─────────────────────────────────────────────
  it('gibt 500 zurück, wenn DB-Query fehlschlägt', async () => {
    setupMockData({ dbError: { message: 'DB down' } })

    const res = await GET(req('http://localhost/api/abschreibungen'))
    expect(res.status).toBe(500)
    const body = await res.json()
    expect(body.error).toBe('DB down')
  })

  // ─── Weitere: 5_jahre → 60, 7_jahre → 84, 10_jahre → 120 ──────────────────
  it('berechnet korrekte Anzahl für 5_jahre (60 Raten)', async () => {
    setupMockData({
      transaktionen: [{
        id: 't1',
        leistungsdatum: '2025-01-01',
        betrag_netto: 6000,
        kategorie_id: KAT_A,
        beschreibung: null,
        abschreibung: '5_jahre',
      }],
    })

    const res = await GET(req('http://localhost/api/abschreibungen?page=1'))
    const body = await res.json()
    expect(body.total).toBe(60)
  })

  it('berechnet korrekte Anzahl für 7_jahre (84 Raten)', async () => {
    setupMockData({
      transaktionen: [{
        id: 't1',
        leistungsdatum: '2025-01-01',
        betrag_netto: 8400,
        kategorie_id: KAT_A,
        beschreibung: null,
        abschreibung: '7_jahre',
      }],
    })

    const res = await GET(req('http://localhost/api/abschreibungen'))
    const body = await res.json()
    expect(body.total).toBe(84)
  })
})
