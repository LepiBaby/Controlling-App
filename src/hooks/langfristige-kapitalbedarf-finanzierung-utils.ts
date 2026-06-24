// PROJ-101: Reine Helfer + Typen für Kapitalbedarf & Finanzierung.
// Bewusst OHNE 'use client' und ohne Hook-/Komponenten-Importe, damit sie isoliert
// (unit-)testbar sind und nicht die schwere Hook-Kette mitladen.

export type Bereich = 'kapitalbedarf' | 'eigenkapital' | 'fremdkapital'
export type ZeilenArt =
  | 'investitionen'
  | 'betriebsmittelbedarf'
  | 'liquiditaetsreserve'
  | 'manuell'
  | 'investition_obergruppe'

export interface KbfRow {
  id: string
  bereich: Bereich
  zeilen_art: ZeilenArt
  bezeichnung: string
  betrag: number | null
  zinssatz: number | null
  laufzeit_jahre: number | null
  tilgungsfrei_jahre: number | null
  sort_order: number
  is_system: boolean
  quelle_id: string | null // bei 'investition_obergruppe': Obergruppe-Kategorie-ID
}

export interface Obergruppe {
  id: string        // lp_investition-Kategorie-ID (quelle_id für Overrides)
  label: string
  auto: number      // berechneter Wert (Summe über alle Monate)
  override: number | null // manueller Override sonst null
  betrag: number    // effektiv: override ?? auto
}

export function round2(n: number): number {
  return Math.round(n * 100) / 100
}

/** Summe aller Spaltenwerte eines Knotens (über alle Monate). */
export function sumValues(values: Record<string, number>): number {
  return round2(Object.values(values).reduce((a, b) => a + b, 0))
}

/**
 * Betriebsmittelbedarf aus der Kontostand-Zeile: Betrag des negativsten
 * kumulierten Kontostands (0 wenn der Kontostand nie negativ wird).
 */
export function computeBetriebsmittelbedarf(cells: Record<string, { value: number | null }>): number {
  let min = 0
  for (const c of Object.values(cells)) {
    if (c && c.value !== null && c.value < min) min = c.value
  }
  return round2(Math.max(0, -min))
}

/**
 * Effektiver Betrag einer Zeile:
 *  • Investitionen: NICHT editierbar → immer der (bereits Override-bereinigte) Summenwert `investGesamt`
 *  • Betriebsmittelbedarf: Override sonst Auto-Wert
 *  • Liquiditätsreserve / manuell: Wert sonst 0
 */
export function effektiverBetrag(row: KbfRow, investGesamt: number, autoBetriebsmittel: number): number {
  if (row.zeilen_art === 'investitionen') return investGesamt
  if (row.zeilen_art === 'betriebsmittelbedarf') return row.betrag ?? autoBetriebsmittel
  return row.betrag ?? 0
}
