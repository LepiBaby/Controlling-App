import { describe, it, expect } from 'vitest'
import { generiereBestellkosten } from './bestellkosten-generierung'
import type { BestellungDaten, ProduktKosten, Zahlungskonditionen, KostenGlobal, KpiKategorie } from './bestellkosten-generierung'

const kategorien: KpiKategorie[] = [
  { id: 'ware-id', name: 'Ware' },
  { id: 'inspektion-id', name: 'Inspektion' },
  { id: 'shipping-id', name: 'Shipping' },
  { id: 'zoll-id', name: 'Zoll' },
  { id: 'einlagerung-id', name: 'Einlagerung' },
]

const baseBestellung: BestellungDaten = {
  bestelldatum: '2026-07-01',
  produktionsende_datum: '2026-08-15',
  shippingdatum: '2026-08-20',
  ankunftsdatum: '2026-10-01',
  verfuegbarkeitsdatum: '2026-10-10',
  anzahl_40hq: 1,
  anzahl_20dc: 0,
  produkte: [
    {
      produkt_id: 'p-1',
      sku_mengen: [{ menge_praktisch: 100 }, { menge_praktisch: 150 }],
    },
  ],
}

const baseProduktkosten: ProduktKosten[] = [
  { produkt_id: 'p-1', warenkosten: 10.00, zollsatz_pct: 8 },
]

const baseZahlungskonditionen: Zahlungskonditionen[] = [
  {
    produkt_id: 'p-1',
    vor_produktion_pct: 30,
    nach_produktion_pct: 50,
    nach_ankunft_pct: 20,
    zahlungsziel_vor_produktion_tage: 0,
    zahlungsziel_nach_produktion_tage: 0,
    zahlungsziel_nach_ankunft_tage: 0,
  },
]

const baseKostenGlobal: KostenGlobal = {
  shipping_kosten_20dc: 500,
  shipping_kosten_40hq: 2000,
  shipping_zahlungsziel_tage: 30,
  inspektion_kosten_20dc: 300,
  inspektion_kosten_40hq: 600,
  inspektion_zahlungsziel_tage: 0,
  einlagerung_kosten_20dc: 200,
  einlagerung_kosten_40hq: 400,
  einlagerung_zahlungsziel_tage: 0,
  zoll_zahlungsziel_tage: 0,
}

describe('generiereBestellkosten', () => {
  it('returns empty array when no stammdaten', () => {
    const result = generiereBestellkosten(baseBestellung, [], [], null, kategorien)
    expect(result).toEqual([])
  })

  it('generates 3 Ware entries for 30/50/20 split', () => {
    const result = generiereBestellkosten(
      baseBestellung,
      baseProduktkosten,
      baseZahlungskonditionen,
      null,
      kategorien,
    )
    const wareEintraege = result.filter(e => e.kpi_kategorie_id === 'ware-id')
    expect(wareEintraege).toHaveLength(3)
    // Total: 250 Stk. × 10 € = 2500 €
    // Vor Produktion: 30% = 750 €
    expect(wareEintraege[0].nettobetrag).toBe(750)
    expect(wareEintraege[0].datum).toBe('2026-07-01') // bestelldatum + 0
    // Nach Produktion: 50% = 1250 €
    expect(wareEintraege[1].nettobetrag).toBe(1250)
    expect(wareEintraege[1].datum).toBe('2026-08-20') // shippingdatum + 0
    // Nach Ankunft: 20% = 500 €
    expect(wareEintraege[2].nettobetrag).toBe(500)
    expect(wareEintraege[2].datum).toBe('2026-10-01') // ankunftsdatum + 0
  })

  it('generates 1 Ware entry for 100/0/0 split', () => {
    const zk: Zahlungskonditionen[] = [{
      ...baseZahlungskonditionen[0],
      vor_produktion_pct: 100,
      nach_produktion_pct: 0,
      nach_ankunft_pct: 0,
    }]
    const result = generiereBestellkosten(baseBestellung, baseProduktkosten, zk, null, kategorien)
    const wareEintraege = result.filter(e => e.kpi_kategorie_id === 'ware-id')
    expect(wareEintraege).toHaveLength(1)
    expect(wareEintraege[0].nettobetrag).toBe(2500)
  })

  it('generates Inspektion entry with correct amount', () => {
    const result = generiereBestellkosten(
      baseBestellung,
      baseProduktkosten,
      baseZahlungskonditionen,
      baseKostenGlobal,
      kategorien,
    )
    const inspektion = result.find(e => e.kpi_kategorie_id === 'inspektion-id')
    expect(inspektion).toBeDefined()
    expect(inspektion!.nettobetrag).toBe(600) // 1 × 40HQ × 600 €
    expect(inspektion!.datum).toBe('2026-08-15') // produktionsende + 0
  })

  it('generates Shipping entry with correct amount and zahlungsziel', () => {
    const result = generiereBestellkosten(
      baseBestellung,
      baseProduktkosten,
      baseZahlungskonditionen,
      baseKostenGlobal,
      kategorien,
    )
    const shipping = result.find(e => e.kpi_kategorie_id === 'shipping-id')
    expect(shipping).toBeDefined()
    expect(shipping!.nettobetrag).toBe(2000) // 1 × 40HQ × 2000 €
    expect(shipping!.datum).toBe('2026-10-31') // ankunftsdatum 2026-10-01 + 30 Tage
  })

  it('generates Zoll entry: (Ware + Shipping) × Zollsatz', () => {
    const result = generiereBestellkosten(
      baseBestellung,
      baseProduktkosten,
      baseZahlungskonditionen,
      baseKostenGlobal,
      kategorien,
    )
    const zoll = result.find(e => e.kpi_kategorie_id === 'zoll-id')
    expect(zoll).toBeDefined()
    // Ware: 2500, Shipping: 2000 → Zollbasis: 4500, Zollsatz: 8% → 360 €
    expect(zoll!.nettobetrag).toBe(360)
    expect(zoll!.datum).toBe('2026-10-01') // ankunftsdatum + 0
  })

  it('generates Einlagerung entry with correct amount', () => {
    const result = generiereBestellkosten(
      baseBestellung,
      baseProduktkosten,
      baseZahlungskonditionen,
      baseKostenGlobal,
      kategorien,
    )
    const einlagerung = result.find(e => e.kpi_kategorie_id === 'einlagerung-id')
    expect(einlagerung).toBeDefined()
    expect(einlagerung!.nettobetrag).toBe(400) // 1 × 40HQ × 400 €
    expect(einlagerung!.datum).toBe('2026-10-10') // verfuegbarkeitsdatum + 0
  })

  it('generates both 40HQ and 20DC container costs', () => {
    const bestellungMixed: BestellungDaten = { ...baseBestellung, anzahl_40hq: 1, anzahl_20dc: 2 }
    const result = generiereBestellkosten(
      bestellungMixed,
      baseProduktkosten,
      baseZahlungskonditionen,
      baseKostenGlobal,
      kategorien,
    )
    const inspektion = result.find(e => e.kpi_kategorie_id === 'inspektion-id')
    expect(inspektion!.nettobetrag).toBe(1200) // 1 × 600 + 2 × 300
  })

  it('skips Zoll when zollsatz is 0', () => {
    const pk: ProduktKosten[] = [{ produkt_id: 'p-1', warenkosten: 10, zollsatz_pct: 0 }]
    const result = generiereBestellkosten(baseBestellung, pk, baseZahlungskonditionen, baseKostenGlobal, kategorien)
    const zoll = result.find(e => e.kpi_kategorie_id === 'zoll-id')
    expect(zoll).toBeUndefined()
  })

  it('skips Ware when bestelldatum missing for Vor Produktion phase', () => {
    const b: BestellungDaten = { ...baseBestellung, bestelldatum: null }
    const zk: Zahlungskonditionen[] = [{ ...baseZahlungskonditionen[0], nach_produktion_pct: 0, nach_ankunft_pct: 0 }]
    const result = generiereBestellkosten(b, baseProduktkosten, zk, null, kategorien)
    const ware = result.filter(e => e.kpi_kategorie_id === 'ware-id')
    expect(ware).toHaveLength(0) // no datum available for Vor Produktion
  })

  it('skips Inspektion when no container data', () => {
    const b: BestellungDaten = { ...baseBestellung, anzahl_40hq: 0, anzahl_20dc: 0 }
    const result = generiereBestellkosten(b, baseProduktkosten, baseZahlungskonditionen, baseKostenGlobal, kategorien)
    const inspektion = result.find(e => e.kpi_kategorie_id === 'inspektion-id')
    expect(inspektion).toBeUndefined()
  })

  it('skips Inspektion when produktionsende_datum missing', () => {
    const b: BestellungDaten = { ...baseBestellung, produktionsende_datum: null }
    const result = generiereBestellkosten(b, baseProduktkosten, baseZahlungskonditionen, baseKostenGlobal, kategorien)
    const inspektion = result.find(e => e.kpi_kategorie_id === 'inspektion-id')
    expect(inspektion).toBeUndefined()
  })

  it('uses null kpi_kategorie_id when category not found', () => {
    const result = generiereBestellkosten(baseBestellung, baseProduktkosten, baseZahlungskonditionen, null, [])
    // No categories → all kpi_kategorie_id should be null (Ware entries)
    result.forEach(e => expect(e.kpi_kategorie_id).toBeNull())
  })

  it('all entries are marked as ist_automatisch=true', () => {
    const result = generiereBestellkosten(
      baseBestellung, baseProduktkosten, baseZahlungskonditionen, baseKostenGlobal, kategorien,
    )
    result.forEach(e => expect(e.ist_automatisch).toBe(true))
  })

  it('handles zahlungsziel correctly (adds days to base date)', () => {
    const zk: Zahlungskonditionen[] = [{
      ...baseZahlungskonditionen[0],
      vor_produktion_pct: 100,
      nach_produktion_pct: 0,
      nach_ankunft_pct: 0,
      zahlungsziel_vor_produktion_tage: 14,
    }]
    const result = generiereBestellkosten(baseBestellung, baseProduktkosten, zk, null, kategorien)
    const ware = result.find(e => e.kpi_kategorie_id === 'ware-id')
    expect(ware!.datum).toBe('2026-07-15') // 2026-07-01 + 14 Tage
  })
})
