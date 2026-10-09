import { describe, it, expect } from 'vitest'
import { berechneTilgungsplan } from './finanzierung-tilgungsplan'

describe('berechneTilgungsplan', () => {
  it('verteilt die Tilgung gleichmäßig und berechnet Zinsen auf die Restschuld zum Monatsanfang', () => {
    const plan = berechneTilgungsplan({
      betrag: 12000, zinssatz: 6, laufzeit_monate: 12, tilgungsfrei_monate: 0, start_jahr: 2026, start_monat: 1,
    })
    expect(plan).toHaveLength(12)
    expect(plan[0]).toMatchObject({ jahr: 2026, monat: 1, restschuldAnfang: 12000, zinsen: 60, tilgung: 1000 })
    expect(plan[1]).toMatchObject({ restschuldAnfang: 11000, zinsen: 55, tilgung: 1000 })
    expect(plan[11]).toMatchObject({ restschuldAnfang: 1000, zinsen: 5, tilgung: 1000 })
  })

  it('tilgt in den tilgungsfreien Monaten nichts, zahlt aber Zinsen auf das volle Volumen', () => {
    const plan = berechneTilgungsplan({
      betrag: 10000, zinssatz: 12, laufzeit_monate: 6, tilgungsfrei_monate: 2, start_jahr: 2026, start_monat: 11,
    })
    expect(plan.map(p => p.tilgung)).toEqual([0, 0, 2500, 2500, 2500, 2500])
    expect(plan[0].zinsen).toBe(100)
    expect(plan[1].zinsen).toBe(100)
    expect(plan[2]).toMatchObject({ jahr: 2027, monat: 1, zinsen: 100 })
    expect(plan[3].zinsen).toBe(75)
  })

  it('gleicht Rundungsdifferenzen in der letzten Rate aus', () => {
    const plan = berechneTilgungsplan({
      betrag: 1000, zinssatz: 0, laufzeit_monate: 3, tilgungsfrei_monate: 0, start_jahr: 2026, start_monat: 1,
    })
    expect(plan.map(p => p.tilgung)).toEqual([333.33, 333.33, 333.34])
    expect(plan.every(p => p.zinsen === 0)).toBe(true)
  })
})
