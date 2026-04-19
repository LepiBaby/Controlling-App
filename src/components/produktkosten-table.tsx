'use client'

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

  return (
    <div className="overflow-x-auto rounded-md border">
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
                return (
                  <TableCell key={k.id} className="text-right whitespace-nowrap">
                    {wert != null ? fmtEur(wert.wert) : '—'}
                  </TableCell>
                )
              })}
              <TableCell className="text-right whitespace-nowrap font-semibold">
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
  )
}
