'use client'

import { useState, useRef, useEffect } from 'react'
import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Checkbox } from '@/components/ui/checkbox'
import { Separator } from '@/components/ui/separator'
import { GripVertical, Check, X, Pencil, Trash2, Link2, Tags, Percent } from 'lucide-react'
import type { ReportPosition } from '@/hooks/use-report-positionen'
import { cn } from '@/lib/utils'

export interface AvailableKpiCategory {
  id: string
  name: string
  displayName: string
  type: 'umsatz' | 'ausgaben_kosten'
}

interface ReportPositionRowProps {
  position: ReportPosition
  availableKpiCategories: AvailableKpiCategory[]
  availablePositions: ReportPosition[]
  onUpdateName: (id: string, name: string) => Promise<void>
  onSetKategorien: (id: string, ids: string[]) => Promise<void>
  onSetSummePositionen: (id: string, ids: string[]) => Promise<void>
  onDelete: (position: ReportPosition) => void
}

export function ReportPositionRow({
  position,
  availableKpiCategories,
  availablePositions,
  onUpdateName,
  onSetKategorien,
  onSetSummePositionen,
  onDelete,
}: ReportPositionRowProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: position.id })
  const style = { transform: CSS.Transform.toString(transform), transition }

  const [editing, setEditing] = useState(false)
  const [editName, setEditName] = useState(position.name)
  const inputRef = useRef<HTMLInputElement>(null)

  const [assignOpen, setAssignOpen] = useState(false)
  const [selectedKatIds, setSelectedKatIds] = useState<string[]>(() =>
    position.kategorien.map(k => k.kpi_category_id)
  )
  const [selectedSummeIds, setSelectedSummeIds] = useState<string[]>(() =>
    position.summe_positionen.map(s => s.referenced_position_id)
  )

  useEffect(() => {
    if (!assignOpen) {
      setSelectedKatIds(position.kategorien.map(k => k.kpi_category_id))
      setSelectedSummeIds(position.summe_positionen.map(s => s.referenced_position_id))
    }
  }, [position.kategorien, position.summe_positionen, assignOpen])

  useEffect(() => {
    if (editing) inputRef.current?.focus()
  }, [editing])

  function startEdit() {
    setEditName(position.name)
    setEditing(true)
  }

  async function saveEdit() {
    const trimmed = editName.trim()
    if (!trimmed || trimmed === position.name) { setEditing(false); return }
    await onUpdateName(position.id, trimmed)
    setEditing(false)
  }

  function cancelEdit() {
    setEditName(position.name)
    setEditing(false)
  }

  function handleAssignClose(open: boolean) {
    if (!open) {
      if (position.type === 'position') {
        const current = new Set(position.kategorien.map(k => k.kpi_category_id))
        const next = new Set(selectedKatIds)
        const same = current.size === next.size && [...current].every(id => next.has(id))
        if (!same) {
          onSetKategorien(position.id, selectedKatIds).catch(() => {})
          if (selectedKatIds.length > 0) {
            const cat = availableKpiCategories.find(k => k.id === selectedKatIds[0])
            if (cat) onUpdateName(position.id, cat.displayName).catch(() => {})
          }
        }
      } else {
        const current = new Set(position.summe_positionen.map(s => s.referenced_position_id))
        const next = new Set(selectedSummeIds)
        const same = current.size === next.size && [...current].every(id => next.has(id))
        if (!same) onSetSummePositionen(position.id, selectedSummeIds).catch(() => {})
      }
    }
    setAssignOpen(open)
  }

  const umsatzKats = availableKpiCategories.filter(k => k.type === 'umsatz')
  const ausgabenKats = availableKpiCategories.filter(k => k.type === 'ausgaben_kosten')
  const assignablePositions = availablePositions.filter(p => p.id !== position.id)

  const hasAssignments = position.type === 'position'
    ? position.kategorien.length > 0
    : position.type === 'summe'
      ? position.summe_positionen.length > 0
      : false

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(
        'group flex items-start gap-2 rounded-md border px-2 py-2',
        position.type === 'summe'
          ? 'bg-violet-50 border-violet-200 dark:bg-violet-950/30 dark:border-violet-800'
          : position.type === 'umsatzsteuer'
            ? 'bg-teal-50 border-teal-200 dark:bg-teal-950/30 dark:border-teal-800'
            : 'bg-card',
        isDragging && 'opacity-40 shadow-lg'
      )}
    >
      {/* Drag handle */}
      <div
        {...attributes}
        {...listeners}
        className="mt-1 flex h-5 w-5 shrink-0 cursor-grab items-center justify-center text-muted-foreground/40 hover:text-muted-foreground active:cursor-grabbing"
      >
        <GripVertical className="h-3.5 w-3.5" />
      </div>

      {/* Main content */}
      <div className="flex flex-1 flex-wrap items-center gap-1.5 min-w-0">
        {editing ? (
          <>
            <Input
              ref={inputRef}
              value={editName}
              onChange={e => setEditName(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') saveEdit(); if (e.key === 'Escape') cancelEdit() }}
              className="h-6 text-sm py-0 px-2 w-48"
            />
            <Button variant="ghost" size="icon" className="h-6 w-6" onClick={saveEdit}>
              <Check className="h-3.5 w-3.5 text-green-600" />
            </Button>
            <Button variant="ghost" size="icon" className="h-6 w-6" onClick={cancelEdit}>
              <X className="h-3.5 w-3.5" />
            </Button>
          </>
        ) : (
          <>
            <span
              className="cursor-pointer text-sm font-medium hover:underline"
              onClick={startEdit}
              title="Klicken zum Umbenennen"
            >
              {position.name}
            </span>
            <Badge
              variant="outline"
              className={cn(
                'text-xs h-4 px-1.5 shrink-0',
                position.type === 'summe' && 'bg-violet-100 border-violet-300 text-violet-700 dark:bg-violet-900/50 dark:border-violet-700 dark:text-violet-300',
                position.type === 'umsatzsteuer' && 'bg-teal-100 border-teal-300 text-teal-700 dark:bg-teal-900/50 dark:border-teal-700 dark:text-teal-300'
              )}
            >
              {position.type === 'summe' ? 'Σ Summe' : position.type === 'umsatzsteuer' ? '% USt' : 'Position'}
            </Badge>

            {/* Category chips */}
            {position.type === 'position' && position.kategorien.map(k => {
              const cat = availableKpiCategories.find(c => c.id === k.kpi_category_id)
              return (
                <Badge
                  key={k.id}
                  variant="outline"
                  className={cn(
                    'text-xs h-5 px-1.5',
                    k.kpi_category.type === 'umsatz'
                      ? 'bg-blue-50 border-blue-200 text-blue-700 dark:bg-blue-950 dark:border-blue-800 dark:text-blue-300'
                      : 'bg-orange-50 border-orange-200 text-orange-700 dark:bg-orange-950 dark:border-orange-800 dark:text-orange-300'
                  )}
                >
                  {cat?.displayName ?? k.kpi_category.name}
                </Badge>
              )
            })}

            {/* Summe reference chips */}
            {position.type === 'summe' && position.summe_positionen.map(s => (
              <Badge key={s.id} variant="outline" className="text-xs h-5 px-1.5 bg-muted/50">
                {s.referenced_position.name}
              </Badge>
            ))}
          </>
        )}
      </div>

      {/* Action buttons (always visible) */}
      {!editing && (
        <div className="flex items-center gap-0.5 shrink-0">
          {position.type === 'umsatzsteuer' ? (
            <div className="h-6 w-6 flex items-center justify-center text-teal-500" title="Berechnet automatisch aus Produkten">
              <Percent className="h-3 w-3" />
            </div>
          ) : (
          <Popover open={assignOpen} onOpenChange={handleAssignClose}>
            <PopoverTrigger asChild>
              <Button
                variant="ghost" size="icon"
                className={cn('h-6 w-6', hasAssignments && 'text-primary')}
                title={position.type === 'position' ? 'Kategorien zuweisen' : 'Quell-Positionen wählen'}
              >
                {position.type === 'position' ? <Tags className="h-3 w-3" /> : <Link2 className="h-3 w-3" />}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-64 p-3" align="end">
              {position.type === 'position' ? (
                <>
                  <p className="text-xs font-medium text-muted-foreground mb-2">Kategorien zuweisen</p>
                  <div className="max-h-60 overflow-y-auto space-y-0.5">
                    {umsatzKats.length > 0 && (
                      <>
                        <p className="text-xs text-muted-foreground/70 px-1 py-1">Umsatz</p>
                        {umsatzKats.map(k => (
                          <label key={k.id} className="flex cursor-pointer items-center gap-2 rounded px-1 py-1.5 hover:bg-accent">
                            <Checkbox
                              checked={selectedKatIds.includes(k.id)}
                              onCheckedChange={() => {
                                setSelectedKatIds(selectedKatIds.includes(k.id) ? [] : [k.id])
                              }}
                            />
                            <span className="text-sm leading-none">{k.displayName}</span>
                          </label>
                        ))}
                      </>
                    )}
                    {umsatzKats.length > 0 && ausgabenKats.length > 0 && <Separator className="my-1" />}
                    {ausgabenKats.length > 0 && (
                      <>
                        <p className="text-xs text-muted-foreground/70 px-1 py-1">Ausgaben &amp; Kosten</p>
                        {ausgabenKats.map(k => (
                          <label key={k.id} className="flex cursor-pointer items-center gap-2 rounded px-1 py-1.5 hover:bg-accent">
                            <Checkbox
                              checked={selectedKatIds.includes(k.id)}
                              onCheckedChange={() => {
                                setSelectedKatIds(selectedKatIds.includes(k.id) ? [] : [k.id])
                              }}
                            />
                            <span className="text-sm leading-none">{k.displayName}</span>
                          </label>
                        ))}
                      </>
                    )}
                    {umsatzKats.length === 0 && ausgabenKats.length === 0 && (
                      <p className="text-sm text-muted-foreground px-1 py-2">Keine Kategorien vorhanden.</p>
                    )}
                  </div>
                </>
              ) : (
                <>
                  <p className="text-xs font-medium text-muted-foreground mb-2">Quell-Positionen wählen</p>
                  <div className="max-h-60 overflow-y-auto space-y-0.5">
                    {assignablePositions.length === 0 ? (
                      <p className="text-sm text-muted-foreground px-1 py-2">Noch keine Positionen vorhanden.</p>
                    ) : (
                      assignablePositions.map(p => (
                        <label key={p.id} className="flex cursor-pointer items-center gap-2 rounded px-1 py-1.5 hover:bg-accent">
                          <Checkbox
                            checked={selectedSummeIds.includes(p.id)}
                            onCheckedChange={() => {
                              setSelectedSummeIds(prev =>
                                prev.includes(p.id) ? prev.filter(x => x !== p.id) : [...prev, p.id]
                              )
                            }}
                          />
                          <span className="text-sm leading-none">{p.name}</span>
                        </label>
                      ))
                    )}
                  </div>
                </>
              )}
            </PopoverContent>
          </Popover>
          )}

          <Button variant="ghost" size="icon" className="h-6 w-6" onClick={startEdit} title="Umbenennen">
            <Pencil className="h-3 w-3" />
          </Button>

          <Button
            variant="ghost" size="icon"
            className="h-6 w-6 text-destructive hover:text-destructive"
            onClick={() => onDelete(position)}
            title="Löschen"
          >
            <Trash2 className="h-3 w-3" />
          </Button>
        </div>
      )}
    </div>
  )
}
