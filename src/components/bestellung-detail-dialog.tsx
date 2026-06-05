'use client'

import { useState, useCallback } from 'react'
import { CalendarIcon, Trash2, ArrowRight, CheckCircle2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
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
} from '@/components/ui/alert-dialog'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'
import { Calendar } from '@/components/ui/calendar'
import { useToast } from '@/hooks/use-toast'
import type { Bestellung, BestellungStatus, SkuMenge } from '@/hooks/use-bestellungen'
import { berechneAktuellenStatus } from '@/hooks/use-bestellungen'

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
      <Label className="text-xs text-muted-foreground">{label}</Label>
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
              onChange(d ? d.toISOString().split('T')[0] : null)
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

// ─── Main component ────────────────────────────────────────────────────────────

interface BestellungDetailDialogProps {
  bestellung: Bestellung | null
  open: boolean
  onOpenChange: (v: boolean) => void
  onUpdate: (id: string, patch: Partial<Bestellung>) => Promise<Bestellung>
  onDelete: (id: string) => Promise<void>
  onChangeStatus: (id: string, newStatus: BestellungStatus) => Promise<Bestellung>
}

export function BestellungDetailDialog({
  bestellung,
  open,
  onOpenChange,
  onUpdate,
  onDelete,
  onChangeStatus,
}: BestellungDetailDialogProps) {
  const { toast } = useToast()
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false)
  const [saving, setSaving] = useState(false)
  const [changingStatus, setChangingStatus] = useState(false)
  const [deleting, setDeleting] = useState(false)

  // Local editable state (only for plan orders)
  const [draft, setDraft] = useState<Partial<Bestellung>>({})
  const [skuMengen, setSkuMengen] = useState<SkuMenge[]>([])

  // Reset draft when dialog opens with a new bestellung
  const handleOpenChange = useCallback((v: boolean) => {
    if (v && bestellung) {
      setDraft({})
      setSkuMengen(bestellung.sku_mengen.map(s => ({ ...s })))
    }
    onOpenChange(v)
  }, [bestellung, onOpenChange])

  if (!bestellung) return null
  const b = bestellung

  const isEditable = b.status === 'plan'
  const isLaufend = bestellung.status === 'laufend'
  const produktNamen = bestellung.produkte.map(p => p.produkt_name).join(', ')
  const aktuellStatus = isLaufend ? berechneAktuellenStatus(bestellung) : null
  const statusColor = aktuellStatus ? (STATUS_COLORS[aktuellStatus] ?? 'bg-gray-100 text-gray-700') : ''

  const getDate = (field: keyof Bestellung) =>
    (draft[field] !== undefined ? draft[field] : bestellung[field]) as string | null

  const setDate = (field: keyof Bestellung) => (v: string | null) =>
    setDraft(prev => ({ ...prev, [field]: v }))

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
      toast({ title: 'Gelöscht', description: 'Bestellung wurde gelöscht.' })
      setDeleteConfirmOpen(false)
      onOpenChange(false)
    } catch {
      toast({ title: 'Fehler', description: 'Bestellung konnte nicht gelöscht werden.', variant: 'destructive' })
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
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 flex-wrap">
              <span>{titlePrefix}</span>
              <span className="text-muted-foreground font-normal">—</span>
              <span className="text-sm font-normal text-muted-foreground">{produktNamen}</span>
              {aktuellStatus && (
                <span className={`ml-auto text-xs px-2 py-0.5 rounded-full font-medium ${statusColor}`}>
                  {aktuellStatus}
                </span>
              )}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-6 py-2">
            {/* Warnungen */}
            {bestellung.status === 'plan' && !isEditable ? null : null}

            {/* Datumsfelder */}
            <div>
              <p className="text-sm font-medium mb-3">Datumsfelder</p>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                <DatePicker label="Bestelldatum" value={getDate('bestelldatum')} onChange={setDate('bestelldatum')} disabled={!isEditable} />
                <DatePicker label="Produktionsstart" value={getDate('produktionsstart_datum')} onChange={setDate('produktionsstart_datum')} disabled={!isEditable} />
                <DatePicker label="Produktionsende" value={getDate('produktionsende_datum')} onChange={setDate('produktionsende_datum')} disabled={!isEditable} />
                <DatePicker label="Shippingdatum" value={getDate('shippingdatum')} onChange={setDate('shippingdatum')} disabled={!isEditable} />
                <DatePicker label="Ankunftsdatum" value={getDate('ankunftsdatum')} onChange={setDate('ankunftsdatum')} disabled={!isEditable} />
                <DatePicker label="Verfügbarkeitsdatum" value={getDate('verfuegbarkeitsdatum')} onChange={setDate('verfuegbarkeitsdatum')} disabled={!isEditable} />
              </div>
            </div>

            <Separator />

            {/* SKU-Mengen */}
            <div>
              <p className="text-sm font-medium mb-3">Bestellmengen je SKU</p>
              {skuMengen.length === 0 ? (
                <p className="text-sm text-muted-foreground">Keine SKU-Mengen hinterlegt.</p>
              ) : (
                <div className="rounded-md border overflow-hidden">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b bg-muted/40">
                        <th className="px-3 py-2 text-left font-medium text-muted-foreground">SKU</th>
                        {skuMengen.some(s => s.menge_theoretisch !== null) && (
                          <th className="px-3 py-2 text-right font-medium text-muted-foreground">Theoretisch</th>
                        )}
                        <th className="px-3 py-2 text-right font-medium text-muted-foreground">Praktisch</th>
                        {skuMengen.some(s => s.begruendung_anpassung) && (
                          <th className="px-3 py-2 text-left font-medium text-muted-foreground">Begründung</th>
                        )}
                      </tr>
                    </thead>
                    <tbody>
                      {skuMengen.map((sku, idx) => (
                        <tr key={sku.sku_id} className="border-b last:border-0 hover:bg-muted/20">
                          <td className="px-3 py-2">{sku.sku_name}</td>
                          {skuMengen.some(s => s.menge_theoretisch !== null) && (
                            <td className="px-3 py-2 text-right tabular-nums text-muted-foreground">
                              {sku.menge_theoretisch !== null ? sku.menge_theoretisch.toLocaleString('de-DE') : '—'}
                            </td>
                          )}
                          <td className="px-3 py-2 text-right">
                            {isEditable ? (
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
                              <span className="tabular-nums">{sku.menge_praktisch.toLocaleString('de-DE')}</span>
                            )}
                          </td>
                          {skuMengen.some(s => s.begruendung_anpassung) && (
                            <td className="px-3 py-2 text-xs text-muted-foreground">
                              {sku.begruendung_anpassung ?? '—'}
                            </td>
                          )}
                        </tr>
                      ))}
                    </tbody>
                    <tfoot>
                      <tr className="border-t bg-muted/20">
                        <td className="px-3 py-2 font-medium text-sm" colSpan={skuMengen.some(s => s.menge_theoretisch !== null) ? 2 : 1}>
                          Gesamt
                        </td>
                        <td className="px-3 py-2 text-right font-semibold tabular-nums">
                          {skuMengen.reduce((s, m) => s + m.menge_praktisch, 0).toLocaleString('de-DE')}
                        </td>
                        {skuMengen.some(s => s.begruendung_anpassung) && <td />}
                      </tr>
                    </tfoot>
                  </table>
                </div>
              )}
            </div>

            {/* Konsolidierungen */}
            {bestellung.konsolidierungen.length > 0 && (
              <>
                <Separator />
                <div>
                  <p className="text-sm font-medium mb-3">Konsolidierungen</p>
                  <div className="flex flex-wrap gap-2">
                    {bestellung.konsolidierungen.map(k => (
                      <Badge key={k.id} variant="secondary" className="gap-1.5">
                        <span>{k.containerart}</span>
                        <span className="text-muted-foreground">·</span>
                        <span>{k.andere_produkte.join(', ') || 'Weitere Bestellung'}</span>
                      </Badge>
                    ))}
                  </div>
                </div>
              </>
            )}

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
                <Button variant="outline" size="sm" onClick={handleSave} disabled={saving}>
                  {saving ? 'Speichert…' : 'Speichern'}
                </Button>
                <Button
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
                  onClick={() => handleChangeStatus('abgeschlossen')}
                  disabled={changingStatus}
                >
                  <CheckCircle2 className="h-3.5 w-3.5 mr-1.5" />
                  {changingStatus ? 'Wird abgeschlossen…' : 'Als abgeschlossen markieren'}
                </Button>
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
