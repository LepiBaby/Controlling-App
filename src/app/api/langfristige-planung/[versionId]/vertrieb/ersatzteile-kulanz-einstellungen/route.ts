// PROJ-78: Ersatzteile/Kulanz-Produktwerte einer Planversion (plattformgebunden).
import { makeProduktPlattformRoute, geldFeld, prozentFeld } from '../_utils'

// Auth-geschützte, pro-Planversion dynamische Route — nie statisch generieren.
// Überspringt den in Next 16 instabilen Static-Path-Pass (Worker-Crash).
export const dynamic = 'force-dynamic'

export const { GET, PUT } = makeProduktPlattformRoute({
  table: 'langfristige_ersatzteile_kulanz_einstellungen',
  selectCols:
    'sales_plattform_id, produkt_id, quote_prozent, produktkosten_pro_stueck_euro_netto, versandkosten_pro_stueck_euro_netto',
  fields: {
    quote_prozent: prozentFeld,
    produktkosten_pro_stueck_euro_netto: geldFeld,
    versandkosten_pro_stueck_euro_netto: geldFeld,
  },
})
