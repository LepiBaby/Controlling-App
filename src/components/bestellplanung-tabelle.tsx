'use client'

import { useState } from 'react'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
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
import { Play, Trash2 } from 'lucide-react'
import {
  useBestellungen,
  berechneGesamtmenge,
  berechneAktuellenStatus,
  type Bestellung,
} from '@/hooks/use-bestellungen'
import { BestellungDetailDialog } from '@/components/bestellung-detail-dialog'
import { PlanbestelllaufWizard } from '@/components/planbestelllauf-wizard'
import { useToast } from '@/hooks/use-toast'
import { format, parseISO } from 'date-fns'
import { de } from 'date-fns/locale'

function formatDatum(d: string | null): string {
  if (!d) return '—'
  try {
    return format(parseISO(d), 'dd.MM.yyyy', { locale: de })
  } catch {
    return d
  }
}

const AKTUELLLER_STATUS_FARBE: Record<string, string> = {
  Verfügbar: 'bg-green-100 text-green-800',
  'In Einlagerung': 'bg-blue-100 text-blue-800',
  Unterwegs: 'bg-cyan-100 text-cyan-800',
  'Bereit zum Versand': 'bg-purple-100 text-purple-800',
  'In Produktion': 'bg-orange-100 text-orange-800',
  Bestellt: 'bg-gray-100 text-gray-800',
}

function BestellungZeile({
  bestellung,
  zeigeLaufenderStatus,
  onClick,
  onDelete,
}: {
  bestellung: Bestellung
  zeigeLaufenderStatus: boolean
  onClick: () => void
  onDelete: (e: React.MouseEvent) => void
}) {
  const produktNamen = bestellung.produkte.map((p) => p.produkt_name).join(', ')
  const gesamtmenge = berechneGesamtmenge(bestellung)

  return (
    <tr
      className="border-b hover:bg-muted/40 cursor-pointer"
      onClick={onClick}
    >
      <td className="px-4 py-3 text-sm font-medium">{formatDatum(bestellung.bestelldatum)}</td>
      <td className="px-4 py-3 text-sm text-muted-foreground max-w-[280px] truncate">
        {produktNamen || '—'}
      </td>
      <td className="px-4 py-3 text-sm">{gesamtmenge > 0 ? gesamtmenge.toLocaleString('de-DE') : '—'}</td>
      <td className="px-4 py-3 text-sm">{formatDatum(bestellung.ankunftsdatum)}</td>
      <td className="px-4 py-3 text-sm">{formatDatum(bestellung.verfuegbarkeitsdatum)}</td>
      {zeigeLaufenderStatus && (
        <td className="px-4 py-3">
          {(() => {
            const status = berechneAktuellenStatus(bestellung)
            return (
              <span
                className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${AKTUELLLER_STATUS_FARBE[status] ?? 'bg-gray-100 text-gray-800'}`}
              >
                {status}
              </span>
            )
          })()}
        </td>
      )}
      {bestellung.status === 'abgeschlossen' && (
        <td className="px-4 py-3 text-sm text-muted-foreground">
          {formatDatum(bestellung.abgeschlossen_am)}
        </td>
      )}
      <td className="px-4 py-3">
        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7 text-muted-foreground hover:text-destructive"
              onClick={(e) => e.stopPropagation()}
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Bestellung löschen?</AlertDialogTitle>
              <AlertDialogDescription>
                Diese Bestellung wird endgültig gelöscht. Diese Aktion kann nicht rückgängig gemacht
                werden.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel onClick={(e) => e.stopPropagation()}>Abbrechen</AlertDialogCancel>
              <AlertDialogAction
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                onClick={(e) => {
                  e.stopPropagation()
                  onDelete(e)
                }}
              >
                Löschen
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </td>
    </tr>
  )
}

function LadeSkeleton() {
  return (
    <div className="space-y-2">
      {Array.from({ length: 5 }).map((_, i) => (
        <Skeleton key={i} className="h-10 w-full" />
      ))}
    </div>
  )
}

function LeererZustand({ text }: { text: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center text-muted-foreground">
      <p className="text-sm">{text}</p>
    </div>
  )
}

function BestellungenTabelle({
  status,
  zeigeLaufenderStatus,
  onBestellungGeaendert,
}: {
  status: 'plan' | 'laufend' | 'abgeschlossen'
  zeigeLaufenderStatus: boolean
  onBestellungGeaendert?: () => void
}) {
  const { bestellungen, loading, error, reload, update, remove, changeStatus } =
    useBestellungen(status)
  const [ausgewaehlteBestellung, setAusgewaehlteBestellung] = useState<Bestellung | null>(null)
  const [detailOffen, setDetailOffen] = useState(false)
  const { toast } = useToast()

  async function handleDelete(id: string) {
    try {
      await remove(id)
      toast({ title: 'Bestellung gelöscht' })
    } catch {
      toast({ title: 'Fehler beim Löschen', variant: 'destructive' })
    }
  }

  async function handleUpdate(id: string, patch: Partial<Bestellung>): Promise<Bestellung> {
    try {
      return await update(id, patch)
    } catch {
      toast({ title: 'Fehler beim Speichern', variant: 'destructive' })
      throw new Error('Speichern fehlgeschlagen')
    }
  }

  async function handleChangeStatus(id: string, newStatus: 'plan' | 'laufend' | 'abgeschlossen'): Promise<Bestellung> {
    const result = await changeStatus(id, newStatus)
    setDetailOffen(false)
    onBestellungGeaendert?.()
    toast({
      title:
        newStatus === 'laufend'
          ? 'Bestellung gestartet'
          : 'Bestellung abgeschlossen',
    })
    return result
  }

  if (loading) return <LadeSkeleton />
  if (error)
    return (
      <div className="rounded-md border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive">
        Fehler beim Laden: {error}
      </div>
    )
  if (bestellungen.length === 0) {
    const texte = {
      plan: 'Keine Planbestellungen vorhanden. Führe den Planbestelllauf durch, um Bestellungen zu generieren.',
      laufend: 'Keine laufenden Bestellungen vorhanden.',
      abgeschlossen: 'Keine abgeschlossenen Bestellungen vorhanden.',
    }
    return <LeererZustand text={texte[status]} />
  }

  const spaltenKopf =
    status === 'laufend' ? (
      <tr className="border-b bg-muted/30">
        <th className="px-4 py-2.5 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Bestelldatum
        </th>
        <th className="px-4 py-2.5 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Produkte
        </th>
        <th className="px-4 py-2.5 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Gesamtmenge
        </th>
        <th className="px-4 py-2.5 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Ankunft
        </th>
        <th className="px-4 py-2.5 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Verfügbar ab
        </th>
        <th className="px-4 py-2.5 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Status
        </th>
        <th className="px-4 py-2.5" />
      </tr>
    ) : status === 'abgeschlossen' ? (
      <tr className="border-b bg-muted/30">
        <th className="px-4 py-2.5 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Bestelldatum
        </th>
        <th className="px-4 py-2.5 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Produkte
        </th>
        <th className="px-4 py-2.5 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Gesamtmenge
        </th>
        <th className="px-4 py-2.5 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Ankunft
        </th>
        <th className="px-4 py-2.5 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Verfügbar ab
        </th>
        <th className="px-4 py-2.5 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Abgeschlossen am
        </th>
        <th className="px-4 py-2.5" />
      </tr>
    ) : (
      <tr className="border-b bg-muted/30">
        <th className="px-4 py-2.5 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Bestelldatum
        </th>
        <th className="px-4 py-2.5 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Produkte
        </th>
        <th className="px-4 py-2.5 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Gesamtmenge
        </th>
        <th className="px-4 py-2.5 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Ankunft
        </th>
        <th className="px-4 py-2.5 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Verfügbar ab
        </th>
        <th className="px-4 py-2.5" />
      </tr>
    )

  return (
    <>
      <div className="overflow-x-auto rounded-md border">
        <table className="w-full text-sm">
          <thead>{spaltenKopf}</thead>
          <tbody>
            {bestellungen.map((b) => (
              <BestellungZeile
                key={b.id}
                bestellung={b}
                zeigeLaufenderStatus={zeigeLaufenderStatus}
                onClick={() => {
                  setAusgewaehlteBestellung(b)
                  setDetailOffen(true)
                }}
                onDelete={() => handleDelete(b.id)}
              />
            ))}
          </tbody>
        </table>
      </div>

      {ausgewaehlteBestellung && (
        <BestellungDetailDialog
          bestellung={ausgewaehlteBestellung}
          open={detailOffen}
          onOpenChange={(open) => {
            setDetailOffen(open)
            if (!open) reload()
          }}
          onUpdate={handleUpdate}
          onDelete={async (id) => {
            await handleDelete(id)
            setDetailOffen(false)
          }}
          onChangeStatus={handleChangeStatus}
        />
      )}
    </>
  )
}

export function BestellplanungTabelle() {
  const [wizardOffen, setWizardOffen] = useState(false)
  const [planReloadKey, setPlanReloadKey] = useState(0)
  const [laufendReloadKey, setLaufendReloadKey] = useState(0)

  function handleWizardComplete() {
    setPlanReloadKey((k) => k + 1)
  }

  return (
    <div className="space-y-4">
      <Tabs defaultValue="plan">
        <div className="flex items-center justify-between">
          <TabsList>
            <TabsTrigger value="plan">Planbestellungen</TabsTrigger>
            <TabsTrigger value="laufend">Laufende Bestellungen</TabsTrigger>
            <TabsTrigger value="abgeschlossen">Abgeschlossene Bestellungen</TabsTrigger>
          </TabsList>
        </div>

        <TabsContent value="plan" className="mt-4 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-base font-semibold">Planbestellungen</h2>
              <p className="text-sm text-muted-foreground">
                Geplante Bestellungen, die noch nicht ausgelöst wurden
              </p>
            </div>
            <Button onClick={() => setWizardOffen(true)} className="gap-2">
              <Play className="h-4 w-4" />
              Planbestelllauf durchführen
            </Button>
          </div>
          <BestellungenTabelle
            key={planReloadKey}
            status="plan"
            zeigeLaufenderStatus={false}
            onBestellungGeaendert={() => setLaufendReloadKey((k) => k + 1)}
          />
        </TabsContent>

        <TabsContent value="laufend" className="mt-4 space-y-4">
          <div>
            <h2 className="text-base font-semibold">Laufende Bestellungen</h2>
            <p className="text-sm text-muted-foreground">
              Bereits ausgelöste Bestellungen mit aktuellem Produktionsstatus
            </p>
          </div>
          <BestellungenTabelle
            key={laufendReloadKey}
            status="laufend"
            zeigeLaufenderStatus={true}
            onBestellungGeaendert={() => {}}
          />
        </TabsContent>

        <TabsContent value="abgeschlossen" className="mt-4 space-y-4">
          <div>
            <h2 className="text-base font-semibold">Abgeschlossene Bestellungen</h2>
            <p className="text-sm text-muted-foreground">
              Vollständig abgewickelte Bestellungen zur Übersicht
            </p>
          </div>
          <BestellungenTabelle
            status="abgeschlossen"
            zeigeLaufenderStatus={false}
          />
        </TabsContent>
      </Tabs>

      <PlanbestelllaufWizard
        open={wizardOffen}
        onOpenChange={setWizardOffen}
        onComplete={handleWizardComplete}
      />
    </div>
  )
}
