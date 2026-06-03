'use client'

import { useState, useEffect, useRef, useCallback, useMemo } from 'react'
import { ChevronDown, ChevronRight, RotateCcw, Pencil } from 'lucide-react'
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
import { useToast } from '@/hooks/use-toast'
import { useAbsatzplanung, manuellerKey } from '@/hooks/use-absatzplanung'
import type { PlanungsWoche } from '@/hooks/use-absatzplanung'
import type { KpiCategory } from '@/hooks/use-kpi-categories'
import {
  AbsatzplanungBulkEditDialog,
  type BulkEditCell,
} from '@/components/absatzplanung-bulk-edit-dialog'

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatNum(v: number | null, decimals = 2): string {
  if (v === null) return '—'
  return v.toLocaleString('de-DE', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  })
}

function cellDataKey(
  produktId: string,
  plattformId: string,
  kwYear: number,
  kwWeek: number,
  field: 'absatz' | 'vk',
): string {
  return `${produktId}:${plattformId}:${kwYear}:${kwWeek}:${field}`
}

// ─── Row types ────────────────────────────────────────────────────────────────

type RowKind =
  | 'gesamt-absatz'
  | 'gesamt-vk'
  | 'gesamt-umsatz'
  | 'platform-header'
  | 'platform-absatz'
  | 'platform-vk'
  | 'platform-umsatz'
  | 'product-absatz'
  | 'product-vk'
  | 'product-umsatz'

interface FlatRow {
  id: string
  kind: RowKind
  label: string
  indent: number
  plattformId?: string
  produktId?: string
  expandable?: boolean
  expanded?: boolean
}

// ─── Aggregation helpers ───────────────────────────────────────────────────────

interface CellValues {
  absatz: number
  absatzIsManual: boolean
  vk: number | null
  vkIsManual: boolean
}

function computeUmsatz(absatz: number, vk: number | null): number | null {
  if (vk === null) return null
  return absatz * vk
}

function aggregatePlatformAbsatz(
  plattformId: string,
  kw: PlanungsWoche,
  produkte: KpiCategory[],
  aktiveKombis: Set<string>,
  getCellValues: (prdId: string, pltId: string, kw: PlanungsWoche) => CellValues,
): number {
  return produkte
    .filter(p => aktiveKombis.has(`${plattformId}:${p.id}`))
    .reduce((sum, p) => sum + getCellValues(p.id, plattformId, kw).absatz, 0)
}

function aggregatePlatformVK(
  plattformId: string,
  kw: PlanungsWoche,
  produkte: KpiCategory[],
  aktiveKombis: Set<string>,
  getCellValues: (prdId: string, pltId: string, kw: PlanungsWoche) => CellValues,
): number | null {
  const pairs = produkte
    .filter(p => aktiveKombis.has(`${plattformId}:${p.id}`))
    .map(p => getCellValues(p.id, plattformId, kw))
    .filter(cv => cv.vk !== null)
  if (pairs.length === 0) return null
  const totalAbsatz = pairs.reduce((s, cv) => s + cv.absatz, 0)
  if (totalAbsatz === 0) return null
  return pairs.reduce((s, cv) => s + cv.absatz * cv.vk!, 0) / totalAbsatz
}

// ─── Main component ───────────────────────────────────────────────────────────

export function AbsatzplanungTabelle() {
  const {
    wochen,
    plattformen,
    produkte,
    aktiveKombis,
    loading,
    error,
    isNewWeek,
    lastWoche,
    getAbsatz,
    getVK,
    upsertZelle,
    upsertBatch,
    resetAll,
  } = useAbsatzplanung()

  const { toast } = useToast()
  const [expandedPlatforms, setExpandedPlatforms] = useState<Set<string>>(new Set())
  const [resetDialogOpen, setResetDialogOpen] = useState(false)
  const [resetting, setResetting] = useState(false)

  // Betragsselektion
  const [selectedCells, setSelectedCells] = useState<Map<string, number>>(new Map())
  const isDragging = useRef(false)
  const selectionSum = Array.from(selectedCells.values()).reduce((a, b) => a + b, 0)

  // Bulk edit
  const [bulkEditOpen, setBulkEditOpen] = useState(false)

  // Inline editing: track which cell is being edited
  const [editingCell, setEditingCell] = useState<string | null>(null)
  const [editingValue, setEditingValue] = useState('')

  // Expand all platforms on first load
  useEffect(() => {
    if (!loading && plattformen.length > 0) {
      setExpandedPlatforms(new Set(plattformen.map(p => p.id)))
    }
  }, [loading, plattformen])

  // Betragsselektion: click outside clears selection
  useEffect(() => {
    function onMouseDown(e: MouseEvent) {
      if (!(e.target as Element).closest('[data-betrag-selektion]')) {
        setSelectedCells(new Map())
      }
    }
    function onMouseUp() {
      isDragging.current = false
    }
    document.addEventListener('mousedown', onMouseDown)
    document.addEventListener('mouseup', onMouseUp)
    return () => {
      document.removeEventListener('mousedown', onMouseDown)
      document.removeEventListener('mouseup', onMouseUp)
    }
  }, [])

  // ─── Cell value helper ───────────────────────────────────────────────────────

  const getCellValues = useCallback(
    (prdId: string, pltId: string, kw: PlanungsWoche): CellValues => {
      const a = getAbsatz(prdId, pltId, kw)
      const v = getVK(prdId, pltId, kw)
      return {
        absatz: a.value,
        absatzIsManual: a.isManual,
        vk: v.value,
        vkIsManual: v.isManual,
      }
    },
    [getAbsatz, getVK],
  )

  // ─── Flat rows ───────────────────────────────────────────────────────────────

  const activePlattformen = useMemo(
    () =>
      plattformen.filter(plt =>
        produkte.some(prd => aktiveKombis.has(`${plt.id}:${prd.id}`)),
      ),
    [plattformen, produkte, aktiveKombis],
  )

  const flatRows = useMemo((): FlatRow[] => {
    const rows: FlatRow[] = []

    rows.push({ id: 'gesamt-absatz', kind: 'gesamt-absatz', label: 'Absatz (Gesamt)', indent: 0 })
    rows.push({ id: 'gesamt-vk', kind: 'gesamt-vk', label: 'Effektiver VK (Gesamt)', indent: 0 })
    rows.push({
      id: 'gesamt-umsatz',
      kind: 'gesamt-umsatz',
      label: 'Ziel Brutto-Umsatz (Gesamt)',
      indent: 0,
    })

    for (const plt of activePlattformen) {
      const expanded = expandedPlatforms.has(plt.id)
      rows.push({
        id: `plt-header-${plt.id}`,
        kind: 'platform-header',
        label: plt.name,
        indent: 0,
        plattformId: plt.id,
        expandable: true,
        expanded,
      })
      rows.push({
        id: `plt-absatz-${plt.id}`,
        kind: 'platform-absatz',
        label: 'Absatz',
        indent: 1,
        plattformId: plt.id,
      })
      rows.push({
        id: `plt-vk-${plt.id}`,
        kind: 'platform-vk',
        label: 'Effektiver VK',
        indent: 1,
        plattformId: plt.id,
      })
      rows.push({
        id: `plt-umsatz-${plt.id}`,
        kind: 'platform-umsatz',
        label: 'Ziel Brutto-Umsatz',
        indent: 1,
        plattformId: plt.id,
      })

      if (expanded) {
        const aktivePrd = produkte.filter(p => aktiveKombis.has(`${plt.id}:${p.id}`))
        for (const prd of aktivePrd) {
          rows.push({
            id: `prd-absatz-${plt.id}-${prd.id}`,
            kind: 'product-absatz',
            label: prd.name,
            indent: 2,
            plattformId: plt.id,
            produktId: prd.id,
          })
          rows.push({
            id: `prd-vk-${plt.id}-${prd.id}`,
            kind: 'product-vk',
            label: '↳ Effektiver VK',
            indent: 2,
            plattformId: plt.id,
            produktId: prd.id,
          })
          rows.push({
            id: `prd-umsatz-${plt.id}-${prd.id}`,
            kind: 'product-umsatz',
            label: '↳ Ziel Brutto-Umsatz',
            indent: 2,
            plattformId: plt.id,
            produktId: prd.id,
          })
        }
      }
    }

    return rows
  }, [activePlattformen, expandedPlatforms, produkte, aktiveKombis])

  // ─── Cell value for a row × week ─────────────────────────────────────────────

  function getRowValue(
    row: FlatRow,
    kw: PlanungsWoche,
  ): { display: string; rawNum: number | null; isManual: boolean; isEditable: boolean } {
    switch (row.kind) {
      case 'product-absatz': {
        const { absatz, absatzIsManual } = getCellValues(row.produktId!, row.plattformId!, kw)
        return {
          display: formatNum(absatz),
          rawNum: absatz,
          isManual: absatzIsManual,
          isEditable: true,
        }
      }
      case 'product-vk': {
        const { vk, vkIsManual } = getCellValues(row.produktId!, row.plattformId!, kw)
        return {
          display: vk !== null ? formatNum(vk) : '',
          rawNum: vk,
          isManual: vkIsManual,
          isEditable: true,
        }
      }
      case 'product-umsatz': {
        const cv = getCellValues(row.produktId!, row.plattformId!, kw)
        const u = computeUmsatz(cv.absatz, cv.vk)
        return { display: u !== null ? formatNum(u) : '—', rawNum: u, isManual: false, isEditable: false }
      }
      case 'platform-absatz': {
        const val = aggregatePlatformAbsatz(row.plattformId!, kw, produkte, aktiveKombis, getCellValues)
        return { display: formatNum(val), rawNum: val, isManual: false, isEditable: false }
      }
      case 'platform-vk': {
        const val = aggregatePlatformVK(row.plattformId!, kw, produkte, aktiveKombis, getCellValues)
        return {
          display: val !== null ? formatNum(val) : '—',
          rawNum: val,
          isManual: false,
          isEditable: false,
        }
      }
      case 'platform-umsatz': {
        const absatz = aggregatePlatformAbsatz(row.plattformId!, kw, produkte, aktiveKombis, getCellValues)
        const vk = aggregatePlatformVK(row.plattformId!, kw, produkte, aktiveKombis, getCellValues)
        const u = computeUmsatz(absatz, vk)
        return { display: u !== null ? formatNum(u) : '—', rawNum: u, isManual: false, isEditable: false }
      }
      case 'gesamt-absatz': {
        const val = activePlattformen.reduce(
          (sum, plt) =>
            sum + aggregatePlatformAbsatz(plt.id, kw, produkte, aktiveKombis, getCellValues),
          0,
        )
        return { display: formatNum(val), rawNum: val, isManual: false, isEditable: false }
      }
      case 'gesamt-vk': {
        // Weighted average over all platforms
        let totalAbsatz = 0
        let weightedVK = 0
        for (const plt of activePlattformen) {
          const pltAbsatz = aggregatePlatformAbsatz(plt.id, kw, produkte, aktiveKombis, getCellValues)
          const pltVK = aggregatePlatformVK(plt.id, kw, produkte, aktiveKombis, getCellValues)
          if (pltVK !== null) {
            weightedVK += pltAbsatz * pltVK
            totalAbsatz += pltAbsatz
          }
        }
        const val = totalAbsatz > 0 ? weightedVK / totalAbsatz : null
        return { display: val !== null ? formatNum(val) : '—', rawNum: val, isManual: false, isEditable: false }
      }
      case 'gesamt-umsatz': {
        let total = 0
        let hasValue = false
        for (const plt of activePlattformen) {
          for (const prd of produkte.filter(p => aktiveKombis.has(`${plt.id}:${p.id}`))) {
            const cv = getCellValues(prd.id, plt.id, kw)
            const u = computeUmsatz(cv.absatz, cv.vk)
            if (u !== null) { total += u; hasValue = true }
          }
        }
        return { display: hasValue ? formatNum(total) : '—', rawNum: hasValue ? total : null, isManual: false, isEditable: false }
      }
      default:
        return { display: '', rawNum: null, isManual: false, isEditable: false }
    }
  }

  // ─── Selection interaction ────────────────────────────────────────────────────

  function handleCellMouseDown(e: React.MouseEvent, key: string, value: number) {
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
    setSelectedCells(prev =>
      prev.has(key) ? prev : new Map([...prev, [key, value]]),
    )
  }

  // Determine if bulk edit is available (same editable type selected, ≥ 2)
  const bulkEditType = useMemo((): 'absatz' | 'vk' | null => {
    const keys = Array.from(selectedCells.keys())
    if (keys.length < 2) return null
    const types = new Set(keys.map(k => (k.endsWith(':absatz') ? 'absatz' : k.endsWith(':vk') ? 'vk' : 'other')))
    if (types.has('other')) return null
    if (types.size === 1) return (types.values().next().value as 'absatz' | 'vk')
    return null
  }, [selectedCells])

  const bulkEditCells = useMemo((): BulkEditCell[] => {
    if (!bulkEditType) return []
    const result: BulkEditCell[] = []
    for (const [key, value] of selectedCells) {
      // key format: produktId:plattformId:year:week:field
      const parts = key.split(':')
      if (parts.length < 5) continue
      const field = parts[parts.length - 1] as 'absatz' | 'vk'
      const kwWeek = parseInt(parts[parts.length - 2])
      const kwYear = parseInt(parts[parts.length - 3])
      const plattformId = parts[parts.length - 4]
      const produktId = parts.slice(0, parts.length - 4).join(':')
      const kw = wochen.find(w => w.year === kwYear && w.week === kwWeek)
      if (!kw) continue
      result.push({ produktId, plattformId, kw, currentValue: value, field })
    }
    return result
  }, [bulkEditType, selectedCells, wochen])

  // ─── Inline edit ──────────────────────────────────────────────────────────────

  function handleCellClick(
    e: React.MouseEvent,
    row: FlatRow,
    kw: PlanungsWoche,
    currentDisplay: string,
  ) {
    if (!row.produktId || !row.plattformId) return
    const field = row.kind === 'product-absatz' ? 'absatz' : row.kind === 'product-vk' ? 'vk' : null
    if (!field) return
    e.stopPropagation()
    const key = `${row.produktId}:${row.plattformId}:${kw.year}:${kw.week}:${field}`
    setEditingCell(key)
    setEditingValue(currentDisplay === '—' ? '' : currentDisplay.replace(',', '.'))
  }

  async function handleCellBlur(row: FlatRow, kw: PlanungsWoche) {
    if (!editingCell || !row.produktId || !row.plattformId) {
      setEditingCell(null)
      return
    }
    const field = row.kind === 'product-absatz' ? 'absatz' : 'vk'
    const parsed = editingValue.trim() === '' ? null : parseFloat(editingValue.replace(',', '.'))
    setEditingCell(null)
    setEditingValue('')
    if (editingValue.trim() !== '' && (parsed === null || isNaN(parsed) || parsed < 0)) return
    try {
      await upsertZelle(row.produktId, row.plattformId, kw, field, parsed)
    } catch {
      toast({ title: 'Fehler beim Speichern', description: 'Wert konnte nicht gespeichert werden.', variant: 'destructive' })
    }
  }

  // ─── Bulk edit apply ──────────────────────────────────────────────────────────

  async function handleBulkApply(
    results: Array<{ produktId: string; plattformId: string; kw: PlanungsWoche; newValue: number }>,
  ) {
    const field = bulkEditType!
    try {
      await upsertBatch(results.map(r => ({ ...r, field, value: r.newValue })))
      setSelectedCells(new Map())
    } catch {
      toast({ title: 'Fehler', description: 'Massen-Anpassung konnte nicht gespeichert werden.', variant: 'destructive' })
    }
  }

  // ─── Reset ────────────────────────────────────────────────────────────────────

  async function handleReset() {
    setResetting(true)
    try {
      await resetAll()
      setSelectedCells(new Map())
      toast({ title: 'Zurückgesetzt', description: 'Alle manuellen Werte wurden entfernt.' })
    } catch {
      toast({ title: 'Fehler', description: 'Zurücksetzen fehlgeschlagen.', variant: 'destructive' })
    } finally {
      setResetting(false)
      setResetDialogOpen(false)
    }
  }

  // ─── Loading / Error / Empty ──────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="space-y-2">
        {Array.from({ length: 8 }).map((_, i) => (
          <Skeleton key={i} className="h-8 w-full" />
        ))}
      </div>
    )
  }

  if (error) {
    return <p className="text-sm text-destructive">{error}</p>
  }

  if (activePlattformen.length === 0) {
    return (
      <div className="rounded-md border p-8 text-center text-muted-foreground text-sm space-y-2">
        <p>Keine Produkte zur Planung vorhanden.</p>
        <p>
          Bitte in den{' '}
          <a
            href="/dashboard/kurzfristige-planung/absatzeinstellungen"
            className="underline text-foreground"
          >
            Absatzeinstellungen
          </a>{' '}
          mindestens eine Berechnungsart konfigurieren.
        </p>
      </div>
    )
  }

  // ─── Render ───────────────────────────────────────────────────────────────────

  return (
    <div data-betrag-selektion="true" className="space-y-4">
      {/* Toolbar */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          {wochen.length > 0 && (
            <span>
              {wochen[0].label} – {wochen[wochen.length - 1].label}
            </span>
          )}
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => setResetDialogOpen(true)}
          disabled={resetting}
        >
          <RotateCcw className="h-3.5 w-3.5 mr-1.5" />
          Zurücksetzen
        </Button>
      </div>

      {/* Table */}
      <div className="overflow-x-auto rounded-md border">
        <table className="w-full text-sm border-collapse">
          <thead>
            <tr className="border-b bg-muted/40">
              {/* Sticky label column */}
              <th className="sticky left-0 z-20 bg-muted/40 min-w-[220px] max-w-[280px] px-3 py-2.5 text-left font-medium text-muted-foreground">
                Metrik
              </th>
              {wochen.map(kw => {
                const isNew = isNewWeek && lastWoche && kw.year === lastWoche.year && kw.week === lastWoche.week
                return (
                  <th
                    key={`${kw.year}-${kw.week}`}
                    className={[
                      'min-w-[90px] px-2 py-2.5 text-right font-medium text-xs',
                      isNew
                        ? 'bg-red-50 text-red-700 dark:bg-red-950/30 dark:text-red-400'
                        : 'text-muted-foreground',
                    ].join(' ')}
                  >
                    {kw.label}
                    {isNew && (
                      <span className="block text-[10px] font-normal">Neue Woche</span>
                    )}
                  </th>
                )
              })}
            </tr>
          </thead>
          <tbody>
            {flatRows.map(row => {
              const isHeader = row.kind === 'platform-header'
              const isGesamt = row.kind.startsWith('gesamt-')
              const isPlatform = row.kind.startsWith('platform-') && !isHeader
              const isProductRow = row.kind.startsWith('product-')
              const isEditable = row.kind === 'product-absatz' || row.kind === 'product-vk'

              const rowBg = isGesamt
                ? 'bg-muted/60'
                : isHeader
                ? 'bg-muted/30 font-medium'
                : isPlatform
                ? 'bg-white dark:bg-background'
                : 'bg-white dark:bg-background'

              return (
                <tr
                  key={row.id}
                  className={[
                    'border-b last:border-0 hover:bg-muted/20 transition-colors',
                    rowBg,
                  ].join(' ')}
                >
                  {/* Label cell */}
                  <td
                    className={[
                      'sticky left-0 z-10 px-3 py-1.5 text-sm whitespace-nowrap',
                      isGesamt ? 'bg-muted/60 font-medium' : isHeader ? 'bg-muted/30 font-semibold' : isPlatform ? 'bg-white dark:bg-background text-muted-foreground' : 'bg-white dark:bg-background',
                    ].join(' ')}
                    style={{ paddingLeft: `${12 + row.indent * 16}px` }}
                  >
                    {isHeader ? (
                      <button
                        type="button"
                        className="flex items-center gap-1 hover:text-primary"
                        onClick={() =>
                          setExpandedPlatforms(prev => {
                            const next = new Set(prev)
                            if (next.has(row.plattformId!)) next.delete(row.plattformId!)
                            else next.add(row.plattformId!)
                            return next
                          })
                        }
                      >
                        {row.expanded ? (
                          <ChevronDown className="h-3.5 w-3.5 shrink-0" />
                        ) : (
                          <ChevronRight className="h-3.5 w-3.5 shrink-0" />
                        )}
                        {row.label}
                      </button>
                    ) : (
                      <span className={isProductRow && row.kind === 'product-absatz' ? 'font-medium' : 'text-muted-foreground text-xs'}>
                        {row.label}
                      </span>
                    )}
                  </td>

                  {/* Value cells */}
                  {wochen.map(kw => {
                    const { display, rawNum, isManual, isEditable: cellEditable } = getRowValue(row, kw)
                    const isNew = isNewWeek && lastWoche && kw.year === lastWoche.year && kw.week === lastWoche.week
                    const editKey = row.produktId && row.plattformId
                      ? cellDataKey(row.produktId, row.plattformId, kw.year, kw.week,
                          row.kind === 'product-absatz' ? 'absatz' : 'vk')
                      : null
                    const isCurrentlyEditing = editKey !== null && editingCell === editKey
                    const isSelected = editKey !== null && selectedCells.has(editKey)

                    return (
                      <td
                        key={`${kw.year}-${kw.week}`}
                        className={[
                          'px-2 py-1.5 text-right text-xs tabular-nums select-none',
                          isNew && cellEditable ? 'bg-red-50 dark:bg-red-950/10' : '',
                          isSelected ? 'bg-blue-100 dark:bg-blue-900/30 rounded' : '',
                          cellEditable ? 'cursor-pointer' : '',
                        ].join(' ')}
                        onMouseDown={
                          rawNum !== null && !isEditable
                            ? e => handleCellMouseDown(e, `row:${row.id}:${kw.year}:${kw.week}`, rawNum)
                            : undefined
                        }
                        onMouseEnter={
                          rawNum !== null && !isEditable
                            ? () => handleCellMouseEnter(`row:${row.id}:${kw.year}:${kw.week}`, rawNum)
                            : undefined
                        }
                        onClick={
                          cellEditable
                            ? e => handleCellClick(e, row, kw, display)
                            : undefined
                        }
                      >
                        {isCurrentlyEditing ? (
                          <input
                            autoFocus
                            type="number"
                            min="0"
                            step="any"
                            className="w-full text-right bg-transparent outline-none border-b border-primary text-xs tabular-nums"
                            value={editingValue}
                            onChange={e => setEditingValue(e.target.value)}
                            onBlur={() => handleCellBlur(row, kw)}
                            onKeyDown={e => {
                              if (e.key === 'Enter') (e.target as HTMLInputElement).blur()
                              if (e.key === 'Escape') {
                                setEditingCell(null)
                                setEditingValue('')
                              }
                            }}
                            onMouseDown={e => e.stopPropagation()}
                          />
                        ) : (
                          <div
                            className={[
                              'flex items-center justify-end gap-1',
                              isNew && cellEditable ? 'ring-1 ring-red-300 dark:ring-red-700 rounded px-1' : '',
                            ].join(' ')}
                            onMouseDown={
                              cellEditable && editKey && rawNum !== null
                                ? e => handleCellMouseDown(e, editKey, rawNum)
                                : undefined
                            }
                            onMouseEnter={
                              cellEditable && editKey && rawNum !== null
                                ? () => handleCellMouseEnter(editKey, rawNum)
                                : undefined
                            }
                          >
                            {/* Manual / historical indicator */}
                            {cellEditable && (
                              <span
                                className={[
                                  'inline-block w-1.5 h-1.5 rounded-full shrink-0',
                                  isManual
                                    ? 'bg-blue-500'
                                    : 'bg-gray-300 dark:bg-gray-600',
                                ].join(' ')}
                                title={isManual ? 'Manuell eingegeben' : 'Historisch berechnet'}
                              />
                            )}
                            <span>{display || (cellEditable ? '—' : display)}</span>
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

      {/* Bulk edit toolbar */}
      {bulkEditType && (
        <div
          data-betrag-selektion="true"
          className="fixed bottom-20 right-6 z-40 flex items-center gap-2 rounded-lg border bg-background px-4 py-2 shadow-lg text-sm"
        >
          <Pencil className="h-3.5 w-3.5 text-muted-foreground" />
          <span className="text-muted-foreground">
            {selectedCells.size} {bulkEditType === 'absatz' ? 'Absatz' : 'VK'}-Felder ausgewählt
          </span>
          <Button size="sm" onClick={() => setBulkEditOpen(true)}>
            Anpassen
          </Button>
        </div>
      )}

      {/* Betragsselektion panel */}
      {selectedCells.size > 0 && (
        <div
          data-betrag-selektion="true"
          className="fixed bottom-6 right-6 z-50 flex flex-col gap-1 rounded-lg border bg-background px-4 py-2.5 shadow-lg text-sm"
        >
          <span className="text-xs text-muted-foreground">
            {selectedCells.size} Feld{selectedCells.size !== 1 ? 'er' : ''} ausgewählt
          </span>
          <span className="font-medium tabular-nums">
            Summe:{' '}
            {selectionSum.toLocaleString('de-DE', {
              minimumFractionDigits: 2,
              maximumFractionDigits: 2,
            })}
          </span>
        </div>
      )}

      {/* Bulk edit dialog */}
      <AbsatzplanungBulkEditDialog
        open={bulkEditOpen}
        onClose={() => setBulkEditOpen(false)}
        cells={bulkEditCells}
        cellType={bulkEditType ?? 'absatz'}
        onApply={handleBulkApply}
      />

      {/* Reset confirm dialog */}
      <AlertDialog open={resetDialogOpen} onOpenChange={setResetDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Planung zurücksetzen?</AlertDialogTitle>
            <AlertDialogDescription>
              Alle manuell eingegebenen Werte werden entfernt. Die Felder zeigen wieder die
              historisch berechneten Absatzwerte. VK-Felder werden geleert. Diese Aktion kann
              nicht rückgängig gemacht werden.
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
  )
}
