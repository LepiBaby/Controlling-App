'use client'

import { useState, useCallback, useEffect, Fragment } from 'react'
import { CalendarIcon, Trash2, ArrowRight, CheckCircle2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import { Separator } from '@/components/ui/separator'
import { Textarea } from '@/components/ui/textarea'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
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
import { BestellkostenTabelle } from '@/components/bestellkosten-tabelle'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'
import { Calendar } from '@/components/ui/calendar'
import { useToast } from '@/hooks/use-toast'
import type { Bestellung, BestellungStatus, SkuMenge } from '@/hooks/use-bestellungen'
import { berechneAktuellenStatus } from '@/hooks/use-bestellungen'
import { kaskadiereDaten, DATUM_KETTEN_FELDER, type DatumFelder, type LieferzeitIntervals } from '@/lib/datum-kaskade'
import { useProduktinformationenContainer, berechneStueckvolumen, berechneMaxKapazitaet, perContainerMengen } from '@/hooks/use-produktinformationen-container'

// ─── DatePicker helper ─────────────────────────────────────────────────────────

function DatePicker({
  value,
  onChange,
  disabled,
  label,
}: {
  value: string | null
  onChange: (v: string | null) => void
  disabled?: boolean
  label: string
}) {
  const [open, setOpen] = useState(false)
  const date = value ? new Date(value + 'T00:00:00') : undefined

  return (
    <div className="space-y-1.5">
      {label && <Label className="text-xs text-muted-foreground">{label}</Label>}
      <Popover open={open && !disabled} onOpenChange={v => !disabled && setOpen(v)}>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            size="sm"
            className="w-full justify-start text-left font-normal"
            disabled={disabled}
          >
            <CalendarIcon className="mr-2 h-3.5 w-3.5 shrink-0 opacity-50" />
            {date
              ? date.toLocaleDateString('de-DE')
              : <span className="text-muted-foreground text-xs">Kein Datum</span>}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0" align="start">
          <Calendar
            mode="single"
            selected={date}
            onSelect={d => {
              if (d) {
                const yyyy = d.getFullYear()
                const mm = String(d.getMonth() + 1).padStart(2, '0')
                const dd = String(d.getDate()).padStart(2, '0')
                onChange(`${yyyy}-${mm}-${dd}`)
              } else {
                onChange(null)
              }
              setOpen(false)
            }}
          />
          {value && (
            <div className="border-t p-2">
              <Button
                variant="ghost"
                size="sm"
                className="w-full text-xs text-muted-foreground"
                onClick={() => { onChange(null); setOpen(false) }}
              >
                Datum entfernen
              </Button>
            </div>
          )}
        </PopoverContent>
      </Popover>
    </div>
  )
}

// ─── Status badge ──────────────────────────────────────────────────────────────

const STATUS_COLORS: Record<string, string> = {
  'Bestellt': 'bg-gray-100 text-gray-700',
  'In Produktion': 'bg-blue-100 text-blue-700',
  'Bereit zum Versand': 'bg-amber-100 text-amber-700',
  'Unterwegs': 'bg-orange-100 text-orange-700',
  'In Einlagerung': 'bg-purple-100 text-purple-700',
  'Verfügbar': 'bg-green-100 text-green-700',
}

// ─── Fortschritts-Timeline ─────────────────────────────────────────────────────

function FortschrittTimeline({ bestellung }: { bestellung: Bestellung }) {
  const today = new Date()
  today.setHours(0, 0, 0, 0)

  const schritte: Array<{ label: string; soll: string | null; ist: string | null }> = [
    { label: 'Bestellt',   soll: bestellung.bestelldatum,          ist: null },
    { label: 'Prod.start', soll: bestellung.produktionsstart_datum, ist: bestellung.produktionsstart_datum_ist },
    { label: 'Prod.ende',  soll: bestellung.produktionsende_datum,  ist: bestellung.produktionsende_datum_ist },
    { label: 'Versand',    soll: bestellung.shippingdatum,          ist: bestellung.shippingdatum_ist },
    { label: 'Ankunft',    soll: bestellung.ankunftsdatum,          ist: bestellung.ankunftsdatum_ist },
    { label: 'Verfügbar',  soll: bestellung.verfuegbarkeitsdatum,   ist: bestellung.verfuegbarkeitsdatum_ist },
  ]

  const dates = schritte.map(s => {
    const d = s.ist ?? s.soll
    return d ? new Date(d + 'T00:00:00') : null
  })

  let activeIdx = -1
  for (let i = dates.length - 1; i >= 0; i--) {
    if (dates[i] && today >= dates[i]!) { activeIdx = i; break }
  }

  function segmentProgress(i: number): number {
    if (activeIdx < 0 || i > activeIdx) return 0
    if (i < activeIdx) return 1
    const curr = dates[i], next = dates[i + 1]
    if (!curr || !next) return 0
    const total = next.getTime() - curr.getTime()
    if (total <= 0) return 1
    return Math.min(1, Math.max(0, (today.getTime() - curr.getTime()) / total))
  }

  // Overall progress as a fraction of the full track (0 → 1)
  const overallProgress = activeIdx < 0
    ? 0
    : (activeIdx + segmentProgress(activeIdx)) / (schritte.length - 1)

  const fmt = (d: string | null) => {
    if (!d) return null
    try { return new Date(d + 'T00:00:00').toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit' }) }
    catch { return null }
  }

  return (
    <div className="w-full rounded-lg border bg-muted/20 px-4 py-4">
      {/* Dots — grid so each dot is perfectly centered in its 1/6 column */}
      <div className="relative mb-3">
        {/* Track: runs from center of col 0 to center of col 5 → left/right = 1/12 each */}
        <div
          className="absolute h-1.5 bg-gray-200 rounded-full"
          style={{ top: '5px', left: 'calc(100% / 12)', right: 'calc(100% / 12)' }}
        >
          <div
            className="h-full bg-blue-500 rounded-full transition-all"
            style={{ width: `${overallProgress * 100}%` }}
          />
        </div>
        <div className="grid grid-cols-6 relative">
          {schritte.map((s, i) => {
            const reached = i <= activeIdx
            const isActive = i === activeIdx
            const hasDelay = !!s.ist
            const isEarly = hasDelay && !!s.soll && s.ist! < s.soll

            let dotClass: string
            if (isActive) {
              dotClass = hasDelay
                ? (isEarly ? 'w-3.5 h-3.5 bg-green-500 ring-2 ring-green-400 ring-offset-1' : 'w-3.5 h-3.5 bg-amber-500 ring-2 ring-amber-400 ring-offset-1')
                : 'w-3.5 h-3.5 bg-blue-500 ring-2 ring-blue-400 ring-offset-1'
            } else if (reached) {
              dotClass = hasDelay
                ? (isEarly ? 'w-3.5 h-3.5 bg-green-500' : 'w-3.5 h-3.5 bg-amber-500')
                : 'w-3.5 h-3.5 bg-blue-500'
            } else if (hasDelay) {
              dotClass = isEarly
                ? 'w-3.5 h-3.5 bg-green-100 border-2 border-green-400'
                : 'w-3.5 h-3.5 bg-amber-100 border-2 border-amber-400'
            } else {
              dotClass = dates[i]
                ? 'w-3.5 h-3.5 bg-white border-2 border-gray-300'
                : 'w-3.5 h-3.5 bg-gray-100 border border-gray-200'
            }

            return (
              <div key={i} className="flex justify-center z-10 relative">
                <div className={`rounded-full ${dotClass}`} />
              </div>
            )
          })}
        </div>
      </div>

      {/* Labels — same grid, so each label sits exactly under its dot */}
      <div className="grid grid-cols-6">
        {schritte.map((s, i) => {
          const isActive = i === activeIdx
          const hatIst = !!s.ist
          const sollFmt = fmt(s.soll)
          const istFmt = fmt(s.ist)
          return (
            <div key={i} className="flex flex-col items-center text-center px-0.5">
              <span className={`text-xs font-medium leading-tight ${isActive ? 'text-blue-600' : 'text-muted-foreground'}`}>
                {s.label}
              </span>
              {hatIst ? (
                <>
                  {sollFmt && s.soll && s.ist ? (() => {
                    const delta = Math.round(
                      (new Date(s.ist + 'T00:00:00').getTime() - new Date(s.soll + 'T00:00:00').getTime()) / 86400000,
                    )
                    const isEarly = delta < 0
                    return (
                      <>
                        <span className={`text-xs font-semibold mt-0.5 ${isEarly ? 'text-green-600' : 'text-amber-600'}`}>{istFmt ?? '—'}</span>
                        <span className="text-xs text-muted-foreground line-through">{sollFmt}</span>
                        <span className={`text-xs font-medium ${isEarly ? 'text-green-500' : 'text-amber-500'}`}>{delta > 0 ? '+' : ''}{delta}d</span>
                      </>
                    )
                  })() : (
                    <span className="text-xs font-semibold text-amber-600 mt-0.5">{istFmt ?? '—'}</span>
                  )}
                </>
              ) : (
                <span className={`text-xs mt-0.5 ${i <= activeIdx ? 'font-medium text-foreground' : 'text-muted-foreground'}`}>
                  {sollFmt ?? '—'}
                </span>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ─── Main component ────────────────────────────────────────────────────────────

interface BestellungDetailDialogProps {
  bestellung: Bestellung | null
  open: boolean
  onOpenChange: (v: boolean) => void
  onUpdate: (id: string, patch: Partial<Bestellung>) => Promise<Bestellung>
  onDelete: (id: string) => Promise<void>
  onChangeStatus: (id: string, newStatus: BestellungStatus) => Promise<Bestellung>
  lieferzeit?: LieferzeitIntervals | null
}

export function BestellungDetailDialog({
  bestellung,
  open,
  onOpenChange,
  onUpdate,
  onDelete,
  onChangeStatus,
  lieferzeit,
}: BestellungDetailDialogProps) {
  const { toast } = useToast()
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false)
  const [saving, setSaving] = useState(false)
  const [changingStatus, setChangingStatus] = useState(false)
  const [deleting, setDeleting] = useState(false)

  // Local editable state (only for plan orders)
  const [draft, setDraft] = useState<Partial<Bestellung>>({})
  const [skuMengen, setSkuMengen] = useState<SkuMenge[]>([])

  // Sync draft when dialog opens (handleOpenChange is NOT called when parent sets open=true)
  useEffect(() => {
    if (open && bestellung) {
      setDraft({})
      setSkuMengen(bestellung.sku_mengen.map(s => ({ ...s })))
    }
  }, [open]) // eslint-disable-line react-hooks/exhaustive-deps

  const { containerGlobal, getKapazitaet } = useProduktinformationenContainer()

  const handleOpenChange = useCallback((v: boolean) => {
    onOpenChange(v)
  }, [onOpenChange])

  if (!bestellung) return null
  const b = bestellung

  const produktId = b.produkte[0]?.produkt_id ?? null
  const produktKap = produktId ? getKapazitaet(produktId) : null
  const stueckCm3 = produktKap ? berechneStueckvolumen(produktKap.laenge_cm, produktKap.breite_cm, produktKap.hoehe_cm) : null
  const max_40hq = berechneMaxKapazitaet(containerGlobal.volumen_40hq, stueckCm3)
  const max_20dc = berechneMaxKapazitaet(containerGlobal.volumen_20dc, stueckCm3)

  const isEditable = b.status === 'plan'
  const isLaufend = bestellung.status === 'laufend'
  const produktNamen = bestellung.produkte.map(p => p.produkt_name).join(', ')
  const aktuellStatus = isLaufend ? berechneAktuellenStatus(bestellung) : null
  const statusColor = aktuellStatus ? (STATUS_COLORS[aktuellStatus] ?? 'bg-gray-100 text-gray-700') : ''

  const getDate = (field: keyof Bestellung) =>
    (draft[field] !== undefined ? draft[field] : bestellung[field]) as string | null

  const setDate = (field: keyof Bestellung) => (v: string | null) =>
    setDraft(prev => {
      if (!DATUM_KETTEN_FELDER.has(field as string)) return { ...prev, [field]: v }
      const eff = (f: keyof Bestellung) =>
        (prev[f] !== undefined ? prev[f] : b[f]) as string | null
      const aktuell: DatumFelder = {
        bestelldatum: eff('bestelldatum'),
        produktionsstart_datum: eff('produktionsstart_datum'),
        produktionsende_datum: eff('produktionsende_datum'),
        shippingdatum: eff('shippingdatum'),
        ankunftsdatum: eff('ankunftsdatum'),
        verfuegbarkeitsdatum: eff('verfuegbarkeitsdatum'),
      }
      return { ...prev, ...kaskadiereDaten(field as keyof DatumFelder, v, aktuell, lieferzeit ?? null) }
    })

  // IST-Datum ändern mit Kaskadierung der nachfolgenden IST-Felder.
  // Fallback: falls ein IST-Folgefeld noch nicht gesetzt ist, wird das SOLL-Datum
  // als Basis für die Delta-Berechnung verwendet.
  const IST_ZU_SOLL: Partial<Record<string, keyof DatumFelder>> = {
    produktionsstart_datum_ist: 'produktionsstart_datum',
    produktionsende_datum_ist: 'produktionsende_datum',
    shippingdatum_ist: 'shippingdatum',
    ankunftsdatum_ist: 'ankunftsdatum',
    verfuegbarkeitsdatum_ist: 'verfuegbarkeitsdatum',
  }
  const SOLL_ZU_IST: Partial<Record<string, keyof Bestellung>> = {
    produktionsstart_datum: 'produktionsstart_datum_ist',
    produktionsende_datum: 'produktionsende_datum_ist',
    shippingdatum: 'shippingdatum_ist',
    ankunftsdatum: 'ankunftsdatum_ist',
    verfuegbarkeitsdatum: 'verfuegbarkeitsdatum_ist',
  }

  const setIstDate = (istFeld: keyof Bestellung) => (v: string | null) =>
    setDraft(prev => {
      const sollFeld = IST_ZU_SOLL[istFeld as string]
      if (!sollFeld) return { ...prev, [istFeld]: v }

      // Wenn IST == SOLL → IST löschen (kein Delay mehr)
      const sollWert = (prev[sollFeld] !== undefined ? prev[sollFeld] : b[sollFeld]) as string | null
      if (v !== null && v === sollWert) v = null

      // IST-Wert lesen: Draft > bestellung.IST > bestellung.SOLL (Fallback für Delta)
      const effIst = (sf: keyof DatumFelder): string | null => {
        const if_ = SOLL_ZU_IST[sf as string]
        if (if_) {
          const fromDraft = prev[if_] !== undefined ? prev[if_] : b[if_]
          if (fromDraft != null) return fromDraft as string
        }
        return (prev[sf] !== undefined ? prev[sf] : b[sf]) as string | null
      }

      const aktuell: DatumFelder = {
        bestelldatum: null,
        produktionsstart_datum: effIst('produktionsstart_datum'),
        produktionsende_datum: effIst('produktionsende_datum'),
        shippingdatum: effIst('shippingdatum'),
        ankunftsdatum: effIst('ankunftsdatum'),
        verfuegbarkeitsdatum: effIst('verfuegbarkeitsdatum'),
      }

      const istUpdates: Partial<Bestellung> = {}

      if (v === null) {
        // IST gelöscht → dieses und alle nachfolgenden IST-Felder zurücksetzen
        const kette: Array<keyof DatumFelder> = [
          'produktionsstart_datum', 'produktionsende_datum',
          'shippingdatum', 'ankunftsdatum', 'verfuegbarkeitsdatum',
        ]
        const startIdx = kette.indexOf(sollFeld)
        for (let i = startIdx; i < kette.length; i++) {
          const istF = SOLL_ZU_IST[kette[i]]
          if (istF) (istUpdates as Record<string, unknown>)[istF as string] = null
        }
      } else {
        const kaskadiert = kaskadiereDaten(sollFeld, v, aktuell, lieferzeit ?? null)
        for (const [sf, val] of Object.entries(kaskadiert)) {
          const if_ = SOLL_ZU_IST[sf]
          if (if_) {
            const soll = (prev[sf as keyof Bestellung] !== undefined ? prev[sf as keyof Bestellung] : b[sf as keyof Bestellung]) as string | null
            ;(istUpdates as Record<string, unknown>)[if_ as string] = (val !== null && val === soll) ? null : val
          }
        }
      }

      return { ...prev, ...istUpdates }
    })

  async function handleSave() {
    if (!isEditable) return
    setSaving(true)
    try {
      const skuPatch = skuMengen.map(s => ({ sku_id: s.sku_id, menge_praktisch: s.menge_praktisch }))
      await onUpdate(b.id, { ...draft, sku_mengen: skuMengen as SkuMenge[], _sku_patch: skuPatch } as Partial<Bestellung>)
      toast({ title: 'Gespeichert', description: 'Bestellung wurde aktualisiert.' })
      setDraft({})
      onOpenChange(false)
    } catch {
      toast({ title: 'Fehler', description: 'Bestellung konnte nicht gespeichert werden.', variant: 'destructive' })
    } finally {
      setSaving(false)
    }
  }

  async function handleChangeStatus(newStatus: BestellungStatus) {
    setChangingStatus(true)
    try {
      await onChangeStatus(b.id, newStatus)
      const label = newStatus === 'laufend' ? 'Laufende Bestellung' : 'Abgeschlossene Bestellung'
      toast({ title: 'Status geändert', description: `Bestellung wurde als ${label} markiert.` })
      onOpenChange(false)
    } catch {
      toast({ title: 'Fehler', description: 'Status konnte nicht geändert werden.', variant: 'destructive' })
    } finally {
      setChangingStatus(false)
    }
  }

  async function handleDelete() {
    setDeleting(true)
    try {
      await onDelete(b.id)
      setDeleteConfirmOpen(false)
      onOpenChange(false)
    } catch {
      // parent already showed error toast
    } finally {
      setDeleting(false)
    }
  }

  const titlePrefix =
    bestellung.status === 'plan' ? 'Planbestellung' :
    bestellung.status === 'laufend' ? 'Laufende Bestellung' :
    'Abgeschlossene Bestellung'

  return (
    <>
      <Dialog open={open} onOpenChange={handleOpenChange}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto overflow-x-hidden">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 flex-wrap pr-8">
              <span>{titlePrefix}</span>
              <span className="text-muted-foreground font-normal">—</span>
              <span className="text-sm font-normal text-muted-foreground">{produktNamen}</span>
              {b.herkunft === 'manuell' && (
                <Badge variant="outline" className="text-xs shrink-0 font-normal">Erstbestellung</Badge>
              )}
              {b.konsolidierungsgruppe_id !== null && (
                <TooltipProvider delayDuration={200}>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Badge variant="outline" className="text-xs shrink-0 font-normal text-violet-600 border-violet-200 bg-violet-50">
                        Konsolidiert
                      </Badge>
                    </TooltipTrigger>
                    <TooltipContent side="bottom" className="max-w-xs text-xs">
                      {b.konsolidierungspartner.length > 0 ? (
                        <div>
                          <p className="font-medium mb-1">Konsolidiert mit:</p>
                          {b.konsolidierungspartner.map(p => (
                            <p key={p.bestellung_id}>{p.produkt_namen.join(', ') || 'Weitere Bestellung'}</p>
                          ))}
                        </div>
                      ) : 'Teil einer Konsolidierungsgruppe'}
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              )}
              {(() => {
                const anteil = b.container_anteil
                if (anteil && Object.keys(anteil).length > 0) {
                  const parts = Object.entries(anteil)
                    .filter(([, v]) => v > 0)
                    .map(([art, v]) => {
                      const rounded = Math.round(v * 100) / 100
                      return `${rounded % 1 === 0 ? rounded : rounded.toFixed(2)}× ${art}`
                    })
                    .join(' + ')
                  if (parts) return <Badge variant="outline" className="text-xs font-mono font-normal shrink-0">{parts}</Badge>
                }
                const hq = b.anzahl_40hq ?? 0
                const dc = b.anzahl_20dc ?? 0
                if (hq === 0 && dc === 0) return null
                const parts = [hq > 0 && `${hq}× 40HQ`, dc > 0 && `${dc}× 20DC`].filter(Boolean).join(' + ')
                return <Badge variant="outline" className="text-xs font-mono font-normal shrink-0">{parts}</Badge>
              })()}
              {aktuellStatus && (
                <span className={`ml-auto text-xs px-2 py-0.5 rounded-full font-medium ${statusColor}`}>
                  {aktuellStatus}
                </span>
              )}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-6 py-2">

            {/* Datumsfelder — Plan: editierbare DatePicker */}
            {isEditable && (
              <div>
                <p className="text-sm font-medium mb-3">Datumsfelder</p>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                  <DatePicker label="Bestelldatum" value={getDate('bestelldatum')} onChange={setDate('bestelldatum')} disabled={false} />
                  <DatePicker label="Produktionsstart" value={getDate('produktionsstart_datum')} onChange={setDate('produktionsstart_datum')} disabled={false} />
                  <DatePicker label="Produktionsende" value={getDate('produktionsende_datum')} onChange={setDate('produktionsende_datum')} disabled={false} />
                  <DatePicker label="Shippingdatum" value={getDate('shippingdatum')} onChange={setDate('shippingdatum')} disabled={false} />
                  <DatePicker label="Ankunftsdatum" value={getDate('ankunftsdatum')} onChange={setDate('ankunftsdatum')} disabled={false} />
                  <DatePicker label="Verfügbarkeitsdatum" value={getDate('verfuegbarkeitsdatum')} onChange={setDate('verfuegbarkeitsdatum')} disabled={false} />
                </div>
              </div>
            )}

            {/* Fortschrittsanzeige für laufende und abgeschlossene Bestellungen */}
            {(isLaufend || b.status === 'abgeschlossen') && <FortschrittTimeline bestellung={bestellung} />}

            {/* Datumsfelder — Laufend/Abgeschlossen: SOLL + IST nebeneinander */}
            {!isEditable && (
              <div>
                <div className="flex items-center gap-4 mb-2">
                  <p className="text-sm font-medium">Datumsfelder</p>
                  {(isLaufend) && (
                    <p className="text-xs text-muted-foreground">Trage ein Ist-Datum ein, wenn es eine Verspätung gibt.</p>
                  )}
                </div>
                <div className="rounded-md border overflow-hidden">
                  <table className="w-full table-fixed text-sm">
                    <thead>
                      <tr className="border-b bg-muted/30">
                        <th className="px-3 py-2 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground w-[28%]">Datum</th>
                        <th className="px-3 py-2 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground w-[22%]">Geplant (Soll)</th>
                        <th className="px-3 py-2 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground w-[40%]">Ist-Datum</th>
                        <th className="px-3 py-2 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground w-[10%]">Abw.</th>
                      </tr>
                    </thead>
                    <tbody>
                      {/* Bestelldatum — kein IST-Datum */}
                      <tr className="border-b">
                        <td className="px-3 py-2 text-xs text-muted-foreground">Bestelldatum</td>
                        <td className="px-3 py-2">{getDate('bestelldatum') ? new Date(getDate('bestelldatum')! + 'T00:00:00').toLocaleDateString('de-DE') : '—'}</td>
                        <td className="px-3 py-2 text-xs text-muted-foreground italic">nicht änderbar</td>
                        <td className="px-3 py-2" />
                      </tr>
                      {([
                        { label: 'Produktionsstart', sollFeld: 'produktionsstart_datum', istFeld: 'produktionsstart_datum_ist' },
                        { label: 'Produktionsende', sollFeld: 'produktionsende_datum', istFeld: 'produktionsende_datum_ist' },
                        { label: 'Shippingdatum', sollFeld: 'shippingdatum', istFeld: 'shippingdatum_ist' },
                        { label: 'Ankunftsdatum', sollFeld: 'ankunftsdatum', istFeld: 'ankunftsdatum_ist' },
                        { label: 'Verfügbarkeitsdatum', sollFeld: 'verfuegbarkeitsdatum', istFeld: 'verfuegbarkeitsdatum_ist' },
                      ] as const).map(({ label, sollFeld, istFeld }) => {
                        const sollVal = getDate(sollFeld)
                        const istVal = getDate(istFeld)
                        const hatVerzoegerung = !!istVal
                        const delta = hatVerzoegerung && sollVal && istVal
                          ? Math.round((new Date(istVal + 'T00:00:00').getTime() - new Date(sollVal + 'T00:00:00').getTime()) / 86400000)
                          : null
                        return (
                          <tr key={sollFeld} className="border-b last:border-0">
                            <td className="px-3 py-2 text-xs text-muted-foreground">{label}</td>
                            <td className={`px-3 py-2 ${hatVerzoegerung ? 'text-muted-foreground line-through' : ''}`}>
                              {sollVal ? new Date(sollVal + 'T00:00:00').toLocaleDateString('de-DE') : '—'}
                            </td>
                            <td className="px-3 py-2">
                              {isLaufend ? (
                                <DatePicker
                                  label=""
                                  value={istVal}
                                  onChange={setIstDate(istFeld)}
                                  disabled={false}
                                />
                              ) : (
                                istVal ? (
                                  <span className={`font-medium ${(delta ?? 1) < 0 ? 'text-green-700' : 'text-amber-700'}`}>
                                    {new Date(istVal + 'T00:00:00').toLocaleDateString('de-DE')}
                                  </span>
                                ) : '—'
                              )}
                            </td>
                            <td className="px-3 py-2">
                              {delta !== null ? (
                                <span className={`text-xs font-medium ${delta > 0 ? 'text-amber-600' : 'text-green-600'}`}>
                                  {delta > 0 ? '+' : ''}{delta}d
                                </span>
                              ) : null}
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            <Separator />

            {/* SKU-Mengen */}
            <div>
              <div className="flex items-center gap-2 mb-3">
                <p className="text-sm font-medium">Bestellmengen je SKU</p>
              </div>
              {skuMengen.length === 0 ? (
                <p className="text-sm text-muted-foreground">Keine SKU-Mengen hinterlegt.</p>
              ) : (() => {
                const snap = b.snapshot_vor_konsolidierung
                const snapBySkuId = new Map(snap?.sku_mengen.map(s => [s.sku_id, s.menge_praktisch]) ?? [])
                // Show Konsolidierung column only when a real snapshot exists
                const showKonsolidierungsSpalte = !!snap && snap.sku_mengen.length > 0
                const showTheoretisch = skuMengen.some(s => s.menge_theoretisch !== null)
                const showNachMoq = skuMengen.some(s => s.menge_nach_moq !== null)
                const showBegruendung = skuMengen.some(s => s.begruendung_anpassung)
                return (
                  <div className="rounded-md border overflow-hidden">
                    <table className="w-full table-auto text-sm">
                      <thead>
                        <tr className="border-b bg-muted/40">
                          <th className="px-3 py-2 text-left font-medium text-muted-foreground">SKU</th>
                          {showTheoretisch && (
                            <th className="px-3 py-2 text-right font-medium text-muted-foreground">Theoretisch</th>
                          )}
                          {showNachMoq && (
                            <th className="px-3 py-2 text-right font-medium text-muted-foreground">Nach MOQ</th>
                          )}
                          <th className="px-3 py-2 text-right font-medium text-muted-foreground">Praktisch</th>
                          {showKonsolidierungsSpalte && (
                            <th className="px-3 py-2 text-right font-medium text-blue-600">Konsolidierung</th>
                          )}
                          {showBegruendung && (
                            <th className="px-3 py-2 text-left font-medium text-muted-foreground">Begründung</th>
                          )}
                        </tr>
                      </thead>
                      <tbody>
                        {skuMengen.map((sku, idx) => {
                          // When consolidated: "Praktisch" = pre-consolidation snapshot value (read-only)
                          // "Konsolidierung" = absolute menge_praktisch (editable, blue)
                          const snapPraktisch = snapBySkuId.get(sku.sku_id)
                          const praktischAnzeige = showKonsolidierungsSpalte && snapPraktisch !== undefined
                            ? snapPraktisch
                            : sku.menge_praktisch
                          return (
                            <tr key={sku.sku_id} className="border-b last:border-0 hover:bg-muted/20">
                              <td className="px-3 py-2">
                                <div>{sku.sku_name}</div>
                                {sku.is_trigger && <div className="text-[10px] text-blue-500 leading-tight">Trigger-SKU</div>}
                              </td>
                              {showTheoretisch && (
                                <td className="px-3 py-2 text-right tabular-nums text-muted-foreground">
                                  {sku.menge_theoretisch !== null ? sku.menge_theoretisch.toLocaleString('de-DE') : '—'}
                                </td>
                              )}
                              {showNachMoq && (
                                <td className="px-3 py-2 text-right tabular-nums text-muted-foreground">
                                  {sku.menge_nach_moq !== null ? sku.menge_nach_moq.toLocaleString('de-DE') : '—'}
                                </td>
                              )}
                              {/* Praktisch: snapshot value (read-only) when consolidated, editable otherwise */}
                              <td className="px-3 py-2 text-right">
                                {isEditable && !showKonsolidierungsSpalte ? (
                                  <Input
                                    type="number"
                                    min="0"
                                    className="w-24 h-7 text-right text-sm ml-auto"
                                    value={sku.menge_praktisch}
                                    onChange={e => {
                                      const val = parseInt(e.target.value) || 0
                                      setSkuMengen(prev => prev.map((s, i) =>
                                        i === idx ? { ...s, menge_praktisch: val } : s
                                      ))
                                    }}
                                  />
                                ) : (
                                  <span className="tabular-nums">{praktischAnzeige.toLocaleString('de-DE')}</span>
                                )}
                              </td>
                              {/* Konsolidierung: absolute menge_praktisch (total after consolidation), editable, blue */}
                              {showKonsolidierungsSpalte && (
                                <td className="px-3 py-2 text-right">
                                  {isEditable ? (
                                    <Input
                                      type="number"
                                      min="0"
                                      className="w-24 h-7 text-right text-sm ml-auto text-blue-600"
                                      value={sku.menge_praktisch}
                                      onChange={e => {
                                        const val = parseInt(e.target.value) || 0
                                        setSkuMengen(prev => prev.map((s, i) =>
                                          i === idx ? { ...s, menge_praktisch: val } : s
                                        ))
                                      }}
                                    />
                                  ) : (
                                    <span className="tabular-nums font-medium text-blue-600">
                                      {sku.menge_praktisch.toLocaleString('de-DE')}
                                    </span>
                                  )}
                                </td>
                              )}
                              {showBegruendung && (
                                <td className="px-3 py-2 text-xs text-muted-foreground">
                                  {sku.begruendung_anpassung ?? '—'}
                                </td>
                              )}
                            </tr>
                          )
                        })}
                      </tbody>
                      <tfoot>
                        <tr className="border-t bg-muted/20">
                          <td className="px-3 py-2 font-medium text-sm">Gesamt</td>
                          {showTheoretisch && (
                            <td className="px-3 py-2 text-right font-semibold tabular-nums text-muted-foreground">
                              {skuMengen.reduce((s, m) => s + (m.menge_theoretisch ?? 0), 0).toLocaleString('de-DE')}
                            </td>
                          )}
                          {showNachMoq && (
                            <td className="px-3 py-2 text-right font-semibold tabular-nums text-muted-foreground">
                              {skuMengen.reduce((s, m) => s + (m.menge_nach_moq ?? 0), 0).toLocaleString('de-DE')}
                            </td>
                          )}
                          <td className="px-3 py-2 text-right font-semibold tabular-nums">
                            {skuMengen.reduce((s, m) => {
                              const snapVal = snapBySkuId.get(m.sku_id)
                              return s + (showKonsolidierungsSpalte && snapVal !== undefined ? snapVal : m.menge_praktisch)
                            }, 0).toLocaleString('de-DE')}
                          </td>
                          {showKonsolidierungsSpalte && (
                            <td className="px-3 py-2 text-right font-semibold tabular-nums text-blue-600">
                              {skuMengen.reduce((s, m) => s + m.menge_praktisch, 0).toLocaleString('de-DE')}
                            </td>
                          )}
                          {showBegruendung && <td />}
                        </tr>
                      </tfoot>
                    </table>
                  </div>
                )
              })()}
            </div>

            {/* Container */}
            {(() => {
              const anz40hq = draft.anzahl_40hq !== undefined ? draft.anzahl_40hq : (b.anzahl_40hq ?? 0)
              const anz20dc = draft.anzahl_20dc !== undefined ? draft.anzahl_20dc : (b.anzahl_20dc ?? 0)
              const anteil = bestellung.container_anteil
              const istKonsolidiert = !!(anteil && Object.keys(anteil).length > 0)
              // When consolidation is active, read exclusively from container_anteil (missing key = 0)
              // Round to 2 decimal places to match the badge format
              const round2 = (n: number) => Math.round(n * 100) / 100
              const eff40hq = round2(istKonsolidiert ? (anteil!['40HQ'] ?? 0) : anz40hq)
              const eff20dc = round2(istKonsolidiert ? (anteil!['20DC'] ?? 0) : anz20dc)
              const fmtAnzahl = (n: number) => { const r = round2(n); return r % 1 === 0 ? String(r) : r.toFixed(2) }
              const gesamtmenge = skuMengen.reduce((s, m) => s + m.menge_praktisch, 0)
              // Physical count for breakdown: use ceil of current effective value (incl. draft edits)
              const cur40hq = draft.anzahl_40hq !== undefined ? (draft.anzahl_40hq as number) : eff40hq
              const cur20dc = draft.anzahl_20dc !== undefined ? (draft.anzahl_20dc as number) : eff20dc
              const phys40hq = istKonsolidiert ? Math.ceil(cur40hq) : anz40hq
              const phys20dc = istKonsolidiert ? Math.ceil(cur20dc) : anz20dc
              const { hqAmounts, dcAmounts } = perContainerMengen(gesamtmenge, phys40hq, phys20dc, max_40hq, max_20dc)
              const totalContainer = phys40hq + phys20dc
              return (
                <>
                  <Separator />
                  <div className="space-y-3">
                    <p className="text-sm font-medium">Container</p>
                    <div className="flex gap-6 flex-wrap">
                      <div className="space-y-1">
                        <Label className="text-xs text-muted-foreground">
                          Anzahl 40HQ{max_40hq !== null ? ` (max. ${max_40hq.toLocaleString('de-DE')} Stk.)` : ''}
                        </Label>
                        {isEditable ? (
                          <Input
                            type="number"
                            min="0"
                            step={istKonsolidiert ? '0.01' : '1'}
                            className="w-24 h-8 text-sm"
                            value={draft.anzahl_40hq !== undefined ? draft.anzahl_40hq : eff40hq}
                            onChange={e => {
                              const v = istKonsolidiert ? parseFloat(e.target.value) : parseInt(e.target.value)
                              setDraft(prev => ({ ...prev, anzahl_40hq: Math.max(0, isNaN(v) ? 0 : v) }))
                            }}
                          />
                        ) : (
                          <p className="text-sm font-medium">{fmtAnzahl(eff40hq)}</p>
                        )}
                        {hqAmounts.map((a, i) => (
                          <p key={i} className="text-xs text-muted-foreground">
                            Container {i + 1}: {a.toLocaleString('de-DE')} Stk.{max_40hq ? ` (${Math.round(a / max_40hq * 100)} %)` : ''}
                          </p>
                        ))}
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs text-muted-foreground">
                          Anzahl 20DC{max_20dc !== null ? ` (max. ${max_20dc.toLocaleString('de-DE')} Stk.)` : ''}
                        </Label>
                        {isEditable ? (
                          <Input
                            type="number"
                            min="0"
                            step={istKonsolidiert ? '0.01' : '1'}
                            className="w-24 h-8 text-sm"
                            value={draft.anzahl_20dc !== undefined ? draft.anzahl_20dc : eff20dc}
                            onChange={e => {
                              const v = istKonsolidiert ? parseFloat(e.target.value) : parseInt(e.target.value)
                              setDraft(prev => ({ ...prev, anzahl_20dc: Math.max(0, isNaN(v) ? 0 : v) }))
                            }}
                          />
                        ) : (
                          <p className="text-sm font-medium">{fmtAnzahl(eff20dc)}</p>
                        )}
                        {dcAmounts.map((a, i) => (
                          <p key={i} className="text-xs text-muted-foreground">
                            Container {i + 1}: {a.toLocaleString('de-DE')} Stk.{max_20dc ? ` (${Math.round(a / max_20dc * 100)} %)` : ''}
                          </p>
                        ))}
                      </div>
                    </div>
                    {totalContainer === 0 && (
                      <p className="text-xs text-muted-foreground">Keine Container hinterlegt</p>
                    )}
                  </div>
                </>
              )
            })()}

            {/* Konsolidierungspartner */}
            {bestellung.konsolidierungspartner.length > 0 && (
              <>
                <Separator />
                <div>
                  <p className="text-sm font-medium mb-3">Konsolidiert mit</p>
                  <div className="space-y-2">
                    {bestellung.konsolidierungspartner.map(p => {
                      const anteil = p.container_anteil
                      let containerLabel = ''
                      if (anteil && Object.keys(anteil).length > 0) {
                        containerLabel = Object.entries(anteil)
                          .filter(([, v]) => v > 0)
                          .map(([art, v]) => {
                            const r = Math.round(v * 100) / 100
                            return `${r % 1 === 0 ? r : r.toFixed(2)}× ${art}`
                          })
                          .join(' + ')
                      } else {
                        containerLabel = [
                          p.anzahl_40hq > 0 && `${p.anzahl_40hq}× 40HQ`,
                          p.anzahl_20dc > 0 && `${p.anzahl_20dc}× 20DC`,
                        ].filter(Boolean).join(' + ')
                      }
                      return (
                        <div key={p.bestellung_id} className="flex items-center justify-between rounded-lg border bg-muted/20 px-4 py-2.5">
                          <span className="text-sm font-medium">{p.produkt_namen.join(', ') || 'Weitere Bestellung'}</span>
                          <div className="flex items-center gap-2 shrink-0">
                            {p.bestelldatum && (
                              <span className="text-xs text-muted-foreground tabular-nums">
                                {new Date(p.bestelldatum + 'T00:00:00').toLocaleDateString('de-DE')}
                              </span>
                            )}
                            {containerLabel && (
                              <Badge variant="outline" className="text-xs font-mono">{containerLabel}</Badge>
                            )}
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </div>
              </>
            )}

            {/* Bestellkosten */}
            <BestellkostenTabelle bestellungId={bestellung.id} readOnly={!isEditable} />

            {/* Notizen (only for plan) */}
            {isEditable && (
              <>
                <Separator />
                <div>
                  <Label className="text-sm font-medium">Notizen</Label>
                  <Textarea
                    className="mt-1.5 text-sm"
                    rows={2}
                    placeholder="Optionale Notizen zur Bestellung…"
                    value={(draft.notizen !== undefined ? draft.notizen : bestellung.notizen) ?? ''}
                    onChange={e => setDraft(prev => ({ ...prev, notizen: e.target.value }))}
                  />
                </div>
              </>
            )}

            {/* Abgeschlossen am */}
            {bestellung.status === 'abgeschlossen' && bestellung.abgeschlossen_am && (
              <>
                <Separator />
                <p className="text-sm text-muted-foreground">
                  Abgeschlossen am: <span className="font-medium text-foreground">
                    {new Date(bestellung.abgeschlossen_am + 'T00:00:00').toLocaleDateString('de-DE')}
                  </span>
                </p>
              </>
            )}
          </div>

          <DialogFooter className="flex-col sm:flex-row gap-2 pt-2">
            {/* Delete */}
            <Button
              variant="outline"
              size="sm"
              className="text-destructive border-destructive/30 hover:bg-destructive/10 sm:mr-auto"
              onClick={() => setDeleteConfirmOpen(true)}
            >
              <Trash2 className="h-3.5 w-3.5 mr-1.5" />
              Löschen
            </Button>

            {/* Plan → Laufend */}
            {isEditable && (
              <>
                <Button variant="outline" size="sm" onClick={() => onOpenChange(false)}>
                  Abbrechen
                </Button>
                <Button size="sm" onClick={handleSave} disabled={saving}>
                  {saving ? 'Speichert…' : 'Speichern'}
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleChangeStatus('laufend')}
                  disabled={changingStatus}
                >
                  <ArrowRight className="h-3.5 w-3.5 mr-1.5" />
                  {changingStatus ? 'Wird konvertiert…' : 'In Laufende Bestellung umwandeln'}
                </Button>
              </>
            )}

            {/* Laufend → Abgeschlossen */}
            {isLaufend && (
              <>
                <Button variant="outline" size="sm" onClick={() => onOpenChange(false)}>
                  Schließen
                </Button>
                <Button
                  size="sm"
                  onClick={async () => {
                    setSaving(true)
                    try {
                      await onUpdate(b.id, draft)
                      toast({ title: 'Ist-Daten gespeichert' })
                      setDraft({})
                      onOpenChange(false)
                    } catch {
                      toast({ title: 'Fehler beim Speichern', variant: 'destructive' })
                    } finally {
                      setSaving(false)
                    }
                  }}
                  disabled={saving || Object.keys(draft).length === 0}
                >
                  {saving ? 'Speichert…' : 'Ist-Daten speichern'}
                </Button>
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button variant="outline" size="sm" disabled={changingStatus}>
                      <CheckCircle2 className="h-3.5 w-3.5 mr-1.5" />
                      {changingStatus ? 'Wird abgeschlossen…' : 'Als abgeschlossen markieren'}
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Bestellung abschließen?</AlertDialogTitle>
                      <AlertDialogDescription>
                        Die Bestellung wird als abgeschlossen markiert und aus den laufenden Bestellungen entfernt.
                        {Object.keys(draft).length > 0 && (
                          <span className="block mt-2 text-amber-600 font-medium">
                            Achtung: Nicht gespeicherte Ist-Daten gehen verloren.
                          </span>
                        )}
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Abbrechen</AlertDialogCancel>
                      <AlertDialogAction onClick={() => handleChangeStatus('abgeschlossen')}>
                        Abschließen
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </>
            )}

            {/* Abgeschlossen */}
            {bestellung.status === 'abgeschlossen' && (
              <Button variant="outline" size="sm" onClick={() => onOpenChange(false)}>
                Schließen
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete confirm */}
      <AlertDialog open={deleteConfirmOpen} onOpenChange={setDeleteConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Bestellung löschen?</AlertDialogTitle>
            <AlertDialogDescription>
              Die Bestellung für <strong>{produktNamen}</strong> wird dauerhaft gelöscht. Diese Aktion kann nicht rückgängig gemacht werden.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Abbrechen</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={handleDelete}
              disabled={deleting}
            >
              {deleting ? 'Löscht…' : 'Ja, löschen'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
