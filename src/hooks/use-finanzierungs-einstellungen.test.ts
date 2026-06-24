import { describe, it, expect } from 'vitest'
import {
  berechneNettoMonatlich,
  formatFaelligkeitsMonate,
} from './use-finanzierungs-einstellungen'

// ─── berechneNettoMonatlich ──────────────────────────────────────────────────

describe('berechneNettoMonatlich', () => {
  it('gibt netto unverändert zurück bei monatlicher Frequenz', () => {
    expect(berechneNettoMonatlich(500, 'monatlich')).toBe(500)
  })

  it('teilt durch 3 bei quartalsweiser Frequenz', () => {
    expect(berechneNettoMonatlich(300, 'quartalsweise')).toBeCloseTo(100)
  })

  it('teilt durch 12 bei jährlicher Frequenz', () => {
    expect(berechneNettoMonatlich(1200, 'jaehrlich')).toBeCloseTo(100)
  })

  it('berechnet korrekt bei nicht-glatten Beträgen (quartalsweise)', () => {
    expect(berechneNettoMonatlich(1000, 'quartalsweise')).toBeCloseTo(333.33, 1)
  })

  it('berechnet korrekt bei nicht-glatten Beträgen (jährlich)', () => {
    expect(berechneNettoMonatlich(1000, 'jaehrlich')).toBeCloseTo(83.33, 1)
  })

  it('gibt 0 zurück bei Nettobetrag 0 (monatlich)', () => {
    expect(berechneNettoMonatlich(0, 'monatlich')).toBe(0)
  })

  it('gibt 0 zurück bei Nettobetrag 0 (jährlich)', () => {
    expect(berechneNettoMonatlich(0, 'jaehrlich')).toBe(0)
  })
})

// ─── formatFaelligkeitsMonate ────────────────────────────────────────────────

describe('formatFaelligkeitsMonate', () => {
  it('gibt "Alle Monate" zurück bei monatlicher Frequenz', () => {
    expect(formatFaelligkeitsMonate([], 'monatlich')).toBe('Alle Monate')
  })

  it('gibt "Alle Monate" zurück bei monatlicher Frequenz mit leerer Liste', () => {
    expect(formatFaelligkeitsMonate([], 'monatlich')).toBe('Alle Monate')
  })

  it('gibt kurzen Monatsnamen zurück bei jährlicher Frequenz', () => {
    expect(formatFaelligkeitsMonate([3], 'jaehrlich')).toBe('Mär')
  })

  it('gibt kommagetrennte kurze Monatsnamen zurück bei quartalsweiser Frequenz', () => {
    expect(formatFaelligkeitsMonate([2, 5, 8, 11], 'quartalsweise')).toBe('Feb, Mai, Aug, Nov')
  })

  it('sortiert Monate aufsteigend bei quartalsweiser Frequenz', () => {
    expect(formatFaelligkeitsMonate([11, 2, 8, 5], 'quartalsweise')).toBe('Feb, Mai, Aug, Nov')
  })

  it('gibt korrekten Namen für Januar zurück', () => {
    expect(formatFaelligkeitsMonate([1], 'jaehrlich')).toBe('Jan')
  })

  it('gibt korrekten Namen für Dezember zurück', () => {
    expect(formatFaelligkeitsMonate([12], 'jaehrlich')).toBe('Dez')
  })

  it('gibt korrekte quartalsweise Ausgabe mit Q1/Q2/Q3/Q4 Auswahl zurück', () => {
    expect(formatFaelligkeitsMonate([1, 4, 7, 10], 'quartalsweise')).toBe('Jan, Apr, Jul, Okt')
  })
})
