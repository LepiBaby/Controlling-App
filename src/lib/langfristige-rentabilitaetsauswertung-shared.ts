// PROJ-95: Gemeinsamer Vertrag zwischen Server-Route und Frontend-Hook für die
// Rentabilitätsauswertung der Langfristigen Planung.
//
// Die Route liefert je Monat die Basiswerte der festen GuV-Kaskade als positive
// Magnituden (Kostenzeilen als positive Beträge; das Vorzeichen in der Kaskade
// vergibt der Hook). Zwischensummen, „Ohne Investitionen"-Filter und Ansichts-
// modi werden vollständig clientseitig aus diesen Basiswerten gerechnet.

// Die 19 Basiszeilen der Kaskade (Reihenfolge unerheblich; Anordnung macht der Hook).
export const RA_LINE_IDS = [
  'brutto_umsatz',
  'rabatte',
  'rueckerstattungen',
  'umsatzsteuer',
  'ware',
  'inspektion',
  'shipping',
  'zoll',
  'einlagerung',
  'versand',
  'lagerung',
  'retouren',
  'kulanz',
  'verkaufsgebuehren',
  'marketing',
  'operativ',
  'finanzierung_zinsen',
  'steuern_ertrag',
] as const

export type RaLineId = (typeof RA_LINE_IDS)[number]

/** Eine Aufschlüsselungs-Unterzeile (Produkt/Kanal/Kategorie/Untergruppe). Kann selbst
 *  geschachtelte Unterzeilen haben (z. B. Marketingkanal → Produkte). */
export interface RaBreakdown {
  id: string
  label: string
  /** Betrag je Monatsschlüssel ("2026-1"), positive Magnitude (= Summe der `children`). */
  werte: Record<string, number>
  /** Optionale tiefere Aufschlüsselung. */
  children?: RaBreakdown[]
}

/** Basiswerte einer Kaskaden-Basiszeile. */
export interface RaLine {
  /** Betrag je Monatsschlüssel ("2026-1"), positive Magnitude. */
  werte: Record<string, number>
  /** Produkt-/Kategorie-Aufschlüsselung für den Drill-Down. */
  produkte: RaBreakdown[]
}

export interface RaMonat {
  /** "2026-1" (Jahr-Monat, Monat 1–12, nicht null-gepaddet). */
  key: string
  /** "Jan 2026". */
  label: string
}

export interface RentabilitaetsauswertungResponse {
  monate: RaMonat[]
  lines: Record<RaLineId, RaLine>
  absatz: {
    gesamt: Record<string, number>
    produkte: RaBreakdown[]
  }
}
