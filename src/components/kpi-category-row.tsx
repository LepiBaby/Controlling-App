'use client'

import { useState, useRef, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { KpiAddCategoryForm } from '@/components/kpi-add-category-form'
import { ChevronRight, ChevronDown, Plus, Pencil, Trash2, ArrowUp, ArrowDown, Check, X } from 'lucide-react'
import type { KpiCategory } from '@/hooks/use-kpi-categories'
import { cn } from '@/lib/utils'

interface KpiCategoryRowProps {
  category: KpiCategory
  isFirst: boolean
  isLast: boolean
  onRename: (id: string, name: string) => Promise<void>
  onDelete: (category: KpiCategory) => void
  onAddChild: (name: string, parentId: string, level: 1 | 2 | 3) => Promise<void>
  onMoveUp: (id: string) => void
  onMoveDown: (id: string) => void
}

const INDENT: Record<number, string> = { 1: 'pl-0', 2: 'pl-6', 3: 'pl-12' }

export function KpiCategoryRow({
  category,
  isFirst,
  isLast,
  onRename,
  onDelete,
  onAddChild,
  onMoveUp,
  onMoveDown,
}: KpiCategoryRowProps) {
  const [expanded, setExpanded] = useState(true)
  const [editing, setEditing] = useState(false)
  const [editName, setEditName] = useState(category.name)
  const [showAddChild, setShowAddChild] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

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
  const canAddChild = category.level < 3

  return (
    <div className={cn('group', INDENT[category.level])}>
      <div className="flex items-center gap-1 rounded-md px-1 py-1 hover:bg-muted/50">
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
            <Button variant="ghost" size="icon" className="h-6 w-6" onClick={saveEdit}><Check className="h-3.5 w-3.5 text-green-600" /></Button>
            <Button variant="ghost" size="icon" className="h-6 w-6" onClick={cancelEdit}><X className="h-3.5 w-3.5" /></Button>
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
            <Button variant="ghost" size="icon" className="h-6 w-6 text-destructive hover:text-destructive" onClick={() => onDelete(category)} title="Löschen">
              <Trash2 className="h-3 w-3" />
            </Button>
          </div>
        )}
      </div>

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
              onRename={onRename}
              onDelete={onDelete}
              onAddChild={onAddChild}
              onMoveUp={onMoveUp}
              onMoveDown={onMoveDown}
            />
          ))}
        </div>
      )}
    </div>
  )
}
