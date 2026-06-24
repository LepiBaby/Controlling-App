'use client'

import { useState, Fragment } from 'react'
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
import { Play, Trash2, Loader2, AlertTriangle, PackagePlus, ArrowRightCircle, CheckCircle2 } from 'lucide-react'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import {
  useBestellungen,
  berechneGesamtmenge,
  berechneAktuellenStatus,
  type Bestellung,
  type BestellungStatus,
} from '@/hooks/use-bestellungen'
import { BestellungDetailDialog } from '@/components/bestellung-detail-dialog'
import { PlanbestelllaufWizard } from '@/components/planbestelllauf-wizard'
import { ErstplanbestellungDialog } from '@/components/erstplanbestellung-dialog'
import { useToast } from '@/hooks/use-toast'
import { useProduktinformationenLieferzeit } from '@/hooks/use-produktinformationen-lieferzeit'
import { format, parseISO, differenceInDays } from 'date-fns'
import { de } from 'date-fns/locale'

function formatDatum(d: string | null): string {
  if (!d) return '—'
  try {
    return format(parseISO(d), 'dd.MM.yyyy', { locale: de })
  } catch {
    return d
  }
}

function bestelldatumFarbe(bestelldatum: string | null): string {
  if (!bestelldatum) return ''
  try {
    const heute = new Date()
    heute.setHours(0, 0, 0, 0)
    const datum = parseISO(bestelldatum)
    const tage = differenceInDays(datum, heute)
    if (tage < 0) return 'bg-red-100 text-red-700'
    if (tage <= 7) return 'bg-orange-100 text-orange-700'
    if (tage <= 30) return 'bg-amber-100 text-amber-700'
    if (tage <= 90) return 'bg-blue-50 text-blue-700'
    return 'bg-green-50 text-green-700'
  } catch {
    return ''
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

export function BestellungFortschritt({ bestellung }: { bestellung: Bestellung }) {
  const today = new Date()
  today.setHours(0, 0, 0, 0)

  const parseDate = (d: string | null): Date | null => {
    if (!d) return null
    const date = new Date(d)
    date.setHours(0, 0, 0, 0)
    return date
  }

  const fmt = (d: string | null) => {
    if (!d) return null
    try { return new Date(d + 'T00:00:00').toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: '2-digit' }) }
    catch { return null }
  }

  const milestoneData = [
    { label: 'Bestellt',   soll: bestellung.bestelldatum,           ist: null },
    { label: 'Prod.start', soll: bestellung.produktionsstart_datum,  ist: bestellung.produktionsstart_datum_ist },
    { label: 'Prod.ende',  soll: bestellung.produktionsende_datum,   ist: bestellung.produktionsende_datum_ist },
    { label: 'Versand',    soll: bestellung.shippingdatum,           ist: bestellung.shippingdatum_ist },
    { label: 'Ankunft',    soll: bestellung.ankunftsdatum,           ist: bestellung.ankunftsdatum_ist },
    { label: 'Verfügbar',  soll: bestellung.verfuegbarkeitsdatum,    ist: bestellung.verfuegbarkeitsdatum_ist },
  ].map(({ label, soll, ist }) => ({
    label,
    effective: parseDate(ist ?? soll),
    hasDelay: ist !== null,
    hasDatum: soll !== null,
    tooltipSoll: fmt(soll),
    tooltipIst: fmt(ist),
    rawSoll: soll,
    rawIst: ist,
    isEarly: ist !== null && soll !== null && ist < soll,
  }))

  const milestones = milestoneData.map(m => m.effective)

  let activeIdx = -1
  for (let i = milestones.length - 1; i >= 0; i--) {
    if (milestones[i] && today >= milestones[i]!) {
      activeIdx = i
      break
    }
  }

  function lineProgress(i: number): number {
    if (i < activeIdx) return 1
    if (i > activeIdx) return 0
    const curr = milestones[i]
    const next = milestones[i + 1]
    if (!curr || !next) return 0
    const total = next.getTime() - curr.getTime()
    if (total <= 0) return 1
    return Math.min(1, Math.max(0, (today.getTime() - curr.getTime()) / total))
  }

  return (
    <TooltipProvider delayDuration={200}>
      <div className="flex items-center min-w-[120px]">
        {milestoneData.map(({ label, hasDelay, hasDatum, tooltipSoll, tooltipIst, rawSoll, rawIst, isEarly }, i) => {
          const reached = i <= activeIdx
          const isActive = i === activeIdx
          const delayed = hasDelay

          const dotColor = reached
            ? (delayed ? (isEarly ? 'bg-green-500' : 'bg-amber-500') : 'bg-blue-500')
            : (delayed ? (isEarly ? 'bg-green-200 border border-green-400' : 'bg-amber-200 border border-amber-400') : hasDatum ? 'bg-gray-200 border border-gray-300' : 'bg-gray-100')
          const ringColor = isActive ? (delayed ? (isEarly ? 'ring-2 ring-green-400 ring-offset-1' : 'ring-2 ring-amber-400 ring-offset-1') : 'ring-2 ring-blue-400 ring-offset-1') : ''

          return (
            <Fragment key={i}>
              <Tooltip>
                <TooltipTrigger asChild>
                  <div className={['flex-shrink-0 rounded-full cursor-default', isActive ? 'w-3 h-3' : 'w-2 h-2', dotColor, ringColor].join(' ')} />
                </TooltipTrigger>
                <TooltipContent side="top" className="text-xs">
                  <p className="font-medium">{label}</p>
                  {tooltipIst ? (
                    <>
                      {tooltipSoll && rawSoll && rawIst ? (() => {
                        const delta = Math.round(
                          (new Date(rawIst + 'T00:00:00').getTime() -
                            new Date(rawSoll + 'T00:00:00').getTime()) / 86400000,
                        )
                        const earlyColor = isEarly ? 'text-green-400' : 'text-amber-400'
                        return (
                          <>
                            <p className={earlyColor}>Ist: {tooltipIst}</p>
                            <p className="text-muted-foreground">
                              Soll: {tooltipSoll}{' '}
                              <span className={earlyColor}>({delta > 0 ? '+' : ''}{delta}d)</span>
                            </p>
                          </>
                        )
                      })() : (
                        <p className="text-amber-400">Ist: {tooltipIst}</p>
                      )}
                    </>
                  ) : tooltipSoll ? (
                    <p>{tooltipSoll}</p>
                  ) : (
                    <p className="text-muted-foreground">Kein Datum</p>
                  )}
                </TooltipContent>
              </Tooltip>
              {i < milestoneData.length - 1 && (
                <div className="relative h-px flex-1 bg-gray-200 mx-0.5">
                  <div
                    className={`absolute inset-y-0 left-0 ${delayed ? (isEarly ? 'bg-green-500' : 'bg-amber-500') : milestoneData[i + 1]?.hasDelay ? (milestoneData[i + 1]?.isEarly ? 'bg-green-500' : 'bg-amber-500') : 'bg-blue-500'}`}
                    style={{ width: `${lineProgress(i) * 100}%` }}
                  />
                </div>
              )}
            </Fragment>
          )
        })}
      </div>
    </TooltipProvider>
  )
}

function DatumMitDelta({ soll, ist }: { soll: string | null; ist: string | null }) {
  const effektiv = ist ?? soll
  if (!effektiv) return <span className="text-muted-foreground">—</span>

  const fmt = (d: string) =>
    new Date(d + 'T00:00:00').toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: '2-digit' })

  if (ist && soll && ist !== soll) {
    const delta = Math.round(
      (new Date(ist + 'T00:00:00').getTime() - new Date(soll + 'T00:00:00').getTime()) / 86400000,
    )
    const isEarly = delta < 0
    return (
      <div>
        <span className={`font-medium ${isEarly ? 'text-green-700' : 'text-amber-700'}`}>{fmt(ist)}</span>
        <div className={`text-xs mt-0.5 ${isEarly ? 'text-green-600' : 'text-amber-600'}`}>
          Soll: {fmt(soll)} ({delta > 0 ? '+' : ''}{delta}d)
        </div>
      </div>
    )
  }

  return <span>{fmt(effektiv)}</span>
}

function BestellungZeile({
  bestellung,
  zeigeLaufenderStatus,
  zeigeUmwandeln,
  zeigeAbschliessen,
  onClick,
  onDelete,
  onConvert,
  onAbschliessen,
}: {
  bestellung: Bestellung
  zeigeLaufenderStatus: boolean
  zeigeUmwandeln: boolean
  zeigeAbschliessen: boolean
  onClick: () => void
  onDelete: (e: React.MouseEvent) => void
  onConvert?: () => void
  onAbschliessen?: () => void
}) {
  const produktNamen = bestellung.produkte.map((p) => p.produkt_name).join(', ')
  const gesamtmenge = berechneGesamtmenge(bestellung)
  const datumFarbe = zeigeUmwandeln ? bestelldatumFarbe(bestellung.bestelldatum) : ''
  const isAbgeschlossen = bestellung.status === 'abgeschlossen'
  const isKonsolidiert = bestellung.konsolidierungsgruppe_id !== null

  return (
    <tr
      className="border-b hover:bg-muted/40 cursor-pointer"
      onClick={onClick}
    >
      {/* Konsolidierungs-Stripe */}
      <td className={`w-1 p-0 ${isKonsolidiert ? 'bg-violet-400' : ''}`} />

      {zeigeLaufenderStatus && (
        <td className="px-4 py-3">
          {bestellung.status === 'plan' ? (
            <span className="inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium bg-blue-50 text-blue-700">
              Geplant
            </span>
          ) : isAbgeschlossen ? (
            <span className="inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium bg-gray-100 text-gray-600">
              Abgeschlossen
            </span>
          ) : (() => {
            const aktStatus = berechneAktuellenStatus(bestellung)
            return (
              <span
                className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${AKTUELLLER_STATUS_FARBE[aktStatus] ?? 'bg-gray-100 text-gray-800'}`}
              >
                {aktStatus}
              </span>
            )
          })()}
        </td>
      )}
      {zeigeLaufenderStatus && (
        <td className="px-4 py-3">
          <BestellungFortschritt bestellung={bestellung} />
        </td>
      )}
      {/* Bestelldatum */}
      <td className="px-4 py-3 text-sm font-medium">
        {datumFarbe ? (
          <span className={`inline-flex rounded px-2 py-0.5 font-medium ${datumFarbe}`}>
            {formatDatum(bestellung.bestelldatum)}
          </span>
        ) : (
          formatDatum(bestellung.bestelldatum)
        )}
      </td>
      {/* Produkte */}
      <td className="px-4 py-3 text-sm text-muted-foreground max-w-[280px]">
        <div className="flex items-center gap-1.5 flex-wrap">
          <span className="truncate">{produktNamen || '—'}</span>
          {bestellung.herkunft === 'manuell' && (
            <Badge variant="outline" className="text-xs shrink-0 font-normal">
              Erstbestellung
            </Badge>
          )}
          {isKonsolidiert && (
            <TooltipProvider delayDuration={200}>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Badge variant="outline" className="text-xs shrink-0 font-normal text-violet-600 border-violet-200 bg-violet-50">
                    Konsolidiert
                  </Badge>
                </TooltipTrigger>
                <TooltipContent side="top" className="max-w-xs text-xs">
                  {bestellung.konsolidierungspartner.length > 0 ? (
                    <>
                      <p className="font-medium mb-1">Konsolidiert mit:</p>
                      {bestellung.konsolidierungspartner.map((p, i) => (
                        <p key={i}>{p.produkt_namen.join(', ')}</p>
                      ))}
                      <p className="mt-1 text-muted-foreground text-[10px]">Umwandlung nur gemeinsam möglich</p>
                    </>
                  ) : (
                    <p>Teil einer Konsolidierungsgruppe</p>
                  )}
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          )}
          {(() => {
            const anteil = bestellung.container_anteil
            if (anteil && Object.keys(anteil).length > 0) {
              const parts = Object.entries(anteil)
                .filter(([, v]) => v > 0)
                .map(([art, v]) => {
                  const rounded = Math.round(v * 100) / 100
                  return `${rounded % 1 === 0 ? rounded : rounded.toFixed(2)}× ${art}`
                })
                .join(' + ')
              if (parts) return <Badge variant="outline" className="text-xs shrink-0 font-mono font-normal">{parts}</Badge>
            }
            const hq = bestellung.anzahl_40hq ?? 0
            const dc = bestellung.anzahl_20dc ?? 0
            if (hq === 0 && dc === 0) return null
            const parts = [hq > 0 && `${hq}× 40HQ`, dc > 0 && `${dc}× 20DC`].filter(Boolean).join(' + ')
            return <Badge variant="outline" className="text-xs shrink-0 font-mono font-normal">{parts}</Badge>
          })()}
        </div>
      </td>
      {/* Gesamtmenge */}
      <td className="px-4 py-3 text-sm">
        <span>{gesamtmenge > 0 ? gesamtmenge.toLocaleString('de-DE') : '—'}</span>
      </td>
      {/* Verfügbar ab */}
      <td className="px-4 py-3 text-sm">
        <DatumMitDelta soll={bestellung.verfuegbarkeitsdatum} ist={bestellung.verfuegbarkeitsdatum_ist} />
      </td>
      <td className="px-4 py-3">
        <div className="flex items-center gap-1">
          {zeigeUmwandeln && onConvert && (
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7 text-muted-foreground hover:text-blue-600"
                  title={isKonsolidiert ? 'Gruppe in laufende Bestellung umwandeln' : 'In laufende Bestellung umwandeln'}
                  onClick={(e) => e.stopPropagation()}
                >
                  <ArrowRightCircle className="h-4 w-4" />
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>
                    {isKonsolidiert ? 'Gesamte Konsolidierung umwandeln?' : 'In laufende Bestellung umwandeln?'}
                  </AlertDialogTitle>
                  <AlertDialogDescription>
                    {isKonsolidiert
                      ? 'Diese Bestellung ist Teil einer Konsolidierungsgruppe. Alle Bestellungen der Konsolidierung werden gemeinsam in laufende Bestellungen umgewandelt.'
                      : 'Diese Planbestellung wird in eine laufende Bestellung umgewandelt.'}
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel onClick={(e) => e.stopPropagation()}>Abbrechen</AlertDialogCancel>
                  <AlertDialogAction
                    onClick={(e) => {
                      e.stopPropagation()
                      onConvert()
                    }}
                  >
                    {isKonsolidiert ? 'Konsolidierung umwandeln' : 'Umwandeln'}
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          )}
          {zeigeAbschliessen && onAbschliessen && (
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7 text-muted-foreground hover:text-green-600"
                  title={isKonsolidiert ? 'Gesamte Konsolidierung abschließen' : 'Als abgeschlossen markieren'}
                  onClick={(e) => e.stopPropagation()}
                >
                  <CheckCircle2 className="h-4 w-4" />
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>
                    {isKonsolidiert ? 'Gesamte Konsolidierung abschließen?' : 'Bestellung abschließen?'}
                  </AlertDialogTitle>
                  <AlertDialogDescription>
                    {isKonsolidiert
                      ? 'Diese Bestellung ist Teil einer Konsolidierungsgruppe. Alle Bestellungen der Konsolidierung werden gemeinsam abgeschlossen.'
                      : 'Diese Bestellung wird als abgeschlossen markiert und aus den laufenden Bestellungen entfernt.'}
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel onClick={(e) => e.stopPropagation()}>Abbrechen</AlertDialogCancel>
                  <AlertDialogAction
                    onClick={(e) => {
                      e.stopPropagation()
                      onAbschliessen()
                    }}
                  >
                    {isKonsolidiert ? 'Konsolidierung abschließen' : 'Abschließen'}
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          )}
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
        </div>
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

const TABELLEN_KOPF_COLUMNS = (
  <>
    <th className="w-1 p-0" />
    <th className="px-4 py-2.5 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">
      Status
    </th>
    <th className="px-4 py-2.5 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">
      Fortschritt
    </th>
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
      Verfügbar ab
    </th>
    <th className="px-4 py-2.5" />
  </>
)

function BestellungenTabelle({
  status,
  zeigeLaufenderStatus,
  onBestellungGeaendert,
}: {
  status: 'plan' | 'laufend' | 'abgeschlossen'
  zeigeLaufenderStatus: boolean
  onBestellungGeaendert?: () => void
}) {
  const { bestellungen, loading, error, reload, update, remove, changeStatus, changeStatusGruppe } =
    useBestellungen(status)
  const [ausgewaehlteBestellung, setAusgewaehlteBestellung] = useState<Bestellung | null>(null)
  const [detailOffen, setDetailOffen] = useState(false)
  const { toast } = useToast()
  const { getLieferzeit } = useProduktinformationenLieferzeit()

  async function handleDelete(id: string): Promise<void> {
    try {
      await remove(id)
      toast({ title: 'Bestellung gelöscht' })
    } catch (err) {
      toast({
        title: 'Fehler beim Löschen',
        description: err instanceof Error ? err.message : undefined,
        variant: 'destructive',
      })
      throw err
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

  async function handleChangeStatus(id: string, newStatus: BestellungStatus): Promise<Bestellung> {
    const bestellung = bestellungen.find(b => b.id === id)
    if (bestellung?.konsolidierungsgruppe_id && newStatus !== 'plan') {
      await changeStatusGruppe(bestellung.konsolidierungsgruppe_id, newStatus)
      setDetailOffen(false)
      onBestellungGeaendert?.()
      toast({
        title: newStatus === 'laufend' ? 'Konsolidierungsgruppe gestartet' : 'Konsolidierungsgruppe abgeschlossen',
      })
      return bestellung
    }
    const result = await changeStatus(id, newStatus)
    setDetailOffen(false)
    onBestellungGeaendert?.()
    toast({
      title: newStatus === 'laufend' ? 'Bestellung gestartet' : 'Bestellung abgeschlossen',
    })
    return result
  }

  async function handleConvert(bestellung: Bestellung): Promise<void> {
    try {
      if (bestellung.konsolidierungsgruppe_id) {
        await changeStatusGruppe(bestellung.konsolidierungsgruppe_id, 'laufend')
        toast({ title: 'Konsolidierungsgruppe gestartet' })
      } else {
        await changeStatus(bestellung.id, 'laufend')
        toast({ title: 'Bestellung gestartet' })
      }
      onBestellungGeaendert?.()
    } catch (err) {
      const anyErr = err as { status?: number; body?: Record<string, unknown> }
      if (anyErr.status === 409) {
        const gruppeId = (anyErr.body?.konsolidierungsgruppe_id as string | undefined) ?? bestellung.konsolidierungsgruppe_id
        if (gruppeId) {
          try {
            await changeStatusGruppe(gruppeId, 'laufend')
            toast({ title: 'Konsolidierungsgruppe gestartet' })
            onBestellungGeaendert?.()
            return
          } catch { /* fall through to error toast */ }
        }
      }
      toast({
        title: 'Fehler beim Umwandeln',
        description: err instanceof Error ? err.message : undefined,
        variant: 'destructive',
      })
    }
  }

  async function handleAbschliessen(bestellung: Bestellung): Promise<void> {
    try {
      if (bestellung.konsolidierungsgruppe_id) {
        await changeStatusGruppe(bestellung.konsolidierungsgruppe_id, 'abgeschlossen')
        toast({ title: 'Konsolidierungsgruppe abgeschlossen' })
      } else {
        await changeStatus(bestellung.id, 'abgeschlossen')
        toast({ title: 'Bestellung abgeschlossen' })
      }
      onBestellungGeaendert?.()
    } catch (err) {
      const anyErr = err as { status?: number; body?: Record<string, unknown> }
      if (anyErr.status === 409) {
        const gruppeId = (anyErr.body?.konsolidierungsgruppe_id as string | undefined) ?? bestellung.konsolidierungsgruppe_id
        if (gruppeId) {
          try {
            await changeStatusGruppe(gruppeId, 'abgeschlossen')
            toast({ title: 'Konsolidierungsgruppe abgeschlossen' })
            onBestellungGeaendert?.()
            return
          } catch { /* fall through to error toast */ }
        }
      }
      toast({
        title: 'Fehler beim Abschließen',
        description: err instanceof Error ? err.message : undefined,
        variant: 'destructive',
      })
    }
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

  // Consolidated orders always appear together, anchored at the earliest date in the group.
  const sortiertBestellungen = (() => {
    const gruppeMinDatum = new Map<string, string>()
    for (const b of bestellungen) {
      const gid = b.konsolidierungsgruppe_id
      if (gid && b.bestelldatum) {
        const cur = gruppeMinDatum.get(gid)
        if (!cur || b.bestelldatum < cur) gruppeMinDatum.set(gid, b.bestelldatum)
      }
    }
    return [...bestellungen].sort((a, b) => {
      const keyA = a.konsolidierungsgruppe_id
        ? (gruppeMinDatum.get(a.konsolidierungsgruppe_id) ?? a.bestelldatum ?? '')
        : (a.bestelldatum ?? '')
      const keyB = b.konsolidierungsgruppe_id
        ? (gruppeMinDatum.get(b.konsolidierungsgruppe_id) ?? b.bestelldatum ?? '')
        : (b.bestelldatum ?? '')
      if (!keyA && !keyB) return 0
      if (!keyA) return 1
      if (!keyB) return -1
      if (keyA !== keyB) return keyA.localeCompare(keyB)
      // Same group: sort members by their own date
      if (!a.bestelldatum && !b.bestelldatum) return 0
      if (!a.bestelldatum) return 1
      if (!b.bestelldatum) return -1
      return a.bestelldatum.localeCompare(b.bestelldatum)
    })
  })()

  return (
    <>
      <div className="overflow-x-auto rounded-md border">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b bg-muted/30">
              {TABELLEN_KOPF_COLUMNS}
            </tr>
          </thead>
          <tbody>
            {sortiertBestellungen.map((b) => (
              <BestellungZeile
                key={b.id}
                bestellung={b}
                zeigeLaufenderStatus={zeigeLaufenderStatus}
                zeigeUmwandeln={status === 'plan'}
                zeigeAbschliessen={status === 'laufend'}
                onClick={() => {
                  setAusgewaehlteBestellung(b)
                  setDetailOffen(true)
                }}
                onDelete={() => { handleDelete(b.id).catch(() => {}) }}
                onConvert={status === 'plan' ? () => { handleConvert(b).catch(() => {}) } : undefined}
                onAbschliessen={status === 'laufend' ? () => { handleAbschliessen(b).catch(() => {}) } : undefined}
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
          onDelete={handleDelete}
          onChangeStatus={handleChangeStatus}
          lieferzeit={ausgewaehlteBestellung.produkte[0]?.produkt_id
            ? getLieferzeit(ausgewaehlteBestellung.produkte[0].produkt_id)
            : null}
        />
      )}
    </>
  )
}

export function BestellplanungTabelle() {
  const [wizardOffen, setWizardOffen] = useState(false)
  const [erstplanbestellungOffen, setErstplanbestellungOffen] = useState(false)
  const [planReloadKey, setPlanReloadKey] = useState(0)
  const [laufendReloadKey, setLaufendReloadKey] = useState(0)
  const [validierungsFehler, setValidierungsFehler] = useState<string[]>([])
  const [validierungOffen, setValidierungOffen] = useState(false)
  const [validierungLaed, setValidierungLaed] = useState(false)

  function handleWizardComplete() {
    setPlanReloadKey((k) => k + 1)
  }

  async function handlePlanbestelllaufClick() {
    setValidierungLaed(true)
    try {
      const res = await fetch('/api/bestellplanung/stammdaten-check')
      const data: { ok: boolean; fehler: string[] } = await res.json()
      if (!data.ok) {
        setValidierungsFehler(data.fehler)
        setValidierungOffen(true)
      } else {
        setWizardOffen(true)
      }
    } catch {
      setWizardOffen(true)
    } finally {
      setValidierungLaed(false)
    }
  }

  return (
    <div className="space-y-4">
      <Tabs defaultValue="plan">
        <TabsList className="w-full">
          <TabsTrigger value="plan" className="flex-1">Planbestellungen</TabsTrigger>
          <TabsTrigger value="laufend" className="flex-1">Laufende Bestellungen</TabsTrigger>
          <TabsTrigger value="abgeschlossen" className="flex-1">Abgeschlossene Bestellungen</TabsTrigger>
        </TabsList>

        <TabsContent value="plan" className="mt-4 space-y-4">
          <div className="flex justify-end gap-2">
            <Button
              onClick={() => setErstplanbestellungOffen(true)}
              className="gap-2"
            >
              <PackagePlus className="h-4 w-4" />
              Erstplanbestellung anlegen
            </Button>
            <Button onClick={handlePlanbestelllaufClick} disabled={validierungLaed} className="gap-2">
              {validierungLaed ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Play className="h-4 w-4" />
              )}
              Planbestelllauf durchführen
            </Button>
          </div>
          <BestellungenTabelle
            key={planReloadKey}
            status="plan"
            zeigeLaufenderStatus={true}
            onBestellungGeaendert={() => {
              setPlanReloadKey((k) => k + 1)
              setLaufendReloadKey((k) => k + 1)
            }}
          />
        </TabsContent>

        <TabsContent value="laufend" className="mt-4">
          <BestellungenTabelle
            key={laufendReloadKey}
            status="laufend"
            zeigeLaufenderStatus={true}
            onBestellungGeaendert={() => {}}
          />
        </TabsContent>

        <TabsContent value="abgeschlossen" className="mt-4">
          <BestellungenTabelle
            status="abgeschlossen"
            zeigeLaufenderStatus={true}
          />
        </TabsContent>
      </Tabs>

      <AlertDialog open={validierungOffen} onOpenChange={setValidierungOffen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Fehlende Stammdaten</AlertDialogTitle>
            <AlertDialogDescription>
              Bitte hinterlege die fehlenden Stammdaten, bevor du den Planbestelllauf durchführst:
            </AlertDialogDescription>
          </AlertDialogHeader>
          <ul className="px-1 py-2 space-y-1.5">
            {validierungsFehler.map((f, i) => (
              <li key={i} className="flex items-start gap-2 text-sm">
                <AlertTriangle className="h-4 w-4 text-amber-500 mt-0.5 shrink-0" />
                <span>{f}</span>
              </li>
            ))}
          </ul>
          <AlertDialogFooter>
            <AlertDialogAction onClick={() => setValidierungOffen(false)}>
              Verstanden
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <PlanbestelllaufWizard
        open={wizardOffen}
        onOpenChange={setWizardOffen}
        onComplete={handleWizardComplete}
      />

      <ErstplanbestellungDialog
        open={erstplanbestellungOffen}
        onOpenChange={setErstplanbestellungOffen}
        onCreated={() => setPlanReloadKey((k) => k + 1)}
      />
    </div>
  )
}
