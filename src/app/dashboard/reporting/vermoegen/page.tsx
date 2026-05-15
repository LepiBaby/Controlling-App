'use client'

import { NavSheet } from '@/components/nav-sheet'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { Skeleton } from '@/components/ui/skeleton'
import { ReportingVermoegenWaren } from '@/components/reporting-vermoegen-waren'
import { ReportingVermoegenLiquiditaet } from '@/components/reporting-vermoegen-liquiditaet'
import { ReportingVermoegenBilanzkennzahlen } from '@/components/reporting-vermoegen-bilanzkennzahlen'
import { useReportingVermoegen } from '@/hooks/use-reporting-vermoegen'

function fmtDatumLang(datum: string): string {
  const [y, m, d] = datum.split('-')
  const mn = ['Januar','Februar','März','April','Mai','Juni','Juli','August','September','Oktober','November','Dezember']
  return `${parseInt(d)}. ${mn[parseInt(m)-1]} ${y}`
}

export default function VermoegenReportPage() {
  const { data, loading, error } = useReportingVermoegen()

  const latest = data?.latest ?? null
  const series = data?.series ?? []

  return (
    <div className="flex min-h-screen flex-col">
      <header className="border-b bg-background px-6 py-4">
        <div className="flex items-center gap-2">
          <NavSheet />
          <h1 className="text-lg font-semibold">Vermögensbericht</h1>
          {latest && (
            <span className="ml-2 text-sm text-muted-foreground">
              Stand: {fmtDatumLang(latest.datum)}
            </span>
          )}
        </div>
      </header>

      <main className="flex-1 p-6">
        <div className="w-full space-y-6">

          {loading && (
            <div className="space-y-4">
              <div className="grid grid-cols-3 gap-4">
                <Skeleton className="h-28 rounded-lg" />
                <Skeleton className="h-28 rounded-lg" />
                <Skeleton className="h-28 rounded-lg" />
              </div>
              <Skeleton className="h-72 w-full rounded-lg" />
            </div>
          )}

          {!loading && error && (
            <div className="rounded-lg border border-destructive bg-destructive/10 p-4 text-sm text-destructive">
              {error}
            </div>
          )}

          {!loading && !error && !latest && (
            <div className="rounded-lg border border-dashed p-12 text-center space-y-3">
              <p className="text-muted-foreground">
                Noch kein Snapshot vorhanden. Erfassen Sie zuerst Vermögenswerte.
              </p>
              <a
                href="/dashboard/vermoegenswerte"
                className="inline-block rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors"
              >
                Zur Vermögenswerte-Verwaltung
              </a>
            </div>
          )}

          {!loading && !error && latest && (
            <Tabs defaultValue="waren">
              <TabsList className="h-9">
                <TabsTrigger value="waren" className="text-sm px-4">Waren-KPIs</TabsTrigger>
                <TabsTrigger value="liquiditaet" className="text-sm px-4">Liquiditäts-KPIs</TabsTrigger>
                <TabsTrigger value="vermoegen" className="text-sm px-4">Vermögens-KPIs</TabsTrigger>
              </TabsList>

              <TabsContent value="waren">
                <ReportingVermoegenWaren latest={latest} series={series} />
              </TabsContent>

              <TabsContent value="liquiditaet">
                <ReportingVermoegenLiquiditaet latest={latest} series={series} />
              </TabsContent>

              <TabsContent value="vermoegen">
                <ReportingVermoegenBilanzkennzahlen latest={latest} series={series} />
              </TabsContent>
            </Tabs>
          )}

        </div>
      </main>
    </div>
  )
}
