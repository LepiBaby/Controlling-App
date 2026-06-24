'use client'

import { useState, useEffect, useRef, useMemo } from 'react'
import {
  ChevronDown, ChevronRight, ChevronsDownUp, ChevronsUpDown, StickyNote,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  Tooltip, TooltipContent, TooltipProvider, TooltipTrigger,
} from '@/components/ui/tooltip'
import type {
  useLiquiditaetsauswertung,
  AuswertungColumn,
  AuswertungRow,
} from '@/hooks/use-liquiditaetsauswertung'

function formatNum(v: number): string {
  return v.toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

function valueColorClass(v: number | null): string {
  if (v === null) return ''
  if (v > 0.0049) return 'text-green-700 dark:text-green-400'
  if (v < -0.0049) return 'text-red-600 dark:text-red-400'
  return 'text-muted-foreground'
}

// Month-group header cells (group consecutive columns by month label + Ist/Soll)
function buildMonthGroups(columns: AuswertungColumn[]) {
  const groups: Array<{ label: string; colSpan: number; isPast: boolean; isFirstSoll: boolean }> = []
  for (const c of columns) {
    const m = c.monthLabel ?? deriveMonthLabel(c.label)
    const last = groups[groups.length - 1]
    if (last && last.label === m && last.isPast === c.isPast) {
      last.colSpan += 1
    } else {
      groups.push({ label: m, colSpan: 1, isPast: c.isPast, isFirstSoll: c.isFirstSoll })
    }
  }
  return groups
}

const MONTH_LABELS = ['Jan', 'Feb', 'Mär', 'Apr', 'Mai', 'Jun', 'Jul', 'Aug', 'Sep', 'Okt', 'Nov', 'Dez']
// For weekly columns labelled "KW22 / 2026" we can't derive a month cheaply here,
// so the hook supplies monthLabel only for monthly view. For weekly view we group by KW label prefix year.
function deriveMonthLabel(kwLabel: string): string {
  // fall back: group all weeks of same "/ YYYY" — coarse but only used when monthLabel missing
  const parts = kwLabel.split('/')
  return parts.length === 2 ? parts[1].trim() : kwLabel
}

export function LiquiditaetsauswertungTabelle({ data }: { data: ReturnType<typeof useLiquiditaetsauswertung> }) {
  const {
    granularitaet, setGranularitaet,
    vWochen, zWochen,
    columns, rows, expandableKeys,
    loading, error, isEmpty,
  } = data

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
  const monthGroups = useMemo(() => buildMonthGroups(columns), [columns])

  function toggleGroup(key: string) {
    setCollapsedKeys(prev => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })
  }

  // ── Selection handlers ──
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

  // ── Loading / Error / Empty ──
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
        <p>Bitte zuerst Einnahmen- und Ausgaben-Kategorien im{' '}
          <a href="/dashboard/kpi-modell" className="underline text-foreground">KPI-Modell</a> anlegen.</p>
      </div>
    )
  }

  const rangeLabel = vWochen.length > 0
    ? `${vWochen[0].label} – ${zWochen[zWochen.length - 1]?.label ?? ''}`
    : zWochen.length > 0 ? `${zWochen[0].label} – ${zWochen[zWochen.length - 1].label}` : ''

  // visible rows (respect collapsed groups, transitively across all ancestors)
  const visibleRows = rows.filter(r => !r.ancestorGroupKeys.some(k => collapsedKeys.has(k)))

  return (
    <TooltipProvider>
      <div className="space-y-4">

        {/* Toolbar */}
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-3">
            <Tabs value={granularitaet} onValueChange={v => setGranularitaet(v as 'woche' | 'monat')}>
              <TabsList>
                <TabsTrigger value="woche">Wöchentlich</TabsTrigger>
                <TabsTrigger value="monat">Monatlich</TabsTrigger>
              </TabsList>
            </Tabs>
            <span className="text-sm text-muted-foreground hidden md:inline">{rangeLabel}</span>
          </div>
          <div className="flex items-center gap-2">
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
        </div>

        {/* Table */}
        <div className="overflow-x-auto rounded-md border">
          <table className="w-full text-sm border-collapse">
            <thead>
              {/* Row 1: month groups */}
              <tr className="border-b bg-muted/20">
                <th className="sticky left-0 z-20 bg-muted min-w-[240px] max-w-[300px] px-3 py-1" />
                {monthGroups.map((g, i) => (
                  <th key={`${g.label}-${i}`} colSpan={g.colSpan}
                    className={[
                      'px-2 py-1 text-center text-xs font-medium text-muted-foreground',
                      g.isFirstSoll ? 'border-l-2 border-l-primary/70' : 'border-l',
                      g.isPast ? 'bg-muted/30' : '',
                    ].join(' ')}>
                    {g.label}
                  </th>
                ))}
              </tr>
              {/* Row 2: column labels + Ist/Soll */}
              <tr className="border-b bg-muted/40">
                <th className="sticky left-0 z-20 bg-muted min-w-[240px] max-w-[300px] px-3 py-2.5 text-left font-medium text-muted-foreground">
                  Kategorie
                </th>
                {columns.map(col => (
                  <th key={col.key}
                    className={[
                      'min-w-[104px] px-2 py-2 text-right font-medium text-xs text-muted-foreground',
                      col.isFirstSoll ? 'border-l-2 border-l-primary/70' : 'border-l',
                    ].join(' ')}>
                    {col.label}
                    <span className="block text-[10px] font-normal text-muted-foreground/70">
                      {col.subLabel}
                    </span>
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

        {/* Selection panel */}
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

// ─── Row component ─────────────────────────────────────────────────────────────

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
  const isGruppe = row.kind === 'gruppe'
  const isSub = row.kind === 'sub'
  const isSummary = isTotal || isCashflow || isKontostand
  const isBold = isSummary || isSection

  // Color differentiation like the Liquiditätsreport:
  // data rows (categories/groups/leaves) stay plain; only summary rows get a filled background.
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
          return <td key={col.key} className={[col.isFirstSoll ? 'border-l-2 border-l-primary/70' : 'border-l'].join(' ')} />
        }
        const cell = row.cells[col.key]
        const v = cell?.value ?? null
        const cellKey = `${row.id}:${col.key}`
        const selected = selectedCells.has(cellKey)
        return (
          <td key={col.key}
            data-betrag-selektion="true"
            className={[
              'relative px-1.5 py-1.5 text-right text-xs tabular-nums select-none',
              col.isFirstSoll ? 'border-l-2 border-l-primary/70' : 'border-l',
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
