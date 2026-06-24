// PROJ-78: Lager-Produktwerte einer Planversion (€/m³/Monat, plattformgebunden).
import { makeProduktPlattformRoute, geldFeld } from '../_utils'

// Auth-geschützte, pro-Planversion dynamische Route — nie statisch generieren.
// Überspringt den in Next 16 instabilen Static-Path-Pass (Worker-Crash).
export const dynamic = 'force-dynamic'

export const { GET, PUT } = makeProduktPlattformRoute({
  table: 'langfristige_lager_einstellungen',
  selectCols: 'sales_plattform_id, produkt_id, lagerkosten_euro_m3_monat',
  fields: {
    lagerkosten_euro_m3_monat: geldFeld,
  },
})
