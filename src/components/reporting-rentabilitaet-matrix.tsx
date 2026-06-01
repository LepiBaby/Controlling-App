'use client'

import { useState, useMemo, useRef, useEffect, type RefObject } from 'react'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { BarChart2, ChevronRight, ChevronDown, ChevronsDownUp, ChevronsUpDown } from 'lucide-react'
import type {
  ReportingRentabilitaetData,
  ReportKategorie,
  ReportGruppe,
  ReportUntergruppe,
  ReportPlattform,
  ReportAnzeigemodus,
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

export function formatProzentWert(value: number, basis: number): string {
  if (basis === 0) return '—'
  const pct = (value / basis) * 100
  return `${pct.toLocaleString('de-DE', { minimumFractionDigits: 1, maximumFractionDigits: 1 })} %`
}

export type WachstumsWert = number | 'n/a' | null

export function calcWachstum(value: number, vorwert: number | undefined): WachstumsWert {
  if (vorwert === undefined) return null
  if (vorwert === 0 && value === 0) return 0
  if (vorwert === 0) return 'n/a'
  return ((value - vorwert) / Math.abs(vorwert)) * 100
}

export function formatWachstum(w: WachstumsWert): string {
  if (w === null) return '—'
  if (w === 'n/a') return 'n/a'
  if (w === 0) return '0,0 %'
  const abs = Math.abs(w)
  const str = abs.toLocaleString('de-DE', { minimumFractionDigits: 1, maximumFractionDigits: 1 })
  return w > 0 ? `+${str} % ↑` : `−${str} % ↓`
}

export function wachstumColorClass(w: WachstumsWert): string {
  if (w === null || w === 'n/a' || w === 0) return 'text-muted-foreground'
  if (typeof w === 'number' && w > 0) return 'text-green-700 dark:text-green-500'
  return 'text-red-600 dark:text-red-400'
}

// ─── Flache Zeilen ────────────────────────────────────────────────────────────

type RowKind = 'position' | 'summe' | 'umsatzsteuer' | 'kategorie' | 'gruppe' | 'untergruppe' | 'plattform' | 'produkt'

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
  const hasPi  = (ugr.produkte_pi?.length ?? 0) > 0
  const hasPrd = (ugr.produkte?.length ?? 0) > 0
  const expandable = ugr.sales_plattformen.length > 0 || hasPi || hasPrd
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
  if (ugr.sales_plattformen.length > 0) {
    for (const plt of ugr.sales_plattformen) {
      pushPlattform(rows, plt, ugr.id, expandedIds, indent + 1)
    }
  } else if (hasPi) {
    for (const prd of ugr.produkte_pi!) {
      rows.push({
        id: `piprd:${ugr.id}:${prd.id}`,
        label: prd.name,
        indent: indent + 1,
        kind: 'produkt',
        values: prd.values,
        expandable: false,
        expanded: false,
      })
    }
  } else if (hasPrd) {
    for (const prd of ugr.produkte!) {
      rows.push({
        id: `prd:${ugr.id}:${prd.id}`,
        label: prd.name,
        indent: indent + 1,
        kind: 'produkt',
        values: prd.values,
        expandable: false,
        expanded: false,
      })
    }
  }
}

function pushGruppe(
  rows: FlatRow[],
  grp: ReportGruppe,
  expandedIds: Set<string>,
  indent: number,
) {
  const hasWv  = (grp.produkte_wertverlust?.length ?? 0) > 0
  const hasMs  = (grp.produkte_manuelle_sendungen?.length ?? 0) > 0
  const hasPi  = (grp.produkte_pi?.length ?? 0) > 0
  const hasPrd = (grp.produkte?.length ?? 0) > 0
  const expandable = grp.untergruppen.length > 0 || grp.sales_plattformen.length > 0 || hasWv || hasMs || hasPi || hasPrd
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
  } else if (grp.sales_plattformen.length > 0) {
    for (const plt of grp.sales_plattformen) pushPlattform(rows, plt, grp.id, expandedIds, indent + 1)
  } else if (hasWv) {
    for (const prd of grp.produkte_wertverlust!) {
      rows.push({
        id: `wvprd:${grp.id}:${prd.id}`,
        label: prd.name,
        indent: indent + 1,
        kind: 'produkt',
        values: prd.values,
        expandable: false,
        expanded: false,
      })
    }
  } else if (hasMs) {
    for (const prd of grp.produkte_manuelle_sendungen!) {
      rows.push({
        id: `msprd:${grp.id}:${prd.id}`,
        label: prd.name,
        indent: indent + 1,
        kind: 'produkt',
        values: prd.values,
        expandable: false,
        expanded: false,
      })
    }
  } else if (hasPi) {
    for (const prd of grp.produkte_pi!) {
      rows.push({
        id: `piprd:${grp.id}:${prd.id}`,
        label: prd.name,
        indent: indent + 1,
        kind: 'produkt',
        values: prd.values,
        expandable: false,
        expanded: false,
      })
    }
  } else if (hasPrd) {
    for (const prd of grp.produkte!) {
      rows.push({
        id: `prd:${grp.id}:${prd.id}`,
        label: prd.name,
        indent: indent + 1,
        kind: 'produkt',
        values: prd.values,
        expandable: false,
        expanded: false,
      })
    }
  }
}

function pushKategorie(
  rows: FlatRow[],
  kat: ReportKategorie,
  expandedIds: Set<string>,
  indent: number,
) {
  const hasWv = (kat.produkte_wertverlust?.length ?? 0) > 0
  const hasMs = (kat.produkte_manuelle_sendungen?.length ?? 0) > 0
  const expandable = kat.gruppen.length > 0 || kat.sales_plattformen.length > 0 || hasWv || hasMs
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
  } else if (kat.sales_plattformen.length > 0) {
    for (const plt of kat.sales_plattformen) pushPlattform(rows, plt, kat.id, expandedIds, indent + 1)
  } else if (hasWv) {
    for (const prd of kat.produkte_wertverlust!) {
      rows.push({
        id: `wvprd:${kat.id}:${prd.id}`,
        label: prd.name,
        indent: indent + 1,
        kind: 'produkt',
        values: prd.values,
        expandable: false,
        expanded: false,
      })
    }
  } else if (hasMs) {
    for (const prd of kat.produkte_manuelle_sendungen!) {
      rows.push({
        id: `msprd:${kat.id}:${prd.id}`,
        label: prd.name,
        indent: indent + 1,
        kind: 'produkt',
        values: prd.values,
        expandable: false,
        expanded: false,
      })
    }
  }
}

function isPositionExpandable(pos: ReportingRentabilitaetData['positionen'][number]): boolean {
  if (pos.type === 'umsatzsteuer') return (pos.ust_produkte?.length ?? 0) > 0
  if (pos.type !== 'position' || pos.kategorien.length === 0) return false
  if (pos.kategorien.length > 1) return true
  const kat = pos.kategorien[0]
  return kat.gruppen.length > 0 || kat.sales_plattformen.length > 0 ||
    (kat.produkte_wertverlust?.length ?? 0) > 0 ||
    (kat.produkte_manuelle_sendungen?.length ?? 0) > 0
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

    // umsatzsteuer: flat product list
    if (pos.type === 'umsatzsteuer') {
      for (const prd of (pos.ust_produkte ?? [])) {
        rows.push({
          id: `ust:${pos.id}:${prd.id}`,
          label: `${prd.name} (${prd.ust_satz} %)`,
          indent: 1,
          kind: 'produkt',
          values: prd.values,
          expandable: false,
          expanded: false,
        })
      }
      continue
    }

    if (pos.kategorien.length === 1) {
      // Kategorie-Zeile überspringen — Gruppen/Plattformen/WV-Produkte direkt unter Position
      const kat = pos.kategorien[0]
      if (kat.gruppen.length > 0) {
        for (const grp of kat.gruppen) pushGruppe(rows, grp, expandedIds, 1)
      } else if (kat.sales_plattformen.length > 0) {
        for (const plt of kat.sales_plattformen) pushPlattform(rows, plt, kat.id, expandedIds, 1)
      } else if ((kat.produkte_wertverlust?.length ?? 0) > 0) {
        for (const prd of kat.produkte_wertverlust!) {
          rows.push({
            id: `wvprd:${kat.id}:${prd.id}`,
            label: prd.name,
            indent: 1,
            kind: 'produkt',
            values: prd.values,
            expandable: false,
            expanded: false,
          })
        }
      } else if ((kat.produkte_manuelle_sendungen?.length ?? 0) > 0) {
        for (const prd of kat.produkte_manuelle_sendungen!) {
          rows.push({
            id: `msprd:${kat.id}:${prd.id}`,
            label: prd.name,
            indent: 1,
            kind: 'produkt',
            values: prd.values,
            expandable: false,
            expanded: false,
          })
        }
      }
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
    const hasPi = (ugr.produkte_pi?.length ?? 0) > 0
    if (ugr.sales_plattformen.length > 0 || hasPi) {
      ids.add(ugr.id)
      addPlattformen(ugr.sales_plattformen, ugr.id)
    }
  }

  function addGruppe(grp: ReportGruppe) {
    const hasWv = (grp.produkte_wertverlust?.length ?? 0) > 0
    const hasMs = (grp.produkte_manuelle_sendungen?.length ?? 0) > 0
    const hasPi = (grp.produkte_pi?.length ?? 0) > 0
    if (grp.untergruppen.length > 0 || grp.sales_plattformen.length > 0 || hasWv || hasMs || hasPi) {
      ids.add(grp.id)
      for (const ugr of grp.untergruppen) addUntergruppe(ugr)
      addPlattformen(grp.sales_plattformen, grp.id)
    }
  }

  function addKategorie(kat: ReportKategorie) {
    const hasWv = (kat.produkte_wertverlust?.length ?? 0) > 0
    const hasMs = (kat.produkte_manuelle_sendungen?.length ?? 0) > 0
    if (kat.gruppen.length > 0 || kat.sales_plattformen.length > 0 || hasWv || hasMs) {
      ids.add(kat.id)
      for (const grp of kat.gruppen) addGruppe(grp)
      addPlattformen(kat.sales_plattformen, kat.id)
    }
  }

  for (const pos of data.positionen) {
    if (!isPositionExpandable(pos)) continue
    ids.add(pos.id)
    if (pos.type === 'umsatzsteuer') continue
    if (pos.kategorien.length === 1) {
      const kat = pos.kategorien[0]
      for (const grp of kat.gruppen) addGruppe(grp)
      addPlattformen(kat.sales_plattformen, kat.id)
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

// ─── Ohne-Investitionen-Filter ────────────────────────────────────────────────

export function applyOhneInvestitionenFilter(data: ReportingRentabilitaetData): ReportingRentabilitaetData {
  const perioden = data.perioden

  // Step 1: Werte aller investitionsbezogenen regulären Positionen auf 0 setzen
  const modValues = new Map<string, Record<string, number>>()
  for (const pos of data.positionen) {
    if (pos.investitionsbezogen && pos.type === 'position') {
      const zeroed: Record<string, number> = {}
      for (const p of perioden) zeroed[p] = 0
      modValues.set(pos.id, zeroed)
    } else {
      modValues.set(pos.id, { ...pos.values })
    }
  }

  // Step 2: Summen-Positionen in sort_order neu berechnen (inkl. investitionsbezogene)
  for (const pos of data.positionen) {
    if (pos.type !== 'summe') continue
    if (!pos.summe_refs || pos.summe_refs.length === 0) continue
    const newValues: Record<string, number> = {}
    for (const p of perioden) {
      newValues[p] = pos.summe_refs.reduce((sum, refId) => sum + (modValues.get(refId)?.[p] ?? 0), 0)
    }
    modValues.set(pos.id, newValues)
  }

  // Step 3: Investitionsbezogene Positionen aus Anzeige entfernen; angepasste Werte verwenden
  const filteredPositionen = data.positionen
    .filter(pos => !pos.investitionsbezogen)
    .map(pos => ({ ...pos, values: modValues.get(pos.id) ?? pos.values }))

  return { ...data, positionen: filteredPositionen }
}

// ─── Hauptkomponente ──────────────────────────────────────────────────────────

interface Props {
  data: ReportingRentabilitaetData | null
  loading: boolean
  hasDateRange: boolean
  anzeigemodus: ReportAnzeigemodus
  displayPerioden: string[]
  ohneInvestitionen: boolean
  scrollContainerRef?: RefObject<HTMLDivElement | null>
}

export function ReportingRentabilitaetMatrix({
  data,
  loading,
  hasDateRange,
  anzeigemodus,
  displayPerioden,
  ohneInvestitionen,
  scrollContainerRef,
}: Props) {
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set())

  // Gefilterte Daten: bei aktivem Filter investitionsbezogene Positionen ausblenden und Summen neu berechnen
  const effectiveData = useMemo(() => {
    if (!data) return null
    if (!ohneInvestitionen) return data
    return applyOhneInvestitionenFilter(data)
  }, [data, ohneInvestitionen])

  const allExpandableIds = useMemo(
    () => (effectiveData ? collectAllExpandableIds(effectiveData) : new Set<string>()),
    [effectiveData],
  )

  const allExpanded = allExpandableIds.size > 0 && [...allExpandableIds].every(id => expandedIds.has(id))

  const rows = useMemo(
    () => (effectiveData ? buildFlatRows(effectiveData, expandedIds) : []),
    [effectiveData, expandedIds],
  )

  // Bruttoumsatz-Basis für Prozentual-Modus: Summe aller reinen Umsatz-Positionen
  const bruttoumsatzByPeriode = useMemo(() => {
    if (!effectiveData || anzeigemodus !== 'prozentual') return null
    const result: Record<string, number> = {}
    for (const pos of effectiveData.positionen) {
      if (pos.type !== 'position') continue
      if (!pos.kategorien.every(k => k.kpi_type === 'umsatz')) continue
      for (const p of effectiveData.perioden) {
        // Nur positive Beiträge zählen → Abzugsposten (z.B. Retouren) werden ausgeschlossen
        result[p] = (result[p] ?? 0) + Math.max(0, pos.values[p] ?? 0)
      }
    }
    return result
  }, [effectiveData, anzeigemodus])

  const allesBruttoumsatzNull = useMemo(() => {
    if (!bruttoumsatzByPeriode) return false
    return displayPerioden.every(p => (bruttoumsatzByPeriode[p] ?? 0) === 0)
  }, [bruttoumsatzByPeriode, displayPerioden])

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

  const [selectedCells, setSelectedCells] = useState<Map<string, number>>(new Map())
  const isDragging = useRef(false)
  const selSum = Array.from(selectedCells.values()).reduce((a, b) => a + b, 0)

  useEffect(() => {
    function onMouseDown(e: MouseEvent) {
      if (!(e.target as Element).closest('[data-betrag-selektion]')) {
        setSelectedCells(new Map())
      }
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
    setSelectedCells(prev => prev.has(key) ? prev : new Map([...prev, [key, value]]))
  }

  // Gibt den Vorperioden-Schlüssel für eine angezeigte Periode zurück
  function vorperiodOf(p: string): string | undefined {
    if (!effectiveData) return undefined
    const idx = effectiveData.perioden.indexOf(p)
    if (idx <= 0) return undefined
    return effectiveData.perioden[idx - 1]
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

  if (!effectiveData) return null

  if (effectiveData.positionen.length === 0) {
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

  const perioden = displayPerioden.length > 0 ? displayPerioden : effectiveData.perioden

  return (
    <>
    <div data-betrag-selektion="true" className="space-y-2">
      {/* Hinweis: kein Bruttoumsatz im Prozentual-Modus */}
      {anzeigemodus === 'prozentual' && allesBruttoumsatzNull && (
        <p className="text-sm text-muted-foreground rounded-md border border-dashed px-4 py-2">
          Kein Bruttoumsatz im gewählten Zeitraum — prozentuale Berechnung nicht möglich.
        </p>
      )}

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
      <div ref={scrollContainerRef} className="overflow-x-auto rounded-md border">
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
              const isBold = isSumme
              const isLeaf = row.kind === 'produkt'
              return (
                <tr
                  key={`${row.id}-${idx}`}
                  className={[
                    'border-b last:border-b-0',
                    isBold ? `${rowBgClass(row.kind)} border-t-2 border-t-border` : 'hover:bg-muted/20',
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
                    const cellKey = `${row.id}_${p}`
                    const isSelected = selectedCells.has(cellKey)
                    const selBg = isSelected
                      ? 'bg-blue-100 dark:bg-blue-900/40 cursor-pointer select-none'
                      : 'hover:bg-blue-50 dark:hover:bg-blue-950/20 cursor-pointer select-none'

                    if (anzeigemodus === 'prozentual') {
                      const basis = bruttoumsatzByPeriode?.[p] ?? 0
                      return (
                        <td
                          key={p}
                          className={[
                            'px-3 py-2 text-right tabular-nums whitespace-nowrap',
                            isBold ? 'font-semibold' : '',
                            isLeaf ? 'text-xs' : '',
                            selBg,
                          ].filter(Boolean).join(' ')}
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
                      const vp = vorperiodOf(p)
                      const vorwert = vp !== undefined ? (row.values[vp] ?? 0) : undefined
                      const wachstum = calcWachstum(value, vorwert)
                      return (
                        <td
                          key={p}
                          className={[
                            'px-3 py-2 text-right tabular-nums whitespace-nowrap',
                            isBold ? 'font-semibold' : '',
                            isLeaf ? 'text-xs' : '',
                            selBg,
                          ].filter(Boolean).join(' ')}
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
                        key={p}
                        className={[
                          'px-3 py-2 text-right tabular-nums whitespace-nowrap',
                          isBold ? 'font-semibold' : '',
                          isLeaf ? 'text-xs' : '',
                          isSelected ? '' : valueColorClass(value),
                          selBg,
                        ].filter(Boolean).join(' ')}
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
        <div
          data-betrag-selektion="true"
          className="fixed bottom-6 right-6 z-50 flex items-center gap-3 rounded-lg border bg-background px-4 py-2.5 shadow-lg text-sm"
        >
          <span className="text-muted-foreground">{selectedCells.size} Feld{selectedCells.size !== 1 ? 'er' : ''}</span>
          <div className="h-4 w-px bg-border" />
          <span className="font-semibold tabular-nums">Summe: {formatBetrag(selSum)}</span>
          <button
            className="ml-1 text-muted-foreground hover:text-foreground"
            onClick={() => setSelectedCells(new Map())}
            aria-label="Auswahl aufheben"
          >
            ✕
          </button>
        </div>
      )}
    </>
  )
}
