import { describe, it, expect, vi, beforeEach } from 'vitest'
import { GET } from './route'

const mockFrom = vi.fn()

vi.mock('@/lib/supabase-server', () => ({
  requireAuth: vi.fn().mockResolvedValue({
    user: { id: 'user-1' },
    supabase: { from: (table: string) => mockFrom(table) },
    error: null,
  }),
}))

function req(params: Record<string, string> = {}) {
  const qs = new URLSearchParams(params).toString()
  return new Request(`http://localhost/api/reporting/umsatzsteuer?${qs}`)
}

// ─── UUID-Fixtures ────────────────────────────────────────────────────────────

const KAT_UMSATZ_ID  = 'aaaa0000-0000-0000-0000-000000000001'
const GRP_UMSATZ_ID  = 'aaaa0000-0000-0000-0000-000000000002'
const UGR_UMSATZ_ID  = 'aaaa0000-0000-0000-0000-000000000003'
const KAT_KOSTEN_ID  = 'bbbb0000-0000-0000-0000-000000000001'
const GRP_KOSTEN_ID  = 'bbbb0000-0000-0000-0000-000000000002'
const PRODUKT_ID_A   = 'cccc0000-0000-0000-0000-000000000001'  // 19 % USt
const PRODUKT_ID_B   = 'cccc0000-0000-0000-0000-000000000002'  // 7 % USt
const PRODUKT_ID_C   = 'cccc0000-0000-0000-0000-000000000003'  // kein ust_satz

// ─── Mock-Builder ─────────────────────────────────────────────────────────────

function chain(result: { data: unknown; error: unknown }) {
  const obj: Record<string, unknown> = {}
  const methods = ['select', 'eq', 'in', 'not', 'is', 'gt', 'gte', 'lte', 'or', 'order', 'limit']
  for (const m of methods) obj[m] = () => obj
  ;(obj as { then: (fn: (r: unknown) => unknown) => unknown }).then =
    (fn: (r: unknown) => unknown) => Promise.resolve(result).then(fn)
  return obj
}

/**
 * 5 aufeinanderfolgende Mocks (Reihenfolge entspricht Promise.all in route.ts):
 *  1. kpi_categories (umsatz)
 *  2. kpi_categories (ausgaben_kosten)
 *  3. kpi_categories (produkte)
 *  4. umsatz_transaktionen
 *  5. ausgaben_kosten_transaktionen (vorsteuer)
 */
function setup(opts: {
  umsatzCats?:   unknown[]
  ausgabenCats?: unknown[]
  produkteCats?: unknown[]
  umsatz?:       unknown[]
  vorsteuer?:    unknown[]
}) {
  mockFrom
    .mockReturnValueOnce(chain({ data: opts.umsatzCats   ?? [], error: null }))
    .mockReturnValueOnce(chain({ data: opts.ausgabenCats ?? [], error: null }))
    .mockReturnValueOnce(chain({ data: opts.produkteCats ?? [], error: null }))
    .mockReturnValueOnce(chain({ data: opts.umsatz       ?? [], error: null }))
    .mockReturnValueOnce(chain({ data: opts.vorsteuer    ?? [], error: null }))
}

const BASE_PARAMS = { von: '2026-01', bis: '2026-03', granularitaet: 'monat' }

beforeEach(() => mockFrom.mockReset())

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('GET /api/reporting/umsatzsteuer', () => {

  it('gibt 400 zurück wenn von fehlt', async () => {
    const res = await GET(req({ bis: '2026-03', granularitaet: 'monat' }))
    expect(res.status).toBe(400)
  })

  it('gibt 400 zurück wenn bis fehlt', async () => {
    const res = await GET(req({ von: '2026-01', granularitaet: 'monat' }))
    expect(res.status).toBe(400)
  })

  it('gibt 400 zurück wenn von > bis', async () => {
    setup({})
    const res = await GET(req({ von: '2026-06', bis: '2026-01', granularitaet: 'monat' }))
    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error).toContain('von muss <= bis sein')
  })

  it('gibt 400 zurück bei ungültigem Datumsformat', async () => {
    const res = await GET(req({ von: '26-01', bis: '2026-03', granularitaet: 'monat' }))
    expect(res.status).toBe(400)
  })

  it('gibt leere Struktur zurück wenn keine Kategorien vorhanden', async () => {
    setup({})
    const res = await GET(req(BASE_PARAMS))
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.perioden).toEqual(['2026-01', '2026-02', '2026-03'])
    expect(body.abzufuehrendeUst.kategorien).toEqual([])
    expect(body.abziehbareVorsteuer.kategorien).toEqual([])
    expect(body.faelligeUst).toEqual({ '2026-01': 0, '2026-02': 0, '2026-03': 0 })
  })

  it('berechnet USt korrekt für ein Produkt mit 19 %', async () => {
    setup({
      umsatzCats:   [{ id: KAT_UMSATZ_ID, name: 'Online-Shop', level: 1, parent_id: null, sort_order: 1, ist_abzugsposten: false }],
      ausgabenCats: [],
      produkteCats: [{ id: PRODUKT_ID_A, name: 'Produkt A', ust_satz: 19 }],
      umsatz: [
        { leistungsdatum: '2026-01-15', betrag: 119, kategorie_id: KAT_UMSATZ_ID, gruppe_id: null, untergruppe_id: null, produkt_id: PRODUKT_ID_A },
      ],
      vorsteuer: [],
    })
    const res = await GET(req(BASE_PARAMS))
    expect(res.status).toBe(200)
    const body = await res.json()
    // USt = 119 × 19 / 100 = 22.61
    expect(body.abzufuehrendeUst.kategorien[0].values['2026-01']).toBe(22.61)
    expect(body.abzufuehrendeUst.summe['2026-01']).toBe(22.61)
    expect(body.faelligeUst['2026-01']).toBe(22.61)
  })

  it('berechnet USt korrekt für Produkt mit 7 %', async () => {
    setup({
      umsatzCats:   [{ id: KAT_UMSATZ_ID, name: 'Bücher', level: 1, parent_id: null, sort_order: 1, ist_abzugsposten: false }],
      ausgabenCats: [],
      produkteCats: [{ id: PRODUKT_ID_B, name: 'Produkt B', ust_satz: 7 }],
      umsatz: [
        { leistungsdatum: '2026-01-10', betrag: 107, kategorie_id: KAT_UMSATZ_ID, gruppe_id: null, untergruppe_id: null, produkt_id: PRODUKT_ID_B },
      ],
      vorsteuer: [],
    })
    const res = await GET(req(BASE_PARAMS))
    const body = await res.json()
    // USt = 107 × 7 / 100 = 7.49
    expect(body.abzufuehrendeUst.kategorien[0].values['2026-01']).toBe(7.49)
  })

  it('zieht Abzugsposten (ist_abzugsposten=true) von der USt-Basis ab', async () => {
    // Kategorie ist als Abzugsposten markiert (z.B. Retouren)
    setup({
      umsatzCats: [
        { id: KAT_UMSATZ_ID, name: 'Retouren', level: 1, parent_id: null, sort_order: 1, ist_abzugsposten: true },
      ],
      ausgabenCats: [],
      produkteCats: [{ id: PRODUKT_ID_A, name: 'Produkt A', ust_satz: 19 }],
      umsatz: [
        // Retour → betrag wird negiert → USt ist negativ
        { leistungsdatum: '2026-01-20', betrag: 119, kategorie_id: KAT_UMSATZ_ID, gruppe_id: null, untergruppe_id: null, produkt_id: PRODUKT_ID_A },
      ],
      vorsteuer: [],
    })
    const res = await GET(req(BASE_PARAMS))
    const body = await res.json()
    expect(body.abzufuehrendeUst.kategorien[0].values['2026-01']).toBe(-22.61)
  })

  it('überspringt Transaktionen ohne produkt_id', async () => {
    setup({
      umsatzCats:   [{ id: KAT_UMSATZ_ID, name: 'Shop', level: 1, parent_id: null, sort_order: 1, ist_abzugsposten: false }],
      ausgabenCats: [],
      produkteCats: [{ id: PRODUKT_ID_A, name: 'A', ust_satz: 19 }],
      umsatz: [
        { leistungsdatum: '2026-01-05', betrag: 200, kategorie_id: KAT_UMSATZ_ID, gruppe_id: null, untergruppe_id: null, produkt_id: null },
      ],
      vorsteuer: [],
    })
    const res = await GET(req(BASE_PARAMS))
    const body = await res.json()
    expect(body.abzufuehrendeUst.summe['2026-01']).toBe(0)
  })

  it('überspringt Produkte mit ust_satz = null', async () => {
    setup({
      umsatzCats:   [{ id: KAT_UMSATZ_ID, name: 'Shop', level: 1, parent_id: null, sort_order: 1, ist_abzugsposten: false }],
      ausgabenCats: [],
      produkteCats: [{ id: PRODUKT_ID_C, name: 'Produkt C', ust_satz: null }],
      umsatz: [
        { leistungsdatum: '2026-01-05', betrag: 100, kategorie_id: KAT_UMSATZ_ID, gruppe_id: null, untergruppe_id: null, produkt_id: PRODUKT_ID_C },
      ],
      vorsteuer: [],
    })
    const res = await GET(req(BASE_PARAMS))
    const body = await res.json()
    expect(body.abzufuehrendeUst.summe['2026-01']).toBe(0)
  })

  it('aggregiert Vorsteuer korrekt aus ausgaben_kosten_transaktionen', async () => {
    setup({
      umsatzCats:   [],
      ausgabenCats: [{ id: KAT_KOSTEN_ID, name: 'Wareneingang', level: 1, parent_id: null, sort_order: 1 }],
      produkteCats: [],
      umsatz:       [],
      vorsteuer: [
        { leistungsdatum: '2026-01-10', ust_betrag: 114, kategorie_id: KAT_KOSTEN_ID, gruppe_id: null, untergruppe_id: null },
        { leistungsdatum: '2026-01-20', ust_betrag:  57, kategorie_id: KAT_KOSTEN_ID, gruppe_id: null, untergruppe_id: null },
      ],
    })
    const res = await GET(req(BASE_PARAMS))
    const body = await res.json()
    expect(body.abziehbareVorsteuer.kategorien[0].values['2026-01']).toBe(171)
    expect(body.abziehbareVorsteuer.summe['2026-01']).toBe(171)
  })

  it('berechnet faelligeUst korrekt als USt minus Vorsteuer', async () => {
    setup({
      umsatzCats:   [{ id: KAT_UMSATZ_ID, name: 'Shop', level: 1, parent_id: null, sort_order: 1, ist_abzugsposten: false }],
      ausgabenCats: [{ id: KAT_KOSTEN_ID, name: 'Kosten', level: 1, parent_id: null, sort_order: 1 }],
      produkteCats: [{ id: PRODUKT_ID_A, name: 'A', ust_satz: 19 }],
      umsatz: [
        { leistungsdatum: '2026-01-15', betrag: 119, kategorie_id: KAT_UMSATZ_ID, gruppe_id: null, untergruppe_id: null, produkt_id: PRODUKT_ID_A },
      ],
      vorsteuer: [
        { leistungsdatum: '2026-01-10', ust_betrag: 9.5, kategorie_id: KAT_KOSTEN_ID, gruppe_id: null, untergruppe_id: null },
      ],
    })
    const res = await GET(req(BASE_PARAMS))
    const body = await res.json()
    // USt = 119 × 19 / 100 = 22.61, Vorsteuer = 9.50, fällige USt = 13.11
    expect(body.abzufuehrendeUst.summe['2026-01']).toBe(22.61)
    expect(body.abziehbareVorsteuer.summe['2026-01']).toBe(9.5)
    expect(body.faelligeUst['2026-01']).toBe(13.11)
  })

  it('faelligeUst kann negativ sein (Vorsteuer-Überhang)', async () => {
    setup({
      umsatzCats:   [],
      ausgabenCats: [{ id: KAT_KOSTEN_ID, name: 'Kosten', level: 1, parent_id: null, sort_order: 1 }],
      produkteCats: [],
      umsatz:       [],
      vorsteuer: [
        { leistungsdatum: '2026-01-10', ust_betrag: 500, kategorie_id: KAT_KOSTEN_ID, gruppe_id: null, untergruppe_id: null },
      ],
    })
    const res = await GET(req(BASE_PARAMS))
    const body = await res.json()
    expect(body.faelligeUst['2026-01']).toBe(-500)
  })

  it('aggregiert USt auf Gruppen- und Untergruppen-Ebene', async () => {
    setup({
      umsatzCats: [
        { id: KAT_UMSATZ_ID, name: 'Shop',    level: 1, parent_id: null,         sort_order: 1, ist_abzugsposten: false },
        { id: GRP_UMSATZ_ID, name: 'Online',   level: 2, parent_id: KAT_UMSATZ_ID, sort_order: 1, ist_abzugsposten: false },
        { id: UGR_UMSATZ_ID, name: 'Sommer',   level: 3, parent_id: GRP_UMSATZ_ID, sort_order: 1, ist_abzugsposten: false },
      ],
      ausgabenCats: [],
      produkteCats: [{ id: PRODUKT_ID_A, name: 'A', ust_satz: 19 }],
      umsatz: [
        { leistungsdatum: '2026-01-15', betrag: 238, kategorie_id: KAT_UMSATZ_ID, gruppe_id: GRP_UMSATZ_ID, untergruppe_id: UGR_UMSATZ_ID, produkt_id: PRODUKT_ID_A },
      ],
      vorsteuer: [],
    })
    const res = await GET(req(BASE_PARAMS))
    const body = await res.json()
    const kat = body.abzufuehrendeUst.kategorien[0]
    // USt = 238 × 19 / 100 = 45.22
    expect(kat.values['2026-01']).toBe(45.22)
    const grp = kat.gruppen[0]
    expect(grp.values['2026-01']).toBe(45.22)
    const ugr = grp.untergruppen[0]
    expect(ugr.values['2026-01']).toBe(45.22)
    // Produkt-Drill-Down auf Untergruppen-Ebene
    expect(ugr.produkte[0].id).toBe(PRODUKT_ID_A)
    expect(ugr.produkte[0].ust_satz).toBe(19)
    expect(ugr.produkte[0].values['2026-01']).toBe(45.22)
  })

  it('aggregiert Vorsteuer auf Gruppen-Ebene', async () => {
    setup({
      umsatzCats:   [],
      ausgabenCats: [
        { id: KAT_KOSTEN_ID, name: 'Kosten', level: 1, parent_id: null,         sort_order: 1 },
        { id: GRP_KOSTEN_ID, name: 'Gruppe', level: 2, parent_id: KAT_KOSTEN_ID, sort_order: 1 },
      ],
      produkteCats: [],
      umsatz:       [],
      vorsteuer: [
        { leistungsdatum: '2026-02-10', ust_betrag: 57, kategorie_id: KAT_KOSTEN_ID, gruppe_id: GRP_KOSTEN_ID, untergruppe_id: null },
      ],
    })
    const res = await GET(req(BASE_PARAMS))
    const body = await res.json()
    const kat = body.abziehbareVorsteuer.kategorien[0]
    expect(kat.values['2026-02']).toBe(57)
    expect(kat.gruppen[0].values['2026-02']).toBe(57)
  })

  it('zeigt korrekte Perioden für Quartal-Granularität', async () => {
    setup({})
    const res = await GET(req({ von: '2026-01', bis: '2026-06', granularitaet: 'quartal' }))
    const body = await res.json()
    expect(body.perioden).toEqual(['2026-Q1', '2026-Q2'])
  })

  it('zeigt korrekte Perioden für Jahr-Granularität', async () => {
    setup({})
    const res = await GET(req({ von: '2025-06', bis: '2026-03', granularitaet: 'jahr' }))
    const body = await res.json()
    expect(body.perioden).toEqual(['2025', '2026'])
  })

  it('aggregiert mehrere Produkte unterschiedlicher Steuersätze in einer Kategorie', async () => {
    setup({
      umsatzCats:   [{ id: KAT_UMSATZ_ID, name: 'Shop', level: 1, parent_id: null, sort_order: 1, ist_abzugsposten: false }],
      ausgabenCats: [],
      produkteCats: [
        { id: PRODUKT_ID_A, name: 'A', ust_satz: 19 },
        { id: PRODUKT_ID_B, name: 'B', ust_satz: 7  },
      ],
      umsatz: [
        { leistungsdatum: '2026-01-10', betrag: 119, kategorie_id: KAT_UMSATZ_ID, gruppe_id: null, untergruppe_id: null, produkt_id: PRODUKT_ID_A },
        { leistungsdatum: '2026-01-15', betrag: 107, kategorie_id: KAT_UMSATZ_ID, gruppe_id: null, untergruppe_id: null, produkt_id: PRODUKT_ID_B },
      ],
      vorsteuer: [],
    })
    const res = await GET(req(BASE_PARAMS))
    const body = await res.json()
    // USt A = 119 × 19/100 = 22.61, USt B = 107 × 7/100 = 7.49 → gesamt = 30.10
    expect(body.abzufuehrendeUst.summe['2026-01']).toBe(30.1)
    const kat = body.abzufuehrendeUst.kategorien[0]
    expect(kat.produkte).toHaveLength(2)
  })

  it('gibt 500 zurück wenn eine DB-Abfrage fehlschlägt', async () => {
    mockFrom
      .mockReturnValueOnce(chain({ data: null, error: { message: 'DB connection error' } }))
      .mockReturnValueOnce(chain({ data: [], error: null }))
      .mockReturnValueOnce(chain({ data: [], error: null }))
      .mockReturnValueOnce(chain({ data: [], error: null }))
      .mockReturnValueOnce(chain({ data: [], error: null }))
    const res = await GET(req(BASE_PARAMS))
    expect(res.status).toBe(500)
    const body = await res.json()
    expect(body.error).toBe('DB connection error')
  })

})
