'use client'

import { useState, useEffect, useRef, useCallback, useMemo } from 'react'
import { ChevronDown, ChevronRight, RefreshCw, RotateCcw, Pencil, StickyNote } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
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
import { useMarketingplanung, mktPctKey } from '@/hooks/use-marketingplanung'
import type { PlanungsWoche } from '@/hooks/use-marketingplanung'
import {
  MarketingplanungBulkEditDialog,
  type MktBulkEditCell,
  type MktBulkEditResult,
} from '@/components/marketingplanung-bulk-edit-dialog'
import { usePlanungNotizen } from '@/hooks/use-planung-notizen'
import { PlanungNotizFormular } from '@/components/planung-notiz-formular'
import { HistorischRefreshDialog } from '@/components/historisch-refresh-dialog'

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatNum(v: number | null, decimals = 2): string {
  if (v === null) return ''
  return v.toLocaleString('de-DE', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  })
}

function formatEur(v: number | null): string {
  if (v === null) return ''
  return v.toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

function mktEditKey(
  produktId: string,
  kategorieId: string,
  kwYear: number,
  kwWeek: number,
): string {
  return mktPctKey(produktId, kategorieId, kwYear, kwWeek) + ':pct'
}

function thursdayOfISOWeek(year: number, week: number): Date {
  const jan4       = new Date(Date.UTC(year, 0, 4))
  const dayOfWeek  = jan4.getUTCDay() || 7
  const mondayWeek1 = new Date(jan4.getTime() - (dayOfWeek - 1) * 86_400_000)
  return new Date(mondayWeek1.getTime() + (week - 1) * 7 * 86_400_000 + 3 * 86_400_000)
}

// ─── Row types ────────────────────────────────────────────────────────────────

type RowKind =
  | 'total-budget'
  | 'plattform-header'
  | 'plattform-produkt'
  | 'gruppe-header'
  | 'product-absatz'
  | 'product-vk'
  | 'product-umsatz'
  | 'product-marketing-pct'
  | 'product-marketing-budget'

interface FlatRow {
  id: string
  kind: RowKind
  label: string
  indent: number
  kategorieId?: string
  produktId?: string
  plattformId?: string
  expandable?: boolean
  expanded?: boolean
}

// ─── Main component ───────────────────────────────────────────────────────────

export function MarketingplanungTabelle() {
  const {
    wochen,
    marketingUntergruppen,
    produkte,
    aktiveKombis,
    loading,
    error,
    isNewWeek,
    lastWoche,
    getAbsatzForKategorie,
    getVKForKategorie,
    getUmsatzForKategorie,
    getKategoriePlattformId,
    getKategoriePlattformLabel,
    getMarketingPct,
    upsertMarketingPct,
    upsertBatch,
    resetMarketingPctToCalc,
    resetAll,
    isRefreshing,
    refreshHistorisch,
  } = useMarketingplanung()

  const { toast } = useToast()
  const [expandedGruppen, setExpandedGruppen] = useState<Set<string>>(new Set())
  const [expandedPlattformen, setExpandedPlattformen] = useState<Set<string>>(new Set())
  const [resetDialogOpen, setResetDialogOpen] = useState(false)
  const [resetting, setResetting] = useState(false)
  const [refreshDialogOpen, setRefreshDialogOpen] = useState(false)

  // Betragsselektion / multi-select
  const [selectedCells, setSelectedCells] = useState<Map<string, number>>(new Map())
  const [selectedCellsIsManual, setSelectedCellsIsManual] = useState<Map<string, boolean>>(new Map())
  const [resettingToCalc, setResettingToCalc] = useState(false)
  const isDragging = useRef(false)
  const selectionSum = Array.from(selectedCells.values()).reduce((a, b) => a + b, 0)

  // Bulk edit
  const [bulkEditOpen, setBulkEditOpen] = useState(false)

  // Notizen
  const { notizen, upsertNotiz, deleteNotiz, resetNotizen } = usePlanungNotizen('marketingplanung')
  const [notizFormularOpen, setNotizFormularOpen] = useState(false)
  const notizCellKeyRef  = useRef<string>('')
  const notizCellLabelRef = useRef<string>('')

  // Inline editing
  const [editingCell, setEditingCellState] = useState<string | null>(null)
  const editingCellRef     = useRef<string | null>(null)
  const [editingValue, setEditingValue] = useState('')
  const editingOriginalValue = useRef<string>('')

  function setEditingCell(key: string | null) {
    editingCellRef.current = key
    setEditingCellState(key)
  }

  // Expand all Untergruppen and Plattformen on first load
  useEffect(() => {
    if (!loading && marketingUntergruppen.length > 0) {
      setExpandedGruppen(new Set(marketingUntergruppen.map(g => g.id)))
    }
  }, [loading, marketingUntergruppen])

  useEffect(() => {
    if (!loading && activeUntergruppen.length > 0) {
      const ids = new Set<string>()
      for (const ug of activeUntergruppen) {
        const pid = getKategoriePlattformId(ug.id)
        if (pid) ids.add(pid)
      }
      setExpandedPlattformen(ids)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading])

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

  // ─── Month groups ─────────────────────────────────────────────────────────────

  const monthGroups = useMemo(() => {
    const groups: { label: string; count: number }[] = []
    for (const kw of wochen) {
      const thursday = thursdayOfISOWeek(kw.year, kw.week)
      const label  = thursday.toLocaleString('de-DE', { month: 'long', year: 'numeric' })
      if (groups.length === 0 || groups[groups.length - 1].label !== label) {
        groups.push({ label, count: 1 })
      } else {
        groups[groups.length - 1].count++
      }
    }
    return groups
  }, [wochen])

  // ─── Compute Gruppe-level budget ──────────────────────────────────────────────

  const getMarketingBudget = useCallback(
    (produktId: string, kategorieId: string, kw: PlanungsWoche): number | null => {
      const umsatz = getUmsatzForKategorie(produktId, kw, kategorieId)
      if (umsatz === null) return null
      const { value: pct } = getMarketingPct(produktId, kategorieId, kw)
      return Math.round(umsatz * (pct / 100) * 100) / 100
    },
    [getUmsatzForKategorie, getMarketingPct],
  )

  const getGruppeBudget = useCallback(
    (kategorieId: string, kw: PlanungsWoche): number => {
      return produkte
        .filter(p => aktiveKombis.has(`${kategorieId}:${p.id}`))
        .reduce((sum, p) => sum + (getMarketingBudget(p.id, kategorieId, kw) ?? 0), 0)
    },
    [produkte, aktiveKombis, getMarketingBudget],
  )

  // ─── Active Untergruppen ──────────────────────────────────────────────────────

  const activeUntergruppen = useMemo(
    () => marketingUntergruppen.filter(
      ug =>
        getKategoriePlattformId(ug.id) !== null &&
        produkte.some(prd => aktiveKombis.has(`${ug.id}:${prd.id}`)),
    ),
    [marketingUntergruppen, produkte, aktiveKombis, getKategoriePlattformId],
  )

  const refreshDialogProdukte = useMemo(
    () => produkte.filter(prd => activeUntergruppen.some(ug => aktiveKombis.has(`${ug.id}:${prd.id}`))),
    [produkte, activeUntergruppen, aktiveKombis],
  )

  const getTotalBudgetStable = useCallback(
    (kw: PlanungsWoche): number => {
      return activeUntergruppen.reduce((sum, ug) => sum + getGruppeBudget(ug.id, kw), 0)
    },
    [activeUntergruppen, getGruppeBudget],
  )

  // ─── Plattform-Gruppen (für Zusammenfassungszeilen) ───────────────────────────

  const plattformGroups = useMemo(() => {
    const map = new Map<string, {
      plattformId: string
      plattformLabel: string
      untergruppen: typeof activeUntergruppen
      produkteList: typeof produkte
    }>()
    for (const ug of activeUntergruppen) {
      const pid = getKategoriePlattformId(ug.id)
      if (!pid) continue
      if (!map.has(pid)) {
        map.set(pid, {
          plattformId: pid,
          plattformLabel: getKategoriePlattformLabel(ug.id),
          untergruppen: [],
          produkteList: [],
        })
      }
      const grp = map.get(pid)!
      grp.untergruppen.push(ug)
      for (const prd of produkte) {
        if (aktiveKombis.has(`${ug.id}:${prd.id}`) && !grp.produkteList.find(p => p.id === prd.id)) {
          grp.produkteList.push(prd)
        }
      }
    }
    return [...map.values()]
  }, [activeUntergruppen, getKategoriePlattformId, getKategoriePlattformLabel, produkte, aktiveKombis])

  const getPlattformProduktBudget = useCallback(
    (plattformId: string, produktId: string, kw: PlanungsWoche): number => {
      const channels = activeUntergruppen.filter(
        ug => getKategoriePlattformId(ug.id) === plattformId && aktiveKombis.has(`${ug.id}:${produktId}`),
      )
      return channels.reduce((sum, ug) => sum + (getMarketingBudget(produktId, ug.id, kw) ?? 0), 0)
    },
    [activeUntergruppen, getKategoriePlattformId, aktiveKombis, getMarketingBudget],
  )

  const getPlattformProduktPct = useCallback(
    (plattformId: string, produktId: string, kw: PlanungsWoche): number | null => {
      const budget = activeUntergruppen
        .filter(ug => getKategoriePlattformId(ug.id) === plattformId && aktiveKombis.has(`${ug.id}:${produktId}`))
        .reduce((sum, ug) => sum + (getMarketingBudget(produktId, ug.id, kw) ?? 0), 0)
      const channel = activeUntergruppen.find(
        ug => getKategoriePlattformId(ug.id) === plattformId && aktiveKombis.has(`${ug.id}:${produktId}`),
      )
      if (!channel) return null
      const umsatz = getUmsatzForKategorie(produktId, kw, channel.id)
      if (!umsatz || umsatz === 0) return null
      return Math.round((budget / umsatz) * 100 * 100) / 100
    },
    [activeUntergruppen, getKategoriePlattformId, aktiveKombis, getMarketingBudget, getUmsatzForKategorie],
  )

  const getPlattformTotalBudget = useCallback(
    (plattformId: string, kw: PlanungsWoche): number => {
      const grp = plattformGroups.find(g => g.plattformId === plattformId)
      if (!grp) return 0
      return grp.produkteList.reduce((sum, prd) => {
        return sum + grp.untergruppen
          .filter(ug => aktiveKombis.has(`${ug.id}:${prd.id}`))
          .reduce((s, ug) => s + (getMarketingBudget(prd.id, ug.id, kw) ?? 0), 0)
      }, 0)
    },
    [plattformGroups, aktiveKombis, getMarketingBudget],
  )

  const getGruppePct = useCallback(
    (kategorieId: string, kw: PlanungsWoche): number | null => {
      const aktivePrd = produkte.filter(p => aktiveKombis.has(`${kategorieId}:${p.id}`))
      let totalBudget = 0
      let totalUmsatz = 0
      for (const prd of aktivePrd) {
        const umsatz = getUmsatzForKategorie(prd.id, kw, kategorieId)
        if (umsatz === null) continue
        totalBudget += getMarketingBudget(prd.id, kategorieId, kw) ?? 0
        totalUmsatz += umsatz
      }
      if (totalUmsatz === 0) return null
      return Math.round((totalBudget / totalUmsatz) * 100 * 100) / 100
    },
    [produkte, aktiveKombis, getMarketingBudget, getUmsatzForKategorie],
  )

  const getTotalPct = useCallback(
    (kw: PlanungsWoche): number | null => {
      let totalBudget = 0
      let totalUmsatz = 0
      for (const grp of plattformGroups) {
        for (const prd of grp.produkteList) {
          const channel = grp.untergruppen.find(ug => aktiveKombis.has(`${ug.id}:${prd.id}`))
          if (!channel) continue
          const umsatz = getUmsatzForKategorie(prd.id, kw, channel.id)
          if (umsatz === null) continue
          totalUmsatz += umsatz
          totalBudget += grp.untergruppen
            .filter(ug => aktiveKombis.has(`${ug.id}:${prd.id}`))
            .reduce((s, ug) => s + (getMarketingBudget(prd.id, ug.id, kw) ?? 0), 0)
        }
      }
      if (totalUmsatz === 0) return null
      return Math.round((totalBudget / totalUmsatz) * 100 * 100) / 100
    },
    [plattformGroups, aktiveKombis, getUmsatzForKategorie, getMarketingBudget],
  )

  const getPlattformTotalPct = useCallback(
    (plattformId: string, kw: PlanungsWoche): number | null => {
      const grp = plattformGroups.find(g => g.plattformId === plattformId)
      if (!grp) return null
      let totalBudget = 0
      let totalUmsatz = 0
      for (const prd of grp.produkteList) {
        const channel = grp.untergruppen.find(ug => aktiveKombis.has(`${ug.id}:${prd.id}`))
        if (!channel) continue
        const umsatz = getUmsatzForKategorie(prd.id, kw, channel.id)
        if (umsatz === null) continue
        totalUmsatz += umsatz
        totalBudget += grp.untergruppen
          .filter(ug => aktiveKombis.has(`${ug.id}:${prd.id}`))
          .reduce((s, ug) => s + (getMarketingBudget(prd.id, ug.id, kw) ?? 0), 0)
      }
      if (totalUmsatz === 0) return null
      return Math.round((totalBudget / totalUmsatz) * 100 * 100) / 100
    },
    [plattformGroups, aktiveKombis, getUmsatzForKategorie, getMarketingBudget],
  )

  // ─── Flat rows ────────────────────────────────────────────────────────────────

  const flatRows = useMemo((): FlatRow[] => {
    const rows: FlatRow[] = []

    for (const grp of plattformGroups) {
      const expanded = expandedPlattformen.has(grp.plattformId)
      rows.push({
        id: `plattform-header-${grp.plattformId}`,
        kind: 'plattform-header',
        label: grp.plattformLabel,
        indent: 0,
        plattformId: grp.plattformId,
        expandable: true,
        expanded,
      })
      if (expanded) {
        for (const prd of grp.produkteList) {
          rows.push({
            id: `plattform-produkt-${grp.plattformId}-${prd.id}`,
            kind: 'plattform-produkt',
            label: prd.name,
            indent: 1,
            plattformId: grp.plattformId,
            produktId: prd.id,
          })
        }
      }
    }

    rows.push({
      id: 'total-budget',
      kind: 'total-budget',
      label: 'Marketingbudget (Gesamt)',
      indent: 0,
    })

    for (const ug of activeUntergruppen) {
      const expanded = expandedGruppen.has(ug.id)
      rows.push({
        id: `gruppe-header-${ug.id}`,
        kind: 'gruppe-header',
        label: ug.name,
        indent: 0,
        kategorieId: ug.id,
        expandable: true,
        expanded,
      })
      if (expanded) {
        const aktivePrd = produkte.filter(p => aktiveKombis.has(`${ug.id}:${p.id}`))
        const plattformLabel = getKategoriePlattformLabel(ug.id)
        for (const prd of aktivePrd) {
          rows.push({
            id: `prd-absatz-${ug.id}-${prd.id}`,
            kind: 'product-absatz',
            label: `${prd.name} - Absatz (${plattformLabel})`,
            indent: 2,
            kategorieId: ug.id,
            produktId: prd.id,
          })
          rows.push({
            id: `prd-vk-${ug.id}-${prd.id}`,
            kind: 'product-vk',
            label: `${prd.name} - Effektiver VK (${plattformLabel})`,
            indent: 2,
            kategorieId: ug.id,
            produktId: prd.id,
          })
          rows.push({
            id: `prd-umsatz-${ug.id}-${prd.id}`,
            kind: 'product-umsatz',
            label: `${prd.name} - Ziel Brutto-Umsatz (${plattformLabel})`,
            indent: 2,
            kategorieId: ug.id,
            produktId: prd.id,
          })
          rows.push({
            id: `prd-mkt-pct-${ug.id}-${prd.id}`,
            kind: 'product-marketing-pct',
            label: `${prd.name} - Marketingkosten %`,
            indent: 2,
            kategorieId: ug.id,
            produktId: prd.id,
          })
          rows.push({
            id: `prd-mkt-budget-${ug.id}-${prd.id}`,
            kind: 'product-marketing-budget',
            label: `${prd.name} - Marketingbudget`,
            indent: 2,
            kategorieId: ug.id,
            produktId: prd.id,
          })
        }
      }
    }

    return rows
  }, [activeUntergruppen, expandedGruppen, expandedPlattformen, plattformGroups, produkte, aktiveKombis, getKategoriePlattformLabel])

  // ─── Cell value computation ───────────────────────────────────────────────────

  function getRowValue(
    row: FlatRow,
    kw: PlanungsWoche,
  ): { display: string; display2?: string; rawNum: number | null; isManual: boolean; isEditable: boolean } {
    switch (row.kind) {
      case 'plattform-header': {
        const val = getPlattformTotalBudget(row.plattformId!, kw)
        const pct = getPlattformTotalPct(row.plattformId!, kw)
        return {
          display: formatEur(val),
          display2: pct !== null ? `${formatNum(pct)} %` : '',
          rawNum: val,
          isManual: false,
          isEditable: false,
        }
      }
      case 'plattform-produkt': {
        const budget = getPlattformProduktBudget(row.plattformId!, row.produktId!, kw)
        const pct    = getPlattformProduktPct(row.plattformId!, row.produktId!, kw)
        return {
          display: formatEur(budget),
          display2: pct !== null ? `${formatNum(pct)} %` : '',
          rawNum: budget,
          isManual: false,
          isEditable: false,
        }
      }
      case 'total-budget': {
        const val = getTotalBudgetStable(kw)
        const pct = getTotalPct(kw)
        return { display: formatEur(val), display2: pct !== null ? `${formatNum(pct)} %` : '', rawNum: val, isManual: false, isEditable: false }
      }
      case 'gruppe-header': {
        const val = getGruppeBudget(row.kategorieId!, kw)
        const pct = getGruppePct(row.kategorieId!, kw)
        return { display: formatEur(val), display2: pct !== null ? `${formatNum(pct)} %` : '', rawNum: val, isManual: false, isEditable: false }
      }
      case 'product-absatz': {
        const val = getAbsatzForKategorie(row.produktId!, kw, row.kategorieId!)
        return { display: val > 0 ? formatNum(val) : '', rawNum: val > 0 ? val : null, isManual: false, isEditable: false }
      }
      case 'product-vk': {
        const val = getVKForKategorie(row.produktId!, kw, row.kategorieId!)
        return { display: val !== null ? formatNum(val) : '', rawNum: val, isManual: false, isEditable: false }
      }
      case 'product-umsatz': {
        const u = getUmsatzForKategorie(row.produktId!, kw, row.kategorieId!)
        return { display: u !== null ? formatEur(u) : '', rawNum: u, isManual: false, isEditable: false }
      }
      case 'product-marketing-pct': {
        const { value, isManual } = getMarketingPct(row.produktId!, row.kategorieId!, kw)
        return { display: formatNum(value), rawNum: value, isManual, isEditable: true }
      }
      case 'product-marketing-budget': {
        const budget = getMarketingBudget(row.produktId!, row.kategorieId!, kw)
        return { display: budget !== null ? formatEur(budget) : '', rawNum: budget, isManual: false, isEditable: false }
      }
      default:
        return { display: '', rawNum: null, isManual: false, isEditable: false }
    }
  }

  // ─── Selection helpers ────────────────────────────────────────────────────────

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

  function handleEditableCellMouseDown(e: React.MouseEvent, editKey: string, rawNum: number | null, isManual: boolean) {
    if (!(e.ctrlKey || e.metaKey)) return
    e.preventDefault()
    e.stopPropagation()
    if (rawNum === null) return
    isDragging.current = true
    setSelectedCells(prev => {
      if (prev.has(editKey)) { const n = new Map(prev); n.delete(editKey); return n }
      return new Map([...prev, [editKey, rawNum]])
    })
    setSelectedCellsIsManual(prev => {
      if (prev.has(editKey)) { const n = new Map(prev); n.delete(editKey); return n }
      return new Map([...prev, [editKey, isManual]])
    })
  }

  function handleEditableCellClick(
    e: React.MouseEvent,
    editKey: string,
    display: string,
  ) {
    if (e.ctrlKey || e.metaKey) return
    e.stopPropagation()
    setSelectedCells(new Map())
    setSelectedCellsIsManual(new Map())
    const origVal = display === '' ? '' : display.replace(',', '.')
    editingOriginalValue.current = origVal
    setEditingCell(editKey)
    setEditingValue(origVal)
  }

  function handleEditableCellMouseEnter(editKey: string, rawNum: number | null, isManual: boolean) {
    if (!isDragging.current || rawNum === null) return
    setSelectedCells(prev => prev.has(editKey) ? prev : new Map([...prev, [editKey, rawNum]]))
    setSelectedCellsIsManual(prev => prev.has(editKey) ? prev : new Map([...prev, [editKey, isManual]]))
  }

  // ─── Inline edit blur ─────────────────────────────────────────────────────────

  async function handleCellBlur(
    row: FlatRow,
    kw: PlanungsWoche,
    editKey: string,
  ) {
    if (editingCellRef.current !== editKey) return

    const rawStr   = editingValue.trim().replace(',', '.')
    let parsedNew: number | null = rawStr === '' ? null : parseFloat(rawStr)
    const parsedOrig =
      editingOriginalValue.current === '' ? null : parseFloat(editingOriginalValue.current.replace(',', '.'))

    setEditingCell(null)
    setEditingValue('')

    if (parsedNew !== null) {
      if (isNaN(parsedNew)) return
      parsedNew = Math.min(100, Math.max(0, parsedNew))
    }

    const unchanged =
      (parsedNew === null && parsedOrig === null) ||
      (parsedNew !== null && parsedOrig !== null && Math.abs(parsedNew - parsedOrig) < 0.005)
    if (unchanged) return

    try {
      await upsertMarketingPct(row.produktId!, row.kategorieId!, kw, parsedNew)
    } catch {
      toast({
        title: 'Fehler beim Speichern',
        description: 'Wert konnte nicht gespeichert werden.',
        variant: 'destructive',
      })
    }
  }

  // ─── Bulk edit ────────────────────────────────────────────────────────────────

  const bulkEditActive = useMemo(() => {
    const keys = Array.from(selectedCells.keys())
    if (keys.length < 2) return false
    return keys.every(k => k.endsWith(':pct'))
  }, [selectedCells])

  const bulkEditCells = useMemo((): MktBulkEditCell[] => {
    if (!bulkEditActive) return []
    const result: MktBulkEditCell[] = []
    for (const [key, value] of selectedCells.entries()) {
      // key format: mkt:${produktId}:${kategorieId}:${year}:${week}:pct
      const parts = key.split(':')
      if (parts[0] === 'mkt' && parts.length === 6) {
        const produktId   = parts[1]
        const kategorieId = parts[2]
        const kwYear      = parseInt(parts[3])
        const kwWeek      = parseInt(parts[4])
        const kw = wochen.find(w => w.year === kwYear && w.week === kwWeek)
        if (kw) result.push({ produktId, kategorieId, kw, currentValue: value })
      }
    }
    return result
  }, [bulkEditActive, selectedCells, wochen])

  async function handleBulkApply(results: MktBulkEditResult[]) {
    try {
      await upsertBatch(results.map(r => ({
        produktId: r.produktId,
        kategorieId: r.kategorieId,
        kw: r.kw,
        value: r.newValue,
      })))
      setSelectedCells(new Map())
      setSelectedCellsIsManual(new Map())
    } catch {
      toast({
        title: 'Fehler',
        description: 'Massen-Anpassung konnte nicht gespeichert werden.',
        variant: 'destructive',
      })
    }
  }

  // ─── Reset auf Berechnungsmethode (Einzelzellen) ──────────────────────────────

  const hasManualCellsSelected = useMemo(() => {
    for (const [key, manual] of selectedCellsIsManual) {
      if (manual && key.endsWith(':pct')) return true
    }
    return false
  }, [selectedCellsIsManual])

  async function handleResetToCalc() {
    const cells: Array<{ produktId: string; kategorieId: string; kw: PlanungsWoche }> = []
    for (const [key, manual] of selectedCellsIsManual) {
      if (!manual || !key.endsWith(':pct')) continue
      // key format: mkt:${produktId}:${kategorieId}:${year}:${week}:pct
      const parts = key.split(':')
      if (parts[0] === 'mkt' && parts.length === 6) {
        const produktId   = parts[1]
        const kategorieId = parts[2]
        const kwYear      = parseInt(parts[3])
        const kwWeek      = parseInt(parts[4])
        const kw = wochen.find(w => w.year === kwYear && w.week === kwWeek)
        if (kw) cells.push({ produktId, kategorieId, kw })
      }
    }
    if (cells.length === 0) return

    setResettingToCalc(true)
    try {
      await resetMarketingPctToCalc(cells)
      setSelectedCells(new Map())
      setSelectedCellsIsManual(new Map())
      toast({
        title: `${cells.length} Feld${cells.length !== 1 ? 'er' : ''} zurückgesetzt`,
        description: 'Werte werden wieder automatisch aus der Berechnungsmethode übernommen.',
      })
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
      await refreshHistorisch(selectedProduktIds)
      toast({ title: 'Historische Werte aktualisiert', description: 'Marketing-Prozentsätze und Absatzwerte wurden auf den aktuellen Stand gebracht.' })
    } catch {
      toast({ title: 'Fehler', description: 'Aktualisierung fehlgeschlagen.', variant: 'destructive' })
    }
  }

  // ─── Reset ────────────────────────────────────────────────────────────────────

  async function handleReset() {
    setResetting(true)
    try {
      await Promise.all([resetAll(), resetNotizen()])
      setSelectedCells(new Map())
      setSelectedCellsIsManual(new Map())
      toast({
        title: 'Marketing-Planung zurückgesetzt',
        description: 'Alle manuellen Marketingkosten und Notizen wurden entfernt.',
      })
    } catch {
      toast({ title: 'Fehler', description: 'Zurücksetzen fehlgeschlagen.', variant: 'destructive' })
    } finally {
      setResetting(false)
      setResetDialogOpen(false)
    }
  }

  // ─── Toggle Untergruppe ───────────────────────────────────────────────────────

  function toggleGruppe(kategorieId: string) {
    setExpandedGruppen(prev => {
      const next = new Set(prev)
      if (next.has(kategorieId)) next.delete(kategorieId)
      else next.add(kategorieId)
      return next
    })
  }

  function togglePlattform(plattformId: string) {
    setExpandedPlattformen(prev => {
      const next = new Set(prev)
      if (next.has(plattformId)) next.delete(plattformId)
      else next.add(plattformId)
      return next
    })
  }

  // ─── Notiz helpers ────────────────────────────────────────────────────────────

  function getNotizCellLabel(editKey: string): string {
    // editKey: mkt:${produktId}:${kategorieId}:${year}:${week}:pct
    const parts = editKey.split(':')
    if (parts[0] === 'mkt' && parts.length === 6) {
      const produktId = parts[1]
      const kwYear    = parseInt(parts[3])
      const kwWeek    = parseInt(parts[4])
      const kw  = wochen.find(w => w.year === kwYear && w.week === kwWeek)
      const prd = produkte.find(p => p.id === produktId)
      return `${prd?.name ?? produktId} (Marketingkosten %) · ${kw?.label ?? ''}`
    }
    return editKey
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

  if (error) return <p className="text-sm text-destructive">{error}</p>

  if (activeUntergruppen.length === 0) {
    return (
      <div className="rounded-md border p-8 text-center text-muted-foreground text-sm space-y-2">
        <p>Keine Produkte zur Planung vorhanden.</p>
        <p>
          Bitte in den{' '}
          <a
            href="/dashboard/kurzfristige-planung/marketing-einstellungen"
            className="underline text-foreground"
          >
            Marketing-Einstellungen
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
              <span>
                {wochen[0].label} – {wochen[wochen.length - 1].label}
              </span>
            )}
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={() => setRefreshDialogOpen(true)} disabled={isRefreshing || resetting}>
              <RefreshCw className={`h-3.5 w-3.5 mr-1.5 ${isRefreshing ? 'animate-spin' : ''}`} />
              {isRefreshing ? 'Wird aktualisiert…' : 'Historische Werte aktualisieren'}
            </Button>
            <Button variant="outline" size="sm" onClick={() => setResetDialogOpen(true)} disabled={resetting || isRefreshing}>
              <RotateCcw className="h-3.5 w-3.5 mr-1.5" />
              Zurücksetzen
            </Button>
          </div>
        </div>

        {/* Table */}
        <div className="overflow-x-auto rounded-md border">
          <table className="w-full text-sm border-collapse">
            <thead>
              {/* Month grouping row */}
              <tr className="border-b bg-muted/20">
                <th className="sticky left-0 z-20 bg-muted/20 min-w-[240px] max-w-[300px] px-3 py-1" />
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
                <th className="sticky left-0 z-20 bg-muted/40 min-w-[240px] max-w-[300px] px-3 py-2.5 text-left font-medium text-muted-foreground">
                  Metrik
                </th>
                {wochen.map(kw => {
                  const isNew =
                    isNewWeek &&
                    lastWoche &&
                    kw.year === lastWoche.year &&
                    kw.week === lastWoche.week
                  return (
                    <th
                      key={`${kw.year}-${kw.week}`}
                      className={[
                        'min-w-[100px] px-2 py-2.5 text-right font-medium text-xs border-l',
                        isNew
                          ? 'bg-red-50 text-red-700 dark:bg-red-950/30 dark:text-red-400'
                          : 'text-muted-foreground',
                      ].join(' ')}
                      title={isNew ? 'Neue Woche — Bitte Werte prüfen' : undefined}
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
                const isHeader           = row.kind === 'gruppe-header'
                const isPlattformHeader  = row.kind === 'plattform-header'
                const isPlattformProdukt = row.kind === 'plattform-produkt'
                const isGesamt           = row.kind === 'total-budget'
                const isReadOnly         = row.kind !== 'product-marketing-pct'

                const rowBg = isGesamt
                  ? 'bg-muted/60'
                  : isPlattformHeader
                  ? 'bg-muted/30'
                  : isPlattformProdukt
                  ? 'bg-muted/20'
                  : isHeader
                  ? 'bg-muted/30'
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
                      className={[
                        'sticky left-0 z-10 px-3 py-1.5 whitespace-nowrap',
                        isGesamt
                          ? 'bg-muted/60'
                          : isPlattformHeader
                          ? 'bg-muted/30'
                          : isPlattformProdukt
                          ? 'bg-muted/20'
                          : isHeader
                          ? 'bg-muted/30'
                          : 'bg-white dark:bg-background',
                      ].join(' ')}
                      style={{ paddingLeft: `${12 + row.indent * 16}px` }}
                    >
                      {isPlattformHeader ? (
                        <button
                          type="button"
                          className="flex items-center gap-1.5 text-sm font-semibold hover:text-primary"
                          onClick={() => togglePlattform(row.plattformId!)}
                        >
                          {row.expanded ? (
                            <ChevronDown className="h-3.5 w-3.5 shrink-0" />
                          ) : (
                            <ChevronRight className="h-3.5 w-3.5 shrink-0" />
                          )}
                          {row.label}
                        </button>
                      ) : isHeader ? (
                        <button
                          type="button"
                          className="flex items-center gap-1.5 text-sm font-semibold hover:text-primary"
                          onClick={() => toggleGruppe(row.kategorieId!)}
                        >
                          {row.expanded ? (
                            <ChevronDown className="h-3.5 w-3.5 shrink-0" />
                          ) : (
                            <ChevronRight className="h-3.5 w-3.5 shrink-0" />
                          )}
                          {row.label}
                          <Badge variant="secondary" className="text-[10px] px-1.5 py-0 font-normal leading-4">
                            {getKategoriePlattformLabel(row.kategorieId!)}
                          </Badge>
                        </button>
                      ) : (
                        <span
                          className={
                            isGesamt
                              ? 'text-sm font-semibold'
                              : isPlattformProdukt
                              ? 'text-sm font-medium text-muted-foreground'
                              : row.kind === 'product-marketing-pct'
                              ? 'text-sm text-foreground'
                              : 'text-sm text-muted-foreground'
                          }
                        >
                          {row.label}
                        </span>
                      )}
                    </td>

                    {/* Value cells */}
                    {wochen.map(kw => {
                      const { display, display2, rawNum, isManual, isEditable: cellEditable } =
                        getRowValue(row, kw)
                      const isNew =
                        isNewWeek &&
                        lastWoche &&
                        kw.year === lastWoche.year &&
                        kw.week === lastWoche.week

                      let editKey: string | null = null
                      if (cellEditable && row.produktId) {
                        editKey = mktEditKey(
                          row.produktId,
                          row.kategorieId!,
                          kw.year,
                          kw.week,
                        )
                      }

                      const isCurrentlyEditing =
                        editKey !== null && editingCell === editKey
                      const isSelected =
                        editKey !== null && selectedCells.has(editKey)
                      const isReadOnlySelected =
                        isReadOnly &&
                        rawNum !== null &&
                        selectedCells.has(`row:${row.id}:${kw.year}:${kw.week}`)

                      return (
                        <td
                          key={`${kw.year}-${kw.week}`}
                          className={[
                            'relative px-2 py-1.5 text-right text-xs tabular-nums select-none border-l',
                            isNew && cellEditable
                              ? 'bg-red-50 dark:bg-red-950/10'
                              : '',
                            isSelected || isReadOnlySelected
                              ? 'bg-blue-100 dark:bg-blue-900/30'
                              : '',
                            cellEditable ? 'cursor-pointer text-foreground' : 'text-muted-foreground',
                          ].join(' ')}
                          onClick={
                            cellEditable && editKey !== null && !isCurrentlyEditing
                              ? e => handleEditableCellClick(e, editKey!, display)
                              : undefined
                          }
                          onMouseDown={
                            cellEditable && editKey !== null
                              ? e => handleEditableCellMouseDown(e, editKey!, rawNum, isManual)
                              : rawNum !== null
                              ? e =>
                                  handleNonEditableMouseDown(
                                    e,
                                    `row:${row.id}:${kw.year}:${kw.week}`,
                                    rawNum,
                                  )
                              : undefined
                          }
                          onMouseEnter={
                            cellEditable && editKey !== null
                              ? () => handleEditableCellMouseEnter(editKey!, rawNum, isManual)
                              : rawNum !== null
                              ? () =>
                                  handleNonEditableMouseEnter(
                                    `row:${row.id}:${kw.year}:${kw.week}`,
                                    rawNum,
                                  )
                              : undefined
                          }
                        >
                          {/* Note indicator */}
                          {editKey && notizen.has(editKey) && !isCurrentlyEditing && (
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <span
                                  className="absolute top-0.5 right-0.5 z-10 cursor-default text-amber-500"
                                  onClick={e => {
                                    e.preventDefault()
                                    e.stopPropagation()
                                  }}
                                >
                                  <StickyNote className="h-2 w-2" />
                                </span>
                              </TooltipTrigger>
                              <TooltipContent
                                side="top"
                                align="end"
                                className="max-w-[220px] text-xs whitespace-pre-wrap break-words"
                              >
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
                              max="100"
                              step="0.01"
                              className="w-full text-right bg-transparent outline-none border-b border-primary text-xs tabular-nums"
                              value={editingValue}
                              onChange={e => setEditingValue(e.target.value)}
                              onBlur={() => handleCellBlur(row, kw, editKey!)}
                              onKeyDown={e => {
                                if (e.key === 'Enter')
                                  (e.target as HTMLInputElement).blur()
                                if (e.key === 'Escape') {
                                  setEditingCell(null)
                                  setEditingValue('')
                                }
                              }}
                              onClick={e => e.stopPropagation()}
                              onMouseDown={e => e.stopPropagation()}
                            />
                          ) : (
                            <div
                              className={[
                                'flex items-center justify-end gap-1',
                                isNew && cellEditable
                                  ? 'ring-1 ring-red-300 dark:ring-red-700 rounded px-1'
                                  : '',
                              ].join(' ')}
                            >
                              {cellEditable && (
                                <span
                                  className={[
                                    'inline-block w-1.5 h-1.5 rounded-full shrink-0',
                                    isManual
                                      ? 'bg-blue-500'
                                      : 'bg-gray-300 dark:bg-gray-600',
                                  ].join(' ')}
                                  title={
                                    isManual
                                      ? 'Manuell eingegeben'
                                      : 'Historisch berechnet'
                                  }
                                />
                              )}
                              {display2 !== undefined ? (
                                <div className="flex flex-col items-end gap-0">
                                  <span>{display}</span>
                                  {display2 && (
                                    <span className="text-[10px] text-muted-foreground leading-tight">
                                      {display2}
                                    </span>
                                  )}
                                </div>
                              ) : (
                                <span>
                                  {display}
                                  {cellEditable && display !== '' ? ' %' : ''}
                                </span>
                              )}
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
        {bulkEditActive && (
          <div
            data-betrag-selektion="true"
            className="fixed bottom-[6.5rem] right-6 z-40 flex items-center gap-2 rounded-lg border bg-background px-4 py-2 shadow-lg text-sm"
          >
            <Pencil className="h-3.5 w-3.5 text-muted-foreground" />
            <span className="text-muted-foreground">
              {selectedCells.size} Marketingkosten-%-Felder ausgewählt
            </span>
            <Button size="sm" onClick={() => setBulkEditOpen(true)}>
              Anpassen
            </Button>
          </div>
        )}

        {/* Bottom-right floating panels */}
        {(selectedCells.size > 0 || bulkEditActive) && (
          <div
            data-betrag-selektion="true"
            className="fixed bottom-6 right-6 z-50 flex flex-col gap-2 items-stretch"
          >
            {/* Notiz panel — nur bei genau 1 editierbarer Zelle */}
            {selectedCells.size === 1 &&
              (() => {
                const key = Array.from(selectedCells.keys())[0]
                if (!key.endsWith(':pct')) return null
                const hasNotiz = notizen.has(key)
                return (
                  <div className="rounded-lg border bg-background shadow-lg text-sm">
                    <button
                      type="button"
                      className="flex items-center gap-2 px-4 py-2.5 w-full hover:bg-muted/50 rounded-lg transition-colors"
                      onClick={() => {
                        notizCellKeyRef.current  = key
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

            {/* Reset auf Berechnungsmethode */}
            {hasManualCellsSelected && (
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
        <MarketingplanungBulkEditDialog
          open={bulkEditOpen}
          onClose={() => setBulkEditOpen(false)}
          cells={bulkEditCells}
          onApply={handleBulkApply}
        />

        {/* Notiz formular */}
        <PlanungNotizFormular
          open={notizFormularOpen}
          onOpenChange={setNotizFormularOpen}
          cellLabel={notizCellLabelRef.current}
          currentNotiz={
            notizCellKeyRef.current
              ? (notizen.get(notizCellKeyRef.current) ?? null)
              : null
          }
          onSave={text => upsertNotiz(notizCellKeyRef.current, text)}
          onDelete={() => deleteNotiz(notizCellKeyRef.current)}
        />

        {/* Reset confirm dialog */}
        <AlertDialog open={resetDialogOpen} onOpenChange={setResetDialogOpen}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Marketing-Planung zurücksetzen?</AlertDialogTitle>
              <AlertDialogDescription>
                Alle manuell eingegebenen Marketingkosten-%-Werte werden entfernt. Die Felder
                werden wieder mit den historisch berechneten Werten befüllt. Diese Aktion kann
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
