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
} from '@dnd-kit/core'
import { KpiCategoryRow, DragStateContext, type DropIntent } from '@/components/kpi-category-row'
import { KpiAddCategoryForm } from '@/components/kpi-add-category-form'
import { Skeleton } from '@/components/ui/skeleton'
import { FolderTree, GripVertical } from 'lucide-react'
import type { KpiCategory } from '@/hooks/use-kpi-categories'
import { getSubtreeDepth, isDescendantOf } from '@/hooks/use-kpi-categories'

interface KpiCategoryTreeProps {
  tree: KpiCategory[]
  categories: KpiCategory[]
  loading: boolean
  error: string | null
  onRename: (id: string, name: string) => Promise<void>
  onDelete: (category: KpiCategory) => void
  onAddCategory: (name: string) => Promise<void>
  onAddChild: (name: string, parentId: string, level: 1 | 2 | 3) => Promise<void>
  onMoveUp: (id: string) => void
  onMoveDown: (id: string) => void
  onReorder: (activeId: string, overId: string, position: 'before' | 'after') => Promise<void>
  onReparent: (activeId: string, newParentId: string, newLevel: 1 | 2 | 3) => Promise<void>
}

// Minimal drag preview shown in DragOverlay
function DragPreview({ name, level }: { name: string; level: number }) {
  return (
    <div className="flex items-center gap-2 rounded-md border bg-background px-2 py-1.5 shadow-lg opacity-90 text-sm w-56">
      <GripVertical className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
      <span className="truncate">{name}</span>
    </div>
  )
}

export function KpiCategoryTree({
  tree,
  categories,
  loading,
  error,
  onRename,
  onDelete,
  onAddCategory,
  onAddChild,
  onMoveUp,
  onMoveDown,
  onReorder,
  onReparent,
}: KpiCategoryTreeProps) {
  const [activeId, setActiveId] = useState<string | null>(null)
  const [dropIntent, setDropIntent] = useState<DropIntent | null>(null)

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } })
  )

  const activeCategory = activeId ? categories.find(c => c.id === activeId) : null

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

    const sameSiblings = overData.parentId === active.parent_id

    // Compute pointer Y position relative to the drop target rect
    const initialY = (activatorEvent as PointerEvent).clientY
    const currentY = initialY + delta.y
    const overRect = over.rect
    const relY = overRect.height > 0 ? (currentY - overRect.top) / overRect.height : 0.5

    if (sameSiblings) {
      // Sort within same parent
      const action = relY < 0.5 ? 'before' : 'after'
      setDropIntent({ overId, action, valid: true })
    } else {
      // Reparent: over item becomes the new parent
      const newLevel = (overData.level + 1) as 1 | 2 | 3
      const activeDepth = getSubtreeDepth(categories, activeId)
      const wouldExceedDepth = newLevel + activeDepth > 3
      const isOwnDescendant = isDescendantOf(categories, overId, activeId)
      const valid = !wouldExceedDepth && !isOwnDescendant && newLevel <= 3
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

    const overData = over.data.current as { parentId: string | null; level: number }
    const active = categories.find(c => c.id === activeId)
    if (!active) return

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
                  onRename={onRename}
                  onDelete={onDelete}
                  onAddChild={onAddChild}
                  onMoveUp={onMoveUp}
                  onMoveDown={onMoveDown}
                />
              ))}
            </div>
          )}

          <KpiAddCategoryForm
            placeholder="Neue Hauptkategorie hinzufügen..."
            onAdd={onAddCategory}
          />
        </div>
      </DragStateContext.Provider>

      <DragOverlay>
        {activeCategory ? (
          <DragPreview name={activeCategory.name} level={activeCategory.level} />
        ) : null}
      </DragOverlay>
    </DndContext>
  )
}
