'use client'

import { useMemo } from 'react'
import { NavSheet } from '@/components/nav-sheet'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { ReportingRentabilitaetMatrix } from '@/components/reporting-rentabilitaet-matrix'
import { ReportingRentabilitaetChart } from '@/components/reporting-rentabilitaet-chart'
import { MultiSelect } from '@/components/multi-select'
import { useReportingBreakEven } from '@/hooks/use-reporting-break-even'
import { type ReportGranularitaet } from '@/hooks/use-reporting-rentabilitaet'
import { TrendingUp, X } from 'lucide-react'

export default function ReportingBreakEvenPage() {
  const {
    granularitaet, selectedProduktIds, produktOptionen,
    data, displayPerioden, loading, error, hasProducts,
    setGranularitaet, setSelectedProduktIds, removeProdukt,
  } = useReportingBreakEven()

  // Immer nur die letzte Summen-Position (DB3) im Diagramm — fixiert, nicht änderbar
  const lastSummeId = useMemo(() => {
    if (!data) return null
    const summen = data.positionen.filter(p => p.type === 'summe')
    return summen.length > 0 ? summen[summen.length - 1].id : null
  }, [data])

  const selectedPositionIds = lastSummeId ? [lastSummeId] : []

  return (
    <div className="flex min-h-screen flex-col">
      <header className="border-b bg-background px-6 py-4">
        <div className="flex items-center gap-2">
          <NavSheet />
          <h1 className="text-lg font-semibold">Break-Even-Report</h1>
        </div>
      </header>

      <main className="flex-1 p-6">
        <div className="w-full space-y-6">

          {/* Filter-Leiste */}
          <div className="flex flex-wrap items-end gap-4">

            {/* Produkt-Filter (Pflicht) */}
            <div className="space-y-1.5">
              <p className="text-xs text-muted-foreground font-medium">
                Produkte <span className="text-destructive">*</span>
              </p>
              <div className="flex items-center gap-1">
                <MultiSelect
                  options={produktOptionen}
                  selected={selectedProduktIds}
                  onChange={setSelectedProduktIds}
                  placeholder="Produkt auswählen…"
                />
              </div>
              {produktOptionen.length === 0 && (
                <p className="text-xs text-muted-foreground">
                  Keine Produkte im KPI-Modell konfiguriert.
                </p>
              )}
            </div>

            {/* Granularitäts-Tabs */}
            <div className="space-y-1.5">
              <p className="text-xs text-muted-foreground font-medium">Zeitraum</p>
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

            {/* Gewählte Produkte als Chips */}
            {selectedProduktIds.length > 0 && (
              <div className="flex flex-wrap items-center gap-1.5">
                {selectedProduktIds.map(id => {
                  const opt = produktOptionen.find(o => o.id === id)
                  if (!opt) return null
                  return (
                    <Badge
                      key={id}
                      variant="outline"
                      className="gap-1 bg-green-50 border-green-200 text-green-800 dark:bg-green-950/30 dark:border-green-800 dark:text-green-300"
                    >
                      {opt.name}
                      {selectedProduktIds.length > 1 && (
                        <button
                          onClick={() => removeProdukt(id)}
                          className="ml-0.5 rounded-full hover:bg-green-200 dark:hover:bg-green-800 p-0.5"
                          title={`${opt.name} entfernen`}
                        >
                          <X className="h-2.5 w-2.5" />
                        </button>
                      )}
                    </Badge>
                  )
                })}
                {selectedProduktIds.length > 1 && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-6 text-xs text-muted-foreground hover:text-foreground px-2"
                    onClick={() => {
                      if (selectedProduktIds.length > 0) {
                        setSelectedProduktIds([selectedProduktIds[0]])
                      }
                    }}
                  >
                    Alle außer erstem entfernen
                  </Button>
                )}
              </div>
            )}
          </div>

          {/* API-Fehler */}
          {error && (
            <div className="rounded-lg border border-destructive bg-destructive/10 p-4 text-sm text-destructive">
              {error}
            </div>
          )}

          {/* Leer-Zustand A: Kein Produkt gewählt */}
          {!hasProducts && (
            <div className="flex flex-col items-center gap-3 rounded-lg border border-dashed py-16 text-center text-muted-foreground">
              <TrendingUp className="h-8 w-8" />
              <div>
                <p className="text-sm font-medium">Kein Produkt ausgewählt</p>
                <p className="text-xs mt-1 max-w-xs mx-auto">
                  Wähle mindestens ein Produkt aus, um den kumulierten Break-Even-Verlauf zu sehen.
                </p>
              </div>
            </div>
          )}

          {/* Diagramm + Tabelle: nur wenn Produkt gewählt */}
          {hasProducts && (
            <>
              <ReportingRentabilitaetChart
                data={data}
                loading={loading}
                hasDateRange={true}
                anzeigemodus="absolut"
                displayPerioden={displayPerioden}
                ohneInvestitionen={false}
                selectedPositionIds={selectedPositionIds}
                onSelectionChange={() => {}}
                lockedSelection
              />

              <ReportingRentabilitaetMatrix
                data={data}
                loading={loading}
                hasDateRange={true}
                anzeigemodus="absolut"
                displayPerioden={displayPerioden}
                ohneInvestitionen={false}
              />
            </>
          )}

        </div>
      </main>
    </div>
  )
}
