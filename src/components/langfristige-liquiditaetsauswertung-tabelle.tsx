'use client'

import { useState, useEffect, useRef, useMemo } from 'react'
import {
  ChevronDown, ChevronRight, ChevronsDownUp, ChevronsUpDown, StickyNote,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Tooltip, TooltipContent, TooltipProvider, TooltipTrigger,
} from '@/components/ui/tooltip'
import type {
  useLangfristigeLiquiditaetsauswertung,
  AuswertungColumn,
  AuswertungRow,
} from '@/hooks/use-langfristige-liquiditaetsauswertung'

function formatNum(v: number): string {
  return v.toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

function valueColorClass(v: number | null): string {
  if (v === null) return ''
  if (v > 0.0049) return 'text-green-700 dark:text-green-400'
  if (v < -0.0049) return 'text-red-600 dark:text-red-400'
  return 'text-muted-foreground'
}

// Jahres-Gruppen-Kopfzeile (gruppiert aufeinanderfolgende Monatsspalten desselben Jahres).
function buildYearGroups(columns: AuswertungColumn[]) {
  const groups: Array<{ label: string; colSpan: number }> = []
  for (const c of columns) {
    const year = c.label.split(' ').pop() ?? c.label
    const last = groups[groups.length - 1]
    if (last && last.label === year) last.colSpan += 1
    else groups.push({ label: year, colSpan: 1 })
  }
  return groups
}

export function LangfristigeLiquiditaetsauswertungTabelle({ data }: { data: ReturnType<typeof useLangfristigeLiquiditaetsauswertung> }) {
  const { columns, rows, expandableKeys, loading, error, isEmpty } = data

  const [collapsedKeys, setCollapsedKeys] = useState<Set<string>>(new Set())
  const [selectedCells, setSelectedCells] = useState<Map<string, number>>(new Map())
  const isDragging = useRef(false)

  const selectionSum = useMemo(
    () => Array.from(selectedCells.values()).reduce((a, b) => a + b, 0),
    [selectedCells],
  )

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

  const allCollapsed = expandableKeys.length > 0 && expandableKeys.every(k => collapsedKeys.has(k))
  const isYear = columns.some(c => c.sublabel)
  const yearGroups = useMemo(() => buildYearGroups(columns), [columns])

  function toggleGroup(key: string) {
    setCollapsedKeys(prev => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })
  }

  function handleCellMouseDown(e: React.MouseEvent, key: string, value: number) {
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
  function handleCellMouseEnter(key: string, value: number) {
    if (!isDragging.current) return
    setSelectedCells(prev => prev.has(key) ? prev : new Map([...prev, [key, value]]))
  }

  if (loading) {
    return (
      <div className="space-y-2">
        {Array.from({ length: 8 }).map((_, i) => <Skeleton key={i} className="h-8 w-full" />)}
      </div>
    )
  }
  if (error) return <p className="text-sm text-destructive">{error}</p>
  if (isEmpty) {
    return (
      <div className="rounded-md border p-8 text-center text-muted-foreground text-sm space-y-2">
        <p>Keine Daten für die Liquiditätsauswertung vorhanden.</p>
        <p>Bitte zuerst Kategorien im KPI-Modell anlegen und Werte in den Planungsseiten erfassen.</p>
      </div>
    )
  }

  // sichtbare Zeilen (eingeklappte Gruppen transitiv ausblenden)
  const visibleRows = rows.filter(r => !r.ancestorGroupKeys.some(k => collapsedKeys.has(k)))

  return (
    <TooltipProvider>
      <div className="space-y-4">

        {/* Toolbar */}
        <div className="flex items-center justify-end gap-2">
          {expandableKeys.length > 0 && (
            allCollapsed ? (
              <Button variant="ghost" size="sm" className="gap-1.5 text-xs text-muted-foreground"
                onClick={() => setCollapsedKeys(new Set())}>
                <ChevronsUpDown className="h-3.5 w-3.5" /> Alle ausklappen
              </Button>
            ) : (
              <Button variant="ghost" size="sm" className="gap-1.5 text-xs text-muted-foreground"
                onClick={() => setCollapsedKeys(new Set(expandableKeys))}>
                <ChevronsDownUp className="h-3.5 w-3.5" /> Alle einklappen
              </Button>
            )
          )}
        </div>

        {/* Tabelle */}
        <div className="overflow-x-auto rounded-md border">
          <table className="w-full text-sm border-collapse">
            <thead>
              {/* Zeile 1: Jahres-Gruppen (nur in der Monatsansicht) */}
              {!isYear && (
                <tr className="border-b bg-muted/20">
                  <th className="sticky left-0 z-20 bg-muted min-w-[240px] max-w-[300px] px-3 py-1" />
                  {yearGroups.map((g, i) => (
                    <th key={`${g.label}-${i}`} colSpan={g.colSpan}
                      className="border-l px-2 py-1 text-center text-xs font-medium text-muted-foreground">
                      {g.label}
                    </th>
                  ))}
                </tr>
              )}
              {/* Zeile 2: Spalten (Monat bzw. Jahr + Monatsbereich) */}
              <tr className="border-b bg-muted/40">
                <th className="sticky left-0 z-20 bg-muted min-w-[240px] max-w-[300px] px-3 py-2.5 text-left font-medium text-muted-foreground">
                  Kategorie
                </th>
                {columns.map(col => (
                  <th key={col.key}
                    className="min-w-[104px] border-l px-2 py-2 text-right font-medium text-xs text-muted-foreground align-bottom">
                    {isYear ? (
                      <>
                        <div>{col.label}</div>
                        {col.sublabel && <div className="text-[10px] font-normal text-muted-foreground/70">{col.sublabel}</div>}
                      </>
                    ) : col.label.split(' ')[0]}
                  </th>
                ))}
              </tr>
            </thead>

            <tbody>
              {visibleRows.map(row => (
                <TableRow
                  key={row.id}
                  row={row}
                  columns={columns}
                  collapsed={row.groupKey ? collapsedKeys.has(row.groupKey) : false}
                  onToggle={row.groupKey ? () => toggleGroup(row.groupKey!) : undefined}
                  selectedCells={selectedCells}
                  onCellMouseDown={handleCellMouseDown}
                  onCellMouseEnter={handleCellMouseEnter}
                />
              ))}
            </tbody>
          </table>
        </div>

        {/* Selektions-Panel */}
        {selectedCells.size > 0 && (
          <div data-betrag-selektion="true"
            className="fixed bottom-6 right-6 z-50 flex items-center gap-3 rounded-lg border bg-background px-4 py-2.5 shadow-lg text-sm">
            <span className="text-muted-foreground">{selectedCells.size} Feld{selectedCells.size !== 1 ? 'er' : ''}</span>
            <div className="h-4 w-px bg-border" />
            <span className="font-semibold tabular-nums">Summe: {formatNum(selectionSum)}</span>
            <button className="ml-1 text-muted-foreground hover:text-foreground"
              onClick={() => setSelectedCells(new Map())} aria-label="Auswahl aufheben">✕</button>
          </div>
        )}
      </div>
    </TooltipProvider>
  )
}

// ─── Zeilen-Komponente ─────────────────────────────────────────────────────────

interface RowProps {
  row: AuswertungRow
  columns: AuswertungColumn[]
  collapsed: boolean
  onToggle?: () => void
  selectedCells: Map<string, number>
  onCellMouseDown: (e: React.MouseEvent, key: string, value: number) => void
  onCellMouseEnter: (key: string, value: number) => void
}

function TableRow({ row, columns, collapsed, onToggle, selectedCells, onCellMouseDown, onCellMouseEnter }: RowProps) {
  const isSection = row.kind === 'section'
  const isTotal = row.kind === 'gesamt-einnahmen' || row.kind === 'gesamt-ausgaben'
  const isCashflow = row.kind === 'cashflow'
  const isKontostand = row.kind === 'kontostand'
  const isKategorie = row.kind === 'kategorie'
  const isSub = row.kind === 'sub'
  const isSummary = isTotal || isCashflow || isKontostand

  const rowBg = isSection ? 'bg-muted/60'
    : isTotal ? 'bg-muted'
    : isCashflow ? 'bg-muted'
    : isKontostand ? 'bg-slate-100 dark:bg-slate-900'
    : 'bg-background'

  const stickyBg = rowBg
  const labelFont = isSection ? 'font-semibold text-xs uppercase tracking-wide text-muted-foreground'
    : isKontostand ? 'font-semibold text-base'
    : isSummary ? 'font-semibold text-sm'
    : isKategorie ? 'font-medium text-sm'
    : isSub ? 'text-xs text-muted-foreground'
    : 'text-sm'

  return (
    <tr className={[
      'border-b last:border-0', rowBg,
      !isSection ? 'hover:bg-muted/20 transition-colors' : '',
      isSummary ? 'border-t-2 border-t-border' : '',
    ].join(' ')}>
      <td className={['sticky left-0 z-10 px-3 py-1.5 whitespace-nowrap', stickyBg].join(' ')}
        style={{ paddingLeft: `${12 + row.indent * 16}px` }}>
        {row.expandable && onToggle ? (
          <button type="button" className={['flex items-center gap-1 hover:text-primary', labelFont].join(' ')} onClick={onToggle}>
            {collapsed ? <ChevronRight className="h-3.5 w-3.5 shrink-0" /> : <ChevronDown className="h-3.5 w-3.5 shrink-0" />}
            {row.label}
          </button>
        ) : (
          <span className={['flex items-center gap-1', labelFont].join(' ')}>
            {!isSection && <span className="w-3.5 shrink-0" />}
            {row.label}
          </span>
        )}
      </td>

      {columns.map(col => {
        if (isSection) {
          return <td key={col.key} className="border-l" />
        }
        const cell = row.cells[col.key]
        const v = cell?.value ?? null
        const cellKey = `${row.id}:${col.key}`
        const selected = selectedCells.has(cellKey)
        return (
          <td key={col.key}
            data-betrag-selektion="true"
            className={[
              'relative border-l px-1.5 py-1.5 text-right text-xs tabular-nums select-none',
              selected ? 'bg-blue-100 dark:bg-blue-900/30' : '',
              v !== null ? 'cursor-default' : '',
            ].join(' ')}
            onMouseDown={v !== null ? e => onCellMouseDown(e, cellKey, v) : undefined}
            onMouseEnter={() => v !== null && onCellMouseEnter(cellKey, v)}>
            {cell?.hasNote && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <span className="absolute top-0.5 right-0.5 z-10 cursor-default text-amber-500"
                    onClick={e => { e.preventDefault(); e.stopPropagation() }}>
                    <StickyNote className="h-2 w-2" />
                  </span>
                </TooltipTrigger>
                <TooltipContent side="top" align="end" className="max-w-[220px] text-xs whitespace-pre-wrap break-words">
                  {(cell.noteText ?? '').length > 300 ? (cell.noteText ?? '').slice(0, 300) + '…' : cell.noteText}
                </TooltipContent>
              </Tooltip>
            )}
            <div className="flex items-center justify-end gap-1">
              {cell?.indicator && (
                <span className={[
                  'inline-block h-1.5 w-1.5 rounded-full shrink-0',
                  cell.indicator === 'gray' ? 'bg-muted-foreground/40' : 'bg-blue-500',
                ].join(' ')} />
              )}
              <span className={[
                isSummary ? 'font-semibold' : '',
                isKontostand ? 'text-[13px]' : '',
                valueColorClass(v),
              ].join(' ')}>
                {v !== null ? formatNum(v) : ''}
              </span>
            </div>
          </td>
        )
      })}
    </tr>
  )
}
