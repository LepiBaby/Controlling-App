'use client'

import { NavSheet } from '@/components/nav-sheet'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { ReportingUmsatzsteuerMatrix } from '@/components/reporting-umsatzsteuer-matrix'
import {
  useReportingUmsatzsteuer,
  type ReportGranularitaet,
} from '@/hooks/use-reporting-umsatzsteuer'

export default function ReportingUmsatzsteuerPage() {
  const {
    von, bis, granularitaet, data, loading, error,
    setVon, setBis, setGranularitaet,
  } = useReportingUmsatzsteuer()

  const currentMonth = new Date().toISOString().slice(0, 7)

  const vonBisError = von && bis && von > bis
    ? 'Von-Monat muss vor oder gleich Bis-Monat liegen'
    : null

  const hasValidDateRange = !!(von && bis && !vonBisError)

  return (
    <div className="flex min-h-screen flex-col">
      <header className="border-b bg-background px-6 py-4">
        <div className="flex items-center gap-2">
          <NavSheet />
          <h1 className="text-lg font-semibold">Umsatzsteuer-Report</h1>
        </div>
      </header>

      <main className="flex-1 p-6">
        <div className="w-full space-y-6">

          {/* Filter-Leiste */}
          <div className="flex flex-wrap items-end gap-4">
            <div className="space-y-1.5">
              <Label className="text-xs">Von (Monat)</Label>
              <Input
                type="month"
                className="h-8 w-40 text-sm"
                value={von}
                max={currentMonth}
                onChange={e => setVon(e.target.value || '')}
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Bis (Monat)</Label>
              <Input
                type="month"
                className="h-8 w-40 text-sm"
                value={bis}
                max={currentMonth}
                onChange={e => setBis(e.target.value || '')}
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Zeitraum</Label>
              <Tabs
                value={granularitaet}
                onValueChange={v => setGranularitaet(v as ReportGranularitaet)}
              >
                <TabsList className="h-8">
                  <TabsTrigger value="monat" className="text-xs px-3 h-6">Monatlich</TabsTrigger>
                  <TabsTrigger value="quartal" className="text-xs px-3 h-6">Quartal</TabsTrigger>
                  <TabsTrigger value="jahr" className="text-xs px-3 h-6">Jahr</TabsTrigger>
                </TabsList>
              </Tabs>
            </div>
          </div>

          {/* Validierungsfehler */}
          {vonBisError && (
            <p className="text-sm text-destructive">{vonBisError}</p>
          )}

          {/* API-Fehler */}
          {error && !vonBisError && (
            <div className="rounded-lg border border-destructive bg-destructive/10 p-4 text-sm text-destructive">
              {error}
            </div>
          )}

          {/* Matrix */}
          <ReportingUmsatzsteuerMatrix
            data={hasValidDateRange ? data : null}
            loading={loading}
            hasDateRange={hasValidDateRange}
          />

        </div>
      </main>
    </div>
  )
}
