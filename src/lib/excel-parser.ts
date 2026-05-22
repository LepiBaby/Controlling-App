import * as XLSX from 'xlsx'

export interface ParsedExcelRow {
  _id: string
  leistungsdatum: string
  beschreibung: string
  betrag_brutto: number
  ust_betrag: number
  waehrung: string
  istFremdwaehrung: boolean
  hatFehler: boolean
}

export interface ParseResult {
  rows: ParsedExcelRow[]
  skippedCount: number
  skippedReasons: string[]
}

const REQUIRED_COLUMNS = ['Dokumentendatum', 'Bruttobetrag', 'Steuerbetrag']

function parseGermanNumber(value: unknown): number | null {
  if (value === null || value === undefined || value === '') return null
  // SheetJS may already return a number for numeric cells
  if (typeof value === 'number') return Math.round(value * 100) / 100
  const str = String(value).trim()
  if (!str) return null
  // Remove thousand separators (dot before 3-digit groups) then replace decimal comma
  const normalized = str.replace(/\.(?=\d{3})/g, '').replace(',', '.')
  const num = parseFloat(normalized)
  return isNaN(num) ? null : Math.round(num * 100) / 100
}

function parseGermanDate(value: unknown): string | null {
  if (!value) return null
  // SheetJS may return a JS Date for date cells
  if (value instanceof Date) {
    const yyyy = value.getFullYear()
    const mm = String(value.getMonth() + 1).padStart(2, '0')
    const dd = String(value.getDate()).padStart(2, '0')
    return `${yyyy}-${mm}-${dd}`
  }
  const str = String(value).trim()
  // DD.MM.YYYY
  const match = str.match(/^(\d{1,2})\.(\d{1,2})\.(\d{4})$/)
  if (match) {
    const [, dd, mm, yyyy] = match
    const d = new Date(Number(yyyy), Number(mm) - 1, Number(dd))
    if (isNaN(d.getTime())) return null
    return `${yyyy}-${mm.padStart(2, '0')}-${dd.padStart(2, '0')}`
  }
  // Try ISO fallback
  if (/^\d{4}-\d{2}-\d{2}$/.test(str)) return str
  return null
}

export function parseGetMyInvoicesExcel(buffer: ArrayBuffer): ParseResult {
  const workbook = XLSX.read(buffer, { type: 'array', cellDates: true })
  const sheetName = workbook.SheetNames[0]
  if (!sheetName) throw new Error('Die Datei enthält keine Tabellen.')

  const sheet = workbook.Sheets[sheetName]
  const rawRows = XLSX.utils.sheet_to_json<unknown[]>(sheet, { header: 1 })

  if (rawRows.length === 0) throw new Error('Die Datei enthält keine Daten.')

  const headerRow = rawRows[0] as unknown[]
  const headers = headerRow.map(h => String(h ?? '').trim())

  for (const required of REQUIRED_COLUMNS) {
    if (!headers.includes(required)) {
      throw new Error(
        `Spalte '${required}' nicht gefunden — bitte eine GetMyInvoices-Excel hochladen.`
      )
    }
  }

  const idx = (name: string): number => headers.indexOf(name)

  const dataRows = rawRows.slice(1)
  if (dataRows.length === 0) {
    throw new Error('Die Datei enthält keine Transaktionen (nur Kopfzeile vorhanden).')
  }

  const rows: ParsedExcelRow[] = []
  let skippedCount = 0
  const skippedReasons: string[] = []

  dataRows.forEach((rawRow, i) => {
    const row = rawRow as unknown[]

    const rawDate   = row[idx('Dokumentendatum')]
    const rawBrutto = row[idx('Bruttobetrag')]
    const rawUst    = row[idx('Steuerbetrag')]
    const rawFirma  = idx('Firma/Portal') >= 0 ? row[idx('Firma/Portal')] : undefined
    const rawWaehr  = idx('Währung') >= 0 ? row[idx('Währung')] : undefined

    const leistungsdatum = parseGermanDate(rawDate) ?? ''
    const betrag_brutto  = parseGermanNumber(rawBrutto) ?? 0
    const ust_betrag     = parseGermanNumber(rawUst) ?? 0
    const beschreibung   = rawFirma != null ? String(rawFirma).trim() : ''
    const waehrung       = rawWaehr != null ? String(rawWaehr).trim() : 'EUR'
    const hatFehler      = betrag_brutto <= 0 || ust_betrag < 0 || (betrag_brutto > 0 && ust_betrag >= betrag_brutto)

    rows.push({
      _id: `import-${i}-${Date.now()}`,
      leistungsdatum,
      beschreibung,
      betrag_brutto,
      ust_betrag,
      waehrung,
      istFremdwaehrung: waehrung !== '' && waehrung !== 'EUR',
      hatFehler,
    })
  })

  return { rows, skippedCount, skippedReasons }
}
