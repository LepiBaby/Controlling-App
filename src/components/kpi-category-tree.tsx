'use client'

import { useState } from 'react'
import {
  DndContext,
  DragEndEvent,
  DragMoveEvent,
  DragOverlay,
  DragStartEvent,
  PointerSensor,
  useSensor,
  useSensors,
  useDroppable,
} from '@dnd-kit/core'
import { KpiCategoryRow, DragStateContext, type DropIntent } from '@/components/kpi-category-row'
import { KpiAddCategoryForm } from '@/components/kpi-add-category-form'
import { Skeleton } from '@/components/ui/skeleton'
import { FolderTree, GripVertical, ArrowUpToLine } from 'lucide-react'
import type { KpiCategory } from '@/hooks/use-kpi-categories'
import { getSubtreeDepth, isDescendantOf } from '@/hooks/use-kpi-categories'
import { cn } from '@/lib/utils'

const ROOT_DROP_ID = '__root__'

interface KpiCategoryTreeProps {
  tree: KpiCategory[]
  categories: KpiCategory[]
  loading: boolean
  error: string | null
  maxLevel?: 1 | 2 | 3
  onRename: (id: string, name: string) => Promise<void>
  onUpdateSku?: (id: string, name: string, skuCode: string) => Promise<void>
  onDelete: (category: KpiCategory) => void
  onAddCategory: (name: string) => Promise<void>
  onAddChild: (name: string, parentId: string, level: 1 | 2 | 3, skuCode?: string) => Promise<void>
  onMoveUp: (id: string) => void
  onMoveDown: (id: string) => void
  onReorder: (activeId: string, overId: string, position: 'before' | 'after') => Promise<void>
  onReparent: (activeId: string, newParentId: string | null, newLevel: 1 | 2 | 3) => Promise<void>
  onUpdateDimensions?: (id: string, patch: { sales_plattform_enabled?: boolean; produkt_enabled?: boolean }) => Promise<void>
  onUpdateLabels?: (id: string, patch: { kosten_label?: string | null; ausgaben_label?: string | null }) => Promise<void>
  onUpdateAbzugsposten?: (id: string, ist_abzugsposten: boolean) => Promise<void>
}

function DragPreview({ name }: { name: string }) {
  return (
    <div className="flex items-center gap-2 rounded-md border bg-background px-2 py-1.5 shadow-lg opacity-90 text-sm w-56">
      <GripVertical className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
      <span className="truncate">{name}</span>
    </div>
  )
}

// Drop zone shown during drag to promote a subcategory to root level
function RootDropZone({ isOver, isValid }: { isOver: boolean; isValid: boolean }) {
  const { setNodeRef } = useDroppable({
    id: ROOT_DROP_ID,
    data: { level: 0, parentId: null },
  })

  return (
    <div
      ref={setNodeRef}
      className={cn(
        'flex items-center justify-center gap-2 rounded-md border-2 border-dashed py-3 text-sm transition-colors',
        isOver && isValid && 'border-primary bg-primary/5 text-primary',
        isOver && !isValid && 'border-destructive/50 bg-destructive/5 text-destructive',
        !isOver && 'border-muted-foreground/30 text-muted-foreground/60',
      )}
    >
      <ArrowUpToLine className="h-4 w-4" />
      {isOver && !isValid
        ? 'Zu tief verschachtelt — nicht möglich'
        : 'Hier ablegen → zur Hauptkategorie machen'}
    </div>
  )
}

export function KpiCategoryTree({
  tree,
  categories,
  loading,
  error,
  maxLevel = 3,
  onRename,
  onUpdateSku,
  onDelete,
  onAddCategory,
  onAddChild,
  onMoveUp,
  onMoveDown,
  onReorder,
  onReparent,
  onUpdateDimensions,
  onUpdateLabels,
  onUpdateAbzugsposten,
}: KpiCategoryTreeProps) {
  const [activeId, setActiveId] = useState<string | null>(null)
  const [dropIntent, setDropIntent] = useState<DropIntent | null>(null)

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } })
  )

  const activeCategory = activeId ? categories.find(c => c.id === activeId) : null
  // Show root drop zone only in full 3-level tabs when dragging a non-root category
  const showRootDropZone = maxLevel === 3 && activeId !== null && activeCategory?.parent_id !== null

  const rootDropIntent = dropIntent?.overId === ROOT_DROP_ID ? dropIntent : null

  function handleDragStart(e: DragStartEvent) {
    setActiveId(String(e.active.id))
    setDropIntent(null)
  }

  function handleDragMove(e: DragMoveEvent) {
    const { over, delta, activatorEvent } = e
    if (!over || !activeId) { setDropIntent(null); return }

    const overId = String(over.id)
    if (overId === activeId) { setDropIntent(null); return }

    const overData = over.data.current as { parentId: string | null; level: number }
    const active = categories.find(c => c.id === activeId)
    if (!active) return

    // Root drop zone
    if (overId === ROOT_DROP_ID) {
      const activeDepth = getSubtreeDepth(categories, activeId)
      setDropIntent({ overId: ROOT_DROP_ID, action: 'reparent', valid: activeDepth <= 2 })
      return
    }

    // Compute pointer Y relative to drop target
    const initialY = (activatorEvent as PointerEvent).clientY
    const currentY = initialY + delta.y
    const overRect = over.rect
    const relY = overRect.height > 0 ? (currentY - overRect.top) / overRect.height : 0.5

    const sameSiblings = overData.parentId === active.parent_id

    if (sameSiblings && relY < 0.3) {
      setDropIntent({ overId, action: 'before', valid: true })
    } else if (sameSiblings && relY > 0.7) {
      setDropIntent({ overId, action: 'after', valid: true })
    } else if (maxLevel === 1) {
      // Flat tabs: no reparenting allowed — treat middle zone as sort-after
      setDropIntent({ overId, action: 'after', valid: true })
    } else {
      // Middle zone OR different parent → reparent into target
      const newLevel = (overData.level + 1) as 1 | 2 | 3
      const activeDepth = getSubtreeDepth(categories, activeId)
      const wouldExceedDepth = newLevel + activeDepth > maxLevel
      const isOwnDescendant = isDescendantOf(categories, overId, activeId)
      const valid = !wouldExceedDepth && !isOwnDescendant && newLevel <= maxLevel
      setDropIntent({ overId, action: 'reparent', valid })
    }
  }

  function handleDragEnd(e: DragEndEvent) {
    const { over } = e
    const intent = dropIntent

    setActiveId(null)
    setDropIntent(null)

    if (!over || !intent || !activeId) return
    const overId = String(over.id)
    if (overId === activeId) return

    const active = categories.find(c => c.id === activeId)
    if (!active) return

    // Root drop zone → promote to level 1
    if (overId === ROOT_DROP_ID && intent.valid) {
      onReparent(activeId, null, 1)
      return
    }

    const overData = over.data.current as { parentId: string | null; level: number }

    if (intent.action === 'reparent' && intent.valid) {
      const newLevel = (overData.level + 1) as 1 | 2 | 3
      onReparent(activeId, overId, newLevel)
    } else if ((intent.action === 'before' || intent.action === 'after') && intent.valid) {
      onReorder(activeId, overId, intent.action)
    }
  }

  if (loading) {
    return (
      <div className="space-y-2 p-2">
        {[1, 2, 3].map(i => <Skeleton key={i} className="h-7 w-full" />)}
      </div>
    )
  }

  if (error) {
    return <p className="text-sm text-destructive p-2">{error}</p>
  }

  return (
    <DndContext sensors={sensors} onDragStart={handleDragStart} onDragMove={handleDragMove} onDragEnd={handleDragEnd}>
      <DragStateContext.Provider value={{ activeId, dropIntent }}>
        <div className="space-y-3">
          {tree.length === 0 ? (
            <div className="flex flex-col items-center gap-2 py-10 text-muted-foreground">
              <FolderTree className="h-8 w-8" />
              <p className="text-sm">Noch keine Kategorien vorhanden.</p>
            </div>
          ) : (
            <div className="rounded-md border bg-card p-2">
              {tree.map((cat, i) => (
                <KpiCategoryRow
                  key={cat.id}
                  category={cat}
                  isFirst={i === 0}
                  isLast={i === tree.length - 1}
                  maxLevel={maxLevel}
                  onRename={onRename}
                  onUpdateSku={onUpdateSku}
                  onDelete={onDelete}
                  onAddChild={onAddChild}
                  onMoveUp={onMoveUp}
                  onMoveDown={onMoveDown}
                  onUpdateDimensions={onUpdateDimensions}
                  onUpdateLabels={onUpdateLabels}
                  onUpdateAbzugsposten={onUpdateAbzugsposten}
                />
              ))}
            </div>
          )}

          {showRootDropZone && (
            <RootDropZone
              isOver={rootDropIntent !== null}
              isValid={rootDropIntent?.valid ?? false}
            />
          )}

          <KpiAddCategoryForm
            placeholder="Neue Hauptkategorie hinzufügen..."
            onAdd={onAddCategory}
          />
        </div>
      </DragStateContext.Provider>

      <DragOverlay>
        {activeCategory ? <DragPreview name={activeCategory.name} /> : null}
      </DragOverlay>
    </DndContext>
  )
}
