import { describe, it, expect } from 'vitest'
import * as XLSX from 'xlsx'
import { parseFulfillmentCrowdExcel } from './fulfillment-crowd-parser'
import { KpiCategory } from '@/hooks/use-kpi-categories'

// ─── Helpers ──────────────────────────────────────────────────────────────────

function makeXlsx(rows: unknown[][]): ArrayBuffer {
  const ws = XLSX.utils.aoa_to_sheet(rows)
  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, 'Sheet1')
  return XLSX.write(wb, { type: 'array', bookType: 'xlsx' }) as ArrayBuffer
}

// Dispatched Orders Review requires 'Stock Store' as the header marker
function makeDispatchedXlsx(dataRows: unknown[][]): ArrayBuffer {
  return makeXlsx([
    ['Report Title', null, null, null, null],           // row 0: metadata
    ['Generated', '2026-05-01', null, null, null],      // row 1: metadata
    // row 2: header — must contain 'Stock Store' as marker
    ['Channel', 'Dispatched Date', 'Product', 'Quantity', 'Stock Store', 'Other Col'],
    ...dataRows,
  ])
}

// Stock Movement Report requires 'Date' as the header marker
function makeStockXlsx(dataRows: unknown[][]): ArrayBuffer {
  return makeXlsx([
    ['Report', null, null, null, null],
    ['From', '2026-05-01', null, null, null],
    ['To', '2026-05-31', null, null, null],
    ['Generated', '2026-05-01', null, null, null],
    ['Filter', null, null, null, null],
    // row 5: header — must contain 'Date' as marker
    ['Date', 'Product', 'Stage', 'Store', 'Quantity', 'Notes'],
    ...dataRows,
  ])
}

function makeSku(id: string, skuCode: string, parentId = 'prod-1'): KpiCategory {
  return {
    id,
    type: 'produkte',
    parent_id: parentId,
    name: `Product ${skuCode}`,
    sku_code: skuCode,
    level: 2,
    sort_order: 1,
    sales_plattform_enabled: false,
    produkt_enabled: true,
    kosten_label: null,
    ausgaben_label: null,
    ist_abzugsposten: false,
    ust_satz: null,
    exclude_from_rentabilitaet: false,
  }
}

function makePlattform(id: string, name: string): KpiCategory {
  return {
    id,
    type: 'sales_plattformen',
    parent_id: null,
    name,
    sku_code: null,
    level: 1,
    sort_order: 1,
    sales_plattform_enabled: true,
    produkt_enabled: false,
    kosten_label: null,
    ausgaben_label: null,
    ist_abzugsposten: false,
    ust_satz: null,
    exclude_from_rentabilitaet: false,
  }
}

const SKU_A = makeSku('sku-a', 'SKU-A')
const SKU_B = makeSku('sku-b', 'SKU-B')
const PLATTFORM_AMAZON = makePlattform('plt-amazon', 'Amazon')
const PLATTFORM_EBAY = makePlattform('plt-ebay', 'eBay')

const EMPTY_DISP = makeDispatchedXlsx([])
const EMPTY_STOCK = makeStockXlsx([])

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('parseFulfillmentCrowdExcel', () => {

  describe('happy path — dispatched orders', () => {
    it('aggregates dispatched quantities per date and SKU', () => {
      const disp = makeDispatchedXlsx([
        ['Amazon DE', '01/05/2026', 'SKU-A', 3, null, null],
        ['Amazon DE', '01/05/2026', 'SKU-A', 2, null, null], // same day, same SKU → sum
      ])
      const { entries } = parseFulfillmentCrowdExcel(disp, EMPTY_STOCK, [SKU_A], [PLATTFORM_AMAZON])
      expect(entries).toHaveLength(1)
      expect(entries[0].sendungenByPlattformId['plt-amazon']).toBe(5)
    })

    it('maps "Manually Entered Order" channel to sendungen_manuell', () => {
      const disp = makeDispatchedXlsx([
        ['Manually Entered Orders', '01/05/2026', 'SKU-A', 4, null, null],
      ])
      const { entries } = parseFulfillmentCrowdExcel(disp, EMPTY_STOCK, [SKU_A], [PLATTFORM_AMAZON])
      expect(entries[0].sendungen_manuell).toBe(4)
      expect(Object.keys(entries[0].sendungenByPlattformId)).toHaveLength(0)
    })

    it('maps channel via case-insensitive substring match against platform name', () => {
      const disp = makeDispatchedXlsx([
        ['amazon.de marketplace', '01/05/2026', 'SKU-A', 7, null, null],
      ])
      const { entries } = parseFulfillmentCrowdExcel(disp, EMPTY_STOCK, [SKU_A], [PLATTFORM_AMAZON])
      expect(entries[0].sendungenByPlattformId['plt-amazon']).toBe(7)
    })

    it('reports unknown channels that cannot be mapped', () => {
      const disp = makeDispatchedXlsx([
        ['Zalando Shop', '01/05/2026', 'SKU-A', 5, null, null],
      ])
      const { unknownChannels } = parseFulfillmentCrowdExcel(disp, EMPTY_STOCK, [SKU_A], [PLATTFORM_AMAZON])
      expect(unknownChannels).toContain('Zalando Shop')
    })

    it('aggregates multiple channels per day per SKU', () => {
      const disp = makeDispatchedXlsx([
        ['Amazon DE', '01/05/2026', 'SKU-A', 3, null, null],
        ['eBay Store', '01/05/2026', 'SKU-A', 2, null, null],
        ['Manually Entered Orders', '01/05/2026', 'SKU-A', 1, null, null],
      ])
      const { entries } = parseFulfillmentCrowdExcel(disp, EMPTY_STOCK, [SKU_A], [PLATTFORM_AMAZON, PLATTFORM_EBAY])
      expect(entries).toHaveLength(1)
      expect(entries[0].sendungenByPlattformId['plt-amazon']).toBe(3)
      expect(entries[0].sendungenByPlattformId['plt-ebay']).toBe(2)
      expect(entries[0].sendungen_manuell).toBe(1)
    })
  })

  describe('happy path — stock movement stages', () => {
    it('maps Transfer Complete (non-quarantine) to einlagerungen', () => {
      const stock = makeStockXlsx([
        ['2026-05-01', 'SKU-A', 'Transfer Complete', 'Main Warehouse', 10, null],
      ])
      const { entries } = parseFulfillmentCrowdExcel(EMPTY_DISP, stock, [SKU_A], [])
      expect(entries[0].einlagerungen).toBe(10)
    })

    it('maps Transfer Complete (quarantine store) to warenverluste', () => {
      const stock = makeStockXlsx([
        ['2026-05-01', 'SKU-A', 'Transfer Complete', 'UK Quarantine Store', 5, null],
      ])
      const { entries } = parseFulfillmentCrowdExcel(EMPTY_DISP, stock, [SKU_A], [])
      expect(entries[0].warenverluste).toBe(5)
      expect(entries[0].einlagerungen).toBe(0)
    })

    it('maps Positive Stock Adjustment to anpassungen_positiv', () => {
      const stock = makeStockXlsx([
        ['2026-05-01', 'SKU-A', 'Positive Stock Adjustment', 'Main Warehouse', 3, null],
      ])
      const { entries } = parseFulfillmentCrowdExcel(EMPTY_DISP, stock, [SKU_A], [])
      expect(entries[0].anpassungen_positiv).toBe(3)
    })

    it('maps Negative Stock Adjustment to anpassungen_negativ', () => {
      const stock = makeStockXlsx([
        ['2026-05-01', 'SKU-A', 'Negative Stock Adjustment', 'Main Warehouse', 2, null],
      ])
      const { entries } = parseFulfillmentCrowdExcel(EMPTY_DISP, stock, [SKU_A], [])
      expect(entries[0].anpassungen_negativ).toBe(2)
    })

    it('ignores Dispatched stage rows', () => {
      const stock = makeStockXlsx([
        ['2026-05-01', 'SKU-A', 'Dispatched', 'Main Warehouse', 99, null],
      ])
      const { entries } = parseFulfillmentCrowdExcel(EMPTY_DISP, stock, [SKU_A], [])
      expect(entries).toHaveLength(0)
    })

    it('ignores Cancelled Requires Restock stage rows', () => {
      const stock = makeStockXlsx([
        ['2026-05-01', 'SKU-A', 'Cancelled Requires Restock', 'Main Warehouse', 5, null],
      ])
      const { entries } = parseFulfillmentCrowdExcel(EMPTY_DISP, stock, [SKU_A], [])
      expect(entries).toHaveLength(0)
    })

    it('ignores Positive Stock Adjustment in quarantine store (anpassungen_positiv stays 0)', () => {
      const stock = makeStockXlsx([
        ['2026-05-01', 'SKU-A', 'Positive Stock Adjustment', 'Quarantine Store', 8, null],
      ])
      const { entries } = parseFulfillmentCrowdExcel(EMPTY_DISP, stock, [SKU_A], [])
      // A zero-value entry is still created (spec: "Alle Werte = 0 → Zeile trotzdem angezeigt")
      // but the quarantine adjustment does NOT count as anpassungen_positiv
      expect(entries[0].anpassungen_positiv).toBe(0)
    })

    it('aggregates multiple stock rows for same date/SKU', () => {
      const stock = makeStockXlsx([
        ['2026-05-01', 'SKU-A', 'Transfer Complete', 'Main', 10, null],
        ['2026-05-01', 'SKU-A', 'Transfer Complete', 'Secondary', 5, null],
      ])
      const { entries } = parseFulfillmentCrowdExcel(EMPTY_DISP, stock, [SKU_A], [])
      expect(entries[0].einlagerungen).toBe(15)
    })
  })

  describe('SKU validation', () => {
    it('reports SKUs from dispatched file not in KPI model', () => {
      const disp = makeDispatchedXlsx([
        ['Amazon DE', '01/05/2026', 'UNKNOWN-SKU', 3, null, null],
      ])
      const { unknownSkus } = parseFulfillmentCrowdExcel(disp, EMPTY_STOCK, [SKU_A], [PLATTFORM_AMAZON])
      expect(unknownSkus).toContain('UNKNOWN-SKU')
    })

    it('reports SKUs from stock file not in KPI model', () => {
      const stock = makeStockXlsx([
        ['2026-05-01', 'GHOST-SKU', 'Transfer Complete', 'Main', 5, null],
      ])
      const { unknownSkus } = parseFulfillmentCrowdExcel(EMPTY_DISP, stock, [SKU_A], [])
      expect(unknownSkus).toContain('GHOST-SKU')
    })

    it('returns no unknownSkus when all SKUs are known', () => {
      const disp = makeDispatchedXlsx([
        ['Amazon DE', '01/05/2026', 'SKU-A', 1, null, null],
      ])
      const { unknownSkus } = parseFulfillmentCrowdExcel(disp, EMPTY_STOCK, [SKU_A], [PLATTFORM_AMAZON])
      expect(unknownSkus).toHaveLength(0)
    })
  })

  describe('multi-SKU and multi-day', () => {
    it('creates separate entries per SKU per date', () => {
      const disp = makeDispatchedXlsx([
        ['Amazon DE', '01/05/2026', 'SKU-A', 2, null, null],
        ['Amazon DE', '01/05/2026', 'SKU-B', 3, null, null],
        ['Amazon DE', '02/05/2026', 'SKU-A', 1, null, null],
      ])
      const { entries } = parseFulfillmentCrowdExcel(disp, EMPTY_STOCK, [SKU_A, SKU_B], [PLATTFORM_AMAZON])
      expect(entries).toHaveLength(3)
    })

    it('sorts entries by skuCode ASC then datum ASC', () => {
      const disp = makeDispatchedXlsx([
        ['Amazon DE', '03/05/2026', 'SKU-A', 1, null, null],
        ['Amazon DE', '01/05/2026', 'SKU-B', 1, null, null],
        ['Amazon DE', '01/05/2026', 'SKU-A', 1, null, null],
      ])
      const { entries } = parseFulfillmentCrowdExcel(disp, EMPTY_STOCK, [SKU_A, SKU_B], [PLATTFORM_AMAZON])
      expect(entries[0].skuCode).toBe('SKU-A')
      expect(entries[0].datum).toBe('2026-05-01')
      expect(entries[1].skuCode).toBe('SKU-A')
      expect(entries[1].datum).toBe('2026-05-03')
      expect(entries[2].skuCode).toBe('SKU-B')
    })
  })

  describe('date parsing', () => {
    it('parses DD/MM/YYYY date strings', () => {
      const disp = makeDispatchedXlsx([
        ['Amazon DE', '04/05/2026', 'SKU-A', 1, null, null],
      ])
      const { entries } = parseFulfillmentCrowdExcel(disp, EMPTY_STOCK, [SKU_A], [PLATTFORM_AMAZON])
      expect(entries[0].datum).toBe('2026-05-04')
    })

    it('parses ISO date strings from stock movement', () => {
      const stock = makeStockXlsx([
        ['2026-05-15', 'SKU-A', 'Transfer Complete', 'Main', 5, null],
      ])
      const { entries } = parseFulfillmentCrowdExcel(EMPTY_DISP, stock, [SKU_A], [])
      expect(entries[0].datum).toBe('2026-05-15')
    })

    it('parses JS Date objects (cellDates mode)', () => {
      // XLSX with cellDates:true returns Date objects — simulate by using aoa_to_sheet with Date values
      const ws = XLSX.utils.aoa_to_sheet([
        ['Report', null, null, null, null],
        ['Channel', 'Dispatched Date', 'Product', 'Quantity', 'Stock Store'],
        ['Amazon DE', new Date(2026, 4, 10), 'SKU-A', 2, 'WH1'], // May 10, 2026
      ])
      const wb = XLSX.utils.book_new()
      XLSX.utils.book_append_sheet(wb, ws, 'Sheet1')
      const buf = XLSX.write(wb, { type: 'array', bookType: 'xlsx' }) as ArrayBuffer
      const { entries } = parseFulfillmentCrowdExcel(buf, EMPTY_STOCK, [SKU_A], [PLATTFORM_AMAZON])
      expect(entries[0].datum).toBe('2026-05-10')
    })
  })

  describe('edge cases', () => {
    it('returns empty entries when both files have no data rows', () => {
      const { entries } = parseFulfillmentCrowdExcel(EMPTY_DISP, EMPTY_STOCK, [SKU_A], [PLATTFORM_AMAZON])
      expect(entries).toHaveLength(0)
    })

    it('creates entry from stock data even if no dispatched data for that day', () => {
      const stock = makeStockXlsx([
        ['2026-05-01', 'SKU-A', 'Transfer Complete', 'Main', 20, null],
      ])
      const { entries } = parseFulfillmentCrowdExcel(EMPTY_DISP, stock, [SKU_A], [])
      expect(entries).toHaveLength(1)
      expect(entries[0].einlagerungen).toBe(20)
      expect(entries[0].sendungen_manuell).toBe(0)
    })

    it('creates entry from dispatched data even if no stock data for that day', () => {
      const disp = makeDispatchedXlsx([
        ['Amazon DE', '01/05/2026', 'SKU-A', 5, null, null],
      ])
      const { entries } = parseFulfillmentCrowdExcel(disp, EMPTY_STOCK, [SKU_A], [PLATTFORM_AMAZON])
      expect(entries).toHaveLength(1)
      expect(entries[0].sendungenByPlattformId['plt-amazon']).toBe(5)
      expect(entries[0].einlagerungen).toBe(0)
    })

    it('skips dispatched rows with zero quantity', () => {
      const disp = makeDispatchedXlsx([
        ['Amazon DE', '01/05/2026', 'SKU-A', 0, null, null],
      ])
      const { entries } = parseFulfillmentCrowdExcel(disp, EMPTY_STOCK, [SKU_A], [PLATTFORM_AMAZON])
      expect(entries).toHaveLength(0)
    })

    it('rounds fractional quantities to integers', () => {
      const stock = makeStockXlsx([
        ['2026-05-01', 'SKU-A', 'Transfer Complete', 'Main', 3.7, null],
      ])
      const { entries } = parseFulfillmentCrowdExcel(EMPTY_DISP, stock, [SKU_A], [])
      expect(entries[0].einlagerungen).toBe(4) // Math.round(3.7) = 4
    })

    it('matches channel case-insensitively', () => {
      const disp = makeDispatchedXlsx([
        ['AMAZON DE MARKETPLACE', '01/05/2026', 'SKU-A', 2, null, null],
      ])
      const { entries, unknownChannels } = parseFulfillmentCrowdExcel(disp, EMPTY_STOCK, [SKU_A], [PLATTFORM_AMAZON])
      expect(unknownChannels).toHaveLength(0)
      expect(entries[0].sendungenByPlattformId['plt-amazon']).toBe(2)
    })

    it('detects manually channel case-insensitively', () => {
      const disp = makeDispatchedXlsx([
        ['MANUALLY ENTERED ORDERS', '01/05/2026', 'SKU-A', 3, null, null],
      ])
      const { entries, unknownChannels } = parseFulfillmentCrowdExcel(disp, EMPTY_STOCK, [SKU_A], [PLATTFORM_AMAZON])
      expect(unknownChannels).toHaveLength(0)
      expect(entries[0].sendungen_manuell).toBe(3)
    })

    it('combines dispatched and stock data for the same date/SKU into one entry', () => {
      const disp = makeDispatchedXlsx([
        ['Amazon DE', '01/05/2026', 'SKU-A', 5, null, null],
      ])
      const stock = makeStockXlsx([
        ['2026-05-01', 'SKU-A', 'Transfer Complete', 'Main', 10, null],
        ['2026-05-01', 'SKU-A', 'Positive Stock Adjustment', 'Main', 2, null],
      ])
      const { entries } = parseFulfillmentCrowdExcel(disp, stock, [SKU_A], [PLATTFORM_AMAZON])
      expect(entries).toHaveLength(1)
      expect(entries[0].sendungenByPlattformId['plt-amazon']).toBe(5)
      expect(entries[0].einlagerungen).toBe(10)
      expect(entries[0].anpassungen_positiv).toBe(2)
    })
  })
})
