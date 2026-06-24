'use client'

import { useState, useEffect, useRef, useCallback, useMemo } from 'react'
import { ChevronDown, ChevronRight, RefreshCw, RotateCcw, Pencil, StickyNote } from 'lucide-react'
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
import { useAbsatzplanung, skuAbsatzKey, produktVKKey } from '@/hooks/use-absatzplanung'
import type { PlanungsWoche } from '@/hooks/use-absatzplanung'
import type { KpiCategory } from '@/hooks/use-kpi-categories'
import {
  AbsatzplanungBulkEditDialog,
  type BulkEditCell,
  type BulkEditResult,
} from '@/components/absatzplanung-bulk-edit-dialog'
import { usePlanungNotizen } from '@/hooks/use-planung-notizen'
import { PlanungNotizFormular } from '@/components/planung-notiz-formular'
import { HistorischRefreshDialog } from '@/components/historisch-refresh-dialog'

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatNum(v: number | null, decimals = 2): string {
  if (v === null) return '—'
  return v.toLocaleString('de-DE', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  })
}

function skuCellKey(skuId: string, plattformId: string, kwYear: number, kwWeek: number): string {
  return skuAbsatzKey(skuId, plattformId, kwYear, kwWeek) + ':absatz'
}

function vkCellKey(produktId: string, plattformId: string, kwYear: number, kwWeek: number): string {
  return produktVKKey(produktId, plattformId, kwYear, kwWeek) + ':vk'
}

// Returns the Date of the Thursday of the given ISO week (Thursday rule: majority of days determines the month)
function thursdayOfISOWeek(year: number, week: number): Date {
  const jan4 = new Date(Date.UTC(year, 0, 4))
  const dayOfWeek = jan4.getUTCDay() || 7
  const mondayWeek1 = new Date(jan4.getTime() - (dayOfWeek - 1) * 86_400_000)
  return new Date(mondayWeek1.getTime() + (week - 1) * 7 * 86_400_000 + 3 * 86_400_000)
}

// ─── Row types ────────────────────────────────────────────────────────────────

type RowKind =
  | 'gesamt-absatz'
  | 'gesamt-product-absatz'
  | 'gesamt-umsatz'
  | 'gesamt-product-umsatz'
  | 'platform-header'
  | 'platform-absatz'
  | 'platform-umsatz'
  | 'product-absatz'   // non-editable aggregate, expandable to show SKUs
  | 'sku-absatz'       // editable per SKU
  | 'product-vk'
  | 'product-umsatz'

interface FlatRow {
  id: string
  kind: RowKind
  label: string
  indent: number
  plattformId?: string
  produktId?: string
  skuId?: string
  expandable?: boolean
  expanded?: boolean
}

// ─── Aggregation helpers ───────────────────────────────────────────────────────

interface CellValues {
  absatz: number
  vk: number | null
  vkIsManual: boolean
}

function computeUmsatz(absatz: number, vk: number | null): number | null {
  if (vk === null) return null
  return absatz * vk
}

// ─── Main component ───────────────────────────────────────────────────────────

export function AbsatzplanungTabelle() {
  const {
    wochen,
    plattformen,
    produkte,
    skusByProdukt,
    aktiveKombis,
    loading,
    error,
    isNewWeek,
    lastWoche,
    getSkuAbsatz,
    getProductAbsatz,
    getVK,
    getBestandVerlauf,
    upsertSkuAbsatz,
    upsertVK,
    upsertBatch,
    resetSkuAbsatzToCalc,
    resetAll,
    isRefreshing,
    refreshAutomatischWerte,
  } = useAbsatzplanung()

  const { toast } = useToast()
  const [expandedPlatforms, setExpandedPlatforms] = useState<Set<string>>(new Set())
  const [expandedProducts, setExpandedProducts] = useState<Set<string>>(new Set())
  const [gesamtAbsatzExpanded, setGesamtAbsatzExpanded] = useState(false)
  const [gesamtUmsatzExpanded, setGesamtUmsatzExpanded] = useState(false)
  const [resetDialogOpen, setResetDialogOpen] = useState(false)
  const [resetting, setResetting] = useState(false)
  const [refreshDialogOpen, setRefreshDialogOpen] = useState(false)

  // Betragsselektion / multi-select
  const [selectedCells, setSelectedCells] = useState<Map<string, number>>(new Map())
  // Tracks whether each selected SKU-absatz cell is manually set
  const [selectedCellsIsManual, setSelectedCellsIsManual] = useState<Map<string, boolean>>(new Map())
  const [resettingToCalc, setResettingToCalc] = useState(false)
  const isDragging = useRef(false)
  const selectionSum = Array.from(selectedCells.values()).reduce((a, b) => a + b, 0)

  // Bulk edit
  const [bulkEditOpen, setBulkEditOpen] = useState(false)

  // Notizen
  const { notizen, upsertNotiz, deleteNotiz, resetNotizen } = usePlanungNotizen('absatzplanung')
  const [notizFormularOpen, setNotizFormularOpen] = useState(false)
  const notizCellKeyRef = useRef<string>('')
  const notizCellLabelRef = useRef<string>('')

  // Inline editing
  const [editingCell, setEditingCellState] = useState<string | null>(null)
  const editingCellRef = useRef<string | null>(null)
  const [editingValue, setEditingValue] = useState('')
  const editingOriginalValue = useRef<string>('')

  function setEditingCell(key: string | null) {
    editingCellRef.current = key
    setEditingCellState(key)
  }

  // Expand all platforms on first load
  useEffect(() => {
    if (!loading && plattformen.length > 0) {
      setExpandedPlatforms(new Set(plattformen.map(p => p.id)))
    }
  }, [loading, plattformen])

  useEffect(() => {
    function onMouseDown(e: MouseEvent) {
      if (bulkEditOpen) return
      const target = e.target as Element
      if (target.closest('[data-betrag-selektion]')) return
      setSelectedCells(new Map())
      setSelectedCellsIsManual(new Map())
    }
    function onMouseUp() { isDragging.current = false }
    document.addEventListener('mousedown', onMouseDown)
    document.addEventListener('mouseup', onMouseUp)
    return () => {
      document.removeEventListener('mousedown', onMouseDown)
      document.removeEventListener('mouseup', onMouseUp)
    }
  }, [bulkEditOpen])

  // ─── Month groups ────────────────────────────────────────────────────────────

  const monthGroups = useMemo(() => {
    const groups: { label: string; count: number }[] = []
    for (const kw of wochen) {
      const thursday = thursdayOfISOWeek(kw.year, kw.week)
      const label = thursday.toLocaleString('de-DE', { month: 'long', year: 'numeric' })
      if (groups.length === 0 || groups[groups.length - 1].label !== label) {
        groups.push({ label, count: 1 })
      } else {
        groups[groups.length - 1].count++
      }
    }
    return groups
  }, [wochen])

  // ─── Cell value helper (product-level, for aggregation) ─────────────────────

  const getCellValues = useCallback(
    (prdId: string, pltId: string, kw: PlanungsWoche): CellValues => {
      const absatz = getProductAbsatz(prdId, pltId, kw)
      const v = getVK(prdId, pltId, kw)
      return { absatz, vk: v.value, vkIsManual: v.isManual }
    },
    [getProductAbsatz, getVK],
  )

  // ─── Aggregation helpers ─────────────────────────────────────────────────────

  const aggregatePlatformAbsatz = useCallback(
    (plattformId: string, kw: PlanungsWoche, prodList: KpiCategory[]): number => {
      return prodList
        .filter(p => aktiveKombis.has(`${plattformId}:${p.id}`))
        .reduce((sum, p) => sum + getProductAbsatz(p.id, plattformId, kw), 0)
    },
    [aktiveKombis, getProductAbsatz],
  )

  const aggregatePlatformVK = useCallback(
    (plattformId: string, kw: PlanungsWoche, prodList: KpiCategory[]): number | null => {
      const pairs = prodList
        .filter(p => aktiveKombis.has(`${plattformId}:${p.id}`))
        .map(p => getCellValues(p.id, plattformId, kw))
        .filter(cv => cv.vk !== null)
      if (pairs.length === 0) return null
      const totalAbsatz = pairs.reduce((s, cv) => s + cv.absatz, 0)
      if (totalAbsatz === 0) return null
      return pairs.reduce((s, cv) => s + cv.absatz * cv.vk!, 0) / totalAbsatz
    },
    [aktiveKombis, getCellValues],
  )

  // ─── Flat rows ───────────────────────────────────────────────────────────────

  const activePlattformen = useMemo(
    () => plattformen.filter(plt => produkte.some(prd => aktiveKombis.has(`${plt.id}:${prd.id}`))),
    [plattformen, produkte, aktiveKombis],
  )

  const refreshDialogProdukte = useMemo(
    () => produkte.filter(prd => activePlattformen.some(plt => aktiveKombis.has(`${plt.id}:${prd.id}`))),
    [produkte, activePlattformen, aktiveKombis],
  )

  const flatRows = useMemo((): FlatRow[] => {
    const rows: FlatRow[] = []

    rows.push({ id: 'gesamt-absatz', kind: 'gesamt-absatz', label: 'Absatz (Gesamt)', indent: 0, expandable: true, expanded: gesamtAbsatzExpanded })
    if (gesamtAbsatzExpanded) {
      const aktiveProdukte = produkte.filter(prd =>
        activePlattformen.some(plt => aktiveKombis.has(`${plt.id}:${prd.id}`)),
      )
      for (const prd of aktiveProdukte) {
        rows.push({ id: `gesamt-prd-${prd.id}`, kind: 'gesamt-product-absatz', label: prd.name, indent: 1, produktId: prd.id })
      }
    }
    rows.push({ id: 'gesamt-umsatz', kind: 'gesamt-umsatz', label: 'Ziel Brutto-Umsatz (Gesamt)', indent: 0, expandable: true, expanded: gesamtUmsatzExpanded })
    if (gesamtUmsatzExpanded) {
      const aktiveProdukte = produkte.filter(prd =>
        activePlattformen.some(plt => aktiveKombis.has(`${plt.id}:${prd.id}`)),
      )
      for (const prd of aktiveProdukte) {
        rows.push({ id: `gesamt-umsatz-prd-${prd.id}`, kind: 'gesamt-product-umsatz', label: prd.name, indent: 1, produktId: prd.id })
      }
    }

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
      rows.push({ id: `plt-absatz-${plt.id}`, kind: 'platform-absatz', label: 'Absatz', indent: 1, plattformId: plt.id })
      rows.push({ id: `plt-umsatz-${plt.id}`, kind: 'platform-umsatz', label: 'Ziel Brutto-Umsatz', indent: 1, plattformId: plt.id })

      if (expanded) {
        const aktivePrd = produkte.filter(p => aktiveKombis.has(`${plt.id}:${p.id}`))
        for (const prd of aktivePrd) {
          const productKey = `${plt.id}:${prd.id}`
          const productExpanded = expandedProducts.has(productKey)
          const skus = skusByProdukt.get(prd.id) ?? []

          rows.push({
            id: `prd-absatz-${plt.id}-${prd.id}`,
            kind: 'product-absatz',
            label: `${prd.name} - Absatz`,
            indent: 2,
            plattformId: plt.id,
            produktId: prd.id,
            expandable: skus.length > 0,
            expanded: productExpanded,
          })

          if (productExpanded) {
            for (const sku of skus) {
              rows.push({
                id: `sku-absatz-${plt.id}-${prd.id}-${sku.id}`,
                kind: 'sku-absatz',
                label: sku.name,
                indent: 3,
                plattformId: plt.id,
                produktId: prd.id,
                skuId: sku.id,
              })
            }
          }

          rows.push({ id: `prd-vk-${plt.id}-${prd.id}`, kind: 'product-vk', label: `${prd.name} - Effektiver VK`, indent: 2, plattformId: plt.id, produktId: prd.id })
          rows.push({ id: `prd-umsatz-${plt.id}-${prd.id}`, kind: 'product-umsatz', label: `${prd.name} - Ziel Brutto-Umsatz`, indent: 2, plattformId: plt.id, produktId: prd.id })
        }
      }
    }

    return rows
  }, [activePlattformen, expandedPlatforms, expandedProducts, produkte, skusByProdukt, aktiveKombis, gesamtAbsatzExpanded, gesamtUmsatzExpanded])

  // ─── Cell value for a row × week ─────────────────────────────────────────────

  function getRowValue(
    row: FlatRow,
    kw: PlanungsWoche,
  ): { display: string; rawNum: number | null; isManual: boolean; isEditable: boolean } {
    switch (row.kind) {
      case 'sku-absatz': {
        const { value, isManual } = getSkuAbsatz(row.skuId!, row.plattformId!, kw)
        return { display: formatNum(value), rawNum: value, isManual, isEditable: true }
      }
      case 'product-absatz': {
        const val = getProductAbsatz(row.produktId!, row.plattformId!, kw)
        return { display: formatNum(val), rawNum: val, isManual: false, isEditable: false }
      }
      case 'product-vk': {
        const { value, isManual } = getVK(row.produktId!, row.plattformId!, kw)
        return { display: value !== null ? formatNum(value) : '', rawNum: value, isManual, isEditable: true }
      }
      case 'product-umsatz': {
        const absatz = getProductAbsatz(row.produktId!, row.plattformId!, kw)
        const vk = getVK(row.produktId!, row.plattformId!, kw).value
        const u = computeUmsatz(absatz, vk)
        return { display: u !== null ? formatNum(u) : '—', rawNum: u, isManual: false, isEditable: false }
      }
      case 'platform-absatz': {
        const val = aggregatePlatformAbsatz(row.plattformId!, kw, produkte)
        return { display: formatNum(val), rawNum: val, isManual: false, isEditable: false }
      }
      case 'platform-umsatz': {
        let total = 0; let hasValue = false
        for (const prd of produkte.filter(p => aktiveKombis.has(`${row.plattformId!}:${p.id}`))) {
          const cv = getCellValues(prd.id, row.plattformId!, kw)
          const u = computeUmsatz(cv.absatz, cv.vk)
          if (u !== null) { total += u; hasValue = true }
        }
        return { display: hasValue ? formatNum(total) : '—', rawNum: hasValue ? total : null, isManual: false, isEditable: false }
      }
      case 'gesamt-absatz': {
        const val = activePlattformen.reduce(
          (sum, plt) => sum + aggregatePlatformAbsatz(plt.id, kw, produkte),
          0,
        )
        return { display: formatNum(val), rawNum: val, isManual: false, isEditable: false }
      }
      case 'gesamt-product-absatz': {
        const val = activePlattformen
          .filter(plt => aktiveKombis.has(`${plt.id}:${row.produktId!}`))
          .reduce((sum, plt) => sum + getProductAbsatz(row.produktId!, plt.id, kw), 0)
        return { display: formatNum(val), rawNum: val, isManual: false, isEditable: false }
      }
      case 'gesamt-umsatz': {
        let total = 0; let hasValue = false
        for (const plt of activePlattformen) {
          for (const prd of produkte.filter(p => aktiveKombis.has(`${plt.id}:${p.id}`))) {
            const cv = getCellValues(prd.id, plt.id, kw)
            const u = computeUmsatz(cv.absatz, cv.vk)
            if (u !== null) { total += u; hasValue = true }
          }
        }
        return { display: hasValue ? formatNum(total) : '—', rawNum: hasValue ? total : null, isManual: false, isEditable: false }
      }
      case 'gesamt-product-umsatz': {
        let total = 0; let hasValue = false
        for (const plt of activePlattformen.filter(p => aktiveKombis.has(`${p.id}:${row.produktId!}`))) {
          const cv = getCellValues(row.produktId!, plt.id, kw)
          const u = computeUmsatz(cv.absatz, cv.vk)
          if (u !== null) { total += u; hasValue = true }
        }
        return { display: hasValue ? formatNum(total) : '—', rawNum: hasValue ? total : null, isManual: false, isEditable: false }
      }
      default:
        return { display: '', rawNum: null, isManual: false, isEditable: false }
    }
  }

  // ─── Selection: product-absatz cells (Ctrl → expand + select SKUs) ──────────

  function handleProductAbsatzMouseDown(e: React.MouseEvent, row: FlatRow, kw: PlanungsWoche, rawNum: number) {
    e.preventDefault()
    e.stopPropagation()
    isDragging.current = true

    if (e.ctrlKey || e.metaKey) {
      const inSkuMode = Array.from(selectedCells.keys()).some(k => k.startsWith('sku:'))
      const skus = skusByProdukt.get(row.produktId!) ?? []
      if (inSkuMode && skus.length > 0) {
        // Expand product so SKU rows become visible
        const productKey = `${row.plattformId}:${row.produktId}`
        setExpandedProducts(prev => {
          if (!prev.has(productKey)) { const next = new Set(prev); next.add(productKey); return next }
          return prev
        })
        // Toggle all SKU cells for this product × KW into selection
        setSelectedCells(prev => {
          const next = new Map(prev)
          const allPresent = skus.every(s => next.has(skuCellKey(s.id, row.plattformId!, kw.year, kw.week)))
          for (const sku of skus) {
            const key = skuCellKey(sku.id, row.plattformId!, kw.year, kw.week)
            if (allPresent) next.delete(key)
            else if (!next.has(key)) {
              const { value } = getSkuAbsatz(sku.id, row.plattformId!, kw)
              next.set(key, value)
            }
          }
          return next
        })
      } else {
        // Aggregate-selection mode: add/toggle this product-absatz value
        const aggKey = `row:${row.id}:${kw.year}:${kw.week}`
        setSelectedCells(prev => {
          if (prev.has(aggKey)) { const n = new Map(prev); n.delete(aggKey); return n }
          return new Map([...prev, [aggKey, rawNum]])
        })
      }
    } else {
      // Regular click: show aggregate in sum panel only
      setSelectedCells(new Map([[`row:${row.id}:${kw.year}:${kw.week}`, rawNum]]))
    }
  }

  function handleProductAbsatzMouseEnter(row: FlatRow, kw: PlanungsWoche, rawNum: number) {
    if (!isDragging.current) return
    const keys = Array.from(selectedCells.keys())
    const inSkuMode = keys.some(k => k.startsWith('sku:'))
    const skus = skusByProdukt.get(row.produktId!) ?? []
    if (inSkuMode && skus.length > 0) {
      // SKU-selection drag mode: also add SKUs for this product × KW
      setSelectedCells(prev => {
        const next = new Map(prev)
        for (const sku of skus) {
          const key = skuCellKey(sku.id, row.plattformId!, kw.year, kw.week)
          if (!next.has(key)) {
            const { value } = getSkuAbsatz(sku.id, row.plattformId!, kw)
            next.set(key, value)
          }
        }
        return next
      })
    } else {
      // Aggregate drag mode: add this product-absatz value
      const aggKey = `row:${row.id}:${kw.year}:${kw.week}`
      setSelectedCells(prev => prev.has(aggKey) ? prev : new Map([...prev, [aggKey, rawNum]]))
    }
  }

  // ─── Selection: non-editable cells ───────────────────────────────────────────

  function handleNonEditableMouseDown(e: React.MouseEvent, key: string, value: number) {
    e.preventDefault()
    e.stopPropagation()
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

  // ─── Selection + editing: editable cells ─────────────────────────────────────

  function handleEditableCellMouseDown(e: React.MouseEvent, editKey: string, rawNum: number | null, isManual: boolean) {
    if (!(e.ctrlKey || e.metaKey)) return
    e.preventDefault()
    e.stopPropagation()
    isDragging.current = true
    const selectValue = rawNum ?? 0
    setSelectedCells(prev => {
      if (prev.has(editKey)) { const n = new Map(prev); n.delete(editKey); return n }
      return new Map([...prev, [editKey, selectValue]])
    })
    setSelectedCellsIsManual(prev => {
      if (prev.has(editKey)) { const n = new Map(prev); n.delete(editKey); return n }
      return new Map([...prev, [editKey, isManual]])
    })
  }

  function handleEditableCellClick(
    e: React.MouseEvent,
    row: FlatRow,
    kw: PlanungsWoche,
    editKey: string,
    display: string,
  ) {
    if (e.ctrlKey || e.metaKey) return
    e.stopPropagation()
    setSelectedCells(new Map())
    setSelectedCellsIsManual(new Map())
    const origVal = display === '—' || display === '' ? '' : display.replace(',', '.')
    editingOriginalValue.current = origVal
    setEditingCell(editKey)
    setEditingValue(origVal)
  }

  function handleEditableCellMouseEnter(editKey: string, rawNum: number | null, isManual: boolean) {
    if (!isDragging.current) return
    const selectValue = rawNum ?? 0
    setSelectedCells(prev => prev.has(editKey) ? prev : new Map([...prev, [editKey, selectValue]]))
    setSelectedCellsIsManual(prev => prev.has(editKey) ? prev : new Map([...prev, [editKey, isManual]]))
  }

  // ─── Inline edit blur ─────────────────────────────────────────────────────────

  async function handleCellBlur(row: FlatRow, kw: PlanungsWoche, editKey: string) {
    if (editingCellRef.current !== editKey) return

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
      if (row.kind === 'sku-absatz') {
        await upsertSkuAbsatz(row.skuId!, row.produktId!, row.plattformId!, kw, parsedNew)
      } else {
        await upsertVK(row.produktId!, row.plattformId!, kw, parsedNew)
      }
    } catch {
      toast({ title: 'Fehler beim Speichern', description: 'Wert konnte nicht gespeichert werden.', variant: 'destructive' })
    }
  }

  // ─── Bulk edit ────────────────────────────────────────────────────────────────

  // Build reverse map: skuId → produktId for bulk edit parsing
  const skuToProdukt = useMemo(() => {
    const m = new Map<string, string>()
    for (const [produktId, skus] of skusByProdukt) {
      for (const sku of skus) m.set(sku.id, produktId)
    }
    return m
  }, [skusByProdukt])

  const bulkEditType = useMemo((): 'absatz' | 'vk' | null => {
    const keys = Array.from(selectedCells.keys())
    if (keys.length < 2) return null
    const types = new Set(keys.map(k => k.endsWith(':absatz') ? 'absatz' : k.endsWith(':vk') ? 'vk' : 'other'))
    if (types.has('other')) return null
    if (types.size === 1) return types.values().next().value as 'absatz' | 'vk'
    return null
  }, [selectedCells])

  const bulkEditCells = useMemo((): BulkEditCell[] => {
    if (!bulkEditType) return []
    const result: BulkEditCell[] = []
    for (const [key, value] of selectedCells.entries()) {
      const parts = key.split(':')
      if (parts[0] === 'sku' && parts.length === 6) {
        // sku:${skuId}:${plattformId}:${year}:${week}:absatz
        const skuId = parts[1]
        const plattformId = parts[2]
        const kwYear = parseInt(parts[3])
        const kwWeek = parseInt(parts[4])
        const produktId = skuToProdukt.get(skuId)
        const kw = wochen.find(w => w.year === kwYear && w.week === kwWeek)
        if (kw && produktId) result.push({ skuId, produktId, plattformId, kw, currentValue: value, field: 'absatz' })
      } else if (parts[0] === 'vk' && parts.length === 6) {
        // vk:${produktId}:${plattformId}:${year}:${week}:vk
        const produktId = parts[1]
        const plattformId = parts[2]
        const kwYear = parseInt(parts[3])
        const kwWeek = parseInt(parts[4])
        const kw = wochen.find(w => w.year === kwYear && w.week === kwWeek)
        if (kw) result.push({ produktId, plattformId, kw, currentValue: value, field: 'vk' })
      }
    }
    return result
  }, [bulkEditType, selectedCells, wochen, skuToProdukt])

  async function handleBulkApply(results: BulkEditResult[]) {
    const field = bulkEditType!
    try {
      await upsertBatch(results.map(r => ({
        skuId: r.skuId,
        produktId: r.produktId,
        plattformId: r.plattformId,
        kw: r.kw,
        field,
        value: r.newValue,
      })))
      setSelectedCells(new Map())
      setSelectedCellsIsManual(new Map())
    } catch {
      toast({ title: 'Fehler', description: 'Massen-Anpassung konnte nicht gespeichert werden.', variant: 'destructive' })
    }
  }

  // ─── Reset selected cells to calculation ─────────────────────────────────────

  // True when selected cells contain at least one manually-set SKU absatz cell
  const hasManualSkuCellsSelected = useMemo(() => {
    for (const [key, manual] of selectedCellsIsManual) {
      if (manual && key.startsWith('sku:') && key.endsWith(':absatz')) return true
    }
    return false
  }, [selectedCellsIsManual])

  async function handleResetToCalc() {
    const cells: Array<{ skuId: string; produktId: string; plattformId: string; kw: PlanungsWoche }> = []
    for (const [key, manual] of selectedCellsIsManual) {
      if (!manual || !key.startsWith('sku:') || !key.endsWith(':absatz')) continue
      const parts = key.split(':')
      // sku:${skuId}:${plattformId}:${year}:${week}:absatz
      const skuId = parts[1]
      const plattformId = parts[2]
      const kwYear = parseInt(parts[3])
      const kwWeek = parseInt(parts[4])
      const produktId = skuToProdukt.get(skuId)
      const kw = wochen.find(w => w.year === kwYear && w.week === kwWeek)
      if (kw && produktId) cells.push({ skuId, produktId, plattformId, kw })
    }
    if (cells.length === 0) return

    setResettingToCalc(true)
    try {
      await resetSkuAbsatzToCalc(cells)
      setSelectedCells(new Map())
      setSelectedCellsIsManual(new Map())
      toast({ title: `${cells.length} Feld${cells.length !== 1 ? 'er' : ''} zurückgesetzt`, description: 'Werte werden wieder automatisch aus der Berechnungsmethode übernommen.' })
    } catch {
      toast({ title: 'Fehler', description: 'Zurücksetzen fehlgeschlagen.', variant: 'destructive' })
    } finally {
      setResettingToCalc(false)
    }
  }

  // ─── Historische Werte aktualisieren ─────────────────────────────────────────

  async function handleRefreshConfirm(selectedProduktIds: string[]) {
    setRefreshDialogOpen(false)
    try {
      await refreshAutomatischWerte(selectedProduktIds)
      toast({ title: 'Historische Werte aktualisiert', description: 'Automatisch berechnete Absatzwerte wurden auf den aktuellen Stand gebracht.' })
    } catch {
      toast({ title: 'Fehler', description: 'Aktualisierung fehlgeschlagen.', variant: 'destructive' })
    }
  }

  // ─── Reset (Absatz only) ──────────────────────────────────────────────────────

  async function handleReset() {
    setResetting(true)
    try {
      await Promise.all([resetAll(), resetNotizen()])
      setSelectedCells(new Map())
      // After clearing, refill with fresh historical values so cells reflect current settings
      try { await refreshAutomatischWerte() } catch { /* ignore – reset already succeeded */ }
      toast({ title: 'Absatzplanung zurückgesetzt', description: 'Alle manuellen Absatzwerte und Notizen wurden entfernt. VK-Werte bleiben erhalten.' })
    } catch {
      toast({ title: 'Fehler', description: 'Zurücksetzen fehlgeschlagen.', variant: 'destructive' })
    } finally {
      setResetting(false)
      setResetDialogOpen(false)
    }
  }

  // ─── Toggle helpers ───────────────────────────────────────────────────────────

  function togglePlatform(plattformId: string) {
    setExpandedPlatforms(prev => {
      const next = new Set(prev)
      if (next.has(plattformId)) next.delete(plattformId)
      else next.add(plattformId)
      return next
    })
  }

  function toggleProduct(key: string) {
    setExpandedProducts(prev => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })
  }

  // ─── Notiz helpers ───────────────────────────────────────────────────────────

  function isEditableNotizKey(key: string): boolean {
    return key.startsWith('sku:') || key.startsWith('vk:')
  }

  function getNotizCellLabel(editKey: string): string {
    const parts = editKey.split(':')
    if (parts[0] === 'sku' && parts.length === 6) {
      const skuId = parts[1]
      const year = parseInt(parts[3])
      const week = parseInt(parts[4])
      const kw = wochen.find(w => w.year === year && w.week === week)
      let skuName = skuId
      for (const skus of skusByProdukt.values()) {
        const sku = skus.find(s => s.id === skuId)
        if (sku) { skuName = sku.name; break }
      }
      return `${skuName} · ${kw?.label ?? ''}`
    }
    if (parts[0] === 'vk' && parts.length === 6) {
      const produktId = parts[1]
      const year = parseInt(parts[3])
      const week = parseInt(parts[4])
      const kw = wochen.find(w => w.year === year && w.week === week)
      const prd = produkte.find(p => p.id === produktId)
      return `${prd?.name ?? produktId} (Effektiver VK) · ${kw?.label ?? ''}`
    }
    return editKey
  }

  // ─── Loading / Error / Empty ──────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="space-y-2">
        {Array.from({ length: 8 }).map((_, i) => <Skeleton key={i} className="h-8 w-full" />)}
      </div>
    )
  }

  if (error) return <p className="text-sm text-destructive">{error}</p>

  if (activePlattformen.length === 0) {
    return (
      <div className="rounded-md border p-8 text-center text-muted-foreground text-sm space-y-2">
        <p>Keine Produkte zur Planung vorhanden.</p>
        <p>
          Bitte in den{' '}
          <a href="/dashboard/kurzfristige-planung/absatzeinstellungen" className="underline text-foreground">
            Absatzeinstellungen
          </a>{' '}
          mindestens eine Berechnungsart konfigurieren.
        </p>
      </div>
    )
  }

  // ─── Render ───────────────────────────────────────────────────────────────────

  return (
    <TooltipProvider delayDuration={400}>
    <div data-betrag-selektion="true" className="space-y-4">
      {/* Toolbar */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          {wochen.length > 0 && (
            <span>{wochen[0].label} – {wochen[wochen.length - 1].label}</span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => setRefreshDialogOpen(true)} disabled={isRefreshing || resetting}>
            <RefreshCw className={`h-3.5 w-3.5 mr-1.5 ${isRefreshing ? 'animate-spin' : ''}`} />
            {isRefreshing ? 'Wird aktualisiert…' : 'Historische Werte aktualisieren'}
          </Button>
          <Button variant="outline" size="sm" onClick={() => setResetDialogOpen(true)} disabled={resetting || isRefreshing}>
            <RotateCcw className="h-3.5 w-3.5 mr-1.5" />
            Absatz zurücksetzen
          </Button>
        </div>
      </div>

      {/* Table */}
      <div className="overflow-x-auto rounded-md border">
        <table className="w-full text-sm border-collapse">
          <thead>
            {/* Month grouping row */}
            <tr className="border-b bg-muted/20">
              <th className="sticky left-0 z-20 bg-muted/20 min-w-[220px] max-w-[280px] px-3 py-1" />
              {monthGroups.map((g, i) => (
                <th
                  key={g.label + i}
                  colSpan={g.count}
                  className="px-2 py-1 text-center text-xs font-medium text-muted-foreground border-l"
                >
                  {g.label}
                </th>
              ))}
            </tr>
            {/* KW header row */}
            <tr className="border-b bg-muted/40">
              <th className="sticky left-0 z-20 bg-muted/40 min-w-[220px] max-w-[280px] px-3 py-2.5 text-left font-medium text-muted-foreground">
                Metrik
              </th>
              {wochen.map(kw => {
                const isNew = isNewWeek && lastWoche && kw.year === lastWoche.year && kw.week === lastWoche.week
                return (
                  <th
                    key={`${kw.year}-${kw.week}`}
                    className={[
                      'min-w-[90px] px-2 py-2.5 text-left font-medium text-xs border-l',
                      isNew
                        ? 'bg-red-50 text-red-700 dark:bg-red-950/30 dark:text-red-400'
                        : 'text-muted-foreground',
                    ].join(' ')}
                    title={isNew ? 'Neue Woche — Bitte Werte prüfen' : undefined}
                  >
                    {kw.label}
                    {isNew && <span className="block text-[10px] font-normal">Neue Woche</span>}
                  </th>
                )
              })}
            </tr>
          </thead>
          <tbody>
            {flatRows.map(row => {
              const isHeader = row.kind === 'platform-header'
              const isGesamt = row.kind === 'gesamt-absatz' || row.kind === 'gesamt-umsatz'
              const isPlatformMetric = row.kind === 'platform-absatz' || row.kind === 'platform-umsatz'

              const rowBg = isGesamt
                ? 'bg-muted/60'
                : isHeader
                ? 'bg-muted/30'
                : isPlatformMetric
                ? 'bg-muted/20'
                : 'bg-white dark:bg-background'

              const labelBg = isGesamt
                ? 'bg-muted/60'
                : isHeader
                ? 'bg-muted/30'
                : isPlatformMetric
                ? 'bg-muted/20'
                : 'bg-white dark:bg-background'

              return (
                <tr
                  key={row.id}
                  className={[
                    'border-b last:border-0 hover:bg-muted/20 transition-colors',
                    row.kind === 'product-absatz' ? 'border-t-2 border-t-border' : '',
                    rowBg,
                  ].join(' ')}
                >
                  {/* Label cell */}
                  <td
                    className={['sticky left-0 z-10 px-3 py-1.5 whitespace-nowrap', labelBg].join(' ')}
                    style={{ paddingLeft: `${12 + row.indent * 16 - (row.kind === 'product-absatz' && row.expandable ? 18 : 0)}px` }}
                  >
                    {isHeader ? (
                      <button
                        type="button"
                        className="flex items-center gap-1 text-sm font-semibold hover:text-primary"
                        onClick={() => togglePlatform(row.plattformId!)}
                      >
                        {row.expanded ? <ChevronDown className="h-3.5 w-3.5 shrink-0" /> : <ChevronRight className="h-3.5 w-3.5 shrink-0" />}
                        {row.label}
                      </button>
                    ) : row.kind === 'gesamt-absatz' || row.kind === 'gesamt-umsatz' ? (
                      <button
                        type="button"
                        className="flex items-center gap-1 text-sm font-semibold hover:text-primary"
                        onClick={() =>
                          row.kind === 'gesamt-absatz'
                            ? setGesamtAbsatzExpanded(v => !v)
                            : setGesamtUmsatzExpanded(v => !v)
                        }
                      >
                        {row.expanded ? <ChevronDown className="h-3.5 w-3.5 shrink-0" /> : <ChevronRight className="h-3.5 w-3.5 shrink-0" />}
                        {row.label}
                      </button>
                    ) : row.kind === 'product-absatz' && row.expandable ? (
                      <button
                        type="button"
                        className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
                        onClick={() => toggleProduct(`${row.plattformId}:${row.produktId}`)}
                      >
                        {row.expanded ? <ChevronDown className="h-3.5 w-3.5 shrink-0" /> : <ChevronRight className="h-3.5 w-3.5 shrink-0" />}
                        {row.label}
                      </button>
                    ) : (
                      <span className={
                        isPlatformMetric
                          ? 'text-sm font-medium text-muted-foreground'
                          : row.kind === 'product-vk'
                          ? 'text-sm text-foreground'
                          : row.kind === 'sku-absatz'
                          ? 'text-xs text-foreground'
                          : 'text-sm text-muted-foreground'
                      }>
                        {row.label}
                      </span>
                    )}
                  </td>

                  {/* Value cells */}
                  {wochen.map(kw => {
                    const { display, rawNum, isManual, isEditable: cellEditable } = getRowValue(row, kw)
                    const isNew = isNewWeek && lastWoche && kw.year === lastWoche.year && kw.week === lastWoche.week

                    let editKey: string | null = null
                    if (cellEditable) {
                      if (row.kind === 'sku-absatz' && row.skuId) {
                        editKey = skuCellKey(row.skuId, row.plattformId!, kw.year, kw.week)
                      } else if (row.kind === 'product-vk' && row.produktId) {
                        editKey = vkCellKey(row.produktId, row.plattformId!, kw.year, kw.week)
                      }
                    }

                    const isCurrentlyEditing = editKey !== null && editingCell === editKey
                    const cellKey = editKey ?? `row:${row.id}:${kw.year}:${kw.week}`
                    const isSelected = selectedCells.has(cellKey)

                    return (
                      <td
                        key={`${kw.year}-${kw.week}`}
                        className={[
                          'relative px-2 py-1.5 text-left text-xs tabular-nums select-none border-l',
                          isNew && cellEditable ? 'bg-red-50 dark:bg-red-950/10' : '',
                          isSelected ? 'bg-blue-100 dark:bg-blue-900/30' : '',
                          cellEditable ? 'cursor-pointer text-foreground' : 'text-muted-foreground',
                        ].join(' ')}
                        onClick={
                          cellEditable && editKey !== null && !isCurrentlyEditing
                            ? e => handleEditableCellClick(e, row, kw, editKey!, display)
                            : undefined
                        }
                        onMouseDown={
                          row.kind === 'product-absatz' && row.produktId && rawNum !== null
                            ? e => handleProductAbsatzMouseDown(e, row, kw, rawNum)
                            : cellEditable && editKey !== null
                              ? e => handleEditableCellMouseDown(e, editKey!, rawNum, isManual)
                              : !cellEditable && rawNum !== null
                                ? e => handleNonEditableMouseDown(e, `row:${row.id}:${kw.year}:${kw.week}`, rawNum)
                                : undefined
                        }
                        onMouseEnter={
                          row.kind === 'product-absatz' && row.produktId
                            ? () => handleProductAbsatzMouseEnter(row, kw, rawNum ?? 0)
                            : cellEditable && editKey !== null
                              ? () => handleEditableCellMouseEnter(editKey!, rawNum, isManual)
                              : !cellEditable && rawNum !== null
                                ? () => handleNonEditableMouseEnter(`row:${row.id}:${kw.year}:${kw.week}`, rawNum)
                                : undefined
                        }
                      >
                        {/* Note indicator */}
                        {editKey && notizen.has(editKey) && !isCurrentlyEditing && (
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
                              {(notizen.get(editKey) ?? '').length > 300
                                ? (notizen.get(editKey) ?? '').slice(0, 300) + '…'
                                : (notizen.get(editKey) ?? '')}
                            </TooltipContent>
                          </Tooltip>
                        )}
                        {isCurrentlyEditing ? (
                          <input
                            autoFocus
                            type="number"
                            min="0"
                            step="any"
                            className="w-full text-left bg-transparent outline-none border-b border-primary text-xs tabular-nums"
                            value={editingValue}
                            onChange={e => setEditingValue(e.target.value)}
                            onBlur={() => handleCellBlur(row, kw, editKey!)}
                            onKeyDown={e => {
                              if (e.key === 'Enter') (e.target as HTMLInputElement).blur()
                              if (e.key === 'Escape') { setEditingCell(null); setEditingValue('') }
                            }}
                            onClick={e => e.stopPropagation()}
                            onMouseDown={e => e.stopPropagation()}
                          />
                        ) : (
                          <>
                            <div
                              className={[
                                'flex items-center justify-start gap-1',
                                isNew && cellEditable ? 'ring-1 ring-red-300 dark:ring-red-700 rounded px-1' : '',
                              ].join(' ')}
                            >
                              {cellEditable && (
                                <span
                                  className={[
                                    'inline-block w-1.5 h-1.5 rounded-full shrink-0',
                                    isManual ? 'bg-blue-500' : 'bg-gray-300 dark:bg-gray-600',
                                  ].join(' ')}
                                  title={isManual ? 'Manuell eingegeben' : 'Historisch berechnet'}
                                />
                              )}
                              <span>{display || (cellEditable ? '—' : display)}</span>
                            </div>
                            {row.kind === 'sku-absatz' && row.skuId && (() => {
                              const bv = getBestandVerlauf(row.skuId, kw)
                              if (bv === null) return null
                              return (
                                <div className={[
                                  'text-[9px] tabular-nums leading-none mt-0.5',
                                  bv.nachher === 0 ? 'text-red-500 dark:text-red-400' : 'text-muted-foreground/60',
                                ].join(' ')}>
                                  {bv.nachher.toLocaleString('de-DE')}
                                </div>
                              )
                            })()}
                          </>
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

      {/* Bottom-right floating panels — all in one container to prevent overlap */}
      {(selectedCells.size > 0 || bulkEditType) && (
        <div
          data-betrag-selektion="true"
          className="fixed bottom-6 right-6 z-50 flex flex-col gap-2 items-stretch"
        >
          {/* Notiz panel — nur bei genau 1 editierbarer Zelle */}
          {selectedCells.size === 1 && (() => {
            const key = Array.from(selectedCells.keys())[0]
            if (!isEditableNotizKey(key)) return null
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

          {/* Reset auf Berechnungsmethode — nur wenn manuelle Absatz-SKU-Zellen ausgewählt */}
          {hasManualSkuCellsSelected && (
            <div className="rounded-lg border bg-background shadow-lg text-sm">
              <button
                type="button"
                disabled={resettingToCalc}
                className="flex items-center gap-2 px-4 py-2.5 w-full hover:bg-muted/50 rounded-lg transition-colors disabled:opacity-50"
                onClick={handleResetToCalc}
              >
                <RotateCcw className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                <span>{resettingToCalc ? 'Wird zurückgesetzt…' : 'Auf Berechnungsmethode zurücksetzen'}</span>
              </button>
            </div>
          )}

          {/* Bulk edit panel */}
          {bulkEditType && (
            <div className="flex items-center gap-2 rounded-lg border bg-background px-4 py-2 shadow-lg text-sm">
              <Pencil className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
              <span className="text-muted-foreground">
                {selectedCells.size} {bulkEditType === 'absatz' ? 'Absatz' : 'VK'}-Felder ausgewählt
              </span>
              <Button size="sm" onClick={() => setBulkEditOpen(true)}>Anpassen</Button>
            </div>
          )}

          {/* Betragsselektion panel */}
          {selectedCells.size > 0 && (
            <div className="flex items-center gap-3 rounded-lg border bg-background px-4 py-2.5 shadow-lg text-sm">
              <span className="text-muted-foreground">{selectedCells.size} Feld{selectedCells.size !== 1 ? 'er' : ''}</span>
              <div className="h-4 w-px bg-border" />
              <span className="font-semibold tabular-nums">Summe: {selectionSum.toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
              <button
                className="ml-1 text-muted-foreground hover:text-foreground"
                onClick={() => { setSelectedCells(new Map()); setSelectedCellsIsManual(new Map()) }}
                aria-label="Auswahl aufheben"
              >
                ✕
              </button>
            </div>
          )}
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
            <AlertDialogTitle>Absatzplanung zurücksetzen?</AlertDialogTitle>
            <AlertDialogDescription>
              Alle manuell eingegebenen <strong>Absatzwerte</strong> werden entfernt und durch die
              historisch berechneten Werte ersetzt. Manuell eingegebene <strong>VK-Werte</strong> bleiben
              erhalten. Diese Aktion kann nicht rückgängig gemacht werden.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={resetting}>Abbrechen</AlertDialogCancel>
            <AlertDialogAction onClick={handleReset} disabled={resetting}>
              {resetting ? 'Wird zurückgesetzt…' : 'Absatz zurücksetzen'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Historisch refresh dialog */}
      <HistorischRefreshDialog
        open={refreshDialogOpen}
        onOpenChange={setRefreshDialogOpen}
        produkte={refreshDialogProdukte}
        onConfirm={handleRefreshConfirm}
        isLoading={isRefreshing}
      />
    </div>
    </TooltipProvider>
  )
}
