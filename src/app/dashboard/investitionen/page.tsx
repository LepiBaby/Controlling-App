'use client'

import { useMemo } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { MultiSelect } from '@/components/multi-select'
import { useKpiCategories, KpiCategory } from '@/hooks/use-kpi-categories'
import { useInvestitionen } from '@/hooks/use-investitionen'
import { InvestitionenTable, InvestitionenColumnVisibility } from '@/components/investitionen-table'
import { NavSheet } from '@/components/nav-sheet'

export default function InvestitionenPage() {
  const { categories: ausgabenKategorien, loading: kpiLoading } = useKpiCategories('ausgaben_kosten')
  const { categories: produkte } = useKpiCategories('produkte')

  const {
    raten, loading, error,
    total, totalBetrag, page, filter, sortColumn, sortDirection,
    setPage, setFilter, setSort,
  } = useInvestitionen()

  // "Produktinvestitionen"-Kategorie (Ebene 1) im KPI-Modell finden
  const produktinvestitionenKat = useMemo<KpiCategory | undefined>(
    () => ausgabenKategorien.find(c => c.level === 1 && c.name === 'Produktinvestitionen'),
    [ausgabenKategorien]
  )

  // Gruppen (Ebene 2) unter "Produktinvestitionen"
  const gruppeOptions = useMemo<KpiCategory[]>(() => {
    if (!produktinvestitionenKat) return []
    return ausgabenKategorien.filter(c => c.level === 2 && c.parent_id === produktinvestitionenKat.id)
  }, [ausgabenKategorien, produktinvestitionenKat])

  const selectedGruppeId = filter.gruppe_ids?.length === 1 ? filter.gruppe_ids[0] : null

  // Untergruppen (Ebene 3) unter der gewählten Gruppe
  const untergruppeOptions = useMemo<KpiCategory[]>(() => {
    if (!selectedGruppeId) return []
    return ausgabenKategorien.filter(c => c.level === 3 && c.parent_id === selectedGruppeId)
  }, [ausgabenKategorien, selectedGruppeId])

  // Gruppe-Filter erscheint wenn Produktinvestitionen Gruppen hat
  const showGruppeFilter = gruppeOptions.length > 0
  // Untergruppe-Filter erscheint nur wenn genau 1 Gruppe gewählt ist
  const showUntergruppeFilter = showGruppeFilter && (filter.gruppe_ids?.length ?? 0) === 1

  // Spalten-Sichtbarkeit: anhand KPI-Modell unter Produktinvestitionen
  const columnVisibility = useMemo<InvestitionenColumnVisibility>(() => ({
    showGruppe: gruppeOptions.length > 0,
    showUntergruppe: ausgabenKategorien.some(
      c => c.level === 3 && gruppeOptions.some(g => g.id === c.parent_id)
    ),
    showProdukt: produkte.length > 0,
  }), [gruppeOptions, ausgabenKategorien, produkte])

  const hasAnyFilter = !!(
    filter.von || filter.bis ||
    filter.gruppe_ids?.length ||
    filter.untergruppe_ids?.length ||
    filter.produkt_ids?.length
  )

  const handleSort = (column: typeof sortColumn) => {
    if (column === sortColumn) {
      setSort(column, sortDirection === 'asc' ? 'desc' : 'asc')
    } else {
      setSort(column, 'asc')
    }
  }

  const noKpiModel = !kpiLoading && ausgabenKategorien.length === 0
  const noProduktivestitionenKat = !kpiLoading && ausgabenKategorien.length > 0 && !produktinvestitionenKat

  return (
    <div className="flex min-h-screen flex-col">
      <header className="border-b bg-background px-6 py-4">
        <div className="flex items-center gap-2">
          <NavSheet />
          <h1 className="text-lg font-semibold">Investitionen-Auswertung</h1>
        </div>
      </header>

      <main className="flex-1 p-6">
        <div className="w-full space-y-6">

          {/* Kein KPI-Modell */}
          {noKpiModel && (
            <div className="rounded-lg border bg-muted/30 p-8 text-center space-y-3">
              <p className="font-medium">Kein KPI-Modell definiert</p>
              <p className="text-sm text-muted-foreground">
                Bitte zuerst das KPI-Modell für Ausgaben &amp; Kosten unter Einstellungen pflegen.
              </p>
              <a href="/dashboard/kpi-modell">
                <Button variant="outline" size="sm" className="mt-2">
                  Zum KPI-Modell
                </Button>
              </a>
            </div>
          )}

          {/* Keine "Produktinvestitionen"-Kategorie */}
          {noProduktivestitionenKat && (
            <div className="rounded-lg border bg-muted/30 p-8 text-center space-y-3">
              <p className="font-medium">Keine Kategorie „Produktinvestitionen" gefunden</p>
              <p className="text-sm text-muted-foreground">
                Diese Auswertung zeigt Transaktionen der Kategorie „Produktinvestitionen".
                Bitte legen Sie diese Kategorie im KPI-Modell an.
              </p>
              <a href="/dashboard/kpi-modell">
                <Button variant="outline" size="sm" className="mt-2">
                  Zum KPI-Modell
                </Button>
              </a>
            </div>
          )}

          {/* Fehleranzeige */}
          {error && (
            <div className="rounded-lg border border-destructive bg-destructive/10 p-4 text-sm text-destructive">
              {error}
            </div>
          )}

          {/* Filter-Leiste */}
          {!noKpiModel && (
            <div className="flex flex-wrap items-end gap-4">
              <div className="space-y-1.5">
                <Label className="text-xs">Von (Ratendatum)</Label>
                <Input
                  type="date"
                  className="h-8 w-44 text-sm"
                  value={filter.von ?? ''}
                  onChange={e => setFilter({ ...filter, von: e.target.value || undefined })}
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Bis (Ratendatum)</Label>
                <Input
                  type="date"
                  className="h-8 w-44 text-sm"
                  value={filter.bis ?? ''}
                  onChange={e => setFilter({ ...filter, bis: e.target.value || undefined })}
                />
              </div>
              {showGruppeFilter && (
                <div className="space-y-1.5">
                  <Label className="text-xs">Gruppe</Label>
                  <MultiSelect
                    options={gruppeOptions}
                    selected={filter.gruppe_ids ?? []}
                    placeholder="Alle Gruppen"
                    onChange={ids => {
                      setFilter({
                        ...filter,
                        gruppe_ids: ids.length ? ids : undefined,
                      })
                    }}
                  />
                </div>
              )}
              {showUntergruppeFilter && (
                <div className="space-y-1.5">
                  <Label className="text-xs">Untergruppe</Label>
                  <MultiSelect
                    options={untergruppeOptions}
                    selected={filter.untergruppe_ids ?? []}
                    placeholder="Alle Untergruppen"
                    onChange={ids => {
                      setFilter({
                        ...filter,
                        untergruppe_ids: ids.length ? ids : undefined,
                      })
                    }}
                  />
                </div>
              )}
              {produkte.length > 0 && (
                <div className="space-y-1.5">
                  <Label className="text-xs">Produkt</Label>
                  <MultiSelect
                    options={produkte}
                    selected={filter.produkt_ids ?? []}
                    placeholder="Alle Produkte"
                    onChange={ids => {
                      setFilter({
                        ...filter,
                        produkt_ids: ids.length ? ids : undefined,
                      })
                    }}
                  />
                </div>
              )}
              {hasAnyFilter && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-8 text-muted-foreground"
                  onClick={() => setFilter({})}
                >
                  Filter zurücksetzen
                </Button>
              )}
            </div>
          )}

          {/* Tabelle */}
          {!noKpiModel && (
            <InvestitionenTable
              raten={raten}
              loading={loading}
              ausgabenKategorien={ausgabenKategorien}
              produkte={produkte}
              columnVisibility={columnVisibility}
              total={total}
              totalBetrag={totalBetrag}
              page={page}
              onPageChange={setPage}
              sortColumn={sortColumn}
              sortDirection={sortDirection}
              onSort={handleSort}
            />
          )}
        </div>
      </main>
    </div>
  )
}
