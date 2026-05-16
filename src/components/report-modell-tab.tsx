'use client'

import { useState } from 'react'
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core'
import {
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
  arrayMove,
} from '@dnd-kit/sortable'
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
import { Skeleton } from '@/components/ui/skeleton'
import { BarChart2, Plus, Sigma, Percent } from 'lucide-react'
import { useReportPositionen, type ReportPosition } from '@/hooks/use-report-positionen'
import { useKpiCategories } from '@/hooks/use-kpi-categories'
import { ReportPositionRow } from '@/components/report-position-row'

export function ReportModellTab() {
  const {
    positions, loading, error,
    addPosition, updateName, updateSortOrders, setKategorien, setSummePositionen,
    deletePosition, updateInvestitionsbezogen, updateInDeckungsbeitragsreport, updateInBreakEvenReport,
  } = useReportPositionen()

  const { categories: umsatzCats } = useKpiCategories('umsatz')
  const { categories: ausgabenCats } = useKpiCategories('ausgaben_kosten')

  const availableKpiCategories = [
    ...umsatzCats.filter(c => c.level === 1).map(c => ({ id: c.id, name: c.name, displayName: c.name, type: 'umsatz' as const })),
    ...ausgabenCats.filter(c => c.level === 1).map(c => ({ id: c.id, name: c.name, displayName: c.kosten_label || c.name, type: 'ausgaben_kosten' as const })),
  ]

  const [pendingDelete, setPendingDelete] = useState<ReportPosition | null>(null)

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  )

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event
    if (!over || active.id === over.id) return
    const oldIndex = positions.findIndex(p => p.id === active.id)
    const newIndex = positions.findIndex(p => p.id === over.id)
    if (oldIndex === -1 || newIndex === -1) return
    updateSortOrders(arrayMove(positions, oldIndex, newIndex))
  }

  async function confirmDelete() {
    if (!pendingDelete) return
    await deletePosition(pendingDelete.id)
    setPendingDelete(null)
  }

  const hasDeleteAssignments = (pendingDelete?.kategorien.length ?? 0) + (pendingDelete?.summe_positionen.length ?? 0) > 0

  if (loading) {
    return (
      <div className="space-y-2 p-2">
        {[1, 2, 3].map(i => <Skeleton key={i} className="h-10 w-full" />)}
      </div>
    )
  }

  if (error) {
    return <p className="text-sm text-destructive p-2">{error}</p>
  }

  return (
    <>
      <div className="space-y-3">
        {/* Toolbar */}
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            className="gap-1.5"
            onClick={() => addPosition('position').catch(() => {})}
          >
            <Plus className="h-3.5 w-3.5" />
            Position hinzufügen
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="gap-1.5"
            onClick={() => addPosition('summe').catch(() => {})}
          >
            <Sigma className="h-3.5 w-3.5" />
            Summe hinzufügen
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="gap-1.5"
            onClick={() => addPosition('umsatzsteuer').catch(() => {})}
          >
            <Percent className="h-3.5 w-3.5" />
            Umsatzsteuer hinzufügen
          </Button>
        </div>

        {/* Empty state */}
        {positions.length === 0 ? (
          <div className="flex flex-col items-center gap-3 rounded-md border border-dashed py-12 text-center text-muted-foreground">
            <BarChart2 className="h-8 w-8" />
            <div>
              <p className="text-sm font-medium">Noch kein Reporting-Modell definiert</p>
              <p className="text-xs mt-1 max-w-xs mx-auto">
                Erstelle Positionen und weise ihnen KPI-Kategorien zu. Füge Summen-Positionen für Zwischensummen hinzu.
              </p>
            </div>
          </div>
        ) : (
          <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
            <SortableContext items={positions.map(p => p.id)} strategy={verticalListSortingStrategy}>
              <div className="space-y-1.5">
                {positions.map(p => (
                  <ReportPositionRow
                    key={p.id}
                    position={p}
                    availableKpiCategories={availableKpiCategories}
                    availablePositions={positions}
                    onUpdateName={updateName}
                    onSetKategorien={setKategorien}
                    onSetSummePositionen={setSummePositionen}
                    onDelete={setPendingDelete}
                    onUpdateInvestitionsbezogen={updateInvestitionsbezogen}
                    onUpdateInDeckungsbeitragsreport={updateInDeckungsbeitragsreport}
                    onUpdateInBreakEvenReport={updateInBreakEvenReport}
                  />
                ))}
              </div>
            </SortableContext>
          </DndContext>
        )}
      </div>

      <AlertDialog open={!!pendingDelete} onOpenChange={open => { if (!open) setPendingDelete(null) }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Position löschen?</AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div>
                <p>
                  <span className="font-medium text-foreground">„{pendingDelete?.name}"</span> wird unwiderruflich gelöscht.
                </p>
                {hasDeleteAssignments && (
                  <p className="mt-1 text-amber-600 dark:text-amber-400">
                    ⚠ Alle Zuweisungen werden ebenfalls entfernt.
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
