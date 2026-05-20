'use client'

import { useState, useMemo } from 'react'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
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
import { NavSheet } from '@/components/nav-sheet'
import { useKpiCategories, type KpiCategory } from '@/hooks/use-kpi-categories'
import {
  useBestandTransaktionen,
  type BestandTransaktion,
  type BestandFormData,
} from '@/hooks/use-bestand-transaktionen'
import { BestandTable } from '@/components/bestand-table'
import { BestandFormDialog } from '@/components/bestand-form-dialog'
import { FulfillmentCrowdImportWizard } from '@/components/fulfillment-crowd-import-wizard'

// Per-SKU content: transactions table + form + delete dialog
function BestandSkuTab({
  skuId,
  produktId,
  plattformen,
  filterVon,
  filterBis,
  setFilterVon,
  setFilterBis,
}: {
  skuId: string
  produktId: string
  plattformen: KpiCategory[]
  filterVon: string
  filterBis: string
  setFilterVon: (v: string) => void
  setFilterBis: (v: string) => void
}) {
  const { transaktionen, loading, error, addTransaktion, updateTransaktion, deleteTransaktion } =
    useBestandTransaktionen(skuId)

  const [formOpen, setFormOpen] = useState(false)
  const [editingTransaktion, setEditingTransaktion] = useState<BestandTransaktion | null>(null)
  const [deleteTargetId, setDeleteTargetId] = useState<string | null>(null)
  const [deleting, setDeleting] = useState(false)

  const handleNewClick = () => {
    setEditingTransaktion(null)
    setFormOpen(true)
  }

  const handleEditClick = (t: BestandTransaktion) => {
    setEditingTransaktion(t)
    setFormOpen(true)
  }

  const handleSave = async (data: BestandFormData) => {
    if (editingTransaktion) {
      await updateTransaktion(editingTransaktion.id, data)
    } else {
      await addTransaktion(skuId, produktId, data)
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

  return (
    <div className="space-y-4">
      {/* Von-bis-Datumsfilter */}
      <div className="flex flex-wrap items-end gap-4">
        <div className="space-y-1.5">
          <Label htmlFor="filter-von">Von</Label>
          <Input
            id="filter-von"
            type="date"
            value={filterVon}
            onChange={e => setFilterVon(e.target.value)}
            className="w-40"
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="filter-bis">Bis</Label>
          <Input
            id="filter-bis"
            type="date"
            value={filterBis}
            onChange={e => setFilterBis(e.target.value)}
            className="w-40"
          />
        </div>
        {(filterVon || filterBis) && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => { setFilterVon(''); setFilterBis('') }}
          >
            Filter zurücksetzen
          </Button>
        )}
      </div>

      <div className="flex justify-end">
        <Button size="sm" onClick={handleNewClick}>
          + Neue Transaktion
        </Button>
      </div>

      {error && (
        <div className="rounded-lg border border-destructive bg-destructive/10 p-4 text-sm text-destructive">
          {error}
        </div>
      )}

      <BestandTable
        transaktionen={transaktionen}
        plattformen={plattformen}
        loading={loading}
        filterVon={filterVon}
        filterBis={filterBis}
        onEdit={handleEditClick}
        onDelete={id => setDeleteTargetId(id)}
      />

      <BestandFormDialog
        open={formOpen}
        onOpenChange={setFormOpen}
        transaktionToEdit={editingTransaktion}
        skuId={skuId}
        produktId={produktId}
        plattformen={plattformen}
        existingTransaktionen={transaktionen}
        onSave={handleSave}
      />

      <AlertDialog
        open={deleteTargetId !== null}
        onOpenChange={open => { if (!open) setDeleteTargetId(null) }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Transaktion löschen?</AlertDialogTitle>
            <AlertDialogDescription>
              Diese Bestandstransaktion wird dauerhaft gelöscht.
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

// Per-Product content: SKU tabs
function ProduktTab({
  produkt,
  allProdukteCategories,
  plattformen,
  filterVon,
  filterBis,
  setFilterVon,
  setFilterBis,
}: {
  produkt: KpiCategory
  allProdukteCategories: KpiCategory[]
  plattformen: KpiCategory[]
  filterVon: string
  filterBis: string
  setFilterVon: (v: string) => void
  setFilterBis: (v: string) => void
}) {
  const skus = useMemo(
    () =>
      allProdukteCategories
        .filter(c => c.level === 2 && c.parent_id === produkt.id)
        .sort((a, b) => a.sort_order - b.sort_order),
    [allProdukteCategories, produkt.id],
  )

  if (skus.length === 0) {
    return (
      <div className="rounded-lg border bg-muted/30 p-8 text-center space-y-3">
        <p className="font-medium">Keine SKUs für „{produkt.name}" definiert</p>
        <p className="text-sm text-muted-foreground">
          Bitte im KPI-Modell unter „Produkte" → „{produkt.name}" SKUs anlegen.
        </p>
        <a href="/dashboard/kpi-modell">
          <Button variant="outline" size="sm" className="mt-2">
            Zum KPI-Modell
          </Button>
        </a>
      </div>
    )
  }

  const skuLabel = (sku: KpiCategory) =>
    sku.sku_code ? `${sku.sku_code} – ${sku.name}` : sku.name

  return (
    <Tabs defaultValue={skus[0]?.id}>
      <TabsList className="flex-wrap h-auto gap-1">
        {skus.map(sku => (
          <TabsTrigger key={sku.id} value={sku.id}>
            {skuLabel(sku)}
          </TabsTrigger>
        ))}
      </TabsList>
      {skus.map(sku => (
        <TabsContent key={sku.id} value={sku.id} className="mt-4">
          <BestandSkuTab
            skuId={sku.id}
            produktId={produkt.id}
            plattformen={plattformen}
            filterVon={filterVon}
            filterBis={filterBis}
            setFilterVon={setFilterVon}
            setFilterBis={setFilterBis}
          />
        </TabsContent>
      ))}
    </Tabs>
  )
}

export default function BestandsverwaltungPage() {
  const { categories: produkteCategories, loading: produkteLoading } = useKpiCategories('produkte')
  const { categories: plattformenRaw, loading: plattformenLoading } = useKpiCategories('sales_plattformen')

  const [filterVon, setFilterVon] = useState('')
  const [filterBis, setFilterBis] = useState('')
  const [fcWizardOpen, setFcWizardOpen] = useState(false)
  const [refreshKey, setRefreshKey] = useState(0)

  const loading = produkteLoading || plattformenLoading

  const sortedProdukte = useMemo(
    () =>
      produkteCategories
        .filter(p => p.level === 1)
        .sort((a, b) => a.sort_order - b.sort_order),
    [produkteCategories],
  )

  const sortedPlattformen = useMemo(
    () =>
      plattformenRaw
        .filter(p => p.level === 1)
        .sort((a, b) => a.sort_order - b.sort_order),
    [plattformenRaw],
  )

  const noProdukte = !loading && sortedProdukte.length === 0

  const skuCategories = useMemo(
    () => produkteCategories.filter(c => c.level === 2),
    [produkteCategories],
  )

  return (
    <div className="flex min-h-screen flex-col">
      <header className="border-b bg-background px-6 py-4">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <NavSheet />
            <h1 className="text-lg font-semibold">Bestandsverwaltung</h1>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setFcWizardOpen(true)}
            disabled={loading}
          >
            Fulfillment Crowd Excel importieren
          </Button>
        </div>
      </header>

      <FulfillmentCrowdImportWizard
        open={fcWizardOpen}
        onOpenChange={setFcWizardOpen}
        skuCategories={skuCategories}
        plattformCategories={sortedPlattformen}
        onImportDone={() => setRefreshKey(k => k + 1)}
      />

      <main className="flex-1 p-6">
        <div key={refreshKey} className="w-full space-y-6">

          {loading && (
            <div className="py-8 text-center text-sm text-muted-foreground">Laden…</div>
          )}

          {noProdukte && (
            <div className="rounded-lg border bg-muted/30 p-8 text-center space-y-3">
              <p className="font-medium">Keine Produkte definiert</p>
              <p className="text-sm text-muted-foreground">
                Bitte zuerst Produkte im KPI-Modell anlegen, bevor Bestandsdaten erfasst werden können.
              </p>
              <a href="/dashboard/kpi-modell">
                <Button variant="outline" size="sm" className="mt-2">
                  Zum KPI-Modell
                </Button>
              </a>
            </div>
          )}

          {!loading && sortedProdukte.length > 0 && (
            <Tabs defaultValue={sortedProdukte[0]?.id}>
              <TabsList className="flex-wrap h-auto gap-1">
                {sortedProdukte.map(p => (
                  <TabsTrigger key={p.id} value={p.id}>
                    {p.name}
                  </TabsTrigger>
                ))}
              </TabsList>
              {sortedProdukte.map(p => (
                <TabsContent key={p.id} value={p.id} className="mt-4">
                  <ProduktTab
                    produkt={p}
                    allProdukteCategories={produkteCategories}
                    plattformen={sortedPlattformen}
                    filterVon={filterVon}
                    filterBis={filterBis}
                    setFilterVon={setFilterVon}
                    setFilterBis={setFilterBis}
                  />
                </TabsContent>
              ))}
            </Tabs>
          )}

        </div>
      </main>
    </div>
  )
}
