'use client'

import { useState, useEffect, useRef } from 'react'
import { NavSheet } from '@/components/nav-sheet'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { ReportingRentabilitaetMatrix } from '@/components/reporting-rentabilitaet-matrix'
import { ReportingRentabilitaetChart } from '@/components/reporting-rentabilitaet-chart'
import { AbsatzTable } from '@/components/absatz-table'
import {
  useReportingRentabilitaet,
  type ReportGranularitaet,
  type ReportAnzeigemodus,
} from '@/hooks/use-reporting-rentabilitaet'
import { useReportingAbsatz } from '@/hooks/use-reporting-absatz'
import { X } from 'lucide-react'
import { cn } from '@/lib/utils'

const STANDARD_POSITION_NAMEN = ['bruttoumsatz', 'nettoumsatz', 'db3', 'ebit', 'ebt']

export default function ReportingRentabilitaetPage() {
  const {
    von, bis, granularitaet, anzeigemodus, data, displayPerioden, loading, error,
    setVon, setBis, setGranularitaet, setAnzeigemodus,
  } = useReportingRentabilitaet()

  const { data: absatzData, loading: absatzLoading } = useReportingAbsatz({ von, bis, granularitaet })

  const [ohneInvestitionen, setOhneInvestitionen] = useState(false)
  const [selectedPositionIds, setSelectedPositionIds] = useState<string[]>([])
  const initializedRef = useRef(false)

  // Standard-Positionen beim ersten Laden vorauswählen
  useEffect(() => {
    if (!data || initializedRef.current) return
    const ids = data.positionen
      .filter(p => STANDARD_POSITION_NAMEN.includes(p.name.toLowerCase()))
      .map(p => p.id)
    setSelectedPositionIds(ids)
    initializedRef.current = true
  }, [data])

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
          <h1 className="text-lg font-semibold">Rentabilitätsreport</h1>
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
            <div className="space-y-1.5">
              <Label className="text-xs">Ansicht</Label>
              <Tabs
                value={anzeigemodus}
                onValueChange={v => setAnzeigemodus(v as ReportAnzeigemodus)}
              >
                <TabsList className="h-8">
                  <TabsTrigger value="absolut" className="text-xs px-3 h-6">Absolut</TabsTrigger>
                  <TabsTrigger value="prozentual" className="text-xs px-3 h-6">Prozentual</TabsTrigger>
                  <TabsTrigger value="wachstum" className="text-xs px-3 h-6">Wachstum</TabsTrigger>
                </TabsList>
              </Tabs>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Filter</Label>
              <button
                onClick={() => setOhneInvestitionen(v => !v)}
                className={cn(
                  'inline-flex h-8 items-center gap-2 rounded-md px-3 text-xs font-medium transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                  ohneInvestitionen
                    ? 'bg-amber-100 text-amber-800 ring-1 ring-amber-300 dark:bg-amber-950/50 dark:text-amber-200 dark:ring-amber-700'
                    : 'border border-input bg-background text-muted-foreground hover:bg-accent hover:text-foreground'
                )}
              >
                Ohne Investitionen
                {ohneInvestitionen && <X className="h-3 w-3 opacity-60" />}
              </button>
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

          {/* Liniendiagramm */}
          <ReportingRentabilitaetChart
            data={hasValidDateRange ? data : null}
            loading={loading}
            hasDateRange={hasValidDateRange}
            anzeigemodus={anzeigemodus}
            displayPerioden={displayPerioden}
            ohneInvestitionen={ohneInvestitionen}
            selectedPositionIds={selectedPositionIds}
            onSelectionChange={setSelectedPositionIds}
          />

          {/* Absatztabelle */}
          <AbsatzTable
            data={absatzData}
            loading={absatzLoading}
            hasDateRange={hasValidDateRange}
            displayPerioden={displayPerioden}
          />

          {/* Matrix */}
          <ReportingRentabilitaetMatrix
            data={hasValidDateRange ? data : null}
            loading={loading}
            hasDateRange={hasValidDateRange}
            anzeigemodus={anzeigemodus}
            displayPerioden={displayPerioden}
            ohneInvestitionen={ohneInvestitionen}
          />

        </div>
      </main>
    </div>
  )
}
