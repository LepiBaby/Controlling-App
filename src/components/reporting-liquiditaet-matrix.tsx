'use client'

import { useState, useMemo } from 'react'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { BarChart2, ChevronRight, ChevronDown, ChevronsDownUp, ChevronsUpDown } from 'lucide-react'
import type {
  ReportingLiquiditaetData,
  LiquiditaetKategorie,
  LiquiditaetGruppe,
  LiquiditaetUntergruppe,
  LiquiditaetPlattform,
  LiquiditaetBlatt,
} from '@/hooks/use-reporting-liquiditaet'

// ─── Formatierung ─────────────────────────────────────────────────────────────

function formatBetrag(value: number): string {
  return new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR' }).format(value)
}

function valueColorClass(value: number): string {
  if (value > 0) return 'text-green-700 dark:text-green-500'
  if (value < 0) return 'text-red-600 dark:text-red-400'
  return 'text-muted-foreground'
}

function formatPeriode(periode: string): string {
  if (periode.includes('-Q')) {
    const [year, q] = periode.split('-')
    return `${q} ${year}`
  }
  if (/^\d{4}-\d{2}$/.test(periode)) {
    const [year, month] = periode.split('-')
    const names = ['Jan', 'Feb', 'Mär', 'Apr', 'Mai', 'Jun', 'Jul', 'Aug', 'Sep', 'Okt', 'Nov', 'Dez']
    return `${names[parseInt(month, 10) - 1]} ${year}`
  }
  return periode
}

// ─── Flache Zeilen aufbauen ───────────────────────────────────────────────────

type LiqRowKind =
  | 'section-header'
  | 'kategorie'
  | 'gruppe'
  | 'untergruppe'
  | 'plattform'
  | 'produkt'
  | 'summe'
  | 'cashflow'
  | 'kontostand'

interface LiqFlatRow {
  id: string
  label: string
  indent: number
  kind: LiqRowKind
  values: Record<string, number>
  expandable: boolean
  expanded: boolean
}

function pltRowId(parentId: string, pltId: string) {
  return `plt:${parentId}:${pltId}`
}

function pushPlattform(
  rows: LiqFlatRow[],
  plt: LiquiditaetPlattform,
  parentId: string,
  expandedIds: Set<string>,
  indent: number,
) {
  const rowId = pltRowId(parentId, plt.id)
  const expandable = plt.produkte.length > 0
  rows.push({ id: rowId, label: plt.name, indent, kind: 'plattform', values: plt.values, expandable, expanded: expandedIds.has(rowId) })
  if (!expandable || !expandedIds.has(rowId)) return
  for (const prd of plt.produkte) {
    rows.push({ id: `prd:${rowId}:${prd.id}`, label: prd.name, indent: indent + 1, kind: 'produkt', values: prd.values, expandable: false, expanded: false })
  }
}

function pushDirektProdukte(
  rows: LiqFlatRow[],
  produkte: LiquiditaetBlatt[],
  parentId: string,
  expandedIds: Set<string>,
  indent: number,
) {
  for (const prd of produkte) {
    const rowId = `dirprd:${parentId}:${prd.id}`
    rows.push({ id: rowId, label: prd.name, indent, kind: 'produkt', values: prd.values, expandable: false, expanded: false })
  }
}

function pushUntergruppe(
  rows: LiqFlatRow[],
  ugr: LiquiditaetUntergruppe,
  expandedIds: Set<string>,
  indent: number,
) {
  const hasPlt = ugr.sales_plattformen.length > 0
  const hasPrd = (ugr.produkte?.length ?? 0) > 0
  const expandable = hasPlt || hasPrd
  rows.push({ id: ugr.id, label: ugr.name, indent, kind: 'untergruppe', values: ugr.values, expandable, expanded: expandedIds.has(ugr.id) })
  if (!expandable || !expandedIds.has(ugr.id)) return
  if (hasPlt) {
    for (const plt of ugr.sales_plattformen) pushPlattform(rows, plt, ugr.id, expandedIds, indent + 1)
  } else if (hasPrd) {
    pushDirektProdukte(rows, ugr.produkte, ugr.id, expandedIds, indent + 1)
  }
}

function pushGruppe(
  rows: LiqFlatRow[],
  grp: LiquiditaetGruppe,
  expandedIds: Set<string>,
  indent: number,
) {
  const hasUgr = grp.untergruppen.length > 0
  const hasPlt = grp.sales_plattformen.length > 0
  const hasPrd = (grp.produkte?.length ?? 0) > 0
  const expandable = hasUgr || hasPlt || hasPrd
  rows.push({ id: grp.id, label: grp.name, indent, kind: 'gruppe', values: grp.values, expandable, expanded: expandedIds.has(grp.id) })
  if (!expandable || !expandedIds.has(grp.id)) return
  if (hasUgr) {
    for (const ugr of grp.untergruppen) pushUntergruppe(rows, ugr, expandedIds, indent + 1)
  } else if (hasPlt) {
    for (const plt of grp.sales_plattformen) pushPlattform(rows, plt, grp.id, expandedIds, indent + 1)
  } else if (hasPrd) {
    pushDirektProdukte(rows, grp.produkte, grp.id, expandedIds, indent + 1)
  }
}

function pushKategorie(
  rows: LiqFlatRow[],
  kat: LiquiditaetKategorie,
  expandedIds: Set<string>,
) {
  const hasGruppen = kat.gruppen.length > 0
  const hasPlt = kat.sales_plattformen.length > 0
  const hasPrd = (kat.produkte?.length ?? 0) > 0
  const expandable = hasGruppen || hasPlt || hasPrd
  rows.push({ id: kat.id, label: kat.name, indent: 0, kind: 'kategorie', values: kat.values, expandable, expanded: expandedIds.has(kat.id) })
  if (!expandable || !expandedIds.has(kat.id)) return
  if (hasGruppen) {
    for (const grp of kat.gruppen) pushGruppe(rows, grp, expandedIds, 1)
  } else if (hasPlt) {
    for (const plt of kat.sales_plattformen) pushPlattform(rows, plt, kat.id, expandedIds, 1)
  } else if (hasPrd) {
    pushDirektProdukte(rows, kat.produkte, kat.id, expandedIds, 1)
  }
}

function buildFlatRows(data: ReportingLiquiditaetData, expandedIds: Set<string>): LiqFlatRow[] {
  const rows: LiqFlatRow[] = []

  rows.push({ id: 'header-einnahmen', label: 'Einnahmen', indent: 0, kind: 'section-header', values: {}, expandable: false, expanded: false })
  for (const kat of data.einnahmen_kategorien) pushKategorie(rows, kat, expandedIds)
  rows.push({ id: 'summe-einnahmen', label: 'Gesamt Einnahmen', indent: 0, kind: 'summe', values: data.gesamt_einnahmen, expandable: false, expanded: false })

  rows.push({ id: 'header-ausgaben', label: 'Ausgaben', indent: 0, kind: 'section-header', values: {}, expandable: false, expanded: false })
  for (const kat of data.ausgaben_kategorien) pushKategorie(rows, kat, expandedIds)
  rows.push({ id: 'summe-ausgaben', label: 'Gesamt Ausgaben', indent: 0, kind: 'summe', values: data.gesamt_ausgaben, expandable: false, expanded: false })

  rows.push({ id: 'cashflow', label: 'Cashflow der Periode', indent: 0, kind: 'cashflow', values: data.cashflow, expandable: false, expanded: false })
  rows.push({ id: 'kontostand', label: 'Kontostand', indent: 0, kind: 'kontostand', values: data.kontostand, expandable: false, expanded: false })

  return rows
}

function collectAllExpandableIds(data: ReportingLiquiditaetData): Set<string> {
  const ids = new Set<string>()

  function addPlattformen(plts: LiquiditaetPlattform[], parentId: string) {
    for (const plt of plts) {
      if (plt.produkte.length > 0) ids.add(pltRowId(parentId, plt.id))
    }
  }

  function addUntergruppe(ugr: LiquiditaetUntergruppe) {
    const hasPlt = ugr.sales_plattformen.length > 0
    const hasPrd = (ugr.produkte?.length ?? 0) > 0
    if (hasPlt || hasPrd) {
      ids.add(ugr.id)
      addPlattformen(ugr.sales_plattformen, ugr.id)
    }
  }

  function addGruppe(grp: LiquiditaetGruppe) {
    const hasUgr = grp.untergruppen.length > 0
    const hasPlt = grp.sales_plattformen.length > 0
    const hasPrd = (grp.produkte?.length ?? 0) > 0
    if (hasUgr || hasPlt || hasPrd) {
      ids.add(grp.id)
      for (const ugr of grp.untergruppen) addUntergruppe(ugr)
      addPlattformen(grp.sales_plattformen, grp.id)
    }
  }

  function addKategorie(kat: LiquiditaetKategorie) {
    const hasGruppen = kat.gruppen.length > 0
    const hasPlt = kat.sales_plattformen.length > 0
    const hasPrd = (kat.produkte?.length ?? 0) > 0
    if (hasGruppen || hasPlt || hasPrd) {
      ids.add(kat.id)
      for (const grp of kat.gruppen) addGruppe(grp)
      addPlattformen(kat.sales_plattformen, kat.id)
    }
  }

  for (const kat of data.einnahmen_kategorien) addKategorie(kat)
  for (const kat of data.ausgaben_kategorien)  addKategorie(kat)

  return ids
}

// ─── Styling ──────────────────────────────────────────────────────────────────

function rowBgClass(kind: LiqRowKind): string {
  if (kind === 'section-header') return 'bg-muted/60'
  if (kind === 'summe') return 'bg-muted'
  if (kind === 'cashflow') return 'bg-muted'
  if (kind === 'kontostand') return 'bg-slate-100 dark:bg-slate-900'
  return ''
}

function stickyBgClass(kind: LiqRowKind): string {
  if (kind === 'section-header') return 'bg-muted/60'
  if (kind === 'summe') return 'bg-muted'
  if (kind === 'cashflow') return 'bg-muted'
  if (kind === 'kontostand') return 'bg-slate-100 dark:bg-slate-900'
  return 'bg-background'
}

// ─── Hauptkomponente ──────────────────────────────────────────────────────────

interface Props {
  data: ReportingLiquiditaetData | null
  loading: boolean
  hasDateRange: boolean
}

export function ReportingLiquiditaetMatrix({ data, loading, hasDateRange }: Props) {
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set())

  const allExpandableIds = useMemo(
    () => (data ? collectAllExpandableIds(data) : new Set<string>()),
    [data],
  )

  const allExpanded = allExpandableIds.size > 0 && [...allExpandableIds].every(id => expandedIds.has(id))

  const rows = useMemo(
    () => (data ? buildFlatRows(data, expandedIds) : []),
    [data, expandedIds],
  )

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

  // ── Leerzustände ──────────────────────────────────────────────────────────

  if (!hasDateRange) {
    return (
      <div className="flex flex-col items-center gap-3 rounded-lg border border-dashed py-16 text-center text-muted-foreground">
        <BarChart2 className="h-8 w-8" />
        <p className="text-sm">Bitte Zeitraum auswählen, um den Report zu laden.</p>
      </div>
    )
  }

  if (loading) {
    return (
      <div className="space-y-2">
        {Array.from({ length: 8 }).map((_, i) => (
          <Skeleton key={i} className="h-9 w-full" />
        ))}
      </div>
    )
  }

  if (!data) return null

  const noCategories =
    data.einnahmen_kategorien.length === 0 && data.ausgaben_kategorien.length === 0

  if (noCategories) {
    return (
      <div className="flex flex-col items-center gap-3 rounded-lg border border-dashed py-16 text-center text-muted-foreground">
        <BarChart2 className="h-8 w-8" />
        <div>
          <p className="text-sm font-medium">Noch keine Kategorien im KPI-Modell konfiguriert</p>
          <p className="text-xs mt-1 max-w-xs mx-auto">
            Bitte im KPI-Modell Einnahmen- und Ausgaben-Kategorien anlegen.
          </p>
        </div>
        <a href="/dashboard/kpi-modell">
          <Button variant="outline" size="sm" className="mt-1">
            Zum KPI-Modell
          </Button>
        </a>
      </div>
    )
  }

  const perioden = data.perioden

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
              : <ChevronsUpDown className="h-3.5 w-3.5" />
            }
            {allExpanded ? 'Alle einklappen' : 'Alle ausklappen'}
          </Button>
        </div>
      )}

      {/* Matrix */}
      <div className="overflow-x-auto rounded-md border">
        <table className="w-full text-sm border-collapse">
          <thead>
            <tr className="border-b bg-muted/40">
              <th className="sticky left-0 z-20 bg-muted/40 min-w-[260px] max-w-[340px] px-3 py-2.5 text-left font-medium text-muted-foreground">
                Bezeichnung
              </th>
              {perioden.map(p => (
                <th
                  key={p}
                  className="min-w-[130px] px-3 py-2.5 text-right font-medium text-muted-foreground whitespace-nowrap"
                >
                  {formatPeriode(p)}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, idx) => {
              const isSectionHeader = row.kind === 'section-header'
              const isSumme     = row.kind === 'summe'
              const isCashflow  = row.kind === 'cashflow'
              const isKontostand = row.kind === 'kontostand'
              const isProdukt   = row.kind === 'produkt'
              const isBold = isSumme || isCashflow || isKontostand || isSectionHeader
              const hasBorderTop = isSumme || isCashflow || isKontostand

              return (
                <tr
                  key={`${row.id}-${idx}`}
                  className={[
                    'border-b last:border-b-0',
                    hasBorderTop ? 'border-t-2 border-t-border' : '',
                    !isSectionHeader ? 'hover:bg-muted/20' : '',
                    rowBgClass(row.kind),
                  ].filter(Boolean).join(' ')}
                >
                  {/* Bezeichnung — sticky */}
                  <td
                    className={[
                      'sticky left-0 z-10 px-3 py-2',
                      stickyBgClass(row.kind),
                    ].join(' ')}
                  >
                    <div
                      className="flex items-center gap-1"
                      style={{ paddingLeft: `${row.indent * 1.25}rem` }}
                    >
                      {row.expandable ? (
                        <button
                          onClick={() => toggleRow(row.id)}
                          className="flex-shrink-0 text-muted-foreground hover:text-foreground transition-colors"
                          aria-label={row.expanded ? 'Einklappen' : 'Ausklappen'}
                        >
                          {row.expanded
                            ? <ChevronDown className="h-3.5 w-3.5" />
                            : <ChevronRight className="h-3.5 w-3.5" />
                          }
                        </button>
                      ) : (
                        <span className="h-3.5 w-3.5 flex-shrink-0" />
                      )}
                      <span className={[
                        isBold ? 'font-semibold' : '',
                        isSectionHeader ? 'text-xs uppercase tracking-wide text-muted-foreground' : '',
                        isKontostand ? 'text-base' : '',
                        isProdukt ? 'text-xs text-muted-foreground' : '',
                        row.kind === 'untergruppe' || row.kind === 'plattform' ? 'text-sm' : '',
                      ].filter(Boolean).join(' ')}>
                        {row.label}
                      </span>
                    </div>
                  </td>

                  {/* Wert-Zellen */}
                  {isSectionHeader
                    ? perioden.map(p => <td key={p} className="px-3 py-2" />)
                    : perioden.map(p => {
                        const value = row.values[p] ?? 0
                        return (
                          <td
                            key={p}
                            className={[
                              'px-3 py-2 text-right tabular-nums whitespace-nowrap',
                              isBold ? 'font-semibold' : '',
                              isKontostand ? 'text-base' : '',
                              isProdukt ? 'text-xs' : '',
                              valueColorClass(value),
                            ].filter(Boolean).join(' ')}
                          >
                            {formatBetrag(value)}
                          </td>
                        )
                      })
                  }
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}
