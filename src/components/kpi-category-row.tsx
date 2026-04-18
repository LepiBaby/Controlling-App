'use client'

import { createContext, useContext, useState, useRef, useEffect } from 'react'
import { useDraggable, useDroppable } from '@dnd-kit/core'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Checkbox } from '@/components/ui/checkbox'
import { Label } from '@/components/ui/label'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { KpiAddCategoryForm } from '@/components/kpi-add-category-form'
import {
  ChevronRight, ChevronDown, Plus, Pencil, Trash2,
  ArrowUp, ArrowDown, Check, X, GripVertical, SlidersHorizontal,
} from 'lucide-react'
import type { KpiCategory } from '@/hooks/use-kpi-categories'
import { cn } from '@/lib/utils'

// ─── DnD State Context ───────────────────────────────────────────────────────

export interface DropIntent {
  overId: string
  action: 'before' | 'after' | 'reparent'
  valid: boolean
}

export interface DragStateContextValue {
  activeId: string | null
  dropIntent: DropIntent | null
}

export const DragStateContext = createContext<DragStateContextValue>({
  activeId: null,
  dropIntent: null,
})

export function useDragState() {
  return useContext(DragStateContext)
}

// ─── Category Row ─────────────────────────────────────────────────────────────

interface KpiCategoryRowProps {
  category: KpiCategory
  isFirst: boolean
  isLast: boolean
  maxLevel?: 1 | 3
  onRename: (id: string, name: string) => Promise<void>
  onDelete: (category: KpiCategory) => void
  onAddChild: (name: string, parentId: string, level: 1 | 2 | 3) => Promise<void>
  onMoveUp: (id: string) => void
  onMoveDown: (id: string) => void
  onUpdateDimensions?: (id: string, patch: { sales_plattform_enabled?: boolean; produkt_enabled?: boolean }) => Promise<void>
}

const INDENT: Record<number, string> = { 1: 'pl-0', 2: 'pl-6', 3: 'pl-12' }

export function KpiCategoryRow({
  category,
  isFirst,
  isLast,
  maxLevel = 3,
  onRename,
  onDelete,
  onAddChild,
  onMoveUp,
  onMoveDown,
  onUpdateDimensions,
}: KpiCategoryRowProps) {
  const [expanded, setExpanded] = useState(true)
  const [editing, setEditing] = useState(false)
  const [editName, setEditName] = useState(category.name)
  const [showAddChild, setShowAddChild] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  const { activeId, dropIntent } = useDragState()
  const isDraggingThis = activeId === category.id

  const { attributes, listeners, setNodeRef: setDragRef, isDragging } = useDraggable({
    id: category.id,
    data: { id: category.id, parentId: category.parent_id, level: category.level },
  })

  const { setNodeRef: setDropRef, isOver } = useDroppable({
    id: category.id,
    data: { id: category.id, parentId: category.parent_id, level: category.level },
  })

  useEffect(() => {
    if (editing) inputRef.current?.focus()
  }, [editing])

  function startEdit() {
    setEditName(category.name)
    setEditing(true)
  }

  async function saveEdit() {
    const trimmed = editName.trim()
    if (!trimmed || trimmed === category.name) { setEditing(false); return }
    await onRename(category.id, trimmed)
    setEditing(false)
  }

  function cancelEdit() {
    setEditName(category.name)
    setEditing(false)
  }

  const hasChildren = (category.children?.length ?? 0) > 0
  const canAddChild = category.level < 3 && maxLevel > 1
  const showDimensionen = category.level === 1 && maxLevel === 3 && !!onUpdateDimensions
  const hasActiveDimension = category.sales_plattform_enabled || category.produkt_enabled

  // Drop indicator for this row
  const myIntent = dropIntent?.overId === category.id ? dropIntent : null
  const showBeforeLine = myIntent?.action === 'before'
  const showAfterLine = myIntent?.action === 'after'
  const showReparentRing = myIntent?.action === 'reparent' && myIntent.valid
  const showInvalidRing = myIntent?.action === 'reparent' && !myIntent.valid

  return (
    <div className={cn('group', INDENT[category.level])}>
      {/* Insert-before indicator */}
      {showBeforeLine && (
        <div className="h-0.5 bg-primary rounded mx-1 -mt-px mb-px" />
      )}

      <div
        ref={setDropRef}
        className={cn(
          'flex items-center gap-1 rounded-md px-1 py-1 hover:bg-muted/50 transition-colors',
          isDragging && 'opacity-40',
          showReparentRing && 'ring-2 ring-primary bg-primary/5',
          showInvalidRing && 'ring-2 ring-destructive/50 bg-destructive/5',
        )}
      >
        {/* Drag handle */}
        <div
          ref={setDragRef}
          {...attributes}
          {...listeners}
          className="w-5 h-5 flex items-center justify-center text-muted-foreground/40 hover:text-muted-foreground cursor-grab active:cursor-grabbing shrink-0 opacity-0 group-hover:opacity-100 transition-opacity"
          title="Ziehen zum Verschieben"
        >
          <GripVertical className="h-3.5 w-3.5" />
        </div>

        {/* Expand/collapse */}
        <button
          onClick={() => setExpanded(v => !v)}
          className="w-5 h-5 flex items-center justify-center text-muted-foreground shrink-0"
          aria-label={expanded ? 'Einklappen' : 'Ausklappen'}
        >
          {hasChildren
            ? (expanded ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />)
            : <span className="w-3.5" />
          }
        </button>

        {/* Name / inline edit */}
        {editing ? (
          <div className="flex items-center gap-1 flex-1 min-w-0">
            <Input
              ref={inputRef}
              value={editName}
              onChange={e => setEditName(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') saveEdit(); if (e.key === 'Escape') cancelEdit() }}
              className="h-6 text-sm py-0 px-2"
            />
            <Button variant="ghost" size="icon" className="h-6 w-6" onClick={saveEdit}>
              <Check className="h-3.5 w-3.5 text-green-600" />
            </Button>
            <Button variant="ghost" size="icon" className="h-6 w-6" onClick={cancelEdit}>
              <X className="h-3.5 w-3.5" />
            </Button>
          </div>
        ) : (
          <span
            className="flex-1 text-sm cursor-pointer min-w-0 truncate"
            onClick={startEdit}
            title={`${category.name} (klicken zum Umbenennen)`}
          >
            {category.name}
          </span>
        )}

        {/* Action buttons — visible on hover */}
        {!editing && (
          <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
            <Button variant="ghost" size="icon" className="h-6 w-6" onClick={startEdit} title="Umbenennen">
              <Pencil className="h-3 w-3" />
            </Button>
            {canAddChild && (
              <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => setShowAddChild(v => !v)} title="Unterkategorie hinzufügen">
                <Plus className="h-3 w-3" />
              </Button>
            )}
            <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => onMoveUp(category.id)} disabled={isFirst} title="Nach oben">
              <ArrowUp className="h-3 w-3" />
            </Button>
            <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => onMoveDown(category.id)} disabled={isLast} title="Nach unten">
              <ArrowDown className="h-3 w-3" />
            </Button>
            {showDimensionen && (
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="ghost" size="icon"
                    className={cn('h-6 w-6', hasActiveDimension && 'text-primary')}
                    title="Dimensionen konfigurieren"
                  >
                    <SlidersHorizontal className="h-3 w-3" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-48 p-3" align="end">
                  <p className="text-xs font-medium text-muted-foreground mb-2">Dimensionen</p>
                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <Checkbox
                        id={`sp-${category.id}`}
                        checked={category.sales_plattform_enabled}
                        onCheckedChange={(checked) =>
                          onUpdateDimensions!(category.id, { sales_plattform_enabled: checked === true })
                        }
                      />
                      <Label htmlFor={`sp-${category.id}`} className="text-sm font-normal cursor-pointer">
                        Sales Plattform
                      </Label>
                    </div>
                    <div className="flex items-center gap-2">
                      <Checkbox
                        id={`pr-${category.id}`}
                        checked={category.produkt_enabled}
                        onCheckedChange={(checked) =>
                          onUpdateDimensions!(category.id, { produkt_enabled: checked === true })
                        }
                      />
                      <Label htmlFor={`pr-${category.id}`} className="text-sm font-normal cursor-pointer">
                        Produkt
                      </Label>
                    </div>
                  </div>
                </PopoverContent>
              </Popover>
            )}
            <Button
              variant="ghost" size="icon"
              className="h-6 w-6 text-destructive hover:text-destructive"
              onClick={() => onDelete(category)}
              title="Löschen"
            >
              <Trash2 className="h-3 w-3" />
            </Button>
          </div>
        )}
      </div>

      {/* Insert-after indicator */}
      {showAfterLine && (
        <div className="h-0.5 bg-primary rounded mx-1 mt-px" />
      )}

      {/* Inline add-child form */}
      {showAddChild && canAddChild && (
        <div className={cn('mt-1 mb-1', INDENT[(category.level + 1) as 2 | 3])}>
          <KpiAddCategoryForm
            placeholder={`Neue ${category.level === 1 ? 'Unterkategorie' : 'Unter-Unterkategorie'}...`}
            onAdd={async (name) => {
              await onAddChild(name, category.id, (category.level + 1) as 2 | 3)
              setShowAddChild(false)
              setExpanded(true)
            }}
          />
        </div>
      )}

      {/* Children */}
      {expanded && hasChildren && (
        <div>
          {category.children!.map((child, i) => (
            <KpiCategoryRow
              key={child.id}
              category={child}
              isFirst={i === 0}
              isLast={i === category.children!.length - 1}
              maxLevel={maxLevel}
              onRename={onRename}
              onDelete={onDelete}
              onAddChild={onAddChild}
              onMoveUp={onMoveUp}
              onMoveDown={onMoveDown}
              onUpdateDimensions={onUpdateDimensions}
            />
          ))}
        </div>
      )}
    </div>
  )
}
