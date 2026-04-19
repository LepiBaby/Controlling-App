'use client'

import { useMemo, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { MultiSelect } from '@/components/multi-select'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { useKpiCategories } from '@/hooks/use-kpi-categories'
import { useEinnahmenTransaktionen, ColumnVisibility, EinnahmenTransaktion } from '@/hooks/use-einnahmen-transaktionen'
import { EinnahmenTable } from '@/components/einnahmen-table'
import { EinnahmenFormDialog } from '@/components/einnahmen-form-dialog'
import { NavSheet } from '@/components/nav-sheet'

export default function EinnahmenPage() {
  const { categories: einnahmenKategorien, loading: kpiLoading } = useKpiCategories('einnahmen')
  const { categories: salesPlattformen } = useKpiCategories('sales_plattformen')
  const { categories: produkte } = useKpiCategories('produkte')

  const {
    transaktionen, loading, error,
    total, totalBetrag, page, filter, sortColumn, sortDirection,
    setPage, setFilter, setSort,
    addTransaktion, updateTransaktion, deleteTransaktion,
  } = useEinnahmenTransaktionen()

  const [formOpen, setFormOpen] = useState(false)
  const [editingTransaktion, setEditingTransaktion] = useState<EinnahmenTransaktion | null>(null)
  const [deleteTargetId, setDeleteTargetId] = useState<string | null>(null)
  const [deleting, setDeleting] = useState(false)

  // Compute dynamic column visibility from KPI model
  const columnVisibility = useMemo<ColumnVisibility>(() => ({
    showGruppe: einnahmenKategorien.some(c => c.level === 2),
    showUntergruppe: einnahmenKategorien.some(c => c.level === 3),
    showSalesPlattform: einnahmenKategorien.some(c => c.level === 1 && c.sales_plattform_enabled),
    showProdukte: einnahmenKategorien.some(c => c.level === 1 && c.produkt_enabled),
  }), [einnahmenKategorien])

  const level1Kategorien = einnahmenKategorien.filter(c => c.level === 1)

  // Derive available options for Gruppe and Untergruppe filters based on current selections
  const selectedKategorieId = filter.kategorie_ids?.length === 1 ? filter.kategorie_ids[0] : null
  const selectedGruppeId    = filter.gruppe_ids?.length === 1 ? filter.gruppe_ids[0] : null

  const gruppeOptions = useMemo(() => {
    if (!selectedKategorieId) return []
    return einnahmenKategorien.filter(c => c.level === 2 && c.parent_id === selectedKategorieId)
  }, [einnahmenKategorien, selectedKategorieId])

  const untergruppeOptions = useMemo(() => {
    if (!selectedGruppeId) return []
    return einnahmenKategorien.filter(c => c.level === 3 && c.parent_id === selectedGruppeId)
  }, [einnahmenKategorien, selectedGruppeId])

  const showGruppeFilter      = (filter.kategorie_ids?.length ?? 0) === 1
  const showUntergruppeFilter = showGruppeFilter && (filter.gruppe_ids?.length ?? 0) === 1

  const hasAnyFilter = !!(
    filter.von || filter.bis ||
    filter.kategorie_ids?.length || filter.gruppe_ids?.length || filter.untergruppe_ids?.length ||
    filter.sales_plattform_ids?.length || filter.produkt_ids?.length
  )

  const handleNewClick = () => {
    setEditingTransaktion(null)
    setFormOpen(true)
  }

  const handleEditClick = (t: EinnahmenTransaktion) => {
    setEditingTransaktion(t)
    setFormOpen(true)
  }

  const handleSave = async (input: Parameters<typeof addTransaktion>[0]) => {
    if (editingTransaktion) {
      await updateTransaktion(editingTransaktion.id, input)
    } else {
      await addTransaktion(input)
    }
  }

  const handleDeleteConfirm = async () => {
    if (!deleteTargetId) return
    setDeleting(true)
    try {
      await deleteTransaktion(deleteTargetId)
    } finally {
      setDeleting(false)
      setDeleteTargetId(null)
    }
  }

  const handleSort = (column: typeof sortColumn) => {
    if (column === sortColumn) {
      setSort(column, sortDirection === 'asc' ? 'desc' : 'asc')
    } else {
      setSort(column, 'desc')
    }
  }

  // No KPI model yet
  const noKpiModel = !kpiLoading && einnahmenKategorien.length === 0

  return (
    <div className="flex min-h-screen flex-col">
      <header className="border-b bg-background px-6 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <NavSheet />
            <h1 className="text-lg font-semibold">Einnahmen</h1>
          </div>
          {!noKpiModel && (
            <Button onClick={handleNewClick} size="sm">
              + Neue Transaktion
            </Button>
          )}
        </div>
      </header>

      <main className="flex-1 p-6">
        <div className="w-full space-y-6">

          {/* No KPI model state */}
          {noKpiModel && (
            <div className="rounded-lg border bg-muted/30 p-8 text-center space-y-3">
              <p className="font-medium">Kein Einnahmen-KPI-Modell definiert</p>
              <p className="text-sm text-muted-foreground">
                Bitte zuerst das KPI-Modell unter Einstellungen pflegen, bevor Einnahmen erfasst werden können.
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
                <Label className="text-xs">Von</Label>
                <Input
                  type="date"
                  className="h-8 w-36 text-sm"
                  value={filter.von ?? ''}
                  onChange={e => setFilter({ ...filter, von: e.target.value || undefined })}
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Bis</Label>
                <Input
                  type="date"
                  className="h-8 w-36 text-sm"
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
                  onChange={ids => {
                    // Reset child filters when parent changes to multiple
                    setFilter({ ...filter, kategorie_ids: ids.length ? ids : undefined, gruppe_ids: undefined, untergruppe_ids: undefined })
                  }}
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
                      setFilter({ ...filter, gruppe_ids: ids.length ? ids : undefined, untergruppe_ids: undefined })
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
            <EinnahmenTable
              transaktionen={transaktionen}
              loading={loading}
              columnVisibility={columnVisibility}
              einnahmenKategorien={einnahmenKategorien}
              salesPlattformen={salesPlattformen}
              produkte={produkte}
              total={total}
              totalBetrag={totalBetrag}
              page={page}
              onPageChange={setPage}
              sortColumn={sortColumn}
              sortDirection={sortDirection}
              onSort={handleSort}
              onEdit={handleEditClick}
              onDelete={id => setDeleteTargetId(id)}
            />
          )}
        </div>
      </main>

      {/* Form dialog */}
      <EinnahmenFormDialog
        open={formOpen}
        onOpenChange={setFormOpen}
        transaktionToEdit={editingTransaktion}
        einnahmenKategorien={einnahmenKategorien}
        salesPlattformen={salesPlattformen}
        produkte={produkte}
        onSave={handleSave}
      />

      {/* Delete confirmation */}
      <AlertDialog open={deleteTargetId !== null} onOpenChange={open => { if (!open) setDeleteTargetId(null) }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Transaktion löschen?</AlertDialogTitle>
            <AlertDialogDescription>
              Diese Aktion kann nicht rückgängig gemacht werden.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Abbrechen</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteConfirm}
              disabled={deleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleting ? 'Löschen…' : 'Löschen'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
