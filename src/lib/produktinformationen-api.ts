// Basis-Pfad für die Produktinformationen-Endpunkte.
//
// Ohne versionId → globale Kurzfristig-Endpunkte (PROJ-59).
// Mit versionId  → versionsgebundene Langfristig-Endpunkte (PROJ-77); alle Daten
//                  sind dann pro Planversion isoliert.
export function produktinformationenBasis(versionId?: string): string {
  return versionId
    ? `/api/langfristige-planung/${versionId}/produktinformationen`
    : '/api/produktinformationen'
}
