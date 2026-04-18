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
import { useKpiCategories, type CategoryType, type KpiCategory } from '@/hooks/use-kpi-categories'

const TABS: { value: CategoryType; label: string; maxLevel?: 1 | 3 }[] = [
  { value: 'umsatz', label: 'Umsatz' },
  { value: 'einnahmen', label: 'Einnahmen' },
  { value: 'ausgaben_kosten', label: 'Ausgaben & Kosten' },
  { value: 'sales_plattformen', label: 'Sales Plattformen', maxLevel: 1 },
  { value: 'produkte', label: 'Produkte', maxLevel: 1 },
]

function CategoryTab({ type, maxLevel = 3 }: { type: CategoryType; maxLevel?: 1 | 3 }) {
  const {
    tree, categories, loading, error,
    addCategory, renameCategory, deleteCategory, moveCategory,
    reorderCategory, reparentCategory, updateDimensions, getDescendantCount,
  } = useKpiCategories(type)
  const [pendingDelete, setPendingDelete] = useState<KpiCategory | null>(null)

  const descendantCount = pendingDelete ? getDescendantCount(pendingDelete.id) : 0

  async function confirmDelete() {
    if (!pendingDelete) return
    await deleteCategory(pendingDelete.id)
    setPendingDelete(null)
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
        onDelete={setPendingDelete}
        onAddCategory={(name) => addCategory(name, null, 1)}
        onAddChild={(name, parentId, level) => addCategory(name, parentId, level)}
        onMoveUp={(id) => moveCategory(id, 'up')}
        onMoveDown={(id) => moveCategory(id, 'down')}
        onReorder={reorderCategory}
        onReparent={reparentCategory}
        onUpdateDimensions={maxLevel === 3 ? updateDimensions : undefined}
      />

      <AlertDialog open={!!pendingDelete} onOpenChange={open => { if (!open) setPendingDelete(null) }}>
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
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Abbrechen</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Löschen
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
          <div>
            <h1 className="text-lg font-semibold">KPI-Modell Verwaltung</h1>
            <p className="text-sm text-muted-foreground">Kategorie-Hierarchien für alle Eingabetabellen</p>
          </div>
          <a href="/dashboard" className="text-sm text-muted-foreground hover:text-foreground">
            ← Dashboard
          </a>
        </div>
      </header>

      <main className="flex-1 p-6">
        <div className="mx-auto max-w-2xl">
          <Tabs defaultValue="umsatz">
            <TabsList className="grid w-full grid-cols-5">
              {TABS.map(t => (
                <TabsTrigger key={t.value} value={t.value} className="text-xs">{t.label}</TabsTrigger>
              ))}
            </TabsList>
            {TABS.map(t => (
              <TabsContent key={t.value} value={t.value} className="mt-4">
                <CategoryTab type={t.value} maxLevel={t.maxLevel} />
              </TabsContent>
            ))}
          </Tabs>
        </div>
      </main>
    </div>
  )
}
