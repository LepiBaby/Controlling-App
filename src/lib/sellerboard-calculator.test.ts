import { describe, it, expect } from 'vitest'
import { calculateSellerboardRows, CalculatorInput } from './sellerboard-calculator'
import { KpiCategory } from '@/hooks/use-kpi-categories'
import { SellerboardAggregatedRow } from './sellerboard-parser'

// ─── Test fixtures ────────────────────────────────────────────────────────────

function makeKat(id: string, name: string, level: 1 | 2 | 3, type: KpiCategory['type'], parentId: string | null = null): KpiCategory {
  return {
    id,
    type,
    parent_id: parentId,
    name,
    sku_code: null,
    level,
    sort_order: 0,
    sales_plattform_enabled: true,
    produkt_enabled: true,
    kosten_label: null,
    ausgaben_label: null,
    ist_abzugsposten: false,
    ust_satz: null,
    exclude_from_rentabilitaet: false,
  }
}

function makeAgg(overrides: Partial<SellerboardAggregatedRow> = {}): SellerboardAggregatedRow {
  return {
    date: '2026-05-15',
    productId: 'prod-1',
    productName: 'Produkt A',
    skus: ['SKU-A'],
    salesOrganic: 100,
    salesPPC: 50,
    salesSponsoredProducts: 10,
    salesSponsoredDisplay: 5,
    unitsOrganic: 10,
    unitsPPC: 5,
    unitsSponsoredProducts: 2,
    unitsSponsoredDisplay: 1,
    promoValue: -20,
    sponsoredProducts: -30,
    sponsoredDisplay: -5,
    sponsoredBrands: -10,
    sponsoredBrandsVideo: -2,
    shipping: -15,
    commission: -12,
    refundCommission: -3,
    refundRefundCommission: -1,
    refundPrincipal: -25,
    refundPromotion: 0,
    shippingHB: 0,
    ...overrides,
  }
}

// Full KPI model
const ausgabenKategorien: KpiCategory[] = [
  makeKat('mkt-1', 'Marketing', 1, 'ausgaben_kosten'),
  makeKat('mkt-ads', 'Amazon Ads', 2, 'ausgaben_kosten', 'mkt-1'),
  makeKat('vtb-1', 'Vertrieb', 1, 'ausgaben_kosten'),
  makeKat('vtb-vk', 'Verkaufsgebühren', 2, 'ausgaben_kosten', 'vtb-1'),
  makeKat('vtb-ret', 'Retouren', 2, 'ausgaben_kosten', 'vtb-1'),
  makeKat('op-1', 'Operativ', 1, 'ausgaben_kosten'),
  makeKat('op-sm', 'Sales & Marketing', 2, 'ausgaben_kosten', 'op-1'),
  makeKat('op-pg', 'Plattformgebühren', 3, 'ausgaben_kosten', 'op-sm'),
]

const umsatzKategorien: KpiCategory[] = [
  makeKat('u-bu', 'Brutto-Umsatz', 1, 'umsatz'),
  makeKat('u-rab', 'Rabatte', 1, 'umsatz'),
  makeKat('u-rue', 'Rückerstattungen', 1, 'umsatz'),
]

const salesPlattformen: KpiCategory[] = [
  makeKat('amz-1', 'Amazon', 1, 'sales_plattformen'),
]

function makeInput(overrides: Partial<CalculatorInput> = {}): CalculatorInput {
  return {
    aggregatedRows: [makeAgg()],
    retourenkostenByMonth: {},
    amazonFeePerMonth: {},
    ausgabenKategorien,
    umsatzKategorien,
    salesPlattformen,
    ...overrides,
  }
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('calculateSellerboardRows', () => {

  describe('Brutto-Umsatz', () => {
    it('berechnet Brutto-Umsatz als SalesOrganic + SalesPPC (ohne Sponsored)', () => {
      const rows = calculateSellerboardRows(makeInput())
      const row = rows.find(r => r.kpiType === 'brutto_umsatz')!
      expect(row).toBeDefined()
      expect(row.betragNetto).toBe(150) // 100 + 50
      expect(row.rowType).toBe('umsatz')
      expect(row.kategorieId).toBe('u-bu')
    })

    it('ignoriert SalesSponsoredProducts und SalesSponsoredDisplay', () => {
      const agg = makeAgg({ salesOrganic: 200, salesPPC: 0, salesSponsoredProducts: 99, salesSponsoredDisplay: 99 })
      const rows = calculateSellerboardRows(makeInput({ aggregatedRows: [agg] }))
      const row = rows.find(r => r.kpiType === 'brutto_umsatz')!
      expect(row.betragNetto).toBe(200)
    })

    it('setzt hatFehler=true wenn Brutto-Umsatz-Kategorie fehlt', () => {
      const rows = calculateSellerboardRows(makeInput({ umsatzKategorien: [] }))
      const row = rows.find(r => r.kpiType === 'brutto_umsatz')!
      expect(row.hatFehler).toBe(true)
      expect(row.kategorieId).toBe('')
    })
  })

  describe('Rabatte', () => {
    it('nimmt Absolutwert von promoValue', () => {
      const rows = calculateSellerboardRows(makeInput())
      const row = rows.find(r => r.kpiType === 'rabatte')!
      expect(row.betragNetto).toBe(20) // |−20|
      expect(row.rowType).toBe('umsatz')
    })

    it('erkennt Rabatte-Kategorie auch als "Rabatt" (Singular)', () => {
      const kategorien = [
        ...umsatzKategorien.filter(c => c.name !== 'Rabatte'),
        makeKat('u-rab2', 'Rabatt', 1, 'umsatz'),
      ]
      const rows = calculateSellerboardRows(makeInput({ umsatzKategorien: kategorien }))
      const row = rows.find(r => r.kpiType === 'rabatte')!
      expect(row.hatFehler).toBe(false)
      expect(row.kategorieId).toBe('u-rab2')
    })
  })

  describe('Rückerstattungen', () => {
    it('nimmt Absolutwert von refundPrincipal (ohne Refund Promotion)', () => {
      const rows = calculateSellerboardRows(makeInput())
      const row = rows.find(r => r.kpiType === 'rueckerstattungen')!
      expect(row.betragNetto).toBe(25) // |−25 + 0|
    })

    it('zieht Refund Promotion von refundPrincipal ab (Kundenrabatt wird zurückerstattet)', () => {
      // Kunde zahlte 115 € (120 − 5 Rabatt): refundPrincipal=−120, refundPromotion=+5 → |−120+5|=115
      const agg = makeAgg({ refundPrincipal: -120, refundPromotion: 6 })
      const rows = calculateSellerboardRows(makeInput({ aggregatedRows: [agg] }))
      const row = rows.find(r => r.kpiType === 'rueckerstattungen')!
      expect(row.betragNetto).toBe(114) // |−120 + 6|
    })
  })

  describe('Amazon Ads', () => {
    it('summiert alle vier Sponsored-Spalten als Absolutwert', () => {
      // sponsoredProducts=-30, sponsoredDisplay=-5, sponsoredBrands=-10, sponsoredBrandsVideo=-2 → 47
      const rows = calculateSellerboardRows(makeInput())
      const row = rows.find(r => r.kpiType === 'amazon_ads')!
      expect(row.betragNetto).toBe(47)
      expect(row.rowType).toBe('ausgaben')
      expect(row.kategorieId).toBe('mkt-1')
      expect(row.gruppeId).toBe('mkt-ads')
    })

    it('berechnet Brutto und USt korrekt (×1.19 / ×0.19)', () => {
      const rows = calculateSellerboardRows(makeInput())
      const row = rows.find(r => r.kpiType === 'amazon_ads')!
      expect(row.betragBrutto).toBeCloseTo(47 * 1.19, 2)
      expect(row.ustBetrag).toBeCloseTo(47 * 0.19, 2)
    })

    it('setzt hatFehler=true wenn Marketing-Kategorie fehlt', () => {
      const katOhneMarketing = ausgabenKategorien.filter(c => c.name !== 'Marketing')
      const rows = calculateSellerboardRows(makeInput({ ausgabenKategorien: katOhneMarketing }))
      const row = rows.find(r => r.kpiType === 'amazon_ads')!
      expect(row.hatFehler).toBe(true)
    })
  })

  describe('Verkaufsgebühr', () => {
    it('berechnet Netto als -(commission + refundCommission + refundRefundCommission + shippingHB)', () => {
      // -(−12 + (−3) + (−1) + 0) = −(−16) = 16
      const rows = calculateSellerboardRows(makeInput())
      const row = rows.find(r => r.kpiType === 'verkaufsgebuehr')!
      expect(row.betragNetto).toBe(16)
      expect(row.kategorieId).toBe('vtb-1')
      expect(row.gruppeId).toBe('vtb-vk')
    })

    it('addiert ShippingHB zur Verkaufsgebühr', () => {
      // -(−12 + (−3) + (−1) + (−2)) = 18
      const agg = makeAgg({ shippingHB: -2 })
      const rows = calculateSellerboardRows(makeInput({ aggregatedRows: [agg] }))
      const row = rows.find(r => r.kpiType === 'verkaufsgebuehr')!
      expect(row.betragNetto).toBe(18)
    })

    it('erzeugt negative Ausgabe (Kostengutschrift) wenn Refund Commission die Kosten übersteigt', () => {
      // commission=0, refundCommission=+18, refundRefundCommission=-3.6 → -(0+18-3.6) = -14.4
      const agg = makeAgg({ commission: 0, refundCommission: 18, refundRefundCommission: -3.6, shippingHB: 0 })
      const rows = calculateSellerboardRows(makeInput({ aggregatedRows: [agg] }))
      const row = rows.find(r => r.kpiType === 'verkaufsgebuehr')!
      expect(row.betragNetto).toBe(-14.4)
      expect(row.betragBrutto).toBeCloseTo(-14.4 * 1.19, 2)
      expect(row.ustBetrag).toBeCloseTo(-14.4 * 0.19, 2)
      expect(row.hatWarnung).toBe(true)
    })
  })

  describe('Retourenkosten (manuelle Eingabe)', () => {
    it('erzeugt Retourenkosten-Zeile pro ausgefüllter Monat×Produkt-Kombination', () => {
      const rows = calculateSellerboardRows(makeInput({
        retourenkostenByMonth: { '2026-05': { 'prod-1': 75 } },
      }))
      const ret = rows.find(r => r.kpiType === 'retourenkosten')!
      expect(ret).toBeDefined()
      expect(ret.betragNetto).toBe(75)
      expect(ret.leistungsdatum).toBe('2026-05-01') // 1. des Monats
      expect(ret.zahlungsdatum).toBe('2026-05-01')
      expect(ret.rowType).toBe('ausgaben')
      expect(ret.kategorieId).toBe('vtb-1')
      expect(ret.gruppeId).toBe('vtb-ret')
      expect(ret.produktId).toBe('prod-1')
    })

    it('überspringt Retourenkosten-Felder mit Betrag = 0', () => {
      const rows = calculateSellerboardRows(makeInput({
        retourenkostenByMonth: { '2026-05': { 'prod-1': 0 } },
      }))
      expect(rows.some(r => r.kpiType === 'retourenkosten')).toBe(false)
    })

    it('erzeugt mehrere Retourenkosten-Zeilen für verschiedene Monate und Produkte', () => {
      const agg2 = makeAgg({ productId: 'prod-2', productName: 'Produkt B', date: '2026-04-10' })
      const rows = calculateSellerboardRows(makeInput({
        aggregatedRows: [makeAgg(), agg2],
        retourenkostenByMonth: {
          '2026-05': { 'prod-1': 100 },
          '2026-04': { 'prod-2': 50 },
        },
      }))
      const retRows = rows.filter(r => r.kpiType === 'retourenkosten')
      expect(retRows).toHaveLength(2)
      expect(retRows.some(r => r.leistungsdatum === '2026-05-01' && r.betragNetto === 100)).toBe(true)
      expect(retRows.some(r => r.leistungsdatum === '2026-04-01' && r.betragNetto === 50)).toBe(true)
    })

    it('Retourenkosten erscheinen BEFORE täglichen Zeilen im Array', () => {
      const rows = calculateSellerboardRows(makeInput({
        retourenkostenByMonth: { '2026-05': { 'prod-1': 50 } },
      }))
      const retIdx = rows.findIndex(r => r.kpiType === 'retourenkosten')
      const umsatzIdx = rows.findIndex(r => r.kpiType === 'brutto_umsatz')
      expect(retIdx).toBeLessThan(umsatzIdx)
    })

    it('setzt hatFehler=true wenn Vertrieb-Kategorie fehlt', () => {
      const katOhneVertrieb = ausgabenKategorien.filter(c => c.name !== 'Vertrieb' && c.parent_id !== 'vtb-1')
      const rows = calculateSellerboardRows(makeInput({
        ausgabenKategorien: katOhneVertrieb,
        retourenkostenByMonth: { '2026-05': { 'prod-1': 50 } },
      }))
      const ret = rows.find(r => r.kpiType === 'retourenkosten')!
      expect(ret.hatFehler).toBe(true)
    })

    it('verwendet Produktnamen aus aggregatedRows für die Beschreibung', () => {
      const rows = calculateSellerboardRows(makeInput({
        aggregatedRows: [makeAgg({ productId: 'prod-1', productName: 'Mein Produkt' })],
        retourenkostenByMonth: { '2026-05': { 'prod-1': 30 } },
      }))
      const ret = rows.find(r => r.kpiType === 'retourenkosten')!
      expect(ret.beschreibung).toContain('Mein Produkt')
    })
  })

  describe('Plattformgebühren (pro Monat)', () => {
    it('erzeugt Plattformgebühren-Zeile pro ausgefülltem Monat', () => {
      const rows = calculateSellerboardRows(makeInput({
        amazonFeePerMonth: { '2026-05': 120 },
      }))
      const fee = rows.find(r => r.kpiType === 'plattformgebuehren')!
      expect(fee).toBeDefined()
      expect(fee.betragNetto).toBe(120)
      expect(fee.leistungsdatum).toBe('2026-05-01')
      expect(fee.zahlungsdatum).toBe('2026-05-01')
      expect(fee.kategorieId).toBe('op-1')
      expect(fee.gruppeId).toBe('op-sm')
      expect(fee.untergruppeId).toBe('op-pg')
      expect(fee.produktId).toBeNull()
    })

    it('überspringt Monate mit Betrag = 0', () => {
      const rows = calculateSellerboardRows(makeInput({
        amazonFeePerMonth: { '2026-05': 0 },
      }))
      expect(rows.some(r => r.kpiType === 'plattformgebuehren')).toBe(false)
    })

    it('erzeugt mehrere Plattformgebühren-Zeilen für verschiedene Monate', () => {
      const rows = calculateSellerboardRows(makeInput({
        amazonFeePerMonth: { '2026-04': 80, '2026-05': 90 },
      }))
      const fees = rows.filter(r => r.kpiType === 'plattformgebuehren')
      expect(fees).toHaveLength(2)
      expect(fees.some(r => r.leistungsdatum === '2026-04-01' && r.betragNetto === 80)).toBe(true)
      expect(fees.some(r => r.leistungsdatum === '2026-05-01' && r.betragNetto === 90)).toBe(true)
    })

    it('Plattformgebühren erscheinen BEFORE täglichen Zeilen im Array', () => {
      const rows = calculateSellerboardRows(makeInput({
        amazonFeePerMonth: { '2026-05': 50 },
      }))
      const feeIdx = rows.findIndex(r => r.kpiType === 'plattformgebuehren')
      const umsatzIdx = rows.findIndex(r => r.kpiType === 'brutto_umsatz')
      expect(feeIdx).toBeLessThan(umsatzIdx)
    })

    it('berechnet Brutto und USt für Plattformgebühren korrekt', () => {
      const rows = calculateSellerboardRows(makeInput({
        amazonFeePerMonth: { '2026-05': 100 },
      }))
      const fee = rows.find(r => r.kpiType === 'plattformgebuehren')!
      expect(fee.betragBrutto).toBeCloseTo(119, 2)
      expect(fee.ustBetrag).toBeCloseTo(19, 2)
    })

    it('setzt hatFehler=true wenn Operativ-Kategorie fehlt', () => {
      const katOhneOperativ = ausgabenKategorien.filter(c => c.name !== 'Operativ' && c.parent_id !== 'op-1')
      const rows = calculateSellerboardRows(makeInput({
        ausgabenKategorien: katOhneOperativ,
        amazonFeePerMonth: { '2026-05': 50 },
      }))
      const fee = rows.find(r => r.kpiType === 'plattformgebuehren')!
      expect(fee.hatFehler).toBe(true)
    })
  })

  describe('Amazon Sales Platform', () => {
    it('weist Amazon-ID allen Zeilen zu (case-insensitive "amazon")', () => {
      const rows = calculateSellerboardRows(makeInput())
      for (const row of rows) {
        expect(row.salesPlattformId).toBe('amz-1')
      }
    })

    it('setzt salesPlattformId=null wenn keine Amazon-Plattform im KPI-Modell', () => {
      const rows = calculateSellerboardRows(makeInput({ salesPlattformen: [] }))
      for (const row of rows) {
        expect(row.salesPlattformId).toBeNull()
      }
    })
  })

  describe('Mehrere Produkte und Tage', () => {
    it('erzeugt 5 Zeilen pro aggregated-row (3 Umsatz + 2 Ausgaben)', () => {
      const rows = calculateSellerboardRows(makeInput())
      const tageszeilen = rows.filter(r =>
        r.leistungsdatum === '2026-05-15' &&
        ['brutto_umsatz', 'rabatte', 'rueckerstattungen', 'amazon_ads', 'verkaufsgebuehr'].includes(r.kpiType)
      )
      expect(tageszeilen).toHaveLength(5)
    })

    it('erzeugt separate Zeilen für verschiedene Produkte am gleichen Tag', () => {
      const agg2 = makeAgg({ productId: 'prod-2', productName: 'Produkt B' })
      const rows = calculateSellerboardRows(makeInput({ aggregatedRows: [makeAgg(), agg2] }))
      const umsatzRows = rows.filter(r => r.kpiType === 'brutto_umsatz')
      expect(umsatzRows).toHaveLength(2)
      expect(umsatzRows.map(r => r.produktId)).toContain('prod-1')
      expect(umsatzRows.map(r => r.produktId)).toContain('prod-2')
    })
  })

  describe('Rundung', () => {
    it('rundet Beträge auf 2 Dezimalstellen', () => {
      const agg = makeAgg({ sponsoredProducts: -10.123456 })
      const rows = calculateSellerboardRows(makeInput({ aggregatedRows: [agg] }))
      const row = rows.find(r => r.kpiType === 'amazon_ads')!
      // 10.12 + 5 + 10 + 2 = 27.12 (netto aus test-fixture minus new value)
      expect(row.betragNetto).toBe(Math.round((10.123456 + 5 + 10 + 2) * 100) / 100)
    })
  })
})
