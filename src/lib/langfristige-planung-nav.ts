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
        description: 'Sales Plattform, Gruppierung und Zahlungsziel je Marketingkanal pflegen',
      },
      {
        slug: 'steuereinstellungen',
        label: 'Steuereinstellungen',
        description: 'UST-Zahlungsfrequenz, UST-Sätze und Einfuhrumsatzsteuer pflegen',
      },
    ],
  },
  {
    label: 'Planung',
    items: [
      {
        slug: 'absatzplanung',
        label: 'Absatzplanung',
        description: 'Absatz und effektiven VK je Plattform & Produkt monatsweise planen',
      },
      {
        slug: 'bestellplanung',
        label: 'Bestellplanung',
        description: 'Bestellzeitpunkte und -mengen je Produkt anhand des Start-Planungsmonats ermitteln',
      },
      {
        slug: 'marketingplanung',
        label: 'Marketing-Planung',
        description: 'Marketingkosten % je Marketingkanal & Produkt monatsweise planen',
      },
      {
        slug: 'sales-plattform-planung',
        label: 'Sales-Plattform-Planung',
        description: 'Bruttoumsatz, Rückerstattungen, Verkaufsgebühr, Retouren & Marketing je Plattform & Produkt monatsweise',
      },
      {
        slug: 'einnahmenplanung',
        label: 'Einnahmenplanung',
        description: 'Einnahmen je Kategorie monatsweise; Produktverkäufe automatisch nach Auszahlungszeitpunkt je Sales Channel',
      },
      {
        slug: 'umsatzausgaben',
        label: 'Umsatzausgabenplanung',
        description: 'Produkt-, Vertriebs- & Marketingausgaben je Produkt monatsweise; berechnet aus den Einstellungen dieser Version (Liquiditätssicht)',
      },
      {
        slug: 'operativekosten-planung',
        label: 'Operativkosten Planung',
        description: 'Operative Kosten je Gruppe & Untergruppe monatsweise manuell planen',
      },
      {
        slug: 'investitionsausgaben-planung',
        label: 'Investitionsausgaben Planung',
        description: 'Investitionsausgaben je Kategorie, Untergruppe & Produkt monatsweise; „Produktinvestitionen Einkauf" automatisch aus Erstbestellungen',
      },
      {
        slug: 'finanzierungsausgaben-planung',
        label: 'Finanzierungsausgaben Planung',
        description: 'Finanzierungsausgaben je Gruppe & Untergruppe monatsweise manuell planen',
      },
      {
        slug: 'steuerausgaben',
        label: 'Steuerausgabenplanung',
        description: 'Steuerausgaben je Gruppe monatsweise; Einfuhr-USt & Umsatzsteuer automatisch aus den Plandaten dieser Version berechnet (Liquiditätssicht)',
      },
    ],
  },
  {
    label: 'Auswertungen',
    items: [
      {
        slug: 'umsatzauswertung',
        label: 'Umsatzauswertung',
        description: 'Brutto-Umsatz bis Netto-Umsatz je Monat oder Jahr — Diagramm, Absatztabelle und Drill-Down je Produkt (gleiche Werte wie die Rentabilitätsauswertung)',
      },
      {
        slug: 'umsatzkosten-auswertung',
        label: 'Umsatzkosten-Auswertung',
        description: 'Produkt-, Vertriebs- & Marketingkosten je Monat oder Jahr mit Summe „Umsatzkosten (Gesamt)" — gestapeltes Diagramm und Drill-Down je Produkt (gleiche Werte wie die Rentabilitätsauswertung)',
      },
      {
        slug: 'operative-kosten-auswertung',
        label: 'Operative Kosten-Auswertung',
        description: 'Operative Kosten je Gruppe & Untergruppe je Monat oder Jahr mit Summe „Operative Kosten (Gesamt)" — gestapeltes Diagramm und Drill-Down (gleiche Werte wie die Rentabilitätsauswertung)',
      },
      {
        slug: 'investitionsauswertung',
        label: 'Investitionsauswertung',
        description: 'Investitionen je Obergruppe, Untergruppe & Produkt monatlich oder als Gesamt — gestapeltes Diagramm und „Investitionen (Gesamt)" (gleiche Werte wie die Investitionsausgaben-Planung)',
      },
      {
        slug: 'kapitalbedarf-finanzierung',
        label: 'Kapitalbedarf & Finanzierung',
        description: 'Gesamtkapitalbedarf (Investitionen, Betriebsmittelbedarf, Liquiditätsreserve & eigene Zeilen) und dessen Deckung durch Eigen- & Fremdkapital — mit Abgleich',
      },
      {
        slug: 'finanzierungsausgaben-auswertung',
        label: 'Finanzierungsausgaben-Auswertung',
        description: 'Finanzierungsausgaben je Gruppe & Untergruppe je Monat oder Jahr mit Summe „Finanzierungsausgaben (Gesamt)" — gestapeltes Diagramm und Drill-Down (gleiche Werte wie die Finanzierungsausgaben Planung)',
      },
      {
        slug: 'rentabilitaetsauswertung',
        label: 'Rentabilitätsauswertung',
        description: 'Plan-GuV von Brutto-Umsatz bis Ergebnis je Monat — Deckungsbeiträge, EBIT, EBT aus den Planungsmodulen dieser Version',
      },
      {
        slug: 'liquiditaetsauswertung',
        label: 'Liquiditätsauswertung',
        description: 'Einnahmen & Ausgaben aller Module je Monat zusammengeführt; Cashflow und kumulierter Kontostand ab dem Startkontostand (nur Soll)',
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
