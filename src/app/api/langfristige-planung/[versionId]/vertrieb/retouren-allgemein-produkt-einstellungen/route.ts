// PROJ-78: Retouren-Allgemein-Produktwerte (manuelle Quote, versionsweit).
import { makeProduktVersionRoute, geldFeld, prozentFeld } from '../_utils'

// Auth-geschützte, pro-Planversion dynamische Route — nie statisch generieren.
// Überspringt den in Next 16 instabilen Static-Path-Pass (Worker-Crash).
export const dynamic = 'force-dynamic'

export const { GET, PUT } = makeProduktVersionRoute({
  table: 'langfristige_retouren_allgemein_produkt_einstellungen',
  selectCols: 'produkt_id, retourenquote_prozent, retourenhandling_kosten_euro_netto',
  fields: {
    retourenquote_prozent: prozentFeld,
    retourenhandling_kosten_euro_netto: geldFeld,
  },
})
