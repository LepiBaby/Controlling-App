'use client'

import { useState, useEffect, useRef, useMemo } from 'react'
import { ChevronDown, ChevronRight, ChevronsDownUp, ChevronsUpDown, StickyNote } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import { useToast } from '@/hooks/use-toast'
import { useProduktinvestitionsplanung, kategorieWertKey } from '@/hooks/use-produktinvestitionsplanung'
import type { PlanungsWoche } from '@/hooks/use-produktinvestitionsplanung'
import { usePlanungNotizen } from '@/hooks/use-planung-notizen'
import { PlanungNotizFormular } from '@/components/planung-notiz-formular'

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatNum(v: number): string {
  return v.toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

function mondayOfISOWeek(year: number, week: number): Date {
  const jan4 = new Date(Date.UTC(year, 0, 4))
  const dayOfWeek = jan4.getUTCDay() || 7
  const mondayWeek1 = new Date(jan4.getTime() - (dayOfWeek - 1) * 86_400_000)
  return new Date(mondayWeek1.getTime() + (week - 1) * 7 * 86_400_000)
}

// ─── Row types ────────────────────────────────────────────────────────────────

type RowKind = 'total' | 'category-header' | 'leaf'

interface FlatRow {
  id: string
  kind: RowKind
  label: string
  indent: number
  kategorieId?: string
  childLeafIds?: string[]
  l1KategorieId?: string
  expandable?: boolean
  expanded?: boolean
}

// ─── Main component ───────────────────────────────────────────────────────────

export function ProduktinvestitionsPlanungTabelle() {
  const {
    wochen,
    lastWoche,
    kategorien,
    values,
    loading,
    error,
    isNewWeek,
    getWert,
    upsertZelle,
  } = useProduktinvestitionsplanung()

  const { toast } = useToast()
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(new Set())

  const allExpandableIds = useMemo(
    () => new Set(kategorien.filter(k => {
      const filteredIds = new Set(kategorien.map(c => c.id))
      return k.parent_id == null || !filteredIds.has(k.parent_id)
    }).filter(k => kategorien.some(c => c.parent_id === k.id)).map(k => k.id)),
    [kategorien],
  )
  const allExpanded = allExpandableIds.size > 0 && [...allExpandableIds].every(id => expandedCategories.has(id))
  function toggleAll() {
    setExpandedCategories(allExpanded ? new Set() : new Set(allExpandableIds))
  }

  const [selectedCells, setSelectedCells] = useState<Map<string, number>>(new Map())
  const isDragging = useRef(false)
  const selectionSum = Array.from(selectedCells.values()).reduce((a, b) => a + b, 0)

  // Notizen
  const { notizen, upsertNotiz, deleteNotiz } = usePlanungNotizen('produktinvestitions_planung')
  const [notizFormularOpen, setNotizFormularOpen] = useState(false)
  const notizCellKeyRef = useRef<string>('')
  const notizCellLabelRef = useRef<string>('')

  const [editingCell, setEditingCellState] = useState<string | null>(null)
  const editingCellRef = useRef<string | null>(null)
  const [editingValue, setEditingValue] = useState('')
  const editingOriginalValue = useRef<string>('')

  function setEditingCell(key: string | null) {
    editingCellRef.current = key
    setEditingCellState(key)
  }

  // Expand all L1 categories that have children on first load
  useEffect(() => {
    if (!loading && kategorien.length > 0) {
      const l1WithChildren = new Set(
        kategorien.filter(k => k.level === 2 && k.parent_id).map(k => k.parent_id!),
      )
      const ids = kategorien.filter(k => k.level === 1 && l1WithChildren.has(k.id)).map(k => k.id)
      setExpandedCategories(new Set(ids))
    }
  }, [loading, kategorien])

  useEffect(() => {
    function onMouseDown(e: MouseEvent) {
      const target = e.target as Element
      if (target.closest('[data-betrag-selektion]')) return
      setSelectedCells(new Map())
    }
    function onMouseUp() { isDragging.current = false }
    document.addEventListener('mousedown', onMouseDown)
    document.addEventListener('mouseup', onMouseUp)
    return () => {
      document.removeEventListener('mousedown', onMouseDown)
      document.removeEventListener('mouseup', onMouseUp)
    }
  }, [])

  // ─── Month groups ─────────────────────────────────────────────────────────────

  const monthGroups = useMemo(() => {
    const groups: { label: string; count: number }[] = []
    for (const kw of wochen) {
      const monday = mondayOfISOWeek(kw.year, kw.week)
      const label = monday.toLocaleString('de-DE', { month: 'long', year: 'numeric' })
      if (groups.length === 0 || groups[groups.length - 1].label !== label) {
        groups.push({ label, count: 1 })
      } else {
        groups[groups.length - 1].count++
      }
    }
    return groups
  }, [wochen])

  // ─── Category helpers ─────────────────────────────────────────────────────────

  const l1Kategorien = useMemo(() => {
    const filteredIds = new Set(kategorien.map(k => k.id))
    return kategorien
      .filter(k => k.parent_id == null || !filteredIds.has(k.parent_id))
      .sort((a, b) => a.sort_order - b.sort_order)
  }, [kategorien])

  const childrenByParent = useMemo(() => {
    const filteredIds = new Set(kategorien.map(k => k.id))
    const l1Ids = new Set(
      kategorien
        .filter(k => k.parent_id == null || !filteredIds.has(k.parent_id))
        .map(k => k.id),
    )
    const map = new Map<string, typeof kategorien>()
    for (const k of kategorien) {
      if (!k.parent_id || !l1Ids.has(k.parent_id)) continue
      if (!map.has(k.parent_id)) map.set(k.parent_id, [])
      map.get(k.parent_id)!.push(k)
    }
    for (const [, children] of map) children.sort((a, b) => a.sort_order - b.sort_order)
    return map
  }, [kategorien])

  const allLeafIds = useMemo(() => {
    const l1WithChildren = new Set(
      kategorien.filter(k => {
        const filteredIds = new Set(kategorien.map(c => c.id))
        return k.parent_id != null && filteredIds.has(k.parent_id)
      }).map(k => k.parent_id!),
    )
    const l1Ids = new Set(l1Kategorien.map(k => k.id))
    return kategorien
      .filter(k =>
        (l1Ids.has(k.id) && !l1WithChildren.has(k.id)) ||
        (k.parent_id != null && l1Ids.has(k.parent_id)),
      )
      .map(k => k.id)
  }, [kategorien, l1Kategorien])

  // ─── Flat rows ───────────────────────────────────────────────────────────────

  const flatRows = useMemo((): FlatRow[] => {
    const rows: FlatRow[] = []
    rows.push({ id: 'total', kind: 'total', label: 'Produktinvestitionen (Gesamt)', indent: 0, childLeafIds: allLeafIds })

    for (const l1 of l1Kategorien) {
      const children = childrenByParent.get(l1.id) ?? []

      if (children.length > 0) {
        const expanded = expandedCategories.has(l1.id)
        rows.push({
          id: `header-${l1.id}`,
          kind: 'category-header',
          label: l1.name,
          indent: 0,
          l1KategorieId: l1.id,
          childLeafIds: children.map(c => c.id),
          expandable: true,
          expanded,
        })
        if (expanded) {
          for (const child of children) {
            rows.push({
              id: `leaf-${child.id}`,
              kind: 'leaf',
              label: child.name,
              indent: 1,
              kategorieId: child.id,
            })
          }
        }
      } else {
        rows.push({
          id: `leaf-${l1.id}`,
          kind: 'leaf',
          label: l1.name,
          indent: 0,
          kategorieId: l1.id,
        })
      }
    }

    return rows
  }, [l1Kategorien, childrenByParent, expandedCategories, allLeafIds])

  // ─── Row value ───────────────────────────────────────────────────────────────

  function getAggregate(leafIds: string[], kw: PlanungsWoche): { total: number; hasAny: boolean } {
    let total = 0, hasAny = false
    for (const id of leafIds) {
      const v = values.get(kategorieWertKey(id, kw.year, kw.week))
      if (v !== null && v !== undefined) { total += v; hasAny = true }
    }
    return { total, hasAny }
  }

  function getRowValue(row: FlatRow, kw: PlanungsWoche): {
    display: string
    rawNum: number | null
    isEditable: boolean
  } {
    switch (row.kind) {
      case 'leaf': {
        const v = getWert(row.kategorieId!, kw)
        return { display: v !== null ? formatNum(v) : '', rawNum: v, isEditable: true }
      }
      case 'category-header':
      case 'total': {
        const { total, hasAny } = getAggregate(row.childLeafIds!, kw)
        return { display: hasAny ? formatNum(total) : '—', rawNum: hasAny ? total : null, isEditable: false }
      }
      default:
        return { display: '', rawNum: null, isEditable: false }
    }
  }

  // ─── Selection ───────────────────────────────────────────────────────────────

  function handleNonEditableMouseDown(e: React.MouseEvent, key: string, value: number) {
    e.preventDefault(); e.stopPropagation()
    isDragging.current = true
    const multi = e.ctrlKey || e.metaKey
    setSelectedCells(prev => {
      if (multi) {
        if (prev.has(key)) { const n = new Map(prev); n.delete(key); return n }
        return new Map([...prev, [key, value]])
      }
      return new Map([[key, value]])
    })
  }

  function handleNonEditableMouseEnter(key: string, value: number) {
    if (!isDragging.current) return
    setSelectedCells(prev => prev.has(key) ? prev : new Map([...prev, [key, value]]))
  }

  function handleEditableCellMouseDown(e: React.MouseEvent, editKey: string, rawNum: number | null) {
    if (!(e.ctrlKey || e.metaKey)) return
    e.preventDefault(); e.stopPropagation()
    if (rawNum === null) return
    isDragging.current = true
    setSelectedCells(prev => {
      if (prev.has(editKey)) { const n = new Map(prev); n.delete(editKey); return n }
      return new Map([...prev, [editKey, rawNum]])
    })
  }

  function handleEditableCellClick(e: React.MouseEvent, editKey: string, display: string) {
    if (e.ctrlKey || e.metaKey) return
    e.stopPropagation()
    setSelectedCells(new Map())
    const origVal = display === '' ? '' : display.replace(',', '.')
    editingOriginalValue.current = origVal
    setEditingCell(editKey)
    setEditingValue(origVal)
  }

  function handleEditableCellMouseEnter(editKey: string, rawNum: number | null) {
    if (!isDragging.current || rawNum === null) return
    setSelectedCells(prev => prev.has(editKey) ? prev : new Map([...prev, [editKey, rawNum]]))
  }

  // ─── Inline edit blur ─────────────────────────────────────────────────────────

  async function handleCellBlur(kategorieId: string, kw: PlanungsWoche) {
    const blurringKey = kategorieWertKey(kategorieId, kw.year, kw.week)
    if (editingCellRef.current !== blurringKey) return

    const parsedNew = editingValue.trim() === '' ? null : parseFloat(editingValue.replace(',', '.'))
    const parsedOrig = editingOriginalValue.current === '' ? null : parseFloat(editingOriginalValue.current)

    setEditingCell(null)
    setEditingValue('')

    if (parsedNew !== null && (isNaN(parsedNew) || parsedNew < 0)) return

    const unchanged =
      (parsedNew === null && parsedOrig === null) ||
      (parsedNew !== null && parsedOrig !== null && Math.abs(parsedNew - parsedOrig) < 0.005)
    if (unchanged) return

    try {
      await upsertZelle(kategorieId, kw, parsedNew)
    } catch {
      toast({ title: 'Fehler beim Speichern', description: 'Wert konnte nicht gespeichert werden.', variant: 'destructive' })
    }
  }

  // ─── Notiz helpers ───────────────────────────────────────────────────────────

  function isEditableNotizKey(key: string): boolean {
    return !key.startsWith('row:')
  }

  function getNotizCellLabel(editKey: string): string {
    const parts = editKey.split(':')
    if (parts.length === 3) {
      const kategorieId = parts[0]
      const year = parseInt(parts[1])
      const week = parseInt(parts[2])
      const kw = wochen.find(w => w.year === year && w.week === week)
      const kat = kategorien.find(k => k.id === kategorieId)
      return `${kat?.name ?? kategorieId} · ${kw?.label ?? ''}`
    }
    return editKey
  }

  // ─── Loading / Error / Empty ──────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="space-y-2">
        {Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-8 w-full" />)}
      </div>
    )
  }

  if (error) return <p className="text-sm text-destructive">{error}</p>

  if (l1Kategorien.length === 0) {
    return (
      <div className="rounded-md border p-8 text-center text-muted-foreground text-sm space-y-2">
        <p>Keine Produktinvestitionskategorien im KPI-Modell vorhanden.</p>
        <p>
          Bitte den Knoten &apos;Produktinvestitionen&apos; im{' '}
          <a href="/dashboard/kpi-modell" className="underline text-foreground">
            KPI-Modell konfigurieren
          </a>
          {' '}und Produktinvestitionskategorien anlegen.
        </p>
      </div>
    )
  }

  // ─── Render ───────────────────────────────────────────────────────────────────

  return (
    <TooltipProvider delayDuration={400}>
    <div data-betrag-selektion="true" className="space-y-4">
      {/* Toolbar */}
      <div className="flex items-center justify-between">
        {wochen.length > 0 && (
          <span className="text-sm text-muted-foreground">
            {wochen[0].label} – {wochen[wochen.length - 1].label}
          </span>
        )}
        {allExpandableIds.size > 0 && (
          <Button
            variant="ghost"
            size="sm"
            className="gap-1.5 text-xs text-muted-foreground"
            onClick={toggleAll}
          >
            {allExpanded
              ? <ChevronsDownUp className="h-3.5 w-3.5" />
              : <ChevronsUpDown className="h-3.5 w-3.5" />
            }
            {allExpanded ? 'Alle einklappen' : 'Alle ausklappen'}
          </Button>
        )}
      </div>

      {/* Table */}
      <div className="overflow-x-auto rounded-md border">
        <table className="w-full text-sm border-collapse">
          <thead>
            <tr className="border-b bg-muted/20">
              <th className="sticky left-0 z-20 bg-muted/20 min-w-[220px] max-w-[280px] px-3 py-1" />
              {monthGroups.map((g, i) => (
                <th
                  key={g.label + i}
                  colSpan={g.count}
                  className="px-2 py-1 text-center text-xs font-medium text-muted-foreground border-l"
                >
                  {g.label}
                </th>
              ))}
            </tr>
            <tr className="border-b bg-muted/40">
              <th className="sticky left-0 z-20 bg-muted/40 min-w-[220px] max-w-[280px] px-3 py-2.5 text-left font-medium text-muted-foreground">
                Produktinvestition
              </th>
              {wochen.map(kw => {
                const isNew = isNewWeek && lastWoche && kw.year === lastWoche.year && kw.week === lastWoche.week
                return (
                  <th
                    key={`${kw.year}-${kw.week}`}
                    className={[
                      'min-w-[100px] px-2 py-2.5 text-right font-medium text-xs border-l',
                      isNew
                        ? 'bg-red-50 text-red-700 dark:bg-red-950/30 dark:text-red-400'
                        : 'text-muted-foreground',
                    ].join(' ')}
                    title={isNew ? 'Neue Woche — Bitte Werte prüfen' : undefined}
                  >
                    {kw.label}
                    {isNew && <span className="block text-[10px] font-normal">Neue Woche</span>}
                  </th>
                )
              })}
            </tr>
          </thead>
          <tbody>
            {flatRows.map(row => {
              const isTotal = row.kind === 'total'
              const isHeader = row.kind === 'category-header'
              const isL1Leaf = row.kind === 'leaf' && row.indent === 0

              const rowBg = isTotal
                ? 'bg-muted/60'
                : (isHeader || isL1Leaf)
                  ? 'bg-muted/30'
                  : 'bg-white dark:bg-background'

              return (
                <tr key={row.id} className={['border-b last:border-0 hover:bg-muted/20 transition-colors', rowBg].join(' ')}>
                  {/* Label cell */}
                  <td
                    className={[
                      'sticky left-0 z-10 px-3 py-1.5 whitespace-nowrap',
                      isTotal ? 'bg-muted/60' : (isHeader || isL1Leaf) ? 'bg-muted/30' : 'bg-white dark:bg-background',
                    ].join(' ')}
                    style={{ paddingLeft: `${12 + row.indent * 16}px` }}
                  >
                    {isHeader ? (
                      <button
                        type="button"
                        className="flex items-center gap-1 text-sm font-semibold hover:text-primary"
                        onClick={() =>
                          setExpandedCategories(prev => {
                            const next = new Set(prev)
                            if (next.has(row.l1KategorieId!)) next.delete(row.l1KategorieId!)
                            else next.add(row.l1KategorieId!)
                            return next
                          })
                        }
                      >
                        {row.expanded
                          ? <ChevronDown className="h-3.5 w-3.5 shrink-0" />
                          : <ChevronRight className="h-3.5 w-3.5 shrink-0" />}
                        {row.label}
                      </button>
                    ) : isL1Leaf ? (
                      <span className="flex items-center text-sm font-semibold pl-[18px]">
                        {row.label}
                      </span>
                    ) : (
                      <span className={isTotal ? 'text-sm font-semibold' : 'text-sm'}>
                        {row.label}
                      </span>
                    )}
                  </td>

                  {/* Value cells */}
                  {wochen.map(kw => {
                    const { display, rawNum, isEditable } = getRowValue(row, kw)
                    const isNew = isNewWeek && lastWoche && kw.year === lastWoche.year && kw.week === lastWoche.week
                    const editKey = isEditable && row.kategorieId
                      ? kategorieWertKey(row.kategorieId, kw.year, kw.week)
                      : null
                    const isCurrentlyEditing = editKey !== null && editingCell === editKey
                    const isSelected = editKey !== null
                      ? selectedCells.has(editKey)
                      : selectedCells.has(`row:${row.id}:${kw.year}:${kw.week}`)

                    return (
                      <td
                        key={`${kw.year}-${kw.week}`}
                        className={[
                          'relative px-2 py-1.5 text-right text-xs tabular-nums select-none border-l',
                          isNew && isEditable ? 'bg-red-50 dark:bg-red-950/10' : '',
                          isSelected ? 'bg-blue-100 dark:bg-blue-900/30' : '',
                          isEditable ? 'cursor-pointer' : '',
                        ].join(' ')}
                        onClick={
                          isEditable && editKey && !isCurrentlyEditing
                            ? e => handleEditableCellClick(e, editKey, display)
                            : undefined
                        }
                        onMouseDown={
                          isEditable && editKey
                            ? e => handleEditableCellMouseDown(e, editKey, rawNum)
                            : !isEditable && rawNum !== null
                              ? e => handleNonEditableMouseDown(e, `row:${row.id}:${kw.year}:${kw.week}`, rawNum)
                              : undefined
                        }
                        onMouseEnter={
                          isEditable && editKey
                            ? () => handleEditableCellMouseEnter(editKey, rawNum)
                            : !isEditable && rawNum !== null
                              ? () => handleNonEditableMouseEnter(`row:${row.id}:${kw.year}:${kw.week}`, rawNum)
                              : undefined
                        }
                      >
                        {/* Note indicator */}
                        {editKey && notizen.has(editKey) && !isCurrentlyEditing && (
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <span
                                className="absolute top-0.5 right-0.5 z-10 cursor-default text-amber-500"
                                onClick={e => { e.preventDefault(); e.stopPropagation() }}
                              >
                                <StickyNote className="h-2 w-2" />
                              </span>
                            </TooltipTrigger>
                            <TooltipContent side="top" align="end" className="max-w-[220px] text-xs whitespace-pre-wrap break-words">
                              {(notizen.get(editKey) ?? '').length > 300
                                ? (notizen.get(editKey) ?? '').slice(0, 300) + '…'
                                : (notizen.get(editKey) ?? '')}
                            </TooltipContent>
                          </Tooltip>
                        )}
                        {isCurrentlyEditing ? (
                          <input
                            autoFocus
                            type="number"
                            min="0"
                            step="any"
                            className="w-full text-right bg-transparent outline-none border-b border-primary text-xs tabular-nums"
                            value={editingValue}
                            onChange={e => setEditingValue(e.target.value)}
                            onBlur={() => handleCellBlur(row.kategorieId!, kw)}
                            onKeyDown={e => {
                              if (e.key === 'Enter') (e.target as HTMLInputElement).blur()
                              if (e.key === 'Escape') { setEditingCell(null); setEditingValue('') }
                            }}
                            onClick={e => e.stopPropagation()}
                            onMouseDown={e => e.stopPropagation()}
                          />
                        ) : (
                          <div className={[
                            'flex items-center justify-end',
                            isNew && isEditable ? 'ring-1 ring-red-300 dark:ring-red-700 rounded px-1' : '',
                          ].join(' ')}>
                            <span>{display || (isEditable ? '—' : display)}</span>
                          </div>
                        )}
                      </td>
                    )
                  })}
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {/* Bottom-right floating panels */}
      {selectedCells.size > 0 && (
        <div
          data-betrag-selektion="true"
          className="fixed bottom-6 right-6 z-50 flex flex-col gap-2 items-stretch"
        >
          {/* Notiz panel — nur bei genau 1 editierbarer Zelle */}
          {selectedCells.size === 1 && (() => {
            const key = Array.from(selectedCells.keys())[0]
            if (!isEditableNotizKey(key)) return null
            const hasNotiz = notizen.has(key)
            return (
              <div className="rounded-lg border bg-background shadow-lg text-sm">
                <button
                  type="button"
                  className="flex items-center gap-2 px-4 py-2.5 w-full hover:bg-muted/50 rounded-lg transition-colors"
                  onClick={() => {
                    notizCellKeyRef.current = key
                    notizCellLabelRef.current = getNotizCellLabel(key)
                    setNotizFormularOpen(true)
                  }}
                >
                  <StickyNote className="h-3.5 w-3.5 text-amber-500 shrink-0" />
                  <span>{hasNotiz ? 'Notiz bearbeiten' : 'Notiz hinzufügen'}</span>
                </button>
              </div>
            )
          })()}

          {/* Betragsselektion panel */}
          <div className="flex items-center gap-3 rounded-lg border bg-background px-4 py-2.5 shadow-lg text-sm">
            <span className="text-muted-foreground">{selectedCells.size} Feld{selectedCells.size !== 1 ? 'er' : ''}</span>
            <div className="h-4 w-px bg-border" />
            <span className="font-semibold tabular-nums">Summe: {selectionSum.toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
            <button
              className="ml-1 text-muted-foreground hover:text-foreground"
              onClick={() => setSelectedCells(new Map())}
              aria-label="Auswahl aufheben"
            >
              ✕
            </button>
          </div>
        </div>
      )}

      {/* Notiz formular */}
      <PlanungNotizFormular
        open={notizFormularOpen}
        onOpenChange={setNotizFormularOpen}
        cellLabel={notizCellLabelRef.current}
        currentNotiz={notizCellKeyRef.current ? (notizen.get(notizCellKeyRef.current) ?? null) : null}
        onSave={text => upsertNotiz(notizCellKeyRef.current, text)}
        onDelete={() => deleteNotiz(notizCellKeyRef.current)}
      />

    </div>
    </TooltipProvider>
  )
}
