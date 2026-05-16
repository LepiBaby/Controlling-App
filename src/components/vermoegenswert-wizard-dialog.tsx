'use client'

import { useState, useEffect, useCallback } from 'react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Checkbox } from '@/components/ui/checkbox'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import { Skeleton } from '@/components/ui/skeleton'
import { ChevronRight } from 'lucide-react'
import type { KpiCategory } from '@/hooks/use-kpi-categories'
import type { AusgabenKostenTransaktion } from '@/hooks/use-ausgaben-kosten-transaktionen'
import { loadVorschlaege, type VermoegenswertInput } from '@/hooks/use-vermoegenswerte'

const fmt = (v: number) =>
  new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR' }).format(v)

const fmtDatum = (d: string) => {
  const [y, m, day] = d.split('-')
  return `${day}.${m}.${y}`
}

const today = () => new Date().toISOString().slice(0, 10)

const STEPS = [
  'Lagerwert',
  'Transit-Warenwert',
  'Verbindlichkeiten',
  'Darlehensverbindlichkeiten',
  'Forderungen',
  'Steuern',
  'Cash-Bestand',
  'Anlagevermögen',
]

interface Props {
  open: boolean
  onOpenChange: (v: boolean) => void
  produkte: KpiCategory[]
  plattformen: KpiCategory[]
  produktKategorieId: string | null
  onSave: (input: VermoegenswertInput) => Promise<string | null>
}

export function VermoegenswertWizardDialog({
  open,
  onOpenChange,
  produkte,
  plattformen,
  produktKategorieId,
  onSave,
}: Props) {
  const [step, setStep] = useState(1)
  const [datum, setDatum] = useState(today())

  const [vorschlaegeLaden, setVorschlaegeLaden] = useState(false)
  const [lagerwertVorschlaege, setLagerwertVorschlaege] = useState<Record<string, number>>({})
  const [lagerwerte, setLagerwerte] = useState<Record<string, string>>({})

  // Multi-select: Record<produktId, selectedTransaktionIds[]>
  const [transitSelections, setTransitSelections] = useState<Record<string, string[]>>({})
  const [transitBetrag, setTransitBetrag] = useState<Record<string, string>>({})
  const [transitTransaktionen, setTransitTransaktionen] = useState<Record<string, AusgabenKostenTransaktion[]>>({})
  const [transitLaden, setTransitLaden] = useState<Record<string, boolean>>({})
  const [expandedProducts, setExpandedProducts] = useState<Set<string>>(new Set())

  const [verbLlvVorschlag, setVerbLlvVorschlag] = useState(0)
  const [verbSonstigeVorschlag, setVerbSonstigeVorschlag] = useState(0)
  const [verbLlv, setVerbLlv] = useState('')
  const [verbSonstige, setVerbSonstige] = useState('')

  const [darlehenVorschlag, setDarlehenVorschlag] = useState(0)
  const [darlehenFremdkapital, setDarlehenFremdkapital] = useState(0)
  const [darlehenTilgungen, setDarlehenTilgungen] = useState(0)
  const [darlehensvb, setDarlehensvb] = useState('')

  const [anlageVorschlag, setAnlageVorschlag] = useState(0)
  const [anlagevermoegen, setAnlagevermoegen] = useState('')

  const [forderungen, setForderungen] = useState<Record<string, string>>({})

  const [steuerVon, setSteuerVon] = useState('')
  const [steuerBis, setSteuerBis] = useState('')
  const [steuerLaden, setSteuerLaden] = useState(false)
  const [steuerSaldoBerechnet, setSteuerSaldoBerechnet] = useState<number | null>(null)
  const [steuerFehler, setSteuerFehler] = useState<string | null>(null)
  const [steuerTyp, setSteuerTyp] = useState<'forderung' | 'verbindlichkeit' | null>(null)
  const [steuerBetrag, setSteuerBetrag] = useState('')

  const [cashVorschlag, setCashVorschlag] = useState(0)
  const [cashBestand, setCashBestand] = useState('')

  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)

  const resetForm = useCallback(() => {
    setStep(1)
    setDatum(today())
    setLagerwertVorschlaege({})
    setLagerwerte({})
    setTransitSelections({})
    setTransitBetrag({})
    setTransitTransaktionen({})
    setTransitLaden({})
    setExpandedProducts(new Set())
    setVerbLlvVorschlag(0)
    setVerbSonstigeVorschlag(0)
    setVerbLlv('')
    setVerbSonstige('')
    setDarlehenVorschlag(0)
    setDarlehenFremdkapital(0)
    setDarlehenTilgungen(0)
    setDarlehensvb('')
    setAnlageVorschlag(0)
    setAnlagevermoegen('')
    setForderungen({})
    setSteuerVon('')
    setSteuerBis('')
    setSteuerSaldoBerechnet(null)
    setSteuerFehler(null)
    setSteuerTyp(null)
    setSteuerBetrag('')
    setCashVorschlag(0)
    setCashBestand('')
    setSaveError(null)
  }, [])

  useEffect(() => {
    if (!open) return
    resetForm()
  }, [open, resetForm])

  const loadVorschlaegeFn = useCallback(async (d: string) => {
    if (!d) return
    setVorschlaegeLaden(true)
    const v = await loadVorschlaege(d)
    setLagerwertVorschlaege(v.lagerwerte)
    setLagerwerte(
      Object.fromEntries(produkte.map((p) => [p.id, String(v.lagerwerte[p.id] ?? 0)]))
    )
    setVerbLlvVorschlag(v.verbindlichkeiten_llv)
    setVerbSonstigeVorschlag(v.verbindlichkeiten_sonstige)
    setVerbLlv(String(v.verbindlichkeiten_llv))
    setVerbSonstige(String(v.verbindlichkeiten_sonstige))
    setDarlehenVorschlag(v.darlehensvb)
    setDarlehenFremdkapital(v.darlehensvb_fremdkapital)
    setDarlehenTilgungen(v.darlehensvb_tilgungen)
    setDarlehensvb(String(v.darlehensvb))
    setAnlageVorschlag(v.anlagevermoegen)
    setAnlagevermoegen(String(v.anlagevermoegen))
    setCashVorschlag(v.cash_bestand)
    setCashBestand(String(v.cash_bestand))
    setVorschlaegeLaden(false)
  }, [produkte])

  useEffect(() => {
    if (open && datum) loadVorschlaegeFn(datum)
  }, [open, datum, loadVorschlaegeFn])

  const loadTransitTransaktionen = useCallback(async (produktId: string) => {
    if (transitTransaktionen[produktId] !== undefined) return
    if (!produktKategorieId) return
    setTransitLaden((prev) => ({ ...prev, [produktId]: true }))
    try {
      const params = new URLSearchParams({
        kategorie_ids: produktKategorieId,
        produkt_ids: produktId,
        page: '1',
        sortColumn: 'leistungsdatum',
        sortDirection: 'desc',
      })
      const res = await fetch(`/api/ausgaben-kosten-transaktionen?${params}`)
      if (res.ok) {
        const json = await res.json()
        setTransitTransaktionen((prev) => ({ ...prev, [produktId]: json.data ?? [] }))
      } else {
        setTransitTransaktionen((prev) => ({ ...prev, [produktId]: [] }))
      }
    } catch {
      setTransitTransaktionen((prev) => ({ ...prev, [produktId]: [] }))
    } finally {
      setTransitLaden((prev) => ({ ...prev, [produktId]: false }))
    }
  }, [produktKategorieId, transitTransaktionen])

  const toggleProductExpand = (produktId: string) => {
    setExpandedProducts((prev) => {
      const next = new Set(prev)
      if (next.has(produktId)) {
        next.delete(produktId)
      } else {
        next.add(produktId)
        loadTransitTransaktionen(produktId)
      }
      return next
    })
  }

  const toggleTransitSelection = (produktId: string, txId: string, transaktionen: AusgabenKostenTransaktion[]) => {
    setTransitSelections((prev) => {
      const current = prev[produktId] ?? []
      const next = current.includes(txId)
        ? current.filter((id) => id !== txId)
        : [...current, txId]
      // Auto-update transit amount: sum of selected betrag_netto values
      const sum = next.reduce((acc, id) => {
        const tx = transaktionen.find((t) => t.id === id)
        return acc + (tx ? tx.betrag_netto : 0)
      }, 0)
      setTransitBetrag((prev2) => ({ ...prev2, [produktId]: String(Math.round(sum * 100) / 100) }))
      return { ...prev, [produktId]: next }
    })
  }

  const berechneSteuer = useCallback(async (von: string, bis: string) => {
    if (!von || !bis) { setSteuerSaldoBerechnet(null); return }
    if (von > bis) { setSteuerFehler('„Von" darf nicht nach „Bis" liegen'); setSteuerSaldoBerechnet(null); return }
    setSteuerFehler(null)
    setSteuerLaden(true)
    try {
      const params = new URLSearchParams({ von, bis, granularitaet: 'monat' })
      const res = await fetch(`/api/reporting/umsatzsteuer?${params}`)
      if (!res.ok) throw new Error()
      const data = await res.json()
      const saldo = Object.values(data.faelligeUst as Record<string, number>).reduce((a, b) => a + b, 0)
      setSteuerSaldoBerechnet(saldo)
      const abs = Math.abs(saldo)
      setSteuerBetrag(String(abs))
      setSteuerTyp(saldo > 0 ? 'verbindlichkeit' : saldo < 0 ? 'forderung' : null)
    } catch {
      setSteuerSaldoBerechnet(null)
    } finally {
      setSteuerLaden(false)
    }
  }, [])

  useEffect(() => {
    if (step === 6 && steuerVon && steuerBis) berechneSteuer(steuerVon, steuerBis)
  }, [step, steuerVon, steuerBis, berechneSteuer])

  const handleSave = async () => {
    setSaveError(null)
    setSaving(true)
    const input: VermoegenswertInput = {
      datum,
      lagerwerte: produkte.map((p) => ({ produkt_id: p.id, lagerwert: parseFloat(lagerwerte[p.id] ?? '0') || 0 })),
      transitwerte: produkte.map((p) => ({
        produkt_id: p.id,
        ausgaben_transaktion_id: null,
        transitwert: parseFloat(transitBetrag[p.id] ?? '0') || 0,
      })),
      verbindlichkeiten_llv: parseFloat(verbLlv) || 0,
      verbindlichkeiten_sonstige: parseFloat(verbSonstige) || 0,
      darlehensvb: parseFloat(darlehensvb) || 0,
      forderungen: [
        ...plattformen.map((pl) => ({ plattform_id: pl.id, betrag: parseFloat(forderungen[pl.id] ?? '0') || 0 })),
        { plattform_id: null, betrag: parseFloat(forderungen['sonstige'] ?? '0') || 0 },
      ],
      steuersaldo_typ: steuerTyp,
      steuersaldo: steuerTyp ? (parseFloat(steuerBetrag) || 0) : null,
      steuersaldo_von: steuerVon ? `${steuerVon}-01` : null,
      steuersaldo_bis: steuerBis ? `${steuerBis}-01` : null,
      cash_bestand: parseFloat(cashBestand) || 0,
      anlagevermoegen: parseFloat(anlagevermoegen) || 0,
    }
    const err = await onSave(input)
    setSaving(false)
    if (err) { setSaveError(err); return }
    onOpenChange(false)
  }

  const canGoNext = step < 8
  const isLastStep = step === 8

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[80vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>Neue Erfassung — Schritt {step} von {STEPS.length}: {STEPS[step - 1]}</DialogTitle>
        </DialogHeader>

        {/* Stepper */}
        <div className="flex gap-1 mb-4">
          {STEPS.map((_, i) => (
            <div
              key={i}
              className={`h-1.5 flex-1 rounded-full transition-colors ${i < step ? 'bg-primary' : 'bg-muted'}`}
            />
          ))}
        </div>

        <div className="overflow-y-auto flex-1 pr-1">
          {step === 1 && (
            <div className="space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="datum">Stichtag *</Label>
                <Input
                  id="datum"
                  type="date"
                  value={datum}
                  onChange={(e) => setDatum(e.target.value)}
                  required
                />
              </div>
              <div className="space-y-3">
                {vorschlaegeLaden ? (
                  <div className="space-y-2">
                    {[...Array(3)].map((_, i) => <Skeleton key={i} className="h-10 w-full" />)}
                  </div>
                ) : produkte.length === 0 ? (
                  <p className="text-sm text-muted-foreground">
                    Keine Produkte im KPI-Modell gepflegt.{' '}
                    <a href="/dashboard/kpi-modell" className="underline">Zum KPI-Modell</a>
                  </p>
                ) : (
                  produkte.map((p) => {
                    const vorschlag = lagerwertVorschlaege[p.id] ?? 0
                    const isVorschlag = lagerwerte[p.id] === String(vorschlag)
                    return (
                      <div key={p.id} className="space-y-1">
                        <Label htmlFor={`lager-${p.id}`}>{p.name}</Label>
                        <div className="relative">
                          <Input
                            id={`lager-${p.id}`}
                            type="number"
                            min={0}
                            step="0.01"
                            value={lagerwerte[p.id] ?? '0'}
                            onChange={(e) => setLagerwerte((prev) => ({ ...prev, [p.id]: e.target.value }))}
                            className={isVorschlag ? 'bg-muted/50' : ''}
                          />
                          {isVorschlag && (
                            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">
                              auto
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-muted-foreground">Vorschlag: {fmt(vorschlag)}</p>
                      </div>
                    )
                  })
                )}
              </div>
            </div>
          )}

          {step === 2 && (
            <div className="space-y-2">
              <p className="text-sm text-muted-foreground mb-3">
                Klicken Sie auf ein Produkt, um Einkaufstransaktionen auszuwählen.
                Die Netto-Beträge werden addiert und als Transit-Warenwert vorgeschlagen.
              </p>
              {produkte.length === 0 ? (
                <p className="text-sm text-muted-foreground">Keine Produkte im KPI-Modell.</p>
              ) : (
                produkte.map((p) => {
                  const transaktionen = transitTransaktionen[p.id] ?? []
                  const laden = transitLaden[p.id]
                  const selected = transitSelections[p.id] ?? []
                  const isExpanded = expandedProducts.has(p.id)
                  const selectedSum = selected.reduce((acc, id) => {
                    const tx = transaktionen.find((t) => t.id === id)
                    return acc + (tx ? tx.betrag_netto : 0)
                  }, 0)

                  return (
                    <div key={p.id} className="border rounded-md overflow-hidden">
                      {/* Kollabierbare Kopfzeile */}
                      <button
                        type="button"
                        className="w-full flex items-center gap-2 px-3 py-2.5 hover:bg-muted/40 text-left transition-colors"
                        onClick={() => toggleProductExpand(p.id)}
                      >
                        <ChevronRight
                          className={`h-4 w-4 shrink-0 text-muted-foreground transition-transform ${isExpanded ? 'rotate-90' : ''}`}
                        />
                        <span className="text-sm font-medium flex-1">{p.name}</span>
                        {selected.length > 0 && (
                          <span className="text-xs text-muted-foreground">
                            {selected.length} ausgewählt — {fmt(selectedSum)}
                          </span>
                        )}
                      </button>

                      {/* Aufgeklappter Bereich */}
                      {isExpanded && (
                        <div className="px-3 pb-3 border-t space-y-3">
                          {laden ? (
                            <div className="space-y-2 mt-3">
                              {[...Array(2)].map((_, i) => <Skeleton key={i} className="h-8 w-full" />)}
                            </div>
                          ) : transaktionen.length === 0 ? (
                            <p className="text-xs text-muted-foreground mt-2">
                              Keine Produktkosten-Transaktionen vorhanden.
                            </p>
                          ) : (
                            <div className="max-h-40 overflow-y-auto space-y-1.5 pr-1 mt-2">
                              {transaktionen.map((tx) => (
                                <div
                                  key={tx.id}
                                  className="flex items-start gap-2 rounded px-2 py-1.5 hover:bg-muted/40 cursor-pointer"
                                  onClick={() => toggleTransitSelection(p.id, tx.id, transaktionen)}
                                >
                                  <Checkbox
                                    id={`tx-${p.id}-${tx.id}`}
                                    checked={selected.includes(tx.id)}
                                    onCheckedChange={() => toggleTransitSelection(p.id, tx.id, transaktionen)}
                                    onClick={(e) => e.stopPropagation()}
                                    className="mt-0.5 shrink-0"
                                  />
                                  <label htmlFor={`tx-${p.id}-${tx.id}`} className="text-xs leading-snug cursor-pointer flex-1">
                                    <span className="font-medium">{fmtDatum(tx.leistungsdatum ?? '')}</span>
                                    {' — '}
                                    <span className="text-primary font-medium">{fmt(tx.betrag_netto)}</span>
                                    {tx.beschreibung && (
                                      <span className="text-muted-foreground"> — {tx.beschreibung}</span>
                                    )}
                                  </label>
                                </div>
                              ))}
                            </div>
                          )}

                          <div className="space-y-1 border-t pt-2">
                            <Label htmlFor={`transit-${p.id}`}>Transit-Betrag (€)</Label>
                            <Input
                              id={`transit-${p.id}`}
                              type="number"
                              min={0}
                              step="0.01"
                              value={transitBetrag[p.id] ?? '0'}
                              onChange={(e) => setTransitBetrag((prev) => ({ ...prev, [p.id]: e.target.value }))}
                              className={selected.length > 0 && transitBetrag[p.id] === String(Math.round(selectedSum * 100) / 100) ? 'bg-muted/50' : ''}
                            />
                            {selected.length > 0 && (
                              <p className="text-xs text-muted-foreground">Kann manuell überschrieben werden</p>
                            )}
                          </div>
                        </div>
                      )}

                      {/* Transit-Betrag auch im kollabierten Zustand editierbar */}
                      {!isExpanded && (
                        <div className="px-3 pb-2.5 pt-0 flex items-center gap-2 border-t">
                          <span className="text-xs text-muted-foreground shrink-0">Transit (€)</span>
                          <Input
                            type="number"
                            min={0}
                            step="0.01"
                            value={transitBetrag[p.id] ?? '0'}
                            onChange={(e) => setTransitBetrag((prev) => ({ ...prev, [p.id]: e.target.value }))}
                            className="h-7 text-xs"
                          />
                        </div>
                      )}
                    </div>
                  )
                })
              )}
            </div>
          )}

          {step === 3 && (
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">
                Automatisch berechnet aus offenen Ausgaben ohne Zahlungsdatum.
              </p>
              <div className="space-y-1">
                <Label htmlFor="verb-llv">Verbindlichkeiten aus Lieferung und Leistung (€)</Label>
                <Input
                  id="verb-llv"
                  type="number"
                  min={0}
                  step="0.01"
                  value={verbLlv}
                  onChange={(e) => setVerbLlv(e.target.value)}
                  className={verbLlv === String(verbLlvVorschlag) ? 'bg-muted/50' : ''}
                />
                <p className="text-xs text-muted-foreground">Vorschlag: {fmt(verbLlvVorschlag)}</p>
              </div>
              <div className="space-y-1">
                <Label htmlFor="verb-sonstige">Sonstige Verbindlichkeiten (€)</Label>
                <Input
                  id="verb-sonstige"
                  type="number"
                  min={0}
                  step="0.01"
                  value={verbSonstige}
                  onChange={(e) => setVerbSonstige(e.target.value)}
                  className={verbSonstige === String(verbSonstigeVorschlag) ? 'bg-muted/50' : ''}
                />
                <p className="text-xs text-muted-foreground">Vorschlag: {fmt(verbSonstigeVorschlag)}</p>
              </div>
            </div>
          )}

          {step === 4 && (
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">
                Automatisch berechnet aus allen Fremdkapitaleinnahmen abzüglich bisheriger Tilgungen.
              </p>
              <div className="rounded-md border bg-muted/20 px-3 py-2 text-xs space-y-1">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Fremdkapitaleinnahmen</span>
                  <span className="font-medium tabular-nums">{fmt(darlehenFremdkapital)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">− Tilgungen</span>
                  <span className="font-medium tabular-nums">{fmt(darlehenTilgungen)}</span>
                </div>
                <div className="flex justify-between border-t pt-1 mt-1">
                  <span className="text-muted-foreground font-medium">= Vorschlag</span>
                  <span className="font-semibold tabular-nums">{fmt(darlehenVorschlag)}</span>
                </div>
              </div>
              <div className="space-y-1">
                <Label htmlFor="darlehen">Darlehensverbindlichkeiten (€)</Label>
                <Input
                  id="darlehen"
                  type="number"
                  min={0}
                  step="0.01"
                  value={darlehensvb}
                  onChange={(e) => setDarlehensvb(e.target.value)}
                  className={darlehensvb === String(darlehenVorschlag) ? 'bg-muted/50' : ''}
                />
                <p className="text-xs text-muted-foreground">Vorschlag: {fmt(darlehenVorschlag)}</p>
              </div>
            </div>
          )}

          {step === 5 && (
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">
                Geben Sie die offenen Forderungen je Plattform manuell ein.
              </p>
              {plattformen.map((pl) => (
                <div key={pl.id} className="space-y-1">
                  <Label htmlFor={`ford-${pl.id}`}>Forderungen {pl.name} (€)</Label>
                  <Input
                    id={`ford-${pl.id}`}
                    type="number"
                    min={0}
                    step="0.01"
                    value={forderungen[pl.id] ?? '0'}
                    onChange={(e) => setForderungen((prev) => ({ ...prev, [pl.id]: e.target.value }))}
                  />
                </div>
              ))}
              <div className="space-y-1">
                <Label htmlFor="ford-sonstige">Sonstige Forderungen (€)</Label>
                <Input
                  id="ford-sonstige"
                  type="number"
                  min={0}
                  step="0.01"
                  value={forderungen['sonstige'] ?? '0'}
                  onChange={(e) => setForderungen((prev) => ({ ...prev, sonstige: e.target.value }))}
                />
              </div>
            </div>
          )}

          {step === 6 && (
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">
                Wählen Sie optional einen Zeitraum für die automatische Steuerberechnung.
              </p>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label htmlFor="steuer-von">Von Monat</Label>
                  <Input
                    id="steuer-von"
                    type="month"
                    value={steuerVon}
                    onChange={(e) => setSteuerVon(e.target.value)}
                  />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="steuer-bis">Bis Monat</Label>
                  <Input
                    id="steuer-bis"
                    type="month"
                    value={steuerBis}
                    onChange={(e) => setSteuerBis(e.target.value)}
                  />
                </div>
              </div>
              {steuerFehler && <p className="text-sm text-destructive">{steuerFehler}</p>}
              {steuerLaden && <Skeleton className="h-6 w-48" />}
              {!steuerLaden && steuerSaldoBerechnet !== null && (
                <p className="text-sm font-medium">
                  {steuerSaldoBerechnet > 0
                    ? `Steuerverbindlichkeit: ${fmt(steuerSaldoBerechnet)}`
                    : steuerSaldoBerechnet < 0
                    ? `Steuerforderung: ${fmt(Math.abs(steuerSaldoBerechnet))}`
                    : 'Kein offener Steuersaldo'}
                </p>
              )}
              <div className="space-y-2">
                <Label>Typ</Label>
                <RadioGroup
                  value={steuerTyp ?? ''}
                  onValueChange={(v) => setSteuerTyp(v as 'forderung' | 'verbindlichkeit' || null)}
                  className="flex gap-4"
                >
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="verbindlichkeit" id="typ-verb" />
                    <Label htmlFor="typ-verb">Steuerverbindlichkeit</Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="forderung" id="typ-ford" />
                    <Label htmlFor="typ-ford">Steuerforderung</Label>
                  </div>
                </RadioGroup>
              </div>
              <div className="space-y-1">
                <Label htmlFor="steuer-betrag">Betrag (€, absolut)</Label>
                <Input
                  id="steuer-betrag"
                  type="number"
                  min={0}
                  step="0.01"
                  value={steuerBetrag}
                  onChange={(e) => setSteuerBetrag(e.target.value)}
                />
              </div>
            </div>
          )}

          {step === 7 && (
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">
                Kumulierter Kontostand aus dem Liquiditätsreport bis zum Stichtag.
              </p>
              <div className="space-y-1">
                <Label htmlFor="cash">Cash-Bestand (€)</Label>
                <Input
                  id="cash"
                  type="number"
                  step="0.01"
                  value={cashBestand}
                  onChange={(e) => setCashBestand(e.target.value)}
                  className={cashBestand === String(cashVorschlag) ? 'bg-muted/50' : ''}
                />
                <p className="text-xs text-muted-foreground">Vorschlag: {fmt(cashVorschlag)}</p>
              </div>
            </div>
          )}

          {step === 8 && (
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">
                Automatisch berechnet: Anschaffungskosten aller Investitionen abzüglich der bis zum Stichtag
                kumulierten Abschreibungen.
              </p>
              <div className="space-y-1">
                <Label htmlFor="anlage">Anlagevermögen (€, Netto-Buchwert)</Label>
                <Input
                  id="anlage"
                  type="number"
                  min={0}
                  step="0.01"
                  value={anlagevermoegen}
                  onChange={(e) => setAnlagevermoegen(e.target.value)}
                  className={anlagevermoegen === String(anlageVorschlag) ? 'bg-muted/50' : ''}
                />
                <p className="text-xs text-muted-foreground">Vorschlag: {fmt(anlageVorschlag)}</p>
              </div>
              {saveError && <p className="text-sm text-destructive">{saveError}</p>}
            </div>
          )}
        </div>

        <DialogFooter className="pt-4 flex justify-between">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Abbrechen
          </Button>
          <div className="flex gap-2">
            {step > 1 && (
              <Button variant="outline" onClick={() => setStep((s) => s - 1)}>
                Zurück
              </Button>
            )}
            {canGoNext && (
              <Button onClick={() => setStep((s) => s + 1)}>
                Weiter
              </Button>
            )}
            {isLastStep && (
              <Button onClick={handleSave} disabled={saving || !datum}>
                {saving ? 'Speichern…' : 'Speichern'}
              </Button>
            )}
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
