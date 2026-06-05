'use client'

import { useState, useEffect, useCallback } from 'react'
import { CalendarIcon, ChevronDown, ChevronRight, AlertTriangle, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Checkbox } from '@/components/ui/checkbox'
import { Separator } from '@/components/ui/separator'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'
import { Calendar } from '@/components/ui/calendar'
import { useToast } from '@/hooks/use-toast'
import { usePlanbestelllauf } from '@/hooks/use-planbestelllauf'
import type { NeuePlanbestellung, PlanbestelllaufAenderung } from '@/hooks/use-planbestelllauf'

// ─── Inline DatePicker ─────────────────────────────────────────────────────────

function DatePicker({ value, onChange, label }: {
  value: string | null
  onChange: (v: string | null) => void
  label: string
}) {
  const [open, setOpen] = useState(false)
  const date = value ? new Date(value + 'T00:00:00') : undefined
  return (
    <div className="space-y-1">
      <Label className="text-xs text-muted-foreground">{label}</Label>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button variant="outline" size="sm" className="w-full justify-start font-normal text-xs h-8">
            <CalendarIcon className="mr-1.5 h-3 w-3 opacity-50 shrink-0" />
            {date ? date.toLocaleDateString('de-DE') : <span className="text-muted-foreground">–</span>}
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
              <Button variant="ghost" size="sm" className="w-full text-xs text-muted-foreground"
                onClick={() => { onChange(null); setOpen(false) }}>
                Datum entfernen
              </Button>
            </div>
          )}
        </PopoverContent>
      </Popover>
    </div>
  )
}

// ─── Step 1: Änderungsempfehlungen ────────────────────────────────────────────

function Schritt1({
  aenderungen,
  akzeptiert,
  onToggle,
  onWeiter,
}: {
  aenderungen: PlanbestelllaufAenderung[]
  akzeptiert: Set<string>
  onToggle: (id: string) => void
  onWeiter: () => void
}) {
  if (aenderungen.length === 0) return null

  const LABELS: Record<string, string> = {
    bestelldatum: 'Bestelldatum',
    menge: 'Bestellmenge',
    konsolidierung: 'Konsolidierung',
  }

  return (
    <div className="space-y-4">
      <div>
        <p className="text-sm font-medium">Empfohlene Änderungen an bestehenden Planbestellungen</p>
        <p className="text-xs text-muted-foreground mt-0.5">
          Der Algorithmus empfiehlt folgende Anpassungen. Wähle aus, was übernommen werden soll.
        </p>
      </div>

      <div className="space-y-2 max-h-[340px] overflow-y-auto pr-1">
        {aenderungen.map(a => (
          <div
            key={a.bestellung_id}
            className="flex items-start gap-3 rounded-md border p-3 hover:bg-muted/30"
          >
            <Checkbox
              id={`aend-${a.bestellung_id}`}
              checked={akzeptiert.has(a.bestellung_id)}
              onCheckedChange={() => onToggle(a.bestellung_id)}
              className="mt-0.5"
            />
            <div className="flex-1 min-w-0">
              <div className="flex flex-wrap items-center gap-1.5">
                <span className="text-sm font-medium">{a.produkt_namen.join(', ')}</span>
                <Badge variant="outline" className="text-xs">{LABELS[a.aenderungsart] ?? a.aenderungsart}</Badge>
              </div>
              <div className="mt-1 flex items-center gap-1.5 text-xs text-muted-foreground">
                <span className="line-through">{a.alt_wert}</span>
                <span>→</span>
                <span className="text-foreground font-medium">{a.neu_wert}</span>
              </div>
              <p className="mt-0.5 text-xs text-muted-foreground">{a.begruendung}</p>
            </div>
          </div>
        ))}
      </div>

      <div className="flex justify-end">
        <Button size="sm" onClick={onWeiter}>Weiter</Button>
      </div>
    </div>
  )
}

// ─── Step 2: Neue Planbestellungen ────────────────────────────────────────────

function NeueBestellungItem({
  b,
  ausgewaehlt,
  onToggleAuswahl,
  onChange,
}: {
  b: NeuePlanbestellung
  ausgewaehlt: boolean
  onToggleAuswahl: () => void
  onChange: (updated: NeuePlanbestellung) => void
}) {
  const [open, setOpen] = useState(false)

  const gesamtmenge = b.sku_mengen.reduce((s, m) => s + m.menge_praktisch, 0)

  const setDate = (field: keyof NeuePlanbestellung) => (v: string | null) =>
    onChange({ ...b, [field]: v })

  const setSkuMenge = (skuId: string, menge: number) =>
    onChange({
      ...b,
      sku_mengen: b.sku_mengen.map(s => s.sku_id === skuId ? { ...s, menge_praktisch: menge } : s),
    })

  const fmt = (d: string | null) =>
    d ? new Date(d + 'T00:00:00').toLocaleDateString('de-DE') : '–'

  return (
    <Collapsible open={open} onOpenChange={setOpen}>
      <div className="rounded-md border">
        <div className="flex items-start gap-3 p-3">
          <Checkbox
            checked={ausgewaehlt}
            onCheckedChange={onToggleAuswahl}
            className="mt-0.5 shrink-0"
            aria-label="Bestellung auswählen"
          />
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-sm font-medium">{b.produkt_namen.join(', ')}</span>
              <Badge variant="secondary" className="text-xs tabular-nums">{gesamtmenge.toLocaleString('de-DE')} Stk.</Badge>
              {b.warnungen.length > 0 && (
                <Badge variant="outline" className="text-xs gap-1 text-amber-600 border-amber-200 bg-amber-50">
                  <AlertTriangle className="h-2.5 w-2.5" />
                  {b.warnungen.length} Hinweis{b.warnungen.length !== 1 ? 'e' : ''}
                </Badge>
              )}
            </div>
            <div className="mt-1 flex flex-wrap gap-x-4 gap-y-0.5 text-xs text-muted-foreground">
              {b.bestelldatum && <span>Bestellt: <span className="text-foreground">{fmt(b.bestelldatum)}</span></span>}
              {b.produktionsende_datum && <span>Prod.ende: <span className="text-foreground">{fmt(b.produktionsende_datum)}</span></span>}
              {b.ankunftsdatum && <span>Ankunft: <span className="text-foreground">{fmt(b.ankunftsdatum)}</span></span>}
              {b.verfuegbarkeitsdatum && <span>Verfügbar: <span className="text-foreground">{fmt(b.verfuegbarkeitsdatum)}</span></span>}
            </div>
          </div>
          <CollapsibleTrigger asChild>
            <Button variant="ghost" size="sm" className="h-7 w-7 p-0 shrink-0">
              {open ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
            </Button>
          </CollapsibleTrigger>
        </div>

        <CollapsibleContent>
          <div className="border-t p-3 space-y-4 bg-muted/10">
            {/* Warnungen */}
            {b.warnungen.length > 0 && (
              <div className="space-y-1">
                {b.warnungen.map((w, i) => (
                  <div key={i} className="flex items-start gap-2 text-xs text-amber-600 bg-amber-50 border border-amber-100 rounded px-2 py-1.5">
                    <AlertTriangle className="h-3 w-3 mt-0.5 shrink-0" />
                    <span>{w}</span>
                  </div>
                ))}
              </div>
            )}

            {/* Datumsfelder */}
            <div>
              <p className="text-xs font-medium text-muted-foreground mb-2">Datumsfelder</p>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                <DatePicker label="Bestelldatum" value={b.bestelldatum} onChange={setDate('bestelldatum')} />
                <DatePicker label="Produktionsstart" value={b.produktionsstart_datum} onChange={setDate('produktionsstart_datum')} />
                <DatePicker label="Produktionsende" value={b.produktionsende_datum} onChange={setDate('produktionsende_datum')} />
                <DatePicker label="Shippingdatum" value={b.shippingdatum} onChange={setDate('shippingdatum')} />
                <DatePicker label="Ankunftsdatum" value={b.ankunftsdatum} onChange={setDate('ankunftsdatum')} />
                <DatePicker label="Verfügbarkeitsdatum" value={b.verfuegbarkeitsdatum} onChange={setDate('verfuegbarkeitsdatum')} />
              </div>
            </div>

            {/* SKU-Mengen */}
            {b.sku_mengen.length > 0 && (
              <div>
                <p className="text-xs font-medium text-muted-foreground mb-2">Bestellmengen je SKU</p>
                <div className="rounded-md border overflow-hidden">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="border-b bg-muted/40">
                        <th className="px-2 py-1.5 text-left font-medium text-muted-foreground">SKU</th>
                        <th className="px-2 py-1.5 text-right font-medium text-muted-foreground">Theoretisch</th>
                        <th className="px-2 py-1.5 text-right font-medium text-muted-foreground">Praktisch</th>
                        <th className="px-2 py-1.5 text-left font-medium text-muted-foreground">Begründung</th>
                      </tr>
                    </thead>
                    <tbody>
                      {b.sku_mengen.map(s => (
                        <tr key={s.sku_id} className="border-b last:border-0">
                          <td className="px-2 py-1.5">{s.sku_name}</td>
                          <td className="px-2 py-1.5 text-right tabular-nums text-muted-foreground">
                            {s.menge_theoretisch.toLocaleString('de-DE')}
                          </td>
                          <td className="px-2 py-1.5 text-right">
                            <Input
                              type="number"
                              min="0"
                              className="w-20 h-6 text-right text-xs ml-auto"
                              value={s.menge_praktisch}
                              onChange={e => setSkuMenge(s.sku_id, parseInt(e.target.value) || 0)}
                            />
                          </td>
                          <td className="px-2 py-1.5 text-muted-foreground max-w-[180px] truncate" title={s.begruendung_anpassung}>
                            {s.begruendung_anpassung || '—'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot>
                      <tr className="border-t bg-muted/20">
                        <td className="px-2 py-1.5 font-medium" colSpan={2}>Gesamt</td>
                        <td className="px-2 py-1.5 text-right font-semibold tabular-nums">
                          {b.sku_mengen.reduce((sum, s) => sum + s.menge_praktisch, 0).toLocaleString('de-DE')}
                        </td>
                        <td />
                      </tr>
                    </tfoot>
                  </table>
                </div>
              </div>
            )}

            {/* Konsolidierungen */}
            {b.konsolidierungen.length > 0 && (
              <div>
                <p className="text-xs font-medium text-muted-foreground mb-2">Konsolidierung</p>
                <div className="flex flex-wrap gap-1.5">
                  {b.konsolidierungen.map((k, i) => (
                    <Badge key={i} variant="secondary" className="text-xs gap-1">
                      <span>{k.containerart}</span>
                      <span>·</span>
                      <span>{k.mit_produkt_namen.join(', ')}</span>
                    </Badge>
                  ))}
                </div>
              </div>
            )}
          </div>
        </CollapsibleContent>
      </div>
    </Collapsible>
  )
}

// ─── Main Wizard ───────────────────────────────────────────────────────────────

interface PlanbestelllaufWizardProps {
  open: boolean
  onOpenChange: (v: boolean) => void
  onComplete: () => void
}

export function PlanbestelllaufWizard({ open, onOpenChange, onComplete }: PlanbestelllaufWizardProps) {
  const { toast } = useToast()
  const { loading, ergebnis, error, applying, ausfuehren, anwenden, reset } = usePlanbestelllauf()

  // UI state
  const [step, setStep] = useState<0 | 1 | 2>(0)
  const [akzeptiert, setAkzeptiert] = useState<Set<string>>(new Set())
  const [ausgewaehlt, setAusgewaehlt] = useState<Set<string>>(new Set())
  const [bearbeitet, setBearbeitet] = useState<Map<string, NeuePlanbestellung>>(new Map())

  // Start algorithm when dialog opens
  useEffect(() => {
    if (!open) return
    setStep(0)
    setAkzeptiert(new Set())
    setAusgewaehlt(new Set())
    setBearbeitet(new Map())
    reset()

    ausfuehren()
      .then(result => {
        // Initialize accepted changes (all accepted by default)
        setAkzeptiert(new Set(result.aenderungen_bestehende.map(a => a.bestellung_id)))
        // Initialize selected orders (all selected by default)
        setAusgewaehlt(new Set(result.neue_planbestellungen.map(b => b.temp_id)))
        // Initialize bearbeitet copies
        const map = new Map<string, NeuePlanbestellung>()
        result.neue_planbestellungen.forEach(b => map.set(b.temp_id, { ...b }))
        setBearbeitet(map)

        // Decide which step to show
        if (result.aenderungen_bestehende.length > 0) {
          setStep(1)
        } else {
          setStep(2)
        }
      })
      .catch(() => {
        // error is set in hook
      })
  }, [open]) // eslint-disable-line react-hooks/exhaustive-deps

  const handleClose = useCallback(() => {
    if (applying) return
    reset()
    onOpenChange(false)
  }, [applying, reset, onOpenChange])

  const handleAnwenden = useCallback(async () => {
    const selectedOrders = Array.from(ausgewaehlt)
      .map(id => bearbeitet.get(id))
      .filter(Boolean) as NeuePlanbestellung[]

    const akzeptierteAenderungen = (ergebnis?.aenderungen_bestehende ?? []).filter(
      a => akzeptiert.has(a.bestellung_id)
    )
    try {
      await anwenden(akzeptierteAenderungen, selectedOrders)
      toast({
        title: 'Planbestellungen angelegt',
        description: `${selectedOrders.length} Planbestellung${selectedOrders.length !== 1 ? 'en' : ''} wurde${selectedOrders.length !== 1 ? 'n' : ''} erfolgreich angelegt.`,
      })
      onComplete()
      onOpenChange(false)
    } catch {
      toast({
        title: 'Fehler',
        description: 'Planbestellungen konnten nicht angelegt werden.',
        variant: 'destructive',
      })
    }
  }, [ausgewaehlt, bearbeitet, akzeptiert, anwenden, toast, onComplete, onOpenChange])

  const toggleAkzeptiert = (id: string) =>
    setAkzeptiert(prev => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })

  const toggleAusgewaehlt = (id: string) =>
    setAusgewaehlt(prev => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })

  const updateBestellung = (updated: NeuePlanbestellung) =>
    setBearbeitet(prev => new Map(prev).set(updated.temp_id, updated))

  const neueBestellungen = ergebnis?.neue_planbestellungen ?? []
  const aenderungen = ergebnis?.aenderungen_bestehende ?? []
  const selectedCount = ausgewaehlt.size

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle>
            {step === 0 && 'Planbestelllauf wird durchgeführt…'}
            {step === 1 && `Änderungsempfehlungen (${aenderungen.length})`}
            {step === 2 && `Neue Planbestellungen (${neueBestellungen.length})`}
          </DialogTitle>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto py-2">
          {/* Step 0: Loading / Error */}
          {step === 0 && (
            <div className="flex flex-col items-center justify-center py-12 gap-4">
              {loading && (
                <>
                  <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                  <p className="text-sm text-muted-foreground">Algorithmus wird ausgeführt…</p>
                  <p className="text-xs text-muted-foreground">Bestandsdaten, Absatzplanung und Produktinformationen werden analysiert.</p>
                </>
              )}
              {error && (
                <div className="text-center space-y-2">
                  <AlertTriangle className="h-8 w-8 text-destructive mx-auto" />
                  <p className="text-sm font-medium text-destructive">Algorithmus fehlgeschlagen</p>
                  <p className="text-xs text-muted-foreground max-w-sm">{error}</p>
                  <Button size="sm" variant="outline" onClick={handleClose}>Schließen</Button>
                </div>
              )}
            </div>
          )}

          {/* Step 1: Änderungsempfehlungen */}
          {step === 1 && (
            <Schritt1
              aenderungen={aenderungen}
              akzeptiert={akzeptiert}
              onToggle={toggleAkzeptiert}
              onWeiter={() => setStep(2)}
            />
          )}

          {/* Step 2: Neue Planbestellungen */}
          {step === 2 && (
            <div className="space-y-3">
              {neueBestellungen.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <p className="text-sm">Keine neuen Planbestellungen empfohlen.</p>
                  <p className="text-xs mt-1">Alle Bestellzeitpunkte liegen außerhalb des aktuellen Planungshorizonts oder der Bestand ist ausreichend.</p>
                </div>
              ) : (
                <>
                  <div className="flex items-center justify-between">
                    <p className="text-xs text-muted-foreground">
                      {selectedCount} von {neueBestellungen.length} ausgewählt
                    </p>
                    <div className="flex gap-2">
                      <Button variant="ghost" size="sm" className="text-xs h-7"
                        onClick={() => setAusgewaehlt(new Set(neueBestellungen.map(b => b.temp_id)))}>
                        Alle wählen
                      </Button>
                      <Button variant="ghost" size="sm" className="text-xs h-7"
                        onClick={() => setAusgewaehlt(new Set())}>
                        Keine
                      </Button>
                    </div>
                  </div>
                  <div className="space-y-2">
                    {neueBestellungen.map(b => (
                      <NeueBestellungItem
                        key={b.temp_id}
                        b={bearbeitet.get(b.temp_id) ?? b}
                        ausgewaehlt={ausgewaehlt.has(b.temp_id)}
                        onToggleAuswahl={() => toggleAusgewaehlt(b.temp_id)}
                        onChange={updateBestellung}
                      />
                    ))}
                  </div>
                </>
              )}
            </div>
          )}
        </div>

        {step === 2 && (
          <>
            <Separator />
            <DialogFooter className="pt-2 gap-2">
              <Button variant="outline" size="sm" onClick={handleClose} disabled={applying}>
                Abbrechen
              </Button>
              <Button
                size="sm"
                onClick={handleAnwenden}
                disabled={applying || selectedCount === 0}
              >
                {applying ? (
                  <><Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />Wird angelegt…</>
                ) : (
                  `${selectedCount} Planbestellung${selectedCount !== 1 ? 'en' : ''} anlegen`
                )}
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  )
}
