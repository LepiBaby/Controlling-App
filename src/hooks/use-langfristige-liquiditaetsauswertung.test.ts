// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'
import { useLangfristigeLiquiditaetsauswertung } from './use-langfristige-liquiditaetsauswertung'

// ─── Testdaten ─────────────────────────────────────────────────────────────────

const grund = { startmonat_monat: 1, startmonat_jahr: 2026, startkontostand: 1000, planungshorizont_monate: 2 }

const einnahmenKats = [
  { id: 'pv', type: 'einnahmen', name: 'Produktverkäufe', level: 1, parent_id: null, sort_order: 0 },
  { id: 'e1', type: 'einnahmen', name: 'Sonstige Einnahmen', level: 1, parent_id: null, sort_order: 1 },
  { id: 'e2', type: 'einnahmen', name: 'Spenden', level: 1, parent_id: null, sort_order: 2 }, // ohne Daten
]
const ausgabenKats = [
  { id: 'vtr', type: 'ausgaben_kosten', name: 'Vertrieb', level: 1, parent_id: null, sort_order: 1 },
  { id: 'vtr-l2', type: 'ausgaben_kosten', name: 'Versand', level: 2, parent_id: 'vtr', sort_order: 0 },
  { id: 'mkt', type: 'ausgaben_kosten', name: 'Marketing', level: 1, parent_id: null, sort_order: 2 },
  { id: 'op', type: 'ausgaben_kosten', name: 'Operativ', level: 1, parent_id: null, sort_order: 3 },
  { id: 'op-l2', type: 'ausgaben_kosten', name: 'Miete', level: 2, parent_id: 'op', sort_order: 0 },
  { id: 'fin', type: 'ausgaben_kosten', name: 'Finanzierung', level: 1, parent_id: null, sort_order: 4 },
  { id: 'fin-l2', type: 'ausgaben_kosten', name: 'Zinsen', level: 2, parent_id: 'fin', sort_order: 0 },
  { id: 'st', type: 'ausgaben_kosten', name: 'Steuern', level: 1, parent_id: null, sort_order: 5 },
  { id: 'st-l2', type: 'ausgaben_kosten', name: 'Umsatzsteuer', level: 2, parent_id: 'st', sort_order: 0 },
]
// Produkte: sort_order widerspricht der alphabetischen Reihenfolge (Bravo=0 vor Alpha=1)
const produkte = [{ id: 'p1', name: 'Alpha', sort_order: 1 }, { id: 'p2', name: 'Bravo', sort_order: 0 }]
const plattformen = [{ id: 'pl1', name: 'Amazon', sort_order: 0 }]
const investition = [
  { id: 'iv1', name: 'Übergruppe A', parent_id: null, level: 1, sort_order: 0 },
  { id: 'iv1a', name: 'Untergruppe A1', parent_id: 'iv1', level: 2, sort_order: 0 },
]
const marketingkanal = [{ id: 'mk1', name: 'Google Ads', sort_order: 0 }]
const saetze = [{ kategorie_id: 'op', ebene: 1, ust_satz: 19 }]

function jsonRes(body: unknown) {
  return Promise.resolve({ ok: true, json: () => Promise.resolve(body) } as Response)
}

function mockFetch(url: string): Promise<Response> {
  // Notizen zuerst (eigener Pfad)
  if (url.includes('planung-notizen')) return jsonRes({ data: [] })
  if (url.includes('/grundeinstellungen')) return jsonRes(grund)
  if (url.includes('type=einnahmen')) return jsonRes(einnahmenKats)
  if (url.includes('type=ausgaben_kosten')) return jsonRes(ausgabenKats)
  if (url.includes('art=lp_produkt')) return jsonRes(produkte)
  if (url.includes('art=lp_sales_plattform')) return jsonRes(plattformen)
  if (url.includes('art=lp_investition')) return jsonRes(investition)
  if (url.includes('art=lp_marketingkanal')) return jsonRes(marketingkanal)
  if (url.includes('kategorie-saetze')) return jsonRes(saetze)
  if (url.includes('ebene-auswahl')) return jsonRes({})
  // Einnahmen
  if (url.includes('produktverkaeufe-berechnet')) return jsonRes([{ jahr: 2026, monat: 1, sales_plattform_id: 'pl1', wert: 200 }])
  if (url.includes('/einnahmen-planung')) return jsonRes([{ kategorie_id: 'e1', jahr: 2026, monat: 1, betrag_manuell: 500 }])
  // Umsatzausgaben
  if (url.includes('/umsatzausgaben/berechnet')) return jsonRes({
    data: [
      { kategorie_id: 'vtr-l2', produkt_id: 'p1', jahr: 2026, monat: 1, wert: 100 },
      { kategorie_id: 'vtr-l2', produkt_id: 'p2', jahr: 2026, monat: 1, wert: 50 },
      { kategorie_id: 'mk1', produkt_id: null, jahr: 2026, monat: 1, wert: 80 },
    ],
    unassigned_marketing_kat_ids: ['mk1'],
  })
  if (url.includes('/umsatzausgaben')) return jsonRes([])
  // Operativ (netto; field "betrag")
  if (url.includes('/operativekosten-planung')) return jsonRes([{ kategorie_id: 'op-l2', jahr: 2026, monat: 1, betrag: 100 }])
  // Investitionen
  if (url.includes('/investitionsausgaben-planung/berechnet')) return jsonRes({ data: [] })
  if (url.includes('/investitionsausgaben-planung')) return jsonRes([{ kategorie_id: 'iv1a', produkt_id: 'p1', jahr: 2026, monat: 1, betrag_manuell: 300 }])
  // Finanzierung
  if (url.includes('/finanzierungsausgaben-planung')) return jsonRes([{ kategorie_id: 'fin-l2', jahr: 2026, monat: 1, betrag: 50 }])
  // Steuer
  if (url.includes('/steuerausgaben/berechnet')) return jsonRes({ data: [{ kategorie_id: 'st-l2', jahr: 2026, monat: 1, wert: 30 }] })
  if (url.includes('/steuerausgaben')) return jsonRes([])
  return jsonRes([])
}

function findRow(rows: { label: string }[], label: string) {
  return rows.find(r => r.label === label)
}

describe('useLangfristigeLiquiditaetsauswertung', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn((input: string) => mockFetch(String(input))))
  })
  afterEach(() => {
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
  })

  async function load() {
    const { result } = renderHook(() => useLangfristigeLiquiditaetsauswertung('v-1'))
    await waitFor(() => expect(result.current.loading).toBe(false))
    return result
  }

  it('baut das Monatsfenster ab Startmonat über den Horizont (nur Soll, keine Vergangenheit)', async () => {
    const r = await load()
    expect(r.current.columns.map(c => c.label)).toEqual(['Jan 2026', 'Feb 2026'])
    expect(r.current.isEmpty).toBe(false)
  })

  it('summiert Gesamt Einnahmen und Gesamt Ausgaben je Monat korrekt', async () => {
    const r = await load()
    const ein = findRow(r.current.rows, 'Gesamt Einnahmen')!
    const aus = findRow(r.current.rows, 'Gesamt Ausgaben')!
    // Einnahmen Jan = e1(500) + Produktverkäufe(200) = 700
    expect(ein.cells['2026-1'].value).toBeCloseTo(700, 2)
    // Ausgaben Jan = Versand(150) + Marketing(80) + Operativ brutto(119) + Invest(300) + Finanz(50) + Steuer(30) = 729 → negativ
    expect(aus.cells['2026-1'].value).toBeCloseTo(-729, 2)
  })

  it('berechnet Cashflow und kumulierten Kontostand ab dem Startkontostand', async () => {
    const r = await load()
    const cf = findRow(r.current.rows, 'Cashflow der Periode')!
    const ks = findRow(r.current.rows, 'Kontostand')!
    expect(cf.cells['2026-1'].value).toBeCloseTo(-29, 2)      // 700 - 729
    expect(ks.cells['2026-1'].value).toBeCloseTo(971, 2)       // 1000 + (-29)
    expect(ks.cells['2026-2'].value).toBeCloseTo(971, 2)       // + Cashflow(Feb)=0
  })

  it('schlägt auf Operativkosten (netto) den USt-Satz auf (Brutto in der Liquiditätssicht)', async () => {
    const r = await load()
    const miete = findRow(r.current.rows, 'Miete')!
    // 100 netto × 1,19 = 119 → als Ausgabe negativ
    expect(miete.cells['2026-1'].value).toBeCloseTo(-119, 2)
  })

  it('zeigt Marketingkanäle als Untergruppen unter „Marketing" (sonst leer)', async () => {
    const r = await load()
    const kanal = findRow(r.current.rows, 'Google Ads')
    expect(kanal).toBeTruthy()
    expect(kanal!.cells['2026-1'].value).toBeCloseTo(-80, 2)
  })

  it('gruppiert alle Investitionen unter EINE Gruppe „Investitionen"', async () => {
    const r = await load()
    const invRoots = r.current.rows.filter(x => x.label === 'Investitionen')
    expect(invRoots).toHaveLength(1)
    expect(invRoots[0].kind).toBe('kategorie')
    // Übergruppe erscheint genau einmal (nicht zusätzlich als eigene Oberkategorie)
    expect(r.current.rows.filter(x => x.label === 'Übergruppe A')).toHaveLength(1)
    const untergruppe = findRow(r.current.rows, 'Untergruppe A1')!
    expect(untergruppe.cells['2026-1'].value).toBeCloseTo(-300, 2)
  })

  it('zeigt jede Oberkategorie an — auch ohne Werte (leere Zeile)', async () => {
    const r = await load()
    const spenden = findRow(r.current.rows, 'Spenden')
    expect(spenden).toBeTruthy()
    expect(spenden!.cells['2026-1'].value).toBeNull()
  })

  it('sortiert Produkt-Unterzeilen nach KPI-Modell-Reihenfolge (nicht alphabetisch)', async () => {
    const r = await load()
    const idxVersand = r.current.rows.findIndex(x => x.label === 'Versand')
    expect(idxVersand).toBeGreaterThanOrEqual(0)
    // sort_order: Bravo(0) vor Alpha(1) — obwohl alphabetisch Alpha < Bravo
    expect(r.current.rows[idxVersand + 1].label).toBe('Bravo')
    expect(r.current.rows[idxVersand + 2].label).toBe('Alpha')
  })

  it('kennzeichnet manuelle Werte blau und automatische Werte grau', async () => {
    const r = await load()
    const e1 = findRow(r.current.rows, 'Sonstige Einnahmen')!   // manueller Eintrag → blau
    expect(e1.cells['2026-1'].indicator).toBe('blue')
    const amazon = findRow(r.current.rows, 'Amazon')!           // Produktverkäufe-Auto → grau
    expect(amazon.cells['2026-1'].indicator).toBe('gray')
  })
})
