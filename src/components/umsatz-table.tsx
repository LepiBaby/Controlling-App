'use client'

import { useState, useRef } from 'react'
import { ArrowUp, ArrowDown, ArrowUpDown, Pencil, Trash2, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Table,
  TableBody,
  TableCell,
  TableFooter,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Skeleton } from '@/components/ui/skeleton'
import { cn } from '@/lib/utils'
import { useToast } from '@/hooks/use-toast'
import { KpiCategory } from '@/hooks/use-kpi-categories'
import {
  UmsatzTransaktion,
  UmsatzTransaktionInput,
  ColumnVisibility,
  SortColumn,
  SortDirection,
  PAGE_SIZE,
} from '@/hooks/use-umsatz-transaktionen'

// ─── Inline-edit helpers ───────────────────────────────────────────────────

function formatBetrag(betrag: number): string {
  return new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR' }).format(betrag)
}

function formatDate(dateStr: string): string {
  if (!dateStr) return ''
  const [year, month, day] = dateStr.split('-')
  return `${day}.${month}.${year}`
}

function getCategoryName(categories: KpiCategory[], id: string | null): string {
  if (!id) return ''
  return categories.find(c => c.id === id)?.name ?? '[Kategorie gelöscht]'
}

const iBase = 'h-7 w-full min-w-[70px] rounded-md border bg-background px-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-ring'
const iOk  = 'border-input'
const iErr = 'border-destructive ring-1 ring-destructive'

interface UmsatzDraft {
  leistungsdatum: string
  betrag: string
  kategorieId: string
  gruppeId: string
  untergruppeId: string
  salesPlattformId: string
  produktId: string
  beschreibung: string
}

function initDraft(t: UmsatzTransaktion): UmsatzDraft {
  return {
    leistungsdatum: t.leistungsdatum,
    betrag: String(t.betrag),
    kategorieId: t.kategorie_id,
    gruppeId: t.gruppe_id ?? '',
    untergruppeId: t.untergruppe_id ?? '',
    salesPlattformId: t.sales_plattform_id ?? '',
    produktId: t.produkt_id ?? '',
    beschreibung: t.beschreibung ?? '',
  }
}

function validateDraft(d: UmsatzDraft, kategorien: KpiCategory[]): Record<string, string> {
  const e: Record<string, string> = {}
  if (!d.leistungsdatum) e.leistungsdatum = 'Pflichtfeld'
  if (!d.betrag || Number(d.betrag) <= 0) e.betrag = '> 0 erforderlich'
  if (!d.kategorieId) e.kategorieId = 'Pflichtfeld'
  const sel = kategorien.find(c => c.id === d.kategorieId)
  const gruppen = kategorien.filter(c => c.level === 2 && c.parent_id === d.kategorieId)
  const untergruppen = kategorien.filter(c => c.level === 3 && c.parent_id === d.gruppeId)
  if (gruppen.length > 0 && !d.gruppeId) e.gruppeId = 'Pflichtfeld'
  if (d.gruppeId && untergruppen.length > 0 && !d.untergruppeId) e.untergruppeId = 'Pflichtfeld'
  if (sel?.sales_plattform_enabled && !d.salesPlattformId) e.salesPlattformId = 'Pflichtfeld'
  if (sel?.produkt_enabled && !d.produktId) e.produktId = 'Pflichtfeld'
  return e
}

// ─── UmsatzEditRow ────────────────────────────────────────────────────────

function UmsatzEditRow({
  t,
  umsatzKategorien,
  salesPlattformen,
  produkte,
  columnVisibility,
  onInlineUpdate,
  onDelete,
}: {
  t: UmsatzTransaktion
  umsatzKategorien: KpiCategory[]
  salesPlattformen: KpiCategory[]
  produkte: KpiCategory[]
  columnVisibility: ColumnVisibility
  onInlineUpdate: (id: string, input: Partial<UmsatzTransaktionInput>) => Promise<void>
  onDelete: (id: string) => void
}) {
  const { toast } = useToast()
  const [draft, setDraft] = useState<UmsatzDraft>(() => initDraft(t))
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [saving, setSaving] = useState(false)
  const draftRef = useRef(draft)
  draftRef.current = draft

  const { showGruppe: showGruppeCol, showUntergruppe: showUntCol, showSalesPlattform: showSPCol, showProdukte: showProdCol } = columnVisibility

  const level1 = umsatzKategorien.filter(c => c.level === 1)
  const sel = umsatzKategorien.find(c => c.id === draft.kategorieId) ?? null
  const gruppen = umsatzKategorien.filter(c => c.level === 2 && c.parent_id === draft.kategorieId)
  const untergruppen = umsatzKategorien.filter(c => c.level === 3 && c.parent_id === draft.gruppeId)

  const ic = (field: string) => cn(iBase, errors[field] ? iErr : iOk)

  const handleKategorieChange = (value: string) => {
    setDraft(prev => ({ ...prev, kategorieId: value, gruppeId: '', untergruppeId: '', salesPlattformId: '', produktId: '' }))
  }

  const handleGruppeChange = (value: string) => {
    setDraft(prev => ({ ...prev, gruppeId: value, untergruppeId: '' }))
  }

  const handleBlur = async () => {
    if (saving) return
    const d = draftRef.current
    const newErrors = validateDraft(d, umsatzKategorien)
    setErrors(newErrors)
    if (Object.keys(newErrors).length > 0) return

    const unchanged =
      d.leistungsdatum === t.leistungsdatum &&
      Number(d.betrag) === Number(t.betrag) &&
      d.kategorieId === t.kategorie_id &&
      (d.gruppeId || null) === t.gruppe_id &&
      (d.untergruppeId || null) === t.untergruppe_id &&
      (d.salesPlattformId || null) === t.sales_plattform_id &&
      (d.produktId || null) === t.produkt_id &&
      (d.beschreibung || null) === t.beschreibung

    if (unchanged) return

    setSaving(true)
    try {
      await onInlineUpdate(t.id, {
        leistungsdatum: d.leistungsdatum,
        betrag: Number(d.betrag),
        kategorie_id: d.kategorieId,
        gruppe_id: d.gruppeId || null,
        untergruppe_id: d.untergruppeId || null,
        sales_plattform_id: d.salesPlattformId || null,
        produkt_id: d.produktId || null,
        beschreibung: d.beschreibung || null,
      })
    } catch (e) {
      toast({ title: 'Fehler beim Speichern', description: e instanceof Error ? e.message : 'Unbekannter Fehler', variant: 'destructive' })
      setDraft(initDraft(t))
    } finally {
      setSaving(false)
    }
  }

  return (
    <TableRow className={cn('bg-muted/20', saving && 'opacity-60')}>
      <TableCell className="p-1">
        <input type="date" className={ic('leistungsdatum')} value={draft.leistungsdatum}
          onChange={e => setDraft(p => ({ ...p, leistungsdatum: e.target.value }))}
          onBlur={handleBlur} disabled={saving} />
      </TableCell>
      <TableCell className="p-1">
        <select className={ic('kategorieId')} value={draft.kategorieId}
          onChange={e => handleKategorieChange(e.target.value)}
          onBlur={handleBlur} disabled={saving}>
          <option value="">Wählen…</option>
          {level1.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
      </TableCell>
      {showGruppeCol && (
        <TableCell className="p-1">
          {gruppen.length > 0 ? (
            <select className={ic('gruppeId')} value={draft.gruppeId}
              onChange={e => handleGruppeChange(e.target.value)}
              onBlur={handleBlur} disabled={saving}>
              <option value="">Wählen…</option>
              {gruppen.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          ) : <span className="text-xs text-muted-foreground">—</span>}
        </TableCell>
      )}
      {showUntCol && (
        <TableCell className="p-1">
          {draft.gruppeId && untergruppen.length > 0 ? (
            <select className={ic('untergruppeId')} value={draft.untergruppeId}
              onChange={e => setDraft(p => ({ ...p, untergruppeId: e.target.value }))}
              onBlur={handleBlur} disabled={saving}>
              <option value="">Wählen…</option>
              {untergruppen.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          ) : <span className="text-xs text-muted-foreground">—</span>}
        </TableCell>
      )}
      {showSPCol && (
        <TableCell className="p-1">
          {sel?.sales_plattform_enabled ? (
            <select className={ic('salesPlattformId')} value={draft.salesPlattformId}
              onChange={e => setDraft(p => ({ ...p, salesPlattformId: e.target.value }))}
              onBlur={handleBlur} disabled={saving}>
              <option value="">Wählen…</option>
              {salesPlattformen.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          ) : <span className="text-xs text-muted-foreground">—</span>}
        </TableCell>
      )}
      {showProdCol && (
        <TableCell className="p-1">
          {sel?.produkt_enabled ? (
            <select className={ic('produktId')} value={draft.produktId}
              onChange={e => setDraft(p => ({ ...p, produktId: e.target.value }))}
              onBlur={handleBlur} disabled={saving}>
              <option value="">Wählen…</option>
              {produkte.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          ) : <span className="text-xs text-muted-foreground">—</span>}
        </TableCell>
      )}
      <TableCell className="p-1">
        <input type="text" className={cn(iBase, 'min-w-[90px]', iOk)} value={draft.beschreibung}
          onChange={e => setDraft(p => ({ ...p, beschreibung: e.target.value }))}
          onBlur={handleBlur} disabled={saving} placeholder="Optional…" />
      </TableCell>
      <TableCell className="p-1 text-right">
        <input type="number" className={cn(iBase, 'min-w-[80px] text-right', errors.betrag ? iErr : iOk)}
          value={draft.betrag}
          onChange={e => setDraft(p => ({ ...p, betrag: e.target.value }))}
          onBlur={handleBlur} disabled={saving} step="0.01" min="0.01" />
      </TableCell>
      <TableCell className="p-1">
        <div className="flex items-center gap-1 justify-end">
          {saving && <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" />}
          <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive hover:text-destructive"
            onClick={() => onDelete(t.id)} disabled={saving} aria-label="Löschen">
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
        </div>
      </TableCell>
    </TableRow>
  )
}

// ─── SortHeader ───────────────────────────────────────────────────────────

interface SortHeaderProps {
  label: string
  column: SortColumn
  currentSort: SortColumn
  direction: SortDirection
  onSort: (col: SortColumn) => void
}

function SortHeader({ label, column, currentSort, direction, onSort }: SortHeaderProps) {
  const isActive = column === currentSort
  return (
    <button
      className="flex items-center gap-1 font-medium hover:text-foreground"
      onClick={() => onSort(column)}
    >
      {label}
      {isActive ? (
        direction === 'asc' ? <ArrowUp className="h-3.5 w-3.5" /> : <ArrowDown className="h-3.5 w-3.5" />
      ) : (
        <ArrowUpDown className="h-3.5 w-3.5 opacity-40" />
      )}
    </button>
  )
}

// ─── UmsatzTable ──────────────────────────────────────────────────────────

interface UmsatzTableProps {
  transaktionen: UmsatzTransaktion[]
  loading: boolean
  columnVisibility: ColumnVisibility
  umsatzKategorien: KpiCategory[]
  salesPlattformen: KpiCategory[]
  produkte: KpiCategory[]
  total: number
  totalBetrag: number
  page: number
  onPageChange: (page: number) => void
  sortColumn: SortColumn
  sortDirection: SortDirection
  onSort: (col: SortColumn) => void
  onEdit: (t: UmsatzTransaktion) => void
  onDelete: (id: string) => void
  editMode?: boolean
  onInlineUpdate?: (id: string, input: Partial<UmsatzTransaktionInput>) => Promise<void>
}

export function UmsatzTable({
  transaktionen,
  loading,
  columnVisibility,
  umsatzKategorien,
  salesPlattformen,
  produkte,
  total,
  totalBetrag,
  page,
  onPageChange,
  sortColumn,
  sortDirection,
  onSort,
  onEdit,
  onDelete,
  editMode = false,
  onInlineUpdate,
}: UmsatzTableProps) {
  const { showGruppe, showUntergruppe, showSalesPlattform, showProdukte } = columnVisibility

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE))

  const optionalCount = [showGruppe, showUntergruppe, showSalesPlattform, showProdukte].filter(Boolean).length
  const totalColumns = 5 + optionalCount

  if (loading && transaktionen.length === 0) {
    return (
      <div className="space-y-2 mt-4">
        {Array.from({ length: 5 }).map((_, i) => (
          <Skeleton key={i} className="h-10 w-full" />
        ))}
      </div>
    )
  }

  if (!loading && transaktionen.length === 0) {
    return (
      <div className="mt-12 text-center text-muted-foreground">
        <p className="text-sm">Noch keine Umsatz-Transaktionen erfasst.</p>
        <p className="text-sm">Klicken Sie auf &quot;Neue Transaktion&quot;, um loszulegen.</p>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div className="rounded-md border overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>
                <SortHeader label="Leistungsdatum" column="leistungsdatum" currentSort={sortColumn} direction={sortDirection} onSort={onSort} />
              </TableHead>
              <TableHead>Kategorie</TableHead>
              {showGruppe && <TableHead>Gruppe</TableHead>}
              {showUntergruppe && <TableHead>Untergruppe</TableHead>}
              {showSalesPlattform && <TableHead>Sales Plattform</TableHead>}
              {showProdukte && <TableHead>Produkt</TableHead>}
              <TableHead>Beschreibung</TableHead>
              <TableHead className="text-right">
                <SortHeader label="Betrag" column="betrag" currentSort={sortColumn} direction={sortDirection} onSort={onSort} />
              </TableHead>
              <TableHead className="w-20" />
            </TableRow>
          </TableHeader>

          <TableBody>
            {transaktionen.map(t => (
              editMode && onInlineUpdate ? (
                <UmsatzEditRow
                  key={t.id}
                  t={t}
                  umsatzKategorien={umsatzKategorien}
                  salesPlattformen={salesPlattformen}
                  produkte={produkte}
                  columnVisibility={columnVisibility}
                  onInlineUpdate={onInlineUpdate}
                  onDelete={onDelete}
                />
              ) : (
                <TableRow key={t.id} className="hover:bg-muted/50">
                  <TableCell className="whitespace-nowrap">{formatDate(t.leistungsdatum)}</TableCell>
                  <TableCell>{getCategoryName(umsatzKategorien, t.kategorie_id)}</TableCell>
                  {showGruppe && (
                    <TableCell>{getCategoryName(umsatzKategorien, t.gruppe_id)}</TableCell>
                  )}
                  {showUntergruppe && (
                    <TableCell>{getCategoryName(umsatzKategorien, t.untergruppe_id)}</TableCell>
                  )}
                  {showSalesPlattform && (
                    <TableCell>{getCategoryName(salesPlattformen, t.sales_plattform_id)}</TableCell>
                  )}
                  {showProdukte && (
                    <TableCell>{getCategoryName(produkte, t.produkt_id)}</TableCell>
                  )}
                  <TableCell className="max-w-xs truncate text-muted-foreground text-sm">
                    {t.beschreibung ?? ''}
                  </TableCell>
                  <TableCell className="text-right font-medium whitespace-nowrap">
                    {formatBetrag(Number(t.betrag))}
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1 justify-end">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7"
                        onClick={() => onEdit(t)}
                        aria-label="Bearbeiten"
                      >
                        <Pencil className="h-3.5 w-3.5" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 text-destructive hover:text-destructive"
                        onClick={() => onDelete(t.id)}
                        aria-label="Löschen"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              )
            ))}
          </TableBody>

          <TableFooter>
            <TableRow>
              <TableCell colSpan={totalColumns - 2} className="text-muted-foreground text-sm">
                {total} Transaktion{total !== 1 ? 'en' : ''} gesamt
              </TableCell>
              <TableCell className="text-right font-semibold whitespace-nowrap">
                {formatBetrag(totalBetrag)}
              </TableCell>
              <TableCell />
            </TableRow>
          </TableFooter>
        </Table>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between text-sm text-muted-foreground">
          <span>Seite {page} von {totalPages}</span>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={page <= 1 || loading}
              onClick={() => onPageChange(page - 1)}
            >
              Zurück
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={page >= totalPages || loading}
              onClick={() => onPageChange(page + 1)}
            >
              Weiter
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}
