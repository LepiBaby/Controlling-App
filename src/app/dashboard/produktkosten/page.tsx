'use client'

import { useState, useMemo } from 'react'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Button } from '@/components/ui/button'
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
  useProduktkostenZeitraeume,
  type ProduktkostenZeitraum,
  type ProduktkostenFormData,
} from '@/hooks/use-produktkosten'
import { ProduktkostenTable } from '@/components/produktkosten-table'
import { ProduktkostenFormDialog } from '@/components/produktkosten-form-dialog'

function ProduktTab({
  produktId,
  kostenkategorien,
}: {
  produktId: string
  kostenkategorien: KpiCategory[]
}) {
  const { zeitraeume, loading, error, addZeitraum, updateZeitraum, deleteZeitraum } =
    useProduktkostenZeitraeume(produktId)

  const [formOpen, setFormOpen] = useState(false)
  const [editingZeitraum, setEditingZeitraum] = useState<ProduktkostenZeitraum | null>(null)
  const [deleteTargetId, setDeleteTargetId] = useState<string | null>(null)
  const [deleting, setDeleting] = useState(false)

  const handleNewClick = () => {
    setEditingZeitraum(null)
    setFormOpen(true)
  }

  const handleEditClick = (z: ProduktkostenZeitraum) => {
    setEditingZeitraum(z)
    setFormOpen(true)
  }

  const handleSave = async (data: ProduktkostenFormData) => {
    if (editingZeitraum) {
      await updateZeitraum(editingZeitraum.id, data)
    } else {
      await addZeitraum(produktId, data)
    }
  }

  const handleDeleteConfirm = async () => {
    if (!deleteTargetId) return
    setDeleting(true)
    try {
      await deleteZeitraum(deleteTargetId)
    } finally {
      setDeleting(false)
      setDeleteTargetId(null)
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Button
          size="sm"
          onClick={handleNewClick}
          disabled={kostenkategorien.length === 0}
        >
          + Neuer Zeitraum
        </Button>
      </div>

      {error && (
        <div className="rounded-lg border border-destructive bg-destructive/10 p-4 text-sm text-destructive">
          {error}
        </div>
      )}

      <ProduktkostenTable
        zeitraeume={zeitraeume}
        kostenkategorien={kostenkategorien}
        loading={loading}
        onEdit={handleEditClick}
        onDelete={id => setDeleteTargetId(id)}
      />

      <ProduktkostenFormDialog
        open={formOpen}
        onOpenChange={setFormOpen}
        zeitraumToEdit={editingZeitraum}
        produktId={produktId}
        kostenkategorien={kostenkategorien}
        onSave={handleSave}
      />

      <AlertDialog
        open={deleteTargetId !== null}
        onOpenChange={open => { if (!open) setDeleteTargetId(null) }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Kostenzeitraum löschen?</AlertDialogTitle>
            <AlertDialogDescription>
              Dieser Zeitraum und alle zugehörigen Kostenwerte werden dauerhaft gelöscht.
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

export default function ProduktkostenPage() {
  const { categories: produkte, loading: produkteLoading } = useKpiCategories('produkte')
  const { categories: ausgabenKategorien, loading: ausgabenLoading } = useKpiCategories('ausgaben_kosten')

  const loading = produkteLoading || ausgabenLoading

  const kostenkategorien = useMemo(() => {
    const produktParent = ausgabenKategorien.find(
      c => c.level === 1 && c.name.toLowerCase() === 'produkt'
    )
    if (!produktParent) return []
    return ausgabenKategorien
      .filter(c => c.level === 2 && c.parent_id === produktParent.id && c.name !== 'Wertverlust Ware')
      .sort((a, b) => a.sort_order - b.sort_order)
  }, [ausgabenKategorien])

  const sortedProdukte = useMemo(
    () => [...produkte].sort((a, b) => a.sort_order - b.sort_order),
    [produkte]
  )

  const noProdukte = !loading && sortedProdukte.length === 0
  const noKostenkategorien = !loading && sortedProdukte.length > 0 && kostenkategorien.length === 0

  return (
    <div className="flex min-h-screen flex-col">
      <header className="border-b bg-background px-6 py-4">
        <div className="flex items-center gap-2">
          <NavSheet />
          <h1 className="text-lg font-semibold">Produktkosten</h1>
        </div>
      </header>

      <main className="flex-1 p-6">
        <div className="w-full space-y-6">

          {loading && (
            <div className="py-8 text-center text-sm text-muted-foreground">Laden…</div>
          )}

          {noProdukte && (
            <div className="rounded-lg border bg-muted/30 p-8 text-center space-y-3">
              <p className="font-medium">Keine Produkte definiert</p>
              <p className="text-sm text-muted-foreground">
                Bitte zuerst Produkte im KPI-Modell anlegen, bevor Produktkosten gepflegt werden können.
              </p>
              <a href="/dashboard/kpi-modell">
                <Button variant="outline" size="sm" className="mt-2">
                  Zum KPI-Modell
                </Button>
              </a>
            </div>
          )}

          {noKostenkategorien && (
            <div className="rounded-lg border bg-muted/30 p-8 text-center space-y-3">
              <p className="font-medium">Keine Produktkosten-Kategorien definiert</p>
              <p className="text-sm text-muted-foreground">
                Bitte im KPI-Modell unter „Ausgaben & Kosten" eine Kategorie mit dem Namen „Produkt"
                und entsprechende Unterkategorien anlegen.
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
                  <ProduktTab produktId={p.id} kostenkategorien={kostenkategorien} />
                </TabsContent>
              ))}
            </Tabs>
          )}

        </div>
      </main>
    </div>
  )
}
