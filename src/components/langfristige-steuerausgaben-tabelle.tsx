'use client'

import { useState, useEffect, useRef, useCallback, useMemo } from 'react'
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
  useLangfristigeSteuerausgaben,
  betragCellKey,
  type PlanungsMonat,
  type SteuerGruppe,
} from '@/hooks/use-langfristige-steuerausgaben'
import { useLangfristigePlanungNotizen } from '@/hooks/use-langfristige-planung-notizen'
import { PlanungNotizFormular } from '@/components/planung-notiz-formular'

// PROJ-93: Steuerausgaben-Planung der Langfristigen Planung.
// Kategorie-Hierarchie (Gruppen unter "Steuern", KEINE Produktebene) gespiegelt
// aus PROJ-90/PROJ-71, berechnet/manuell-Bedienung (grau/blau, Einzel-/Global-Reset)
// aus PROJ-91. KEINE Ist-/Vergangenheitsspalten — jede Monatsspalte ist eine
// Soll-Spalte. Beträge dürfen NEGATIV sein (Umsatzsteuer-Erstattung).

const SEITE = 'steuerausgaben'

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatNum(v: number): string {
  return v.toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

// ─── Row types ────────────────────────────────────────────────────────────────

type RowKind =
  | 'group-header' // L1-Gruppe mit Untergruppen (Summe, nicht editierbar, einklappbar)
  | 'group-leaf' // L1-Gruppe ohne Untergruppen (editierbar)
  | 'subgroup' // L2-Untergruppe (editierbar, eingerückt)
  | 'breakdown' // read-only Drill-down-Zeile (Einfuhr je Produkt / USt-Komponente)
  | 'total' // Steuerausgaben (Gesamt) — ganz unten

type BreakdownKind = 'einfuhr-produkt' | 'ust-komponente'

interface FlatRow {
  id: string
  kind: RowKind
  label: string
  indent: number
  kategorieId?: string // editierbare Kategorie (group-leaf, subgroup)
  groupId?: string // für group-header: zugehörige Gruppe
  expandable?: boolean
  expanded?: boolean
  expandKey?: string // Toggle-Schlüssel (groupId bzw. `bd:${kategorieId}`)
  // Drill-down (read-only)
  breakdownKind?: BreakdownKind
  produktId?: string
  komponente?: 'output' | 'vorsteuer' | 'einfuhr'
}

// ─── Main component ───────────────────────────────────────────────────────────

export function LangfristigeSteuerausgabenTabelle({ versionId }: { versionId: string }) {
  const {
    monate,
    gruppen,
    leafKategorieIds,
    values,
    loading,
    error,
    getManuellerWert,
    getBerechneterWert,
    getEffektiverWert,
    upsertZelle,
    resetAll,
    einfuhrKatId,
    umsatzsteuerKatId,
    einfuhrProduktIds,
    produktNamen,
    hasUstKomponenten,
    getEinfuhrProduktBer,
    getUstKomponente,
  } = useLangfristigeSteuerausgaben(versionId)

  const { toast } = useToast()
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set())

  // Betragsselektion / Mehrfachselektion
  const [selectedCells, setSelectedCells] = useState<Map<string, number>>(new Map())
  const isDragging = useRef(false)
  const selectionSum = Array.from(selectedCells.values()).reduce((a, b) => a + b, 0)

  // Notizen (versionsgebunden)
  const { notizen, upsertNotiz, deleteNotiz } = useLangfristigePlanungNotizen(versionId, SEITE)
  const [notizFormularOpen, setNotizFormularOpen] = useState(false)
  const notizCellKeyRef = useRef<string>('')
  const notizCellLabelRef = useRef<string>('')

  // Inline-Editing
  const [editingCell, setEditingCellState] = useState<string | null>(null)
  const editingCellRef = useRef<string | null>(null)
  const [editingValue, setEditingValue] = useState('')
  const editingOriginalValue = useRef<string>('')

  // Reset
  const [resetDialogOpen, setResetDialogOpen] = useState(false)
  const [resetting, setResetting] = useState(false)
  const [resettingToAuto, setResettingToAuto] = useState(false)

  function setEditingCell(key: string | null) {
    editingCellRef.current = key
    setEditingCellState(key)
  }

  // Nur Gruppen mit Untergruppen sind einklappbar
  const expandableGroupIds = useMemo(
    () => gruppen.filter(g => !g.istLeaf).map(g => g.id),
    [gruppen],
  )

  // Beim ersten Laden alle Gruppen ausklappen
  useEffect(() => {
    if (!loading && expandableGroupIds.length > 0) {
      setExpandedGroups(new Set(expandableGroupIds))
    }
  }, [loading, expandableGroupIds])

  // Klick außerhalb hebt die Selektion auf
  useEffect(() => {
    function onMouseDown(e: MouseEvent) {
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
  }, [])

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

  // ─── Aggregation (effektive Werte: manuell ?? berechnet) ─────────────────────

  const gruppenById = useMemo(() => {
    const m = new Map<string, SteuerGruppe>()
    for (const g of gruppen) m.set(g.id, g)
    return m
  }, [gruppen])

  const aggregateGroup = useCallback(
    (groupId: string, monat: PlanungsMonat): { sum: number; hasAny: boolean } => {
      const g = gruppenById.get(groupId)
      if (!g) return { sum: 0, hasAny: false }
      let sum = 0
      let hasAny = false
      for (const u of g.untergruppen) {
        const v = getEffektiverWert(u.id, monat)
        if (v !== null) {
          sum += v
          hasAny = true
        }
      }
      return { sum, hasAny }
    },
    [gruppenById, getEffektiverWert],
  )

  const aggregateTotal = useCallback(
    (monat: PlanungsMonat): { sum: number; hasAny: boolean } => {
      let sum = 0
      let hasAny = false
      for (const id of leafKategorieIds) {
        const v = getEffektiverWert(id, monat)
        if (v !== null) {
          sum += v
          hasAny = true
        }
      }
      return { sum, hasAny }
    },
    [leafKategorieIds, getEffektiverWert],
  )

  // ─── Flache Zeilenliste ──────────────────────────────────────────────────────

  const flatRows = useMemo((): FlatRow[] => {
    const rows: FlatRow[] = []

    // Editierbares Leaf (group-leaf oder subgroup) + ggf. read-only Drill-down-Zeilen
    // (Einfuhrumsatzsteuer je Produkt / Umsatzsteuer-Komponenten).
    const pushLeaf = (id: string, kind: RowKind, label: string, indent: number, kategorieId: string) => {
      const isEinfuhr = !!einfuhrKatId && kategorieId === einfuhrKatId && einfuhrProduktIds.length > 0
      const isUst = !!umsatzsteuerKatId && kategorieId === umsatzsteuerKatId && hasUstKomponenten
      const expandable = isEinfuhr || isUst
      const expandKey = `bd:${kategorieId}`
      const expanded = expandable && expandedGroups.has(expandKey)
      rows.push({ id, kind, label, indent, kategorieId, expandable, expanded, expandKey: expandable ? expandKey : undefined })
      if (!expanded) return
      if (isEinfuhr) {
        for (const pid of einfuhrProduktIds) {
          rows.push({
            id: `bd-einfuhr-${kategorieId}-${pid}`,
            kind: 'breakdown',
            breakdownKind: 'einfuhr-produkt',
            produktId: pid,
            label: produktNamen.get(pid) ?? pid,
            indent: indent + 1,
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
            id: `bd-ust-${kategorieId}-${c.k}`,
            kind: 'breakdown',
            breakdownKind: 'ust-komponente',
            komponente: c.k,
            label: c.label,
            indent: indent + 1,
          })
        }
      }
    }

    for (const g of gruppen) {
      if (g.istLeaf) {
        // Gruppe ohne Untergruppen → selbst editierbar
        pushLeaf(`group-leaf-${g.id}`, 'group-leaf', g.name, 0, g.id)
      } else {
        const expanded = expandedGroups.has(g.id)
        rows.push({
          id: `group-header-${g.id}`,
          kind: 'group-header',
          label: g.name,
          indent: 0,
          groupId: g.id,
          expandable: true,
          expanded,
          expandKey: g.id,
        })
        if (expanded) {
          for (const u of g.untergruppen) {
            pushLeaf(`subgroup-${g.id}-${u.id}`, 'subgroup', u.name, 1, u.id)
          }
        }
      }
    }

    rows.push({ id: 'total', kind: 'total', label: 'Steuerausgaben (Gesamt)', indent: 0 })

    return rows
  }, [gruppen, expandedGroups, einfuhrKatId, umsatzsteuerKatId, einfuhrProduktIds, hasUstKomponenten, produktNamen])

  // ─── Zellwert je Zeile × Monat ───────────────────────────────────────────────

  function getRowValue(
    row: FlatRow,
    monat: PlanungsMonat,
  ): { display: string; rawNum: number | null; indicator: 'gray' | 'blue' | null; isEditable: boolean } {
    switch (row.kind) {
      case 'group-leaf':
      case 'subgroup': {
        const manual = getManuellerWert(row.kategorieId!, monat)
        if (manual !== null) {
          return { display: formatNum(manual), rawNum: manual, indicator: 'blue', isEditable: true }
        }
        const ber = getBerechneterWert(row.kategorieId!, monat)
        return {
          display: ber !== null ? formatNum(ber) : '',
          rawNum: ber,
          indicator: ber !== null ? 'gray' : null,
          isEditable: true,
        }
      }
      case 'breakdown': {
        let v: number | null = null
        if (row.breakdownKind === 'einfuhr-produkt' && row.produktId) {
          v = getEinfuhrProduktBer(row.produktId, monat)
        } else if (row.breakdownKind === 'ust-komponente' && row.komponente) {
          v = getUstKomponente(row.komponente, monat)
        }
        return { display: v !== null ? formatNum(v) : '', rawNum: v, indicator: null, isEditable: false }
      }
      case 'group-header': {
        const { sum, hasAny } = aggregateGroup(row.groupId!, monat)
        return { display: hasAny ? formatNum(sum) : '—', rawNum: hasAny ? sum : null, indicator: null, isEditable: false }
      }
      case 'total': {
        const { sum, hasAny } = aggregateTotal(monat)
        return { display: hasAny ? formatNum(sum) : '—', rawNum: hasAny ? sum : null, indicator: null, isEditable: false }
      }
      default:
        return { display: '', rawNum: null, indicator: null, isEditable: false }
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

    // Negative Werte sind erlaubt (Umsatzsteuer-Erstattung); nur NaN verwerfen.
    if (parsedNew !== null && isNaN(parsedNew)) return

    const unchanged =
      (parsedNew === null && parsedOrig === null) ||
      (parsedNew !== null && parsedOrig !== null && Math.abs(parsedNew - parsedOrig) < 0.005)
    if (unchanged) return

    try {
      await upsertZelle(row.kategorieId!, monat, parsedNew)
    } catch {
      toast({ title: 'Fehler beim Speichern', description: 'Wert konnte nicht gespeichert werden.', variant: 'destructive' })
    }
  }

  // ─── Reset einzelner manueller Zellen auf den berechneten Wert ───────────────

  // Editierbare Selektion = Schlüssel ohne "row:"-Präfix (kategorieId:jahr:monat).
  function isEditableKey(key: string): boolean {
    return !key.startsWith('row:') && key.split(':').length === 3
  }

  const hasManuellAutoZelleSelected = useMemo(() => {
    for (const key of selectedCells.keys()) {
      if (!isEditableKey(key)) continue
      if (values.has(key)) return true
    }
    return false
  }, [selectedCells, values])

  async function handleResetToAuto() {
    setResettingToAuto(true)
    try {
      const toReset = Array.from(selectedCells.keys()).filter(key => isEditableKey(key) && values.has(key))
      await Promise.all(
        toReset.map(key => {
          const parts = key.split(':')
          return upsertZelle(
            parts[0],
            { year: Number(parts[1]), month: Number(parts[2]), label: '' },
            null,
          )
        }),
      )
      setSelectedCells(new Map())
      toast({ title: 'Zurückgesetzt', description: 'Werte werden wieder automatisch berechnet.' })
    } catch {
      toast({ title: 'Fehler', description: 'Zurücksetzen fehlgeschlagen.', variant: 'destructive' })
    } finally {
      setResettingToAuto(false)
    }
  }

  // ─── Global reset ─────────────────────────────────────────────────────────────

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

  // ─── Toggle / Expand-all / Notiz-Helfer ──────────────────────────────────────

  function toggleGroup(groupId: string) {
    setExpandedGroups(prev => {
      const next = new Set(prev)
      if (next.has(groupId)) next.delete(groupId)
      else next.add(groupId)
      return next
    })
  }

  const allExpanded =
    expandableGroupIds.length > 0 && expandableGroupIds.every(id => expandedGroups.has(id))

  function toggleAll() {
    setExpandedGroups(allExpanded ? new Set() : new Set(expandableGroupIds))
  }

  function getNotizCellLabel(editKey: string): string {
    const parts = editKey.split(':')
    if (parts.length !== 3) return editKey
    const kategorieId = parts[0]
    const year = parseInt(parts[1])
    const month = parseInt(parts[2])
    const monat = monate.find(m => m.year === year && m.month === month)
    // Kategoriename + ggf. übergeordnete Gruppe finden
    let katName = kategorieId
    let gruppeName = ''
    for (const g of gruppen) {
      if (g.istLeaf && g.id === kategorieId) {
        katName = g.name
        break
      }
      const u = g.untergruppen.find(x => x.id === kategorieId)
      if (u) {
        katName = u.name
        gruppeName = g.name
        break
      }
    }
    return [katName, gruppeName, monat?.label].filter(Boolean).join(' · ')
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

  if (gruppen.length === 0) {
    return (
      <div className="rounded-md border p-8 text-center text-muted-foreground text-sm space-y-2">
        <p>Keine Steuerkategorien im KPI-Modell vorhanden.</p>
        <p>
          Bitte den Knoten „Steuern" im{' '}
          <a href="/dashboard/kpi-modell" className="underline text-foreground">
            KPI-Modell
          </a>{' '}
          konfigurieren.
        </p>
      </div>
    )
  }

  // ─── Render ───────────────────────────────────────────────────────────────────

  return (
    <TooltipProvider delayDuration={400}>
      <div data-betrag-selektion="true" className="space-y-4" onMouseUp={() => { isDragging.current = false }}>
        {/* Toolbar */}
        <div className="flex items-center justify-between gap-2">
          {monate.length > 0 && (
            <div className="text-sm text-muted-foreground">
              {monate[0].label} – {monate[monate.length - 1].label}
            </div>
          )}
          <div className="flex items-center gap-2">
            {expandableGroupIds.length > 0 && (
              <Button
                variant="ghost"
                size="sm"
                className="gap-1.5 text-xs text-muted-foreground"
                onClick={toggleAll}
              >
                {allExpanded
                  ? <><ChevronsDownUp className="h-3.5 w-3.5" />Alle einklappen</>
                  : <><ChevronsUpDown className="h-3.5 w-3.5" />Alle ausklappen</>
                }
              </Button>
            )}
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
        </div>

        {/* Tabelle */}
        <div className="overflow-x-auto rounded-md border">
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
                  Kategorie
                </th>
                {monate.map(m => (
                  <th
                    key={`${m.year}-${m.month}`}
                    className="px-2 py-2.5 text-right font-medium text-xs border-l text-muted-foreground"
                  >
                    {m.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {flatRows.map(row => {
                const isHeader = row.kind === 'group-header'
                const isTotal = row.kind === 'total'
                // L1-Gruppen ohne Untergruppen (group-leaf) werden wie die übrigen
                // L1-Kategorien (group-header) dargestellt — gleicher Hintergrund.
                const isGroup = isHeader || row.kind === 'group-leaf'

                const bg = isTotal
                  ? 'bg-muted/60'
                  : isGroup
                    ? 'bg-muted/30'
                    : 'bg-white dark:bg-background'

                const labelBg = isTotal || isGroup ? 'bg-muted' : 'bg-background'

                return (
                  <tr
                    key={row.id}
                    className={[
                      'border-b last:border-0 hover:bg-muted/20 transition-colors',
                      bg,
                      isTotal ? 'border-t-2' : '',
                    ].join(' ')}
                  >
                    {/* Label-Zelle */}
                    <td
                      className={['sticky left-0 z-10 px-3 py-1.5 overflow-hidden whitespace-nowrap text-ellipsis', labelBg].join(' ')}
                      style={{ paddingLeft: `${12 + row.indent * 16}px` }}
                      title={row.label}
                    >
                      {row.expandable ? (
                        <button
                          type="button"
                          className={[
                            'flex items-center gap-1 hover:text-primary',
                            (isHeader || row.kind === 'group-leaf') ? 'text-sm font-semibold' : 'text-sm text-foreground',
                          ].join(' ')}
                          onClick={() => toggleGroup(row.expandKey ?? row.groupId ?? row.id)}
                        >
                          {row.expanded ? <ChevronDown className="h-3.5 w-3.5 shrink-0" /> : <ChevronRight className="h-3.5 w-3.5 shrink-0" />}
                          {row.label}
                        </button>
                      ) : row.kind === 'breakdown' ? (
                        <span className="flex items-center gap-1 text-xs italic text-muted-foreground">
                          <span className="text-muted-foreground/60">·</span>
                          {row.label}
                        </span>
                      ) : (
                        <span
                          className={
                            isTotal
                              ? 'text-sm font-semibold'
                              : row.kind === 'group-leaf'
                                ? 'text-sm font-semibold'
                                : 'text-sm text-foreground'
                          }
                        >
                          {row.label}
                        </span>
                      )}
                    </td>

                    {/* Wert-Zellen (Soll-Monate) */}
                    {monate.map(m => {
                      const { display, rawNum, indicator, isEditable: cellEditable } = getRowValue(row, m)

                      const editKey =
                        cellEditable && row.kategorieId
                          ? betragCellKey(row.kategorieId, m.year, m.month)
                          : null

                      const isCurrentlyEditing = editKey !== null && editingCell === editKey
                      const cellKey = editKey ?? `row:${row.id}:${m.year}:${m.month}`
                      const isSelected = selectedCells.has(cellKey)

                      return (
                        <td
                          key={`${m.year}-${m.month}`}
                          className={[
                            'relative px-2 py-1.5 text-right text-xs tabular-nums select-none border-l',
                            isSelected ? 'bg-blue-100 dark:bg-blue-900/30' : '',
                            cellEditable ? 'cursor-pointer text-foreground' : 'text-muted-foreground',
                          ].join(' ')}
                          onClick={
                            cellEditable && editKey !== null && !isCurrentlyEditing
                              ? e => handleEditableCellClick(e, editKey, display)
                              : undefined
                          }
                          onMouseDown={
                            cellEditable && editKey !== null
                              ? e => handleEditableCellMouseDown(e, editKey, rawNum)
                              : !cellEditable && rawNum !== null
                                ? e => handleNonEditableMouseDown(e, `row:${row.id}:${m.year}:${m.month}`, rawNum)
                                : undefined
                          }
                          onMouseEnter={
                            cellEditable && editKey !== null
                              ? () => handleEditableCellMouseEnter(editKey, rawNum)
                              : !cellEditable && rawNum !== null
                                ? () => handleNonEditableMouseEnter(`row:${row.id}:${m.year}:${m.month}`, rawNum)
                                : undefined
                          }
                          data-betrag-selektion="true"
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
                              step="any"
                              className="absolute inset-0 w-full min-w-0 box-border px-2 text-right bg-background outline-none border-b border-primary text-xs tabular-nums [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
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
                            <div className="flex items-center justify-end gap-1">
                              {indicator && (
                                <span
                                  className={[
                                    'inline-block h-1.5 w-1.5 rounded-full shrink-0',
                                    indicator === 'gray' ? 'bg-gray-300 dark:bg-gray-600' : 'bg-blue-500',
                                  ].join(' ')}
                                  title={indicator === 'gray' ? 'Automatisch berechnet' : 'Manuell eingegeben'}
                                />
                              )}
                              <span
                                className={[
                                  isTotal ? 'font-semibold' : '',
                                  display === '—' ? 'text-muted-foreground/40' : '',
                                ].join(' ')}
                              >
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

        {/* Schwebende Panels rechts unten */}
        {selectedCells.size > 0 && (
          <div data-betrag-selektion="true" className="fixed bottom-6 right-6 z-50 flex flex-col gap-2 items-stretch">
            {/* Notiz-Panel — nur bei genau 1 editierbarer Zelle */}
            {selectedCells.size === 1 && (() => {
              const key = Array.from(selectedCells.keys())[0]
              if (!isEditableKey(key)) return null
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

            {/* Auf automatisch zurücksetzen */}
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

        {/* Notiz-Formular */}
        <PlanungNotizFormular
          open={notizFormularOpen}
          onOpenChange={setNotizFormularOpen}
          cellLabel={notizCellLabelRef.current}
          currentNotiz={notizCellKeyRef.current ? (notizen.get(notizCellKeyRef.current) ?? null) : null}
          onSave={text => upsertNotiz(notizCellKeyRef.current, text)}
          onDelete={() => deleteNotiz(notizCellKeyRef.current)}
        />

        {/* Reset-Bestätigungsdialog */}
        <AlertDialog open={resetDialogOpen} onOpenChange={setResetDialogOpen}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Steuerausgaben zurücksetzen?</AlertDialogTitle>
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
