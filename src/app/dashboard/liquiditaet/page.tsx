'use client'

import { useMemo } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { MultiSelect } from '@/components/multi-select'
import { useKpiCategories, KpiCategory } from '@/hooks/use-kpi-categories'
import {
  useLiquiditaet,
  LiquiditaetColumnVisibility,
  LiquiditaetQuelle,
} from '@/hooks/use-liquiditaet'
import { LiquiditaetTable } from '@/components/liquiditaet-table'
import { NavSheet } from '@/components/nav-sheet'

const QUELLE_OPTIONS: { id: LiquiditaetQuelle; name: string }[] = [
  { id: 'einnahmen', name: 'Einnahmen' },
  { id: 'ausgaben', name: 'Ausgaben' },
]

export default function LiquiditaetPage() {
  const { categories: einnahmenKategorien, loading: einnahmenLoading } = useKpiCategories('einnahmen')
  const { categories: ausgabenKategorien, loading: ausgabenLoading } = useKpiCategories('ausgaben_kosten')
  const { categories: salesPlattformen } = useKpiCategories('sales_plattformen')
  const { categories: produkte } = useKpiCategories('produkte')

  const {
    zeilen, loading, error,
    total, totalNettoCashflow, page, filter, sortColumn, sortDirection,
    setPage, setFilter, setSort,
  } = useLiquiditaet()

  const kpiLoading = einnahmenLoading || ausgabenLoading

  // Combined categories from BOTH KPI models for name lookup in the table
  const combinedCategories = useMemo<KpiCategory[]>(() => {
    return [...einnahmenKategorien, ...ausgabenKategorien]
  }, [einnahmenKategorien, ausgabenKategorien])

  // Column visibility based on EITHER model
  const columnVisibility = useMemo<LiquiditaetColumnVisibility>(() => ({
    showGruppe:
      einnahmenKategorien.some(c => c.level === 2) ||
      ausgabenKategorien.some(c => c.level === 2),
    showUntergruppe:
      einnahmenKategorien.some(c => c.level === 3) ||
      ausgabenKategorien.some(c => c.level === 3),
    showSalesPlattform:
      einnahmenKategorien.some(c => c.level === 1 && c.sales_plattform_enabled) ||
      ausgabenKategorien.some(c => c.level === 1 && c.sales_plattform_enabled),
    showProdukte:
      einnahmenKategorien.some(c => c.level === 1 && c.produkt_enabled) ||
      ausgabenKategorien.some(c => c.level === 1 && c.produkt_enabled),
  }), [einnahmenKategorien, ausgabenKategorien])

  // Kategorie filter is only shown when exactly ONE Quelle is selected
  const singleQuelle = filter.quelle?.length === 1 ? filter.quelle[0] : null
  const showKategorieFilter = singleQuelle !== null

  // Source pool for the Kategorie filter depends on which Quelle is selected
  const kategoriePool = useMemo<KpiCategory[]>(() => {
    if (singleQuelle === 'einnahmen') return einnahmenKategorien
    if (singleQuelle === 'ausgaben') return ausgabenKategorien
    return []
  }, [singleQuelle, einnahmenKategorien, ausgabenKategorien])

  const level1Kategorien = useMemo<KpiCategory[]>(
    () => kategoriePool.filter(c => c.level === 1),
    [kategoriePool]
  )

  // Cascade-filter state based on current selections
  const selectedKategorieId = filter.kategorie_ids?.length === 1 ? filter.kategorie_ids[0] : null
  const selectedGruppeId = filter.gruppe_ids?.length === 1 ? filter.gruppe_ids[0] : null

  const gruppeOptions = useMemo<KpiCategory[]>(() => {
    if (!selectedKategorieId) return []
    return kategoriePool.filter(c => c.level === 2 && c.parent_id === selectedKategorieId)
  }, [kategoriePool, selectedKategorieId])

  const untergruppeOptions = useMemo<KpiCategory[]>(() => {
    if (!selectedGruppeId) return []
    return kategoriePool.filter(c => c.level === 3 && c.parent_id === selectedGruppeId)
  }, [kategoriePool, selectedGruppeId])

  const showGruppeFilter = showKategorieFilter && (filter.kategorie_ids?.length ?? 0) === 1
  const showUntergruppeFilter = showGruppeFilter && (filter.gruppe_ids?.length ?? 0) === 1

  const hasAnyFilter = !!(
    filter.von || filter.bis ||
    filter.quelle?.length ||
    filter.kategorie_ids?.length || filter.gruppe_ids?.length || filter.untergruppe_ids?.length ||
    filter.sales_plattform_ids?.length || filter.produkt_ids?.length
  )

  const handleSort = (column: typeof sortColumn) => {
    if (column === sortColumn) {
      setSort(column, sortDirection === 'asc' ? 'desc' : 'asc')
    } else {
      setSort(column, 'desc')
    }
  }

  // No KPI models yet: neither einnahmen nor ausgaben has entries
  const noKpiModel = !kpiLoading && einnahmenKategorien.length === 0 && ausgabenKategorien.length === 0

  return (
    <div className="flex min-h-screen flex-col">
      <header className="border-b bg-background px-6 py-4">
        <div className="flex items-center gap-2">
          <NavSheet />
          <h1 className="text-lg font-semibold">Liquiditäts-Auswertung</h1>
        </div>
      </header>

      <main className="flex-1 p-6">
        <div className="w-full space-y-6">

          {/* No KPI model state */}
          {noKpiModel && (
            <div className="rounded-lg border bg-muted/30 p-8 text-center space-y-3">
              <p className="font-medium">Keine KPI-Modelle definiert</p>
              <p className="text-sm text-muted-foreground">
                Bitte zuerst die KPI-Modelle für Einnahmen und Ausgaben &amp; Kosten unter Einstellungen pflegen.
              </p>
              <a href="/dashboard/kpi-modell">
                <Button variant="outline" size="sm" className="mt-2">
                  Zum KPI-Modell
                </Button>
              </a>
            </div>
          )}

          {/* Error state */}
          {error && (
            <div className="rounded-lg border border-destructive bg-destructive/10 p-4 text-sm text-destructive">
              {error}
            </div>
          )}

          {/* Filter bar */}
          {!noKpiModel && (
            <div className="flex flex-wrap items-end gap-4">
              <div className="space-y-1.5">
                <Label className="text-xs">Von (Zahlungsdatum)</Label>
                <Input
                  type="date"
                  className="h-8 w-44 text-sm"
                  value={filter.von ?? ''}
                  onChange={e => setFilter({ ...filter, von: e.target.value || undefined })}
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Bis (Zahlungsdatum)</Label>
                <Input
                  type="date"
                  className="h-8 w-44 text-sm"
                  value={filter.bis ?? ''}
                  onChange={e => setFilter({ ...filter, bis: e.target.value || undefined })}
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Quelle</Label>
                <MultiSelect
                  options={QUELLE_OPTIONS}
                  selected={filter.quelle ?? []}
                  placeholder="Alle Quellen"
                  onChange={ids => {
                    setFilter({
                      ...filter,
                      quelle: ids.length ? (ids as LiquiditaetQuelle[]) : undefined,
                      kategorie_ids: undefined,
                      gruppe_ids: undefined,
                      untergruppe_ids: undefined,
                    })
                  }}
                />
              </div>
              {showKategorieFilter && (
              <div className="space-y-1.5">
                <Label className="text-xs">Kategorie</Label>
                <MultiSelect
                  options={level1Kategorien}
                  selected={filter.kategorie_ids ?? []}
                  placeholder="Alle Kategorien"
                  onChange={ids => {
                    setFilter({
                      ...filter,
                      kategorie_ids: ids.length ? ids : undefined,
                      gruppe_ids: undefined,
                      untergruppe_ids: undefined,
                    })
                  }}
                />
              </div>
              )}
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
                        untergruppe_ids: undefined,
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
                      setFilter({ ...filter, untergruppe_ids: ids.length ? ids : undefined })
                    }}
                  />
                </div>
              )}
              {columnVisibility.showSalesPlattform && (
                <div className="space-y-1.5">
                  <Label className="text-xs">Sales Plattform</Label>
                  <MultiSelect
                    options={salesPlattformen}
                    selected={filter.sales_plattform_ids ?? []}
                    placeholder="Alle Plattformen"
                    onChange={ids => {
                      setFilter({ ...filter, sales_plattform_ids: ids.length ? ids : undefined })
                    }}
                  />
                </div>
              )}
              {columnVisibility.showProdukte && (
                <div className="space-y-1.5">
                  <Label className="text-xs">Produkt</Label>
                  <MultiSelect
                    options={produkte}
                    selected={filter.produkt_ids ?? []}
                    placeholder="Alle Produkte"
                    onChange={ids => {
                      setFilter({ ...filter, produkt_ids: ids.length ? ids : undefined })
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

          {/* Table */}
          {!noKpiModel && (
            <LiquiditaetTable
              zeilen={zeilen}
              loading={loading}
              columnVisibility={columnVisibility}
              kpiCategories={combinedCategories}
              salesPlattformen={salesPlattformen}
              produkte={produkte}
              total={total}
              totalNettoCashflow={totalNettoCashflow}
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
