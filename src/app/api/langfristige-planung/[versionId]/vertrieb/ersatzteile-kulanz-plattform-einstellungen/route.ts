// PROJ-78: Ersatzteile/Kulanz-Reitereinstellung (Gruppierung + Zahlungsziel).
import { makeGruppierungPlattformRoute } from '../_utils'

// Auth-geschützte, pro-Planversion dynamische Route — nie statisch generieren.
// Überspringt den in Next 16 instabilen Static-Path-Pass (Worker-Crash).
export const dynamic = 'force-dynamic'

export const { GET, PUT } = makeGruppierungPlattformRoute(
  'langfristige_ersatzteile_kulanz_plattform_einstellungen',
)
