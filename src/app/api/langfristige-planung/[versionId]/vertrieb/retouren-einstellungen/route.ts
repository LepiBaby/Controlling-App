// PROJ-78: Retouren-Produktwerte je Plattform (Erstattung % + Rückversand).
import { makeProduktPlattformRoute, geldFeld, prozentFeld } from '../_utils'

// Auth-geschützte, pro-Planversion dynamische Route — nie statisch generieren.
// Überspringt den in Next 16 instabilen Static-Path-Pass (Worker-Crash).
export const dynamic = 'force-dynamic'

export const { GET, PUT } = makeProduktPlattformRoute({
  table: 'langfristige_retouren_einstellungen',
  selectCols:
    'sales_plattform_id, produkt_id, erstattung_verkaufsgebuehr_prozent, rueckversandkosten_euro_netto',
  fields: {
    erstattung_verkaufsgebuehr_prozent: prozentFeld,
    rueckversandkosten_euro_netto: geldFeld,
  },
})
