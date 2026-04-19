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
  AbschreibungsRate,
  AbschreibungenSortColumn,
  SortDirection,
  PAGE_SIZE,
} from '@/hooks/use-abschreibungen'

function formatBetrag(betrag: number): string {
  return new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR' }).format(betrag)
}

function formatDate(dateStr: string): string {
  if (!dateStr) return ''
  const [year, month, day] = dateStr.split('-')
  return `${day}.${month}.${year}`
}

function getCategoryDisplayName(categories: KpiCategory[], id: string | null): string {
  if (!id) return ''
  const cat = categories.find(c => c.id === id)
  if (!cat) return '[Kategorie gelöscht]'
  // Im Abschreibungs-Kontext zeigen wir das Kosten-Label, da es sich um Kosten handelt
  if (cat.kosten_label) return cat.kosten_label
  return cat.name
}

// Reine Name-Anzeige (für Gruppe/Untergruppe — kein Kosten-Label)
function getCategoryName(categories: KpiCategory[], id: string | null): string {
  if (!id) return ''
  return categories.find(c => c.id === id)?.name ?? '[Kategorie gelöscht]'
}

interface SortHeaderProps {
  label: string
  column: AbschreibungenSortColumn
  currentSort: AbschreibungenSortColumn
  direction: SortDirection
  onSort: (col: AbschreibungenSortColumn) => void
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

export interface AbschreibungenColumnVisibility {
  showGruppe: boolean
  showUntergruppe: boolean
}

interface AbschreibungenTableProps {
  raten: AbschreibungsRate[]
  loading: boolean
  kpiCategories: KpiCategory[]
  // Ausgaben-Kategorien auf allen Ebenen (für Gruppe/Untergruppe-Lookup)
  ausgabenKategorien: KpiCategory[]
  columnVisibility: AbschreibungenColumnVisibility
  total: number
  totalBetrag: number
  page: number
  onPageChange: (page: number) => void
  sortColumn: AbschreibungenSortColumn
  sortDirection: SortDirection
  onSort: (col: AbschreibungenSortColumn) => void
}

export function AbschreibungenTable({
  raten,
  loading,
  kpiCategories,
  ausgabenKategorien,
  columnVisibility,
  total,
  totalBetrag,
  page,
  onPageChange,
  sortColumn,
  sortDirection,
  onSort,
}: AbschreibungenTableProps) {
  const { showGruppe, showUntergruppe } = columnVisibility
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE))

  // Feste Spalten: Datum | Ursprung | Kategorie | Beschreibung | Betrag = 5
  // Dynamische Spalten: Gruppe + Untergruppe
  const optionalCount = [showGruppe, showUntergruppe].filter(Boolean).length
  const totalColumns = 5 + optionalCount

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
        <p className="text-sm">Keine Abschreibungsraten gefunden.</p>
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
              <TableHead>Kategorie</TableHead>
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
                key={`${r.ursprung_datum}-${r.kategorie_id ?? 'null'}-${r.datum}-${idx}`}
                className="hover:bg-muted/50"
              >
                <TableCell className="whitespace-nowrap">{formatDate(r.datum)}</TableCell>
                <TableCell className="whitespace-nowrap text-muted-foreground">
                  {formatDate(r.ursprung_datum)}
                </TableCell>
                <TableCell>{getCategoryDisplayName(kpiCategories, r.kategorie_id)}</TableCell>
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

      {/* Paginierung */}
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
