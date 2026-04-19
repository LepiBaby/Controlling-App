'use client'

import { ArrowUp, ArrowDown, ArrowUpDown, Pencil, Trash2 } from 'lucide-react'
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
import { KpiCategory } from '@/hooks/use-kpi-categories'
import {
  AusgabenKostenTransaktion,
  ColumnVisibility,
  SortColumn,
  SortDirection,
  PAGE_SIZE,
} from '@/hooks/use-ausgaben-kosten-transaktionen'

const ABSCHREIBUNG_LABEL: Record<string, string> = {
  '3_jahre': '3 Jahre',
  '5_jahre': '5 Jahre',
  '7_jahre': '7 Jahre',
  '10_jahre': '10 Jahre',
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
              <TableHead>Rentabilität</TableHead>
              <TableHead>Abschreibung</TableHead>
              <TableHead className="w-20" />
            </TableRow>
          </TableHeader>

          <TableBody>
            {transaktionen.map(t => (
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
                  {t.relevant_fuer_rentabilitaet === 'ja' ? 'Ja' : t.relevant_fuer_rentabilitaet === 'nein' ? 'Nein' : ''}
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
