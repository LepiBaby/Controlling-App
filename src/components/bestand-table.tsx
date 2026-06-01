'use client'

import { useState, useRef, useEffect } from 'react'
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
import { Pencil, Trash2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import { type KpiCategory } from '@/hooks/use-kpi-categories'
import { type BestandTransaktion, calcEndbestand } from '@/hooks/use-bestand-transaktionen'

const fmtDate = (d: string) => new Date(d + 'T00:00:00').toLocaleDateString('de-DE')
const fmtSumme = (n: number) => new Intl.NumberFormat('de-DE', { maximumFractionDigits: 2 }).format(n)

interface Props {
  transaktionen: BestandTransaktion[]
  plattformen: KpiCategory[]
  loading: boolean
  filterVon: string
  filterBis: string
  onEdit: (t: BestandTransaktion) => void
  onDelete: (id: string) => void
}

export function BestandTable({
  transaktionen,
  plattformen,
  loading,
  filterVon,
  filterBis,
  onEdit,
  onDelete,
}: Props) {
  const [pageSize, setPageSize] = useState(50)
  const [page, setPage] = useState(1)
  const [selectedCells, setSelectedCells] = useState<Map<string, number>>(new Map())
  const summe = Array.from(selectedCells.values()).reduce((a, b) => a + b, 0)
  const isDragging = useRef(false)

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

  if (loading) {
    return <div className="py-8 text-center text-sm text-muted-foreground">Laden…</div>
  }

  const filtered = [...transaktionen]
    .filter(t => {
      if (filterVon && t.datum < filterVon) return false
      if (filterBis && t.datum > filterBis) return false
      return true
    })
    .sort((a, b) => b.datum.localeCompare(a.datum))

  const totalPages = pageSize > 0 ? Math.max(1, Math.ceil(filtered.length / pageSize)) : 1
  const safePage   = Math.min(page, totalPages)
  const paginated  = pageSize > 0 ? filtered.slice((safePage - 1) * pageSize, safePage * pageSize) : filtered

  if (filtered.length === 0) {
    const hasFilter = filterVon || filterBis
    return (
      <div className="rounded-lg border bg-muted/30 p-8 text-center text-sm text-muted-foreground">
        {hasFilter
          ? 'Keine Einträge im gewählten Zeitraum.'
          : 'Noch keine Transaktionen vorhanden. Klicke auf „+ Neue Transaktion" um zu beginnen.'}
      </div>
    )
  }

  function selClass(key: string) {
    return cn(
      'text-right whitespace-nowrap cursor-pointer select-none',
      selectedCells.has(key)
        ? 'bg-blue-100 dark:bg-blue-900/40'
        : 'hover:bg-blue-50 dark:hover:bg-blue-950/20'
    )
  }

  return (
    <>
    <div data-betrag-selektion="true" className="space-y-3">
    <div className="overflow-x-auto rounded-md border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="whitespace-nowrap">Datum</TableHead>
            <TableHead className="text-right whitespace-nowrap">Anfangsbestand</TableHead>
            {plattformen.map(p => (
              <TableHead key={p.id} className="text-right whitespace-nowrap">{p.name}</TableHead>
            ))}
            <TableHead className="text-right whitespace-nowrap">Sendungen Manuell</TableHead>
            <TableHead className="text-right whitespace-nowrap">Einlagerungen</TableHead>
            <TableHead className="text-right whitespace-nowrap">Anp.+</TableHead>
            <TableHead className="text-right whitespace-nowrap">Anp.−</TableHead>
            <TableHead className="text-right whitespace-nowrap">Warenverluste</TableHead>
            <TableHead className="text-right whitespace-nowrap font-semibold">Endbestand</TableHead>
            <TableHead className="w-20" />
          </TableRow>
        </TableHeader>
        <TableBody>
          {paginated.map(t => {
            const endbestand = calcEndbestand(t)
            return (
              <TableRow key={t.id}>
                <TableCell className="whitespace-nowrap">{fmtDate(t.datum)}</TableCell>
                <TableCell
                  className={selClass(`${t.id}_anfangsbestand`)}
                  onMouseDown={e => handleCellMouseDown(e, `${t.id}_anfangsbestand`, t.anfangsbestand)}
                  onMouseEnter={() => handleCellMouseEnter(`${t.id}_anfangsbestand`, t.anfangsbestand)}
                >
                  {t.anfangsbestand}
                </TableCell>
                {plattformen.map(p => {
                  const menge = t.sendungen.find(s => s.plattform_id === p.id)?.menge ?? 0
                  return (
                    <TableCell
                      key={p.id}
                      className={selClass(`${t.id}_plattform_${p.id}`)}
                      onMouseDown={e => handleCellMouseDown(e, `${t.id}_plattform_${p.id}`, menge)}
                      onMouseEnter={() => handleCellMouseEnter(`${t.id}_plattform_${p.id}`, menge)}
                    >
                      {menge}
                    </TableCell>
                  )
                })}
                <TableCell
                  className={selClass(`${t.id}_sendungen_manuell`)}
                  onMouseDown={e => handleCellMouseDown(e, `${t.id}_sendungen_manuell`, t.sendungen_manuell)}
                  onMouseEnter={() => handleCellMouseEnter(`${t.id}_sendungen_manuell`, t.sendungen_manuell)}
                >
                  {t.sendungen_manuell}
                </TableCell>
                <TableCell
                  className={selClass(`${t.id}_einlagerungen`)}
                  onMouseDown={e => handleCellMouseDown(e, `${t.id}_einlagerungen`, t.einlagerungen)}
                  onMouseEnter={() => handleCellMouseEnter(`${t.id}_einlagerungen`, t.einlagerungen)}
                >
                  {t.einlagerungen}
                </TableCell>
                <TableCell
                  className={selClass(`${t.id}_anpassungen_positiv`)}
                  onMouseDown={e => handleCellMouseDown(e, `${t.id}_anpassungen_positiv`, t.anpassungen_positiv)}
                  onMouseEnter={() => handleCellMouseEnter(`${t.id}_anpassungen_positiv`, t.anpassungen_positiv)}
                >
                  {t.anpassungen_positiv}
                </TableCell>
                <TableCell
                  className={selClass(`${t.id}_anpassungen_negativ`)}
                  onMouseDown={e => handleCellMouseDown(e, `${t.id}_anpassungen_negativ`, t.anpassungen_negativ)}
                  onMouseEnter={() => handleCellMouseEnter(`${t.id}_anpassungen_negativ`, t.anpassungen_negativ)}
                >
                  {t.anpassungen_negativ}
                </TableCell>
                <TableCell
                  className={selClass(`${t.id}_warenverluste`)}
                  onMouseDown={e => handleCellMouseDown(e, `${t.id}_warenverluste`, t.warenverluste)}
                  onMouseEnter={() => handleCellMouseEnter(`${t.id}_warenverluste`, t.warenverluste)}
                >
                  {t.warenverluste}
                </TableCell>
                <TableCell
                  className={cn(
                    selClass(`${t.id}_endbestand`),
                    'font-semibold',
                    endbestand < 0 ? 'text-destructive' : ''
                  )}
                  onMouseDown={e => handleCellMouseDown(e, `${t.id}_endbestand`, endbestand)}
                  onMouseEnter={() => handleCellMouseEnter(`${t.id}_endbestand`, endbestand)}
                >
                  {endbestand}
                </TableCell>
                <TableCell>
                  <div className="flex gap-1">
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
          })}
        </TableBody>
      </Table>
    </div>

    <div className="flex items-center justify-between text-sm text-muted-foreground">
      <div className="flex items-center gap-2">
        <span>Zeilen pro Seite:</span>
        <Select value={String(pageSize)} onValueChange={v => { setPageSize(Number(v)); setPage(1) }}>
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
          <span>Seite {safePage} von {totalPages}</span>
          <Button variant="outline" size="sm" disabled={safePage <= 1} onClick={() => setPage(p => Math.max(1, p - 1))}>
            Zurück
          </Button>
          <Button variant="outline" size="sm" disabled={safePage >= totalPages} onClick={() => setPage(p => Math.min(totalPages, p + 1))}>
            Weiter
          </Button>
        </div>
      )}
    </div>
    </div>

    {selectedCells.size > 0 && (
      <div
        data-betrag-selektion="true"
        className="fixed bottom-6 right-6 z-50 flex flex-col gap-1 rounded-lg border bg-background px-4 py-2.5 shadow-lg text-sm"
      >
        <div className="flex items-center gap-3">
          <span className="text-muted-foreground">{selectedCells.size} Feld{selectedCells.size !== 1 ? 'er' : ''}</span>
          <div className="h-4 w-px bg-border" />
          <span className="font-semibold tabular-nums">Summe: {fmtSumme(summe)}</span>
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
    </>
  )
}