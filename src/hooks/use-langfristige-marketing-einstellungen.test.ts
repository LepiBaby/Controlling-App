import { describe, it, expect } from 'vitest'
import {
  makeDefaultEinstellung,
  GRUPPIERUNG_VALUES,
  GRUPPIERUNG_LABELS,
  GRUPPIERUNG_HINWEISE,
} from './use-langfristige-marketing-einstellungen'

// PROJ-80: reine Konstanten/Default-Logik des versionsgebundenen Marketing-
// Einstellungen-Hooks. Die GET/PUT-Datenflüsse sind durch den API-Integrationstest
// (route.test.ts) abgedeckt; hier wird nur die isolierte Logik geprüft.

describe('GRUPPIERUNG Konstanten', () => {
  it('bietet genau zwei Optionen in der erwarteten Reihenfolge (monatlich, quartalsweise)', () => {
    expect(GRUPPIERUNG_VALUES).toEqual(['monatlich', 'quartalsweise'])
  })

  it('enthält keine wöchentliche Option (Abgrenzung zur kurzfristigen Variante)', () => {
    expect(GRUPPIERUNG_VALUES).not.toContain('woechentlich')
  })

  it('hat ein Label für jede Gruppierung', () => {
    for (const g of GRUPPIERUNG_VALUES) {
      expect(GRUPPIERUNG_LABELS[g]).toBeTruthy()
    }
    expect(GRUPPIERUNG_LABELS.monatlich).toBe('Monatlich')
    expect(GRUPPIERUNG_LABELS.quartalsweise).toBe('Quartalsweise')
  })

  it('hat die feste Berechnungsregel als Hinweis je Gruppierung', () => {
    expect(GRUPPIERUNG_HINWEISE.monatlich).toMatch(/Folgemonat/)
    expect(GRUPPIERUNG_HINWEISE.quartalsweise).toMatch(/Quartal/)
  })
})

describe('makeDefaultEinstellung', () => {
  it('setzt die korrekten Standardwerte für einen Marketingkanal', () => {
    const def = makeDefaultEinstellung('kanal-1')
    expect(def).toEqual({
      marketingkanal_id: 'kanal-1',
      sales_plattform_id: null,
      gruppierung: 'monatlich',
      zahlungsziel_tage: null,
    })
  })

  it('Standard-Gruppierung ist monatlich', () => {
    expect(makeDefaultEinstellung('x').gruppierung).toBe('monatlich')
  })

  it('Sales Plattform ist standardmäßig nicht gesetzt (null / "Keine")', () => {
    expect(makeDefaultEinstellung('x').sales_plattform_id).toBeNull()
  })

  it('Zahlungsziel ist standardmäßig leer (null)', () => {
    expect(makeDefaultEinstellung('x').zahlungsziel_tage).toBeNull()
  })
})
