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
import { useSteuerausgaben, wertKey } from '@/hooks/use-steuerausgaben'
import type { PlanungsWoche } from '@/hooks/use-steuerausgaben'
import { usePlanungNotizen } from '@/hooks/use-planung-notizen'
import { PlanungNotizFormular } from '@/components/planung-notiz-formular'

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatNum(v: number): string {
  return v.toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

const MONTH_LABELS = ['Jan', 'Feb', 'Mär', 'Apr', 'Mai', 'Jun', 'Jul', 'Aug', 'Sep', 'Okt', 'Nov', 'Dez']

function thursdayOfISOWeek(year: number, week: number): Date {
  const jan4 = new Date(Date.UTC(year, 0, 4))
  const dow = jan4.getUTCDay() || 7
  const monday1 = new Date(jan4.getTime() - (dow - 1) * 86_400_000)
  return new Date(monday1.getTime() + (week - 1) * 7 * 86_400_000 + 3 * 86_400_000)
}

// ─── Row types ────────────────────────────────────────────────────────────────

type RowKind = 'total' | 'category-header' | 'leaf' | 'breakdown'

type BreakdownKind = 'einfuhr-produkt' | 'ust-komponente'

interface FlatRow {
  id: string
  kind: RowKind
  label: string
  indent: number
  kategorieId?: string
  childLeafIds?: string[]
  expandable: boolean
  expanded: boolean
  expandKey?: string
  // Drill-down (read-only) sub-rows
  breakdownKind?: BreakdownKind
  produktId?: string
  komponente?: 'output' | 'vorsteuer' | 'einfuhr'
}

// ─── Main component ───────────────────────────────────────────────────────────

export function SteuerausgabenTabelle({ referenceDate }: { referenceDate?: Date } = {}) {
  const {
    vergangenheitswochen,
    zukunftswochen,
    kategorien,
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
    einfuhrKatId,
    umsatzsteuerKatId,
    einfuhrProduktIds,
    produktNamen,
    hasUstKomponenten,
    getEinfuhrProduktIst,
    getEinfuhrProduktBer,
    getUstKomponente,
  } = useSteuerausgaben(referenceDate)

  const { toast } = useToast()
  const { notizen, upsertNotiz, deleteNotiz, resetNotizen } = usePlanungNotizen('steuerausgaben')

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

  // ─── Category tree ────────────────────────────────────────────────────────

  // "Steuern" is a level-1 node; its direct children are level 2 (our "L1 rows")
  // and their children are level 3 (our "L2 leaf rows").
  const l1Kategorien = useMemo(
    () => kategorien.filter(k => k.level === 2).sort((a, b) => a.sort_order - b.sort_order),
    [kategorien],
  )

  const childrenByParent = useMemo(() => {
    const map = new Map<string, typeof kategorien>()
    for (const k of kategorien.filter(k => k.level === 3)) {
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
    }
    return ids
  }, [l1Kategorien, childrenByParent])

  useEffect(() => {
    if (!loading && kategorien.length > 0) {
      setExpandedIds(new Set(allExpandableIds))
    }
  }, [loading, kategorien]) // eslint-disable-line react-hooks/exhaustive-deps

  // ─── Flat rows ────────────────────────────────────────────────────────────

  const flatRows = useMemo((): FlatRow[] => {
    const rows: FlatRow[] = []
    const allLeafIds: string[] = []

    // Pushes an editable leaf row plus, for Einfuhrumsatzsteuer / Umsatzsteuer,
    // its read-only Drill-down sub-rows (when expanded).
    const pushLeaf = (katId: string, label: string, indent: number) => {
      const isEinfuhr = einfuhrKatId != null && katId === einfuhrKatId && einfuhrProduktIds.length > 0
      const isUst = umsatzsteuerKatId != null && katId === umsatzsteuerKatId && hasUstKomponenten
      const expandable = isEinfuhr || isUst
      const expandKey = `bd:${katId}`
      const expanded = expandable && expandedIds.has(expandKey)

      rows.push({
        id: `leaf-${katId}`,
        kind: 'leaf',
        label,
        indent,
        kategorieId: katId,
        expandable,
        expanded,
        expandKey: expandable ? expandKey : undefined,
      })

      if (!expanded) return

      if (isEinfuhr) {
        for (const pid of einfuhrProduktIds) {
          rows.push({
            id: `bd-einfuhr-${katId}-${pid}`,
            kind: 'breakdown',
            breakdownKind: 'einfuhr-produkt',
            produktId: pid,
            label: produktNamen.get(pid) ?? pid,
            indent: indent + 1,
            expandable: false,
            expanded: false,
          })
        }
      }
      if (isUst) {
        const komps: Array<{ k: 'output' | 'vorsteuer' | 'einfuhr'; label: string }> = [
          { k: 'output', label: 'Umsatzsteuer' },
          { k: 'vorsteuer', label: 'Vorsteuer' },
          { k: 'einfuhr', label: 'Einfuhrumsatzsteuer' },
        ]
        for (const c of komps) {
          rows.push({
            id: `bd-ust-${katId}-${c.k}`,
            kind: 'breakdown',
            breakdownKind: 'ust-komponente',
            komponente: c.k,
            label: c.label,
            indent: indent + 1,
            expandable: false,
            expanded: false,
          })
        }
      }
    }

    for (const l1 of l1Kategorien) {
      const l2s = childrenByParent.get(l1.id) ?? []
      const l1Expanded = expandedIds.has(l1.id)

      if (l2s.length > 0) {
        const l2Ids = l2s.map(l2 => l2.id)
        allLeafIds.push(...l2Ids)

        rows.push({
          id: `l1-${l1.id}`,
          kind: 'category-header',
          label: l1.name,
          indent: 0,
          childLeafIds: l2Ids,
          expandable: true,
          expanded: l1Expanded,
          expandKey: l1.id,
        })

        if (l1Expanded) {
          for (const l2 of l2s) pushLeaf(l2.id, l2.name, 1)
        }
      } else {
        // L1 without children — directly editable leaf
        allLeafIds.push(l1.id)
        pushLeaf(l1.id, l1.name, 0)
      }
    }

    rows.push({
      id: 'total',
      kind: 'total',
      label: 'Steuerausgaben (Gesamt)',
      indent: 0,
      childLeafIds: allLeafIds,
      expandable: false,
      expanded: false,
    })

    return rows
  }, [l1Kategorien, childrenByParent, expandedIds, einfuhrKatId, umsatzsteuerKatId, einfuhrProduktIds, hasUstKomponenten, produktNamen])

  // ─── Value helpers ────────────────────────────────────────────────────────

  function getLeafEffectiveSoll(katId: string, kw: PlanungsWoche): number | null {
    const manual = getManuellerWert(katId, kw)
    if (manual !== null) return manual
    return getBerechneterWert(katId, kw)
  }

  function sumLeafIds(
    ids: string[],
    kw: PlanungsWoche,
    getter: (id: string, kw: PlanungsWoche) => number | null,
  ): { total: number; hasAny: boolean } {
    let total = 0, hasAny = false
    for (const id of ids) {
      const v = getter(id, kw)
      if (v !== null) { total += v; hasAny = true }
    }
    return { total, hasAny }
  }

  function getIstTatsaechlichForRow(row: FlatRow, kw: PlanungsWoche): number | null {
    if (row.kind === 'breakdown') {
      // Einfuhr: Ist-Tatsächlich je Produkt aus gebuchten Transaktionen.
      // Umsatzsteuer-Komponenten: im Ist nicht aufgeschlüsselt.
      if (row.breakdownKind === 'einfuhr-produkt' && row.produktId) {
        return getEinfuhrProduktIst(row.produktId, kw)
      }
      return null
    }
    if (row.kind === 'leaf' && row.kategorieId) {
      return getIstTatsaechlich(row.kategorieId, kw)
    }
    if (row.childLeafIds && row.childLeafIds.length > 0) {
      const { total, hasAny } = sumLeafIds(row.childLeafIds, kw, getIstTatsaechlich)
      return hasAny ? total : null
    }
    return null
  }

  function getIstPlanForRow(row: FlatRow, kw: PlanungsWoche): number | null {
    if (row.kind === 'breakdown') {
      // Einfuhr: Ist-Plan je Produkt = eingefrorener berechneter Wert (Bestellungen).
      // Umsatzsteuer-Komponenten: im Ist nicht aufgeschlüsselt.
      if (row.breakdownKind === 'einfuhr-produkt' && row.produktId) {
        return getEinfuhrProduktBer(row.produktId, kw)
      }
      return null
    }
    if (row.kind === 'leaf' && row.kategorieId) {
      return getIstPlan(row.kategorieId, kw)
    }
    if (row.childLeafIds && row.childLeafIds.length > 0) {
      const { total, hasAny } = sumLeafIds(row.childLeafIds, kw, getIstPlan)
      return hasAny ? total : null
    }
    return null
  }

  function getSollCellValue(row: FlatRow, kw: PlanungsWoche): {
    display: string; rawNum: number | null; indicator: 'gray' | 'blue' | null; isEditable: boolean
  } {
    if (row.kind === 'breakdown') {
      let v: number | null = null
      if (row.breakdownKind === 'einfuhr-produkt' && row.produktId) {
        v = getEinfuhrProduktBer(row.produktId, kw)
      } else if (row.breakdownKind === 'ust-komponente' && row.komponente) {
        v = getUstKomponente(row.komponente, kw)
      }
      return { display: v !== null ? formatNum(v) : '', rawNum: v, indicator: null, isEditable: false }
    }

    if (row.kind === 'leaf' && row.kategorieId) {
      const katId = row.kategorieId
      const manVal = getManuellerWert(katId, kw)
      if (manVal !== null) {
        return { display: formatNum(manVal), rawNum: manVal, indicator: 'blue', isEditable: true }
      }
      const berVal = getBerechneterWert(katId, kw)
      return {
        display: berVal !== null ? formatNum(berVal) : '',
        rawNum: berVal,
        indicator: berVal !== null ? 'gray' : null,
        isEditable: true,
      }
    }

    // Aggregate rows
    if (row.childLeafIds && row.childLeafIds.length > 0) {
      const { total, hasAny } = sumLeafIds(row.childLeafIds, kw, getLeafEffectiveSoll)
      return { display: hasAny ? formatNum(total) : '—', rawNum: hasAny ? total : null, indicator: null, isEditable: false }
    }

    return { display: '—', rawNum: null, indicator: null, isEditable: false }
  }

  // ─── Future week set (for reset-to-auto eligibility) ─────────────────────

  const futureWeekSet = useMemo(
    () => new Set(zukunftswochen.map(kw => `${kw.year}:${kw.week}`)),
    [zukunftswochen],
  )

  const hasManuellAutoZelleSelected = useMemo(() => {
    for (const key of selectedCells.keys()) {
      if (key.startsWith('ist-') || key.startsWith('agg:')) continue
      if (!values.has(key)) continue
      const parts = key.split(':')
      if (parts.length !== 3) continue
      if (futureWeekSet.has(`${parts[1]}:${parts[2]}`)) return true
    }
    return false
  }, [selectedCells, values, futureWeekSet])

  // ─── Reset to auto ────────────────────────────────────────────────────────

  async function handleResetToAuto() {
    setResettingToAuto(true)
    try {
      const toReset = Array.from(selectedCells.keys()).filter(key => {
        if (key.startsWith('ist-') || key.startsWith('agg:')) return false
        if (!values.has(key)) return false
        const parts = key.split(':')
        if (parts.length !== 3) return false
        return futureWeekSet.has(`${parts[1]}:${parts[2]}`)
      })
      await Promise.all(toReset.map(key => {
        const parts = key.split(':')
        return upsertZelle(parts[0], { year: Number(parts[1]), week: Number(parts[2]), label: '' }, null)
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

  async function handleCellBlur(katId: string, kw: PlanungsWoche) {
    const blurKey = wertKey(katId, kw.year, kw.week)
    if (editingCellRef.current !== blurKey) return

    const parsedNew = editingValue.trim() === '' ? null : parseFloat(editingValue.replace(',', '.'))
    const parsedOrig = editingOriginalValue.current === '' ? null : parseFloat(editingOriginalValue.current)

    setEditingCell(null)
    setEditingValue('')

    // Allow negative values (UST-Erstattung); only reject NaN
    if (parsedNew !== null && isNaN(parsedNew)) return

    const unchanged =
      (parsedNew === null && parsedOrig === null) ||
      (parsedNew !== null && parsedOrig !== null && Math.abs(parsedNew - parsedOrig) < 0.005)
    if (unchanged) return

    try {
      await upsertZelle(katId, kw, parsedNew)
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
    if (parts.length === 3) {
      const katId = parts[0]
      const year = parseInt(parts[1])
      const week = parseInt(parts[2])
      const allWochen = [...vergangenheitswochen, ...zukunftswochen]
      const kw = allWochen.find(w => w.year === year && w.week === week)
      const kat = kategorien.find(k => k.id === katId)
      return `${kat?.name ?? katId} · ${kw?.label ?? `KW${week} / ${year}`}`
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
      const d = thursdayOfISOWeek(year, week)
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
        <p>Keine Steuerkategorien im KPI-Modell vorhanden.</p>
        <p>
          Bitte im{' '}
          <a href="/dashboard/kpi-modell" className="underline text-foreground">KPI-Modell</a>
          {' '}Kategorien unterhalb von „Steuern" anlegen.
        </p>
      </div>
    )
  }

  const allExpanded = allExpandableIds.size > 0 && [...allExpandableIds].every(id => expandedIds.has(id))

  // ─── Render ───────────────────────────────────────────────────────────────

  return (
    <TooltipProvider>
      <div className="space-y-4">

        {/* Toolbar */}
        <div className="flex items-center justify-between gap-2">
          <span className="text-sm text-muted-foreground">
            {vergangenheitswochen.length > 0
              ? `${vergangenheitswochen[0].label} – ${zukunftswochen[zukunftswochen.length - 1]?.label ?? ''}`
              : zukunftswochen.length > 0
                ? `${zukunftswochen[0].label} – ${zukunftswochen[zukunftswochen.length - 1].label}`
                : ''}
          </span>
          <div className="flex items-center gap-2">
            {allExpandableIds.size > 0 && (
              <>
                {allExpanded ? (
                  <Button
                    variant="ghost" size="sm"
                    className="gap-1.5 text-xs text-muted-foreground"
                    onClick={() => setExpandedIds(new Set())}
                  >
                    <ChevronsDownUp className="h-3.5 w-3.5" />
                    Alle einklappen
                  </Button>
                ) : (
                  <Button
                    variant="ghost" size="sm"
                    className="gap-1.5 text-xs text-muted-foreground"
                    onClick={() => setExpandedIds(new Set(allExpandableIds))}
                  >
                    <ChevronsUpDown className="h-3.5 w-3.5" />
                    Alle ausklappen
                  </Button>
                )}
              </>
            )}
            <Button
              variant="ghost" size="sm"
              className="gap-1.5 text-xs text-muted-foreground"
              onClick={() => setResetDialogOpen(true)}
            >
              <RotateCcw className="h-3.5 w-3.5" />
              Zurücksetzen
            </Button>
          </div>
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
              {/* Row 2: KW labels */}
              <tr className="border-b bg-muted/40">
                <th className="sticky left-0 z-20 bg-muted min-w-[220px] max-w-[280px] px-3 py-2.5 text-left font-medium text-muted-foreground">
                  Kategorie
                </th>
                {vergangenheitswochen.map(kw => (
                  <Fragment key={`past-header-${kw.year}-${kw.week}`}>
                    <th className="min-w-[110px] px-1.5 py-2 text-right font-medium text-xs text-muted-foreground border-l bg-amber-50/50 dark:bg-amber-950/20">
                      {kw.label}
                      <span className="block text-[10px] font-normal text-amber-700 dark:text-amber-400">
                        Ist-Tatsächlich
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
                const isLeaf = row.kind === 'leaf'
                const isBreakdown = row.kind === 'breakdown'
                const isSoloL1 = isLeaf && row.indent === 0

                const rowBg = isTotal ? 'bg-muted/60'
                  : (isL1Header || isSoloL1) ? 'bg-muted/30'
                  : 'bg-white dark:bg-background'

                const stickyBg = (isTotal || isL1Header || isSoloL1) ? 'bg-muted'
                  : 'bg-white dark:bg-background'

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
                          onClick={() => toggleExpand(row.expandKey ?? row.id)}
                        >
                          {row.expanded
                            ? <ChevronDown className="h-3.5 w-3.5 shrink-0" />
                            : <ChevronRight className="h-3.5 w-3.5 shrink-0" />}
                          {row.label}
                        </button>
                      ) : (
                        <span className={[
                          'flex items-center gap-1',
                          labelFont,
                          (isLeaf && row.indent > 0) ? 'text-muted-foreground' : '',
                          isBreakdown ? 'text-muted-foreground text-xs italic' : '',
                        ].join(' ')}>
                          <span className="w-3.5 shrink-0" />
                          {isBreakdown && <span className="text-muted-foreground/60">·</span>}
                          {row.label}
                        </span>
                      )}
                    </td>

                    {/* Past columns */}
                    {vergangenheitswochen.map(kw => {
                      const istT = getIstTatsaechlichForRow(row, kw)
                      const istP = getIstPlanForRow(row, kw)
                      const istTCellKey = `ist-t:${row.id}:${kw.year}:${kw.week}`
                      const istPCellKey = `ist-p:${row.id}:${kw.year}:${kw.week}`
                      const istTSelected = selectedCells.has(istTCellKey)
                      const istPSelected = selectedCells.has(istPCellKey)

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
                            onMouseDown={istT !== null ? e => handleNonEditableMouseDown(e, istTCellKey, istT) : undefined}
                            onMouseEnter={() => istT !== null && handleNonEditableMouseEnter(istTCellKey, istT)}
                          >
                            <span className={['text-amber-700 dark:text-amber-400', isTotal ? 'font-semibold' : ''].join(' ')}>
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
                            onMouseDown={istP !== null ? e => handleNonEditableMouseDown(e, istPCellKey, istP) : undefined}
                            onMouseEnter={() => istP !== null && handleNonEditableMouseEnter(istPCellKey, istP)}
                          >
                            <span className={['text-muted-foreground', isTotal ? 'font-semibold' : ''].join(' ')}>
                              {istP !== null ? formatNum(istP) : ''}
                            </span>
                          </td>
                        </Fragment>
                      )
                    })}

                    {/* Future Soll columns */}
                    {zukunftswochen.map((kw, kwIdx) => {
                      const { display, rawNum, indicator, isEditable } = getSollCellValue(row, kw)
                      const editKey = row.kategorieId
                        ? wertKey(row.kategorieId, kw.year, kw.week)
                        : `agg:${row.id}:${kw.year}:${kw.week}`
                      const isCurrentlyEditing = isEditable && editingCell === editKey
                      const cellNotiz = isEditable && row.kategorieId ? notizen.get(editKey) : undefined

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
                              step="any"
                              className="w-full text-right bg-transparent outline-none border-b border-primary text-xs tabular-nums"
                              value={editingValue}
                              onChange={e => setEditingValue(e.target.value)}
                              onBlur={() => handleCellBlur(row.kategorieId!, kw)}
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
          <div
            data-betrag-selektion="true"
            className="fixed bottom-6 right-6 z-50 flex flex-col gap-2 items-stretch"
          >
            {/* Note button — only for single editable Soll cell */}
            {selectedCells.size === 1 && (() => {
              const key = Array.from(selectedCells.keys())[0]
              if (key.startsWith('ist-') || key.startsWith('agg:')) return null
              const parts = key.split(':')
              if (parts.length !== 3) return null
              if (!futureWeekSet.has(`${parts[1]}:${parts[2]}`)) return null
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
                Alle manuell eingegebenen Soll-Werte und Notizen werden gelöscht.
                Ist-Werte (Vergangenheit) bleiben erhalten.
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
