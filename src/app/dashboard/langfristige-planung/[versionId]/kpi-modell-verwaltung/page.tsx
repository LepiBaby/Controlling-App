'use client'

import { useState } from 'react'
import { useParams } from 'next/navigation'
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
import { LangfristigeVersionShell } from '@/components/langfristige-version-shell'
import {
  useLangfristigeKpiKategorien,
  type LangfristigeArt,
} from '@/hooks/use-langfristige-kpi-kategorien'
import type { KpiCategory } from '@/hooks/use-kpi-categories'

const TABS: { art: LangfristigeArt; label: string; maxLevel: 1 | 2 }[] = [
  { art: 'lp_sales_plattform', label: 'Sales Plattform', maxLevel: 1 },
  { art: 'lp_produkt', label: 'Produkte', maxLevel: 1 },
  { art: 'lp_marketingkanal', label: 'Marketingkanäle', maxLevel: 1 },
  { art: 'lp_investition', label: 'Investitionen', maxLevel: 2 },
]

const ADD_PLACEHOLDER: Record<LangfristigeArt, string> = {
  lp_sales_plattform: 'Neue Sales Plattform hinzufügen...',
  lp_produkt: 'Neues Produkt hinzufügen...',
  lp_marketingkanal: 'Neuen Marketingkanal hinzufügen...',
  lp_investition: 'Neue Gruppe hinzufügen...',
}

function KategorieTab({
  versionId,
  art,
  maxLevel,
}: {
  versionId: string
  art: LangfristigeArt
  maxLevel: 1 | 2
}) {
  const {
    tree, categories, loading, error,
    addCategory, renameCategory, deleteCategory, moveCategory,
    reorderCategory, reparentCategory, getDescendantCount,
  } = useLangfristigeKpiKategorien(versionId, art)
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
        addPlaceholder={ADD_PLACEHOLDER[art]}
        onRename={renameCategory}
        onDelete={setPendingDelete}
        onAddCategory={(name) => addCategory(name, null, 1)}
        onAddChild={(name, parentId, level) => addCategory(name, parentId, level)}
        onMoveUp={(id) => moveCategory(id, 'up')}
        onMoveDown={(id) => moveCategory(id, 'down')}
        onReorder={reorderCategory}
        onReparent={reparentCategory}
        // Bewusst NICHT verdrahtet: SKU, USt, Dimensionen, Anzeigebezeichnungen,
        // Rentabilitäts-Ausschluss — diese Funktionen entfallen in der Langfristigen Planung.
      />

      <AlertDialog open={!!pendingDelete} onOpenChange={open => { if (!open) setPendingDelete(null) }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Eintrag löschen?</AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-2">
                <p>
                  <span className="font-medium text-foreground">„{pendingDelete?.name}"</span> wird unwiderruflich gelöscht.
                </p>
                {descendantCount > 0 && (
                  <p className="text-amber-600 dark:text-amber-400">
                    ⚠ Dieser Eintrag enthält {descendantCount} Untergruppe{descendantCount !== 1 ? 'n' : ''}, die ebenfalls gelöscht werden.
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

export default function LangfristigeKpiModellPage() {
  const params = useParams()
  const versionId = typeof params.versionId === 'string' ? params.versionId : ''

  return (
    <LangfristigeVersionShell seitenTitel="KPI-Modell Verwaltung">
      <div className="mx-auto max-w-4xl">
        <Tabs defaultValue={TABS[0].art}>
          <TabsList className="grid w-full grid-cols-4">
            {TABS.map(t => (
              <TabsTrigger key={t.art} value={t.art} className="text-xs">{t.label}</TabsTrigger>
            ))}
          </TabsList>
          {TABS.map(t => (
            <TabsContent key={t.art} value={t.art} className="mt-4">
              <KategorieTab versionId={versionId} art={t.art} maxLevel={t.maxLevel} />
            </TabsContent>
          ))}
        </Tabs>
      </div>
    </LangfristigeVersionShell>
  )
}
