// Basis-Pfade für die Steuereinstellungen-Endpunkte (PROJ-65 / PROJ-83).
//
// Ohne versionId → globale Kurzfristig-Endpunkte (PROJ-65).
// Mit versionId  → versionsgebundene Langfristig-Endpunkte (PROJ-83); alle Daten
//                  sind dann pro Planversion isoliert.
//
// Analog zu `produktinformationenBasis` (PROJ-77): dieselbe Oberfläche/Hooks
// bedienen beide Modi, nur der Pfad wechselt.

function langfristigeBasis(versionId: string): string {
  return `/api/langfristige-planung/${versionId}/steuereinstellungen`
}

export function ustEinstellungenPfad(versionId?: string): string {
  return versionId ? `${langfristigeBasis(versionId)}/einstellungen` : '/api/ust-einstellungen'
}

export function ustKategorieSaetzePfad(versionId?: string): string {
  return versionId ? `${langfristigeBasis(versionId)}/kategorie-saetze` : '/api/ust-kategorie-saetze'
}

export function ustEbeneAuswahlPfad(versionId?: string): string {
  return versionId ? `${langfristigeBasis(versionId)}/ebene-auswahl` : '/api/ust-l1-ebene-auswahl'
}

export function ustFiskalverzollungPfad(versionId?: string): string {
  return versionId ? `${langfristigeBasis(versionId)}/fiskalverzollung` : '/api/einfuhrust-fiskalverzollung'
}
