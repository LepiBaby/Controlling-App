'use client'

import { ArrowUp, ArrowDown, ArrowUpDown } from 'lucide-react'
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
  InvestitionsRate,
  InvestitionenSortColumn,
  SortDirection,
  PAGE_SIZE,
} from '@/hooks/use-investitionen'

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

interface SortHeaderProps {
  label: string
  column: InvestitionenSortColumn
  currentSort: InvestitionenSortColumn
  direction: SortDirection
  onSort: (col: InvestitionenSortColumn) => void
  align?: 'left' | 'right'
}

function SortHeader({ label, column, currentSort, direction, onSort, align = 'left' }: SortHeaderProps) {
  const isActive = column === currentSort
  return (
    <button
      className={`flex items-center gap-1 font-medium hover:text-foreground ${
        align === 'right' ? 'ml-auto' : ''
      }`}
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

export interface InvestitionenColumnVisibility {
  showGruppe: boolean
  showUntergruppe: boolean
}

interface InvestitionenTableProps {
  raten: InvestitionsRate[]
  loading: boolean
  ausgabenKategorien: KpiCategory[]
  columnVisibility: InvestitionenColumnVisibility
  total: number
  totalBetrag: number
  page: number
  onPageChange: (page: number) => void
  sortColumn: InvestitionenSortColumn
  sortDirection: SortDirection
  onSort: (col: InvestitionenSortColumn) => void
}

export function InvestitionenTable({
  raten,
  loading,
  ausgabenKategorien,
  columnVisibility,
  total,
  totalBetrag,
  page,
  onPageChange,
  sortColumn,
  sortDirection,
  onSort,
}: InvestitionenTableProps) {
  const { showGruppe, showUntergruppe } = columnVisibility
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE))

  // Feste Spalten: Datum | Ursprung | Beschreibung | Betrag = 4
  // Dynamische Spalten: Gruppe + Untergruppe
  const optionalCount = [showGruppe, showUntergruppe].filter(Boolean).length
  const totalColumns = 4 + optionalCount

  if (loading && raten.length === 0) {
    return (
      <div className="space-y-2 mt-4">
        {Array.from({ length: 5 }).map((_, i) => (
          <Skeleton key={i} className="h-10 w-full" />
        ))}
      </div>
    )
  }

  if (!loading && raten.length === 0) {
    return (
      <div className="mt-12 text-center text-muted-foreground">
        <p className="text-sm">Keine Investitionsraten gefunden.</p>
        <p className="text-sm">Passen Sie die Filter an, um Ergebnisse zu sehen.</p>
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
                <SortHeader
                  label="Datum"
                  column="datum"
                  currentSort={sortColumn}
                  direction={sortDirection}
                  onSort={onSort}
                />
              </TableHead>
              <TableHead>Ursprung</TableHead>
              {showGruppe && <TableHead>Gruppe</TableHead>}
              {showUntergruppe && <TableHead>Untergruppe</TableHead>}
              <TableHead>Beschreibung</TableHead>
              <TableHead className="text-right">
                <SortHeader
                  label="Betrag"
                  column="betrag"
                  currentSort={sortColumn}
                  direction={sortDirection}
                  onSort={onSort}
                  align="right"
                />
              </TableHead>
            </TableRow>
          </TableHeader>

          <TableBody>
            {raten.map((r, idx) => (
              <TableRow
                key={`${r.ursprung_datum}-${r.datum}-${idx}`}
                className="hover:bg-muted/50"
              >
                <TableCell className="whitespace-nowrap">{formatDate(r.datum)}</TableCell>
                <TableCell className="whitespace-nowrap text-muted-foreground">
                  {formatDate(r.ursprung_datum)}
                </TableCell>
                {showGruppe && (
                  <TableCell>{getCategoryName(ausgabenKategorien, r.gruppe_id)}</TableCell>
                )}
                {showUntergruppe && (
                  <TableCell>{getCategoryName(ausgabenKategorien, r.untergruppe_id)}</TableCell>
                )}
                <TableCell className="max-w-xs truncate text-muted-foreground text-sm">
                  {r.beschreibung ?? ''}
                </TableCell>
                <TableCell className="text-right font-medium whitespace-nowrap text-destructive">
                  {formatBetrag(Number(r.betrag))}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>

          <TableFooter>
            <TableRow>
              <TableCell colSpan={totalColumns - 2} className="text-muted-foreground text-sm">
                {total} Rate{total !== 1 ? 'n' : ''} gesamt
              </TableCell>
              <TableCell className="text-right text-muted-foreground text-sm whitespace-nowrap">
                Gesamtsumme:
              </TableCell>
              <TableCell className="text-right font-semibold whitespace-nowrap text-destructive">
                {formatBetrag(totalBetrag)}
              </TableCell>
            </TableRow>
          </TableFooter>
        </Table>
      </div>

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
