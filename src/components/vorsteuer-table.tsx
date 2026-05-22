'use client'

import { ArrowUp, ArrowDown, ArrowUpDown } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Skeleton } from '@/components/ui/skeleton'
import { KpiCategory } from '@/hooks/use-kpi-categories'
import { VorsteuerTransaktion, VorsteuerSortColumn, SortDirection } from '@/hooks/use-vorsteuer'

function formatEuro(value: number): string {
  return new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR' }).format(value)
}

function formatDate(dateStr: string): string {
  if (!dateStr) return ''
  const [year, month, day] = dateStr.split('-')
  return `${day}.${month}.${year}`
}

function formatUstSatz(satz: string): string {
  if (satz === '100') return '100 %'
  if (satz === '19') return '19 %'
  if (satz === '7') return '7 %'
  if (satz === '0') return '0 %'
  return satz
}

function getCategoryLabel(categories: KpiCategory[], id: string | null): string {
  if (!id) return ''
  const cat = categories.find(c => c.id === id)
  if (!cat) return '[Kategorie gelöscht]'
  return cat.kosten_label ?? cat.name
}

function getCategoryName(categories: KpiCategory[], id: string | null): string {
  if (!id) return ''
  return categories.find(c => c.id === id)?.name ?? '[Kategorie gelöscht]'
}

interface SortHeaderProps {
  label: string
  column: VorsteuerSortColumn
  currentSort: VorsteuerSortColumn
  direction: SortDirection
  onSort: (col: VorsteuerSortColumn) => void
  align?: 'left' | 'right'
}

function SortHeader({ label, column, currentSort, direction, onSort, align = 'left' }: SortHeaderProps) {
  const isActive = column === currentSort
  return (
    <button
      className={`flex items-center gap-1 font-medium hover:text-foreground ${align === 'right' ? 'ml-auto' : ''}`}
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

export interface VorsteuerColumnVisibility {
  showGruppe: boolean
  showUntergruppe: boolean
}

interface VorsteuerTableProps {
  transaktionen: VorsteuerTransaktion[]
  loading: boolean
  ausgabenKategorien: KpiCategory[]
  columnVisibility: VorsteuerColumnVisibility
  total: number
  page: number
  pageSize: number
  onPageChange: (page: number) => void
  onPageSizeChange: (size: number) => void
  sortColumn: VorsteuerSortColumn
  sortDirection: SortDirection
  onSort: (col: VorsteuerSortColumn) => void
}

export function VorsteuerTable({
  transaktionen,
  loading,
  ausgabenKategorien,
  columnVisibility,
  total,
  page,
  pageSize,
  onPageChange,
  onPageSizeChange,
  sortColumn,
  sortDirection,
  onSort,
}: VorsteuerTableProps) {
  const { showGruppe, showUntergruppe } = columnVisibility
  const totalPages = pageSize > 0 ? Math.max(1, Math.ceil(total / pageSize)) : 1

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
        <p className="text-sm">Keine Transaktionen mit Vorsteuer gefunden.</p>
        <p className="text-sm">Passen Sie die Filter an oder erfassen Sie Transaktionen mit einem USt-Satz &gt; 0.</p>
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
                  label="Leistungsdatum"
                  column="leistungsdatum"
                  currentSort={sortColumn}
                  direction={sortDirection}
                  onSort={onSort}
                />
              </TableHead>
              <TableHead>Kategorie</TableHead>
              {showGruppe && <TableHead>Gruppe</TableHead>}
              {showUntergruppe && <TableHead>Untergruppe</TableHead>}
              <TableHead className="text-right">
                <SortHeader
                  label="Brutto"
                  column="betrag_brutto"
                  currentSort={sortColumn}
                  direction={sortDirection}
                  onSort={onSort}
                  align="right"
                />
              </TableHead>
              <TableHead className="text-right">Netto</TableHead>
              <TableHead className="text-right">USt-Satz</TableHead>
              <TableHead className="text-right">USt-Betrag</TableHead>
            </TableRow>
          </TableHeader>

          <TableBody>
            {transaktionen.map(t => (
              <TableRow key={t.id} className="hover:bg-muted/50">
                <TableCell className="whitespace-nowrap">{formatDate(t.leistungsdatum)}</TableCell>
                <TableCell>{getCategoryLabel(ausgabenKategorien, t.kategorie_id)}</TableCell>
                {showGruppe && (
                  <TableCell>{getCategoryName(ausgabenKategorien, t.gruppe_id)}</TableCell>
                )}
                {showUntergruppe && (
                  <TableCell>{getCategoryName(ausgabenKategorien, t.untergruppe_id)}</TableCell>
                )}
                <TableCell className="text-right font-medium whitespace-nowrap">
                  {formatEuro(Number(t.betrag_brutto))}
                </TableCell>
                <TableCell className="text-right whitespace-nowrap text-muted-foreground">
                  {formatEuro(Number(t.betrag_netto))}
                </TableCell>
                <TableCell className="text-right whitespace-nowrap text-muted-foreground">
                  {formatUstSatz(t.ust_satz)}
                </TableCell>
                <TableCell className="text-right font-medium whitespace-nowrap">
                  {formatEuro(Number(t.ust_betrag))}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <div className="flex items-center justify-between text-sm text-muted-foreground">
        <div className="flex items-center gap-2">
          <span>Zeilen pro Seite:</span>
          <Select value={String(pageSize)} onValueChange={v => onPageSizeChange(Number(v))}>
            <SelectTrigger className="h-8 w-[80px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="25">25</SelectItem>
              <SelectItem value="50">50</SelectItem>
              <SelectItem value="100">100</SelectItem>
              <SelectItem value="250">250</SelectItem>
              <SelectItem value="0">Alle</SelectItem>
            </SelectContent>
          </Select>
        </div>
        {pageSize > 0 && totalPages > 1 && (
          <div className="flex items-center gap-2">
            <span>Seite {page} von {totalPages}</span>
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
        )}
      </div>
    </div>
  )
}
