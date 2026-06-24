import { describe, it, expect, vi, beforeEach } from 'vitest'

const mockFrom = vi.fn()

vi.mock('@/lib/supabase-server', () => ({
  requireAuth: vi.fn().mockResolvedValue({
    user: { id: 'user-1', email: 'test@test.com' },
    supabase: { from: (table: string) => mockFrom(table) },
    error: null,
  }),
}))

// Helfer stubben (werden nur bei vorhandenen Daten erreicht).
vi.mock('../bestellplanung/bestellungen/[id]/kosten/_kosten-utils', () => ({
  generiereUndSpeichereLangfristigeBestellkosten: vi.fn().mockResolvedValue(undefined),
}))
vi.mock('../bestellplanung/_utils', () => ({
  ladeVersionsDaten: vi.fn().mockResolvedValue({ startMonat: new Date(Date.UTC(2026, 0, 1)), horizontMonate: 1, produkte: [], bestehende: [] }),
}))

import { GET } from './route'

const VERSION_ID = '11111111-1111-4111-8111-111111111111'
const URL_BASE = `http://localhost/api/langfristige-planung/${VERSION_ID}/rentabilitaetsauswertung`

function chain(result: unknown) {
  const c: Record<string, unknown> = { then: (resolve: (v: unknown) => unknown) => resolve(result) }
  for (const m of ['select', 'eq', 'in', 'upsert', 'single', 'maybeSingle', 'limit', 'delete', 'insert']) c[m] = () => c
  return c
}
function ctx(id = VERSION_ID) {
  return { params: Promise.resolve({ versionId: id }) }
}
async function unauth() {
  const { requireAuth } = await import('@/lib/supabase-server')
  vi.mocked(requireAuth).mockResolvedValueOnce({
    user: null,
    supabase: null as never,
    error: new Response('Unauthorized', { status: 401 }),
  })
}

beforeEach(() => {
  vi.clearAllMocks()
  mockFrom.mockReset()
  mockFrom.mockImplementation((table: string) => {
    if (table === 'langfristige_planversionen') return chain({ data: { id: VERSION_ID }, error: null })
    return chain({ data: [], error: null })
  })
})

describe('GET /api/langfristige-planung/[versionId]/rentabilitaetsauswertung', () => {
  it('returns 401 when unauthenticated', async () => {
    await unauth()
    const res = await GET(new Request(URL_BASE), ctx())
    expect(res.status).toBe(401)
  })

  it('returns 400 for invalid version id', async () => {
    const res = await GET(new Request(URL_BASE), ctx('not-a-uuid'))
    expect(res.status).toBe(400)
  })

  it('returns 404 for foreign/unknown version', async () => {
    mockFrom.mockImplementation(() => chain({ data: null, error: null }))
    const res = await GET(new Request(URL_BASE), ctx())
    expect(res.status).toBe(404)
  })

  it('returns 500 when kpi_categories load fails', async () => {
    mockFrom.mockImplementation((table: string) => {
      if (table === 'langfristige_planversionen') return chain({ data: { id: VERSION_ID }, error: null })
      if (table === 'kpi_categories') return chain({ data: null, error: { message: 'boom' } })
      return chain({ data: [], error: null })
    })
    const res = await GET(new Request(URL_BASE), ctx())
    expect(res.status).toBe(500)
  })

  it('returns a full structure with all cascade lines for an empty version', async () => {
    mockFrom.mockImplementation((table: string) => {
      if (table === 'langfristige_planversionen') return chain({ data: { id: VERSION_ID }, error: null })
      if (table === 'langfristige_grundeinstellungen') return chain({ data: { startmonat_monat: 1, startmonat_jahr: 2026, planungshorizont_monate: 3 }, error: null })
      return chain({ data: [], error: null })
    })
    const res = await GET(new Request(URL_BASE), ctx())
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.monate.map((m: { key: string }) => m.key)).toEqual(['2026-1', '2026-2', '2026-3'])
    // Alle 18 Basiszeilen vorhanden (ohne Investitionen), leer.
    expect(Object.keys(body.lines).length).toBe(18)
    expect(body.lines.investitionen).toBeUndefined()
    expect(body.lines.brutto_umsatz).toEqual({ werte: {}, produkte: [] })
    expect(body.absatz).toEqual({ gesamt: {}, produkte: [] })
  })

  it('computes Brutto-Umsatz, Ware and Absatz for a product with planned sales', async () => {
    mockFrom.mockImplementation((table: string) => {
      switch (table) {
        case 'langfristige_planversionen': return chain({ data: { id: VERSION_ID }, error: null })
        case 'langfristige_grundeinstellungen': return chain({ data: { startmonat_monat: 1, startmonat_jahr: 2026, planungshorizont_monate: 1 }, error: null })
        case 'kpi_categories': return chain({ data: [], error: null })
        case 'langfristige_kpi_kategorien': return chain({ data: [{ id: 'p1', name: 'Produkt 1', sort_order: 0 }], error: null })
        case 'langfristige_absatz_planung': return chain({ data: [{ sales_plattform_id: 'plt1', produkt_id: 'p1', jahr: 2026, monat: 1, absatz: 10, effektiver_vk: 20 }], error: null })
        case 'langfristige_produktinformationen_produktkosten': return chain({ data: [{ produkt_id: 'p1', warenkosten: 5 }], error: null })
        default: return chain({ data: [], error: null })
      }
    })
    const res = await GET(new Request(URL_BASE), ctx())
    expect(res.status).toBe(200)
    const body = await res.json()
    // Brutto = 10 × 20 = 200
    expect(body.lines.brutto_umsatz.werte['2026-1']).toBe(200)
    expect(body.lines.brutto_umsatz.produkte[0]).toMatchObject({ id: 'p1', label: 'Produkt 1' })
    // Ware = 10 × 5 = 50
    expect(body.lines.ware.werte['2026-1']).toBe(50)
    // Absatztabelle: 10 Stück
    expect(body.absatz.gesamt['2026-1']).toBe(10)
    expect(body.absatz.produkte[0]).toMatchObject({ id: 'p1', label: 'Produkt 1' })
    // Keine USt-Sätze gepflegt → Umsatzsteuer-Zeile leer
    expect(body.lines.umsatzsteuer.werte['2026-1']).toBeUndefined()
  })

  it('nets Ebene-2 module values (Finanzierung/Zinsen) using the maintained USt rate', async () => {
    mockFrom.mockImplementation((table: string) => {
      switch (table) {
        case 'langfristige_planversionen': return chain({ data: { id: VERSION_ID }, error: null })
        case 'langfristige_grundeinstellungen': return chain({ data: { startmonat_monat: 1, startmonat_jahr: 2026, planungshorizont_monate: 1 }, error: null })
        case 'kpi_categories': return chain({ data: [
          { id: 'fin1', name: 'Finanzierung', parent_id: null, type: 'ausgaben_kosten', level: 1 },
          { id: 'zins1', name: 'Zinsen', parent_id: 'fin1', type: 'ausgaben_kosten', level: 2 },
        ], error: null })
        case 'langfristige_kpi_kategorien': return chain({ data: [{ id: 'p1', name: 'Produkt 1', sort_order: 0 }], error: null })
        case 'langfristige_ust_ebene_auswahl': return chain({ data: [{ kategorie_id: 'fin1', ebene: 1 }], error: null })
        case 'langfristige_ust_kategorie_saetze': return chain({ data: [{ kategorie_id: 'fin1', ebene: 1, ust_satz: 19 }], error: null })
        case 'langfristige_finanzierungsausgaben_planung': return chain({ data: [{ kategorie_id: 'zins1', jahr: 2026, monat: 1, betrag: 119 }], error: null })
        default: return chain({ data: [], error: null })
      }
    })
    const res = await GET(new Request(URL_BASE), ctx())
    expect(res.status).toBe(200)
    const body = await res.json()
    // 119 € brutto bei 19 % USt → 100,00 € netto
    expect(body.lines.finanzierung_zinsen.werte['2026-1']).toBe(100)
  })

  // ── PROJ-96: leichter „Nur-Umsatz"-Modus (?nur=umsatz) ──────────────────────
  // Produkt mit geplanten Verkäufen UND einer Bestellung → der volle Modus würde die
  // (schreibende) Bestellkosten-Generierung auslösen, der leichte Modus nicht.
  function salesAndOrderMock(table: string) {
    switch (table) {
      case 'langfristige_planversionen': return chain({ data: { id: VERSION_ID }, error: null })
      case 'langfristige_grundeinstellungen': return chain({ data: { startmonat_monat: 1, startmonat_jahr: 2026, planungshorizont_monate: 1 }, error: null })
      case 'kpi_categories': return chain({ data: [], error: null })
      case 'langfristige_kpi_kategorien': return chain({ data: [{ id: 'p1', name: 'Produkt 1', sort_order: 0 }], error: null })
      case 'langfristige_absatz_planung': return chain({ data: [{ sales_plattform_id: 'plt1', produkt_id: 'p1', jahr: 2026, monat: 1, absatz: 10, effektiver_vk: 20 }], error: null })
      case 'langfristige_bestellungen': return chain({ data: [{
        id: 'b1', produkt_id: 'p1', menge_praktisch: 10,
        bestelldatum: '2026-01-01', produktionsende_datum: null, shippingdatum: null,
        ankunftsdatum: null, verfuegbarkeitsdatum: null,
        anzahl_20dc: 0, anzahl_40hq: 0, container_anteil: null, ist_erstbestellung: false,
      }], error: null })
      default: return chain({ data: [], error: null })
    }
  }

  async function generiereSpy() {
    const mod = await import('../bestellplanung/bestellungen/[id]/kosten/_kosten-utils')
    return vi.mocked(mod.generiereUndSpeichereLangfristigeBestellkosten)
  }

  it('nur=umsatz skips the (writing) Bestellkosten generation even with an order present', async () => {
    mockFrom.mockImplementation(salesAndOrderMock)
    const res = await GET(new Request(`${URL_BASE}?nur=umsatz`), ctx())
    expect(res.status).toBe(200)
    const body = await res.json()
    // Umsatzzeilen vorhanden …
    expect(body.lines.brutto_umsatz.werte['2026-1']).toBe(200)
    // … aber die schweren/schreibenden Schritte wurden NICHT ausgeführt.
    expect(await generiereSpy()).not.toHaveBeenCalled()
    // Produktkosten („Ware") gehören NICHT zum Umsatzblock → bleiben leer.
    expect(body.lines.ware.werte['2026-1']).toBeUndefined()
  })

  it('full mode DOES run the Bestellkosten generation for the same data', async () => {
    mockFrom.mockImplementation(salesAndOrderMock)
    const res = await GET(new Request(URL_BASE), ctx())
    expect(res.status).toBe(200)
    expect(await generiereSpy()).toHaveBeenCalledTimes(1)
  })

  it('nur=umsatz reports the same Brutto-Umsatz and Absatz as full mode', async () => {
    mockFrom.mockImplementation(salesAndOrderMock)
    const full = await (await GET(new Request(URL_BASE), ctx())).json()
    mockFrom.mockImplementation(salesAndOrderMock)
    const umsatz = await (await GET(new Request(`${URL_BASE}?nur=umsatz`), ctx())).json()
    expect(umsatz.lines.brutto_umsatz.werte).toEqual(full.lines.brutto_umsatz.werte)
    expect(umsatz.absatz.gesamt).toEqual(full.absatz.gesamt)
  })

  // ── PROJ-98: leichter „Nur-Operativ"-Modus (?nur=operativ) ──────────────────
  // Operative Kosten (Gruppe → Untergruppe) + ein Produkt mit Verkäufen UND einer
  // Bestellung. Der leichte Modus liefert Operativ + Brutto-Umsatz, überspringt aber
  // die (schreibende) Bestellkosten-Generierung und alle übrigen Kostenzeilen.
  function operativAndOrderMock(table: string) {
    switch (table) {
      case 'langfristige_planversionen': return chain({ data: { id: VERSION_ID }, error: null })
      case 'langfristige_grundeinstellungen': return chain({ data: { startmonat_monat: 1, startmonat_jahr: 2026, planungshorizont_monate: 1 }, error: null })
      case 'kpi_categories': return chain({ data: [
        { id: 'oproot', name: 'Operativ', parent_id: null, type: 'ausgaben_kosten', level: 1 },
        { id: 'og1', name: 'Personal', parent_id: 'oproot', type: 'ausgaben_kosten', level: 2 },
        { id: 'osub1', name: 'Gehälter', parent_id: 'og1', type: 'ausgaben_kosten', level: 3 },
      ], error: null })
      case 'langfristige_kpi_kategorien': return chain({ data: [{ id: 'p1', name: 'Produkt 1', sort_order: 0 }], error: null })
      case 'langfristige_absatz_planung': return chain({ data: [{ sales_plattform_id: 'plt1', produkt_id: 'p1', jahr: 2026, monat: 1, absatz: 10, effektiver_vk: 20 }], error: null })
      case 'langfristige_operativekosten_planung': return chain({ data: [{ kategorie_id: 'osub1', jahr: 2026, monat: 1, betrag: 300 }], error: null })
      case 'langfristige_bestellungen': return chain({ data: [{
        id: 'b1', produkt_id: 'p1', menge_praktisch: 10,
        bestelldatum: '2026-01-01', produktionsende_datum: null, shippingdatum: null,
        ankunftsdatum: null, verfuegbarkeitsdatum: null,
        anzahl_20dc: 0, anzahl_40hq: 0, container_anteil: null, ist_erstbestellung: false,
      }], error: null })
      default: return chain({ data: [], error: null })
    }
  }

  it('nur=operativ returns the Operativ line (Gruppe→Untergruppe) + Brutto and skips the (writing) Bestellkosten generation', async () => {
    mockFrom.mockImplementation(operativAndOrderMock)
    const res = await GET(new Request(`${URL_BASE}?nur=operativ`), ctx())
    expect(res.status).toBe(200)
    const body = await res.json()
    // Operativ-Summe + Drill-Hierarchie vorhanden
    expect(body.lines.operativ.werte['2026-1']).toBe(300)
    expect(body.lines.operativ.produkte[0]).toMatchObject({ id: 'og1', label: 'Personal' })
    expect(body.lines.operativ.produkte[0].children[0]).toMatchObject({ id: 'osub1', label: 'Gehälter' })
    // Brutto-Umsatz (Prozent-Bezugsgröße) ebenfalls vorhanden
    expect(body.lines.brutto_umsatz.werte['2026-1']).toBe(200)
    // … aber die schweren/schreibenden Schritte wurden NICHT ausgeführt …
    expect(await generiereSpy()).not.toHaveBeenCalled()
    // … und Produktkosten/Marketing gehören NICHT zum Operativ-Block → bleiben leer.
    expect(body.lines.ware.werte['2026-1']).toBeUndefined()
    expect(body.lines.marketing.werte['2026-1']).toBeUndefined()
  })

  it('nur=operativ reports the same Operativ + Brutto as full mode', async () => {
    mockFrom.mockImplementation(operativAndOrderMock)
    const full = await (await GET(new Request(URL_BASE), ctx())).json()
    mockFrom.mockImplementation(operativAndOrderMock)
    const operativ = await (await GET(new Request(`${URL_BASE}?nur=operativ`), ctx())).json()
    expect(operativ.lines.operativ.werte).toEqual(full.lines.operativ.werte)
    expect(operativ.lines.operativ.produkte).toEqual(full.lines.operativ.produkte)
    expect(operativ.lines.brutto_umsatz.werte).toEqual(full.lines.brutto_umsatz.werte)
  })
})
