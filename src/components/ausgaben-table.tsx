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
  AusgabenKostenTransaktion,
  AusgabenKostenTransaktionInput,
  ColumnVisibility,
  SortColumn,
  SortDirection,
  PAGE_SIZE,
} from '@/hooks/use-ausgaben-kosten-transaktionen'

// ─── Inline-edit helpers ───────────────────────────────────────────────────

const ABSCHREIBUNG_LABEL: Record<string, string> = {
  '3_jahre': '3 Jahre',
  '5_jahre': '5 Jahre',
  '7_jahre': '7 Jahre',
  '10_jahre': '10 Jahre',
}

const RELEVANZ_LABEL: Record<string, string> = {
  rentabilitaet: 'Rentabilität',
  liquiditaet: 'Liquidität',
  beides: 'Beides',
}

function formatBetrag(betrag: number): string {
  return new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR' }).format(betrag)
}

function formatDate(dateStr: string | null): string {
  if (!dateStr) return ''
  const [year, month, day] = dateStr.split('-')
  return `${day}.${month}.${year}`
}

function getCategoryName(categories: KpiCategory[], id: string | null): string {
  if (!id) return ''
  return categories.find(c => c.id === id)?.name ?? '[Kategorie gelöscht]'
}

function computeUstBetrag(brutto: number, ustSatz: string, individuell: string): number {
  if (ustSatz === '100') return brutto
  if (ustSatz === '19') return Math.round(brutto * 19 / 119 * 100) / 100
  if (ustSatz === '7')  return Math.round(brutto * 7  / 107 * 100) / 100
  if (ustSatz === 'individuell') return Number(individuell) || 0
  return 0
}

const iBase = 'h-7 w-full min-w-[70px] rounded-md border bg-background px-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-ring'
const iOk  = 'border-input'
const iErr = 'border-destructive ring-1 ring-destructive'

interface AusgabenDraft {
  leistungsdatum: string
  zahlungsdatum: string
  betragBrutto: string
  ustSatz: string
  ustBetragIndividuell: string
  kategorieId: string
  gruppeId: string
  untergruppeId: string
  salesPlattformId: string
  produktId: string
  beschreibung: string
  relevanz: string
  abschreibung: string
}

function initDraft(t: AusgabenKostenTransaktion): AusgabenDraft {
  return {
    leistungsdatum: t.leistungsdatum,
    zahlungsdatum: t.zahlungsdatum ?? '',
    betragBrutto: String(t.betrag_brutto),
    ustSatz: t.ust_satz,
    ustBetragIndividuell: t.ust_satz === 'individuell' ? String(t.ust_betrag) : '',
    kategorieId: t.kategorie_id,
    gruppeId: t.gruppe_id ?? '',
    untergruppeId: t.untergruppe_id ?? '',
    salesPlattformId: t.sales_plattform_id ?? '',
    produktId: t.produkt_id ?? '',
    beschreibung: t.beschreibung ?? '',
    relevanz: t.relevanz,
    abschreibung: t.abschreibung ?? '',
  }
}

function validateDraft(d: AusgabenDraft, kategorien: KpiCategory[]): Record<string, string> {
  const e: Record<string, string> = {}
  if (!d.leistungsdatum) e.leistungsdatum = 'Pflichtfeld'
  if (!d.betragBrutto || Number(d.betragBrutto) <= 0) e.betragBrutto = '> 0 erforderlich'
  if (!d.ustSatz) e.ustSatz = 'Pflichtfeld'
  if (!d.kategorieId) e.kategorieId = 'Pflichtfeld'
  if (!d.relevanz) e.relevanz = 'Pflichtfeld'
  if (d.ustSatz === 'individuell') {
    const brutto = Number(d.betragBrutto)
    const ust = Number(d.ustBetragIndividuell)
    if (!d.ustBetragIndividuell || ust <= 0 || ust >= brutto) e.ustBetragIndividuell = 'Ungültig'
  }
  const sel = kategorien.find(c => c.id === d.kategorieId)
  const gruppen = kategorien.filter(c => c.level === 2 && c.parent_id === d.kategorieId)
  const untergruppen = kategorien.filter(c => c.level === 3 && c.parent_id === d.gruppeId)
  if (gruppen.length > 0 && !d.gruppeId) e.gruppeId = 'Pflichtfeld'
  if (d.gruppeId && untergruppen.length > 0 && !d.untergruppeId) e.untergruppeId = 'Pflichtfeld'
  if (sel?.sales_plattform_enabled && !d.salesPlattformId) e.salesPlattformId = 'Pflichtfeld'
  if (sel?.produkt_enabled && !d.produktId) e.produktId = 'Pflichtfeld'
  return e
}

// ─── AusgabenEditRow ──────────────────────────────────────────────────────

function AusgabenEditRow({
  t,
  ausgabenKategorien,
  salesPlattformen,
  produkte,
  columnVisibility,
  onInlineUpdate,
  onDelete,
}: {
  t: AusgabenKostenTransaktion
  ausgabenKategorien: KpiCategory[]
  salesPlattformen: KpiCategory[]
  produkte: KpiCategory[]
  columnVisibility: ColumnVisibility
  onInlineUpdate: (id: string, input: Partial<AusgabenKostenTransaktionInput>) => Promise<void>
  onDelete: (id: string) => void
}) {
  const { toast } = useToast()
  const [draft, setDraft] = useState<AusgabenDraft>(() => initDraft(t))
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [saving, setSaving] = useState(false)
  const draftRef = useRef(draft)
  draftRef.current = draft

  const { showGruppe: showGruppeCol, showUntergruppe: showUntCol, showSalesPlattform: showSPCol, showProdukte: showProdCol } = columnVisibility

  const level1 = ausgabenKategorien.filter(c => c.level === 1)
  const sel = ausgabenKategorien.find(c => c.id === draft.kategorieId) ?? null
  const gruppen = ausgabenKategorien.filter(c => c.level === 2 && c.parent_id === draft.kategorieId)
  const untergruppen = ausgabenKategorien.filter(c => c.level === 3 && c.parent_id === draft.gruppeId)

  const brutto = Number(draft.betragBrutto) || 0
  const ustBetrag = computeUstBetrag(brutto, draft.ustSatz, draft.ustBetragIndividuell)
  const netto = brutto - ustBetrag

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
    const newErrors = validateDraft(d, ausgabenKategorien)
    setErrors(newErrors)
    if (Object.keys(newErrors).length > 0) return

    const brut = Number(d.betragBrutto)
    const ust = computeUstBetrag(brut, d.ustSatz, d.ustBetragIndividuell)

    const unchanged =
      d.leistungsdatum === t.leistungsdatum &&
      (d.zahlungsdatum || null) === t.zahlungsdatum &&
      brut === Number(t.betrag_brutto) &&
      d.ustSatz === t.ust_satz &&
      (d.ustSatz !== 'individuell' || ust === Number(t.ust_betrag)) &&
      d.kategorieId === t.kategorie_id &&
      (d.gruppeId || null) === t.gruppe_id &&
      (d.untergruppeId || null) === t.untergruppe_id &&
      (d.salesPlattformId || null) === t.sales_plattform_id &&
      (d.produktId || null) === t.produkt_id &&
      (d.beschreibung || null) === t.beschreibung &&
      d.relevanz === t.relevanz &&
      (d.abschreibung || null) === t.abschreibung

    if (unchanged) return

    setSaving(true)
    try {
      await onInlineUpdate(t.id, {
        leistungsdatum: d.leistungsdatum,
        zahlungsdatum: d.zahlungsdatum || null,
        betrag_brutto: brut,
        ust_satz: d.ustSatz,
        ust_betrag: ust,
        kategorie_id: d.kategorieId,
        gruppe_id: d.gruppeId || null,
        untergruppe_id: d.untergruppeId || null,
        sales_plattform_id: d.salesPlattformId || null,
        produkt_id: d.produktId || null,
        beschreibung: d.beschreibung || null,
        relevanz: d.relevanz as 'rentabilitaet' | 'liquiditaet' | 'beides',
        abschreibung: d.abschreibung || null,
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
        <input type="date" className={cn(iBase, iOk)} value={draft.zahlungsdatum}
          onChange={e => setDraft(p => ({ ...p, zahlungsdatum: e.target.value }))}
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
        <input type="number" className={cn(iBase, 'min-w-[80px] text-right', errors.betragBrutto ? iErr : iOk)}
          value={draft.betragBrutto}
          onChange={e => setDraft(p => ({ ...p, betragBrutto: e.target.value }))}
          onBlur={handleBlur} disabled={saving} step="0.01" min="0.01" />
      </TableCell>
      <TableCell className="text-right text-xs text-muted-foreground whitespace-nowrap p-1">
        {formatBetrag(netto)}
      </TableCell>
      <TableCell className="p-1">
        <div className="flex flex-col gap-1">
          <select className={ic('ustSatz')} value={draft.ustSatz}
            onChange={e => setDraft(p => ({ ...p, ustSatz: e.target.value, ustBetragIndividuell: '' }))}
            onBlur={handleBlur} disabled={saving}>
            <option value="">Wählen…</option>
            <option value="100">100%</option>
            <option value="19">19%</option>
            <option value="7">7%</option>
            <option value="0">0%</option>
            <option value="individuell">Individuell</option>
          </select>
          {draft.ustSatz === 'individuell' && (
            <input type="number" className={cn(iBase, errors.ustBetragIndividuell ? iErr : iOk)}
              value={draft.ustBetragIndividuell}
              onChange={e => setDraft(p => ({ ...p, ustBetragIndividuell: e.target.value }))}
              onBlur={handleBlur} disabled={saving} step="0.01" min="0.01" placeholder="USt €" />
          )}
        </div>
      </TableCell>
      <TableCell className="p-1">
        <select className={ic('relevanz')} value={draft.relevanz}
          onChange={e => setDraft(p => ({ ...p, relevanz: e.target.value }))}
          onBlur={handleBlur} disabled={saving}>
          <option value="">Wählen…</option>
          <option value="rentabilitaet">Rentabilität</option>
          <option value="liquiditaet">Liquidität</option>
          <option value="beides">Beides</option>
        </select>
      </TableCell>
      <TableCell className="p-1">
        <select className={cn(iBase, iOk)} value={draft.abschreibung}
          onChange={e => setDraft(p => ({ ...p, abschreibung: e.target.value }))}
          onBlur={handleBlur} disabled={saving}>
          <option value="">Keine</option>
          <option value="3_jahre">3 Jahre</option>
          <option value="5_jahre">5 Jahre</option>
          <option value="7_jahre">7 Jahre</option>
          <option value="10_jahre">10 Jahre</option>
        </select>
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

// ─── AusgabenTable ────────────────────────────────────────────────────────

interface AusgabenTableProps {
  transaktionen: AusgabenKostenTransaktion[]
  loading: boolean
  columnVisibility: ColumnVisibility
  ausgabenKategorien: KpiCategory[]
  salesPlattformen: KpiCategory[]
  produkte: KpiCategory[]
  total: number
  totalBrutto: number
  totalNetto: number
  page: number
  onPageChange: (page: number) => void
  sortColumn: SortColumn
  sortDirection: SortDirection
  onSort: (col: SortColumn) => void
  onEdit: (t: AusgabenKostenTransaktion) => void
  onDelete: (id: string) => void
  editMode?: boolean
  onInlineUpdate?: (id: string, input: Partial<AusgabenKostenTransaktionInput>) => Promise<void>
}

export function AusgabenTable({
  transaktionen,
  loading,
  columnVisibility,
  ausgabenKategorien,
  salesPlattformen,
  produkte,
  total,
  totalBrutto,
  totalNetto,
  page,
  onPageChange,
  sortColumn,
  sortDirection,
  onSort,
  onEdit,
  onDelete,
  editMode = false,
  onInlineUpdate,
}: AusgabenTableProps) {
  const { showGruppe, showUntergruppe, showSalesPlattform, showProdukte } = columnVisibility

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE))

  const optionalCount = [showGruppe, showUntergruppe, showSalesPlattform, showProdukte].filter(Boolean).length
  // Fixed columns: Leistungsdatum, Zahlungsdatum, Kategorie, Beschreibung, Brutto, Netto, USt, Rentabilität, Abschreibung, Actions = 10
  const totalColumns = 10 + optionalCount

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
        <p className="text-sm">Noch keine Ausgaben/Kosten-Transaktionen erfasst.</p>
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
              <TableHead>Zahlungsdatum</TableHead>
              <TableHead>Kategorie</TableHead>
              {showGruppe && <TableHead>Gruppe</TableHead>}
              {showUntergruppe && <TableHead>Untergruppe</TableHead>}
              {showSalesPlattform && <TableHead>Sales Plattform</TableHead>}
              {showProdukte && <TableHead>Produkt</TableHead>}
              <TableHead>Beschreibung</TableHead>
              <TableHead className="text-right">
                <SortHeader label="Brutto" column="betrag_brutto" currentSort={sortColumn} direction={sortDirection} onSort={onSort} />
              </TableHead>
              <TableHead className="text-right">Netto</TableHead>
              <TableHead className="text-right">USt</TableHead>
              <TableHead>Relevanz</TableHead>
              <TableHead>Abschreibung</TableHead>
              <TableHead className="w-20" />
            </TableRow>
          </TableHeader>

          <TableBody>
            {transaktionen.map(t => (
              editMode && onInlineUpdate ? (
                <AusgabenEditRow
                  key={t.id}
                  t={t}
                  ausgabenKategorien={ausgabenKategorien}
                  salesPlattformen={salesPlattformen}
                  produkte={produkte}
                  columnVisibility={columnVisibility}
                  onInlineUpdate={onInlineUpdate}
                  onDelete={onDelete}
                />
              ) : (
                <TableRow key={t.id} className="hover:bg-muted/50">
                  <TableCell className="whitespace-nowrap">{formatDate(t.leistungsdatum)}</TableCell>
                  <TableCell className="whitespace-nowrap text-muted-foreground">{formatDate(t.zahlungsdatum)}</TableCell>
                  <TableCell>{getCategoryName(ausgabenKategorien, t.kategorie_id)}</TableCell>
                  {showGruppe && (
                    <TableCell>{getCategoryName(ausgabenKategorien, t.gruppe_id)}</TableCell>
                  )}
                  {showUntergruppe && (
                    <TableCell>{getCategoryName(ausgabenKategorien, t.untergruppe_id)}</TableCell>
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
                    {formatBetrag(Number(t.betrag_brutto))}
                  </TableCell>
                  <TableCell className="text-right whitespace-nowrap">
                    {formatBetrag(Number(t.betrag_netto))}
                  </TableCell>
                  <TableCell className="text-right whitespace-nowrap text-muted-foreground text-sm">
                    {formatBetrag(Number(t.ust_betrag))}
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {RELEVANZ_LABEL[t.relevanz] ?? t.relevanz}
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {t.abschreibung ? ABSCHREIBUNG_LABEL[t.abschreibung] ?? t.abschreibung : ''}
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
              <TableCell colSpan={totalColumns - 6} className="text-muted-foreground text-sm">
                {total} Transaktion{total !== 1 ? 'en' : ''} gesamt
              </TableCell>
              <TableCell className="text-right font-semibold whitespace-nowrap">
                {formatBetrag(totalBrutto)}
              </TableCell>
              <TableCell className="text-right font-semibold whitespace-nowrap">
                {formatBetrag(totalNetto)}
              </TableCell>
              <TableCell />
              <TableCell />
              <TableCell />
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
