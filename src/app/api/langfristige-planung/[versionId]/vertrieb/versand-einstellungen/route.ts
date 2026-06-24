// PROJ-78: Versand-Produktwerte einer Planversion (plattformgebunden).
import { makeProduktPlattformRoute, geldFeld } from '../_utils'

// Auth-geschützte, pro-Planversion dynamische Route — nie statisch generieren.
// Überspringt den in Next 16 instabilen Static-Path-Pass (Worker-Crash).
export const dynamic = 'force-dynamic'

export const { GET, PUT } = makeProduktPlattformRoute({
  table: 'langfristige_versand_einstellungen',
  selectCols:
    'sales_plattform_id, produkt_id, versandgebuehr_spediteur_euro_netto, versandgebuehr_3pl_euro_netto',
  fields: {
    versandgebuehr_spediteur_euro_netto: geldFeld,
    versandgebuehr_3pl_euro_netto: geldFeld,
  },
})
