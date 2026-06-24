'use client'

import { useState, useMemo, useRef, useEffect } from 'react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { BarChart2, ChevronRight, ChevronDown, ChevronsDownUp, ChevronsUpDown } from 'lucide-react'
import {
  collectIaExpandableIds,
  type IaModel,
  type IaNode,
} from '@/hooks/use-langfristige-investitionsauswertung'

// ─── Formatierung ─────────────────────────────────────────────────────────────

function formatBetrag(value: number): string {
  return new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR' }).format(value)
}

// ─── Flache Zeilen ────────────────────────────────────────────────────────────

interface FlatRow {
  id: string
  label: string
  indent: number
  kind: IaNode['kind']
  values: Record<string, number>
  expandable: boolean
  expanded: boolean
}

function flatten(nodes: IaNode[], expandedIds: Set<string>, indent: number, out: FlatRow[]) {
  for (const n of nodes) {
    const expandable = !!n.children && n.children.length > 0
    const expanded = expandedIds.has(n.id)
    out.push({ id: n.id, label: n.label, indent, kind: n.kind, values: n.values, expandable, expanded })
    if (expandable && expanded) flatten(n.children!, expandedIds, indent + 1, out)
  }
}

// ─── Hauptkomponente ──────────────────────────────────────────────────────────

interface Props {
  model: IaModel
  versionId: string
}

export function LangfristigeInvestitionsauswertungMatrix({ model, versionId }: Props) {
  const { columns, tree, gesamt, loading, error, hasKategorien, hasProdukte, isEmpty } = model
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set())

  const allExpandableIds = useMemo(() => collectIaExpandableIds(tree), [tree])
  const allExpanded = allExpandableIds.length > 0 && allExpandableIds.every(id => expandedIds.has(id))

  const rows = useMemo(() => {
    const out: FlatRow[] = []
    flatten(tree, expandedIds, 0, out)
    out.push({
      id: gesamt.id, label: gesamt.label, indent: 0, kind: 'gesamt',
      values: gesamt.values, expandable: false, expanded: false,
    })
    return out
  }, [tree, gesamt, expandedIds])

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

  // ── Betragsselektion (analog Rentabilitätsauswertung) ──
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

  // ── Lade-/Fehler-/Leerzustände ──
  if (loading) {
    return (
      <div className="space-y-2">
        {Array.from({ length: 8 }).map((_, i) => <Skeleton key={i} className="h-9 w-full" />)}
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
  if (!hasKategorien) {
    return (
      <div className="flex flex-col items-center gap-3 rounded-lg border border-dashed py-16 text-center text-muted-foreground">
        <BarChart2 className="h-8 w-8" />
        <p className="text-sm">Diese Planversion hat noch keine Investitionskategorien.</p>
        <Button asChild variant="outline" size="sm">
          <Link href={`/dashboard/langfristige-planung/${versionId}/kpi-modell-verwaltung`}>
            Zur KPI-Modell-Verwaltung
          </Link>
        </Button>
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
        {!hasProdukte && (
          <p className="text-sm text-muted-foreground rounded-md border border-dashed px-4 py-2">
            Diese Planversion hat noch keine Produkte — Untergruppen zeigen daher keine Produktzeilen.{' '}
            <Link href={`/dashboard/langfristige-planung/${versionId}/kpi-modell-verwaltung`} className="underline">
              KPI-Modell-Verwaltung
            </Link>
          </p>
        )}
        {isEmpty && (
          <p className="text-sm text-muted-foreground rounded-md border border-dashed px-4 py-2">
            Diese Planversion enthält noch keine Investitionswerte — alle Zeilen zeigen 0,00 €.
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
                const isGesamt = row.kind === 'gesamt'
                const isObergruppe = row.kind === 'obergruppe'
                const isProdukt = row.kind === 'produkt'
                const isBold = isGesamt || isObergruppe
                const stickyBg = isGesamt ? 'bg-muted' : 'bg-background'
                return (
                  <tr
                    key={`${row.id}-${idx}`}
                    className={[
                      'border-b last:border-b-0',
                      isGesamt ? 'bg-muted border-t-2 border-t-border' : 'hover:bg-muted/20',
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
                          isProdukt ? 'text-muted-foreground text-xs' : '',
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
                      return (
                        <td
                          key={c.key}
                          className={['px-3 py-2 text-right tabular-nums whitespace-nowrap', isBold ? 'font-semibold' : '', isProdukt ? 'text-xs text-muted-foreground' : '', selBg].filter(Boolean).join(' ')}
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
