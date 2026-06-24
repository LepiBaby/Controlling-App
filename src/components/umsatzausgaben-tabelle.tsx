'use client'

import { useState, useEffect, useRef, useMemo, Fragment } from 'react'
import {
  ChevronDown, ChevronRight, ChevronsDownUp, ChevronsUpDown,
  Plus, RotateCcw, StickyNote,
} from 'lucide-react'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Command, CommandEmpty, CommandInput, CommandItem, CommandList } from '@/components/ui/command'
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

function thursdayOfISOWeek(year: number, week: number): Date {
  const jan4 = new Date(Date.UTC(year, 0, 4))
  const dow = jan4.getUTCDay() || 7
  const monday1 = new Date(jan4.getTime() - (dow - 1) * 86_400_000)
  return new Date(monday1.getTime() + (week - 1) * 7 * 86_400_000 + 3 * 86_400_000)
}

// ─── Row types ────────────────────────────────────────────────────────────────

type RowKind = 'total' | 'category-header' | 'subgroup-header' | 'leaf' | 'add-product'

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

export function UmsatzausgabenTabelle({ referenceDate }: { referenceDate?: Date } = {}) {
  const {
    vergangenheitswochen,
    zukunftswochen,
    kategorien,
    produkte,
    values,
    berechneteWerte,
    istTatsaechlichMap,
    unassignedMarketingL2Ids,
    loading,
    error,
    getManuellerWert,
    getIstTatsaechlich,
    getIstPlan,
    getBerechneterWert,
    upsertZelle,
    resetAll,
  } = useUmsatzausgaben(referenceDate)

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

  // Manually added products per L2 category (session-only; persists via saved values on reload)
  const [manuallyAddedProducts, setManuallyAddedProducts] = useState<Map<string, Set<string>>>(new Map())
  const [addProductL2Id, setAddProductL2Id] = useState<string | null>(null)

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

  // For each L2 category: which product IDs have any data (berechnet, manual, or ist-tatsächlich)
  const produktsByL2 = useMemo(() => {
    const map = new Map<string, Set<string>>()
    function addProd(katId: string, prodId: string) {
      if (!map.has(katId)) map.set(katId, new Set())
      map.get(katId)!.add(prodId)
    }
    for (const key of berechneteWerte.keys()) {
      const parts = key.split(':'); const katId = parts[0]; const prodId = parts[1]
      if (prodId) addProd(katId, prodId)
    }
    for (const key of values.keys()) {
      const parts = key.split(':'); const katId = parts[0]; const prodId = parts[1]
      if (prodId) addProd(katId, prodId)
    }
    for (const key of istTatsaechlichMap.keys()) {
      const parts = key.split(':'); const katId = parts[0]; const prodId = parts[1]
      if (prodId) addProd(katId, prodId)
    }
    return map
  }, [berechneteWerte, values, istTatsaechlichMap])

  // L2 IDs that appear in berechnet data — only Produktausgaben L2s are in bestellungskosten
  const berechneteL2Ids = useMemo(() => {
    const ids = new Set<string>()
    for (const key of berechneteWerte.keys()) ids.add(key.split(':')[0])
    return ids
  }, [berechneteWerte])

  // Vertrieb + Marketing: always show by name
  // Produktausgaben: show any L1 whose L2 children appear in berechnet data
  // (backend only generates berechnet data for the 3 relevant groups, so this is a safe filter)
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
      const l2s = childrenByParent.get(l1.id) ?? []
      if (l2s.length > 0) ids.add(l1.id)
      for (const l2 of l2s) {
        const l2ProdIds = produktsByL2.get(l2.id)
        const manualIds = manuallyAddedProducts.get(l2.id)
        const hasAny = (l2ProdIds && l2ProdIds.size > 0) || (manualIds && manualIds.size > 0)
        if (hasAny && produkte.length > 0) ids.add(l2.id)
      }
    }
    return ids
  }, [visibleL1Kategorien, childrenByParent, produktsByL2, produkte, manuallyAddedProducts])

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

    for (const l1 of visibleL1Kategorien) {
      const allL2s = childrenByParent.get(l1.id) ?? []
      // For marketing: only show L2 subgroups not assigned to any sales platform
      const isMarketing = l1.name.toLowerCase().includes('marketing')
      const l2s = isMarketing && unassignedMarketingL2Ids !== null
        ? allL2s.filter(l2 => unassignedMarketingL2Ids.has(l2.id))
        : allL2s
      const l1Expanded = expandedIds.has(l1.id)
      const l1L2Ids = l2s.map(l2 => l2.id)
      const l1ChildLeafs: Array<{ l2KatId: string; produktId: string | null }> = []

      for (const l2 of l2s) {
        // Show products with existing data + manually added ones for this session
        const l2ProdIds = produktsByL2.get(l2.id)
        const l2ManualIds = manuallyAddedProducts.get(l2.id) ?? new Set<string>()
        const combinedProdIds = new Set([...(l2ProdIds ?? []), ...l2ManualIds])
        const l2Produkte = combinedProdIds.size > 0
          ? produkte.filter(p => combinedProdIds.has(p.id))
          : []
        const hasProducts = l2Produkte.length > 0
        if (hasProducts) {
          const pairs = l2Produkte.map(p => ({ l2KatId: l2.id, produktId: p.id }))
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
            const l2ProdIds = produktsByL2.get(l2.id)
            const l2ManualIds = manuallyAddedProducts.get(l2.id) ?? new Set<string>()
            const combinedProdIds = new Set([...(l2ProdIds ?? []), ...l2ManualIds])
            const l2Produkte = combinedProdIds.size > 0
              ? produkte.filter(p => combinedProdIds.has(p.id))
              : []
            const hasProducts = l2Produkte.length > 0
            const l2Expanded = hasProducts && expandedIds.has(l2.id)
            const l2ChildLeafs = hasProducts
              ? l2Produkte.map(p => ({ l2KatId: l2.id, produktId: p.id }))
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
              for (const prod of l2Produkte) {
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
              // "Produkt hinzufügen" button row at the bottom of each expanded L2 group
              rows.push({
                id: `add-product-${l2.id}`,
                kind: 'add-product',
                label: '',
                indent: 2,
                l1KategorieId: l1.id,
                l2KategorieId: l2.id,
                isEditable: false,
                canHaveAutoWert: false,
                expandable: false,
                expanded: false,
              })
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
      label: 'Umsatzausgaben (Gesamt)',
      indent: 0,
      isEditable: false,
      canHaveAutoWert: false,
      expandable: false,
      expanded: false,
      childL2Ids: allL2Ids,
      childLeafs: allLeafPairs,
    })

    return rows
  }, [visibleL1Kategorien, childrenByParent, expandedIds, produktsByL2, produkte, unassignedMarketingL2Ids, manuallyAddedProducts])

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
    if (row.kind === 'leaf') {
      return getIstTatsaechlich(row.l2KategorieId!, row.produktId ?? null, kw)
    }
    if (row.childLeafs && row.childLeafs.length > 0) {
      const { total, hasAny } = sumChildLeafs(
        row.childLeafs, kw,
        (l2Id, pId) => getIstTatsaechlich(l2Id, pId, kw),
      )
      return hasAny ? total : null
    }
    if (row.kind === 'subgroup-header' && row.l2KategorieId) {
      return getIstTatsaechlich(row.l2KategorieId, null, kw)
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
        return { display: hasAny ? formatNum(total) : '—', rawNum: hasAny ? total : null, indicator: null, isEditable: false }
      }
      return { display: '—', rawNum: null, indicator: null, isEditable: false }
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
      return true
    }
    return false
  }, [selectedCells, values])

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
        return true
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

  // ─── Add product to L2 group ─────────────────────────────────────────────

  function handleAddProduct(l2KatId: string, produktId: string) {
    setManuallyAddedProducts(prev => {
      const next = new Map(prev)
      const ids = new Set(next.get(l2KatId) ?? [])
      ids.add(produktId)
      next.set(l2KatId, ids)
      return next
    })
    setExpandedIds(prev => new Set([...prev, l2KatId]))
    setAddProductL2Id(null)
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
                // ─── Add-product row ───────────────────────────────────────
                if (row.kind === 'add-product') {
                  const l2Id = row.l2KategorieId!
                  const existingProdIds = new Set([
                    ...(produktsByL2.get(l2Id) ?? []),
                    ...(manuallyAddedProducts.get(l2Id) ?? []),
                  ])
                  const availableProds = produkte.filter(p => !existingProdIds.has(p.id))
                  if (availableProds.length === 0) return null
                  return (
                    <tr key={row.id} className="border-b bg-white dark:bg-background">
                      <td
                        className="sticky left-0 z-10 px-3 py-1 bg-white dark:bg-background"
                        style={{ paddingLeft: `${12 + 2 * 16}px` }}
                      >
                        <Popover
                          open={addProductL2Id === l2Id}
                          onOpenChange={open => setAddProductL2Id(open ? l2Id : null)}
                        >
                          <PopoverTrigger asChild>
                            <button
                              type="button"
                              data-betrag-selektion="true"
                              className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
                            >
                              <Plus className="h-3 w-3" />
                              Produkt hinzufügen
                            </button>
                          </PopoverTrigger>
                          <PopoverContent
                            className="p-0 w-56"
                            align="start"
                            data-betrag-selektion="true"
                          >
                            <Command>
                              <CommandInput placeholder="Produkt suchen…" className="h-8 text-xs" />
                              <CommandList>
                                <CommandEmpty className="py-3 text-center text-xs text-muted-foreground">
                                  Kein Produkt gefunden.
                                </CommandEmpty>
                                {availableProds.map(p => (
                                  <CommandItem
                                    key={p.id}
                                    value={p.name}
                                    className="text-xs"
                                    onSelect={() => handleAddProduct(l2Id, p.id)}
                                  >
                                    {p.name}
                                  </CommandItem>
                                ))}
                              </CommandList>
                            </Command>
                          </PopoverContent>
                        </Popover>
                      </td>
                      <td colSpan={vergangenheitswochen.length * 2 + zukunftswochen.length} />
                    </tr>
                  )
                }

                const isTotal = row.kind === 'total'
                const isL1Header = row.kind === 'category-header'
                const isL2Header = row.kind === 'subgroup-header'
                const isLeaf = row.kind === 'leaf'

                const rowBg = isTotal ? 'bg-muted/60'
                  : isL1Header ? 'bg-muted/30'
                  : 'bg-white dark:bg-background'

                const stickyBg = isTotal || isL1Header ? 'bg-muted'
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
                            onMouseDown={istP !== null ? e => handleNonEditableMouseDown(e, istPKey, istP) : undefined}
                            onMouseEnter={() => istP !== null && handleNonEditableMouseEnter(istPKey, istP)}
                          >
                            <span className={['text-muted-foreground', isTotal ? 'font-semibold' : ''].join(' ')}>
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
