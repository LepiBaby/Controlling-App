'use client'

import { useState } from 'react'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
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
import { KpiCategoryTree } from '@/components/kpi-category-tree'
import { ReportModellTab } from '@/components/report-modell-tab'
import { useKpiCategories, type CategoryType, type KpiCategory } from '@/hooks/use-kpi-categories'
import { NavSheet } from '@/components/nav-sheet'

const TABS: { value: CategoryType; label: string; maxLevel?: 1 | 2 | 3 }[] = [
  { value: 'umsatz', label: 'Umsatz' },
  { value: 'einnahmen', label: 'Einnahmen' },
  { value: 'ausgaben_kosten', label: 'Ausgaben & Kosten' },
  { value: 'sales_plattformen', label: 'Sales Plattformen', maxLevel: 1 },
  { value: 'produkte', label: 'Produkte', maxLevel: 2 },
]

function CategoryTab({ type, maxLevel = 3 }: { type: CategoryType; maxLevel?: 1 | 2 | 3 }) {
  const {
    tree, categories, loading, error,
    addCategory, renameCategory, updateSku, deleteCategory, moveCategory,
    reorderCategory, reparentCategory, updateDimensions, updateLabels, updateAbzugsposten, updateUstSatz,
    updateExcludeFromRentabilitaet,
    getDescendantCount,
  } = useKpiCategories(type)
  const [pendingDelete, setPendingDelete] = useState<KpiCategory | null>(null)
  const [deleteError, setDeleteError] = useState<string | null>(null)
  const [deleting, setDeleting] = useState(false)

  const descendantCount = pendingDelete ? getDescendantCount(pendingDelete.id) : 0

  async function confirmDelete() {
    if (!pendingDelete) return
    setDeleting(true)
    setDeleteError(null)
    try {
      await deleteCategory(pendingDelete.id)
      setPendingDelete(null)
    } catch (e) {
      // Dialog offen lassen und Grund anzeigen (z.B. noch verknüpfte Sendungen).
      setDeleteError(e instanceof Error ? e.message : 'Löschen fehlgeschlagen.')
    } finally {
      setDeleting(false)
    }
  }

  return (
    <>
      <KpiCategoryTree
        tree={tree}
        categories={categories}
        loading={loading}
        error={error}
        maxLevel={maxLevel}
        onRename={renameCategory}
        onUpdateSku={type === 'produkte' ? updateSku : undefined}
        onDelete={setPendingDelete}
        onAddCategory={(name) => addCategory(name, null, 1)}
        onAddChild={(name, parentId, level, skuCode) => addCategory(name, parentId, level, skuCode)}
        onMoveUp={(id) => moveCategory(id, 'up')}
        onMoveDown={(id) => moveCategory(id, 'down')}
        onReorder={reorderCategory}
        onReparent={reparentCategory}
        onUpdateDimensions={maxLevel === 3 ? updateDimensions : undefined}
        onUpdateLabels={type === 'ausgaben_kosten' ? updateLabels : undefined}
        onUpdateAbzugsposten={type === 'umsatz' ? updateAbzugsposten : undefined}
        onUpdateUstSatz={type === 'produkte' ? updateUstSatz : undefined}
        onUpdateExcludeFromRentabilitaet={type === 'ausgaben_kosten' ? updateExcludeFromRentabilitaet : undefined}
      />

      <AlertDialog open={!!pendingDelete} onOpenChange={open => { if (!open) { setPendingDelete(null); setDeleteError(null) } }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Kategorie löschen?</AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-2">
                <p>
                  <span className="font-medium text-foreground">„{pendingDelete?.name}"</span> wird unwiderruflich gelöscht.
                </p>
                {descendantCount > 0 && (
                  <p className="text-amber-600 dark:text-amber-400">
                    ⚠ Diese Kategorie enthält {descendantCount} Unterkategorie{descendantCount !== 1 ? 'n' : ''}, die ebenfalls gelöscht werden.
                  </p>
                )}
                {deleteError && (
                  <p className="text-destructive">{deleteError}</p>
                )}
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Abbrechen</AlertDialogCancel>
            <AlertDialogAction
              onClick={e => { e.preventDefault(); confirmDelete() }}
              disabled={deleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleting ? 'Löschen…' : 'Löschen'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}

export default function KpiModellPage() {
  return (
    <div className="flex min-h-screen flex-col">
      <header className="border-b bg-background px-6 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <NavSheet />
            <h1 className="text-lg font-semibold">KPI-Modell Verwaltung</h1>
          </div>
        </div>
      </header>

      <main className="flex-1 p-6">
        <div className="mx-auto max-w-4xl">
          <Tabs defaultValue="umsatz">
            <TabsList className="grid w-full grid-cols-6">
              {TABS.map(t => (
                <TabsTrigger key={t.value} value={t.value} className="text-xs">{t.label}</TabsTrigger>
              ))}
              <TabsTrigger value="reporting" className="text-xs">Reporting-Modell</TabsTrigger>
            </TabsList>
            {TABS.map(t => (
              <TabsContent key={t.value} value={t.value} className="mt-4">
                <CategoryTab type={t.value} maxLevel={t.maxLevel} />
              </TabsContent>
            ))}
            <TabsContent value="reporting" className="mt-4">
              <ReportModellTab />
            </TabsContent>
          </Tabs>
        </div>
      </main>
    </div>
  )
}
