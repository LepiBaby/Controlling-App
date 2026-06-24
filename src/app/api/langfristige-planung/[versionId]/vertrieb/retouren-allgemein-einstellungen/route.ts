// PROJ-78: Retouren-Allgemein-Reitereinstellung (versionsweit).
import { makeGruppierungVersionRoute } from '../_utils'

// Auth-geschützte, pro-Planversion dynamische Route — nie statisch generieren.
// Überspringt den in Next 16 instabilen Static-Path-Pass (Worker-Crash).
export const dynamic = 'force-dynamic'

export const { GET, PUT } = makeGruppierungVersionRoute(
  'langfristige_retouren_allgemein_einstellungen',
)
