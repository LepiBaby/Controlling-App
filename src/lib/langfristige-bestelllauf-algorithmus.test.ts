import { describe, it, expect } from 'vitest'
import {
  runLangfristigerBestelllauf,
  computeLagerbestandVerlauf,
  type ProduktInput,
  type AlgorithmusInput,
  type BestehendeBestellungInput,
} from './langfristige-bestelllauf-algorithmus'

const START = new Date(Date.UTC(2026, 5, 1)) // Juni 2026
const HEUTE = new Date(Date.UTC(2026, 5, 1))

function produkt(over: Partial<ProduktInput> = {}): ProduktInput {
  return {
    produkt_id: 'p1',
    produkt_name: 'Produkt 1',
    aktueller_bestand: 0,
    monatsabsatz: 30,
    pufferzeit_tage: 0,
    produktionszeit_tage: 30,
    zwischenzeit_tage: 0,
    shipping_zeit_tage: 0,
    entladungszeit_tage: 0,
    sicherheitsbestand_monate: 1,
    zielreichweite_monate: 2,
    moq: null,
    hersteller_id: null,
    stueckvolumen_cm3: null,
    max_20dc: null,
    max_40hq: null,
    ...over,
  }
}

function input(over: Partial<AlgorithmusInput> = {}): AlgorithmusInput {
  return {
    startMonat: START,
    horizontMonate: 12,
    heute: HEUTE,
    produkte: [],
    bestehendeBestellungen: [],
    ...over,
  }
}

describe('runLangfristigerBestelllauf', () => {
  it('returns empty result for no products', () => {
    const r = runLangfristigerBestelllauf(input())
    expect(r.neue_bestellungen).toEqual([])
    expect(r.aenderungen_bestehende).toEqual([])
  })

  it('computes the first order with correct theoretical/practical qty (Produktebene)', () => {
    const r = runLangfristigerBestelllauf(input({ produkte: [produkt({ aktueller_bestand: 0 })] }))
    expect(r.neue_bestellungen.length).toBeGreaterThanOrEqual(1)
    // Produktebene: genau ein sku_mengen-Eintrag, sku_id = produkt_id.
    expect(r.neue_bestellungen[0].produkt_ids).toEqual(['p1'])
    expect(r.neue_bestellungen[0].sku_mengen).toHaveLength(1)
    expect(r.neue_bestellungen[0].sku_mengen[0].sku_id).toBe('p1')
    expect(r.neue_bestellungen[0].sku_mengen[0].sku_name).toBe('Produkt 1')
    // Erste Bestellung: geplanter Absatz über die Zielreichweite (2 Monate ≈
    // 60,875 Tage) AB Verfügbarkeit (1. Juli), Restbestand 0. Tagesanteilig über
    // die 31-Tage-Monate Jul/Aug bei 30/Monat ≈ 59 (nicht pauschal 2 × 30 = 60).
    expect(r.neue_bestellungen[0].sku_mengen[0].menge_theoretisch).toBe(59)
    expect(r.neue_bestellungen[0].sku_mengen[0].menge_praktisch).toBe(59)
  })

  it('creates MULTIPLE orders across the full horizon (kalkulatorischer Bestand)', () => {
    const r = runLangfristigerBestelllauf(input({ produkte: [produkt({ aktueller_bestand: 0 })] }))
    const fuerP1 = r.neue_bestellungen.filter((b) => b.produkt_ids.includes('p1'))
    // Über 12 Monate Horizont mit Zielreichweite 2 → mehrere Nachbestellungen.
    expect(fuerP1.length).toBeGreaterThan(1)
  })

  it('creates no order when monthly demand is 0', () => {
    const r = runLangfristigerBestelllauf(input({ produkte: [produkt({ monatsabsatz: 0 })] }))
    expect(r.neue_bestellungen).toHaveLength(0)
  })

  it('creates no order when stock stays well above Meldebestand', () => {
    const r = runLangfristigerBestelllauf(
      input({ produkte: [produkt({ aktueller_bestand: 1_000_000, monatsabsatz: 10 })] }),
    )
    expect(r.neue_bestellungen).toHaveLength(0)
  })

  it('rounds quantity up to MOQ when theoretical is below MOQ', () => {
    const r = runLangfristigerBestelllauf(
      input({
        produkte: [
          produkt({
            aktueller_bestand: 0,
            monatsabsatz: 10,
            produktionszeit_tage: 0,
            sicherheitsbestand_monate: 0.5,
            zielreichweite_monate: 1,
            moq: 50,
          }),
        ],
      }),
    )
    expect(r.neue_bestellungen.length).toBeGreaterThanOrEqual(1)
    expect(r.neue_bestellungen[0].sku_mengen[0].menge_praktisch).toBe(50)
    expect(r.neue_bestellungen[0].sku_mengen[0].begruendung_anpassung).toContain('MOQ')
  })

  it('applies container optimization (rounds up to a full 20DC)', () => {
    const r = runLangfristigerBestelllauf(
      input({
        produkte: [
          produkt({
            aktueller_bestand: 0,
            monatsabsatz: 600,
            produktionszeit_tage: 0,
            sicherheitsbestand_monate: 0,
            zielreichweite_monate: 1,
            stueckvolumen_cm3: 1000,
            max_20dc: 1000,
            max_40hq: 2200,
          }),
        ],
      }),
    )
    expect(r.neue_bestellungen.length).toBeGreaterThanOrEqual(1)
    expect(r.neue_bestellungen[0].sku_mengen[0].menge_praktisch).toBe(1000)
    // container[] aus anzahl_20dc/40hq: 1× '20DC', kein '40HQ'.
    expect(r.neue_bestellungen[0].container).toEqual(['20DC'])
  })

  it('consolidates two products with the same manufacturer and close order dates', () => {
    // Horizont 2 + Zielreichweite 12 → je Produkt genau EINE Bestellung (beide in Woche 0).
    const r = runLangfristigerBestelllauf(
      input({
        horizontMonate: 2,
        produkte: [
          produkt({ produkt_id: 'p1', hersteller_id: 'h1', aktueller_bestand: 0, zielreichweite_monate: 12 }),
          produkt({ produkt_id: 'p2', produkt_name: 'Produkt 2', hersteller_id: 'h1', aktueller_bestand: 0, zielreichweite_monate: 12 }),
        ],
      }),
    )
    expect(r.neue_bestellungen).toHaveLength(2)
    const [a, b] = r.neue_bestellungen
    expect(a.konsolidiert_mit_temp_ids).toContain(b.temp_id)
    expect(b.konsolidiert_mit_temp_ids).toContain(a.temp_id)
  })

  it('does NOT consolidate products with different manufacturers', () => {
    const r = runLangfristigerBestelllauf(
      input({
        horizontMonate: 2,
        produkte: [
          produkt({ produkt_id: 'p1', hersteller_id: 'h1', aktueller_bestand: 0, zielreichweite_monate: 12 }),
          produkt({ produkt_id: 'p2', hersteller_id: 'h2', aktueller_bestand: 0, zielreichweite_monate: 12 }),
        ],
      }),
    )
    expect(r.neue_bestellungen).toHaveLength(2)
    expect(r.neue_bestellungen[0].konsolidiert_mit_temp_ids).toEqual([])
    expect(r.neue_bestellungen[1].konsolidiert_mit_temp_ids).toEqual([])
  })

  it('ignores existing algorithm orders entirely (no change recommendations)', () => {
    const existing: BestehendeBestellungInput = {
      bestellung_id: 'b1',
      produkt_id: 'p1',
      herkunft: 'algorithmus',
      manuell_geaendert: false,
      bestelldatum: '2026-06-01',
      ankunftsdatum: '2026-07-01',
      verfuegbarkeitsdatum: '2026-07-01',
      menge_praktisch: 100,
    }
    const r = runLangfristigerBestelllauf(
      input({
        produkte: [produkt({ aktueller_bestand: 1_000_000, monatsabsatz: 10 })],
        bestehendeBestellungen: [existing],
      }),
    )
    // Keine Änderungsempfehlungen — bestehende Algorithmus-Bestellung wird ignoriert.
    expect(r.aenderungen_bestehende).toHaveLength(0)
    // Hoher Bestand → keine neue Bestellung.
    expect(r.neue_bestellungen).toHaveLength(0)
  })

  it('ignores an existing algorithm order and recalculates fresh (no change, just new)', () => {
    const existing: BestehendeBestellungInput = {
      bestellung_id: 'b1',
      produkt_id: 'p1',
      herkunft: 'algorithmus',
      manuell_geaendert: false,
      bestelldatum: '2026-06-01',
      ankunftsdatum: '2026-07-01',
      verfuegbarkeitsdatum: '2026-07-01',
      menge_praktisch: 60,
    }
    const r = runLangfristigerBestelllauf(
      input({
        horizontMonate: 2,
        produkte: [produkt({ aktueller_bestand: 0, zielreichweite_monate: 12 })],
        bestehendeBestellungen: [existing],
      }),
    )
    // Keine Änderungen; das Produkt wird komplett neu kalkuliert.
    expect(r.aenderungen_bestehende).toHaveLength(0)
    expect(r.neue_bestellungen.length).toBeGreaterThanOrEqual(1)
  })

  it('respects manually added (laufende) orders as fixed stock', () => {
    const manuell: BestehendeBestellungInput = {
      bestellung_id: 'm1',
      produkt_id: 'p1',
      herkunft: 'manuell',
      manuell_geaendert: false,
      bestelldatum: '2026-06-01',
      ankunftsdatum: '2026-06-15',
      verfuegbarkeitsdatum: '2026-06-15',
      menge_praktisch: 100_000,
    }
    const r = runLangfristigerBestelllauf(
      input({
        horizontMonate: 2,
        produkte: [produkt({ aktueller_bestand: 0, zielreichweite_monate: 12 })],
        bestehendeBestellungen: [manuell],
      }),
    )
    // Die große manuelle Lieferung deckt den Bedarf → keine neue Bestellung nötig.
    expect(r.neue_bestellungen).toHaveLength(0)
    expect(r.aenderungen_bestehende).toHaveLength(0)
  })
})

describe('computeLagerbestandVerlauf', () => {
  it('spans exactly the general horizon, starting at the start month', () => {
    const { monate, start_label } = computeLagerbestandVerlauf(
      produkt({ aktueller_bestand: 300, monatsabsatz: 30 }),
      [],
      START,
      3,
    )
    expect(monate).toHaveLength(3)
    expect(monate[0].ist_start).toBe(true)
    expect(monate[0].bestand_vorher).toBe(300)
    expect(monate[0].bestand_nachher).toBe(270) // 300 − 30
    expect(monate[1].bestand_vorher).toBe(270)
    expect(monate[monate.length - 1].jahr).toBe(2026)
    expect(monate[monate.length - 1].monat).toBe(8) // Jun + 2 = Aug (3 Monate)
    expect(start_label).toBe('Jun 26')
  })

  it('does NOT create an order when the reorder point lies beyond the horizon', () => {
    // Genug Bestand für > 2 Monate, aber Horizont = 1 Monat → keine Bestellung.
    const r = runLangfristigerBestelllauf(
      input({ horizontMonate: 1, produkte: [produkt({ aktueller_bestand: 200, monatsabsatz: 30, sicherheitsbestand_monate: 0, produktionszeit_tage: 0 })] }),
    )
    expect(r.neue_bestellungen).toHaveLength(0)
  })

  it('adds order arrivals to the projected stock', () => {
    const arrival: BestehendeBestellungInput = {
      bestellung_id: 'b1',
      produkt_id: 'p1',
      herkunft: 'algorithmus',
      manuell_geaendert: false,
      bestelldatum: '2026-06-01',
      ankunftsdatum: '2026-07-01',
      verfuegbarkeitsdatum: '2026-07-01',
      menge_praktisch: 500,
    }
    const { monate } = computeLagerbestandVerlauf(
      produkt({ aktueller_bestand: 100, monatsabsatz: 30 }),
      [arrival],
      START,
      3,
    )
    // Juli (Index 1): vorher 70 (=100−30 Juni) + 500 Einlagerung − 30 Absatz = 540
    expect(monate[1].ankunft).toBe(500)
    expect(monate[1].bestand_vorher).toBe(70)
    expect(monate[1].bestand_nachher).toBe(540)
  })

  it('kalkulatorischer Bestand = Bestand nachher + offene Bestellungen (Linie weicht ab)', () => {
    // Bestellung am 15.06., verfügbar 01.08. → offen in Jun + Jul, eingetroffen ab Aug.
    const order: BestehendeBestellungInput = {
      bestellung_id: 'b1',
      produkt_id: 'p1',
      herkunft: 'algorithmus',
      manuell_geaendert: false,
      bestelldatum: '2026-06-15',
      ankunftsdatum: '2026-08-01',
      verfuegbarkeitsdatum: '2026-08-01',
      menge_praktisch: 500,
    }
    const { monate } = computeLagerbestandVerlauf(
      produkt({ aktueller_bestand: 1000, monatsabsatz: 30 }),
      [order],
      START,
      4,
    )
    // Jun: nachher 970, offen 500 → Kalk 1470 (Linie liegt deutlich über Bestand).
    expect(monate[0].bestand_nachher).toBe(970)
    expect(monate[0].kalkulatorischer_bestand).toBe(1470)
    // Jul: noch offen → Kalk = 940 + 500 = 1440.
    expect(monate[1].kalkulatorischer_bestand).toBe(1440)
    // Aug: eingetroffen (zählt als Einlagerung, nicht mehr offen) → Kalk = Bestand nachher.
    expect(monate[2].kalkulatorischer_bestand).toBe(monate[2].bestand_nachher)
  })

  it('uses the AVERAGE monthly demand for Sicherheitsbestand (not the start month)', () => {
    // Map: Jun 100, Jul 300 → Ø 200. Lieferzeit 0 → Meldebestand = Sicherheitsbestand.
    const map = new Map<string, number>([
      ['2026-6', 100],
      ['2026-7', 300],
    ])
    const { monate } = computeLagerbestandVerlauf(
      produkt({
        aktueller_bestand: 10000,
        monatsabsatz: 100, // Start-Monat 100 — würde fälschlich 100 ergeben
        sicherheitsbestand_monate: 1,
        pufferzeit_tage: 0,
        produktionszeit_tage: 0,
        zwischenzeit_tage: 0,
        shipping_zeit_tage: 0,
        entladungszeit_tage: 0,
      }),
      [],
      START,
      2,
      map,
    )
    // Ø = (100+300)/2 = 200 → Sicherheitsbestand = 200 × 1 = 200 (nicht 100)
    expect(monate[0].sicherheitsbestand).toBe(200)
    // Lieferzeit 0 → Meldebestand = Sicherheitsbestand
    expect(monate[0].meldebestand).toBe(200)
  })

  it('computes Meldebestand per month over the lead time from real monthly demand', () => {
    // Lieferzeit 30 Tage; Start Jun (30 Tage) → Meldebestand(Jun) = Jun-Absatz + SB.
    const map = new Map<string, number>([
      ['2026-6', 120],
      ['2026-7', 180],
    ])
    const { monate } = computeLagerbestandVerlauf(
      produkt({
        aktueller_bestand: 10000,
        monatsabsatz: 120,
        sicherheitsbestand_monate: 0, // SB = 0 → Meldebestand = reiner Lieferzeit-Absatz
        pufferzeit_tage: 0,
        produktionszeit_tage: 30,
        zwischenzeit_tage: 0,
        shipping_zeit_tage: 0,
        entladungszeit_tage: 0,
      }),
      [],
      START,
      2,
      map,
    )
    // Lieferzeit 30 Tage ab 1. Juni = genau der Juni (30 Tage) → 120
    expect(monate[0].meldebestand).toBe(120)
  })

  it('shows no consumption when monthly demand is 0', () => {
    const { monate } = computeLagerbestandVerlauf(
      produkt({ aktueller_bestand: 100, monatsabsatz: 0 }),
      [],
      START,
      2,
    )
    expect(monate.every((m) => m.bestand_vorher === 100 && m.bestand_nachher === 100)).toBe(true)
    expect(monate[0].meldebestand).toBeNull()
  })
})
