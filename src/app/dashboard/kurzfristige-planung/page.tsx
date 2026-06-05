import { NavSheet } from '@/components/nav-sheet'
import { BereichsKartenSwitcher } from '@/components/bereichs-karten-switcher'
import { LogoutButton } from '@/components/logout-button'

export default function KurzfristigePlanungPage() {
  return (
    <div className="flex min-h-screen flex-col">
      <header className="border-b bg-background px-6 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <NavSheet />
            <h1 className="text-lg font-semibold">Controlling App</h1>
          </div>
          <div className="flex items-center gap-4">
            <LogoutButton />
          </div>
        </div>
      </header>

      <main className="flex-1 p-6">
        <div className="mx-auto max-w-7xl space-y-8">
          <BereichsKartenSwitcher />

          <div className="space-y-3">
            <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
              Einstellungen
            </h2>
            <div className="grid gap-3 sm:grid-cols-3">
              <a
                href="/dashboard/kurzfristige-planung/absatzeinstellungen"
                className="rounded-lg border bg-card p-4 hover:bg-muted/50 transition-colors"
              >
                <p className="font-medium">Absatzeinstellungen</p>
                <p className="text-sm text-muted-foreground mt-1">
                  Absatzberechnungsmethode je Plattform &amp; Produkt konfigurieren
                </p>
              </a>
              <a
                href="/dashboard/kurzfristige-planung/verkaufsgebuehr-einstellungen"
                className="rounded-lg border bg-card p-4 hover:bg-muted/50 transition-colors"
              >
                <p className="font-medium">Verkaufsgebühr-Einstellungen</p>
                <p className="text-sm text-muted-foreground mt-1">
                  Prozentuale Verkaufsgebühr je Plattform &amp; Produkt pflegen
                </p>
              </a>
              <a
                href="/dashboard/kurzfristige-planung/versand-einstellungen"
                className="rounded-lg border bg-card p-4 hover:bg-muted/50 transition-colors"
              >
                <p className="font-medium">Versand-Einstellungen</p>
                <p className="text-sm text-muted-foreground mt-1">
                  Versandgebühr (Spediteur &amp; 3PL) sowie Zahlungsziel je Plattform &amp; Produkt pflegen
                </p>
              </a>
              <a
                href="/dashboard/kurzfristige-planung/auszahlungseinstellungen"
                className="rounded-lg border bg-card p-4 hover:bg-muted/50 transition-colors"
              >
                <p className="font-medium">Auszahlungseinstellungen</p>
                <p className="text-sm text-muted-foreground mt-1">
                  Auszahlungsrhythmus, nächste Auszahlungswoche und Inklusionen je Plattform pflegen
                </p>
              </a>
              <a
                href="/dashboard/kurzfristige-planung/lager-einstellungen"
                className="rounded-lg border bg-card p-4 hover:bg-muted/50 transition-colors"
              >
                <p className="font-medium">Lager-Einstellungen</p>
                <p className="text-sm text-muted-foreground mt-1">
                  Lagerkosten (€/m³) je Plattform &amp; Produkt sowie Zahlungswoche pflegen
                </p>
              </a>
              <a
                href="/dashboard/kurzfristige-planung/retouren-einstellungen"
                className="rounded-lg border bg-card p-4 hover:bg-muted/50 transition-colors"
              >
                <p className="font-medium">Retoureneinstellungen</p>
                <p className="text-sm text-muted-foreground mt-1">
                  Retourenquote, Rückversandkosten &amp; Handling-Kosten je Plattform &amp; Produkt pflegen
                </p>
              </a>
              <a
                href="/dashboard/kurzfristige-planung/ersatzteile-kulanz-einstellungen"
                className="rounded-lg border bg-card p-4 hover:bg-muted/50 transition-colors"
              >
                <p className="font-medium">Ersatzteile/Kulanz-Einstellungen</p>
                <p className="text-sm text-muted-foreground mt-1">
                  Ersatzteile/Kulanz-Quote &amp; Kosten pro Stück je Plattform &amp; Produkt pflegen
                </p>
              </a>
              <a
                href="/dashboard/kurzfristige-planung/marketing-einstellungen"
                className="rounded-lg border bg-card p-4 hover:bg-muted/50 transition-colors"
              >
                <p className="font-medium">Marketing-Einstellungen</p>
                <p className="text-sm text-muted-foreground mt-1">
                  Marketing-Berechnungsmethode je Plattform &amp; Produkt konfigurieren
                </p>
              </a>
              <a
                href="/dashboard/kurzfristige-planung/grundeinstellungen"
                className="rounded-lg border bg-card p-4 hover:bg-muted/50 transition-colors"
              >
                <p className="font-medium">Grundeinstellungen</p>
                <p className="text-sm text-muted-foreground mt-1">
                  Planungshorizont und weitere allgemeine Parameter der kurzfristigen Planung konfigurieren
                </p>
              </a>
              <a
                href="/dashboard/kurzfristige-planung/operative-fixkosten-einstellungen"
                className="rounded-lg border bg-card p-4 hover:bg-muted/50 transition-colors"
              >
                <p className="font-medium">Operative Fixkosten-Einstellungen</p>
                <p className="text-sm text-muted-foreground mt-1">
                  Wiederkehrende operative Fixkosten mit Frequenz und Fälligkeitsmonaten pflegen
                </p>
              </a>
              <a
                href="/dashboard/kurzfristige-planung/finanzierungseinstellungen"
                className="rounded-lg border bg-card p-4 hover:bg-muted/50 transition-colors"
              >
                <p className="font-medium">Finanzierungseinstellungen</p>
                <p className="text-sm text-muted-foreground mt-1">
                  Wiederkehrende Finanzierungskosten (Kredite, Leasing, Zinsen) mit Frequenz und Fälligkeitsmonaten pflegen
                </p>
              </a>
              <a
                href="/dashboard/kurzfristige-planung/produktinformationen"
                className="rounded-lg border bg-card p-4 hover:bg-muted/50 transition-colors"
              >
                <p className="font-medium">Produktinformationen</p>
                <p className="text-sm text-muted-foreground mt-1">
                  Hersteller, MOQ, Containerkapazität, Lieferzeit, Zahlungskonditionen, Kosten &amp; Bestandsverwaltung je Produkt pflegen
                </p>
              </a>
            </div>
          </div>

          <div className="space-y-3">
            <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
              Planung
            </h2>
            <div className="grid gap-3 sm:grid-cols-3">
              <a
                href="/dashboard/kurzfristige-planung/absatzplanung"
                className="rounded-lg border bg-card p-4 hover:bg-muted/50 transition-colors"
              >
                <p className="font-medium">Absatzplanung</p>
                <p className="text-sm text-muted-foreground mt-1">
                  Absatz und effektiven VK je Plattform &amp; Produkt für den Planungshorizont planen
                </p>
              </a>
              <a
                href="/dashboard/kurzfristige-planung/einnahmenplanung"
                className="rounded-lg border bg-card p-4 hover:bg-muted/50 transition-colors"
              >
                <p className="font-medium">Einnahmenplanung</p>
                <p className="text-sm text-muted-foreground mt-1">
                  Sonstige Einnahmen je Kategorie für den Planungshorizont manuell erfassen
                </p>
              </a>
              <a
                href="/dashboard/kurzfristige-planung/marketingplanung"
                className="rounded-lg border bg-card p-4 hover:bg-muted/50 transition-colors"
              >
                <p className="font-medium">Marketing-Planung</p>
                <p className="text-sm text-muted-foreground mt-1">
                  Marketingkosten % je Plattform &amp; Produkt für den Planungshorizont planen
                </p>
              </a>
              <a
                href="/dashboard/kurzfristige-planung/operative-planung"
                className="rounded-lg border bg-card p-4 hover:bg-muted/50 transition-colors"
              >
                <p className="font-medium">Operative Planung</p>
                <p className="text-sm text-muted-foreground mt-1">
                  Operative Kosten je Kategorie für den Planungshorizont manuell erfassen
                </p>
              </a>
              <a
                href="/dashboard/kurzfristige-planung/produktinvestitionsplanung"
                className="rounded-lg border bg-card p-4 hover:bg-muted/50 transition-colors"
              >
                <p className="font-medium">Produktinvestitionsplanung</p>
                <p className="text-sm text-muted-foreground mt-1">
                  Produktinvestitionen je Kategorie für den Planungshorizont manuell erfassen
                </p>
              </a>
              <a
                href="/dashboard/kurzfristige-planung/bestellplanung"
                className="rounded-lg border bg-card p-4 hover:bg-muted/50 transition-colors"
              >
                <p className="font-medium">Bestellplanung</p>
                <p className="text-sm text-muted-foreground mt-1">
                  Planbestellungen via Algorithmus generieren, laufende Bestellungen verwalten und abgeschlossene Bestellungen einsehen
                </p>
              </a>
            </div>
          </div>
        </div>
      </main>
    </div>
  )
}
