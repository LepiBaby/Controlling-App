// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'
import { addWeeks, getISOWeek, getISOWeekYear, startOfISOWeek } from 'date-fns'
import { useLiquiditaetsauswertung } from './use-liquiditaetsauswertung'

const REF = new Date(2026, 5, 15) // Mon 2026-06-15
function fw(i: number) {
  const d = startOfISOWeek(addWeeks(REF, i))
  return { year: getISOWeekYear(d), week: getISOWeek(d) }
}

const ausgabenKats = [
  { id: 'v1', type: 'ausgaben_kosten', name: 'Vertrieb', level: 1, parent_id: null, sort_order: 0 },
  { id: 'v2', type: 'ausgaben_kosten', name: 'Versandkosten', level: 2, parent_id: 'v1', sort_order: 0 },
]
const einnahmenKats = [
  { id: 'pv', type: 'einnahmen', name: 'Produktverkäufe', level: 1, parent_id: null, sort_order: 0 },
]
const produkteKats = [{ id: 'p1', type: 'produkte', name: 'Produkt A', level: 1, parent_id: null, sort_order: 0 }]
const plattformenKats = [
  { id: 'pl1', type: 'sales_plattformen', name: 'Amazon', level: 1, parent_id: null, sort_order: 0 },
  { id: 'pl2', type: 'sales_plattformen', name: 'Otto', level: 1, parent_id: null, sort_order: 1 },
]

function mockFetch(url: string) {
  const z0 = fw(0)
  let body: unknown = {}
  if (url.includes('/api/grundeinstellungen')) body = { planungshorizont_wochen: 2, vergangenheitshorizont_wochen: 1 }
  else if (url.includes('type=ausgaben_kosten')) body = ausgabenKats
  else if (url.includes('type=einnahmen')) body = einnahmenKats
  else if (url.includes('type=produkte')) body = produkteKats
  else if (url.includes('type=sales_plattformen')) body = plattformenKats
  else if (url.includes('/api/umsatzausgaben-planung/berechnet')) body = { data: [{ kategorie_id: 'v2', produkt_id: 'p1', kw_year: z0.year, kw_number: z0.week, wert: 100 }] }
  // Only Amazon (pl1) has an auto value; Otto (pl2) has none → an Otto saved value is a manual override
  else if (url.includes('/api/einnahmen-planung/produktverkaeufe-berechnet')) body = [
    { kw_year: z0.year, kw_number: z0.week, sales_plattform_id: 'pl1', wert: 200 },
  ]
  else if (url.includes('/api/liquiditaetsauswertung/anfangsbestand')) body = { anfangsbestand: 0 }
  else if (url.includes('/api/planung-notizen')) body = { data: [] }
  else if (url.includes('ist-tatsaechlich')) body = { data: [] }
  // Realistic: einnahmen_planung holds the AUTO-SAVED produktverkäufe values
  // (per-platform stored with kategorie_id = platform id, + the pv total) — both
  // carry betrag_manuell and must be recognised as auto (grey), not manual (blue).
  else if (url.includes('/api/einnahmen-planung')) body = [
    { kategorie_id: 'pl1', kw_year: z0.year, kw_number: z0.week, betrag_manuell: 200 },  // auto present → grey
    { kategorie_id: 'pl2', kw_year: z0.year, kw_number: z0.week, betrag_manuell: 999 },  // no auto → manual override → blue
  ]
  else body = { data: [] } // all other planung GETs
  return Promise.resolve({ ok: true, json: () => Promise.resolve(body) } as Response)
}

describe('useLiquiditaetsauswertung — product/platform sub-rows', () => {
  beforeEach(() => vi.stubGlobal('fetch', vi.fn((u: string) => mockFetch(u))))
  afterEach(() => vi.unstubAllGlobals())

  it('renders product sub-rows under an Umsatzausgaben leaf', async () => {
    const { result } = renderHook(() => useLiquiditaetsauswertung(REF))
    await waitFor(() => expect(result.current.loading).toBe(false))
    const labels = result.current.rows.map(r => `${r.kind}:${r.label}`)
    expect(labels).toContain('sub:Produkt A')
  })

  it('renders platform sub-rows under Produktverkäufe', async () => {
    const { result } = renderHook(() => useLiquiditaetsauswertung(REF))
    await waitFor(() => expect(result.current.loading).toBe(false))
    const labels = result.current.rows.map(r => `${r.kind}:${r.label}`)
    expect(labels).toContain('sub:Amazon')
  })

  it('marks auto-calculated platform Soll as grey (not blue) and shows no dot on the aggregate', async () => {
    const { result } = renderHook(() => useLiquiditaetsauswertung(REF))
    await waitFor(() => expect(result.current.loading).toBe(false))
    const sollCol = result.current.columns.find(c => !c.isPast)!
    const amazon = result.current.rows.find(r => r.kind === 'sub' && r.label === 'Amazon')!
    const pv = result.current.rows.find(r => r.label === 'Produktverkäufe')!
    // Amazon: saved value equals auto → grey (auto-saved, NOT a manual override)
    expect(amazon.cells[sollCol.key].value).not.toBeNull()
    expect(amazon.cells[sollCol.key].indicator).toBe('gray')
    // Otto: saved value differs from auto → blue (genuine manual override)
    const otto = result.current.rows.find(r => r.kind === 'sub' && r.label === 'Otto')!
    expect(otto.cells[sollCol.key].indicator).toBe('blue')
    // aggregate Produktverkäufe row shows the sum but no indicator dot
    expect(pv.cells[sollCol.key].indicator).toBeNull()
  })

  it('shows platforms structurally even without any platform Soll data', async () => {
    // produktverkaeufe-berechnet returns [] → platform still appears (like the source page)
    vi.stubGlobal('fetch', vi.fn((u: string) => {
      if (u.includes('produktverkaeufe-berechnet')) return Promise.resolve({ ok: true, json: () => Promise.resolve([]) } as Response)
      return mockFetch(u)
    }))
    const { result } = renderHook(() => useLiquiditaetsauswertung(REF))
    await waitFor(() => expect(result.current.loading).toBe(false))
    const labels = result.current.rows.map(r => `${r.kind}:${r.label}`)
    expect(labels).toContain('sub:Amazon')
  })
})
