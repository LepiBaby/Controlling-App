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
import {
  useLangfristigeEinnahmenplanung,
  kategorieMonatKey,
  istProduktverkaufe,
  type PlanungsMonat,
} from '@/hooks/use-langfristige-einnahmenplanung'
import { useLangfristigePlanungNotizen } from '@/hooks/use-langfristige-planung-notizen'
import { PlanungNotizFormular } from '@/components/planung-notiz-formular'

// PROJ-89: Einnahmenplanung der Langfristigen Planung.
// Mirror der kurzfristigen Tabelle (PROJ-52), aber monatsbasiert, versionsgebunden
// und OHNE Ist-/Vergangenheits-Schicht. Es gibt nur Soll-Monatsspalten ab dem Startmonat.
// Produktverkäufe werden pro Sales Channel automatisch berechnet (grauer Punkt);
// manuelle Überschreibungen erhalten einen blauen Punkt. Alle anderen Kategorien sind leer.

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatNum(v: number): string {
  return v.toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

// ─── Row types ────────────────────────────────────────────────────────────────

type RowKind = 'total' | 'category-header' | 'leaf'

interface FlatRow {
  id: string
  kind: RowKind
  label: string
  indent: number
  kategorieId?: string
  childLeafIds?: string[]
  l1KategorieId?: string
  isProduktverkaeufenSection?: boolean
  expandable?: boolean
  expanded?: boolean
  plattformId?: string
}

// ─── Main component ───────────────────────────────────────────────────────────

export function LangfristigeEinnahmenplanungTabelle({ versionId }: { versionId: string }) {
  const {
    monate,
    kategorien,
    plattformen,
    produktverkaeufenKatId,
    values,
    loading,
    error,
    getWert,
    getProduktverkaeufeSoll,
    upsertZelle,
    resetAll,
  } = useLangfristigeEinnahmenplanung(versionId)

  const { toast } = useToast()
  const { notizen, upsertNotiz, deleteNotiz } = useLangfristigePlanungNotizen(versionId, 'einnahmenplanung')

  // ─── UI state ─────────────────────────────────────────────────────────────

  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(new Set())
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
  const [resettingPvToAuto, setResettingPvToAuto] = useState(false)

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

  // All leaf IDs for "Gesamt" aggregation
  const allLeafIds = useMemo(() => {
    const l1WithChildren = new Set(
      kategorien.filter(k => k.level === 2 && k.parent_id).map(k => k.parent_id!),
    )
    return kategorien
      .filter(k => (k.level === 1 && !l1WithChildren.has(k.id)) || k.level === 2)
      .map(k => k.id)
  }, [kategorien])

  // Leaf IDs that are L2 children of Produktverkäufe
  const pvChildLeafIds = useMemo(() => {
    if (!produktverkaeufenKatId) return new Set<string>()
    const children = childrenByParent.get(produktverkaeufenKatId) ?? []
    return new Set(children.map(c => c.id))
  }, [produktverkaeufenKatId, childrenByParent])

  const allExpandableIds = useMemo(() => {
    const ids = new Set(l1Kategorien.filter(l1 => (childrenByParent.get(l1.id) ?? []).length > 0).map(l1 => l1.id))
    // PV becomes expandable when it's a leaf (no KPI children) but has platforms to show
    if (produktverkaeufenKatId && pvChildLeafIds.size === 0 && plattformen.length > 0) {
      ids.add(produktverkaeufenKatId)
    }
    return ids
  }, [l1Kategorien, childrenByParent, produktverkaeufenKatId, pvChildLeafIds, plattformen])
  const allExpanded = allExpandableIds.size > 0 && [...allExpandableIds].every(id => expandedCategories.has(id))

  // Expand all on first load
  useEffect(() => {
    if (!loading && kategorien.length > 0) {
      setExpandedCategories(new Set(allExpandableIds))
    }
  }, [loading, kategorien]) // eslint-disable-line react-hooks/exhaustive-deps

  // ─── Flat rows — Gesamt at BOTTOM ────────────────────────────────────────

  const flatRows = useMemo((): FlatRow[] => {
    const rows: FlatRow[] = []

    for (const l1 of l1Kategorien) {
      const children = childrenByParent.get(l1.id) ?? []
      const isPV = l1.id === produktverkaeufenKatId || istProduktverkaufe(l1.name)
      const expanded = expandedCategories.has(l1.id)

      if (children.length > 0) {
        rows.push({
          id: `header-${l1.id}`,
          kind: 'category-header',
          label: l1.name,
          indent: 0,
          l1KategorieId: l1.id,
          childLeafIds: children.map(c => c.id),
          isProduktverkaeufenSection: isPV,
          expandable: true,
          expanded,
        })
        if (expanded) {
          for (const child of children) {
            rows.push({
              id: `leaf-${child.id}`,
              kind: 'leaf',
              label: child.name,
              indent: 1,
              kategorieId: child.id,
              l1KategorieId: l1.id,
              isProduktverkaeufenSection: isPV,
            })
          }
        }
      } else if (isPV && pvChildLeafIds.size === 0 && plattformen.length > 0) {
        // PV leaf: show as expandable header with editable platform child rows
        rows.push({
          id: `header-${l1.id}`,
          kind: 'category-header',
          label: l1.name,
          indent: 0,
          l1KategorieId: l1.id,
          childLeafIds: [],
          isProduktverkaeufenSection: true,
          expandable: true,
          expanded,
        })
        if (expanded) {
          for (const plt of plattformen) {
            rows.push({
              id: `pv-plt-${plt.id}`,
              kind: 'leaf',
              label: plt.name,
              indent: 1,
              kategorieId: plt.id,
              l1KategorieId: l1.id,
              isProduktverkaeufenSection: true,
              plattformId: plt.id,
            })
          }
        }
      } else {
        // L1 is a leaf itself
        rows.push({
          id: `leaf-${l1.id}`,
          kind: 'leaf',
          label: l1.name,
          indent: 0,
          kategorieId: l1.id,
          l1KategorieId: l1.id,
          isProduktverkaeufenSection: isPV,
        })
      }
    }

    // Total row at bottom
    rows.push({
      id: 'total',
      kind: 'total',
      label: 'Einnahmen (Gesamt)',
      indent: 0,
      childLeafIds: allLeafIds,
    })

    return rows
  }, [l1Kategorien, childrenByParent, expandedCategories, allLeafIds, produktverkaeufenKatId, plattformen, pvChildLeafIds])

  // ─── Value aggregation helpers ────────────────────────────────────────────

  // Effective PV total: sum of per-platform effective values (manual or auto-calc per platform)
  function getPvEffectiveTotal(monat: PlanungsMonat): { total: number; hasAny: boolean } {
    if (plattformen.length === 0) {
      const manual = produktverkaeufenKatId ? getWert(produktverkaeufenKatId, monat) : null
      if (manual !== null) return { total: manual, hasAny: true }
      const auto = getProduktverkaeufeSoll(monat)
      return { total: auto ?? 0, hasAny: auto !== null }
    }
    let total = 0, hasAny = false
    for (const plt of plattformen) {
      const manual = getWert(plt.id, monat)
      if (manual !== null) { total += manual; hasAny = true }
      else {
        const auto = getProduktverkaeufeSoll(monat, plt.id)
        if (auto !== null) { total += auto; hasAny = true }
      }
    }
    return { total, hasAny }
  }

  // Aggregates Soll for a category-sum or total row
  function getSollSum(
    leafIds: string[],
    isPvSection: boolean,
    isTotal: boolean,
    monat: PlanungsMonat,
  ): { total: number; hasAny: boolean } {
    if (isPvSection) {
      // Check if any L2 child has a manual value
      const anyManual = leafIds.some(id => getWert(id, monat) !== null)
      if (anyManual) {
        let sum = 0, has = false
        for (const id of leafIds) {
          const v = getWert(id, monat)
          if (v !== null) { sum += v; has = true }
        }
        return { total: sum, hasAny: has }
      }
      const pv = getProduktverkaeufeSoll(monat)
      return { total: pv ?? 0, hasAny: pv !== null }
    }

    if (isTotal) {
      let sum = 0, has = false
      for (const id of leafIds) {
        const isPvChild = pvChildLeafIds.has(id)
        const isPvLeafRoot = id === produktverkaeufenKatId && !isPvChild

        let v: number | null = null
        if (isPvLeafRoot) {
          const { total, hasAny } = getPvEffectiveTotal(monat)
          v = hasAny ? total : null
        } else {
          v = getWert(id, monat)
        }
        if (v !== null) { sum += v; has = true }
      }

      // If PV has children and no child has manual → add auto-calc
      if (produktverkaeufenKatId && pvChildLeafIds.size > 0) {
        const anyPvChildManual = [...pvChildLeafIds].some(id => getWert(id, monat) !== null)
        if (!anyPvChildManual) {
          const pv = getProduktverkaeufeSoll(monat)
          if (pv !== null) { sum += pv; has = true }
        }
      }

      return { total: sum, hasAny: has }
    }

    // Non-PV category-sum
    let total = 0, hasAny = false
    for (const id of leafIds) {
      const v = getWert(id, monat)
      if (v !== null) { total += v; hasAny = true }
    }
    return { total, hasAny }
  }

  // ─── Selection ───────────────────────────────────────────────────────────

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

  async function handleCellBlur(kategorieId: string, monat: PlanungsMonat) {
    const blurKey = kategorieMonatKey(kategorieId, monat.year, monat.month)
    if (editingCellRef.current !== blurKey) return

    const parsedNew = editingValue.trim() === '' ? null : parseFloat(editingValue.replace(',', '.'))
    const parsedOrig = editingOriginalValue.current === ''
      ? null
      : parseFloat(editingOriginalValue.current)

    setEditingCell(null)
    setEditingValue('')

    if (parsedNew !== null && (isNaN(parsedNew) || parsedNew < 0)) return

    const unchanged =
      (parsedNew === null && parsedOrig === null) ||
      (parsedNew !== null && parsedOrig !== null && Math.abs(parsedNew - parsedOrig) < 0.005)
    if (unchanged) return

    try {
      await upsertZelle(kategorieId, monat, parsedNew)
    } catch {
      toast({ title: 'Fehler beim Speichern', description: 'Wert konnte nicht gespeichert werden.', variant: 'destructive' })
    }
  }

  // ─── Reset (global) ──────────────────────────────────────────────────────

  async function handleReset() {
    setResetting(true)
    try {
      await resetAll()
      // Notizen dieser Seite werden serverseitig über die DELETE-Route mitgelöscht;
      // lokal alle bekannten Notiz-Schlüssel entfernen.
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

  // ─── Reset individual PV cells to auto ───────────────────────────────────

  const hasManuellePvCellsSelected = useMemo(() => {
    const pvPrefix = produktverkaeufenKatId ? `${produktverkaeufenKatId}:` : null
    const plattIds = new Set(plattformen.map(p => p.id))
    for (const key of selectedCells.keys()) {
      if (!values.has(key)) continue
      if (pvPrefix && key.startsWith(pvPrefix)) return true
      const colonIdx = key.indexOf(':')
      if (colonIdx > 0 && plattIds.has(key.slice(0, colonIdx))) return true
    }
    return false
  }, [selectedCells, produktverkaeufenKatId, plattformen, values])

  async function handleResetPvToAuto() {
    setResettingPvToAuto(true)
    const pvPrefix = produktverkaeufenKatId ? `${produktverkaeufenKatId}:` : ''
    const plattIds = new Set(plattformen.map(p => p.id))
    try {
      const pvKeys = Array.from(selectedCells.keys()).filter(k => {
        if (!values.has(k)) return false
        if (pvPrefix && k.startsWith(pvPrefix)) return true
        const colonIdx = k.indexOf(':')
        return colonIdx > 0 && plattIds.has(k.slice(0, colonIdx))
      })
      await Promise.all(pvKeys.map(key => {
        const colonIdx1 = key.indexOf(':')
        const colonIdx2 = key.indexOf(':', colonIdx1 + 1)
        const katId = key.slice(0, colonIdx1)
        const yearStr = key.slice(colonIdx1 + 1, colonIdx2)
        const monthStr = key.slice(colonIdx2 + 1)
        return upsertZelle(katId, { year: Number(yearStr), month: Number(monthStr), label: '' }, null)
      }))
      setSelectedCells(new Map())
      toast({ title: 'Zurückgesetzt', description: 'Produktverkäufe auf automatisch zurückgesetzt.' })
    } catch {
      toast({ title: 'Fehler', description: 'Zurücksetzen fehlgeschlagen.', variant: 'destructive' })
    } finally {
      setResettingPvToAuto(false)
    }
  }

  // ─── Notiz helpers ────────────────────────────────────────────────────────

  function getNotizCellLabel(editKey: string): string {
    // editKey: ${kategorieId}:${year}:${month}
    const parts = editKey.split(':')
    if (parts.length === 3) {
      const katId = parts[0]
      const year = parseInt(parts[1])
      const month = parseInt(parts[2])
      const monatLabel = monate.find(m => m.year === year && m.month === month)?.label
        ?? new Date(year, month - 1, 1).toLocaleDateString('de-DE', { month: 'short', year: 'numeric' })
      const name =
        kategorien.find(k => k.id === katId)?.name ??
        plattformen.find(p => p.id === katId)?.name ??
        katId
      return `${name} · ${monatLabel}`
    }
    return editKey
  }

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
        <p>Keine Einnahmen-Kategorien im KPI-Modell vorhanden.</p>
        <p>
          Bitte das{' '}
          <a href="/dashboard/kpi-modell" className="underline text-foreground">KPI-Modell konfigurieren</a>
          {' '}und Einnahmen-Kategorien anlegen.
        </p>
      </div>
    )
  }

  // ─── Row rendering helpers ────────────────────────────────────────────────

  // Returns { display, rawNum, indicator: 'gray' | 'blue' | null, isEditable } for a SOLL cell
  function getSollCellValue(row: FlatRow, monat: PlanungsMonat): {
    display: string; rawNum: number | null; indicator: 'gray' | 'blue' | null; isEditable: boolean
  } {
    // Platform row under PV — editable; manual (blue) overrides auto-calc (gray)
    if (row.plattformId && row.kategorieId) {
      const manual = getWert(row.kategorieId, monat)
      if (manual !== null) {
        return { display: formatNum(manual), rawNum: manual, indicator: 'blue', isEditable: true }
      }
      const auto = getProduktverkaeufeSoll(monat, row.plattformId)
      return {
        display: auto !== null ? formatNum(auto) : '',
        rawNum: auto,
        indicator: auto !== null ? 'gray' : null,
        isEditable: true,
      }
    }

    const isPvLeafRoot = row.kategorieId === produktverkaeufenKatId && !pvChildLeafIds.has(row.kategorieId ?? '')

    if (row.kind === 'leaf') {
      // PV leaf (L1 with no children, no platforms): auto-calc gray, manual blue
      if (isPvLeafRoot) {
        const manual = getWert(row.kategorieId!, monat)
        if (manual !== null) {
          return { display: formatNum(manual), rawNum: manual, indicator: 'blue', isEditable: true }
        }
        const auto = getProduktverkaeufeSoll(monat)
        return {
          display: auto !== null ? formatNum(auto) : '',
          rawNum: auto,
          indicator: auto !== null ? 'gray' : null,
          isEditable: true,
        }
      }

      // PV child (L2): manual only, blue if set
      if (row.isProduktverkaeufenSection) {
        const manual = getWert(row.kategorieId!, monat)
        return {
          display: manual !== null ? formatNum(manual) : '',
          rawNum: manual,
          indicator: manual !== null ? 'blue' : null,
          isEditable: true,
        }
      }

      // Regular leaf: manual, blue if set
      const v = getWert(row.kategorieId!, monat)
      return {
        display: v !== null ? formatNum(v) : '',
        rawNum: v,
        indicator: v !== null ? 'blue' : null,
        isEditable: true,
      }
    }

    // category-header (sum row) and total — not editable
    if (row.kind === 'category-header' || row.kind === 'total') {
      // PV header with platform breakdown: use getPvEffectiveTotal
      if (row.kind === 'category-header' && !!row.isProduktverkaeufenSection && plattformen.length > 0) {
        const { total, hasAny } = getPvEffectiveTotal(monat)
        return {
          display: hasAny ? formatNum(total) : '',
          rawNum: hasAny ? total : null,
          indicator: null,
          isEditable: false,
        }
      }

      const { total, hasAny } = getSollSum(
        row.childLeafIds!,
        row.isProduktverkaeufenSection === true && row.kind !== 'total',
        row.kind === 'total',
        monat,
      )
      return {
        display: hasAny ? formatNum(total) : '—',
        rawNum: hasAny ? total : null,
        indicator: null,
        isEditable: false,
      }
    }

    return { display: '', rawNum: null, indicator: null, isEditable: false }
  }

  // ─── Render ───────────────────────────────────────────────────────────────

  return (
    <TooltipProvider delayDuration={400}>
    <div data-betrag-selektion="true" className="space-y-4">

      {/* Toolbar */}
      <div className="flex items-center justify-between gap-2">
        <span className="text-sm text-muted-foreground">
          {monate.length > 0
            ? `${monate[0].label} – ${monate[monate.length - 1].label}`
            : ''}
        </span>
        <div className="flex items-center gap-2">
          {allExpandableIds.size > 0 && (
            <Button
              variant="ghost" size="sm"
              className="gap-1.5 text-xs text-muted-foreground"
              onClick={() => allExpanded
                ? setExpandedCategories(new Set())
                : setExpandedCategories(new Set(allExpandableIds))
              }
            >
              {allExpanded
                ? <><ChevronsDownUp className="h-3.5 w-3.5" />Alle einklappen</>
                : <><ChevronsUpDown className="h-3.5 w-3.5" />Alle ausklappen</>
              }
            </Button>
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
            <tr className="border-b bg-muted/40">
              <th className="sticky left-0 z-20 bg-muted min-w-[220px] max-w-[280px] px-3 py-2.5 text-left font-medium text-muted-foreground">
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
              const isHeader = row.kind === 'category-header'
              const isL1Leaf = row.kind === 'leaf' && row.indent === 0
              const rowBg = isTotal ? 'bg-muted/60'
                : (isHeader || isL1Leaf) ? 'bg-muted/30'
                : 'bg-white dark:bg-background'

              return (
                <tr key={row.id} className={['border-b last:border-0 hover:bg-muted/20 transition-colors', rowBg].join(' ')}>
                  {/* Label cell (sticky) */}
                  <td
                    className={[
                      'sticky left-0 z-10 px-3 py-1.5 whitespace-nowrap',
                      isTotal || isHeader || isL1Leaf ? 'bg-muted' : 'bg-white dark:bg-background',
                    ].join(' ')}
                    style={{ paddingLeft: `${12 + row.indent * 16}px` }}
                  >
                    {isHeader ? (
                      <button
                        type="button"
                        className="flex items-center gap-1 text-sm font-semibold hover:text-primary"
                        onClick={() =>
                          setExpandedCategories(prev => {
                            const next = new Set(prev)
                            if (next.has(row.l1KategorieId!)) next.delete(row.l1KategorieId!)
                            else next.add(row.l1KategorieId!)
                            return next
                          })
                        }
                      >
                        {row.expanded
                          ? <ChevronDown className="h-3.5 w-3.5 shrink-0" />
                          : <ChevronRight className="h-3.5 w-3.5 shrink-0" />}
                        {row.label}
                      </button>
                    ) : isL1Leaf ? (
                      <span className="flex items-center text-sm font-semibold pl-[18px]">
                        {row.label}
                      </span>
                    ) : (
                      <span className={isTotal ? 'text-sm font-semibold' : 'text-sm'}>
                        {row.label}
                      </span>
                    )}
                  </td>

                  {/* Month cells: Soll */}
                  {monate.map(monat => {
                    const { display, rawNum, indicator, isEditable } = getSollCellValue(row, monat)
                    const editKey = isEditable && row.kategorieId
                      ? kategorieMonatKey(row.kategorieId, monat.year, monat.month)
                      : null
                    const isCurrentlyEditing = editKey !== null && editingCell === editKey
                    const isSelected = editKey !== null
                      ? selectedCells.has(editKey)
                      : selectedCells.has(`row:${row.id}:${monat.year}:${monat.month}`)

                    const hasNotiz = editKey ? notizen.has(editKey) : false

                    return (
                      <td
                        key={`${monat.year}-${monat.month}`}
                        className={[
                          'relative px-2 py-1.5 text-right text-xs tabular-nums select-none border-l',
                          isSelected ? 'bg-blue-100 dark:bg-blue-900/30' : '',
                          isEditable ? 'cursor-pointer' : '',
                        ].join(' ')}
                        onClick={
                          isEditable && editKey && !isCurrentlyEditing
                            ? e => handleEditableCellClick(e, editKey, display)
                            : undefined
                        }
                        onMouseDown={
                          isEditable && editKey
                            ? e => handleEditableCellMouseDown(e, editKey, rawNum)
                            : !isEditable && rawNum !== null
                              ? e => handleNonEditableMouseDown(e, `row:${row.id}:${monat.year}:${monat.month}`, rawNum)
                              : undefined
                        }
                        onMouseEnter={
                          isEditable && editKey
                            ? () => handleEditableCellMouseEnter(editKey, rawNum)
                            : !isEditable && rawNum !== null
                              ? () => handleNonEditableMouseEnter(`row:${row.id}:${monat.year}:${monat.month}`, rawNum)
                              : undefined
                        }
                      >
                        {/* Note indicator */}
                        {hasNotiz && !isCurrentlyEditing && (
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
                              {(notizen.get(editKey!) ?? '').length > 300
                                ? (notizen.get(editKey!) ?? '').slice(0, 300) + '…'
                                : (notizen.get(editKey!) ?? '')}
                            </TooltipContent>
                          </Tooltip>
                        )}

                        {isCurrentlyEditing ? (
                          <input
                            autoFocus
                            type="number"
                            min="0"
                            step="any"
                            size={1}
                            className="absolute inset-0 w-full min-w-0 box-border px-2 text-right bg-background outline-none border-b border-primary text-xs tabular-nums [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                            value={editingValue}
                            onChange={e => setEditingValue(e.target.value)}
                            onBlur={() => handleCellBlur(row.kategorieId!, monat)}
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
                              <span
                                className={[
                                  'inline-block h-1.5 w-1.5 rounded-full shrink-0',
                                  indicator === 'gray' ? 'bg-muted-foreground/40' : 'bg-blue-500',
                                ].join(' ')}
                                title={indicator === 'gray' ? 'Automatisch berechnet' : 'Manuell eingegeben'}
                              />
                            )}
                            <span className={[
                              rawNum === null && !isEditable ? 'text-muted-foreground' : '',
                              isEditable && rawNum === null ? 'text-muted-foreground/40' : '',
                            ].join(' ')}>
                              {display || (isEditable ? '' : '—')}
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

      {/* Bottom-right floating panels */}
      {selectedCells.size > 0 && (
        <div
          data-betrag-selektion="true"
          className="fixed bottom-6 right-6 z-50 flex flex-col gap-2 items-stretch"
        >
          {/* Notiz panel — only for single editable cell */}
          {selectedCells.size === 1 && (() => {
            const key = Array.from(selectedCells.keys())[0]
            if (key.startsWith('row:')) return null
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

          {/* Reset PV to auto panel */}
          {hasManuellePvCellsSelected && (
            <div className="rounded-lg border bg-background shadow-lg text-sm">
              <button
                type="button"
                disabled={resettingPvToAuto}
                className="flex items-center gap-2 px-4 py-2.5 w-full hover:bg-muted/50 rounded-lg transition-colors disabled:opacity-50"
                onClick={handleResetPvToAuto}
              >
                <RotateCcw className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                <span>{resettingPvToAuto ? 'Wird zurückgesetzt…' : 'Auf automatisch zurücksetzen'}</span>
              </button>
            </div>
          )}

          {/* Betragsselektion panel */}
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
              Alle manuell eingegebenen Werte und Notizen dieser Planversion werden gelöscht.
              Automatisch berechnete Werte (Produktverkäufe) werden wiederhergestellt.
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
