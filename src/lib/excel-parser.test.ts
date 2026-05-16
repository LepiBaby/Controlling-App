import { describe, it, expect } from 'vitest'
import * as XLSX from 'xlsx'
import { parseGetMyInvoicesExcel } from './excel-parser'

const HEADERS = ['Dokumentendatum', 'Firma/Portal', 'Bruttobetrag', 'Nettobetrag', 'Steuerbetrag', 'Währung']

function makeXlsx(rows: unknown[][]): ArrayBuffer {
  const ws = XLSX.utils.aoa_to_sheet(rows)
  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, 'Sheet1')
  const buf = XLSX.write(wb, { type: 'array', bookType: 'xlsx' })
  return buf as ArrayBuffer
}

describe('parseGetMyInvoicesExcel', () => {
  // ─── Happy path ───────────────────────────────────────────────────────────

  it('parses a single valid EUR row correctly', () => {
    const buf = makeXlsx([
      HEADERS,
      ['15.01.2024', 'Amazon Ads', '556,73', '553,13', '3,60', 'EUR'],
    ])
    const result = parseGetMyInvoicesExcel(buf)
    expect(result.rows).toHaveLength(1)
    const row = result.rows[0]
    expect(row.leistungsdatum).toBe('2024-01-15')
    expect(row.beschreibung).toBe('Amazon Ads')
    expect(row.betrag_brutto).toBe(556.73)
    expect(row.ust_betrag).toBe(3.60)
    expect(row.waehrung).toBe('EUR')
    expect(row.istFremdwaehrung).toBe(false)
    expect(row.hatFehler).toBe(false)
    expect(result.skippedCount).toBe(0)
  })

  it('parses multiple rows', () => {
    const buf = makeXlsx([
      HEADERS,
      ['15.01.2024', 'Amazon Ads', '100,00', '84,03', '15,97', 'EUR'],
      ['20.01.2024', 'Google Ads', '200,00', '168,07', '31,93', 'EUR'],
    ])
    const result = parseGetMyInvoicesExcel(buf)
    expect(result.rows).toHaveLength(2)
    expect(result.rows[1].leistungsdatum).toBe('2024-01-20')
    expect(result.rows[1].beschreibung).toBe('Google Ads')
  })

  // ─── German number format ──────────────────────────────────────────────────

  it('handles German thousand-separator format (1.234,56)', () => {
    const buf = makeXlsx([
      HEADERS,
      ['15.01.2024', 'Test', '1.234,56', '1.037,44', '197,12', 'EUR'],
    ])
    const result = parseGetMyInvoicesExcel(buf)
    expect(result.rows[0].betrag_brutto).toBe(1234.56)
    expect(result.rows[0].ust_betrag).toBe(197.12)
  })

  it('handles numeric cell values (SheetJS already parsed to float)', () => {
    const buf = makeXlsx([
      HEADERS,
      ['15.01.2024', 'Test', 556.73, 553.13, 3.60, 'EUR'],
    ])
    const result = parseGetMyInvoicesExcel(buf)
    expect(result.rows[0].betrag_brutto).toBe(556.73)
    expect(result.rows[0].ust_betrag).toBe(3.60)
  })

  // ─── Date handling ─────────────────────────────────────────────────────────

  it('converts DD.MM.YYYY dates to ISO YYYY-MM-DD', () => {
    const buf = makeXlsx([
      HEADERS,
      ['01.03.2024', 'Test', '100,00', '84,03', '15,97', 'EUR'],
    ])
    const result = parseGetMyInvoicesExcel(buf)
    expect(result.rows[0].leistungsdatum).toBe('2024-03-01')
  })

  it('pads single-digit day and month correctly', () => {
    const buf = makeXlsx([
      HEADERS,
      ['5.7.2024', 'Test', '100,00', '84,03', '15,97', 'EUR'],
    ])
    const result = parseGetMyInvoicesExcel(buf)
    expect(result.rows[0].leistungsdatum).toBe('2024-07-05')
  })

  // ─── Foreign currency ──────────────────────────────────────────────────────

  it('marks non-EUR rows as Fremdwährung', () => {
    const buf = makeXlsx([
      HEADERS,
      ['15.01.2024', 'Shopify US', '100,00', '84,03', '15,97', 'USD'],
    ])
    const result = parseGetMyInvoicesExcel(buf)
    expect(result.rows[0].istFremdwaehrung).toBe(true)
    expect(result.rows[0].waehrung).toBe('USD')
  })

  it('does not mark EUR rows as Fremdwährung', () => {
    const buf = makeXlsx([
      HEADERS,
      ['15.01.2024', 'Test', '100,00', '84,03', '15,97', 'EUR'],
    ])
    const result = parseGetMyInvoicesExcel(buf)
    expect(result.rows[0].istFremdwaehrung).toBe(false)
  })

  // ─── No rows skipped (user requirement) ───────────────────────────────────

  it('includes rows with missing date (leistungsdatum = empty string)', () => {
    const buf = makeXlsx([
      HEADERS,
      [null, 'Test', '100,00', '84,03', '15,97', 'EUR'],
    ])
    const result = parseGetMyInvoicesExcel(buf)
    expect(result.rows).toHaveLength(1)
    expect(result.rows[0].leistungsdatum).toBe('')
  })

  it('includes rows with missing brutto (betrag_brutto = 0, hatFehler = true)', () => {
    const buf = makeXlsx([
      HEADERS,
      ['15.01.2024', 'Test', null, null, null, 'EUR'],
    ])
    const result = parseGetMyInvoicesExcel(buf)
    expect(result.rows).toHaveLength(1)
    expect(result.rows[0].betrag_brutto).toBe(0)
    expect(result.rows[0].hatFehler).toBe(true)
  })

  it('includes rows with empty Firma/Portal (beschreibung = empty string)', () => {
    const buf = makeXlsx([
      HEADERS,
      ['15.01.2024', null, '100,00', '84,03', '15,97', 'EUR'],
    ])
    const result = parseGetMyInvoicesExcel(buf)
    expect(result.rows).toHaveLength(1)
    expect(result.rows[0].beschreibung).toBe('')
  })

  it('skippedCount is always 0', () => {
    const buf = makeXlsx([
      HEADERS,
      [null, null, null, null, null, null],
      ['15.01.2024', 'Valid', '100,00', '84,03', '15,97', 'EUR'],
    ])
    const result = parseGetMyInvoicesExcel(buf)
    expect(result.rows).toHaveLength(2)
    expect(result.skippedCount).toBe(0)
  })

  // ─── hatFehler logic ───────────────────────────────────────────────────────

  it('sets hatFehler=true when betrag_brutto <= 0', () => {
    const buf = makeXlsx([
      HEADERS,
      ['15.01.2024', 'Test', '0', '0', '0', 'EUR'],
    ])
    const result = parseGetMyInvoicesExcel(buf)
    expect(result.rows[0].hatFehler).toBe(true)
  })

  it('sets hatFehler=true when ust_betrag >= betrag_brutto', () => {
    const buf = makeXlsx([
      HEADERS,
      ['15.01.2024', 'Test', '100,00', '-20,00', '120,00', 'EUR'],
    ])
    const result = parseGetMyInvoicesExcel(buf)
    expect(result.rows[0].hatFehler).toBe(true)
  })

  it('sets hatFehler=false when ust_betrag = 0 (0% tax rate is valid)', () => {
    const buf = makeXlsx([
      HEADERS,
      ['15.01.2024', 'Test', '100,00', '100,00', '0', 'EUR'],
    ])
    const result = parseGetMyInvoicesExcel(buf)
    expect(result.rows[0].hatFehler).toBe(false)
    expect(result.rows[0].ust_betrag).toBe(0)
  })

  // ─── Missing required columns ──────────────────────────────────────────────

  it('throws when Dokumentendatum column is missing', () => {
    const buf = makeXlsx([
      ['Firma/Portal', 'Bruttobetrag', 'Steuerbetrag'],
      ['Amazon', '100,00', '15,97'],
    ])
    expect(() => parseGetMyInvoicesExcel(buf)).toThrow("Spalte 'Dokumentendatum' nicht gefunden")
  })

  it('throws when Bruttobetrag column is missing', () => {
    const buf = makeXlsx([
      ['Dokumentendatum', 'Firma/Portal', 'Steuerbetrag'],
      ['15.01.2024', 'Test', '15,97'],
    ])
    expect(() => parseGetMyInvoicesExcel(buf)).toThrow("Spalte 'Bruttobetrag' nicht gefunden")
  })

  it('throws when Steuerbetrag column is missing', () => {
    const buf = makeXlsx([
      ['Dokumentendatum', 'Firma/Portal', 'Bruttobetrag'],
      ['15.01.2024', 'Test', '100,00'],
    ])
    expect(() => parseGetMyInvoicesExcel(buf)).toThrow("Spalte 'Steuerbetrag' nicht gefunden")
  })

  // ─── Empty / malformed files ───────────────────────────────────────────────

  it('throws when file has only a header row and no data', () => {
    const buf = makeXlsx([HEADERS])
    expect(() => parseGetMyInvoicesExcel(buf)).toThrow('Die Datei enthält keine Transaktionen')
  })

  it('assigns unique _id to each row', () => {
    const buf = makeXlsx([
      HEADERS,
      ['15.01.2024', 'Row 1', '100,00', '84,03', '15,97', 'EUR'],
      ['16.01.2024', 'Row 2', '200,00', '168,07', '31,93', 'EUR'],
    ])
    const result = parseGetMyInvoicesExcel(buf)
    expect(result.rows[0]._id).not.toBe(result.rows[1]._id)
  })
})
