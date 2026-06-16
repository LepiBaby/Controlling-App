'use client'

import { useState, useEffect, useRef, useMemo, Fragment } from 'react'
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
import { useUmsatzausgaben, wertKey } from '@/hooks/use-umsatzausgaben'
import type { PlanungsWoche } from '@/hooks/use-umsatzausgaben'
import { usePlanungNotizen } from '@/hooks/use-planung-notizen'
import { PlanungNotizFormular } from '@/components/planung-notiz-formular'

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatNum(v: number): string {
  return v.toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

const MONTH_LABELS = ['Jan', 'Feb', 'Mär', 'Apr', 'Mai', 'Jun', 'Jul', 'Aug', 'Sep', 'Okt', 'Nov', 'Dez']

function mondayOfISOWeek(year: number, week: number): Date {
  const jan4 = new Date(Date.UTC(year, 0, 4))
  const dow = jan4.getUTCDay() || 7
  const monday1 = new Date(jan4.getTime() - (dow - 1) * 86_400_000)
  return new Date(monday1.getTime() + (week - 1) * 7 * 86_400_000)
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
  produktId?: string | null       // string = product leaf; null = direct-leaf subgroup
  isEditable: boolean
  canHaveAutoWert: boolean        // true for product rows with berechnet support
  expandable: boolean
  expanded: boolean
  childL2Ids?: string[]           // L1 header: child L2 IDs (for Ist-T aggregation)
  childLeafs?: Array<{ l2KatId: string; produktId: string | null }> // for Ist-P + Soll sums
}

// ─── Main component ───────────────────────────────────────────────────────────

export function UmsatzausgabenTabelle() {
  const {
    vergangenheitswochen,
    zukunftswochen,
    kategorien,
    produkte,
    katIdsWithProducts,
    values,
    berechneteWerte,
    loading,
    error,
    getManuellerWert,
    getIstTatsaechlich,
    getIstPlan,
    getBerechneterWert,
    upsertZelle,
    resetAll,
  } = useUmsatzausgaben()

  const { toast } = useToast()
  const { notizen, upsertNotiz, deleteNotiz, resetNotizen } = usePlanungNotizen('umsatzausgaben')

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

  const allExpandableIds = useMemo(() => {
    const ids = new Set<string>()
    for (const l1 of l1Kategorien) {
      const l2s = childrenByParent.get(l1.id) ?? []
      if (l2s.length > 0) ids.add(l1.id)
      for (const l2 of l2s) {
        if (katIdsWithProducts.has(l2.id) && produkte.length > 0) ids.add(l2.id)
      }
    }
    return ids
  }, [l1Kategorien, childrenByParent, katIdsWithProducts, produkte])

  const allExpanded = allExpandableIds.size > 0 && [...allExpandableIds].every(id => expandedIds.has(id))

  useEffect(() => {
    if (!loading && kategorien.length > 0) {
      setExpandedIds(new Set(allExpandableIds))
    }
  }, [loading, kategorien]) // eslint-disable-line react-hooks/exhaustive-deps

  // ─── Flat rows ────────────────────────────────────────────────────────────

  const flatRows = useMemo((): FlatRow[] => {
    const rows: FlatRow[] = []
    const allLeafPairs: Array<{ l2KatId: string; produktId: string | null }> = []
    const allL2Ids: string[] = []

    for (const l1 of l1Kategorien) {
      const l2s = childrenByParent.get(l1.id) ?? []
      const l1Expanded = expandedIds.has(l1.id)
      const l1L2Ids = l2s.map(l2 => l2.id)
      const l1ChildLeafs: Array<{ l2KatId: string; produktId: string | null }> = []

      for (const l2 of l2s) {
        const hasProducts = katIdsWithProducts.has(l2.id) && produkte.length > 0
        if (hasProducts) {
          const pairs = produkte.map(p => ({ l2KatId: l2.id, produktId: p.id }))
          l1ChildLeafs.push(...pairs)
          allLeafPairs.push(...pairs)
        } else {
          l1ChildLeafs.push({ l2KatId: l2.id, produktId: null })
          allLeafPairs.push({ l2KatId: l2.id, produktId: null })
        }
        allL2Ids.push(l2.id)
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
          childL2Ids: l1L2Ids,
          childLeafs: l1ChildLeafs,
        })

        if (l1Expanded) {
          for (const l2 of l2s) {
            const hasProducts = katIdsWithProducts.has(l2.id) && produkte.length > 0
            const l2Expanded = hasProducts && expandedIds.has(l2.id)
            const l2ChildLeafs = hasProducts
              ? produkte.map(p => ({ l2KatId: l2.id, produktId: p.id }))
              : undefined

            rows.push({
              id: `l2-${l2.id}`,
              kind: 'subgroup-header',
              label: l2.name,
              indent: 1,
              l1KategorieId: l1.id,
              l2KategorieId: l2.id,
              produktId: hasProducts ? undefined : null,
              isEditable: !hasProducts,
              canHaveAutoWert: false,
              expandable: hasProducts,
              expanded: l2Expanded,
              childLeafs: l2ChildLeafs,
            })

            if (hasProducts && l2Expanded) {
              for (const prod of produkte) {
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
        // L1 without L2 children — render as non-expandable header
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
      label: 'Ausgaben (Gesamt)',
      indent: 0,
      isEditable: false,
      canHaveAutoWert: false,
      expandable: false,
      expanded: false,
      childL2Ids: allL2Ids,
      childLeafs: allLeafPairs,
    })

    return rows
  }, [l1Kategorien, childrenByParent, expandedIds, katIdsWithProducts, produkte])

  // ─── Value aggregation helpers ────────────────────────────────────────────

  function getLeafSoll(l2KatId: string, produktId: string | null, kw: PlanungsWoche): number | null {
    const manual = getManuellerWert(l2KatId, produktId, kw)
    if (manual !== null) return manual
    if (produktId !== null) return getBerechneterWert(l2KatId, produktId, kw)
    return null
  }

  function sumChildLeafs(
    childLeafs: Array<{ l2KatId: string; produktId: string | null }>,
    kw: PlanungsWoche,
    getter: (l2KatId: string, produktId: string | null, kw: PlanungsWoche) => number | null,
  ): { total: number; hasAny: boolean } {
    let total = 0, hasAny = false
    for (const { l2KatId, produktId } of childLeafs) {
      const v = getter(l2KatId, produktId, kw)
      if (v !== null) { total += v; hasAny = true }
    }
    return { total, hasAny }
  }

  function getIstTatsaechlichForRow(row: FlatRow, kw: PlanungsWoche): number | null {
    if (row.kind === 'leaf') return null
    if (row.kind === 'subgroup-header' && row.l2KategorieId) {
      return getIstTatsaechlich(row.l2KategorieId, kw)
    }
    if (row.childL2Ids && row.childL2Ids.length > 0) {
      let total = 0, hasAny = false
      for (const l2Id of row.childL2Ids) {
        const v = getIstTatsaechlich(l2Id, kw)
        if (v !== null) { total += v; hasAny = true }
      }
      return hasAny ? total : null
    }
    return null
  }

  function getIstPlanForRow(row: FlatRow, kw: PlanungsWoche): number | null {
    if (row.kind === 'leaf') {
      return getIstPlan(row.l2KategorieId!, row.produktId!, kw)
    }
    if (row.kind === 'subgroup-header') {
      if (row.childLeafs) {
        const { total, hasAny } = sumChildLeafs(row.childLeafs, kw, (l2Id, pId) => getIstPlan(l2Id, pId, kw))
        return hasAny ? total : null
      }
      return getIstPlan(row.l2KategorieId!, null, kw)
    }
    if (row.childLeafs) {
      const { total, hasAny } = sumChildLeafs(row.childLeafs, kw, (l2Id, pId) => getIstPlan(l2Id, pId, kw))
      return hasAny ? total : null
    }
    return null
  }

  function getSollCellValue(row: FlatRow, kw: PlanungsWoche): {
    display: string; rawNum: number | null; indicator: 'gray' | 'blue' | null; isEditable: boolean
  } {
    if (!row.isEditable) {
      if (row.childLeafs && row.childLeafs.length > 0) {
        const { total, hasAny } = sumChildLeafs(row.childLeafs, kw, getLeafSoll)
        return { display: hasAny ? formatNum(total) : '', rawNum: hasAny ? total : null, indicator: null, isEditable: false }
      }
      return { display: '', rawNum: null, indicator: null, isEditable: false }
    }

    const manVal = getManuellerWert(row.l2KategorieId!, row.produktId ?? null, kw)
    if (manVal !== null) {
      return { display: formatNum(manVal), rawNum: manVal, indicator: 'blue', isEditable: true }
    }

    if (row.canHaveAutoWert && row.produktId) {
      const berVal = getBerechneterWert(row.l2KategorieId!, row.produktId, kw)
      return {
        display: berVal !== null ? formatNum(berVal) : '',
        rawNum: berVal,
        indicator: berVal !== null ? 'gray' : null,
        isEditable: true,
      }
    }

    return { display: '', rawNum: null, indicator: null, isEditable: true }
  }

  // ─── Reset to auto (single/multi cell) ───────────────────────────────────

  const hasManuellAutoZelleSelected = useMemo(() => {
    for (const key of selectedCells.keys()) {
      if (key.startsWith('ist-') || key.startsWith('agg:')) continue
      if (!values.has(key)) continue
      const parts = key.split(':')
      if (parts.length !== 4) continue
      const prodId = parts[1] || null
      if (!prodId) continue
      const year = Number(parts[2])
      const week = Number(parts[3])
      if (berechneteWerte.has(wertKey(parts[0], prodId, year, week))) return true
    }
    return false
  }, [selectedCells, values, berechneteWerte])

  async function handleResetToAuto() {
    setResettingToAuto(true)
    try {
      const toReset = Array.from(selectedCells.keys()).filter(key => {
        if (key.startsWith('ist-') || key.startsWith('agg:')) return false
        if (!values.has(key)) return false
        const parts = key.split(':')
        if (parts.length !== 4) return false
        const prodId = parts[1] || null
        if (!prodId) return false
        const year = Number(parts[2])
        const week = Number(parts[3])
        return berechneteWerte.has(wertKey(parts[0], prodId, year, week))
      })
      await Promise.all(toReset.map(key => {
        const parts = key.split(':')
        return upsertZelle(parts[0], parts[1] || null, { year: Number(parts[2]), week: Number(parts[3]), label: '' }, null)
      }))
      toast({ title: 'Zurückgesetzt', description: 'Werte auf automatisch zurückgesetzt.' })
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
    const origVal = display === '' ? '' : display.replace(',', '.')
    editingOriginalValue.current = origVal
    setEditingCell(editKey)
    setEditingValue(origVal)
  }

  function handleEditableCellMouseEnter(editKey: string, rawNum: number | null) {
    if (!isDragging.current || rawNum === null) return
    setSelectedCells(prev => prev.has(editKey) ? prev : new Map([...prev, [editKey, rawNum]]))
  }

  // ─── Inline edit ─────────────────────────────────────────────────────────

  async function handleCellBlur(l2KatId: string, produktId: string | null, kw: PlanungsWoche) {
    const blurKey = wertKey(l2KatId, produktId, kw.year, kw.week)
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
      await upsertZelle(l2KatId, produktId, kw, parsedNew)
    } catch {
      toast({ title: 'Fehler beim Speichern', description: 'Wert konnte nicht gespeichert werden.', variant: 'destructive' })
    }
  }

  // ─── Global reset ─────────────────────────────────────────────────────────

  async function handleReset() {
    setResetting(true)
    try {
      await Promise.all([resetAll(), resetNotizen()])
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
      const prodId = parts[1] || null
      const year = parseInt(parts[2])
      const week = parseInt(parts[3])
      const allWochen = [...vergangenheitswochen, ...zukunftswochen]
      const kw = allWochen.find(w => w.year === year && w.week === week)
      const l2Kat = kategorien.find(k => k.id === katId)
      const prod = prodId ? produkte.find(p => p.id === prodId) : null
      const label = prod ? `${l2Kat?.name ?? katId} · ${prod.name}` : (l2Kat?.name ?? katId)
      return `${label} · ${kw?.label ?? `KW${week} / ${year}`}`
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

  // ─── Month groups ─────────────────────────────────────────────────────────

  const monthGroups = useMemo(() => {
    const groups: Array<{ label: string; colSpan: number; isPast: boolean }> = []
    const addWeek = (year: number, week: number, isPast: boolean, cols: number) => {
      const d = mondayOfISOWeek(year, week)
      const label = `${MONTH_LABELS[d.getUTCMonth()]} ${d.getUTCFullYear()}`
      if (groups.length > 0 && groups[groups.length - 1].label === label) {
        groups[groups.length - 1].colSpan += cols
      } else {
        groups.push({ label, colSpan: cols, isPast })
      }
    }
    for (const kw of vergangenheitswochen) addWeek(kw.year, kw.week, true, 2)
    for (const kw of zukunftswochen) addWeek(kw.year, kw.week, false, 1)
    return groups
  }, [vergangenheitswochen, zukunftswochen])

  // ─── Loading / Error / Empty ──────────────────────────────────────────────

  if (loading) {
    return (
      <div className="space-y-2">
        {Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-8 w-full" />)}
      </div>
    )
  }

  if (error) return <p className="text-sm text-destructive">{error}</p>

  if (l1Kategorien.length === 0) {
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
    <TooltipProvider>
      <div className="space-y-4">

        {/* Toolbar */}
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            {allExpandableIds.size > 0 && (
              <Button
                variant="outline" size="sm"
                className="gap-1.5 text-xs"
                onClick={() => setExpandedIds(allExpanded ? new Set() : new Set(allExpandableIds))}
              >
                {allExpanded
                  ? <><ChevronsDownUp className="h-3.5 w-3.5" />Alle einklappen</>
                  : <><ChevronsUpDown className="h-3.5 w-3.5" />Alle ausklappen</>
                }
              </Button>
            )}
          </div>
          <Button
            variant="ghost" size="sm"
            className="gap-1.5 text-xs text-muted-foreground"
            onClick={() => setResetDialogOpen(true)}
          >
            <RotateCcw className="h-3.5 w-3.5" />
            Zurücksetzen
          </Button>
        </div>

        {/* Table */}
        <div className="overflow-x-auto rounded-md border">
          <table className="w-full text-sm border-collapse">
            <thead>
              {/* Row 1: Month groups */}
              <tr className="border-b bg-muted/20">
                <th className="sticky left-0 z-20 bg-muted min-w-[220px] max-w-[280px] px-3 py-1" />
                {monthGroups.map((g, i) => (
                  <th
                    key={g.label + i}
                    colSpan={g.colSpan}
                    className={[
                      'px-2 py-1 text-center text-xs font-medium text-muted-foreground border-l',
                      g.isPast ? 'bg-muted/30' : '',
                    ].join(' ')}
                  >
                    {g.label}
                  </th>
                ))}
              </tr>
              {/* Row 2: KW labels with sub-labels */}
              <tr className="border-b bg-muted/40">
                <th className="sticky left-0 z-20 bg-muted min-w-[220px] max-w-[280px] px-3 py-2.5 text-left font-medium text-muted-foreground">
                  Kategorie
                </th>
                {vergangenheitswochen.map(kw => (
                  <Fragment key={`past-header-${kw.year}-${kw.week}`}>
                    <th className="min-w-[110px] px-1.5 py-2 text-right font-medium text-xs text-muted-foreground border-l bg-amber-50/50 dark:bg-amber-950/20">
                      {kw.label}
                      <span className="block text-[10px] font-normal text-amber-700 dark:text-amber-400">
                        tatsächlich
                      </span>
                    </th>
                    <th className="min-w-[110px] px-1.5 py-2 text-right font-medium text-xs text-muted-foreground border-l bg-amber-50/10 dark:bg-amber-950/10">
                      {kw.label}
                      <span className="block text-[10px] font-normal text-muted-foreground/70">
                        Ist-Plan
                      </span>
                    </th>
                  </Fragment>
                ))}
                {zukunftswochen.map((kw, i) => (
                  <th
                    key={`fut-header-${kw.year}-${kw.week}`}
                    className={[
                      'min-w-[100px] px-2 py-2 text-right font-medium text-xs text-muted-foreground',
                      i === 0 ? 'border-l-2 border-l-primary/70' : 'border-l',
                    ].join(' ')}
                  >
                    {kw.label}
                    <span className="block text-[10px] font-normal text-muted-foreground/70">
                      Soll
                    </span>
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
                  : isL2Header ? 'bg-muted/15'
                  : 'bg-white dark:bg-background'

                const stickyBg = isTotal || isL1Header ? 'bg-muted'
                  : isL2Header ? 'bg-muted/40'
                  : 'bg-white dark:bg-background'

                const labelFont = isTotal || isL1Header ? 'font-semibold text-sm'
                  : isL2Header && !row.isEditable ? 'font-medium text-sm'
                  : 'text-sm'

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
                          onClick={() => toggleExpand(
                            isL2Header ? row.l2KategorieId! : row.l1KategorieId!
                          )}
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

                    {/* Past columns */}
                    {vergangenheitswochen.map(kw => {
                      const istT = getIstTatsaechlichForRow(row, kw)
                      const istP = getIstPlanForRow(row, kw)
                      const istTKey = `ist-t:${row.id}:${kw.year}:${kw.week}`
                      const istPKey = `ist-p:${row.id}:${kw.year}:${kw.week}`
                      const istTSelected = selectedCells.has(istTKey)
                      const istPSelected = selectedCells.has(istPKey)

                      return (
                        <Fragment key={`past-${kw.year}-${kw.week}`}>
                          <td
                            data-betrag-selektion="true"
                            className={[
                              'relative px-1.5 py-1.5 text-right text-xs tabular-nums select-none border-l',
                              'bg-amber-50/40 dark:bg-amber-950/10',
                              istTSelected ? 'bg-blue-100 dark:bg-blue-900/30' : '',
                              istT !== null ? 'cursor-default' : '',
                            ].join(' ')}
                            onMouseDown={istT !== null ? e => handleNonEditableMouseDown(e, istTKey, istT) : undefined}
                            onMouseEnter={() => istT !== null && handleNonEditableMouseEnter(istTKey, istT)}
                          >
                            <span className={isTotal || isL1Header ? 'font-semibold' : isL2Header && !row.isEditable ? 'font-medium' : ''}>
                              {istT !== null ? formatNum(istT) : ''}
                            </span>
                          </td>
                          <td
                            data-betrag-selektion="true"
                            className={[
                              'relative px-1.5 py-1.5 text-right text-xs tabular-nums select-none border-l',
                              'bg-amber-50/10 dark:bg-amber-950/5',
                              istPSelected ? 'bg-blue-100 dark:bg-blue-900/30' : '',
                              istP !== null ? 'cursor-default' : '',
                            ].join(' ')}
                            onMouseDown={istP !== null ? e => handleNonEditableMouseDown(e, istPKey, istP) : undefined}
                            onMouseEnter={() => istP !== null && handleNonEditableMouseEnter(istPKey, istP)}
                          >
                            <span className={isTotal || isL1Header ? 'font-semibold' : isL2Header && !row.isEditable ? 'font-medium' : ''}>
                              {istP !== null ? formatNum(istP) : ''}
                            </span>
                          </td>
                        </Fragment>
                      )
                    })}

                    {/* Future columns */}
                    {zukunftswochen.map((kw, kwIdx) => {
                      const { display, rawNum, indicator, isEditable } = getSollCellValue(row, kw)
                      const editKey = row.l2KategorieId
                        ? wertKey(row.l2KategorieId, row.produktId ?? null, kw.year, kw.week)
                        : `agg:${row.id}:${kw.year}:${kw.week}`
                      const isCurrentlyEditing = isEditable && editingCell === editKey
                      const isSelected = selectedCells.has(isEditable || rawNum !== null ? editKey : `${editKey}-na`)
                      const cellNotiz = notizen.get(editKey)

                      return (
                        <td
                          key={`fut-${kw.year}-${kw.week}`}
                          className={[
                            'relative px-1.5 py-1.5 text-right text-xs tabular-nums select-none',
                            kwIdx === 0 ? 'border-l-2 border-l-primary/70' : 'border-l',
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
                              step="any"
                              className="w-full text-right bg-transparent outline-none border-b border-primary text-xs tabular-nums"
                              value={editingValue}
                              onChange={e => setEditingValue(e.target.value)}
                              onBlur={() => handleCellBlur(row.l2KategorieId!, row.produktId ?? null, kw)}
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
                                  indicator === 'gray' ? 'bg-muted-foreground/40' : 'bg-blue-500',
                                ].join(' ')} />
                              )}
                              <span className={[
                                isTotal || isL1Header ? 'font-semibold' : isL2Header && !row.isEditable ? 'font-medium' : '',
                                rawNum === null && !isEditable ? 'text-muted-foreground' : '',
                              ].join(' ')}>
                                {display || (isEditable ? '' : '')}
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
          <div
            data-betrag-selektion="true"
            className="fixed bottom-6 right-6 z-50 flex flex-col gap-2 items-stretch"
          >
            {/* Note button — only for single editable Soll cell */}
            {selectedCells.size === 1 && (() => {
              const key = Array.from(selectedCells.keys())[0]
              if (key.startsWith('ist-') || key.startsWith('agg:')) return null
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
              <AlertDialogTitle>Alle Planungswerte zurücksetzen?</AlertDialogTitle>
              <AlertDialogDescription>
                Alle manuell eingegebenen Werte und Notizen werden gelöscht.
                Automatisch berechnete Werte werden wiederhergestellt.
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
