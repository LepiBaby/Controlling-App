'use client'

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog'
import {
  type OperativeFixkostenEintrag,
  berechneNettoMonatlich,
  formatFaelligkeitsMonate,
  getKalenderwoche,
  ZAHLUNGSFREQUENZ_LABELS,
  ZEITPUNKT_LABELS,
} from '@/hooks/use-operative-fixkosten'

const EUR = new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR' })

interface Props {
  eintraege: OperativeFixkostenEintrag[]
  onEdit: (eintrag: OperativeFixkostenEintrag) => void
  onDelete: (id: string) => Promise<void>
}

export function OperativeFixkostenTabelle({ eintraege, onEdit, onDelete }: Props) {
  if (eintraege.length === 0) {
    return (
      <p className="text-sm text-muted-foreground py-8 text-center">
        Keine Einträge vorhanden.
      </p>
    )
  }

  return (
    <div className="overflow-x-auto rounded-md border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Gruppe</TableHead>
            <TableHead>Untergruppe</TableHead>
            <TableHead>Name</TableHead>
            <TableHead>Frequenz</TableHead>
            <TableHead>Fälligkeitsmonat(e)</TableHead>
            <TableHead>Zeitpunkt</TableHead>
            <TableHead className="text-right">Zahlungsziel</TableHead>
            <TableHead className="text-right">Brutto</TableHead>
            <TableHead className="text-right">Netto</TableHead>
            <TableHead className="text-right">Netto mtl.</TableHead>
            <TableHead>Aktiv-Zeitraum</TableHead>
            <TableHead>Aktiv</TableHead>
            <TableHead className="w-[130px]">Aktionen</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {eintraege.map(e => (
            <TableRow key={e.id}>
              <TableCell className="font-medium">{e.kategorie_name}</TableCell>
              <TableCell className="text-muted-foreground">{e.untergruppe_name ?? '–'}</TableCell>
              <TableCell>{e.name}</TableCell>
              <TableCell>{ZAHLUNGSFREQUENZ_LABELS[e.zahlungsfrequenz]}</TableCell>
              <TableCell className="text-sm text-muted-foreground">
                {formatFaelligkeitsMonate(e.faelligkeits_monate, e.zahlungsfrequenz)}
              </TableCell>
              <TableCell>{ZEITPUNKT_LABELS[e.zeitpunkt_im_monat]}</TableCell>
              <TableCell className="text-right tabular-nums text-muted-foreground">
                {e.zahlungsziel_tage != null ? `${e.zahlungsziel_tage} Tage` : '–'}
              </TableCell>
              <TableCell className="text-right tabular-nums">
                {EUR.format(e.bruttobetrag)}
              </TableCell>
              <TableCell className="text-right tabular-nums">
                {EUR.format(e.betrag_netto)}
              </TableCell>
              <TableCell className="text-right tabular-nums font-medium">
                {EUR.format(berechneNettoMonatlich(e.betrag_netto, e.zahlungsfrequenz))}
              </TableCell>
              <TableCell className="text-sm text-muted-foreground whitespace-nowrap">
                {e.aktiv_von || e.aktiv_bis ? (
                  <span>
                    {getKalenderwoche(e.aktiv_von) ?? '–'}
                    {' → '}
                    {getKalenderwoche(e.aktiv_bis) ?? '–'}
                  </span>
                ) : (
                  <span className="text-xs">Unbegrenzt</span>
                )}
              </TableCell>
              <TableCell>
                <Badge variant={e.aktiv ? 'default' : 'secondary'}>
                  {e.aktiv ? 'Aktiv' : 'Inaktiv'}
                </Badge>
              </TableCell>
              <TableCell>
                <div className="flex gap-1">
                  <Button size="sm" variant="outline" onClick={() => onEdit(e)}>
                    Bearbeiten
                  </Button>
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button size="sm" variant="ghost" className="text-destructive hover:text-destructive">
                        Löschen
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Fixkosteneintrag löschen?</AlertDialogTitle>
                        <AlertDialogDescription>
                          Soll der Eintrag „{e.name}" wirklich gelöscht werden? Diese Aktion kann nicht rückgängig gemacht werden.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Abbrechen</AlertDialogCancel>
                        <AlertDialogAction
                          className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                          onClick={() => onDelete(e.id)}
                        >
                          Löschen
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </div>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  )
}
