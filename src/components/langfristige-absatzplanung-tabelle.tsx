'use client'

import { useState, useEffect, useRef, useCallback, useMemo } from 'react'
import { ChevronDown, ChevronRight, Pencil, StickyNote } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import { useToast } from '@/hooks/use-toast'
import {
  useLangfristigeAbsatzplanung,
  absatzCellKey,
  vkCellKey,
  type PlanungsMonat,
} from '@/hooks/use-langfristige-absatzplanung'
import type { KpiCategory } from '@/hooks/use-kpi-categories'
import {
  LangfristigeAbsatzplanungBulkEditDialog,
  type BulkEditCell,
  type BulkEditResult,
} from '@/components/langfristige-absatzplanung-bulk-edit-dialog'
import { useLangfristigePlanungNotizen } from '@/hooks/use-langfristige-planung-notizen'
import { PlanungNotizFormular } from '@/components/planung-notiz-formular'

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatNum(v: number | null, decimals = 2): string {
  if (v === null) return '—'
  return v.toLocaleString('de-DE', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  })
}

// ─── Row types ────────────────────────────────────────────────────────────────

type RowKind =
  | 'gesamt-absatz'
  | 'gesamt-product-absatz' // je Produkt, plattformübergreifend (unter "Absatz (Gesamt)")
  | 'gesamt-umsatz'
  | 'gesamt-product-umsatz' // je Produkt, plattformübergreifend (unter "Ziel Brutto-Umsatz (Gesamt)")
  | 'platform-header'
  | 'platform-absatz'
  | 'platform-umsatz'
  | 'product-absatz' // editierbar (je Produkt)
  | 'product-vk' // editierbar
  | 'product-umsatz' // berechnet

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

function computeUmsatz(absatz: number, vk: number | null): number | null {
  if (vk === null) return null
  return absatz * vk
}

// ─── Main component ───────────────────────────────────────────────────────────

export function LangfristigeAbsatzplanungTabelle({ versionId }: { versionId: string }) {
  const {
    monate,
    plattformen,
    produkte,
    loading,
    error,
    getAbsatz,
    getVK,
    upsertCell,
    upsertBatch,
  } = useLangfristigeAbsatzplanung(versionId)

  const { toast } = useToast()
  const [expandedPlatforms, setExpandedPlatforms] = useState<Set<string>>(new Set())
  const [gesamtAbsatzExpanded, setGesamtAbsatzExpanded] = useState(false)
  const [gesamtUmsatzExpanded, setGesamtUmsatzExpanded] = useState(false)

  // Betragsselektion / Mehrfachselektion
  const [selectedCells, setSelectedCells] = useState<Map<string, number>>(new Map())
  const isDragging = useRef(false)
  const selectionSum = Array.from(selectedCells.values()).reduce((a, b) => a + b, 0)

  // Bulk edit
  const [bulkEditOpen, setBulkEditOpen] = useState(false)

  // Notizen (versionsgebunden)
  const { notizen, upsertNotiz, deleteNotiz } = useLangfristigePlanungNotizen(versionId, 'absatzplanung')
  const [notizFormularOpen, setNotizFormularOpen] = useState(false)
  const notizCellKeyRef = useRef<string>('')
  const notizCellLabelRef = useRef<string>('')

  // Inline-Editing
  const [editingCell, setEditingCellState] = useState<string | null>(null)
  const editingCellRef = useRef<string | null>(null)
  const [editingValue, setEditingValue] = useState('')
  const editingOriginalValue = useRef<string>('')

  function setEditingCell(key: string | null) {
    editingCellRef.current = key
    setEditingCellState(key)
  }

  // Alle Plattformen beim ersten Laden ausklappen
  useEffect(() => {
    if (!loading && plattformen.length > 0) {
      setExpandedPlatforms(new Set(plattformen.map(p => p.id)))
    }
  }, [loading, plattformen])

  // Klick außerhalb hebt die Selektion auf
  useEffect(() => {
    function onMouseDown(e: MouseEvent) {
      if (bulkEditOpen) return
      const target = e.target as Element
      if (target.closest('[data-betrag-selektion]')) return
      setSelectedCells(new Map())
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
  }, [bulkEditOpen])

  // ─── Jahres-Gruppierung der Monatsspalten ────────────────────────────────────

  const yearGroups = useMemo(() => {
    const groups: { label: string; count: number }[] = []
    for (const m of monate) {
      const label = String(m.year)
      if (groups.length === 0 || groups[groups.length - 1].label !== label) {
        groups.push({ label, count: 1 })
      } else {
        groups[groups.length - 1].count++
      }
    }
    return groups
  }, [monate])

  // ─── Aggregation ─────────────────────────────────────────────────────────────

  const aggregatePlatformAbsatz = useCallback(
    (plattformId: string, monat: PlanungsMonat): number =>
      produkte.reduce((sum, p) => sum + (getAbsatz(plattformId, p.id, monat) ?? 0), 0),
    [produkte, getAbsatz],
  )

  const aggregatePlatformUmsatz = useCallback(
    (plattformId: string, monat: PlanungsMonat): number | null => {
      let total = 0
      let hasValue = false
      for (const prd of produkte) {
        const u = computeUmsatz(getAbsatz(plattformId, prd.id, monat) ?? 0, getVK(plattformId, prd.id, monat))
        if (u !== null) {
          total += u
          hasValue = true
        }
      }
      return hasValue ? total : null
    },
    [produkte, getAbsatz, getVK],
  )

  // ─── Flache Zeilenliste ──────────────────────────────────────────────────────

  const flatRows = useMemo((): FlatRow[] => {
    const rows: FlatRow[] = []

    rows.push({ id: 'gesamt-absatz', kind: 'gesamt-absatz', label: 'Absatz (Gesamt)', indent: 0, expandable: true, expanded: gesamtAbsatzExpanded })
    if (gesamtAbsatzExpanded) {
      for (const prd of produkte) {
        rows.push({ id: `gesamt-prd-${prd.id}`, kind: 'gesamt-product-absatz', label: prd.name, indent: 1, produktId: prd.id })
      }
    }
    rows.push({ id: 'gesamt-umsatz', kind: 'gesamt-umsatz', label: 'Ziel Brutto-Umsatz (Gesamt)', indent: 0, expandable: true, expanded: gesamtUmsatzExpanded })
    if (gesamtUmsatzExpanded) {
      for (const prd of produkte) {
        rows.push({ id: `gesamt-umsatz-prd-${prd.id}`, kind: 'gesamt-product-umsatz', label: prd.name, indent: 1, produktId: prd.id })
      }
    }

    for (const plt of plattformen) {
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
        for (const prd of produkte) {
          rows.push({ id: `prd-absatz-${plt.id}-${prd.id}`, kind: 'product-absatz', label: `${prd.name} - Absatz`, indent: 2, plattformId: plt.id, produktId: prd.id })
          rows.push({ id: `prd-vk-${plt.id}-${prd.id}`, kind: 'product-vk', label: `${prd.name} - Effektiver VK`, indent: 2, plattformId: plt.id, produktId: prd.id })
          rows.push({ id: `prd-umsatz-${plt.id}-${prd.id}`, kind: 'product-umsatz', label: `${prd.name} - Ziel Brutto-Umsatz`, indent: 2, plattformId: plt.id, produktId: prd.id })
        }
      }
    }

    return rows
  }, [plattformen, produkte, expandedPlatforms, gesamtAbsatzExpanded, gesamtUmsatzExpanded])

  // ─── Zellwert je Zeile × Monat ───────────────────────────────────────────────

  function getRowValue(
    row: FlatRow,
    monat: PlanungsMonat,
  ): { display: string; rawNum: number | null; isEditable: boolean } {
    switch (row.kind) {
      case 'product-absatz': {
        const val = getAbsatz(row.plattformId!, row.produktId!, monat)
        return { display: val !== null ? formatNum(val) : '', rawNum: val, isEditable: true }
      }
      case 'product-vk': {
        const val = getVK(row.plattformId!, row.produktId!, monat)
        return { display: val !== null ? formatNum(val) : '', rawNum: val, isEditable: true }
      }
      case 'product-umsatz': {
        const u = computeUmsatz(getAbsatz(row.plattformId!, row.produktId!, monat) ?? 0, getVK(row.plattformId!, row.produktId!, monat))
        return { display: u !== null ? formatNum(u) : '—', rawNum: u, isEditable: false }
      }
      case 'platform-absatz': {
        const val = aggregatePlatformAbsatz(row.plattformId!, monat)
        return { display: formatNum(val), rawNum: val, isEditable: false }
      }
      case 'platform-umsatz': {
        const u = aggregatePlatformUmsatz(row.plattformId!, monat)
        return { display: u !== null ? formatNum(u) : '—', rawNum: u, isEditable: false }
      }
      case 'gesamt-absatz': {
        const val = plattformen.reduce((sum, plt) => sum + aggregatePlatformAbsatz(plt.id, monat), 0)
        return { display: formatNum(val), rawNum: val, isEditable: false }
      }
      case 'gesamt-product-absatz': {
        // Absatz eines Produkts über alle Plattformen summiert
        const val = plattformen.reduce((sum, plt) => sum + (getAbsatz(plt.id, row.produktId!, monat) ?? 0), 0)
        return { display: formatNum(val), rawNum: val, isEditable: false }
      }
      case 'gesamt-product-umsatz': {
        // Ziel Brutto-Umsatz eines Produkts über alle Plattformen summiert
        let total = 0
        let hasValue = false
        for (const plt of plattformen) {
          const u = computeUmsatz(getAbsatz(plt.id, row.produktId!, monat) ?? 0, getVK(plt.id, row.produktId!, monat))
          if (u !== null) {
            total += u
            hasValue = true
          }
        }
        return { display: hasValue ? formatNum(total) : '—', rawNum: hasValue ? total : null, isEditable: false }
      }
      case 'gesamt-umsatz': {
        let total = 0
        let hasValue = false
        for (const plt of plattformen) {
          const u = aggregatePlatformUmsatz(plt.id, monat)
          if (u !== null) {
            total += u
            hasValue = true
          }
        }
        return { display: hasValue ? formatNum(total) : '—', rawNum: hasValue ? total : null, isEditable: false }
      }
      default:
        return { display: '', rawNum: null, isEditable: false }
    }
  }

  // ─── Selektion: nicht-editierbare Zellen ─────────────────────────────────────

  function handleNonEditableMouseDown(e: React.MouseEvent, key: string, value: number) {
    e.preventDefault()
    e.stopPropagation()
    isDragging.current = true
    const multi = e.ctrlKey || e.metaKey
    setSelectedCells(prev => {
      if (multi) {
        if (prev.has(key)) {
          const n = new Map(prev)
          n.delete(key)
          return n
        }
        return new Map([...prev, [key, value]])
      }
      return new Map([[key, value]])
    })
  }

  function handleNonEditableMouseEnter(key: string, value: number) {
    if (!isDragging.current) return
    setSelectedCells(prev => (prev.has(key) ? prev : new Map([...prev, [key, value]])))
  }

  // ─── Selektion + Editing: editierbare Zellen ─────────────────────────────────

  function handleEditableCellMouseDown(e: React.MouseEvent, editKey: string, rawNum: number | null) {
    if (!(e.ctrlKey || e.metaKey)) return
    e.preventDefault()
    e.stopPropagation()
    isDragging.current = true
    const selectValue = rawNum ?? 0
    setSelectedCells(prev => {
      if (prev.has(editKey)) {
        const n = new Map(prev)
        n.delete(editKey)
        return n
      }
      return new Map([...prev, [editKey, selectValue]])
    })
  }

  function handleEditableCellClick(e: React.MouseEvent, editKey: string, display: string) {
    if (e.ctrlKey || e.metaKey) return
    e.stopPropagation()
    setSelectedCells(new Map())
    const origVal = display === '—' || display === '' ? '' : display.replace(/\./g, '').replace(',', '.')
    editingOriginalValue.current = origVal
    setEditingCell(editKey)
    setEditingValue(origVal)
  }

  function handleEditableCellMouseEnter(editKey: string, rawNum: number | null) {
    if (!isDragging.current) return
    const selectValue = rawNum ?? 0
    setSelectedCells(prev => (prev.has(editKey) ? prev : new Map([...prev, [editKey, selectValue]])))
  }

  // ─── Inline-Edit blur ─────────────────────────────────────────────────────────

  async function handleCellBlur(row: FlatRow, monat: PlanungsMonat, editKey: string) {
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

    const field = row.kind === 'product-absatz' ? 'absatz' : 'vk'
    try {
      await upsertCell(row.plattformId!, row.produktId!, monat, field, parsedNew)
    } catch {
      toast({ title: 'Fehler beim Speichern', description: 'Wert konnte nicht gespeichert werden.', variant: 'destructive' })
    }
  }

  // ─── Bulk edit ────────────────────────────────────────────────────────────────

  const bulkEditType = useMemo((): 'absatz' | 'vk' | null => {
    const keys = Array.from(selectedCells.keys())
    if (keys.length < 2) return null
    const types = new Set(keys.map(k => (k.endsWith(':absatz') ? 'absatz' : k.endsWith(':vk') ? 'vk' : 'other')))
    if (types.has('other')) return null
    if (types.size === 1) return types.values().next().value as 'absatz' | 'vk'
    return null
  }, [selectedCells])

  const bulkEditCells = useMemo((): BulkEditCell[] => {
    if (!bulkEditType) return []
    const result: BulkEditCell[] = []
    for (const [key, value] of selectedCells.entries()) {
      const parts = key.split(':')
      // ${plattformId}:${produktId}:${year}:${month}:${field}
      if (parts.length !== 5) continue
      const plattformId = parts[0]
      const produktId = parts[1]
      const year = parseInt(parts[2])
      const month = parseInt(parts[3])
      const field = parts[4] as 'absatz' | 'vk'
      const monat = monate.find(m => m.year === year && m.month === month)
      if (monat) result.push({ produktId, plattformId, monat, currentValue: value, field })
    }
    return result
  }, [bulkEditType, selectedCells, monate])

  async function handleBulkApply(results: BulkEditResult[]) {
    const field = bulkEditType!
    try {
      await upsertBatch(
        results.map(r => ({
          plattformId: r.plattformId,
          produktId: r.produktId,
          monat: r.monat,
          field,
          value: r.newValue,
        })),
      )
      setSelectedCells(new Map())
    } catch {
      toast({ title: 'Fehler', description: 'Massen-Anpassung konnte nicht gespeichert werden.', variant: 'destructive' })
    }
  }

  // ─── Toggle / Notiz-Helfer ───────────────────────────────────────────────────

  function togglePlatform(plattformId: string) {
    setExpandedPlatforms(prev => {
      const next = new Set(prev)
      if (next.has(plattformId)) next.delete(plattformId)
      else next.add(plattformId)
      return next
    })
  }

  function isEditableNotizKey(key: string): boolean {
    return key.endsWith(':absatz') || key.endsWith(':vk')
  }

  function getNotizCellLabel(editKey: string): string {
    const parts = editKey.split(':')
    if (parts.length !== 5) return editKey
    const plattformId = parts[0]
    const produktId = parts[1]
    const year = parseInt(parts[2])
    const month = parseInt(parts[3])
    const field = parts[4]
    const monat = monate.find(m => m.year === year && m.month === month)
    const prd = produkte.find(p => p.id === produktId)
    const plt = plattformen.find(p => p.id === plattformId)
    const fieldLabel = field === 'vk' ? ' (Effektiver VK)' : ''
    return `${prd?.name ?? produktId}${fieldLabel} · ${plt?.name ?? ''} · ${monat?.label ?? ''}`
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

  if (plattformen.length === 0 || produkte.length === 0) {
    return (
      <div className="rounded-md border p-8 text-center text-muted-foreground text-sm space-y-2">
        <p>Keine Plattformen oder Produkte zur Planung vorhanden.</p>
        <p>
          Bitte zuerst in der{' '}
          <a
            href={`/dashboard/langfristige-planung/${versionId}/kpi-modell-verwaltung`}
            className="underline text-foreground"
          >
            KPI-Modell Verwaltung
          </a>{' '}
          dieser Planversion mindestens eine Sales Plattform und ein Produkt anlegen.
        </p>
      </div>
    )
  }

  // ─── Render ───────────────────────────────────────────────────────────────────

  return (
    <TooltipProvider delayDuration={400}>
      <div data-betrag-selektion="true" className="space-y-4">
        {/* Zeitraum-Hinweis */}
        {monate.length > 0 && (
          <div className="text-sm text-muted-foreground">
            {monate[0].label} – {monate[monate.length - 1].label}
          </div>
        )}

        {/* Tabelle */}
        <div className="overflow-x-auto rounded-md border">
          {/* table-fixed + colgroup: feste Spaltenbreiten → eine angeklickte Zelle
              (Inline-Input) verändert die Spaltenbreite nicht mehr. */}
          <table
            className="w-full text-sm border-collapse table-fixed"
            style={{ minWidth: `${260 + monate.length * 96}px` }}
          >
            <colgroup>
              <col className="w-[260px]" />
              {monate.map(m => (
                <col key={`col-${m.year}-${m.month}`} className="w-[96px]" />
              ))}
            </colgroup>
            <thead>
              {/* Jahres-Gruppierung */}
              <tr className="border-b bg-muted/20">
                <th className="sticky left-0 z-20 bg-muted px-3 py-1" />
                {yearGroups.map((g, i) => (
                  <th
                    key={g.label + i}
                    colSpan={g.count}
                    className="px-2 py-1 text-center text-xs font-medium text-muted-foreground border-l"
                  >
                    {g.label}
                  </th>
                ))}
              </tr>
              {/* Monats-Kopfzeile */}
              <tr className="border-b bg-muted/40">
                <th className="sticky left-0 z-20 bg-muted px-3 py-2.5 text-left font-medium text-muted-foreground">
                  Metrik
                </th>
                {monate.map(m => (
                  <th
                    key={`${m.year}-${m.month}`}
                    className="px-2 py-2.5 text-left font-medium text-xs border-l text-muted-foreground"
                  >
                    {m.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {flatRows.map(row => {
                const isHeader = row.kind === 'platform-header'
                const isGesamt = row.kind === 'gesamt-absatz' || row.kind === 'gesamt-umsatz'
                const isPlatformMetric = row.kind === 'platform-absatz' || row.kind === 'platform-umsatz'

                const bg = isGesamt
                  ? 'bg-muted/60'
                  : isHeader
                    ? 'bg-muted/30'
                    : isPlatformMetric
                      ? 'bg-muted/20'
                      : 'bg-white dark:bg-background'

                // Sticky-Label-Spalte: deckende (opake) Hintergründe, damit beim
                // horizontalen Scrollen keine Werte-Zellen durchscheinen.
                const labelBg = isGesamt
                  ? 'bg-muted'
                  : isHeader
                    ? 'bg-muted'
                    : isPlatformMetric
                      ? 'bg-muted'
                      : 'bg-background'

                return (
                  <tr
                    key={row.id}
                    className={[
                      'border-b last:border-0 hover:bg-muted/20 transition-colors',
                      // Trennlinien für die Gruppierung — Plattform-Sektionen kräftiger,
                      // Produkt-Gruppen subtiler (visuelle Hierarchie Plattform > Produkt).
                      row.kind === 'platform-header' ? 'border-t-[2.25px] border-t-foreground/40' : '',
                      row.kind === 'product-absatz' ? 'border-t-[2.25px] border-t-foreground/20' : '',
                      bg,
                    ].join(' ')}
                  >
                    {/* Label-Zelle */}
                    <td
                      className={['sticky left-0 z-10 px-3 py-1.5 overflow-hidden whitespace-nowrap text-ellipsis', labelBg].join(' ')}
                      style={{ paddingLeft: `${12 + row.indent * 16}px` }}
                      title={row.label}
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
                      ) : row.kind === 'gesamt-absatz' ? (
                        <button
                          type="button"
                          className="flex items-center gap-1 text-sm font-semibold hover:text-primary"
                          onClick={() => setGesamtAbsatzExpanded(v => !v)}
                        >
                          {row.expanded ? <ChevronDown className="h-3.5 w-3.5 shrink-0" /> : <ChevronRight className="h-3.5 w-3.5 shrink-0" />}
                          {row.label}
                        </button>
                      ) : row.kind === 'gesamt-umsatz' ? (
                        <button
                          type="button"
                          className="flex items-center gap-1 text-sm font-semibold hover:text-primary"
                          onClick={() => setGesamtUmsatzExpanded(v => !v)}
                        >
                          {row.expanded ? <ChevronDown className="h-3.5 w-3.5 shrink-0" /> : <ChevronRight className="h-3.5 w-3.5 shrink-0" />}
                          {row.label}
                        </button>
                      ) : (
                        <span
                          className={
                            isGesamt
                              ? 'text-sm font-semibold'
                              : isPlatformMetric
                                ? 'text-sm font-medium text-muted-foreground'
                                : row.kind === 'product-vk' || row.kind === 'product-absatz'
                                  ? 'text-sm text-foreground'
                                  : 'text-sm text-muted-foreground'
                          }
                        >
                          {row.label}
                        </span>
                      )}
                    </td>

                    {/* Wert-Zellen */}
                    {monate.map(m => {
                      const { display, rawNum, isEditable: cellEditable } = getRowValue(row, m)

                      let editKey: string | null = null
                      if (cellEditable && row.plattformId && row.produktId) {
                        editKey =
                          row.kind === 'product-absatz'
                            ? absatzCellKey(row.plattformId, row.produktId, m.year, m.month)
                            : vkCellKey(row.plattformId, row.produktId, m.year, m.month)
                      }

                      const isCurrentlyEditing = editKey !== null && editingCell === editKey
                      const cellKey = editKey ?? `row:${row.id}:${m.year}:${m.month}`
                      const isSelected = selectedCells.has(cellKey)

                      return (
                        <td
                          key={`${m.year}-${m.month}`}
                          className={[
                            'relative px-2 py-1.5 text-left text-xs tabular-nums select-none border-l',
                            isSelected ? 'bg-blue-100 dark:bg-blue-900/30' : '',
                            cellEditable ? 'cursor-pointer text-foreground' : 'text-muted-foreground',
                          ].join(' ')}
                          onClick={
                            cellEditable && editKey !== null && !isCurrentlyEditing
                              ? e => handleEditableCellClick(e, editKey!, display)
                              : undefined
                          }
                          onMouseDown={
                            cellEditable && editKey !== null
                              ? e => handleEditableCellMouseDown(e, editKey!, rawNum)
                              : !cellEditable && rawNum !== null
                                ? e => handleNonEditableMouseDown(e, `row:${row.id}:${m.year}:${m.month}`, rawNum)
                                : undefined
                          }
                          onMouseEnter={
                            cellEditable && editKey !== null
                              ? () => handleEditableCellMouseEnter(editKey!, rawNum)
                              : !cellEditable && rawNum !== null
                                ? () => handleNonEditableMouseEnter(`row:${row.id}:${m.year}:${m.month}`, rawNum)
                                : undefined
                          }
                        >
                          {/* Notiz-Indikator */}
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
                              onBlur={() => handleCellBlur(row, m, editKey!)}
                              onKeyDown={e => {
                                if (e.key === 'Enter') (e.target as HTMLInputElement).blur()
                                if (e.key === 'Escape') {
                                  setEditingCell(null)
                                  setEditingValue('')
                                }
                              }}
                              onClick={e => e.stopPropagation()}
                              onMouseDown={e => e.stopPropagation()}
                            />
                          ) : (
                            <span>{display || (cellEditable ? '—' : display)}</span>
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

        {/* Schwebende Panels rechts unten */}
        {selectedCells.size > 0 && (
          <div data-betrag-selektion="true" className="fixed bottom-6 right-6 z-50 flex flex-col gap-2 items-stretch">
            {/* Notiz-Panel — nur bei genau 1 editierbarer Zelle */}
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

            {/* Bulk-Edit-Panel */}
            {bulkEditType && (
              <div className="flex items-center gap-2 rounded-lg border bg-background px-4 py-2 shadow-lg text-sm">
                <Pencil className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                <span className="text-muted-foreground">
                  {selectedCells.size} {bulkEditType === 'absatz' ? 'Absatz' : 'VK'}-Felder ausgewählt
                </span>
                <Button size="sm" onClick={() => setBulkEditOpen(true)}>
                  Anpassen
                </Button>
              </div>
            )}

            {/* Betragsselektion-Panel */}
            <div className="flex items-center gap-3 rounded-lg border bg-background px-4 py-2.5 shadow-lg text-sm">
              <span className="text-muted-foreground">
                {selectedCells.size} Feld{selectedCells.size !== 1 ? 'er' : ''}
              </span>
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

        {/* Bulk-Edit-Dialog */}
        <LangfristigeAbsatzplanungBulkEditDialog
          open={bulkEditOpen}
          onClose={() => setBulkEditOpen(false)}
          cells={bulkEditCells}
          cellType={bulkEditType ?? 'absatz'}
          onApply={handleBulkApply}
        />

        {/* Notiz-Formular */}
        <PlanungNotizFormular
          open={notizFormularOpen}
          onOpenChange={setNotizFormularOpen}
          cellLabel={notizCellLabelRef.current}
          currentNotiz={notizCellKeyRef.current ? (notizen.get(notizCellKeyRef.current) ?? null) : null}
          onSave={text => upsertNotiz(notizCellKeyRef.current, text)}
          onDelete={() => deleteNotiz(notizCellKeyRef.current)}
        />
      </div>
    </TooltipProvider>
  )
}
