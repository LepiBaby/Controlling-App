'use client'

import { ArrowUp, ArrowDown, ArrowUpDown } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
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
  LiquiditaetZeile,
  LiquiditaetColumnVisibility,
  LiquiditaetSortColumn,
  SortDirection,
  PAGE_SIZE,
} from '@/hooks/use-liquiditaet'

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
  column: LiquiditaetSortColumn
  currentSort: LiquiditaetSortColumn
  direction: SortDirection
  onSort: (col: LiquiditaetSortColumn) => void
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

interface LiquiditaetTableProps {
  zeilen: LiquiditaetZeile[]
  loading: boolean
  columnVisibility: LiquiditaetColumnVisibility
  kpiCategories: KpiCategory[]
  salesPlattformen: KpiCategory[]
  produkte: KpiCategory[]
  total: number
  totalNettoCashflow: number
  page: number
  onPageChange: (page: number) => void
  sortColumn: LiquiditaetSortColumn
  sortDirection: SortDirection
  onSort: (col: LiquiditaetSortColumn) => void
}

export function LiquiditaetTable({
  zeilen,
  loading,
  columnVisibility,
  kpiCategories,
  salesPlattformen,
  produkte,
  total,
  totalNettoCashflow,
  page,
  onPageChange,
  sortColumn,
  sortDirection,
  onSort,
}: LiquiditaetTableProps) {
  const { showGruppe, showUntergruppe, showSalesPlattform, showProdukte } = columnVisibility

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE))

  // Fixed columns: Zahlungsdatum + Quelle + Kategorie + Beschreibung + Betrag = 5
  // Dynamic columns: Gruppe + Untergruppe + SalesPlattform + Produkte
  const optionalCount = [showGruppe, showUntergruppe, showSalesPlattform, showProdukte].filter(Boolean).length
  const totalColumns = 5 + optionalCount

  if (loading && zeilen.length === 0) {
    return (
      <div className="space-y-2 mt-4">
        {Array.from({ length: 5 }).map((_, i) => (
          <Skeleton key={i} className="h-10 w-full" />
        ))}
      </div>
    )
  }

  if (!loading && zeilen.length === 0) {
    return (
      <div className="mt-12 text-center text-muted-foreground">
        <p className="text-sm">Keine Transaktionen gefunden.</p>
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
                <SortHeader label="Zahlungsdatum" column="zahlungsdatum" currentSort={sortColumn} direction={sortDirection} onSort={onSort} />
              </TableHead>
              <TableHead>Quelle</TableHead>
              <TableHead>Kategorie</TableHead>
              {showGruppe && <TableHead>Gruppe</TableHead>}
              {showUntergruppe && <TableHead>Untergruppe</TableHead>}
              {showSalesPlattform && <TableHead>Sales Plattform</TableHead>}
              {showProdukte && <TableHead>Produkt</TableHead>}
              <TableHead>Beschreibung</TableHead>
              <TableHead className="text-right">
                <SortHeader label="Betrag" column="betrag" currentSort={sortColumn} direction={sortDirection} onSort={onSort} />
              </TableHead>
            </TableRow>
          </TableHeader>

          <TableBody>
            {zeilen.map(z => {
              const isEinnahmen = z.quelle === 'einnahmen'
              return (
                <TableRow key={`${z.quelle}-${z.id}`} className="hover:bg-muted/50">
                  <TableCell className="whitespace-nowrap">{formatDate(z.zahlungsdatum)}</TableCell>
                  <TableCell>
                    {isEinnahmen ? (
                      <Badge
                        variant="default"
                        className="bg-green-600 hover:bg-green-600/90 text-white"
                      >
                        Einnahmen
                      </Badge>
                    ) : (
                      <Badge variant="destructive">Ausgaben</Badge>
                    )}
                  </TableCell>
                  <TableCell>{getCategoryName(kpiCategories, z.kategorie_id)}</TableCell>
                  {showGruppe && (
                    <TableCell>{getCategoryName(kpiCategories, z.gruppe_id)}</TableCell>
                  )}
                  {showUntergruppe && (
                    <TableCell>{getCategoryName(kpiCategories, z.untergruppe_id)}</TableCell>
                  )}
                  {showSalesPlattform && (
                    <TableCell>{getCategoryName(salesPlattformen, z.sales_plattform_id)}</TableCell>
                  )}
                  {showProdukte && (
                    <TableCell>{getCategoryName(produkte, z.produkt_id)}</TableCell>
                  )}
                  <TableCell className="max-w-xs truncate text-muted-foreground text-sm">
                    {z.beschreibung ?? ''}
                  </TableCell>
                  <TableCell
                    className={`text-right font-medium whitespace-nowrap ${
                      Number(z.betrag) >= 0 ? 'text-green-600' : 'text-red-600'
                    }`}
                  >
                    {formatBetrag(Number(z.betrag))}
                  </TableCell>
                </TableRow>
              )
            })}
          </TableBody>

          <TableFooter>
            <TableRow>
              <TableCell colSpan={totalColumns - 2} className="text-muted-foreground text-sm">
                {total} Transaktion{total !== 1 ? 'en' : ''} gesamt
              </TableCell>
              <TableCell className="text-right text-muted-foreground text-sm whitespace-nowrap">
                Netto-Cashflow:
              </TableCell>
              <TableCell
                className={`text-right font-semibold whitespace-nowrap ${
                  totalNettoCashflow >= 0 ? 'text-green-600' : 'text-red-600'
                }`}
              >
                {formatBetrag(totalNettoCashflow)}
              </TableCell>
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
