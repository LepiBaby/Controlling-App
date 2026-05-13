'use client'

import { useState, useMemo } from 'react'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { BarChart2, ChevronRight, ChevronDown, ChevronsDownUp, ChevronsUpDown } from 'lucide-react'
import type {
  ReportingRentabilitaetData,
  ReportKategorie,
  ReportGruppe,
  ReportUntergruppe,
  ReportPlattform,
  ReportProdukt,
} from '@/hooks/use-reporting-rentabilitaet'

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

// ─── Flache Zeilen ────────────────────────────────────────────────────────────

type RowKind = 'position' | 'summe' | 'kategorie' | 'gruppe' | 'untergruppe' | 'plattform' | 'produkt'

interface FlatRow {
  id: string
  label: string
  indent: number
  kind: RowKind
  kpiType?: 'umsatz' | 'ausgaben_kosten'
  values: Record<string, number>
  expandable: boolean
  expanded: boolean
}

// Plattform-Zeile-ID ist kontextabhängig um Konflikte zu vermeiden
function pltRowId(parentId: string, pltId: string) {
  return `plt:${parentId}:${pltId}`
}

function pushPlattform(
  rows: FlatRow[],
  plt: ReportPlattform,
  parentId: string,
  expandedIds: Set<string>,
  indent: number,
) {
  const rowId = pltRowId(parentId, plt.id)
  const expandable = plt.produkte.length > 0
  rows.push({
    id: rowId,
    label: plt.name,
    indent,
    kind: 'plattform',
    values: plt.values,
    expandable,
    expanded: expandedIds.has(rowId),
  })
  if (!expandable || !expandedIds.has(rowId)) return
  for (const prd of plt.produkte) {
    rows.push({
      id: `prd:${rowId}:${prd.id}`,
      label: prd.name,
      indent: indent + 1,
      kind: 'produkt',
      values: prd.values,
      expandable: false,
      expanded: false,
    })
  }
}

function pushUntergruppe(
  rows: FlatRow[],
  ugr: ReportUntergruppe,
  expandedIds: Set<string>,
  indent: number,
) {
  const expandable = ugr.sales_plattformen.length > 0
  rows.push({
    id: ugr.id,
    label: ugr.name,
    indent,
    kind: 'untergruppe',
    values: ugr.values,
    expandable,
    expanded: expandedIds.has(ugr.id),
  })
  if (!expandable || !expandedIds.has(ugr.id)) return
  for (const plt of ugr.sales_plattformen) {
    pushPlattform(rows, plt, ugr.id, expandedIds, indent + 1)
  }
}

function pushGruppe(
  rows: FlatRow[],
  grp: ReportGruppe,
  expandedIds: Set<string>,
  indent: number,
) {
  const expandable = grp.untergruppen.length > 0 || grp.sales_plattformen.length > 0
  rows.push({
    id: grp.id,
    label: grp.name,
    indent,
    kind: 'gruppe',
    values: grp.values,
    expandable,
    expanded: expandedIds.has(grp.id),
  })
  if (!expandable || !expandedIds.has(grp.id)) return
  if (grp.untergruppen.length > 0) {
    for (const ugr of grp.untergruppen) pushUntergruppe(rows, ugr, expandedIds, indent + 1)
  } else {
    for (const plt of grp.sales_plattformen) pushPlattform(rows, plt, grp.id, expandedIds, indent + 1)
  }
}

function pushProdukt(
  rows: FlatRow[],
  prd: ReportProdukt,
  expandedIds: Set<string>,
  indent: number,
) {
  const rowId = `bprd:${prd.id}`
  const expandable = prd.plattformen.length > 0
  rows.push({
    id: rowId,
    label: prd.name,
    indent,
    kind: 'produkt',
    values: prd.values,
    expandable,
    expanded: expandedIds.has(rowId),
  })
  if (!expandable || !expandedIds.has(rowId)) return
  for (const plt of prd.plattformen) {
    rows.push({
      id: `bplt:${prd.id}:${plt.id}`,
      label: plt.name,
      indent: indent + 1,
      kind: 'plattform',
      values: plt.values,
      expandable: false,
      expanded: false,
    })
  }
}

function pushKategorie(
  rows: FlatRow[],
  kat: ReportKategorie,
  expandedIds: Set<string>,
  indent: number,
) {
  const expandable = kat.gruppen.length > 0 || kat.sales_plattformen.length > 0 || kat.produkte.length > 0
  rows.push({
    id: kat.id,
    label: kat.name,
    indent,
    kind: 'kategorie',
    kpiType: kat.kpi_type,
    values: kat.values,
    expandable,
    expanded: expandedIds.has(kat.id),
  })
  if (!expandable || !expandedIds.has(kat.id)) return
  if (kat.gruppen.length > 0) {
    for (const grp of kat.gruppen) pushGruppe(rows, grp, expandedIds, indent + 1)
  } else {
    for (const plt of kat.sales_plattformen) pushPlattform(rows, plt, kat.id, expandedIds, indent + 1)
  }
  for (const prd of kat.produkte) pushProdukt(rows, prd, expandedIds, indent + 1)
}

function isPositionExpandable(pos: ReportingRentabilitaetData['positionen'][number]): boolean {
  if (pos.type !== 'position' || pos.kategorien.length === 0) return false
  if (pos.kategorien.length > 1) return true
  const kat = pos.kategorien[0]
  return kat.gruppen.length > 0 || kat.sales_plattformen.length > 0 || kat.produkte.length > 0
}

function buildFlatRows(data: ReportingRentabilitaetData, expandedIds: Set<string>): FlatRow[] {
  const rows: FlatRow[] = []

  for (const pos of data.positionen) {
    const expandable = isPositionExpandable(pos)
    rows.push({
      id: pos.id,
      label: pos.name,
      indent: 0,
      kind: pos.type,
      values: pos.values,
      expandable,
      expanded: expandedIds.has(pos.id),
    })

    if (!expandable || !expandedIds.has(pos.id)) continue

    if (pos.kategorien.length === 1) {
      // Kategorie-Zeile überspringen — Gruppen/Plattformen/Produkte direkt unter Position
      const kat = pos.kategorien[0]
      if (kat.gruppen.length > 0) {
        for (const grp of kat.gruppen) pushGruppe(rows, grp, expandedIds, 1)
      } else {
        for (const plt of kat.sales_plattformen) pushPlattform(rows, plt, kat.id, expandedIds, 1)
      }
      for (const prd of kat.produkte) pushProdukt(rows, prd, expandedIds, 1)
    } else {
      // Mehrere Kategorien → Kategorie-Zeile zeigen für Unterscheidung
      for (const kat of pos.kategorien) pushKategorie(rows, kat, expandedIds, 1)
    }
  }

  return rows
}

function collectAllExpandableIds(data: ReportingRentabilitaetData): Set<string> {
  const ids = new Set<string>()

  function addPlattformen(plts: ReportPlattform[], parentId: string) {
    for (const plt of plts) {
      if (plt.produkte.length > 0) ids.add(pltRowId(parentId, plt.id))
    }
  }

  function addUntergruppe(ugr: ReportUntergruppe) {
    if (ugr.sales_plattformen.length > 0) {
      ids.add(ugr.id)
      addPlattformen(ugr.sales_plattformen, ugr.id)
    }
  }

  function addGruppe(grp: ReportGruppe) {
    if (grp.untergruppen.length > 0 || grp.sales_plattformen.length > 0) {
      ids.add(grp.id)
      for (const ugr of grp.untergruppen) addUntergruppe(ugr)
      addPlattformen(grp.sales_plattformen, grp.id)
    }
  }

  function addKategorie(kat: ReportKategorie) {
    if (kat.gruppen.length > 0 || kat.sales_plattformen.length > 0 || kat.produkte.length > 0) {
      ids.add(kat.id)
      for (const grp of kat.gruppen) addGruppe(grp)
      addPlattformen(kat.sales_plattformen, kat.id)
      for (const prd of kat.produkte) {
        if (prd.plattformen.length > 0) ids.add(`bprd:${prd.id}`)
      }
    }
  }

  for (const pos of data.positionen) {
    if (!isPositionExpandable(pos)) continue
    ids.add(pos.id)
    if (pos.kategorien.length === 1) {
      const kat = pos.kategorien[0]
      for (const grp of kat.gruppen) addGruppe(grp)
      addPlattformen(kat.sales_plattformen, kat.id)
      for (const prd of kat.produkte) {
        if (prd.plattformen.length > 0) ids.add(`bprd:${prd.id}`)
      }
    } else {
      for (const kat of pos.kategorien) addKategorie(kat)
    }
  }

  return ids
}

// ─── Zeilenstyling ────────────────────────────────────────────────────────────

function rowBgClass(kind: RowKind): string {
  if (kind === 'summe') return 'bg-muted'
  return ''
}

function stickyBgClass(kind: RowKind): string {
  if (kind === 'summe') return 'bg-muted'
  return 'bg-background'
}

// ─── Hauptkomponente ──────────────────────────────────────────────────────────

interface Props {
  data: ReportingRentabilitaetData | null
  loading: boolean
  hasDateRange: boolean
}

export function ReportingRentabilitaetMatrix({ data, loading, hasDateRange }: Props) {
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

  if (data.positionen.length === 0) {
    return (
      <div className="flex flex-col items-center gap-3 rounded-lg border border-dashed py-16 text-center text-muted-foreground">
        <BarChart2 className="h-8 w-8" />
        <div>
          <p className="text-sm font-medium">Noch kein Reporting-Modell konfiguriert</p>
          <p className="text-xs mt-1 max-w-xs mx-auto">
            Bitte im KPI-Modell → Tab „Reporting-Modell" Positionen anlegen.
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
              const isSumme = row.kind === 'summe'
              const isLeaf = row.kind === 'produkt'
              return (
                <tr
                  key={`${row.id}-${idx}`}
                  className={[
                    'border-b last:border-b-0',
                    isSumme ? `${rowBgClass(row.kind)} border-t-2 border-t-border` : 'hover:bg-muted/20',
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
                        isSumme ? 'font-semibold' : '',
                        isLeaf ? 'text-muted-foreground text-xs' : '',
                        row.kind === 'untergruppe' || row.kind === 'plattform' ? 'text-sm' : '',
                      ].filter(Boolean).join(' ')}>
                        {row.label}
                      </span>
                    </div>
                  </td>

                  {/* Wert-Zellen */}
                  {perioden.map(p => {
                    const value = row.values[p] ?? 0
                    return (
                      <td
                        key={p}
                        className={[
                          'px-3 py-2 text-right tabular-nums whitespace-nowrap',
                          isSumme ? 'font-semibold' : '',
                          isLeaf ? 'text-xs' : '',
                          valueColorClass(value),
                        ].filter(Boolean).join(' ')}
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
  )
}
