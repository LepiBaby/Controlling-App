import * as XLSX from 'xlsx'
import { KpiCategory } from '@/hooks/use-kpi-categories'

// ─── Public Types ─────────────────────────────────────────────────────────────

export interface FcRawDayEntry {
  skuCode: string
  datum: string // YYYY-MM-DD
  sendungenByPlattformId: Record<string, number> // plattform_id -> menge
  sendungen_manuell: number
  einlagerungen: number
  anpassungen_positiv: number
  anpassungen_negativ: number
  warenverluste: number
}

export interface FcParseResult {
  entries: FcRawDayEntry[]
  unknownSkus: string[]
  unknownChannels: string[]
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function toIsoDate(v: unknown): string | null {
  if (v instanceof Date) {
    if (isNaN(v.getTime())) return null
    const y = v.getFullYear()
    const m = String(v.getMonth() + 1).padStart(2, '0')
    const d = String(v.getDate()).padStart(2, '0')
    return `${y}-${m}-${d}`
  }
  if (typeof v === 'string') {
    const s = v.trim()
    // DD/MM/YYYY
    const ddmm = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/)
    if (ddmm) return `${ddmm[3]}-${ddmm[2].padStart(2, '0')}-${ddmm[1].padStart(2, '0')}`
    // YYYY-MM-DD
    if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.slice(0, 10)
  }
  if (typeof v === 'number' && v > 0) {
    try {
      const d = XLSX.SSF.parse_date_code(v)
      if (d) return `${d.y}-${String(d.m).padStart(2, '0')}-${String(d.d).padStart(2, '0')}`
    } catch {
      return null
    }
  }
  return null
}

function parseNum(v: unknown): number {
  if (typeof v === 'number') return v
  if (typeof v === 'string') {
    const n = parseFloat(v.trim().replace(',', '.'))
    return isNaN(n) ? 0 : n
  }
  return 0
}

type RawRow = unknown[]

function getColIdx(row: RawRow): Record<string, number> {
  const idx: Record<string, number> = {}
  row.forEach((v, i) => {
    if (typeof v === 'string') idx[v.trim()] = i
  })
  return idx
}

function findHeader(rows: RawRow[], marker: string): { rowIdx: number; cols: Record<string, number> } | null {
  for (let i = 0; i < Math.min(rows.length, 15); i++) {
    const row = rows[i]
    if (!row) continue
    const cols = getColIdx(row)
    if (cols[marker] !== undefined) return { rowIdx: i, cols }
  }
  return null
}

// ─── Main Parser ──────────────────────────────────────────────────────────────

export function parseFulfillmentCrowdExcel(
  dispatchedBuffer: ArrayBuffer,
  stockMovementBuffer: ArrayBuffer,
  skuCategories: KpiCategory[],     // type='produkte', level=2
  plattformCategories: KpiCategory[], // type='sales_plattformen', level=1
): FcParseResult {
  // Build SKU lookup
  const skuMap = new Map<string, KpiCategory>()
  for (const sku of skuCategories) {
    if (sku.sku_code) skuMap.set(sku.sku_code.trim(), sku)
  }

  // ── Parse Dispatched Orders Review ────────────────────────────────────────
  const dispWb = XLSX.read(dispatchedBuffer, { type: 'array', cellDates: true })
  const dispRows: RawRow[] = XLSX.utils.sheet_to_json(dispWb.Sheets[dispWb.SheetNames[0]], {
    header: 1,
    defval: null,
  })

  // channelTotals[datum][skuCode][channelName] = total quantity
  const channelTotals: Record<string, Record<string, Record<string, number>>> = {}
  const seenChannels = new Set<string>()
  const seenSkus = new Set<string>()

  const dispHeader = findHeader(dispRows, 'Stock Store')
  if (dispHeader) {
    const { rowIdx, cols } = dispHeader
    const channelCol = cols['Channel'] ?? -1
    const dateCol = cols['Dispatched Date'] ?? cols['Packed Date'] ?? -1
    const productCol = cols['Product'] ?? -1
    const qtyCol = cols['Quantity'] ?? -1

    for (let i = rowIdx + 1; i < dispRows.length; i++) {
      const row = dispRows[i]
      if (!row) continue
      const channel = String(row[channelCol] ?? '').trim()
      const datum = toIsoDate(row[dateCol])
      const skuCode = String(row[productCol] ?? '').trim()
      const qty = Math.round(parseNum(row[qtyCol]))

      if (!channel || !datum || !skuCode || qty === 0) continue

      seenChannels.add(channel)
      seenSkus.add(skuCode)

      if (!channelTotals[datum]) channelTotals[datum] = {}
      if (!channelTotals[datum][skuCode]) channelTotals[datum][skuCode] = {}
      channelTotals[datum][skuCode][channel] = (channelTotals[datum][skuCode][channel] ?? 0) + qty
    }
  }

  // ── Parse Stock Movement Report ────────────────────────────────────────────
  const stockWb = XLSX.read(stockMovementBuffer, { type: 'array', cellDates: true })
  const stockRows: RawRow[] = XLSX.utils.sheet_to_json(stockWb.Sheets[stockWb.SheetNames[0]], {
    header: 1,
    defval: null,
  })

  // stockAgg[datum][skuCode] = { einlagerungen, anp_pos, anp_neg, warenverluste }
  const stockAgg: Record<string, Record<string, {
    einlagerungen: number
    anpassungen_positiv: number
    anpassungen_negativ: number
    warenverluste: number
  }>> = {}

  const stockHeader = findHeader(stockRows, 'Date')
  if (stockHeader) {
    const { rowIdx, cols } = stockHeader
    // 'Store ' may have trailing space in the Excel file
    const dateCol = cols['Date'] ?? -1
    const productCol = cols['Product'] ?? -1
    const stageCol = cols['Stage'] ?? -1
    const storeCol = cols['Store '] ?? cols['Store'] ?? -1
    const qtyCol = cols['Quantity'] ?? -1

    for (let i = rowIdx + 1; i < stockRows.length; i++) {
      const row = stockRows[i]
      if (!row) continue
      const datum = toIsoDate(row[dateCol])
      const skuCode = String(row[productCol] ?? '').trim()
      const stage = String(row[stageCol] ?? '').trim()
      const store = String(row[storeCol] ?? '').trim()
      const qty = Math.round(parseNum(row[qtyCol]))

      if (!datum || !skuCode || !stage || qty === 0) continue
      if (stage === 'Dispatched' || stage === 'Cancelled Requires Restock') continue

      seenSkus.add(skuCode)

      const isQuarantine = store.toLowerCase().includes('quarantine')

      if (!stockAgg[datum]) stockAgg[datum] = {}
      if (!stockAgg[datum][skuCode]) {
        stockAgg[datum][skuCode] = {
          einlagerungen: 0,
          anpassungen_positiv: 0,
          anpassungen_negativ: 0,
          warenverluste: 0,
        }
      }

      const s = stockAgg[datum][skuCode]
      if (stage === 'Transfer Complete') {
        if (isQuarantine) s.warenverluste += qty
        else s.einlagerungen += qty
      } else if (stage === 'Positive Stock Adjustments' && !isQuarantine) {
        s.anpassungen_positiv += qty
      } else if (stage === 'Restocking Adjustments' && !isQuarantine) {
        s.anpassungen_negativ += qty
      }
    }
  }

  // ── Validate SKUs ─────────────────────────────────────────────────────────
  const unknownSkus = [...seenSkus].filter(c => !skuMap.has(c)).sort()

  // ── Map Channels to Platform IDs ──────────────────────────────────────────
  const unknownChannels: string[] = []
  // null = sendungen_manuell, string = plattform_id
  const channelToPlattformId = new Map<string, string | null>()

  for (const channelName of seenChannels) {
    if (channelName.toLowerCase().includes('manually')) {
      channelToPlattformId.set(channelName, null)
      continue
    }
    const lower = channelName.toLowerCase()
    const match = plattformCategories.find(p => lower.includes(p.name.toLowerCase()))
    if (match) {
      channelToPlattformId.set(channelName, match.id)
    } else {
      unknownChannels.push(channelName)
    }
  }

  // ── Build unified entries ─────────────────────────────────────────────────
  const allDates = new Set([
    ...Object.keys(channelTotals),
    ...Object.keys(stockAgg),
  ])
  const allSkuCodes = new Set([
    ...Object.values(channelTotals).flatMap(d => Object.keys(d)),
    ...Object.values(stockAgg).flatMap(d => Object.keys(d)),
  ])

  const entries: FcRawDayEntry[] = []

  for (const skuCode of allSkuCodes) {
    for (const datum of allDates) {
      const channelData = channelTotals[datum]?.[skuCode]
      const stock = stockAgg[datum]?.[skuCode]
      if (!channelData && !stock) continue

      const sendungenByPlattformId: Record<string, number> = {}
      let sendungen_manuell = 0

      if (channelData) {
        for (const [channelName, qty] of Object.entries(channelData)) {
          const pid = channelToPlattformId.get(channelName)
          if (pid === null) {
            sendungen_manuell += qty
          } else if (pid !== undefined) {
            sendungenByPlattformId[pid] = (sendungenByPlattformId[pid] ?? 0) + qty
          }
        }
      }

      entries.push({
        skuCode,
        datum,
        sendungenByPlattformId,
        sendungen_manuell,
        einlagerungen: stock?.einlagerungen ?? 0,
        anpassungen_positiv: stock?.anpassungen_positiv ?? 0,
        anpassungen_negativ: stock?.anpassungen_negativ ?? 0,
        warenverluste: stock?.warenverluste ?? 0,
      })
    }
  }

  // Sort by skuCode, then by date ascending
  entries.sort((a, b) =>
    a.skuCode !== b.skuCode
      ? a.skuCode.localeCompare(b.skuCode)
      : a.datum.localeCompare(b.datum),
  )

  return { entries, unknownSkus, unknownChannels }
}
