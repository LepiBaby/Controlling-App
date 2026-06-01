'use client'

import { useState, useEffect, useRef } from 'react'
import { NavSheet } from '@/components/nav-sheet'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Button } from '@/components/ui/button'
import { ReportingRentabilitaetMatrix } from '@/components/reporting-rentabilitaet-matrix'
import { ReportingRentabilitaetChart } from '@/components/reporting-rentabilitaet-chart'
import { AbsatzTable } from '@/components/absatz-table'
import { MultiSelect } from '@/components/multi-select'
import { useReportingDeckungsbeitrag } from '@/hooks/use-reporting-deckungsbeitrag'
import { useReportingAbsatz } from '@/hooks/use-reporting-absatz'
import { type ReportGranularitaet, type ReportAnzeigemodus } from '@/hooks/use-reporting-rentabilitaet'
import { X } from 'lucide-react'

const STANDARD_POSITION_NAMEN = ['db1', 'db2', 'db3']

export default function ReportingDeckungsbeitragPage() {
  const {
    von, bis, granularitaet, anzeigemodus,
    selectedProduktIds, selectedPlattformIds,
    produktOptionen, plattformOptionen,
    data, displayPerioden, loading, error,
    setVon, setBis, setGranularitaet, setAnzeigemodus,
    setSelectedProduktIds, setSelectedPlattformIds,
  } = useReportingDeckungsbeitrag()

  const { data: absatzData, loading: absatzLoading } = useReportingAbsatz({
    von,
    bis,
    granularitaet,
    produkt_ids: selectedProduktIds,
    plattform_ids: selectedPlattformIds,
  })

  const [selectedPositionIds, setSelectedPositionIds] = useState<string[]>([])
  const initializedRef = useRef(false)
  const absatzScrollRef = useRef<HTMLDivElement>(null)
  const matrixScrollRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!data || initializedRef.current) return
    const ids = data.positionen
      .filter(p => STANDARD_POSITION_NAMEN.includes(p.name.toLowerCase()))
      .map(p => p.id)
    setSelectedPositionIds(ids)
    initializedRef.current = true
  }, [data])

  // Horizontales Scroll-Sync zwischen Absatztabelle und Matrix
  useEffect(() => {
    const el1 = absatzScrollRef.current
    const el2 = matrixScrollRef.current
    if (!el1 || !el2) return
    let syncing = false
    function syncFromAbsatz() {
      if (syncing) return
      syncing = true
      el2!.scrollLeft = el1!.scrollLeft
      syncing = false
    }
    function syncFromMatrix() {
      if (syncing) return
      syncing = true
      el1!.scrollLeft = el2!.scrollLeft
      syncing = false
    }
    el1.addEventListener('scroll', syncFromAbsatz)
    el2.addEventListener('scroll', syncFromMatrix)
    return () => {
      el1.removeEventListener('scroll', syncFromAbsatz)
      el2.removeEventListener('scroll', syncFromMatrix)
    }
  }, [data, absatzData])

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
          <h1 className="text-lg font-semibold">Deckungsbeitragsreport</h1>
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

            {/* Produkt-Filter */}
            {produktOptionen.length > 0 && (
              <div className="space-y-1.5">
                <Label className="text-xs">Produkte</Label>
                <div className="flex items-center gap-1">
                  <MultiSelect
                    options={produktOptionen}
                    selected={selectedProduktIds}
                    onChange={setSelectedProduktIds}
                    placeholder="Alle Produkte"
                  />
                  {selectedProduktIds.length > 0 && (
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 text-muted-foreground hover:text-foreground"
                      onClick={() => setSelectedProduktIds([])}
                      title="Produkt-Filter zurücksetzen"
                    >
                      <X className="h-3.5 w-3.5" />
                    </Button>
                  )}
                </div>
              </div>
            )}

            {/* Plattform-Filter */}
            {plattformOptionen.length > 0 && (
              <div className="space-y-1.5">
                <Label className="text-xs">Plattformen</Label>
                <div className="flex items-center gap-1">
                  <MultiSelect
                    options={plattformOptionen}
                    selected={selectedPlattformIds}
                    onChange={setSelectedPlattformIds}
                    placeholder="Alle Plattformen"
                  />
                  {selectedPlattformIds.length > 0 && (
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 text-muted-foreground hover:text-foreground"
                      onClick={() => setSelectedPlattformIds([])}
                      title="Plattform-Filter zurücksetzen"
                    >
                      <X className="h-3.5 w-3.5" />
                    </Button>
                  )}
                </div>
              </div>
            )}
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
            ohneInvestitionen={false}
            selectedPositionIds={selectedPositionIds}
            onSelectionChange={setSelectedPositionIds}
          />

          {/* Absatztabelle */}
          <AbsatzTable
            data={absatzData}
            loading={absatzLoading}
            hasDateRange={hasValidDateRange}
            displayPerioden={displayPerioden}
            scrollContainerRef={absatzScrollRef}
          />

          {/* Matrix */}
          <ReportingRentabilitaetMatrix
            data={hasValidDateRange ? data : null}
            loading={loading}
            hasDateRange={hasValidDateRange}
            anzeigemodus={anzeigemodus}
            displayPerioden={displayPerioden}
            ohneInvestitionen={false}
            scrollContainerRef={matrixScrollRef}
          />

        </div>
      </main>
    </div>
  )
}
