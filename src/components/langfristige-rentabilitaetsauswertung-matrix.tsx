'use client'

import { useState, useMemo, useRef, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { BarChart2, ChevronRight, ChevronDown, ChevronsDownUp, ChevronsUpDown } from 'lucide-react'
import {
  computeCascade,
  collectExpandableIds,
  bruttoByMonth,
  type RaModel,
  type RaNode,
  type RaAnzeigemodus,
} from '@/hooks/use-langfristige-rentabilitaetsauswertung'

// ─── Formatierung (analog reporting-rentabilitaet-matrix) ─────────────────────

function formatBetrag(value: number): string {
  return new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR' }).format(value)
}

function valueColorClass(value: number): string {
  if (value > 0) return 'text-green-700 dark:text-green-500'
  if (value < 0) return 'text-red-600 dark:text-red-400'
  return 'text-muted-foreground'
}

function formatProzentWert(value: number, basis: number): string {
  if (basis === 0) return '—'
  const pct = (value / basis) * 100
  return `${pct.toLocaleString('de-DE', { minimumFractionDigits: 1, maximumFractionDigits: 1 })} %`
}

type WachstumsWert = number | 'n/a' | null

function calcWachstum(value: number, vorwert: number | undefined): WachstumsWert {
  if (vorwert === undefined) return null
  if (vorwert === 0 && value === 0) return 0
  if (vorwert === 0) return 'n/a'
  return ((value - vorwert) / Math.abs(vorwert)) * 100
}

function formatWachstum(w: WachstumsWert): string {
  if (w === null) return '—'
  if (w === 'n/a') return 'n/a'
  if (w === 0) return '0,0 %'
  const abs = Math.abs(w)
  const str = abs.toLocaleString('de-DE', { minimumFractionDigits: 1, maximumFractionDigits: 1 })
  return w > 0 ? `+${str} % ↑` : `−${str} % ↓`
}

function wachstumColorClass(w: WachstumsWert): string {
  if (w === null || w === 'n/a' || w === 0) return 'text-muted-foreground'
  if (typeof w === 'number' && w > 0) return 'text-green-700 dark:text-green-500'
  return 'text-red-600 dark:text-red-400'
}

// ─── Flache Zeilen ────────────────────────────────────────────────────────────

interface FlatRow {
  id: string
  label: string
  indent: number
  kind: RaNode['kind']
  values: Record<string, number>
  expandable: boolean
  expanded: boolean
}

function flatten(nodes: RaNode[], expandedIds: Set<string>, indent: number, out: FlatRow[]) {
  for (const n of nodes) {
    const expandable = !!n.children && n.children.length > 0
    const expanded = expandedIds.has(n.id)
    out.push({ id: n.id, label: n.label, indent, kind: n.kind, values: n.values, expandable, expanded })
    if (expandable && expanded) flatten(n.children!, expandedIds, indent + 1, out)
  }
}

// ─── Hauptkomponente ──────────────────────────────────────────────────────────

interface Props {
  model: RaModel
  anzeigemodus: RaAnzeigemodus
}

export function LangfristigeRentabilitaetsauswertungMatrix({ model, anzeigemodus }: Props) {
  const { columns, lines, loading, error, isEmpty } = model
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set())

  const nodes = useMemo(
    () => computeCascade(lines, columns),
    [lines, columns],
  )
  const allExpandableIds = useMemo(() => collectExpandableIds(nodes), [nodes])
  const allExpanded = allExpandableIds.length > 0 && allExpandableIds.every(id => expandedIds.has(id))

  const rows = useMemo(() => {
    const out: FlatRow[] = []
    flatten(nodes, expandedIds, 0, out)
    return out
  }, [nodes, expandedIds])

  const bruttoBasis = useMemo(
    () => (anzeigemodus === 'prozentual' ? bruttoByMonth(nodes, columns) : null),
    [anzeigemodus, nodes, columns],
  )
  const allesBruttoNull = useMemo(() => {
    if (!bruttoBasis) return false
    return columns.every(c => (bruttoBasis[c.key] ?? 0) === 0)
  }, [bruttoBasis, columns])

  function toggleRow(id: string) {
    setExpandedIds(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }
  function toggleAll() {
    setExpandedIds(allExpanded ? new Set() : new Set(allExpandableIds))
  }

  // ── Betragsselektion (analog reporting-rentabilitaet-matrix) ──
  const [selectedCells, setSelectedCells] = useState<Map<string, number>>(new Map())
  const isDragging = useRef(false)
  const selSum = Array.from(selectedCells.values()).reduce((a, b) => a + b, 0)

  useEffect(() => {
    function onMouseDown(e: MouseEvent) {
      if (!(e.target as Element).closest('[data-betrag-selektion]')) setSelectedCells(new Map())
    }
    function onMouseUp() { isDragging.current = false }
    document.addEventListener('mousedown', onMouseDown)
    document.addEventListener('mouseup', onMouseUp)
    return () => {
      document.removeEventListener('mousedown', onMouseDown)
      document.removeEventListener('mouseup', onMouseUp)
    }
  }, [])

  function handleCellMouseDown(e: React.MouseEvent, key: string, value: number) {
    if (e.button !== 0) return
    e.preventDefault()
    e.stopPropagation()
    isDragging.current = true
    const multi = e.ctrlKey || e.metaKey
    setSelectedCells(prev => {
      if (prev.has(key)) {
        const next = new Map(prev)
        next.delete(key)
        return next
      }
      if (multi) return new Map([...prev, [key, value]])
      return new Map([[key, value]])
    })
  }
  function handleCellMouseEnter(key: string, value: number) {
    if (!isDragging.current) return
    setSelectedCells(prev => (prev.has(key) ? prev : new Map([...prev, [key, value]])))
  }

  function vorperiodeKey(key: string): string | undefined {
    const idx = columns.findIndex(c => c.key === key)
    if (idx <= 0) return undefined
    return columns[idx - 1].key
  }

  // ── Leer-/Lade-/Fehlerzustände ──
  if (loading) {
    return (
      <div className="space-y-2">
        {Array.from({ length: 10 }).map((_, i) => <Skeleton key={i} className="h-9 w-full" />)}
      </div>
    )
  }
  if (error) {
    return (
      <div className="flex flex-col items-center gap-3 rounded-lg border border-dashed py-16 text-center text-muted-foreground">
        <BarChart2 className="h-8 w-8" />
        <p className="text-sm">{error}</p>
      </div>
    )
  }
  if (columns.length === 0) {
    return (
      <div className="flex flex-col items-center gap-3 rounded-lg border border-dashed py-16 text-center text-muted-foreground">
        <BarChart2 className="h-8 w-8" />
        <p className="text-sm">Kein Planungszeitraum konfiguriert. Bitte Startmonat &amp; Planungshorizont in den Grundeinstellungen setzen.</p>
      </div>
    )
  }

  return (
    <>
      <div data-betrag-selektion="true" className="space-y-2">
        {isEmpty && (
          <p className="text-sm text-muted-foreground rounded-md border border-dashed px-4 py-2">
            Diese Planversion enthält noch keine Werte — alle Zeilen zeigen 0,00 €.
          </p>
        )}
        {anzeigemodus === 'prozentual' && allesBruttoNull && (
          <p className="text-sm text-muted-foreground rounded-md border border-dashed px-4 py-2">
            Kein Brutto-Umsatz im Planungszeitraum — prozentuale Berechnung nicht möglich.
          </p>
        )}

        {allExpandableIds.length > 0 && (
          <div className="flex justify-end">
            <Button variant="ghost" size="sm" className="gap-1.5 text-xs text-muted-foreground" onClick={toggleAll}>
              {allExpanded ? <ChevronsDownUp className="h-3.5 w-3.5" /> : <ChevronsUpDown className="h-3.5 w-3.5" />}
              {allExpanded ? 'Alle einklappen' : 'Alle ausklappen'}
            </Button>
          </div>
        )}

        <div className="overflow-x-auto rounded-md border">
          <table className="w-full text-sm border-collapse">
            <thead>
              <tr className="border-b bg-muted/40">
                <th className="sticky left-0 z-20 bg-muted/40 min-w-[260px] max-w-[340px] px-3 py-2.5 text-left font-medium text-muted-foreground">
                  Bezeichnung
                </th>
                {columns.map(c => (
                  <th key={c.key} className="min-w-[130px] px-3 py-2.5 text-right font-medium text-muted-foreground whitespace-nowrap align-bottom">
                    <div>{c.label}</div>
                    {c.sublabel && <div className="text-[10px] font-normal text-muted-foreground/70">{c.sublabel}</div>}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((row, idx) => {
                const isSubtotal = row.kind === 'subtotal'
                const isBold = isSubtotal
                const isLeafDetail = row.kind === 'produkt' || row.kind === 'child'
                const stickyBg = isSubtotal ? 'bg-muted' : 'bg-background'
                return (
                  <tr
                    key={`${row.id}-${idx}`}
                    className={[
                      'border-b last:border-b-0',
                      isBold ? 'bg-muted border-t-2 border-t-border' : 'hover:bg-muted/20',
                    ].filter(Boolean).join(' ')}
                  >
                    <td className={['sticky left-0 z-10 px-3 py-2', stickyBg].join(' ')}>
                      <div className="flex items-center gap-1" style={{ paddingLeft: `${row.indent * 1.25}rem` }}>
                        {row.expandable ? (
                          <button
                            onClick={() => toggleRow(row.id)}
                            className="flex-shrink-0 text-muted-foreground hover:text-foreground transition-colors"
                            aria-label={row.expanded ? 'Einklappen' : 'Ausklappen'}
                          >
                            {row.expanded ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
                          </button>
                        ) : (
                          <span className="h-3.5 w-3.5 flex-shrink-0" />
                        )}
                        <span className={[
                          isBold ? 'font-semibold' : '',
                          isLeafDetail ? 'text-muted-foreground text-xs' : '',
                        ].filter(Boolean).join(' ')}>
                          {row.label}
                        </span>
                      </div>
                    </td>

                    {columns.map(c => {
                      const value = row.values[c.key] ?? 0
                      const cellKey = `${row.id}_${c.key}`
                      const isSelected = selectedCells.has(cellKey)
                      const selBg = isSelected
                        ? 'bg-blue-100 dark:bg-blue-900/40 cursor-pointer select-none'
                        : 'hover:bg-blue-50 dark:hover:bg-blue-950/20 cursor-pointer select-none'

                      if (anzeigemodus === 'prozentual') {
                        const basis = bruttoBasis?.[c.key] ?? 0
                        return (
                          <td
                            key={c.key}
                            className={['px-3 py-2 text-right tabular-nums whitespace-nowrap', isBold ? 'font-semibold' : '', isLeafDetail ? 'text-xs' : '', selBg].filter(Boolean).join(' ')}
                            onMouseDown={e => handleCellMouseDown(e, cellKey, value)}
                            onMouseEnter={() => handleCellMouseEnter(cellKey, value)}
                          >
                            <div className={basis === 0 ? 'text-muted-foreground' : valueColorClass(value)}>
                              {formatProzentWert(value, basis)}
                            </div>
                            <div className="text-xs mt-0.5 text-muted-foreground">{formatBetrag(value)}</div>
                          </td>
                        )
                      }

                      if (anzeigemodus === 'wachstum') {
                        const vp = vorperiodeKey(c.key)
                        const vorwert = vp !== undefined ? (row.values[vp] ?? 0) : undefined
                        const wachstum = calcWachstum(value, vorwert)
                        return (
                          <td
                            key={c.key}
                            className={['px-3 py-2 text-right tabular-nums whitespace-nowrap', isBold ? 'font-semibold' : '', isLeafDetail ? 'text-xs' : '', selBg].filter(Boolean).join(' ')}
                            onMouseDown={e => handleCellMouseDown(e, cellKey, value)}
                            onMouseEnter={() => handleCellMouseEnter(cellKey, value)}
                          >
                            <div className={wachstumColorClass(wachstum)}>{formatWachstum(wachstum)}</div>
                            <div className="text-xs mt-0.5 text-muted-foreground">{formatBetrag(value)}</div>
                          </td>
                        )
                      }

                      // Absolut (Standard)
                      return (
                        <td
                          key={c.key}
                          className={['px-3 py-2 text-right tabular-nums whitespace-nowrap', isBold ? 'font-semibold' : '', isLeafDetail ? 'text-xs' : '', isSelected ? '' : valueColorClass(value), selBg].filter(Boolean).join(' ')}
                          onMouseDown={e => handleCellMouseDown(e, cellKey, value)}
                          onMouseEnter={() => handleCellMouseEnter(cellKey, value)}
                        >
                          {formatBetrag(value)}
                        </td>
                      )
                    })}
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>

      {selectedCells.size > 0 && (
        <div data-betrag-selektion="true" className="fixed bottom-6 right-6 z-50 flex items-center gap-3 rounded-lg border bg-background px-4 py-2.5 shadow-lg text-sm">
          <span className="text-muted-foreground">{selectedCells.size} Feld{selectedCells.size !== 1 ? 'er' : ''}</span>
          <div className="h-4 w-px bg-border" />
          <span className="font-semibold tabular-nums">Summe: {formatBetrag(selSum)}</span>
          <button className="ml-1 text-muted-foreground hover:text-foreground" onClick={() => setSelectedCells(new Map())} aria-label="Auswahl aufheben">✕</button>
        </div>
      )}
    </>
  )
}
