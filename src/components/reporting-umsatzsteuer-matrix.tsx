'use client'

import { useState, useMemo } from 'react'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { Receipt, ChevronRight, ChevronDown, ChevronsDownUp, ChevronsUpDown } from 'lucide-react'
import type {
  ReportingUmsatzsteuerData,
  UstKategorie,
  UstGruppe,
  UstUntergruppe,
  VorsteuerKategorie,
  VorsteuerGruppe,
} from '@/hooks/use-reporting-umsatzsteuer'

// ─── Formatierung ─────────────────────────────────────────────────────────────

function formatBetrag(value: number): string {
  return new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR' }).format(value)
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

// ─── Flat Rows ────────────────────────────────────────────────────────────────

type RowKind =
  | 'ust-kat' | 'ust-grp' | 'ust-ugr' | 'ust-prd' | 'ust-summe'
  | 'vs-kat'  | 'vs-grp'  | 'vs-ugr'  | 'vs-summe'
  | 'ergebnis'

interface FlatRow {
  id: string
  label: string
  indent: number
  kind: RowKind
  values: Record<string, number>
  expandable: boolean
  expanded: boolean
}

function pushUstUntergruppe(
  rows: FlatRow[],
  ugr: UstUntergruppe,
  grpId: string,
  expandedIds: Set<string>,
) {
  const rowId = `ust-ugr:${grpId}:${ugr.id}`
  const expandable = ugr.produkte.length > 0
  rows.push({ id: rowId, label: ugr.name, indent: 2, kind: 'ust-ugr', values: ugr.values, expandable, expanded: expandedIds.has(rowId) })
  if (!expandable || !expandedIds.has(rowId)) return
  for (const prd of ugr.produkte) {
    rows.push({
      id: `ust-prd:${rowId}:${prd.id}`,
      label: `${prd.name} (${prd.ust_satz} %)`,
      indent: 3,
      kind: 'ust-prd',
      values: prd.values,
      expandable: false,
      expanded: false,
    })
  }
}

function pushUstGruppe(
  rows: FlatRow[],
  grp: UstGruppe,
  katId: string,
  expandedIds: Set<string>,
) {
  const rowId = `ust-grp:${katId}:${grp.id}`
  const expandable = grp.untergruppen.length > 0 || grp.produkte.length > 0
  rows.push({ id: rowId, label: grp.name, indent: 1, kind: 'ust-grp', values: grp.values, expandable, expanded: expandedIds.has(rowId) })
  if (!expandable || !expandedIds.has(rowId)) return
  if (grp.untergruppen.length > 0) {
    for (const ugr of grp.untergruppen) pushUstUntergruppe(rows, ugr, grp.id, expandedIds)
  } else {
    for (const prd of grp.produkte) {
      rows.push({
        id: `ust-prd:${rowId}:${prd.id}`,
        label: `${prd.name} (${prd.ust_satz} %)`,
        indent: 2,
        kind: 'ust-prd',
        values: prd.values,
        expandable: false,
        expanded: false,
      })
    }
  }
}

function pushUstKategorie(
  rows: FlatRow[],
  kat: UstKategorie,
  expandedIds: Set<string>,
) {
  const rowId = `ust-kat:${kat.id}`
  const expandable = kat.gruppen.length > 0 || kat.produkte.length > 0
  rows.push({ id: rowId, label: kat.name, indent: 0, kind: 'ust-kat', values: kat.values, expandable, expanded: expandedIds.has(rowId) })
  if (!expandable || !expandedIds.has(rowId)) return
  if (kat.gruppen.length > 0) {
    for (const grp of kat.gruppen) pushUstGruppe(rows, grp, kat.id, expandedIds)
  } else {
    for (const prd of kat.produkte) {
      rows.push({
        id: `ust-prd:${rowId}:${prd.id}`,
        label: `${prd.name} (${prd.ust_satz} %)`,
        indent: 1,
        kind: 'ust-prd',
        values: prd.values,
        expandable: false,
        expanded: false,
      })
    }
  }
}

function pushVsGruppe(
  rows: FlatRow[],
  grp: VorsteuerGruppe,
  katId: string,
  expandedIds: Set<string>,
) {
  const rowId = `vs-grp:${katId}:${grp.id}`
  const expandable = grp.untergruppen.length > 0
  rows.push({ id: rowId, label: grp.name, indent: 1, kind: 'vs-grp', values: grp.values, expandable, expanded: expandedIds.has(rowId) })
  if (!expandable || !expandedIds.has(rowId)) return
  for (const ugr of grp.untergruppen) {
    rows.push({
      id: `vs-ugr:${grp.id}:${ugr.id}`,
      label: ugr.name,
      indent: 2,
      kind: 'vs-ugr',
      values: ugr.values,
      expandable: false,
      expanded: false,
    })
  }
}

function pushVsKategorie(
  rows: FlatRow[],
  kat: VorsteuerKategorie,
  expandedIds: Set<string>,
) {
  const rowId = `vs-kat:${kat.id}`
  const expandable = kat.gruppen.length > 0
  rows.push({ id: rowId, label: kat.name, indent: 0, kind: 'vs-kat', values: kat.values, expandable, expanded: expandedIds.has(rowId) })
  if (!expandable || !expandedIds.has(rowId)) return
  for (const grp of kat.gruppen) pushVsGruppe(rows, grp, kat.id, expandedIds)
}

function buildFlatRows(data: ReportingUmsatzsteuerData, expandedIds: Set<string>): FlatRow[] {
  const rows: FlatRow[] = []

  for (const kat of data.abzufuehrendeUst.kategorien) {
    pushUstKategorie(rows, kat, expandedIds)
  }
  rows.push({
    id: 'ust-summe',
    label: 'Abzuführende Umsatzsteuer',
    indent: 0,
    kind: 'ust-summe',
    values: data.abzufuehrendeUst.summe,
    expandable: false,
    expanded: false,
  })

  for (const kat of data.abziehbareVorsteuer.kategorien) {
    pushVsKategorie(rows, kat, expandedIds)
  }
  rows.push({
    id: 'vs-summe',
    label: 'Abziehbare Vorsteuer',
    indent: 0,
    kind: 'vs-summe',
    values: data.abziehbareVorsteuer.summe,
    expandable: false,
    expanded: false,
  })

  rows.push({
    id: 'ergebnis',
    label: '= Fällige Umsatzsteuer',
    indent: 0,
    kind: 'ergebnis',
    values: data.faelligeUst,
    expandable: false,
    expanded: false,
  })

  return rows
}

function collectAllExpandableIds(data: ReportingUmsatzsteuerData): Set<string> {
  const ids = new Set<string>()

  for (const kat of data.abzufuehrendeUst.kategorien) {
    const katExpandable = kat.gruppen.length > 0 || kat.produkte.length > 0
    if (!katExpandable) continue
    ids.add(`ust-kat:${kat.id}`)
    for (const grp of kat.gruppen) {
      const grpExpandable = grp.untergruppen.length > 0 || grp.produkte.length > 0
      if (!grpExpandable) continue
      ids.add(`ust-grp:${kat.id}:${grp.id}`)
      for (const ugr of grp.untergruppen) {
        if (ugr.produkte.length > 0) ids.add(`ust-ugr:${grp.id}:${ugr.id}`)
      }
    }
  }

  for (const kat of data.abziehbareVorsteuer.kategorien) {
    if (kat.gruppen.length === 0) continue
    ids.add(`vs-kat:${kat.id}`)
    for (const grp of kat.gruppen) {
      if (grp.untergruppen.length > 0) ids.add(`vs-grp:${kat.id}:${grp.id}`)
    }
  }

  return ids
}

// ─── Styling ──────────────────────────────────────────────────────────────────

function rowBgClass(kind: RowKind): string {
  if (kind === 'ust-summe' || kind === 'vs-summe') return 'bg-muted'
  if (kind === 'ergebnis') return 'bg-muted'
  return ''
}

function stickyBgClass(kind: RowKind): string {
  if (kind === 'ust-summe' || kind === 'vs-summe') return 'bg-muted'
  if (kind === 'ergebnis') return 'bg-muted'
  return 'bg-background'
}

function isSummaryRow(kind: RowKind): boolean {
  return kind === 'ust-summe' || kind === 'vs-summe' || kind === 'ergebnis'
}

function ergebnisColorClass(value: number): string {
  if (value > 0) return 'text-foreground'
  if (value < 0) return 'text-red-600 dark:text-red-400'
  return 'text-muted-foreground'
}

// ─── Hauptkomponente ──────────────────────────────────────────────────────────

interface Props {
  data: ReportingUmsatzsteuerData | null
  loading: boolean
  hasDateRange: boolean
}

export function ReportingUmsatzsteuerMatrix({ data, loading, hasDateRange }: Props) {
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
        <Receipt className="h-8 w-8" />
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

  if (data.abzufuehrendeUst.kategorien.length === 0 && data.abziehbareVorsteuer.kategorien.length === 0) {
    return (
      <div className="flex flex-col items-center gap-3 rounded-lg border border-dashed py-16 text-center text-muted-foreground">
        <Receipt className="h-8 w-8" />
        <div>
          <p className="text-sm font-medium">Keine Umsatzsteuer-Daten vorhanden</p>
          <p className="text-xs mt-1 max-w-xs mx-auto">
            Bitte im KPI-Modell Umsatz-Kategorien anlegen und Produkte mit USt-Satz versehen.
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
                  className="min-w-[140px] px-3 py-2.5 text-right font-medium text-muted-foreground whitespace-nowrap"
                >
                  {formatPeriode(p)}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, idx) => {
              const isSummary = isSummaryRow(row.kind)
              const isErgebnis = row.kind === 'ergebnis'
              const isLeaf = row.kind === 'ust-prd'

              return (
                <tr
                  key={`${row.id}-${idx}`}
                  className={[
                    'border-b last:border-b-0',
                    isSummary
                      ? `${rowBgClass(row.kind)} border-t-2 border-t-border`
                      : 'hover:bg-muted/20',
                    isErgebnis ? 'border-b-2' : '',
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
                        isSummary ? 'font-semibold' : '',
                        isErgebnis ? 'font-bold' : '',
                        isLeaf ? 'text-muted-foreground text-xs' : '',
                        row.kind === 'ust-ugr' || row.kind === 'vs-ugr' ? 'text-sm' : '',
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
                          isSummary ? 'font-semibold' : '',
                          isErgebnis ? 'font-bold' : '',
                          isLeaf ? 'text-xs' : '',
                          isErgebnis ? ergebnisColorClass(value) : 'text-foreground',
                          !isErgebnis && value === 0 ? 'text-muted-foreground' : '',
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
