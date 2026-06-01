'use client'

import { useState, useRef, useEffect } from 'react'
import { ArrowUp, ArrowDown, ArrowUpDown } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
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
  TableFooter,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Skeleton } from '@/components/ui/skeleton'
import { KpiCategory } from '@/hooks/use-kpi-categories'
import {
  RentabilitaetZeile,
  RentabilitaetColumnVisibility,
  RentabilitaetSortColumn,
  SortDirection,
} from '@/hooks/use-rentabilitaet'

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

function getCategoryDisplayName(categories: KpiCategory[], id: string | null, labelType: 'kosten' | null): string {
  if (!id) return ''
  const cat = categories.find(c => c.id === id)
  if (!cat) return '[Kategorie gelöscht]'
  if (labelType === 'kosten' && cat.kosten_label) return cat.kosten_label
  return cat.name
}

interface SortHeaderProps {
  label: string
  column: RentabilitaetSortColumn
  currentSort: RentabilitaetSortColumn
  direction: SortDirection
  onSort: (col: RentabilitaetSortColumn) => void
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

interface RentabilitaetTableProps {
  zeilen: RentabilitaetZeile[]
  loading: boolean
  columnVisibility: RentabilitaetColumnVisibility
  kpiCategories: KpiCategory[]
  salesPlattformen: KpiCategory[]
  produkte: KpiCategory[]
  total: number
  totalNetto: number
  page: number
  pageSize: number
  onPageChange: (page: number) => void
  onPageSizeChange: (size: number) => void
  sortColumn: RentabilitaetSortColumn
  sortDirection: SortDirection
  onSort: (col: RentabilitaetSortColumn) => void
}

export function RentabilitaetTable({
  zeilen,
  loading,
  columnVisibility,
  kpiCategories,
  salesPlattformen,
  produkte,
  total,
  totalNetto,
  page,
  pageSize,
  onPageChange,
  onPageSizeChange,
  sortColumn,
  sortDirection,
  onSort,
}: RentabilitaetTableProps) {
  const { showGruppe, showUntergruppe, showSalesPlattform, showProdukte } = columnVisibility

  const totalPages = pageSize > 0 ? Math.max(1, Math.ceil(total / pageSize)) : 1

  // Fixed columns: Leistungsdatum + Quelle + Kategorie + Beschreibung + Betrag = 5
  // Dynamic columns: Gruppe + Untergruppe + SalesPlattform + Produkte
  const optionalCount = [showGruppe, showUntergruppe, showSalesPlattform, showProdukte].filter(Boolean).length
  const totalColumns = 5 + optionalCount

  const [selectedCells, setSelectedCells] = useState<Map<string, number>>(new Map())
  const isDragging = useRef(false)
  const selSum = Array.from(selectedCells.values()).reduce((a, b) => a + b, 0)

  useEffect(() => { setSelectedCells(new Map()) }, [page])

  useEffect(() => {
    function onMouseDown(e: MouseEvent) {
      if (!(e.target as Element).closest('[data-betrag-selektion]')) {
        setSelectedCells(new Map())
      }
    }
    function onMouseUp() { isDragging.current = false }
    document.addEventListener('mousedown', onMouseDown)
    document.addEventListener('mouseup', onMouseUp)
    return () => {
      document.removeEventListener('mousedown', onMouseDown)
      document.removeEventListener('mouseup', onMouseUp)
    }
  }, [])

  function handleCellMouseDown(e: React.MouseEvent, key: string, value: number) {
    if (e.button !== 0) return
    e.preventDefault()
    e.stopPropagation()
    isDragging.current = true
    const multi = e.ctrlKey || e.metaKey
    setSelectedCells(prev => {
      if (prev.has(key)) {
        const next = new Map(prev)
        next.delete(key)
        return next
      }
      if (multi) return new Map([...prev, [key, value]])
      return new Map([[key, value]])
    })
  }

  function handleCellMouseEnter(key: string, value: number) {
    if (!isDragging.current) return
    setSelectedCells(prev => prev.has(key) ? prev : new Map([...prev, [key, value]]))
  }

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
    <>
    <div data-betrag-selektion="true" className="space-y-4">
      <div className="rounded-md border overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>
                <SortHeader label="Leistungsdatum" column="leistungsdatum" currentSort={sortColumn} direction={sortDirection} onSort={onSort} />
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
              const isUmsatz = z.quelle === 'umsatz'
              const labelType = isUmsatz ? null : 'kosten'
              const effectiveBetrag = Number(z.betrag)
              return (
                <TableRow key={`${z.quelle}-${z.id}`} className="hover:bg-muted/50">
                  <TableCell className="whitespace-nowrap">{formatDate(z.leistungsdatum)}</TableCell>
                  <TableCell>
                    {isUmsatz ? (
                      <Badge
                        variant="default"
                        className="bg-green-600 hover:bg-green-600/90 text-white"
                      >
                        Umsatz
                      </Badge>
                    ) : (
                      <Badge variant="destructive">Kosten</Badge>
                    )}
                  </TableCell>
                  <TableCell>{getCategoryDisplayName(kpiCategories, z.kategorie_id, labelType)}</TableCell>
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
                    className={`text-right font-medium whitespace-nowrap cursor-pointer select-none ${
                      selectedCells.has(`${z.quelle}-${z.id}_betrag`)
                        ? 'bg-blue-100 dark:bg-blue-900/40'
                        : `hover:bg-blue-50 dark:hover:bg-blue-950/20 ${effectiveBetrag >= 0 ? 'text-green-600' : 'text-red-600'}`
                    }`}
                    onMouseDown={e => handleCellMouseDown(e, `${z.quelle}-${z.id}_betrag`, effectiveBetrag)}
                    onMouseEnter={() => handleCellMouseEnter(`${z.quelle}-${z.id}_betrag`, effectiveBetrag)}
                  >
                    {formatBetrag(effectiveBetrag)}
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
                Netto-Ergebnis:
              </TableCell>
              <TableCell
                className={`text-right font-semibold whitespace-nowrap ${
                  totalNetto >= 0 ? 'text-green-600' : 'text-red-600'
                }`}
              >
                {formatBetrag(totalNetto)}
              </TableCell>
            </TableRow>
          </TableFooter>
        </Table>
      </div>

      {/* Pagination */}
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

      {selectedCells.size > 0 && (
        <div
          data-betrag-selektion="true"
          className="fixed bottom-6 right-6 z-50 flex items-center gap-3 rounded-lg border bg-background px-4 py-2.5 shadow-lg text-sm"
        >
          <span className="text-muted-foreground">{selectedCells.size} Feld{selectedCells.size !== 1 ? 'er' : ''}</span>
          <div className="h-4 w-px bg-border" />
          <span className="font-semibold tabular-nums">Summe: {formatBetrag(selSum)}</span>
          <button
            className="ml-1 text-muted-foreground hover:text-foreground"
            onClick={() => setSelectedCells(new Map())}
            aria-label="Auswahl aufheben"
          >
            ✕
          </button>
        </div>
      )}
    </>
  )
}
