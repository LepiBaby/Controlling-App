'use client'

import { useState, useEffect, useRef, useMemo } from 'react'
import {
  ChevronDown, ChevronRight, ChevronsDownUp, ChevronsUpDown,
  RotateCcw, StickyNote,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import { useToast } from '@/hooks/use-toast'
import type { KpiCategory } from '@/hooks/use-kpi-categories'
import {
  useLangfristigeUmsatzausgaben,
  wertKey,
  type PlanungsMonat,
} from '@/hooks/use-langfristige-umsatzausgaben'
import { useLangfristigePlanungNotizen } from '@/hooks/use-langfristige-planung-notizen'
import { PlanungNotizFormular } from '@/components/planung-notiz-formular'

// PROJ-91: Umsatzausgaben-Planung der Langfristigen Planung.
// Kategorie-Hierarchie + Berechnungslogik gespiegelt aus PROJ-67, Monatslayout +
// berechnet/manuell-Bedienung gespiegelt aus PROJ-87. KEINE Ist-/Vergangenheits-
// spalten — jede Monatsspalte ist eine Soll-Spalte.

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatNum(v: number): string {
  return v.toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

// ─── Row types ────────────────────────────────────────────────────────────────

type RowKind = 'total' | 'category-header' | 'subgroup-header' | 'leaf'

interface FlatRow {
  id: string
  kind: RowKind
  label: string
  indent: number
  l1KategorieId?: string
  l2KategorieId?: string
  produktId?: string
  isEditable: boolean
  canHaveAutoWert: boolean
  expandable: boolean
  expanded: boolean
  // Für Aggregationszeilen: die Leaf-Kinder (L2-Kategorie + Produkt) zum Summieren
  childLeafs?: Array<{ l2KatId: string; produktId: string }>
}

// ─── Main component ───────────────────────────────────────────────────────────

export function LangfristigeUmsatzausgabenTabelle({ versionId }: { versionId: string }) {
  const {
    monate,
    kategorien,
    produkte,
    marketingKanalNamen,
    values,
    berechneteWerte,
    unassignedMarketingL2Ids,
    loading,
    error,
    getManuellerWert,
    getBerechneterWert,
    upsertZelle,
    resetAll,
  } = useLangfristigeUmsatzausgaben(versionId)

  const { toast } = useToast()
  const { notizen, upsertNotiz, deleteNotiz } = useLangfristigePlanungNotizen(versionId, 'umsatzausgaben')

  // ─── UI state ─────────────────────────────────────────────────────────────

  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set())
  const [selectedCells, setSelectedCells] = useState<Map<string, number>>(new Map())
  const isDragging = useRef(false)
  const selectionSum = useMemo(
    () => Array.from(selectedCells.values()).reduce((a, b) => a + b, 0),
    [selectedCells],
  )

  const [notizFormularOpen, setNotizFormularOpen] = useState(false)
  const notizCellKeyRef = useRef<string>('')
  const notizCellLabelRef = useRef<string>('')

  const [editingCell, setEditingCellState] = useState<string | null>(null)
  const editingCellRef = useRef<string | null>(null)
  const [editingValue, setEditingValue] = useState('')
  const editingOriginalValue = useRef<string>('')

  const [resetDialogOpen, setResetDialogOpen] = useState(false)
  const [resetting, setResetting] = useState(false)
  const [resettingToAuto, setResettingToAuto] = useState(false)

  function setEditingCell(key: string | null) {
    editingCellRef.current = key
    setEditingCellState(key)
  }

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

  // ─── Category helpers ─────────────────────────────────────────────────────

  const l1Kategorien = useMemo(
    () => kategorien.filter(k => k.level === 1).sort((a, b) => a.sort_order - b.sort_order),
    [kategorien],
  )

  const childrenByParent = useMemo(() => {
    const map = new Map<string, typeof kategorien>()
    for (const k of kategorien.filter(k => k.level === 2)) {
      if (!k.parent_id) continue
      if (!map.has(k.parent_id)) map.set(k.parent_id, [])
      map.get(k.parent_id)!.push(k)
    }
    for (const [, children] of map) children.sort((a, b) => a.sort_order - b.sort_order)
    return map
  }, [kategorien])

  // L2-IDs mit berechneten Daten — nur Produktausgaben-L2s liegen in den Bestellkosten
  const berechneteL2Ids = useMemo(() => {
    const ids = new Set<string>()
    for (const key of berechneteWerte.keys()) ids.add(key.split(':')[0])
    return ids
  }, [berechneteWerte])

  // Untergruppen (L2) je L1. Marketing-Untergruppen sind versionsgebundene Kanäle
  // (gefiltert auf die ohne Sales-Plattform-Zuordnung); alle übrigen kommen aus dem
  // globalen KPI-Baum.
  const getSubgroups = useMemo(() => {
    return (l1: KpiCategory): Array<{ id: string; name: string }> => {
      if (l1.name.toLowerCase().includes('marketing')) {
        if (unassignedMarketingL2Ids === null) return []
        return [...unassignedMarketingL2Ids]
          .map(id => ({ id, name: marketingKanalNamen.get(id) ?? id }))
          .sort((a, b) => a.name.localeCompare(b.name))
      }
      return (childrenByParent.get(l1.id) ?? []).map(l2 => ({ id: l2.id, name: l2.name }))
    }
  }, [childrenByParent, unassignedMarketingL2Ids, marketingKanalNamen])

  // Vertrieb + Marketing: immer per Name anzeigen.
  // Produktausgaben: jede L1, deren L2-Kinder berechnete Daten haben.
  const visibleL1Kategorien = useMemo(() => {
    return l1Kategorien.filter(l1 => {
      const n = l1.name.toLowerCase()
      if (n.includes('vertrieb') || n.includes('marketing')) return true
      const l2s = childrenByParent.get(l1.id) ?? []
      return l2s.some(l2 => berechneteL2Ids.has(l2.id))
    })
  }, [l1Kategorien, childrenByParent, berechneteL2Ids])

  const allExpandableIds = useMemo(() => {
    const ids = new Set<string>()
    for (const l1 of visibleL1Kategorien) {
      const l2s = getSubgroups(l1)
      if (l2s.length > 0) ids.add(l1.id)
      if (produkte.length > 0) {
        for (const l2 of l2s) ids.add(l2.id)
      }
    }
    return ids
  }, [visibleL1Kategorien, getSubgroups, produkte])

  const allExpanded = allExpandableIds.size > 0 && [...allExpandableIds].every(id => expandedIds.has(id))

  useEffect(() => {
    if (!loading && kategorien.length > 0) {
      setExpandedIds(new Set(allExpandableIds))
    }
  }, [loading, kategorien]) // eslint-disable-line react-hooks/exhaustive-deps

  // ─── Flat rows ────────────────────────────────────────────────────────────

  const flatRows = useMemo((): FlatRow[] => {
    const rows: FlatRow[] = []
    const allLeafPairs: Array<{ l2KatId: string; produktId: string }> = []

    // Vollständige Matrix: unter jeder Untergruppe erscheint jedes Produkt der Version.
    const leafProdukte = produkte

    for (const l1 of visibleL1Kategorien) {
      const l2s = getSubgroups(l1)
      const l1Expanded = expandedIds.has(l1.id)
      const l1ChildLeafs: Array<{ l2KatId: string; produktId: string }> = []

      for (const l2 of l2s) {
        for (const p of leafProdukte) {
          l1ChildLeafs.push({ l2KatId: l2.id, produktId: p.id })
          allLeafPairs.push({ l2KatId: l2.id, produktId: p.id })
        }
      }

      if (l2s.length > 0) {
        rows.push({
          id: `l1-${l1.id}`,
          kind: 'category-header',
          label: l1.name,
          indent: 0,
          l1KategorieId: l1.id,
          isEditable: false,
          canHaveAutoWert: false,
          expandable: true,
          expanded: l1Expanded,
          childLeafs: l1ChildLeafs,
        })

        if (l1Expanded) {
          for (const l2 of l2s) {
            const l2Expanded = expandedIds.has(l2.id)
            const l2ChildLeafs = leafProdukte.map(p => ({ l2KatId: l2.id, produktId: p.id }))

            rows.push({
              id: `l2-${l2.id}`,
              kind: 'subgroup-header',
              label: l2.name,
              indent: 1,
              l1KategorieId: l1.id,
              l2KategorieId: l2.id,
              isEditable: false,
              canHaveAutoWert: false,
              expandable: leafProdukte.length > 0,
              expanded: l2Expanded,
              childLeafs: l2ChildLeafs,
            })

            if (l2Expanded) {
              for (const prod of leafProdukte) {
                rows.push({
                  id: `leaf-${l2.id}-${prod.id}`,
                  kind: 'leaf',
                  label: prod.name,
                  indent: 2,
                  l1KategorieId: l1.id,
                  l2KategorieId: l2.id,
                  produktId: prod.id,
                  isEditable: true,
                  canHaveAutoWert: true,
                  expandable: false,
                  expanded: false,
                })
              }
            }
          }
        }
      } else {
        rows.push({
          id: `l1-${l1.id}`,
          kind: 'category-header',
          label: l1.name,
          indent: 0,
          l1KategorieId: l1.id,
          isEditable: false,
          canHaveAutoWert: false,
          expandable: false,
          expanded: false,
        })
      }
    }

    rows.push({
      id: 'total',
      kind: 'total',
      label: 'Umsatzausgaben (Gesamt)',
      indent: 0,
      isEditable: false,
      canHaveAutoWert: false,
      expandable: false,
      expanded: false,
      childLeafs: allLeafPairs,
    })

    return rows
  }, [visibleL1Kategorien, getSubgroups, expandedIds, produkte])

  // ─── Value aggregation helpers ────────────────────────────────────────────

  function getLeafSoll(l2KatId: string, produktId: string, monat: PlanungsMonat): number | null {
    const manual = getManuellerWert(l2KatId, produktId, monat)
    if (manual !== null) return manual
    return getBerechneterWert(l2KatId, produktId, monat)
  }

  function getCellValue(row: FlatRow, monat: PlanungsMonat): {
    display: string; rawNum: number | null; indicator: 'gray' | 'blue' | null; isEditable: boolean
  } {
    if (!row.isEditable) {
      if (row.childLeafs && row.childLeafs.length > 0) {
        let total = 0, hasAny = false
        for (const { l2KatId, produktId } of row.childLeafs) {
          const v = getLeafSoll(l2KatId, produktId, monat)
          if (v !== null) { total += v; hasAny = true }
        }
        return { display: hasAny ? formatNum(total) : '—', rawNum: hasAny ? total : null, indicator: null, isEditable: false }
      }
      return { display: '—', rawNum: null, indicator: null, isEditable: false }
    }

    const manVal = getManuellerWert(row.l2KategorieId!, row.produktId!, monat)
    if (manVal !== null) {
      return { display: formatNum(manVal), rawNum: manVal, indicator: 'blue', isEditable: true }
    }

    const berVal = getBerechneterWert(row.l2KategorieId!, row.produktId!, monat)
    return {
      display: berVal !== null ? formatNum(berVal) : '',
      rawNum: berVal,
      indicator: berVal !== null ? 'gray' : null,
      isEditable: true,
    }
  }

  // ─── Reset to auto (selektierte manuelle Zellen) ──────────────────────────

  const hasManuellAutoZelleSelected = useMemo(() => {
    for (const key of selectedCells.keys()) {
      if (key.startsWith('agg:')) continue
      if (values.has(key)) return true
    }
    return false
  }, [selectedCells, values])

  async function handleResetToAuto() {
    setResettingToAuto(true)
    try {
      const toReset = Array.from(selectedCells.keys()).filter(key => !key.startsWith('agg:') && values.has(key))
      await Promise.all(toReset.map(key => {
        const parts = key.split(':')
        return upsertZelle(parts[0], parts[1], { year: Number(parts[2]), month: Number(parts[3]), label: '' }, null)
      }))
      setSelectedCells(new Map())
      toast({ title: 'Zurückgesetzt', description: 'Werte werden wieder automatisch berechnet.' })
    } catch {
      toast({ title: 'Fehler', description: 'Zurücksetzen fehlgeschlagen.', variant: 'destructive' })
    } finally {
      setResettingToAuto(false)
    }
  }

  // ─── Selection handlers ───────────────────────────────────────────────────

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
    const origVal = display === '' ? '' : display.replace(/\./g, '').replace(',', '.')
    editingOriginalValue.current = origVal
    setEditingCell(editKey)
    setEditingValue(origVal)
  }

  function handleEditableCellMouseEnter(editKey: string, rawNum: number | null) {
    if (!isDragging.current || rawNum === null) return
    setSelectedCells(prev => prev.has(editKey) ? prev : new Map([...prev, [editKey, rawNum]]))
  }

  // ─── Inline edit ─────────────────────────────────────────────────────────

  async function handleCellBlur(l2KatId: string, produktId: string, monat: PlanungsMonat) {
    const blurKey = wertKey(l2KatId, produktId, monat.year, monat.month)
    if (editingCellRef.current !== blurKey) return

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
      await upsertZelle(l2KatId, produktId, monat, parsedNew)
    } catch {
      toast({ title: 'Fehler beim Speichern', description: 'Wert konnte nicht gespeichert werden.', variant: 'destructive' })
    }
  }

  // ─── Global reset ─────────────────────────────────────────────────────────

  async function handleReset() {
    setResetting(true)
    try {
      await resetAll()
      await Promise.all([...notizen.keys()].map(k => deleteNotiz(k)))
      setSelectedCells(new Map())
      toast({ title: 'Zurückgesetzt', description: 'Alle manuellen Werte und Notizen wurden gelöscht.' })
    } catch {
      toast({ title: 'Fehler', description: 'Zurücksetzen fehlgeschlagen.', variant: 'destructive' })
    } finally {
      setResetting(false)
      setResetDialogOpen(false)
    }
  }

  // ─── Notiz helpers ────────────────────────────────────────────────────────

  function getNotizCellLabel(editKey: string): string {
    const parts = editKey.split(':')
    if (parts.length === 4) {
      const katId = parts[0]
      const prodId = parts[1]
      const year = parseInt(parts[2])
      const month = parseInt(parts[3])
      const monat = monate.find(m => m.year === year && m.month === month)
      const l2Kat = kategorien.find(k => k.id === katId)
      const prod = produkte.find(p => p.id === prodId)
      const label = prod ? `${l2Kat?.name ?? katId} · ${prod.name}` : (l2Kat?.name ?? katId)
      return `${label} · ${monat?.label ?? `${month}/${year}`}`
    }
    return editKey
  }

  // ─── Expand / Collapse ────────────────────────────────────────────────────

  function toggleExpand(id: string) {
    setExpandedIds(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  // ─── Loading / Error / Empty ──────────────────────────────────────────────

  if (loading) {
    return (
      <div className="space-y-2">
        {Array.from({ length: 8 }).map((_, i) => <Skeleton key={i} className="h-8 w-full" />)}
      </div>
    )
  }

  if (error) return <p className="text-sm text-destructive">{error}</p>

  if (visibleL1Kategorien.length === 0) {
    return (
      <div className="rounded-md border p-8 text-center text-muted-foreground text-sm space-y-2">
        <p>Keine Ausgaben-Kategorien im KPI-Modell vorhanden.</p>
        <p>
          Bitte das{' '}
          <a href="/dashboard/kpi-modell" className="underline text-foreground">KPI-Modell konfigurieren</a>
          {' '}und Ausgaben-Kategorien anlegen.
        </p>
      </div>
    )
  }

  // ─── Render ───────────────────────────────────────────────────────────────

  return (
    <TooltipProvider delayDuration={400}>
      <div data-betrag-selektion="true" className="space-y-4" onMouseUp={() => { isDragging.current = false }}>

        {/* Toolbar */}
        <div className="flex items-center justify-between gap-2">
          <span className="text-sm text-muted-foreground">
            {monate.length > 0 ? `${monate[0].label} – ${monate[monate.length - 1].label}` : ''}
          </span>
          <div className="flex items-center gap-2">
            {allExpandableIds.size > 0 && (
              <Button
                variant="ghost" size="sm"
                className="gap-1.5 text-xs text-muted-foreground"
                onClick={() => setExpandedIds(allExpanded ? new Set() : new Set(allExpandableIds))}
              >
                {allExpanded
                  ? <><ChevronsDownUp className="h-3.5 w-3.5" />Alle einklappen</>
                  : <><ChevronsUpDown className="h-3.5 w-3.5" />Alle ausklappen</>
                }
              </Button>
            )}
            <Button
              variant="outline" size="sm"
              onClick={() => setResetDialogOpen(true)}
              disabled={resetting}
            >
              <RotateCcw className="h-3.5 w-3.5 mr-1.5" />
              Zurücksetzen
            </Button>
          </div>
        </div>

        {/* Table */}
        <div className="overflow-x-auto rounded-md border">
          <table className="w-full text-sm border-collapse">
            <thead>
              <tr className="border-b bg-muted/40">
                <th className="sticky left-0 z-20 bg-muted min-w-[240px] max-w-[300px] px-3 py-2.5 text-left font-medium text-muted-foreground">
                  Kategorie
                </th>
                {monate.map(m => (
                  <th
                    key={`${m.year}-${m.month}`}
                    className="min-w-[100px] px-2 py-2.5 text-right font-medium text-xs text-muted-foreground border-l"
                  >
                    {m.label}
                  </th>
                ))}
              </tr>
            </thead>

            <tbody>
              {flatRows.map(row => {
                const isTotal = row.kind === 'total'
                const isL1Header = row.kind === 'category-header'
                const isL2Header = row.kind === 'subgroup-header'
                const isLeaf = row.kind === 'leaf'

                const rowBg = isTotal ? 'bg-muted/60'
                  : isL1Header ? 'bg-muted/30'
                  : 'bg-white dark:bg-background'

                const stickyBg = isTotal || isL1Header ? 'bg-muted' : 'bg-white dark:bg-background'
                const labelFont = isTotal ? 'font-semibold text-sm' : 'text-sm'

                return (
                  <tr
                    key={row.id}
                    className={[
                      'border-b last:border-0 hover:bg-muted/20 transition-colors',
                      rowBg,
                      isTotal ? 'border-t-2' : '',
                    ].join(' ')}
                  >
                    {/* Label cell (sticky) */}
                    <td
                      className={['sticky left-0 z-10 px-3 py-1.5 whitespace-nowrap', stickyBg].join(' ')}
                      style={{ paddingLeft: `${12 + row.indent * 16}px` }}
                    >
                      {row.expandable ? (
                        <button
                          type="button"
                          className={['flex items-center gap-1 hover:text-primary', labelFont].join(' ')}
                          onClick={() => toggleExpand(isL2Header ? row.l2KategorieId! : row.l1KategorieId!)}
                        >
                          {row.expanded
                            ? <ChevronDown className="h-3.5 w-3.5 shrink-0" />
                            : <ChevronRight className="h-3.5 w-3.5 shrink-0" />}
                          {row.label}
                        </button>
                      ) : (
                        <span className={['flex items-center gap-1', labelFont, isLeaf ? 'text-muted-foreground' : ''].join(' ')}>
                          <span className="w-3.5 shrink-0" />
                          {row.label}
                        </span>
                      )}
                    </td>

                    {/* Month (Soll) columns */}
                    {monate.map(monat => {
                      const { display, rawNum, indicator, isEditable } = getCellValue(row, monat)
                      const editKey = row.l2KategorieId && row.produktId
                        ? wertKey(row.l2KategorieId, row.produktId, monat.year, monat.month)
                        : `agg:${row.id}:${monat.year}:${monat.month}`
                      const isCurrentlyEditing = isEditable && editingCell === editKey
                      const cellNotiz = notizen.get(editKey)

                      return (
                        <td
                          key={`${monat.year}-${monat.month}`}
                          className={[
                            'relative px-2 py-1.5 text-right text-xs tabular-nums select-none border-l',
                            selectedCells.has(editKey) ? 'bg-blue-100 dark:bg-blue-900/30' : '',
                            isEditable ? 'cursor-pointer' : '',
                          ].join(' ')}
                          onClick={
                            isEditable && !isCurrentlyEditing
                              ? e => handleEditableCellClick(e, editKey, display)
                              : undefined
                          }
                          onMouseDown={
                            isEditable
                              ? e => handleEditableCellMouseDown(e, editKey, rawNum)
                              : rawNum !== null
                                ? e => handleNonEditableMouseDown(e, editKey, rawNum)
                                : undefined
                          }
                          onMouseEnter={
                            isEditable
                              ? () => handleEditableCellMouseEnter(editKey, rawNum)
                              : rawNum !== null
                                ? () => handleNonEditableMouseEnter(editKey, rawNum)
                                : undefined
                          }
                          data-betrag-selektion="true"
                        >
                          {/* Note indicator */}
                          {cellNotiz && !isCurrentlyEditing && (
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
                                {cellNotiz.length > 300 ? cellNotiz.slice(0, 300) + '…' : cellNotiz}
                              </TooltipContent>
                            </Tooltip>
                          )}

                          {isCurrentlyEditing ? (
                            <input
                              autoFocus
                              type="number"
                              min="0"
                              step="0.01"
                              size={1}
                              className="absolute inset-0 w-full min-w-0 box-border px-2 text-right bg-background outline-none border-b border-primary text-xs tabular-nums [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                              value={editingValue}
                              onChange={e => setEditingValue(e.target.value)}
                              onBlur={() => handleCellBlur(row.l2KategorieId!, row.produktId!, monat)}
                              onKeyDown={e => {
                                if (e.key === 'Enter') (e.target as HTMLInputElement).blur()
                                if (e.key === 'Escape') { setEditingCell(null); setEditingValue('') }
                              }}
                              onClick={e => e.stopPropagation()}
                              onMouseDown={e => e.stopPropagation()}
                            />
                          ) : (
                            <div className="flex items-center justify-end gap-1">
                              {indicator && (
                                <span className={[
                                  'inline-block h-1.5 w-1.5 rounded-full shrink-0',
                                  indicator === 'gray' ? 'bg-gray-300 dark:bg-gray-600' : 'bg-blue-500',
                                ].join(' ')}
                                title={indicator === 'gray' ? 'Automatisch berechnet' : 'Manuell eingegeben'} />
                              )}
                              <span className={[
                                isTotal ? 'font-semibold' : '',
                                display === '—' ? 'text-muted-foreground/40' : '',
                              ].join(' ')}>
                                {display}
                              </span>
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

        {/* Floating panel */}
        {selectedCells.size > 0 && (
          <div data-betrag-selektion="true" className="fixed bottom-6 right-6 z-50 flex flex-col gap-2 items-stretch">
            {/* Note button — only for single editable Soll cell */}
            {selectedCells.size === 1 && (() => {
              const key = Array.from(selectedCells.keys())[0]
              if (key.startsWith('agg:')) return null
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

            {/* Reset to auto */}
            {hasManuellAutoZelleSelected && (
              <div className="rounded-lg border bg-background shadow-lg text-sm">
                <button
                  type="button"
                  disabled={resettingToAuto}
                  className="flex items-center gap-2 px-4 py-2.5 w-full hover:bg-muted/50 rounded-lg transition-colors disabled:opacity-50"
                  onClick={handleResetToAuto}
                >
                  <RotateCcw className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                  <span>{resettingToAuto ? 'Wird zurückgesetzt…' : 'Auf automatisch zurücksetzen'}</span>
                </button>
              </div>
            )}

            {/* Betragsselektion */}
            <div className="flex items-center gap-3 rounded-lg border bg-background px-4 py-2.5 shadow-lg text-sm">
              <span className="text-muted-foreground">{selectedCells.size} Feld{selectedCells.size !== 1 ? 'er' : ''}</span>
              <div className="h-4 w-px bg-border" />
              <span className="font-semibold tabular-nums">
                Summe: {selectionSum.toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </span>
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

        {/* Reset confirm dialog */}
        <AlertDialog open={resetDialogOpen} onOpenChange={setResetDialogOpen}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Umsatzausgaben zurücksetzen?</AlertDialogTitle>
              <AlertDialogDescription>
                Alle manuell eingegebenen Werte und Notizen dieser Planversion werden gelöscht.
                Die Felder werden wieder automatisch aus den Einstellungen dieser Version berechnet.
                Diese Aktion kann nicht rückgängig gemacht werden.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel disabled={resetting}>Abbrechen</AlertDialogCancel>
              <AlertDialogAction onClick={handleReset} disabled={resetting}>
                {resetting ? 'Wird zurückgesetzt…' : 'Zurücksetzen'}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

      </div>
    </TooltipProvider>
  )
}
