'use client'

import { useState, useRef, useMemo, useCallback } from 'react'
import { ChevronDown, ChevronRight, RefreshCw, RotateCcw, StickyNote, AlertTriangle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { Alert, AlertDescription } from '@/components/ui/alert'
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
  useSalesPlattformPlanung,
  sppKey,
  KATEGORIE_LABELS,
  SALES_KATEGORIEN,
} from '@/hooks/use-sales-plattform-planung'
import type { SalesKategorie } from '@/hooks/use-sales-plattform-planung'
import type { PlanungsWoche } from '@/hooks/use-absatzplanung'
import { usePlanungNotizen } from '@/hooks/use-planung-notizen'
import { PlanungNotizFormular } from '@/components/planung-notiz-formular'
import { HistorischRefreshDialog } from '@/components/historisch-refresh-dialog'

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatEur(v: number | null): string {
  if (v === null) return ''
  return v.toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

function mondayOfISOWeek(year: number, week: number): Date {
  const jan4 = new Date(Date.UTC(year, 0, 4))
  const dow = jan4.getUTCDay() || 7
  const monday1 = new Date(jan4.getTime() - (dow - 1) * 86_400_000)
  return new Date(monday1.getTime() + (week - 1) * 7 * 86_400_000)
}

// ─── Row types ────────────────────────────────────────────────────────────────

type RowKind = 'kategorie-header' | 'plattform-zeile' | 'produkt-zeile' | 'rabatte-row' | 'summe-zeile'

interface FlatRow {
  id: string
  kind: RowKind
  label: string
  indent: number
  kategorie?: SalesKategorie
  plattformId?: string
  produktId?: string
  expandable?: boolean
  expanded?: boolean
}

// ─── Component ────────────────────────────────────────────────────────────────

export function SalesPlattformPlanungTabelle() {
  const {
    alleWochen,
    vergangenheitSet,
    plattformen,
    produkte,
    showRetouren,
    showMarketing,
    loading,
    error,
    isRefreshing,
    getProduktWert,
    getPlatformWert,
    getKategorieWert,
    getSumme,
    upsertWert,
    resetAll,
    refreshHistorisch,
  } = useSalesPlattformPlanung()

  const { toast } = useToast()
  const { notizen, upsertNotiz, deleteNotiz, resetNotizen } = usePlanungNotizen('sales-plattform-planung')

  // ─── Expand state ─────────────────────────────────────────────────────────

  const [expandedKategorien, setExpandedKategorien] = useState<Set<SalesKategorie>>(new Set())
  // key: `${kategorie}:${plattformId}`
  const [expandedPlatforms, setExpandedPlatforms] = useState<Set<string>>(new Set())

  // ─── Selection & editing ─────────────────────────────────────────────────

  const [selectedCells, setSelectedCells] = useState<Map<string, number>>(new Map())
  const [editingCell, setEditingCell] = useState<string | null>(null)
  const [editingValue, setEditingValue] = useState('')
  const editingCellRef = useRef<string | null>(null)
  const editingOriginalValue = useRef<string>('')
  const isDragging = useRef(false)

  // ─── Dialogs ─────────────────────────────────────────────────────────────

  const [resetDialogOpen, setResetDialogOpen] = useState(false)
  const [resetting, setResetting] = useState(false)
  const [refreshDialogOpen, setRefreshDialogOpen] = useState(false)
  const [notizFormularOpen, setNotizFormularOpen] = useState(false)
  const notizCellKeyRef = useRef<string>('')
  const notizCellLabelRef = useRef<string>('')

  // Keep editingCellRef in sync
  const setEditingCellSync = useCallback((key: string | null) => {
    editingCellRef.current = key
    setEditingCell(key)
  }, [])

  // ─── Selection sum ────────────────────────────────────────────────────────

  const selectionSum = useMemo(() => {
    let s = 0
    for (const v of selectedCells.values()) s += v
    return s
  }, [selectedCells])

  // ─── Month groups ─────────────────────────────────────────────────────────

  const monthGroups = useMemo(() => {
    const MONTH_LABELS = [
      'Jan', 'Feb', 'Mär', 'Apr', 'Mai', 'Jun',
      'Jul', 'Aug', 'Sep', 'Okt', 'Nov', 'Dez',
    ]
    const groups: Array<{ label: string; count: number; isPast: boolean }> = []
    for (const kw of alleWochen) {
      const d = mondayOfISOWeek(kw.year, kw.week)
      const month = d.getUTCMonth()
      const year = d.getUTCFullYear()
      const isPast = vergangenheitSet.has(`${kw.year}:${kw.week}`)
      const label = `${MONTH_LABELS[month]} ${year}`
      if (groups.length > 0 && groups[groups.length - 1].label === label) {
        groups[groups.length - 1].count++
      } else {
        groups.push({ label, count: 1, isPast })
      }
    }
    return groups
  }, [alleWochen, vergangenheitSet])

  // ─── Flat rows ────────────────────────────────────────────────────────────

  const flatRows = useMemo((): FlatRow[] => {
    const rows: FlatRow[] = []

    const visibleKategorien: SalesKategorie[] = ['bruttoumsatz', 'rueckerstattungen', 'verkaufsgebuehr']
    if (showRetouren) visibleKategorien.push('retouren')
    if (showMarketing) visibleKategorien.push('marketing')

    for (const kat of visibleKategorien) {
      const isExpanded = expandedKategorien.has(kat)

      if (kat === 'rueckerstattungen') {
        // Rabatte bleibt immer leer — no expand needed, shown as flat row with label "Rabatte" in between
        // Actually per spec: Rabatte is shown separately as a static empty row
      }

      rows.push({
        id: `kat-${kat}`,
        kind: 'kategorie-header',
        label: KATEGORIE_LABELS[kat],
        indent: 0,
        kategorie: kat,
        expandable: kat !== 'rueckerstattungen',
        expanded: isExpanded,
      })

      // Add "Rabatte" row after Bruttoumsatz (always empty, not expandable)
      if (kat === 'bruttoumsatz') {
        rows.push({
          id: 'rabatte',
          kind: 'rabatte-row',
          label: 'Rabatte',
          indent: 0,
        })
      }

      if (kat === 'rueckerstattungen') continue

      if (!isExpanded) continue

      for (const plt of plattformen) {
        const platKey = `${kat}:${plt.id}`
        const isPlatExpanded = expandedPlatforms.has(platKey)
        rows.push({
          id: `plt-${kat}-${plt.id}`,
          kind: 'plattform-zeile',
          label: plt.name,
          indent: 1,
          kategorie: kat,
          plattformId: plt.id,
          expandable: true,
          expanded: isPlatExpanded,
        })

        if (!isPlatExpanded) continue

        for (const prd of produkte) {
          rows.push({
            id: `prd-${kat}-${plt.id}-${prd.id}`,
            kind: 'produkt-zeile',
            label: prd.name,
            indent: 2,
            kategorie: kat,
            plattformId: plt.id,
            produktId: prd.id,
          })
        }
      }
    }

    // Summe row always at bottom
    rows.push({
      id: 'summe',
      kind: 'summe-zeile',
      label: 'Summe',
      indent: 0,
    })

    return rows
  }, [expandedKategorien, expandedPlatforms, plattformen, produkte, showRetouren, showMarketing])

  // ─── Cell value computation ───────────────────────────────────────────────

  function getRowValue(
    row: FlatRow,
    kw: PlanungsWoche,
  ): { display: string; rawNum: number | null; isManual: boolean; isEditable: boolean } {
    const past = vergangenheitSet.has(`${kw.year}:${kw.week}`)

    if (row.kind === 'summe-zeile') {
      const val = getSumme(kw)
      return { display: formatEur(val), rawNum: val, isManual: false, isEditable: false }
    }

    if (row.kind === 'rabatte-row') {
      return { display: '', rawNum: null, isManual: false, isEditable: false }
    }

    if (row.kind === 'kategorie-header') {
      const kat = row.kategorie!
      if (kat === 'rueckerstattungen') {
        const { value, isManual } = getKategorieWert(kat, kw)
        return { display: formatEur(value), rawNum: value, isManual, isEditable: false }
      }
      const { value, isManual } = getKategorieWert(kat, kw)
      return { display: formatEur(value), rawNum: value, isManual, isEditable: false }
    }

    if (row.kind === 'plattform-zeile') {
      const kat = row.kategorie!
      const { value, isManual } = getPlatformWert(kat, row.plattformId!, kw)
      return { display: formatEur(value), rawNum: value, isManual, isEditable: false }
    }

    if (row.kind === 'produkt-zeile') {
      const kat = row.kategorie!
      const editable = kat !== 'rueckerstattungen'
      if (!editable) {
        const { value, isManual } = getProduktWert(kat, row.produktId!, row.plattformId!, kw)
        return { display: formatEur(value), rawNum: value, isManual, isEditable: false }
      }
      const { value, isManual } = getProduktWert(kat, row.produktId!, row.plattformId!, kw)
      return { display: formatEur(value), rawNum: value, isManual, isEditable: true }
    }

    return { display: '', rawNum: null, isManual: false, isEditable: false }
  }

  // ─── Toggle helpers ───────────────────────────────────────────────────────

  function toggleKategorie(kat: SalesKategorie) {
    setExpandedKategorien(prev => {
      const next = new Set(prev)
      if (next.has(kat)) next.delete(kat)
      else next.add(kat)
      return next
    })
  }

  function togglePlatform(platKey: string) {
    setExpandedPlatforms(prev => {
      const next = new Set(prev)
      if (next.has(platKey)) next.delete(platKey)
      else next.add(platKey)
      return next
    })
  }

  // ─── Selection handlers ───────────────────────────────────────────────────

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

  function handleEditableCellMouseDown(e: React.MouseEvent, editKey: string, rawNum: number | null) {
    if (!(e.ctrlKey || e.metaKey)) return
    e.preventDefault()
    e.stopPropagation()
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
    setEditingCellSync(editKey)
    setEditingValue(origVal)
  }

  function handleEditableCellMouseEnter(editKey: string, rawNum: number | null) {
    if (!isDragging.current || rawNum === null) return
    setSelectedCells(prev => prev.has(editKey) ? prev : new Map([...prev, [editKey, rawNum]]))
  }

  // ─── Inline edit blur ─────────────────────────────────────────────────────

  async function handleCellBlur(row: FlatRow, kw: PlanungsWoche, editKey: string) {
    if (editingCellRef.current !== editKey) return

    const rawStr = editingValue.trim().replace(',', '.')
    let parsedNew: number | null = rawStr === '' ? null : parseFloat(rawStr)
    const parsedOrig =
      editingOriginalValue.current === ''
        ? null
        : parseFloat(editingOriginalValue.current.replace(',', '.'))

    setEditingCellSync(null)
    setEditingValue('')

    if (parsedNew !== null && isNaN(parsedNew)) return

    const unchanged =
      (parsedNew === null && parsedOrig === null) ||
      (parsedNew !== null && parsedOrig !== null && Math.abs(parsedNew - parsedOrig) < 0.005)
    if (unchanged) return

    try {
      await upsertWert(row.kategorie!, row.produktId!, row.plattformId!, kw, parsedNew)
    } catch {
      toast({
        title: 'Fehler beim Speichern',
        description: 'Wert konnte nicht gespeichert werden.',
        variant: 'destructive',
      })
    }
  }

  // ─── Notiz label ──────────────────────────────────────────────────────────

  function getNotizCellLabel(editKey: string): string {
    // editKey: spp:${kat}:${produktId}:${plattformId}:${year}:${week}
    const parts = editKey.split(':')
    if (parts[0] === 'spp' && parts.length === 6) {
      const kat = parts[1] as SalesKategorie
      const produktId = parts[2]
      const year = parseInt(parts[4])
      const week = parseInt(parts[5])
      const prd = produkte.find(p => p.id === produktId)
      const katLabel = KATEGORIE_LABELS[kat] ?? kat
      return `${prd?.name ?? produktId} (${katLabel}) · KW${String(week).padStart(2, '0')} / ${year}`
    }
    return editKey
  }

  // ─── Reset ────────────────────────────────────────────────────────────────

  async function handleReset() {
    setResetting(true)
    try {
      await Promise.all([resetAll(), resetNotizen()])
      setSelectedCells(new Map())
      toast({
        title: 'Sales Plattform Planung zurückgesetzt',
        description: 'Alle manuellen Werte und Notizen wurden entfernt.',
      })
    } catch {
      toast({ title: 'Fehler', description: 'Zurücksetzen fehlgeschlagen.', variant: 'destructive' })
    } finally {
      setResetting(false)
      setResetDialogOpen(false)
    }
  }

  // ─── Refresh ─────────────────────────────────────────────────────────────

  async function handleRefreshConfirm(selectedProduktIds: string[]) {
    setRefreshDialogOpen(false)
    try {
      await refreshHistorisch(selectedProduktIds)
      toast({
        title: 'Historische Werte aktualisiert',
        description: 'Sales-Daten wurden auf den aktuellen Stand gebracht.',
      })
    } catch {
      toast({ title: 'Fehler', description: 'Aktualisierung fehlgeschlagen.', variant: 'destructive' })
    }
  }

  // ─── Mouse up cleanup ─────────────────────────────────────────────────────

  function handleMouseUp() {
    isDragging.current = false
  }

  // ─── Loading / Error ──────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="space-y-4">
        <Alert>
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>
            Die angezeigten Werte sind Rentabilitätswerte. Sie zeigen wann Umsätze und Kosten
            wirtschaftlich entstehen — nicht wann die Zahlungen liquiditätstechnisch tatsächlich
            anfallen.
          </AlertDescription>
        </Alert>
        <div className="space-y-2">
          {Array.from({ length: 8 }).map((_, i) => (
            <Skeleton key={i} className="h-8 w-full" />
          ))}
        </div>
      </div>
    )
  }

  if (error) return <p className="text-sm text-destructive">{error}</p>

  if (plattformen.length === 0) {
    return (
      <div className="space-y-4">
        <Alert>
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>
            Die angezeigten Werte sind Rentabilitätswerte. Sie zeigen wann Umsätze und Kosten
            wirtschaftlich entstehen — nicht wann die Zahlungen liquiditätstechnisch tatsächlich
            anfallen.
          </AlertDescription>
        </Alert>
        <div className="rounded-md border p-8 text-center text-muted-foreground text-sm">
          <p>Keine Plattformen konfiguriert.</p>
        </div>
      </div>
    )
  }

  // ─── Render ───────────────────────────────────────────────────────────────

  return (
    <TooltipProvider delayDuration={400}>
      <div
        data-betrag-selektion="true"
        className="space-y-4"
        onMouseUp={handleMouseUp}
      >
        {/* Warning banner */}
        <Alert>
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>
            Die angezeigten Werte sind <strong>Rentabilitätswerte</strong>. Sie zeigen wann
            Umsätze und Kosten wirtschaftlich entstehen — nicht wann die Zahlungen
            liquiditätstechnisch tatsächlich anfallen.
          </AlertDescription>
        </Alert>

        {/* Toolbar */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            {alleWochen.length > 0 && (
              <span>
                {alleWochen[0].label} – {alleWochen[alleWochen.length - 1].label}
              </span>
            )}
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setRefreshDialogOpen(true)}
              disabled={isRefreshing || resetting}
            >
              <RefreshCw className={`h-3.5 w-3.5 mr-1.5 ${isRefreshing ? 'animate-spin' : ''}`} />
              {isRefreshing ? 'Wird aktualisiert…' : 'Historische Werte aktualisieren'}
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setResetDialogOpen(true)}
              disabled={resetting || isRefreshing}
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
              {/* Month grouping row */}
              <tr className="border-b bg-muted/20">
                <th className="sticky left-0 z-20 bg-muted/20 min-w-[240px] max-w-[300px] px-3 py-1" />
                {monthGroups.map((g, i) => (
                  <th
                    key={g.label + i}
                    colSpan={g.count}
                    className={[
                      'px-2 py-1 text-center text-xs font-medium text-muted-foreground border-l',
                      g.isPast ? 'bg-muted/30' : '',
                    ].join(' ')}
                  >
                    {g.label}
                  </th>
                ))}
              </tr>
              {/* KW header row */}
              <tr className="border-b bg-muted/40">
                <th className="sticky left-0 z-20 bg-muted/40 min-w-[240px] max-w-[300px] px-3 py-2.5 text-left font-medium text-muted-foreground">
                  Kategorie
                </th>
                {alleWochen.map(kw => {
                  const past = vergangenheitSet.has(`${kw.year}:${kw.week}`)
                  return (
                    <th
                      key={`${kw.year}-${kw.week}`}
                      className={[
                        'min-w-[100px] px-2 py-2.5 text-right font-medium text-xs border-l',
                        past
                          ? 'bg-muted/40 text-muted-foreground'
                          : 'text-muted-foreground',
                      ].join(' ')}
                    >
                      {kw.label}
                      {past && (
                        <span className="block text-[10px] font-normal text-muted-foreground/70">
                          Ist
                        </span>
                      )}
                    </th>
                  )
                })}
              </tr>
            </thead>
            <tbody>
              {flatRows.map(row => {
                const isKatHeader = row.kind === 'kategorie-header'
                const isSumme = row.kind === 'summe-zeile'
                const isRabatte = row.kind === 'rabatte-row'
                const isPlatform = row.kind === 'plattform-zeile'

                const rowBg = isSumme
                  ? 'bg-muted/60'
                  : isKatHeader
                  ? 'bg-muted/30'
                  : isPlatform
                  ? 'bg-muted/20'
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
                        'sticky left-0 z-10 px-3 py-1.5 whitespace-nowrap',
                        isSumme
                          ? 'bg-muted/60'
                          : isKatHeader
                          ? 'bg-muted/30'
                          : isPlatform
                          ? 'bg-muted/20'
                          : 'bg-white dark:bg-background',
                      ].join(' ')}
                      style={{ paddingLeft: `${12 + row.indent * 16}px` }}
                    >
                      {(isKatHeader && row.expandable) || isPlatform ? (
                        <button
                          type="button"
                          className="flex items-center gap-1 text-sm font-semibold hover:text-primary"
                          onClick={() => {
                            if (isKatHeader) toggleKategorie(row.kategorie!)
                            else if (isPlatform) togglePlatform(`${row.kategorie}:${row.plattformId}`)
                          }}
                        >
                          {row.expanded ? (
                            <ChevronDown className="h-3.5 w-3.5 shrink-0" />
                          ) : (
                            <ChevronRight className="h-3.5 w-3.5 shrink-0" />
                          )}
                          {row.label}
                        </button>
                      ) : (
                        <span
                          className={
                            isSumme
                              ? 'text-sm font-semibold'
                              : isKatHeader
                              ? 'text-sm font-semibold'
                              : isPlatform
                              ? 'text-sm font-medium text-muted-foreground'
                              : isRabatte
                              ? 'text-sm font-semibold'
                              : 'text-sm text-muted-foreground'
                          }
                        >
                          {row.label}
                        </span>
                      )}
                    </td>

                    {/* Value cells */}
                    {alleWochen.map(kw => {
                      const { display, rawNum, isManual, isEditable } = getRowValue(row, kw)
                      const past = vergangenheitSet.has(`${kw.year}:${kw.week}`)

                      let editKey: string | null = null
                      if (isEditable && row.produktId && row.kategorie) {
                        editKey = sppKey(row.kategorie, row.produktId, row.plattformId!, kw.year, kw.week)
                      }

                      const isCurrentlyEditing = editKey !== null && editingCell === editKey
                      const isSelected = editKey !== null && selectedCells.has(editKey)
                      const isReadOnlySelected =
                        !isEditable &&
                        rawNum !== null &&
                        selectedCells.has(`ro:${row.id}:${kw.year}:${kw.week}`)

                      return (
                        <td
                          key={`${kw.year}-${kw.week}`}
                          className={[
                            'relative px-2 py-1.5 text-right text-xs tabular-nums select-none border-l',
                            past ? 'bg-muted/10' : '',
                            isSelected || isReadOnlySelected ? 'bg-blue-100 dark:bg-blue-900/30' : '',
                            isEditable ? 'cursor-pointer text-foreground' : 'text-muted-foreground',
                          ].join(' ')}
                          onClick={
                            isEditable && editKey !== null && !isCurrentlyEditing
                              ? e => handleEditableCellClick(e, editKey!, display)
                              : undefined
                          }
                          onMouseDown={
                            isEditable && editKey !== null
                              ? e => handleEditableCellMouseDown(e, editKey!, rawNum)
                              : rawNum !== null
                              ? e => handleNonEditableMouseDown(e, `ro:${row.id}:${kw.year}:${kw.week}`, rawNum)
                              : undefined
                          }
                          onMouseEnter={
                            isEditable && editKey !== null
                              ? () => handleEditableCellMouseEnter(editKey!, rawNum)
                              : rawNum !== null
                              ? () => handleNonEditableMouseEnter(`ro:${row.id}:${kw.year}:${kw.week}`, rawNum)
                              : undefined
                          }
                        >
                          {/* Notiz indicator */}
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
                              step="0.01"
                              className="w-full text-right bg-transparent outline-none border-b border-primary text-xs tabular-nums"
                              value={editingValue}
                              onChange={e => setEditingValue(e.target.value)}
                              onBlur={() => handleCellBlur(row, kw, editKey!)}
                              onKeyDown={e => {
                                if (e.key === 'Enter') (e.target as HTMLInputElement).blur()
                                if (e.key === 'Escape') { setEditingCellSync(null); setEditingValue('') }
                              }}
                              onClick={e => e.stopPropagation()}
                              onMouseDown={e => e.stopPropagation()}
                            />
                          ) : (
                            <div className="flex items-center justify-end gap-1">
                              {isEditable && (
                                <span
                                  className={[
                                    'inline-block w-1.5 h-1.5 rounded-full shrink-0',
                                    isManual
                                      ? 'bg-blue-500'
                                      : 'bg-gray-300 dark:bg-gray-600',
                                  ].join(' ')}
                                  title={isManual ? 'Manuell eingegeben' : 'Automatisch berechnet'}
                                />
                              )}
                              <span>{display}</span>
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
            {/* Notiz panel — nur bei genau 1 editierbarer Zelle */}
            {selectedCells.size === 1 &&
              (() => {
                const key = Array.from(selectedCells.keys())[0]
                if (!key.startsWith('spp:')) return null
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

            {/* Betragsselektion */}
            <div className="flex items-center gap-3 rounded-lg border bg-background px-4 py-2.5 shadow-lg text-sm">
              <span className="text-muted-foreground">
                {selectedCells.size} Feld{selectedCells.size !== 1 ? 'er' : ''}
              </span>
              <div className="h-4 w-px bg-border" />
              <span className="font-semibold tabular-nums">
                Summe:{' '}
                {selectionSum.toLocaleString('de-DE', {
                  minimumFractionDigits: 2,
                  maximumFractionDigits: 2,
                })}
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
          currentNotiz={
            notizCellKeyRef.current ? (notizen.get(notizCellKeyRef.current) ?? null) : null
          }
          onSave={text => upsertNotiz(notizCellKeyRef.current, text)}
          onDelete={() => deleteNotiz(notizCellKeyRef.current)}
        />

        {/* Historisch refresh dialog */}
        <HistorischRefreshDialog
          open={refreshDialogOpen}
          onOpenChange={setRefreshDialogOpen}
          produkte={produkte.map(p => ({ id: p.id, name: p.name }))}
          onConfirm={handleRefreshConfirm}
          isLoading={isRefreshing}
        />

        {/* Reset confirm dialog */}
        <AlertDialog open={resetDialogOpen} onOpenChange={setResetDialogOpen}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Sales Plattform Planung zurücksetzen?</AlertDialogTitle>
              <AlertDialogDescription>
                Alle manuell eingegebenen Werte und Notizen werden entfernt. Die Felder werden
                wieder automatisch aus den Transaktionen und Berechnungen befüllt. Diese Aktion
                kann nicht rückgängig gemacht werden.
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
