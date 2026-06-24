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

const VERSION_ID = '11111111-1111-4111-8111-111111111111'
const P1 = '33333333-3333-4333-8333-333333333333'

function chain(result: unknown) {
  const c: Record<string, unknown> = { then: (resolve: (v: unknown) => unknown) => resolve(result) }
  for (const m of ['select', 'eq', 'not', 'order', 'limit', 'maybeSingle']) c[m] = () => c
  return c
}

function ctx(id = VERSION_ID) {
  return { params: Promise.resolve({ versionId: id }) }
}
const URL = `http://localhost/api/langfristige-planung/${VERSION_ID}/bestellplanung/stammdaten-check`

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
})

// Reihenfolge der from()-Aufrufe: version, produkte, dann 8 Parallel-Quellen:
// absatz, bestand, lieferzeit, bestandsverwaltung, moq, container, hersteller, container_global
function setupAllComplete() {
  mockFrom.mockReturnValueOnce(chain({ data: { id: VERSION_ID }, error: null })) // version
  mockFrom.mockReturnValueOnce(chain({ data: [{ id: P1, name: 'FlexiCo' }], error: null })) // produkte
  mockFrom.mockReturnValueOnce(chain({ data: [{ produkt_id: P1 }], error: null })) // absatz
  mockFrom.mockReturnValueOnce(chain({ data: [{ produkt_id: P1, bestand: 50 }], error: null })) // bestand
  mockFrom.mockReturnValueOnce(chain({ data: [{ produkt_id: P1, pufferzeit_tage: 3, produktionszeit_tage: 30, zwischenzeit_tage: 3, shipping_zeit_tage: 60, entladungszeit_tage: 3 }], error: null })) // lieferzeit
  mockFrom.mockReturnValueOnce(chain({ data: [{ produkt_id: P1, sicherheitsbestand: 1, zielreichweite_wochen: 5 }], error: null })) // bestandsverwaltung
  mockFrom.mockReturnValueOnce(chain({ data: [{ produkt_id: P1, moq: 100 }], error: null })) // moq
  mockFrom.mockReturnValueOnce(chain({ data: [{ produkt_id: P1, laenge_cm: 10, breite_cm: 10, hoehe_cm: 10 }], error: null })) // container
  mockFrom.mockReturnValueOnce(chain({ data: [{ produkt_id: P1, hersteller_id: 'h1' }], error: null })) // hersteller
  mockFrom.mockReturnValueOnce(chain({ data: { volumen_20dc: 30, volumen_40hq: 70 }, error: null })) // container_global
}

describe('GET stammdaten-check', () => {
  it('returns ok=true when all data present', async () => {
    setupAllComplete()
    const res = await GET(new Request(URL), ctx())
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.ok).toBe(true)
    expect(body.fehler).toEqual([])
  })

  it('lists missing data per product', async () => {
    mockFrom.mockReturnValueOnce(chain({ data: { id: VERSION_ID }, error: null })) // version
    mockFrom.mockReturnValueOnce(chain({ data: [{ id: P1, name: 'FlexiCo' }], error: null })) // produkte
    mockFrom.mockReturnValueOnce(chain({ data: [], error: null })) // absatz fehlt
    mockFrom.mockReturnValueOnce(chain({ data: [], error: null })) // bestand fehlt
    mockFrom.mockReturnValueOnce(chain({ data: [{ produkt_id: P1, pufferzeit_tage: 3, produktionszeit_tage: 30, zwischenzeit_tage: 3, shipping_zeit_tage: 60, entladungszeit_tage: 3 }], error: null })) // lieferzeit ok
    mockFrom.mockReturnValueOnce(chain({ data: [{ produkt_id: P1, sicherheitsbestand: 1, zielreichweite_wochen: 5 }], error: null })) // bestandsv ok
    mockFrom.mockReturnValueOnce(chain({ data: [{ produkt_id: P1, moq: 100 }], error: null })) // moq ok
    mockFrom.mockReturnValueOnce(chain({ data: [{ produkt_id: P1, laenge_cm: 10, breite_cm: 10, hoehe_cm: 10 }], error: null })) // container ok
    mockFrom.mockReturnValueOnce(chain({ data: [{ produkt_id: P1, hersteller_id: 'h1' }], error: null })) // hersteller ok
    mockFrom.mockReturnValueOnce(chain({ data: { volumen_20dc: 30, volumen_40hq: 70 }, error: null })) // global ok
    const res = await GET(new Request(URL), ctx())
    const body = await res.json()
    expect(body.ok).toBe(false)
    expect(body.fehler.some((f: string) => f.includes('FlexiCo') && f.includes('Absatzplanung') && f.includes('Aktueller Bestand'))).toBe(true)
  })

  it('flags missing global container volumes', async () => {
    // Alle Produktdaten vollständig, nur das globale Container-Volumen fehlt.
    mockFrom.mockReturnValueOnce(chain({ data: { id: VERSION_ID }, error: null })) // version
    mockFrom.mockReturnValueOnce(chain({ data: [{ id: P1, name: 'FlexiCo' }], error: null })) // produkte
    mockFrom.mockReturnValueOnce(chain({ data: [{ produkt_id: P1 }], error: null })) // absatz
    mockFrom.mockReturnValueOnce(chain({ data: [{ produkt_id: P1, bestand: 50 }], error: null })) // bestand
    mockFrom.mockReturnValueOnce(chain({ data: [{ produkt_id: P1, pufferzeit_tage: 3, produktionszeit_tage: 30, zwischenzeit_tage: 3, shipping_zeit_tage: 60, entladungszeit_tage: 3 }], error: null })) // lieferzeit
    mockFrom.mockReturnValueOnce(chain({ data: [{ produkt_id: P1, sicherheitsbestand: 1, zielreichweite_wochen: 5 }], error: null })) // bestandsv
    mockFrom.mockReturnValueOnce(chain({ data: [{ produkt_id: P1, moq: 100 }], error: null })) // moq
    mockFrom.mockReturnValueOnce(chain({ data: [{ produkt_id: P1, laenge_cm: 10, breite_cm: 10, hoehe_cm: 10 }], error: null })) // container
    mockFrom.mockReturnValueOnce(chain({ data: [{ produkt_id: P1, hersteller_id: 'h1' }], error: null })) // hersteller
    mockFrom.mockReturnValueOnce(chain({ data: { volumen_20dc: 30, volumen_40hq: null }, error: null })) // global: 40HQ fehlt
    const res = await GET(new Request(URL), ctx())
    const body = await res.json()
    expect(body.ok).toBe(false)
    expect(body.fehler.some((f: string) => f.includes('Container-Maximalvolumen'))).toBe(true)
    // Produktdaten sind vollständig → keine Produkt-spezifische Fehlermeldung
    expect(body.fehler.some((f: string) => f.includes('FlexiCo'))).toBe(false)
  })

  it('flags data as missing when the ROW exists but fields are empty', async () => {
    mockFrom.mockReturnValueOnce(chain({ data: { id: VERSION_ID }, error: null })) // version
    mockFrom.mockReturnValueOnce(chain({ data: [{ id: P1, name: 'FlexiCo' }], error: null })) // produkte
    mockFrom.mockReturnValueOnce(chain({ data: [{ produkt_id: P1 }], error: null })) // absatz ok
    mockFrom.mockReturnValueOnce(chain({ data: [{ produkt_id: P1, bestand: null }], error: null })) // bestand leer
    mockFrom.mockReturnValueOnce(chain({ data: [{ produkt_id: P1, pufferzeit_tage: 3, produktionszeit_tage: null, zwischenzeit_tage: 3, shipping_zeit_tage: 60, entladungszeit_tage: 3 }], error: null })) // lieferzeit unvollständig
    mockFrom.mockReturnValueOnce(chain({ data: [{ produkt_id: P1, sicherheitsbestand: 1, zielreichweite_wochen: null }], error: null })) // bestandsv unvollständig
    mockFrom.mockReturnValueOnce(chain({ data: [{ produkt_id: P1, moq: null }], error: null })) // moq leer
    mockFrom.mockReturnValueOnce(chain({ data: [{ produkt_id: P1, laenge_cm: 10, breite_cm: null, hoehe_cm: 10 }], error: null })) // container unvollständig
    mockFrom.mockReturnValueOnce(chain({ data: [{ produkt_id: P1, hersteller_id: null }], error: null })) // hersteller leer
    mockFrom.mockReturnValueOnce(chain({ data: { volumen_20dc: 30, volumen_40hq: 70 }, error: null })) // global ok
    const res = await GET(new Request(URL), ctx())
    const body = await res.json()
    expect(body.ok).toBe(false)
    const zeile = body.fehler.find((f: string) => f.includes('FlexiCo'))
    expect(zeile).toContain('Aktueller Bestand')
    expect(zeile).toContain('Lieferzeit')
    expect(zeile).toContain('Bestandsverwaltung')
    expect(zeile).toContain('MOQ')
    expect(zeile).toContain('Containerkapazität')
    expect(zeile).toContain('Hersteller')
    expect(zeile).not.toContain('Absatzplanung') // Absatz war gesetzt
  })

  it('returns ok=false when no products exist', async () => {
    mockFrom.mockReturnValueOnce(chain({ data: { id: VERSION_ID }, error: null }))
    mockFrom.mockReturnValueOnce(chain({ data: [], error: null }))
    const res = await GET(new Request(URL), ctx())
    const body = await res.json()
    expect(body.ok).toBe(false)
    expect(body.fehler[0]).toContain('Keine Produkte')
  })

  it('returns 404 for foreign version', async () => {
    mockFrom.mockReturnValueOnce(chain({ data: null, error: null }))
    const res = await GET(new Request(URL), ctx())
    expect(res.status).toBe(404)
  })

  it('returns 401 when unauthenticated', async () => {
    await unauth()
    const res = await GET(new Request(URL), ctx())
    expect(res.status).toBe(401)
  })
})
