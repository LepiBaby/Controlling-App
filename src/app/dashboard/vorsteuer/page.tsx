'use client'

import { useMemo } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { MultiSelect } from '@/components/multi-select'
import { useKpiCategories, KpiCategory } from '@/hooks/use-kpi-categories'
import { useVorsteuer } from '@/hooks/use-vorsteuer'
import { VorsteuerTable, VorsteuerColumnVisibility } from '@/components/vorsteuer-table'
import { NavSheet } from '@/components/nav-sheet'

export default function VorsteuerPage() {
  const { categories: ausgabenKategorien, loading: kpiLoading } = useKpiCategories('ausgaben_kosten')

  const {
    transaktionen, loading, error,
    total, page, filter, sortColumn, sortDirection,
    setPage, setFilter, setSort,
  } = useVorsteuer()

  const level1Kategorien = useMemo<KpiCategory[]>(
    () => ausgabenKategorien.filter(c => c.level === 1),
    [ausgabenKategorien]
  )

  const selectedKategorieId = filter.kategorie_ids?.length === 1 ? filter.kategorie_ids[0] : null
  const selectedGruppeId    = filter.gruppe_ids?.length === 1 ? filter.gruppe_ids[0] : null

  const gruppeOptions = useMemo<KpiCategory[]>(() => {
    if (!selectedKategorieId) return []
    return ausgabenKategorien.filter(c => c.level === 2 && c.parent_id === selectedKategorieId)
  }, [ausgabenKategorien, selectedKategorieId])

  const untergruppeOptions = useMemo<KpiCategory[]>(() => {
    if (!selectedGruppeId) return []
    return ausgabenKategorien.filter(c => c.level === 3 && c.parent_id === selectedGruppeId)
  }, [ausgabenKategorien, selectedGruppeId])

  const showGruppeFilter      = (filter.kategorie_ids?.length ?? 0) === 1
  const showUntergruppeFilter = showGruppeFilter && (filter.gruppe_ids?.length ?? 0) === 1

  const columnVisibility = useMemo<VorsteuerColumnVisibility>(() => ({
    showGruppe:      ausgabenKategorien.some(c => c.level === 2),
    showUntergruppe: ausgabenKategorien.some(c => c.level === 3),
  }), [ausgabenKategorien])

  const hasAnyFilter = !!(
    filter.von || filter.bis ||
    filter.kategorie_ids?.length ||
    filter.gruppe_ids?.length ||
    filter.untergruppe_ids?.length
  )

  const handleSort = (column: typeof sortColumn) => {
    if (column === sortColumn) {
      setSort(column, sortDirection === 'asc' ? 'desc' : 'asc')
    } else {
      setSort(column, 'asc')
    }
  }

  const noKpiModel = !kpiLoading && ausgabenKategorien.length === 0

  return (
    <div className="flex min-h-screen flex-col">
      <header className="border-b bg-background px-6 py-4">
        <div className="flex items-center gap-2">
          <NavSheet />
          <h1 className="text-lg font-semibold">Abziehbare Vorsteuer</h1>
        </div>
      </header>

      <main className="flex-1 p-6">
        <div className="w-full space-y-6">

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

          {error && (
            <div className="rounded-lg border border-destructive bg-destructive/10 p-4 text-sm text-destructive">
              {error}
            </div>
          )}

          {!noKpiModel && (
            <div className="flex flex-wrap items-end gap-4">
              <div className="space-y-1.5">
                <Label className="text-xs">Von (Leistungsdatum)</Label>
                <Input
                  type="date"
                  className="h-8 w-44 text-sm"
                  value={filter.von ?? ''}
                  onChange={e => setFilter({ ...filter, von: e.target.value || undefined })}
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Bis (Leistungsdatum)</Label>
                <Input
                  type="date"
                  className="h-8 w-44 text-sm"
                  value={filter.bis ?? ''}
                  onChange={e => setFilter({ ...filter, bis: e.target.value || undefined })}
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Kategorie</Label>
                <MultiSelect
                  options={level1Kategorien}
                  selected={filter.kategorie_ids ?? []}
                  placeholder="Alle Kategorien"
                  onChange={ids => setFilter({ ...filter, kategorie_ids: ids.length ? ids : undefined })}
                />
              </div>
              {showGruppeFilter && (
                <div className="space-y-1.5">
                  <Label className="text-xs">Gruppe</Label>
                  <MultiSelect
                    options={gruppeOptions}
                    selected={filter.gruppe_ids ?? []}
                    placeholder="Alle Gruppen"
                    onChange={ids => setFilter({ ...filter, gruppe_ids: ids.length ? ids : undefined })}
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
                    onChange={ids => setFilter({ ...filter, untergruppe_ids: ids.length ? ids : undefined })}
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

          {!noKpiModel && (
            <VorsteuerTable
              transaktionen={transaktionen}
              loading={loading}
              ausgabenKategorien={ausgabenKategorien}
              columnVisibility={columnVisibility}
              total={total}
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
