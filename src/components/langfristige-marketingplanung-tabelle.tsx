'use client'

import { useState, useEffect, useRef, useCallback, useMemo } from 'react'
import { ChevronDown, ChevronRight, Pencil, StickyNote } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import { useToast } from '@/hooks/use-toast'
import {
  useLangfristigeMarketingplanung,
  computeBruttoUmsatz,
  pctCellKey,
} from '@/hooks/use-langfristige-marketingplanung'
import type { PlanungsMonat } from '@/hooks/use-langfristige-absatzplanung'
import type { KpiCategory } from '@/hooks/use-kpi-categories'
import {
  LangfristigeMarketingplanungBulkEditDialog,
  type BulkEditCell,
  type BulkEditResult,
} from '@/components/langfristige-marketingplanung-bulk-edit-dialog'
import { useLangfristigePlanungNotizen } from '@/hooks/use-langfristige-planung-notizen'
import { PlanungNotizFormular } from '@/components/planung-notiz-formular'

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatNum(v: number | null, decimals = 2): string {
  if (v === null) return ''
  return v.toLocaleString('de-DE', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  })
}

// ─── Row types ────────────────────────────────────────────────────────────────

type RowKind =
  | 'platform-header' // obere Aggregation je Sales-Plattform (aufklappbar)
  | 'platform-produkt' // je Produkt aggregiertes Budget der Plattform
  | 'gesamt-budget'
  | 'kanal-header' // Marketingkanal-Sektion (aufklappbar, mit Plattform-Badge)
  | 'product-absatz' // read-only (aus Absatzplanung der Plattform)
  | 'product-vk' // read-only
  | 'product-umsatz' // read-only (berechnet)
  | 'product-pct' // editierbar (je Kanal × Produkt)
  | 'product-budget' // read-only (berechnet)

interface FlatRow {
  id: string
  kind: RowKind
  label: string
  indent: number
  kanalId?: string
  produktId?: string
  plattformId?: string
  expandable?: boolean
  expanded?: boolean
}

// ─── Main component ───────────────────────────────────────────────────────────

export function LangfristigeMarketingplanungTabelle({ versionId }: { versionId: string }) {
  const {
    monate,
    marketingkanaele,
    plattformen,
    produkte,
    loading,
    error,
    getKanalPlattform,
    getAbsatz,
    getVK,
    getAbsatzByPlattform,
    getVKByPlattform,
    getPct,
    getBudget,
    upsertCell,
    upsertBatch,
  } = useLangfristigeMarketingplanung(versionId)

  const { toast } = useToast()
  const [expandedPlatforms, setExpandedPlatforms] = useState<Set<string>>(new Set())
  const [expandedKanaele, setExpandedKanaele] = useState<Set<string>>(new Set())

  // Betragsselektion / Mehrfachselektion
  const [selectedCells, setSelectedCells] = useState<Map<string, number>>(new Map())
  const isDragging = useRef(false)
  const selectionSum = Array.from(selectedCells.values()).reduce((a, b) => a + b, 0)

  // Bulk edit
  const [bulkEditOpen, setBulkEditOpen] = useState(false)

  // Notizen (versionsgebunden, Seite "marketingplanung")
  const { notizen, upsertNotiz, deleteNotiz } = useLangfristigePlanungNotizen(versionId, 'marketingplanung')
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

  // ─── Plattform → zugeordnete Kanäle (für obere Aggregation) ──────────────────

  const plattformMitKanaelen = useMemo((): { plattform: KpiCategory; kanaele: KpiCategory[] }[] => {
    const byPlattform = new Map<string, KpiCategory[]>()
    for (const k of marketingkanaele) {
      const pid = getKanalPlattform(k.id)
      if (!pid) continue
      if (!byPlattform.has(pid)) byPlattform.set(pid, [])
      byPlattform.get(pid)!.push(k)
    }
    return plattformen
      .filter(p => byPlattform.has(p.id))
      .map(p => ({ plattform: p, kanaele: byPlattform.get(p.id)! }))
  }, [marketingkanaele, plattformen, getKanalPlattform])

  // Alle Plattformen + Kanäle beim ersten Laden ausklappen
  useEffect(() => {
    if (!loading) {
      if (plattformMitKanaelen.length > 0) {
        setExpandedPlatforms(new Set(plattformMitKanaelen.map(e => e.plattform.id)))
      }
      if (marketingkanaele.length > 0) {
        setExpandedKanaele(new Set(marketingkanaele.map(k => k.id)))
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading])

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

  // ─── Aggregation: Kanal ───────────────────────────────────────────────────────

  const kanalBudget = useCallback(
    (kanalId: string, monat: PlanungsMonat): number | null => {
      let total = 0
      let hasValue = false
      for (const prd of produkte) {
        const b = getBudget(kanalId, prd.id, monat)
        if (b !== null) {
          total += b
          hasValue = true
        }
      }
      return hasValue ? total : null
    },
    [produkte, getBudget],
  )

  const kanalPct = useCallback(
    (kanalId: string, monat: PlanungsMonat): number | null => {
      let budget = 0
      let umsatz = 0
      for (const prd of produkte) {
        const b = getBudget(kanalId, prd.id, monat)
        const u = computeBruttoUmsatz(getAbsatz(kanalId, prd.id, monat), getVK(kanalId, prd.id, monat))
        if (b !== null) budget += b
        if (u !== null) umsatz += u
      }
      if (umsatz === 0) return null
      return Math.round((budget / umsatz) * 100 * 100) / 100
    },
    [produkte, getBudget, getAbsatz, getVK],
  )

  // ─── Aggregation: Plattform (Summe über zugeordnete Kanäle) ──────────────────

  const platformProduktBudget = useCallback(
    (plattformId: string, produktId: string, monat: PlanungsMonat): number | null => {
      const entry = plattformMitKanaelen.find(e => e.plattform.id === plattformId)
      if (!entry) return null
      let total = 0
      let hasValue = false
      for (const k of entry.kanaele) {
        const b = getBudget(k.id, produktId, monat)
        if (b !== null) {
          total += b
          hasValue = true
        }
      }
      return hasValue ? total : null
    },
    [plattformMitKanaelen, getBudget],
  )

  // Umsatz einer Plattform-Produkt-Zelle (einmal je Plattform×Produkt, kanalunabhängig).
  const platformProduktUmsatz = useCallback(
    (plattformId: string, produktId: string, monat: PlanungsMonat): number | null =>
      computeBruttoUmsatz(
        getAbsatzByPlattform(plattformId, produktId, monat),
        getVKByPlattform(plattformId, produktId, monat),
      ),
    [getAbsatzByPlattform, getVKByPlattform],
  )

  const platformProduktPct = useCallback(
    (plattformId: string, produktId: string, monat: PlanungsMonat): number | null => {
      const budget = platformProduktBudget(plattformId, produktId, monat)
      const umsatz = platformProduktUmsatz(plattformId, produktId, monat)
      if (budget === null || umsatz === null || umsatz === 0) return null
      return Math.round((budget / umsatz) * 100 * 100) / 100
    },
    [platformProduktBudget, platformProduktUmsatz],
  )

  const platformBudget = useCallback(
    (plattformId: string, monat: PlanungsMonat): number | null => {
      let total = 0
      let hasValue = false
      for (const prd of produkte) {
        const b = platformProduktBudget(plattformId, prd.id, monat)
        if (b !== null) {
          total += b
          hasValue = true
        }
      }
      return hasValue ? total : null
    },
    [produkte, platformProduktBudget],
  )

  const platformPct = useCallback(
    (plattformId: string, monat: PlanungsMonat): number | null => {
      let budget = 0
      let umsatz = 0
      for (const prd of produkte) {
        const b = platformProduktBudget(plattformId, prd.id, monat)
        const u = platformProduktUmsatz(plattformId, prd.id, monat)
        if (b !== null) budget += b
        if (u !== null) umsatz += u
      }
      if (umsatz === 0) return null
      return Math.round((budget / umsatz) * 100 * 100) / 100
    },
    [produkte, platformProduktBudget, platformProduktUmsatz],
  )

  const gesamtBudget = useCallback(
    (monat: PlanungsMonat): number | null => {
      let total = 0
      let hasValue = false
      for (const { plattform } of plattformMitKanaelen) {
        const b = platformBudget(plattform.id, monat)
        if (b !== null) {
          total += b
          hasValue = true
        }
      }
      return hasValue ? total : null
    },
    [plattformMitKanaelen, platformBudget],
  )

  const gesamtPct = useCallback(
    (monat: PlanungsMonat): number | null => {
      let budget = 0
      let umsatz = 0
      for (const { plattform } of plattformMitKanaelen) {
        for (const prd of produkte) {
          const b = platformProduktBudget(plattform.id, prd.id, monat)
          const u = platformProduktUmsatz(plattform.id, prd.id, monat)
          if (b !== null) budget += b
          if (u !== null) umsatz += u
        }
      }
      if (umsatz === 0) return null
      return Math.round((budget / umsatz) * 100 * 100) / 100
    },
    [plattformMitKanaelen, produkte, platformProduktBudget, platformProduktUmsatz],
  )

  // ─── Flache Zeilenliste ──────────────────────────────────────────────────────

  const flatRows = useMemo((): FlatRow[] => {
    const rows: FlatRow[] = []

    // Obere Aggregation: je Sales-Plattform (aufklappbar in Produkte)
    for (const { plattform } of plattformMitKanaelen) {
      const expanded = expandedPlatforms.has(plattform.id)
      rows.push({
        id: `plt-header-${plattform.id}`,
        kind: 'platform-header',
        label: plattform.name,
        indent: 0,
        plattformId: plattform.id,
        expandable: true,
        expanded,
      })
      if (expanded) {
        for (const prd of produkte) {
          rows.push({
            id: `plt-prd-${plattform.id}-${prd.id}`,
            kind: 'platform-produkt',
            label: prd.name,
            indent: 1,
            plattformId: plattform.id,
            produktId: prd.id,
          })
        }
      }
    }

    // Gesamt unter den Plattformen
    rows.push({ id: 'gesamt-budget', kind: 'gesamt-budget', label: 'Marketingbudget (Gesamt)', indent: 0 })

    // Pro Marketingkanal eine einklappbare Sektion (Eingabe)
    for (const kanal of marketingkanaele) {
      const expanded = expandedKanaele.has(kanal.id)
      rows.push({
        id: `kanal-header-${kanal.id}`,
        kind: 'kanal-header',
        label: kanal.name,
        indent: 0,
        kanalId: kanal.id,
        plattformId: getKanalPlattform(kanal.id) ?? undefined,
        expandable: true,
        expanded,
      })

      if (expanded) {
        for (const prd of produkte) {
          rows.push({ id: `abs-${kanal.id}-${prd.id}`, kind: 'product-absatz', label: `${prd.name} - Absatz`, indent: 2, kanalId: kanal.id, produktId: prd.id })
          rows.push({ id: `vk-${kanal.id}-${prd.id}`, kind: 'product-vk', label: `${prd.name} - Effektiver VK`, indent: 2, kanalId: kanal.id, produktId: prd.id })
          rows.push({ id: `ums-${kanal.id}-${prd.id}`, kind: 'product-umsatz', label: `${prd.name} - Brutto-Umsatz`, indent: 2, kanalId: kanal.id, produktId: prd.id })
          rows.push({ id: `pct-${kanal.id}-${prd.id}`, kind: 'product-pct', label: `${prd.name} - Marketingkosten %`, indent: 2, kanalId: kanal.id, produktId: prd.id })
          rows.push({ id: `bud-${kanal.id}-${prd.id}`, kind: 'product-budget', label: `${prd.name} - Marketingbudget`, indent: 2, kanalId: kanal.id, produktId: prd.id })
        }
      }
    }

    return rows
  }, [marketingkanaele, produkte, expandedKanaele, expandedPlatforms, plattformMitKanaelen, getKanalPlattform])

  // ─── Zellwert je Zeile × Monat ───────────────────────────────────────────────

  function getRowValue(
    row: FlatRow,
    monat: PlanungsMonat,
  ): { display: string; display2?: string; rawNum: number | null; isEditable: boolean } {
    switch (row.kind) {
      case 'platform-header': {
        const b = platformBudget(row.plattformId!, monat)
        const pct = platformPct(row.plattformId!, monat)
        return { display: b !== null ? formatNum(b) : '', display2: pct !== null ? `${formatNum(pct)} %` : '', rawNum: b, isEditable: false }
      }
      case 'platform-produkt': {
        const b = platformProduktBudget(row.plattformId!, row.produktId!, monat)
        const pct = platformProduktPct(row.plattformId!, row.produktId!, monat)
        return { display: b !== null ? formatNum(b) : '', display2: pct !== null ? `${formatNum(pct)} %` : '', rawNum: b, isEditable: false }
      }
      case 'gesamt-budget': {
        const b = gesamtBudget(monat)
        const pct = gesamtPct(monat)
        return { display: b !== null ? formatNum(b) : '', display2: pct !== null ? `${formatNum(pct)} %` : '', rawNum: b, isEditable: false }
      }
      case 'kanal-header': {
        const b = kanalBudget(row.kanalId!, monat)
        const pct = kanalPct(row.kanalId!, monat)
        return { display: b !== null ? formatNum(b) : '', display2: pct !== null ? `${formatNum(pct)} %` : '', rawNum: b, isEditable: false }
      }
      case 'product-absatz': {
        const val = getAbsatz(row.kanalId!, row.produktId!, monat)
        return { display: val !== null ? formatNum(val) : '', rawNum: val, isEditable: false }
      }
      case 'product-vk': {
        const val = getVK(row.kanalId!, row.produktId!, monat)
        return { display: val !== null ? formatNum(val) : '', rawNum: val, isEditable: false }
      }
      case 'product-umsatz': {
        const u = computeBruttoUmsatz(getAbsatz(row.kanalId!, row.produktId!, monat), getVK(row.kanalId!, row.produktId!, monat))
        return { display: u !== null ? formatNum(u) : '', rawNum: u, isEditable: false }
      }
      case 'product-pct': {
        const val = getPct(row.kanalId!, row.produktId!, monat)
        return { display: val !== null ? formatNum(val) : '', rawNum: val, isEditable: true }
      }
      case 'product-budget': {
        const b = getBudget(row.kanalId!, row.produktId!, monat)
        return { display: b !== null ? formatNum(b) : '', rawNum: b, isEditable: false }
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
    const origVal = display === '' ? '' : display.replace(/\./g, '').replace(',', '.')
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

    let parsedNew = editingValue.trim() === '' ? null : parseFloat(editingValue.replace(',', '.'))
    const parsedOrig = editingOriginalValue.current === '' ? null : parseFloat(editingOriginalValue.current)

    setEditingCell(null)
    setEditingValue('')

    // Negative Werte verwerfen, > 100 kappen, auf 2 Dezimalstellen runden.
    if (parsedNew !== null) {
      if (isNaN(parsedNew) || parsedNew < 0) return
      if (parsedNew > 100) parsedNew = 100
      parsedNew = Math.round(parsedNew * 100) / 100
    }

    const unchanged =
      (parsedNew === null && parsedOrig === null) ||
      (parsedNew !== null && parsedOrig !== null && Math.abs(parsedNew - parsedOrig) < 0.005)
    if (unchanged) return

    try {
      await upsertCell(row.kanalId!, row.produktId!, monat, parsedNew)
    } catch {
      toast({ title: 'Fehler beim Speichern', description: 'Wert konnte nicht gespeichert werden.', variant: 'destructive' })
    }
  }

  // ─── Bulk edit ────────────────────────────────────────────────────────────────

  const bulkEditEnabled = useMemo((): boolean => {
    const keys = Array.from(selectedCells.keys())
    if (keys.length < 2) return false
    return keys.every(k => k.endsWith(':pct'))
  }, [selectedCells])

  const bulkEditCells = useMemo((): BulkEditCell[] => {
    if (!bulkEditEnabled) return []
    const result: BulkEditCell[] = []
    for (const [key, value] of selectedCells.entries()) {
      const parts = key.split(':')
      // ${kanalId}:${produktId}:${year}:${month}:pct
      if (parts.length !== 5) continue
      const kanalId = parts[0]
      const produktId = parts[1]
      const year = parseInt(parts[2])
      const month = parseInt(parts[3])
      const monat = monate.find(m => m.year === year && m.month === month)
      if (monat) result.push({ kanalId, produktId, monat, currentValue: value })
    }
    return result
  }, [bulkEditEnabled, selectedCells, monate])

  async function handleBulkApply(results: BulkEditResult[]) {
    try {
      await upsertBatch(
        results.map(r => ({
          kanalId: r.kanalId,
          produktId: r.produktId,
          monat: r.monat,
          value: r.newValue,
        })),
      )
      setSelectedCells(new Map())
    } catch {
      toast({ title: 'Fehler', description: 'Massen-Anpassung konnte nicht gespeichert werden.', variant: 'destructive' })
    }
  }

  // ─── Toggle / Notiz-Helfer ───────────────────────────────────────────────────

  function toggleKanal(kanalId: string) {
    setExpandedKanaele(prev => {
      const next = new Set(prev)
      if (next.has(kanalId)) next.delete(kanalId)
      else next.add(kanalId)
      return next
    })
  }

  function togglePlatform(plattformId: string) {
    setExpandedPlatforms(prev => {
      const next = new Set(prev)
      if (next.has(plattformId)) next.delete(plattformId)
      else next.add(plattformId)
      return next
    })
  }

  function isEditableNotizKey(key: string): boolean {
    return key.endsWith(':pct')
  }

  function getNotizCellLabel(editKey: string): string {
    const parts = editKey.split(':')
    if (parts.length !== 5) return editKey
    const kanalId = parts[0]
    const produktId = parts[1]
    const year = parseInt(parts[2])
    const month = parseInt(parts[3])
    const monat = monate.find(m => m.year === year && m.month === month)
    const prd = produkte.find(p => p.id === produktId)
    const kanal = marketingkanaele.find(k => k.id === kanalId)
    return `${prd?.name ?? produktId} · ${kanal?.name ?? ''} · ${monat?.label ?? ''}`
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

  if (marketingkanaele.length === 0 || produkte.length === 0) {
    return (
      <div className="rounded-md border p-8 text-center text-muted-foreground text-sm space-y-2">
        <p>Keine Marketingkanäle oder Produkte zur Planung vorhanden.</p>
        <p>
          Bitte zuerst in der{' '}
          <a
            href={`/dashboard/langfristige-planung/${versionId}/kpi-modell-verwaltung`}
            className="underline text-foreground"
          >
            KPI-Modell Verwaltung
          </a>{' '}
          dieser Planversion mindestens einen Marketingkanal und ein Produkt anlegen.
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
                const isHeader = row.kind === 'kanal-header'
                const isPlatformHeader = row.kind === 'platform-header'
                const isPlatformProdukt = row.kind === 'platform-produkt'
                const isGesamt = row.kind === 'gesamt-budget'

                // Zeilen-Tint (halbtransparent) — identisch zur Absatzplanung.
                // Aufgeklappte Plattform-Produkt-Zeilen erscheinen (wie die
                // aufgeklappten Produkte bei der Absatzplanung) mit weißem
                // Hintergrund, nicht grau getintet.
                const bg = isGesamt
                  ? 'bg-muted/60'
                  : isPlatformHeader || isHeader
                    ? 'bg-muted/30'
                    : 'bg-white dark:bg-background'

                // Sticky-Label-Spalte: deckende (opake) Hintergründe, damit beim
                // horizontalen Scrollen keine Werte-Zellen durchscheinen.
                const labelBg =
                  isGesamt || isPlatformHeader || isHeader
                    ? 'bg-muted'
                    : 'bg-background'

                // Trennlinien wie in der Absatzplanung: Sektionen (Plattform, Gesamt,
                // Kanal) kräftiger, Produkt-Gruppen subtiler.
                const isSectionStart =
                  row.kind === 'platform-header' ||
                  row.kind === 'gesamt-budget' ||
                  row.kind === 'kanal-header'

                return (
                  <tr
                    key={row.id}
                    className={[
                      'border-b last:border-0 hover:bg-muted/20 transition-colors',
                      isSectionStart ? 'border-t-[2.25px] border-t-foreground/40' : '',
                      row.kind === 'product-absatz' ? 'border-t-[2.25px] border-t-foreground/20' : '',
                      bg,
                    ].join(' ')}
                  >
                    {/* Label-Zelle (sticky, opak) */}
                    <td
                      className={['sticky left-0 z-10 px-3 py-1.5 overflow-hidden whitespace-nowrap text-ellipsis', labelBg].join(' ')}
                      style={{ paddingLeft: `${12 + row.indent * 16}px` }}
                      title={row.label}
                    >
                      {isPlatformHeader ? (
                        <button
                          type="button"
                          className="flex items-center gap-1.5 text-sm font-semibold hover:text-primary w-full min-w-0"
                          onClick={() => togglePlatform(row.plattformId!)}
                        >
                          {row.expanded ? <ChevronDown className="h-3.5 w-3.5 shrink-0" /> : <ChevronRight className="h-3.5 w-3.5 shrink-0" />}
                          <span className="truncate">{row.label}</span>
                        </button>
                      ) : isHeader ? (
                        <div className="flex items-center gap-2 min-w-0">
                          <button
                            type="button"
                            className="flex items-center gap-1.5 text-sm font-semibold hover:text-primary min-w-0"
                            onClick={() => toggleKanal(row.kanalId!)}
                          >
                            {row.expanded ? <ChevronDown className="h-3.5 w-3.5 shrink-0" /> : <ChevronRight className="h-3.5 w-3.5 shrink-0" />}
                            <span className="truncate">{row.label}</span>
                          </button>
                          {row.plattformId ? (
                            <Badge variant="secondary" className="shrink-0 text-[10px] px-1.5 py-0 font-normal leading-4">
                              {plattformen.find(p => p.id === row.plattformId)?.name ?? 'Plattform'}
                            </Badge>
                          ) : (
                            <Badge variant="outline" className="shrink-0 text-[10px] px-1.5 py-0 font-normal leading-4 text-muted-foreground">
                              Keine Plattform
                            </Badge>
                          )}
                        </div>
                      ) : (
                        <span
                          className={[
                            'block truncate',
                            isGesamt
                              ? 'text-sm font-semibold'
                              : isPlatformProdukt
                                ? 'text-sm font-medium text-muted-foreground'
                                : row.kind === 'product-pct'
                                  ? 'text-sm text-foreground'
                                  : 'text-sm text-muted-foreground',
                          ].join(' ')}
                        >
                          {row.label}
                        </span>
                      )}
                    </td>

                    {/* Wert-Zellen */}
                    {monate.map(m => {
                      const { display, display2, rawNum, isEditable: cellEditable } = getRowValue(row, m)

                      let editKey: string | null = null
                      if (cellEditable && row.kanalId && row.produktId) {
                        editKey = pctCellKey(row.kanalId, row.produktId, m.year, m.month)
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
                              size={1}
                              min="0"
                              max="100"
                              step="any"
                              className="w-full min-w-0 text-left bg-transparent outline-none border-b border-primary text-xs tabular-nums [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
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
                          ) : display2 !== undefined ? (
                            <div className="flex flex-col items-start gap-0">
                              <span>{display || '—'}</span>
                              {display2 && (
                                <span className="text-[10px] text-muted-foreground leading-tight">{display2}</span>
                              )}
                            </div>
                          ) : (
                            <span>
                              {cellEditable ? (display !== '' ? `${display} %` : '—') : display}
                            </span>
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
            {bulkEditEnabled && (
              <div className="flex items-center gap-2 rounded-lg border bg-background px-4 py-2 shadow-lg text-sm">
                <Pencil className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                <span className="text-muted-foreground">
                  {selectedCells.size} Marketingkosten-%-Felder ausgewählt
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
        <LangfristigeMarketingplanungBulkEditDialog
          open={bulkEditOpen}
          onClose={() => setBulkEditOpen(false)}
          cells={bulkEditCells}
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
