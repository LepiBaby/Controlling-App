'use client'

import { useState, useRef, useEffect } from 'react'
import { Button } from '@/components/ui/button'
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
import { type ProduktkostenZeitraum } from '@/hooks/use-produktkosten'

const fmtNum = new Intl.NumberFormat('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
const fmtEur = (n: number) => fmtNum.format(n) + ' €'
const fmtDate = (d: string | null) => d ? new Date(d + 'T00:00:00').toLocaleDateString('de-DE') : '—'

interface Props {
  zeitraeume: ProduktkostenZeitraum[]
  kostenkategorien: KpiCategory[]
  loading: boolean
  onEdit: (z: ProduktkostenZeitraum) => void
  onDelete: (id: string) => void
}

export function ProduktkostenTable({ zeitraeume, kostenkategorien, loading, onEdit, onDelete }: Props) {
  const [selectedCells, setSelectedCells] = useState<Map<string, number>>(new Map())
  const summe = Array.from(selectedCells.values()).reduce((a, b) => a + b, 0)
  const isDragging = useRef(false)

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

  if (zeitraeume.length === 0) {
    return (
      <div className="rounded-lg border bg-muted/30 p-8 text-center text-sm text-muted-foreground">
        Noch keine Kostenzeiträume vorhanden. Klicke auf „+ Neuer Zeitraum" um zu beginnen.
      </div>
    )
  }

  const sorted = [...zeitraeume].sort((a, b) => a.gueltig_von.localeCompare(b.gueltig_von))

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
    <div data-betrag-selektion="true" className="overflow-x-auto rounded-md border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="whitespace-nowrap">Gültig von</TableHead>
            <TableHead className="whitespace-nowrap">Gültig bis</TableHead>
            {kostenkategorien.map(k => (
              <TableHead key={k.id} className="text-right whitespace-nowrap">{k.name}</TableHead>
            ))}
            <TableHead className="text-right whitespace-nowrap font-semibold">Gesamt</TableHead>
            <TableHead className="w-20" />
          </TableRow>
        </TableHeader>
        <TableBody>
          {sorted.map(z => {
            const gesamt = z.werte.reduce((sum, w) => sum + w.wert, 0)
            return (
            <TableRow key={z.id}>
              <TableCell className="whitespace-nowrap">{fmtDate(z.gueltig_von)}</TableCell>
              <TableCell className="whitespace-nowrap">{fmtDate(z.gueltig_bis)}</TableCell>
              {kostenkategorien.map(k => {
                const wert = z.werte.find(w => w.kategorie_id === k.id)
                if (wert == null) {
                  return (
                    <TableCell key={k.id} className="text-right whitespace-nowrap">
                      —
                    </TableCell>
                  )
                }
                const cellKey = `${z.id}_${k.id}`
                return (
                  <TableCell
                    key={k.id}
                    className={selClass(cellKey)}
                    onMouseDown={e => handleCellMouseDown(e, cellKey, wert.wert)}
                    onMouseEnter={() => handleCellMouseEnter(cellKey, wert.wert)}
                  >
                    {fmtEur(wert.wert)}
                  </TableCell>
                )
              })}
              <TableCell
                className={cn(selClass(`${z.id}_gesamt`), 'font-semibold')}
                onMouseDown={e => handleCellMouseDown(e, `${z.id}_gesamt`, gesamt)}
                onMouseEnter={() => handleCellMouseEnter(`${z.id}_gesamt`, gesamt)}
              >
                {fmtEur(gesamt)}
              </TableCell>
              <TableCell>
                <div className="flex gap-1">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7"
                    onClick={() => onEdit(z)}
                    aria-label="Bearbeiten"
                  >
                    <Pencil className="h-3.5 w-3.5" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7 text-destructive hover:text-destructive"
                    onClick={() => onDelete(z.id)}
                    aria-label="Löschen"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </TableCell>
            </TableRow>
          )})}
        </TableBody>
      </Table>
    </div>

    {selectedCells.size > 0 && (
      <div
        data-betrag-selektion="true"
        className="fixed bottom-6 right-6 z-50 flex flex-col gap-1 rounded-lg border bg-background px-4 py-2.5 shadow-lg text-sm"
      >
        <div className="flex items-center gap-3">
          <span className="text-muted-foreground">{selectedCells.size} Feld{selectedCells.size !== 1 ? 'er' : ''}</span>
          <div className="h-4 w-px bg-border" />
          <span className="font-semibold tabular-nums">Summe: {fmtEur(summe)}</span>
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