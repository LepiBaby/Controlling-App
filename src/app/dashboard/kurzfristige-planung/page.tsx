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
              Kurzfristige Planung
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
            </div>
          </div>
        </div>
      </main>
    </div>
  )
}
