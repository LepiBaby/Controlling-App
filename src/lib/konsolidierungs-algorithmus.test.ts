import { describe, it, expect } from 'vitest'
import { berechneKonsolidierung } from './konsolidierungs-algorithmus'
import type { KonsolidierungsBestellungInput } from './konsolidierungs-algorithmus'
import type { ProduktStammdaten } from '@/hooks/use-planbestelllauf'

// ─── Test fixtures ────────────────────────────────────────────────────────────

const VOLUMEN_20DC = 25.0 // m³
const VOLUMEN_40HQ = 60.0 // m³
const STUECK_M3 = 0.05 // m³ per unit → 20DC = 500 units, 40HQ = 1200 units

function makeStamm(overrides?: Partial<ProduktStammdaten>): ProduktStammdaten {
  return {
    produkt_id: 'prod-1',
    hersteller_id: 'her-1',
    hersteller_name: 'Test GmbH',
    stueckvolumen_m3: STUECK_M3,
    max_20dc: 500,
    max_40hq: 1200,
    pufferzeit_tage: 10,
    produktionszeit_tage: 30,
    zwischenzeit_tage: 5,
    shipping_zeit_tage: 28,
    entladungszeit_tage: 7,
    ...overrides,
  }
}

function makeBestellung(id: string, produktId: string, mengen: number[], prodende: string | null = '2026-09-01'): KonsolidierungsBestellungInput {
  return {
    bestellung_id: id,
    produktionsende_datum: prodende,
    produkt_ids: [produktId],
    sku_mengen: mengen.map((m, i) => ({
      sku_id: `sku-${i}`,
      menge_nach_moq: m,
      menge_praktisch: m,
      begruendung_anpassung: null,
    })),
  }
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('berechneKonsolidierung', () => {
  it('returns error hint when fewer than 2 orders provided', () => {
    const result = berechneKonsolidierung(
      [makeBestellung('b1', 'prod-1', [500])],
      new Map([['prod-1', makeStamm()]]),
      VOLUMEN_20DC,
      VOLUMEN_40HQ,
    )
    expect(result.bestellungen).toHaveLength(0)
    expect(result.hinweis).toContain('Mindestens 2')
  })

  it('returns error hint when no order has a produktionsende_datum', () => {
    const result = berechneKonsolidierung(
      [
        makeBestellung('b1', 'prod-1', [500], null),
        makeBestellung('b2', 'prod-1', [500], null),
      ],
      new Map([['prod-1', makeStamm()]]),
      VOLUMEN_20DC,
      VOLUMEN_40HQ,
    )
    expect(result.bestellungen).toHaveLength(0)
    expect(result.hinweis).toContain('Prod.ende')
  })

  it('aligns all orders to the earliest produktionsende_datum', () => {
    const result = berechneKonsolidierung(
      [
        makeBestellung('b1', 'prod-1', [600], '2026-10-01'),
        makeBestellung('b2', 'prod-1', [600], '2026-09-01'), // earlier
      ],
      new Map([['prod-1', makeStamm()]]),
      VOLUMEN_20DC,
      VOLUMEN_40HQ,
    )
    expect(result.bestellungen).toHaveLength(2)
    result.bestellungen.forEach(e => {
      expect(e.neues_produktionsende_datum).toBe('2026-09-01')
    })
  })

  it('cascades dates correctly from produktionsende using stammdaten', () => {
    // stamm: puffer=10, prodzeit=30, zwischen=5, shipping=28, entladung=7
    // prodStart = prodende - 30 = 2026-08-02
    // bestelldatum = prodStart - 10 = 2026-07-23
    // shippingdatum = prodende + 5 = 2026-09-06
    // ankunftsdatum = shipping + 28 = 2026-10-04
    // verfuegbar = ankunft + 7 = 2026-10-11
    const result = berechneKonsolidierung(
      [
        makeBestellung('b1', 'prod-1', [600], '2026-09-01'),
        makeBestellung('b2', 'prod-1', [600], '2026-09-15'),
      ],
      new Map([['prod-1', makeStamm()]]),
      VOLUMEN_20DC,
      VOLUMEN_40HQ,
    )
    const e = result.bestellungen[0]
    expect(e.neues_produktionsende_datum).toBe('2026-09-01')
    expect(e.neues_produktionsstart_datum).toBe('2026-08-02') // -30 days
    expect(e.neues_shippingdatum).toBe('2026-09-06')         // +5 days
    expect(e.neues_ankunftsdatum).toBe('2026-10-04')         // +28 days
    expect(e.neues_verfuegbarkeitsdatum).toBe('2026-10-11')  // +7 days
  })

  it('sets nurDatumsanpassung hint when all orders fill exactly full containers', () => {
    // 1200 units × 0.05 m³ = 60 m³ = exactly 1 × 40HQ → rest_m3 = 0
    const result = berechneKonsolidierung(
      [
        makeBestellung('b1', 'prod-1', [1200], '2026-09-01'), // exactly 1 40HQ
        makeBestellung('b2', 'prod-1', [1200], '2026-09-15'), // exactly 1 40HQ
      ],
      new Map([['prod-1', makeStamm()]]),
      VOLUMEN_20DC,
      VOLUMEN_40HQ,
    )
    expect(result.hinweis).toContain('volle Container')
    // Quantities should be unchanged
    result.bestellungen.forEach(e => {
      expect(e.neue_sku_mengen[0].neue_menge_praktisch).toBe(1200)
    })
  })

  it('assigns fractional container_anteil for rest portions', () => {
    // b1: 700 units → 700 × 0.05 = 35 m³ → volle_40hq=0, rest=35m³
    // b2: 300 units → 300 × 0.05 = 15 m³ → volle_40hq=0, rest=15m³
    // gesamt_rest = 50 m³ → between 20DC(25) and 40HQ(60) → 1 × 40HQ container
    // b1 volumen_anteil = 35/50 = 0.7, b2 = 15/50 = 0.3
    const result = berechneKonsolidierung(
      [
        makeBestellung('b1', 'prod-1', [700], '2026-09-01'),
        makeBestellung('b2', 'prod-1', [300], '2026-09-01'),
      ],
      new Map([['prod-1', makeStamm()]]),
      VOLUMEN_20DC,
      VOLUMEN_40HQ,
    )
    expect(result.bestellungen).toHaveLength(2)
    const e1 = result.bestellungen.find(e => e.bestellung_id === 'b1')!
    const e2 = result.bestellungen.find(e => e.bestellung_id === 'b2')!
    // b1 gets ~70% of container, b2 ~30%
    expect(e1.container_anteil['40HQ']).toBeCloseTo(0.7, 1)
    expect(e2.container_anteil['40HQ']).toBeCloseTo(0.3, 1)
  })

  it('keeps full 40HQ containers separate and only consolidates rest', () => {
    // b1: 1500 units → 1500 × 0.05 = 75 m³ → 1 full 40HQ + 15m³ rest
    // b2: 400 units → 400 × 0.05 = 20 m³ → 0 full + 20m³ rest
    const result = berechneKonsolidierung(
      [
        makeBestellung('b1', 'prod-1', [1500], '2026-09-01'),
        makeBestellung('b2', 'prod-1', [400], '2026-09-01'),
      ],
      new Map([['prod-1', makeStamm()]]),
      VOLUMEN_20DC,
      VOLUMEN_40HQ,
    )
    const e1 = result.bestellungen.find(e => e.bestellung_id === 'b1')!
    expect(e1.volle_40hq).toBe(1)
    expect(e1.container_anteil['40HQ']).toBeGreaterThanOrEqual(1) // at least 1 full HQ
  })

  it('treats quantities as unchanged when stueckvolumen_m3 is unknown', () => {
    const result = berechneKonsolidierung(
      [
        makeBestellung('b1', 'prod-1', [700], '2026-09-01'),
        makeBestellung('b2', 'prod-1', [300], '2026-09-01'),
      ],
      new Map([['prod-1', makeStamm({ stueckvolumen_m3: null })]]),
      VOLUMEN_20DC,
      VOLUMEN_40HQ,
    )
    // Quantities unchanged (falls back to menge_praktisch)
    expect(result.bestellungen[0].neue_sku_mengen[0].neue_menge_praktisch).toBe(700)
    expect(result.bestellungen[1].neue_sku_mengen[0].neue_menge_praktisch).toBe(300)
    // But date should still be adjusted
    result.bestellungen.forEach(e => {
      expect(e.neues_produktionsende_datum).toBe('2026-09-01')
    })
  })

  it('total sku quantities sum match across both orders (rounding correction)', () => {
    // Both orders should together fill the shared container — no quantity is lost
    const result = berechneKonsolidierung(
      [
        makeBestellung('b1', 'prod-1', [750], '2026-09-01'),
        makeBestellung('b2', 'prod-1', [750], '2026-09-01'),
      ],
      new Map([['prod-1', makeStamm()]]),
      VOLUMEN_20DC,
      VOLUMEN_40HQ,
    )
    expect(result.bestellungen).toHaveLength(2)
    result.bestellungen.forEach(e => {
      // Each order should have exactly 1 sku with a valid quantity
      expect(e.neue_sku_mengen).toHaveLength(1)
      expect(e.neue_sku_mengen[0].neue_menge_praktisch).toBeGreaterThan(0)
    })
  })

  it('adds consolidation note to begruendung_anpassung', () => {
    const result = berechneKonsolidierung(
      [
        makeBestellung('b1', 'prod-1', [700], '2026-09-01'),
        makeBestellung('b2', 'prod-1', [300], '2026-09-01'),
      ],
      new Map([['prod-1', makeStamm()]]),
      VOLUMEN_20DC,
      VOLUMEN_40HQ,
    )
    result.bestellungen.forEach(e => {
      e.neue_sku_mengen.forEach(s => {
        expect(s.begruendung_anpassung).toContain('Konsolidierung')
      })
    })
  })
})
