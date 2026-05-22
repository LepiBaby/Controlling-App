'use client'

import { useState } from 'react'
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
import { type KpiCategory } from '@/hooks/use-kpi-categories'
import { type BestandTransaktion, calcEndbestand } from '@/hooks/use-bestand-transaktionen'

const fmtDate = (d: string) => new Date(d + 'T00:00:00').toLocaleDateString('de-DE')

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

  return (
    <div className="space-y-3">
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
                <TableCell className="text-right whitespace-nowrap">{t.anfangsbestand}</TableCell>
                {plattformen.map(p => {
                  const s = t.sendungen.find(s => s.plattform_id === p.id)
                  return (
                    <TableCell key={p.id} className="text-right whitespace-nowrap">
                      {s?.menge ?? 0}
                    </TableCell>
                  )
                })}
                <TableCell className="text-right whitespace-nowrap">{t.sendungen_manuell}</TableCell>
                <TableCell className="text-right whitespace-nowrap">{t.einlagerungen}</TableCell>
                <TableCell className="text-right whitespace-nowrap">{t.anpassungen_positiv}</TableCell>
                <TableCell className="text-right whitespace-nowrap">{t.anpassungen_negativ}</TableCell>
                <TableCell className="text-right whitespace-nowrap">{t.warenverluste}</TableCell>
                <TableCell
                  className={`text-right whitespace-nowrap font-semibold ${endbestand < 0 ? 'text-destructive' : ''}`}
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
  )
}
