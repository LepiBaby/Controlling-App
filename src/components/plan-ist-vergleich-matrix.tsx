'use client'

import { useState, useMemo } from 'react'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { BarChart2, ChevronRight, ChevronDown, ChevronsDownUp, ChevronsUpDown } from 'lucide-react'
import type { PivNode, PlanIstVergleichModel } from '@/hooks/use-plan-ist-vergleich'

// ─── Formatierung ─────────────────────────────────────────────────────────────

function formatBetrag(value: number): string {
  return new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR' }).format(value)
}

function formatProzent(value: number, basis: number): string {
  if (basis === 0) return '—'
  const pct = (value / basis) * 100
  return `${pct.toLocaleString('de-DE', { minimumFractionDigits: 1, maximumFractionDigits: 1 })} %`
}

/** Prozentuale Abweichung (Ist − Soll) / |Soll|; null bei Soll = 0. */
function formatAbwProzent(ist: number, soll: number): string {
  if (soll === 0) return '—'
  const pct = ((ist - soll) / Math.abs(soll)) * 100
  const sign = pct > 0 ? '+' : ''
  return `${sign}${pct.toLocaleString('de-DE', { minimumFractionDigits: 1, maximumFractionDigits: 1 })} %`
}

function valueColorClass(value: number): string {
  if (value > 0) return 'text-green-700 dark:text-green-500'
  if (value < 0) return 'text-red-600 dark:text-red-400'
  return 'text-muted-foreground'
}

// ─── Flache Zeilen (mit Drill-Down-Zustand) ────────────────────────────────────

interface FlatRow {
  node: PivNode
  indent: number
  expandable: boolean
  expanded: boolean
}

function buildFlatRows(rows: PivNode[], expandedIds: Set<string>): FlatRow[] {
  const out: FlatRow[] = []
  function walk(nodes: PivNode[], indent: number) {
    for (const node of nodes) {
      const expandable = node.children.length > 0
      const expanded = expandedIds.has(node.id)
      out.push({ node, indent, expandable, expanded })
      if (expandable && expanded) walk(node.children, indent + 1)
    }
  }
  walk(rows, 0)
  return out
}

function collectExpandableIds(rows: PivNode[]): Set<string> {
  const ids = new Set<string>()
  function walk(nodes: PivNode[]) {
    for (const node of nodes) {
      if (node.children.length > 0) {
        ids.add(node.id)
        walk(node.children)
      }
    }
  }
  walk(rows)
  return ids
}

// ─── Zell-Darstellung ──────────────────────────────────────────────────────────

interface WertZelleProps {
  value: number | null
  basis: number
  bold: boolean
  small: boolean
}

/** Ist-/Soll-Zelle: oben Prozent (Anteil am Brutto-Umsatz), darunter Absolutbetrag. */
function WertZelle({ value, basis, bold, small }: WertZelleProps) {
  if (value === null) {
    return <span className="text-muted-foreground">—</span>
  }
  return (
    <div className="leading-tight">
      <div className={[bold ? 'font-semibold' : '', basis === 0 ? 'text-muted-foreground' : valueColorClass(value)].filter(Boolean).join(' ')}>
        {formatProzent(value, basis)}
      </div>
      <div className={['text-[11px] text-muted-foreground', small ? '' : ''].join(' ')}>
        {formatBetrag(value)}
      </div>
    </div>
  )
}

/** Abweichungs-Zelle: oben Absolut (Ist − Soll), darunter Prozent (bezogen auf Soll). */
function AbweichungZelle({ ist, soll, bold }: { ist: number | null; soll: number | null; bold: boolean }) {
  if (ist === null) {
    return <span className="text-muted-foreground">—</span>
  }
  const sollVal = soll ?? 0
  const abs = ist - sollVal
  return (
    <div className="leading-tight">
      <div className={[bold ? 'font-semibold' : '', valueColorClass(abs)].filter(Boolean).join(' ')}>
        {formatBetrag(abs)}
      </div>
      <div className="text-[11px] text-muted-foreground">{formatAbwProzent(ist, sollVal)}</div>
    </div>
  )
}

// Stufenloser Farbverlauf für die Zielerreichung. Anker (Prozent → Farbe):
//   ≤50% knallrot · 65% orange · 80% klassisch gelb · 100% klassisch grün · ≥140% tiefes grün.
// Dazwischen wird linear interpoliert; außerhalb wird geklemmt.
const ZIEL_STOPS: Array<{ p: number; c: [number, number, number] }> = [
  { p: 50,  c: [220, 38, 38] },   // red-600 (knallrot)
  { p: 65,  c: [249, 115, 22] },  // orange-500
  { p: 80,  c: [234, 179, 8] },   // yellow-500 (klassisch gelb)
  { p: 100, c: [22, 163, 74] },   // green-600 (klassisch grün)
  { p: 140, c: [20, 83, 45] },    // green-800 (tiefes grün)
]

function zielFarbe(pct: number): string {
  const stops = ZIEL_STOPS
  const lo = stops[0], hi = stops[stops.length - 1]
  if (pct <= lo.p) return `rgb(${lo.c.join(',')})`
  if (pct >= hi.p) return `rgb(${hi.c.join(',')})`
  for (let i = 0; i < stops.length - 1; i++) {
    const a = stops[i], b = stops[i + 1]
    if (pct >= a.p && pct <= b.p) {
      const t = (pct - a.p) / (b.p - a.p)
      const ch = (j: number) => Math.round(a.c[j] + (b.c[j] - a.c[j]) * t)
      return `rgb(${ch(0)},${ch(1)},${ch(2)})`
    }
  }
  return `rgb(${hi.c.join(',')})`
}

/**
 * Zielerreichung: Ist / Soll in Prozent (wie viel vom Plan erreicht wurde).
 * Nur für Ergebnis-/Zwischensummen-Zeilen und Brutto-Umsatz (Gewinngrößen: mehr ist besser).
 * Farbe: stufenloser Verlauf rot → gelb → grün entlang der erreichten Prozent.
 */
function ZielerreichungZelle({ ist, soll, bold }: { ist: number | null; soll: number | null; bold: boolean }) {
  if (ist === null || soll === null || soll === 0) {
    return <span className="text-muted-foreground">—</span>
  }
  const pct = (ist / soll) * 100
  return (
    <span className={bold ? 'font-semibold' : ''} style={{ color: zielFarbe(pct) }}>
      {pct.toLocaleString('de-DE', { minimumFractionDigits: 1, maximumFractionDigits: 1 })} %
    </span>
  )
}

// ─── Hauptkomponente ──────────────────────────────────────────────────────────

interface Props {
  model: PlanIstVergleichModel
  hasSelection: boolean
}

export function PlanIstVergleichMatrix({ model, hasSelection }: Props) {
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set())

  const allExpandableIds = useMemo(() => collectExpandableIds(model.rows), [model.rows])
  const allExpanded = allExpandableIds.size > 0 && [...allExpandableIds].every(id => expandedIds.has(id))
  const flatRows = useMemo(() => buildFlatRows(model.rows, expandedIds), [model.rows, expandedIds])

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

  // ── Leer-/Ladezustände ────────────────────────────────────────────────────

  if (!hasSelection) {
    return (
      <div className="flex flex-col items-center gap-3 rounded-lg border border-dashed py-16 text-center text-muted-foreground">
        <BarChart2 className="h-8 w-8" />
        <p className="text-sm">Bitte Planversion und Monat auswählen.</p>
      </div>
    )
  }

  if (model.loading) {
    return (
      <div className="space-y-2">
        {Array.from({ length: 8 }).map((_, i) => (
          <Skeleton key={i} className="h-8 w-full" />
        ))}
      </div>
    )
  }

  return (
    <div className="space-y-2">
      {/* Toolbar */}
      {allExpandableIds.size > 0 && (
        <div className="flex justify-end">
          <Button
            variant="ghost"
            size="sm"
            className="gap-1.5 text-xs text-muted-foreground"
            onClick={toggleAll}
          >
            {allExpanded
              ? <ChevronsDownUp className="h-3.5 w-3.5" />
              : <ChevronsUpDown className="h-3.5 w-3.5" />}
            {allExpanded ? 'Alle einklappen' : 'Alle ausklappen'}
          </Button>
        </div>
      )}

      {/* Matrix */}
      <div className="overflow-x-auto rounded-md border">
        <table className="w-full text-sm border-collapse">
          <thead>
            <tr className="border-b bg-muted/40">
              <th className="sticky left-0 z-20 bg-muted/40 min-w-[240px] max-w-[340px] px-3 py-1.5 text-left font-medium text-muted-foreground">
                Bezeichnung
              </th>
              <th className="min-w-[130px] px-3 py-1.5 text-right font-medium text-muted-foreground whitespace-nowrap">Ist</th>
              <th className="min-w-[130px] px-3 py-1.5 text-right font-medium text-muted-foreground whitespace-nowrap">Soll</th>
              <th className="min-w-[140px] px-3 py-1.5 text-right font-medium text-muted-foreground whitespace-nowrap border-l">
                Abweichung
              </th>
              <th className="min-w-[110px] px-3 py-1.5 text-right font-medium text-muted-foreground whitespace-nowrap border-l">
                Zielerreichung
              </th>
            </tr>
          </thead>
          <tbody>
            {flatRows.map(({ node, indent, expandable, expanded }, idx) => {
              const isSub = node.kind === 'zwischensumme'
              const isLeaf = indent > 0
              return (
                <tr
                  key={`${node.id}-${idx}`}
                  className={[
                    'border-b last:border-b-0',
                    isSub ? 'bg-muted border-t-2 border-t-border' : 'hover:bg-muted/20',
                  ].join(' ')}
                >
                  {/* Bezeichnung — sticky */}
                  <td className={['sticky left-0 z-10 px-3 py-1', isSub ? 'bg-muted' : 'bg-background'].join(' ')}>
                    <div className="flex items-center gap-1" style={{ paddingLeft: `${indent * 1.25}rem` }}>
                      {expandable ? (
                        <button
                          onClick={() => toggleRow(node.id)}
                          className="flex-shrink-0 text-muted-foreground hover:text-foreground transition-colors"
                          aria-label={expanded ? 'Einklappen' : 'Ausklappen'}
                        >
                          {expanded
                            ? <ChevronDown className="h-3.5 w-3.5" />
                            : <ChevronRight className="h-3.5 w-3.5" />}
                        </button>
                      ) : (
                        <span className="h-3.5 w-3.5 flex-shrink-0" />
                      )}
                      <span className={[
                        isSub ? 'font-semibold' : '',
                        isLeaf ? 'text-muted-foreground text-xs' : '',
                      ].filter(Boolean).join(' ')}>
                        {node.label}
                      </span>
                    </div>
                  </td>

                  {/* Ist */}
                  <td className="px-3 py-1 text-right tabular-nums whitespace-nowrap">
                    <WertZelle value={node.ist} basis={model.istBrutto} bold={isSub} small={isLeaf} />
                  </td>

                  {/* Soll */}
                  <td className="px-3 py-1 text-right tabular-nums whitespace-nowrap">
                    <WertZelle value={node.soll} basis={model.sollBrutto} bold={isSub} small={isLeaf} />
                  </td>

                  {/* Abweichung */}
                  <td className="px-3 py-1 text-right tabular-nums whitespace-nowrap border-l">
                    <AbweichungZelle ist={node.ist} soll={node.soll} bold={isSub} />
                  </td>

                  {/* Zielerreichung — nur für Ergebniszeilen + Brutto-Umsatz */}
                  <td className="px-3 py-1 text-right tabular-nums whitespace-nowrap border-l">
                    {(isSub || node.id === 'brutto_umsatz')
                      ? <ZielerreichungZelle ist={node.ist} soll={node.soll} bold={isSub} />
                      : null}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}
