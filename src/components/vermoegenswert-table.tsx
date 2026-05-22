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
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { Trash2 } from 'lucide-react'
import type { KpiCategory } from '@/hooks/use-kpi-categories'
import type { VermoegenswertSnapshot } from '@/hooks/use-vermoegenswerte'

const fmt = (v: number | null | undefined) =>
  new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR' }).format(v ?? 0)

const fmtDatum = (d: string) => {
  const [y, m, day] = d.split('-')
  return `${day}.${m}.${y}`
}

// ─── Farb-Klassen je Kategorie ────────────────────────────────────────────────
const COLOR = {
  warenwert:        { th: 'bg-blue-50 dark:bg-blue-950/30',    td: 'bg-blue-50/60 dark:bg-blue-950/20'    },
  verbindlichkeiten:{ th: 'bg-rose-50 dark:bg-rose-950/30',   td: 'bg-rose-50/60 dark:bg-rose-950/20'   },
  forderungen:      { th: 'bg-emerald-50 dark:bg-emerald-950/30', td: 'bg-emerald-50/60 dark:bg-emerald-950/20' },
  cash:             { th: 'bg-amber-50 dark:bg-amber-950/30',  td: 'bg-amber-50/60 dark:bg-amber-950/20' },
  anlagevermoegen:  { th: 'bg-violet-50 dark:bg-violet-950/30', td: 'bg-violet-50/60 dark:bg-violet-950/20' },
}

export type KategorieSichtbar = 'warenwert' | 'verbindlichkeiten' | 'forderungen' | 'cash' | 'anlagevermoegen'

interface Props {
  snapshots: VermoegenswertSnapshot[]
  produkte: KpiCategory[]
  plattformen: KpiCategory[]
  aktiveKategorien: Set<KategorieSichtbar>
  onDelete: (id: string) => Promise<string | null>
  onNeuErfassung: () => void
}

export function VermoegenswertTable({
  snapshots,
  produkte,
  plattformen,
  aktiveKategorien,
  onDelete,
  onNeuErfassung,
}: Props) {
  const [deleteId, setDeleteId] = useState<string | null>(null)
  const [deleting, setDeleting] = useState(false)
  const [deleteError, setDeleteError] = useState<string | null>(null)
  const [pageSize, setPageSize] = useState(50)
  const [page, setPage] = useState(1)

  const hasSteuervb = snapshots.some(
    (s) => s.steuersaldo_typ === 'verbindlichkeit' && (s.steuersaldo ?? 0) > 0
  )
  const hasSteuerford = snapshots.some(
    (s) => s.steuersaldo_typ === 'forderung' && (s.steuersaldo ?? 0) > 0
  )

  const showWarenwert       = aktiveKategorien.has('warenwert')
  const showVerbindlichkeiten = aktiveKategorien.has('verbindlichkeiten')
  const showForderungen     = aktiveKategorien.has('forderungen')
  const showCash            = aktiveKategorien.has('cash')
  const showAnlage          = aktiveKategorien.has('anlagevermoegen')

  const handleDelete = async () => {
    if (!deleteId) return
    setDeleting(true)
    setDeleteError(null)
    const err = await onDelete(deleteId)
    setDeleting(false)
    if (err) { setDeleteError(err); return }
    setDeleteId(null)
  }

  if (snapshots.length === 0) {
    return (
      <div className="flex flex-col items-center gap-4 py-16 text-center">
        <p className="text-muted-foreground">Noch keine Vermögens-Snapshots erfasst.</p>
        <Button onClick={onNeuErfassung}>+ Neue Erfassung</Button>
      </div>
    )
  }

  const sorted = [...snapshots].sort((a, b) => b.datum.localeCompare(a.datum))

  const totalPages = pageSize > 0 ? Math.max(1, Math.ceil(sorted.length / pageSize)) : 1
  const safePage   = Math.min(page, totalPages)
  const paginated  = pageSize > 0 ? sorted.slice((safePage - 1) * pageSize, safePage * pageSize) : sorted

  return (
    <>
      <div className="space-y-3">
      <div className="overflow-x-auto rounded-md border">
        <table className="min-w-max text-sm border-collapse">
          {/* Gruppen-Kopfzeile */}
          <thead>
            <tr className="border-b">
              {/* Datum spans both header rows so the column count stays consistent */}
              <th className="sticky left-0 z-10 bg-background border-r px-3 py-2 text-left text-xs font-medium whitespace-nowrap" rowSpan={2}>
                Datum
              </th>

              {showWarenwert && produkte.length > 0 && (
                <th
                  colSpan={produkte.length * 2}
                  className={`px-3 py-1 text-center text-xs font-semibold tracking-wide border-x ${COLOR.warenwert.th}`}
                >
                  Warenwert
                </th>
              )}
              {showVerbindlichkeiten && (
                <th
                  colSpan={3 + (hasSteuervb ? 1 : 0)}
                  className={`px-3 py-1 text-center text-xs font-semibold tracking-wide border-x ${COLOR.verbindlichkeiten.th}`}
                >
                  Verbindlichkeiten
                </th>
              )}
              {showForderungen && (
                <th
                  colSpan={plattformen.length + 1 + (hasSteuerford ? 1 : 0)}
                  className={`px-3 py-1 text-center text-xs font-semibold tracking-wide border-x ${COLOR.forderungen.th}`}
                >
                  Forderungen
                </th>
              )}
              {showCash && (
                <th
                  colSpan={1}
                  className={`px-3 py-1 text-center text-xs font-semibold tracking-wide border-x ${COLOR.cash.th}`}
                >
                  Cash
                </th>
              )}
              {showAnlage && (
                <th
                  colSpan={1}
                  className={`px-3 py-1 text-center text-xs font-semibold tracking-wide border-x ${COLOR.anlagevermoegen.th}`}
                >
                  Anlagevermögen
                </th>
              )}
              {/* Delete column spans both header rows */}
              <th className="px-3 py-1" rowSpan={2} />
            </tr>

            {/* Spalten-Kopfzeile — Datum and delete button column are handled by rowSpan above */}
            <tr className="border-b bg-muted/30">
              {showWarenwert && produkte.flatMap((p) => [
                <th key={`${p.id}-lager`} className={`px-3 py-2 text-right font-medium whitespace-nowrap ${COLOR.warenwert.th}`}>
                  {p.name} Lager
                </th>,
                <th key={`${p.id}-transit`} className={`px-3 py-2 text-right font-medium whitespace-nowrap ${COLOR.warenwert.th}`}>
                  {p.name} Transit
                </th>,
              ])}

              {showVerbindlichkeiten && <>
                <th className={`px-3 py-2 text-right font-medium whitespace-nowrap ${COLOR.verbindlichkeiten.th}`}>
                  L&amp;L
                </th>
                <th className={`px-3 py-2 text-right font-medium whitespace-nowrap ${COLOR.verbindlichkeiten.th}`}>
                  Sonstige
                </th>
                {hasSteuervb && (
                  <th className={`px-3 py-2 text-right font-medium whitespace-nowrap ${COLOR.verbindlichkeiten.th}`}>
                    Steuer
                  </th>
                )}
                <th className={`px-3 py-2 text-right font-medium whitespace-nowrap ${COLOR.verbindlichkeiten.th}`}>
                  Darlehen
                </th>
              </>}

              {showForderungen && <>
                {plattformen.map((pl) => (
                  <th key={pl.id} className={`px-3 py-2 text-right font-medium whitespace-nowrap ${COLOR.forderungen.th}`}>
                    {pl.name}
                  </th>
                ))}
                <th className={`px-3 py-2 text-right font-medium whitespace-nowrap ${COLOR.forderungen.th}`}>
                  Sonstige
                </th>
                {hasSteuerford && (
                  <th className={`px-3 py-2 text-right font-medium whitespace-nowrap ${COLOR.forderungen.th}`}>
                    Steuer
                  </th>
                )}
              </>}

              {showCash && (
                <th className={`px-3 py-2 text-right font-medium whitespace-nowrap ${COLOR.cash.th}`}>
                  Cash-Bestand
                </th>
              )}
              {showAnlage && (
                <th className={`px-3 py-2 text-right font-medium whitespace-nowrap ${COLOR.anlagevermoegen.th}`}>
                  Netto-Buchwert
                </th>
              )}
            </tr>
          </thead>

          <tbody>
            {paginated.map((s) => {
              const lagerMap   = Object.fromEntries(s.lagerwerte.map((l) => [l.produkt_id, l.lagerwert]))
              const transitMap = Object.fromEntries(s.transitwerte.map((t) => [t.produkt_id, t.transitwert]))
              const fordMap    = Object.fromEntries(
                s.forderungen.map((f) => [f.plattform_id ?? 'sonstige', f.betrag])
              )

              return (
                <tr key={s.id} className="border-b hover:brightness-95 transition-all">
                  <td className="sticky left-0 z-10 bg-background border-r px-3 py-2 whitespace-nowrap font-medium">
                    {fmtDatum(s.datum)}
                  </td>

                  {showWarenwert && produkte.flatMap((p) => [
                    <td key={`${p.id}-lager`} className={`px-3 py-2 text-right whitespace-nowrap tabular-nums ${COLOR.warenwert.td}`}>
                      {fmt(lagerMap[p.id] ?? 0)}
                    </td>,
                    <td key={`${p.id}-transit`} className={`px-3 py-2 text-right whitespace-nowrap tabular-nums ${COLOR.warenwert.td}`}>
                      {fmt(transitMap[p.id] ?? 0)}
                    </td>,
                  ])}

                  {showVerbindlichkeiten && <>
                    <td className={`px-3 py-2 text-right whitespace-nowrap tabular-nums ${COLOR.verbindlichkeiten.td}`}>
                      {fmt(s.verbindlichkeiten_llv)}
                    </td>
                    <td className={`px-3 py-2 text-right whitespace-nowrap tabular-nums ${COLOR.verbindlichkeiten.td}`}>
                      {fmt(s.verbindlichkeiten_sonstige)}
                    </td>
                    {hasSteuervb && (
                      <td className={`px-3 py-2 text-right whitespace-nowrap tabular-nums ${COLOR.verbindlichkeiten.td}`}>
                        {s.steuersaldo_typ === 'verbindlichkeit' ? fmt(s.steuersaldo ?? 0) : fmt(0)}
                      </td>
                    )}
                    <td className={`px-3 py-2 text-right whitespace-nowrap tabular-nums ${COLOR.verbindlichkeiten.td}`}>
                      {fmt(s.darlehensvb)}
                    </td>
                  </>}

                  {showForderungen && <>
                    {plattformen.map((pl) => (
                      <td key={pl.id} className={`px-3 py-2 text-right whitespace-nowrap tabular-nums ${COLOR.forderungen.td}`}>
                        {fmt(fordMap[pl.id] ?? 0)}
                      </td>
                    ))}
                    <td className={`px-3 py-2 text-right whitespace-nowrap tabular-nums ${COLOR.forderungen.td}`}>
                      {fmt(fordMap['sonstige'] ?? 0)}
                    </td>
                    {hasSteuerford && (
                      <td className={`px-3 py-2 text-right whitespace-nowrap tabular-nums ${COLOR.forderungen.td}`}>
                        {s.steuersaldo_typ === 'forderung' ? fmt(s.steuersaldo ?? 0) : fmt(0)}
                      </td>
                    )}
                  </>}

                  {showCash && (
                    <td className={`px-3 py-2 text-right whitespace-nowrap tabular-nums ${COLOR.cash.td} ${s.cash_bestand < 0 ? 'text-destructive font-medium' : ''}`}>
                      {fmt(s.cash_bestand)}
                    </td>
                  )}
                  {showAnlage && (
                    <td className={`px-3 py-2 text-right whitespace-nowrap tabular-nums ${COLOR.anlagevermoegen.td}`}>
                      {fmt(s.anlagevermoegen)}
                    </td>
                  )}

                  <td className="px-3 py-2">
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => { setDeleteError(null); setDeleteId(s.id) }}
                    >
                      <Trash2 className="h-4 w-4 text-muted-foreground" />
                    </Button>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
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

      <AlertDialog open={!!deleteId} onOpenChange={(v) => { if (!v) setDeleteId(null) }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Snapshot löschen?</AlertDialogTitle>
            <AlertDialogDescription>
              Dieser Vermögens-Snapshot wird unwiderruflich gelöscht.
            </AlertDialogDescription>
          </AlertDialogHeader>
          {deleteError && <p className="text-sm text-destructive px-1">{deleteError}</p>}
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Abbrechen</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} disabled={deleting}>
              {deleting ? 'Löschen…' : 'Löschen'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
