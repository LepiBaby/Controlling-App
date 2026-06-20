// Gemeinsame Navigationskonfiguration für eine geöffnete Planversion der
// Langfristigen Planung. Wird sowohl vom NavSheet (linkes Seitenmenü) als auch
// von der Versions-Übersichtsseite verwendet, damit beide identisch bleiben.

export const LANGFRISTIGE_PLANUNG_BASE = '/dashboard/langfristige-planung'

export interface VersionsSeite {
  slug: string
  label: string
  description: string
}

export interface VersionsNavGruppe {
  label: string
  items: VersionsSeite[]
}

// Die Seiten einer Planversion. Slugs sind versionsneutral; der konkrete Pfad
// wird mit der jeweiligen versionId zusammengesetzt (siehe buildVersionsHref).
export const VERSIONS_NAV_GRUPPEN: VersionsNavGruppe[] = [
  {
    label: 'Einstellungen',
    items: [
      {
        slug: 'kpi-modell-verwaltung',
        label: 'KPI-Modell Verwaltung',
        description: 'Sales Plattform, Produkte, Marketingkanäle und Investitionen dieser Planversion pflegen',
      },
      {
        slug: 'grundeinstellungen',
        label: 'Grundeinstellungen',
        description: 'Allgemeine Parameter dieser Planversion konfigurieren',
      },
      {
        slug: 'auszahlungseinstellungen',
        label: 'Auszahlungseinstellungen',
        description: 'Auszahlungsrhythmus und Inklusionen je Plattform pflegen',
      },
      {
        slug: 'absatzeinstellungen',
        label: 'Absatzeinstellungen',
        description: 'Absatzberechnungsmethode je Plattform & Produkt konfigurieren',
      },
      {
        slug: 'produktinformationen',
        label: 'Produktinformationen',
        description: 'Hersteller, MOQ, Lieferzeit, Kosten u.a. je Produkt pflegen',
      },
      {
        slug: 'vertriebseinstellungen',
        label: 'Vertriebseinstellungen',
        description: 'Versand, Lager, Retouren & Ersatzteile/Kulanz konfigurieren',
      },
      {
        slug: 'verkaufsgebuehr-einstellungen',
        label: 'Verkaufsgebühr-Einstellungen',
        description: 'Prozentuale Verkaufsgebühr je Plattform & Produkt pflegen',
      },
      {
        slug: 'marketing-einstellungen',
        label: 'Marketing-Einstellungen',
        description: 'Marketing-Berechnungsmethode je Plattform & Produkt konfigurieren',
      },
      {
        slug: 'operative-fixkosten-einstellungen',
        label: 'Operative Fixkosten-Einstellungen',
        description: 'Wiederkehrende operative Fixkosten mit Frequenz pflegen',
      },
      {
        slug: 'finanzierungseinstellungen',
        label: 'Finanzierungseinstellungen',
        description: 'Wiederkehrende Finanzierungskosten mit Frequenz pflegen',
      },
      {
        slug: 'steuereinstellungen',
        label: 'Steuereinstellungen',
        description: 'UST-Zahlungsfrequenz, UST-Sätze und Einfuhrumsatzsteuer pflegen',
      },
    ],
  },
]

export function buildVersionsHref(versionId: string, slug: string): string {
  return `${LANGFRISTIGE_PLANUNG_BASE}/${versionId}/${slug}`
}

// Extrahiert die versionId aus einem Pfad der Langfristigen Planung.
// Liefert null, wenn keine Version im Pfad steht (z.B. auf dem Dashboard).
export function getVersionIdFromPath(pathname: string): string | null {
  const prefix = `${LANGFRISTIGE_PLANUNG_BASE}/`
  if (!pathname.startsWith(prefix)) return null
  const rest = pathname.slice(prefix.length)
  const segment = rest.split('/')[0]
  return segment.length > 0 ? segment : null
}
