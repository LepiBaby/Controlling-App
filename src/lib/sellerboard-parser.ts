import * as XLSX from 'xlsx'
import { KpiCategory } from '@/hooks/use-kpi-categories'

export interface SellerboardAggregatedRow {
  date: string
  productId: string
  productName: string
  skus: string[]
  salesOrganic: number
  salesPPC: number
  salesSponsoredProducts: number
  salesSponsoredDisplay: number
  unitsOrganic: number
  unitsPPC: number
  unitsSponsoredProducts: number
  unitsSponsoredDisplay: number
  promoValue: number
  sponsoredProducts: number
  sponsoredDisplay: number
  sponsoredBrands: number
  sponsoredBrandsVideo: number
  shipping: number
  commission: number
  refundCommission: number
  refundRefundCommission: number
  refundPrincipal: number
}

export interface SellerboardParseResult {
  aggregatedRows: SellerboardAggregatedRow[]
  unknownSkus: string[]
  dateRange: { von: string; bis: string } | null
}

// Normalize header names: lowercase + replace Cyrillic lookalikes with Latin
const CYRILLIC_MAP: Record<string, string> = {
  'А': 'A', 'В': 'B', 'С': 'C', 'е': 'e',
  'О': 'O', 'Р': 'R', 'Т': 'T', 'х': 'x',
}

function normalizeHeader(s: string): string {
  return s.split('').map(c => CYRILLIC_MAP[c] ?? c).join('').toLowerCase().trim()
}

function parseNum(v: unknown): number {
  if (v === null || v === undefined || v === '') return 0
  if (typeof v === 'number') return Math.round(v * 100) / 100
  const s = String(v).trim().replace(',', '.')
  const n = parseFloat(s)
  return isNaN(n) ? 0 : Math.round(n * 100) / 100
}

function parseDate(v: unknown): string | null {
  if (!v) return null
  if (v instanceof Date) {
    const yyyy = v.getFullYear()
    const mm = String(v.getMonth() + 1).padStart(2, '0')
    const dd = String(v.getDate()).padStart(2, '0')
    return `${yyyy}-${mm}-${dd}`
  }
  const s = String(v).trim()
  const m = s.match(/^(\d{1,2})\.(\d{1,2})\.(\d{4})$/)
  if (m) return `${m[3]}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}`
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s
  return null
}

export function parseSellerboardExcel(
  buffer: ArrayBuffer,
  produkteKategorien: KpiCategory[],
): SellerboardParseResult {
  const wb = XLSX.read(buffer, { type: 'array', cellDates: true })
  const sheetName = wb.SheetNames[0]
  if (!sheetName) throw new Error('Die Datei enthält keine Tabellen.')

  const ws = wb.Sheets[sheetName]
  const rawRows = XLSX.utils.sheet_to_json<unknown[]>(ws, { header: 1 })
  if (rawRows.length === 0) throw new Error('Die Datei enthält keine Daten.')

  const headerRow = rawRows[0] as unknown[]
  const headers = headerRow.map(h => String(h ?? '').trim())
  const normalizedHeaders = headers.map(normalizeHeader)

  const idx = (name: string): number => {
    const norm = normalizeHeader(name)
    return normalizedHeaders.indexOf(norm)
  }

  for (const col of ['Date', 'SKU']) {
    if (idx(col) < 0) {
      throw new Error(`Spalte '${col}' nicht gefunden — bitte eine Sellerboard-Excel hochladen.`)
    }
  }

  const dataRows = rawRows.slice(1)
  if (dataRows.length === 0) {
    throw new Error('Die Datei enthält keine Transaktionen (nur Kopfzeile vorhanden).')
  }

  // Build SKU → Product mapping from KPI model
  const skuToProduct = new Map<string, { productId: string; productName: string }>()
  const level1Products = produkteKategorien.filter(c => c.level === 1)
  for (const skuEntry of produkteKategorien.filter(c => c.level === 2 && c.sku_code)) {
    const product = level1Products.find(p => p.id === skuEntry.parent_id)
    if (product && skuEntry.sku_code) {
      skuToProduct.set(skuEntry.sku_code, { productId: product.id, productName: product.name })
    }
  }

  const aggregateMap = new Map<string, SellerboardAggregatedRow>()
  const unknownSkus = new Set<string>()
  const allDates: string[] = []

  const col = (name: string, row: unknown[]): unknown => {
    const i = idx(name)
    return i >= 0 ? row[i] : undefined
  }

  for (const rawRow of dataRows) {
    const row = rawRow as unknown[]
    const date = parseDate(col('Date', row))
    const sku = String(col('SKU', row) ?? '').trim()

    if (!date || !sku) continue

    const productInfo = skuToProduct.get(sku)
    if (!productInfo) {
      unknownSkus.add(sku)
      continue
    }

    allDates.push(date)
    const key = `${date}::${productInfo.productId}`

    if (!aggregateMap.has(key)) {
      aggregateMap.set(key, {
        date,
        productId: productInfo.productId,
        productName: productInfo.productName,
        skus: [],
        salesOrganic: 0, salesPPC: 0, salesSponsoredProducts: 0, salesSponsoredDisplay: 0,
        unitsOrganic: 0, unitsPPC: 0, unitsSponsoredProducts: 0, unitsSponsoredDisplay: 0,
        promoValue: 0,
        sponsoredProducts: 0, sponsoredDisplay: 0, sponsoredBrands: 0, sponsoredBrandsVideo: 0,
        shipping: 0,
        commission: 0, refundCommission: 0, refundRefundCommission: 0, refundPrincipal: 0,
      })
    }

    const agg = aggregateMap.get(key)!
    if (!agg.skus.includes(sku)) agg.skus.push(sku)

    agg.salesOrganic           += parseNum(col('SalesOrganic', row))
    agg.salesPPC               += parseNum(col('SalesPPC', row))
    agg.salesSponsoredProducts += parseNum(col('SalesSponsoredProducts', row))
    agg.salesSponsoredDisplay  += parseNum(col('SalesSponsoredDisplay', row))
    agg.unitsOrganic           += parseNum(col('UnitsOrganic', row))
    agg.unitsPPC               += parseNum(col('UnitsPPC', row))
    agg.unitsSponsoredProducts += parseNum(col('UnitsSponsoredProducts', row))
    agg.unitsSponsoredDisplay  += parseNum(col('UnitsSponsoredDisplay', row))
    agg.promoValue             += parseNum(col('PromoValue', row))
    agg.sponsoredProducts      += parseNum(col('SponsoredProducts', row))
    agg.sponsoredDisplay       += parseNum(col('SponsoredDisplay', row))
    agg.sponsoredBrands        += parseNum(col('SponsoredBrands', row))
    agg.sponsoredBrandsVideo   += parseNum(col('SponsoredBrandsVideo', row))
    agg.shipping               += parseNum(col('Shipping', row))
    agg.commission             += parseNum(col('Commission', row))
    agg.refundCommission       += parseNum(col('Refund Commission', row))
    agg.refundRefundCommission += parseNum(col('Refund RefundCommission', row))
    agg.refundPrincipal        += parseNum(col('Refund Principal', row))
  }

  const aggregatedRows = Array.from(aggregateMap.values())
    .sort((a, b) => a.date.localeCompare(b.date) || a.productName.localeCompare(b.productName))

  const sortedDates = [...allDates].sort()
  const dateRange = sortedDates.length > 0
    ? { von: sortedDates[0], bis: sortedDates[sortedDates.length - 1] }
    : null

  return { aggregatedRows, unknownSkus: Array.from(unknownSkus), dateRange }
}
