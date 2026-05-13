'use client'

import { useState, useEffect } from 'react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Alert, AlertDescription } from '@/components/ui/alert'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible'
import { ChevronDown } from 'lucide-react'
import { type KpiCategory } from '@/hooks/use-kpi-categories'
import {
  type ProduktkostenZeitraum,
  type ProduktkostenFormData,
} from '@/hooks/use-produktkosten'

interface AusgabenTransaktion {
  id: string
  leistungsdatum: string
  beschreibung: string | null
  betrag_netto: number
  kategorie_id: string
  gruppe_id: string | null
}

interface Props {
  open: boolean
  onOpenChange: (open: boolean) => void
  produktId: string
  kostenkategorien: KpiCategory[]
  zeitraeume: ProduktkostenZeitraum[]
  zeitraumToEdit: ProduktkostenZeitraum | null
  onSave: (data: ProduktkostenFormData) => Promise<void>
}

function round2(n: number): number {
  return Math.round(n * 100) / 100
}

function formatEur(n: number): string {
  return n.toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' €'
}

function formatDate(s: string): string {
  const [y, m, d] = s.split('-')
  return `${d}.${m}.${y}`
}

export function ProduktkostenAssistentDialog({
  open,
  onOpenChange,
  produktId,
  kostenkategorien,
  zeitraeume,
  zeitraumToEdit,
  onSave,
}: Props) {
  const [step, setStep] = useState<1 | 2 | 3>(1)

  // Step 1
  const [gueltigVon, setGueltigVon] = useState('')
  const [gueltigBis, setGueltigBis] = useState('')

  // Step 2
  const [transaktionen, setTransaktionen] = useState<AusgabenTransaktion[]>([])
  const [txLoading, setTxLoading] = useState(false)
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [menge, setMenge] = useState('')
  const [showAlt, setShowAlt] = useState(true)
  const [altId, setAltId] = useState('')
  const [altRestmenge, setAltRestmenge] = useState('')

  // Step 3
  const [werte, setWerte] = useState<Record<string, string>>({})
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)

  useEffect(() => {
    if (!open) return
    setSaveError(null)
    setSelectedIds(new Set())
    setMenge('')
    setShowAlt(true)
    setAltId('')
    setAltRestmenge('')

    if (zeitraumToEdit) {
      setStep(3)
      setGueltigVon(zeitraumToEdit.gueltig_von)
      setGueltigBis(zeitraumToEdit.gueltig_bis ?? '')
      // Pre-fill step 2 with stored calculation basis
      if (zeitraumToEdit.berechnungs_transaktions_ids) {
        setSelectedIds(new Set(zeitraumToEdit.berechnungs_transaktions_ids))
      }
      setMenge(zeitraumToEdit.berechnungs_menge != null ? String(zeitraumToEdit.berechnungs_menge) : '')
      setAltId(zeitraumToEdit.berechnungs_alt_zeitraum_id ?? '')
      setAltRestmenge(zeitraumToEdit.berechnungs_alt_restmenge != null ? String(zeitraumToEdit.berechnungs_alt_restmenge) : '')
      // Pre-fill step 3 werte
      const initial: Record<string, string> = {}
      zeitraumToEdit.werte.forEach(w => {
        initial[w.kategorie_id] = String(w.wert)
      })
      setWerte(initial)
    } else {
      setStep(1)
      setGueltigVon('')
      setGueltigBis('')
      setWerte({})
    }
  }, [open, zeitraumToEdit])

  // Transactions store kategorie_id = level-1 parent, gruppe_id = level-2 subcategory
  const produktKategorieId = kostenkategorien[0]?.parent_id ?? null

  useEffect(() => {
    if (!open || !produktKategorieId) {
      setTransaktionen([])
      return
    }
    setTxLoading(true)
    fetch(
      `/api/ausgaben-kosten-transaktionen?produkt_ids=${produktId}&kategorie_ids=${produktKategorieId}`
    )
      .then(r => r.json())
      .then(json => setTransaktionen(json.data ?? []))
      .catch(() => setTransaktionen([]))
      .finally(() => setTxLoading(false))
  }, [open, produktId, produktKategorieId])

  const mengeNum = parseFloat(menge)
  const altRestmengeNum = parseFloat(altRestmenge)

  const step1Valid = !!gueltigVon && (!gueltigBis || gueltigBis >= gueltigVon)

  const altValid =
    !showAlt || !altId || (altRestmenge !== '' && !isNaN(altRestmengeNum) && altRestmengeNum >= 0)
  const step2Valid =
    selectedIds.size > 0 && !isNaN(mengeNum) && mengeNum > 0 && altValid && transaktionen.length > 0

  function calculateWerte(): Record<string, string> {
    const newUnitCosts: Record<string, number> = {}

    for (const k of kostenkategorien) {
      const sum = [...selectedIds]
        .map(id => transaktionen.find(t => t.id === id))
        .filter((t): t is AusgabenTransaktion => !!t && t.gruppe_id === k.id)
        .reduce((acc, t) => acc + Number(t.betrag_netto), 0)
      newUnitCosts[k.id] = mengeNum > 0 ? sum / mengeNum : 0
    }

    if (showAlt && altId) {
      const altZ = zeitraeume.find(z => z.id === altId)
      const altMenge = !isNaN(altRestmengeNum) && altRestmengeNum >= 0 ? altRestmengeNum : 0
      const totalMenge = mengeNum + altMenge

      for (const k of kostenkategorien) {
        const altPreis = Number(altZ?.werte.find(w => w.kategorie_id === k.id)?.wert ?? 0)
        const newPreis = newUnitCosts[k.id] ?? 0
        newUnitCosts[k.id] =
          totalMenge > 0 ? (altPreis * altMenge + newPreis * mengeNum) / totalMenge : 0
      }
    }

    const result: Record<string, string> = {}
    for (const k of kostenkategorien) {
      result[k.id] = round2(newUnitCosts[k.id] ?? 0).toFixed(2)
    }
    return result
  }

  function goToStep3() {
    setWerte(calculateWerte())
    setSaveError(null)
    setStep(3)
  }

  const hasNegativeWert = kostenkategorien.some(
    k => werte[k.id] !== undefined && werte[k.id] !== '' && Number(werte[k.id]) < 0
  )
  const step3Valid = kostenkategorien.every(k => {
    const v = werte[k.id]
    return v !== undefined && v !== '' && !isNaN(Number(v)) && Number(v) >= 0
  })

  const totalWert = kostenkategorien.reduce((acc, k) => acc + (Number(werte[k.id]) || 0), 0)

  async function handleSave() {
    if (!step3Valid) return
    setSaving(true)
    setSaveError(null)
    try {
      await onSave({
        gueltig_von: gueltigVon,
        gueltig_bis: gueltigBis || null,
        werte: kostenkategorien.map(k => ({
          kategorie_id: k.id,
          wert: Number(werte[k.id] ?? 0),
        })),
        berechnungs_menge: mengeNum > 0 ? mengeNum : null,
        berechnungs_transaktions_ids: selectedIds.size > 0 ? [...selectedIds] : null,
        berechnungs_alt_zeitraum_id: showAlt && altId ? altId : null,
        berechnungs_alt_restmenge: showAlt && altId && !isNaN(altRestmengeNum) ? altRestmengeNum : null,
      })
      onOpenChange(false)
    } catch (e) {
      setSaveError(e instanceof Error ? e.message : 'Fehler beim Speichern')
    } finally {
      setSaving(false)
    }
  }

  function toggleSelect(id: string) {
    setSelectedIds(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const katNameById = Object.fromEntries(kostenkategorien.map(k => [k.id, k.name]))
  const selectedCount = selectedIds.size
  const altZeitraum = zeitraeume.find(z => z.id === altId)
  // When editing, exclude the current zeitraum from the alt-period dropdown
  const altZeitraumOptions = zeitraumToEdit
    ? zeitraeume.filter(z => z.id !== zeitraumToEdit.id)
    : zeitraeume

  const isEditMode = !!zeitraumToEdit

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>{isEditMode ? 'Zeitraum bearbeiten' : 'Neuer Zeitraum'}</DialogTitle>
          <p className="text-xs text-muted-foreground">Schritt {step} von 3</p>
        </DialogHeader>

        {/* ── Step 1: Zeitraum ── */}
        {step === 1 && (
          <div className="space-y-4 py-2">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label htmlFor="gueltig_von">Gültig von *</Label>
                <Input
                  id="gueltig_von"
                  type="date"
                  value={gueltigVon}
                  onChange={e => setGueltigVon(e.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="gueltig_bis">Gültig bis</Label>
                <Input
                  id="gueltig_bis"
                  type="date"
                  value={gueltigBis}
                  onChange={e => setGueltigBis(e.target.value)}
                />
              </div>
            </div>
            {gueltigVon && gueltigBis && gueltigBis < gueltigVon && (
              <p className="text-xs text-destructive">Gültig bis muss nach Gültig von liegen.</p>
            )}
          </div>
        )}

        {/* ── Step 2: Transaktionsauswahl ── */}
        {step === 2 && (
          <div className="space-y-4 py-2">
            {txLoading ? (
              <div className="py-8 text-center text-sm text-muted-foreground">
                Transaktionen werden geladen…
              </div>
            ) : transaktionen.length === 0 ? (
              <div className="rounded-lg border bg-muted/30 p-6 text-center space-y-2">
                <p className="font-medium text-sm">Keine Transaktionen vorhanden</p>
                <p className="text-xs text-muted-foreground">
                  Für dieses Produkt wurden noch keine Ausgaben & Kosten mit Produktkategorie
                  erfasst.
                </p>
                <a href="/dashboard/ausgaben">
                  <Button variant="outline" size="sm" className="mt-1">
                    Zu Ausgaben & Kosten
                  </Button>
                </a>
              </div>
            ) : (
              <>
                <div>
                  <p className="text-sm font-medium mb-2">
                    Transaktionen auswählen
                    {selectedCount > 0 && (
                      <span className="ml-2 font-normal text-muted-foreground">
                        ({selectedCount} ausgewählt)
                      </span>
                    )}
                  </p>
                  <div className="rounded-md border max-h-52 overflow-y-auto">
                    <table className="w-full text-sm">
                      <thead className="sticky top-0 bg-muted/50">
                        <tr>
                          <th className="p-2 w-8" />
                          <th className="p-2 text-left font-medium">Datum</th>
                          <th className="p-2 text-left font-medium">Beschreibung</th>
                          <th className="p-2 text-left font-medium">Kategorie</th>
                          <th className="p-2 text-right font-medium">Netto</th>
                        </tr>
                      </thead>
                      <tbody>
                        {transaktionen.map(t => (
                          <tr
                            key={t.id}
                            className="border-t cursor-pointer hover:bg-muted/30"
                            onClick={() => toggleSelect(t.id)}
                          >
                            <td className="p-2">
                              <Checkbox
                                checked={selectedIds.has(t.id)}
                                onCheckedChange={() => toggleSelect(t.id)}
                                onClick={e => e.stopPropagation()}
                              />
                            </td>
                            <td className="p-2 whitespace-nowrap">
                              {formatDate(t.leistungsdatum)}
                            </td>
                            <td className="p-2 text-muted-foreground max-w-[180px] truncate">
                              {t.beschreibung ?? '—'}
                            </td>
                            <td className="p-2 whitespace-nowrap">
                              {t.gruppe_id ? (katNameById[t.gruppe_id] ?? '—') : '—'}
                            </td>
                            <td className="p-2 text-right whitespace-nowrap">
                              {formatEur(Number(t.betrag_netto))}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  {selectedCount === 0 && (
                    <p className="text-xs text-muted-foreground mt-1">
                      Bitte mindestens eine Transaktion auswählen.
                    </p>
                  )}
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="menge">Einkaufsmenge *</Label>
                  <Input
                    id="menge"
                    type="number"
                    min="0.01"
                    step="1"
                    placeholder="z.B. 500"
                    value={menge}
                    onChange={e => setMenge(e.target.value)}
                    className="max-w-[180px]"
                  />
                  {menge !== '' && (isNaN(mengeNum) || mengeNum <= 0) && (
                    <p className="text-xs text-destructive">Menge muss größer als 0 sein.</p>
                  )}
                </div>

                <Collapsible open={showAlt} onOpenChange={setShowAlt}>
                  <CollapsibleTrigger asChild>
                    <Button variant="ghost" size="sm" className="gap-1 px-0 text-sm h-auto">
                      <ChevronDown
                        className={`h-4 w-4 transition-transform ${showAlt ? 'rotate-180' : ''}`}
                      />
                      Alter Zeitraum einbeziehen (optional)
                    </Button>
                  </CollapsibleTrigger>
                  <CollapsibleContent className="mt-3 space-y-3">
                    {altZeitraumOptions.length === 0 ? (
                      <p className="text-sm text-muted-foreground">
                        Noch keine Zeiträume für dieses Produkt vorhanden.
                      </p>
                    ) : (
                      <>
                        <div className="space-y-1.5">
                          <Label>Zeitraum auswählen</Label>
                          <Select value={altId} onValueChange={setAltId}>
                            <SelectTrigger className="max-w-xs">
                              <SelectValue placeholder="Zeitraum wählen…" />
                            </SelectTrigger>
                            <SelectContent>
                              {altZeitraumOptions.map(z => (
                                <SelectItem key={z.id} value={z.id}>
                                  {formatDate(z.gueltig_von)} –{' '}
                                  {z.gueltig_bis ? formatDate(z.gueltig_bis) : 'offen'}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                        {altId && (
                          <div className="space-y-1.5">
                            <Label htmlFor="altRestmenge">Restmenge (alter Zeitraum) *</Label>
                            <Input
                              id="altRestmenge"
                              type="number"
                              min="0"
                              step="1"
                              placeholder="z.B. 120"
                              value={altRestmenge}
                              onChange={e => setAltRestmenge(e.target.value)}
                              className="max-w-[180px]"
                            />
                            {altRestmenge !== '' &&
                              (isNaN(altRestmengeNum) || altRestmengeNum < 0) && (
                                <p className="text-xs text-destructive">
                                  Restmenge darf nicht negativ sein.
                                </p>
                              )}
                          </div>
                        )}
                      </>
                    )}
                  </CollapsibleContent>
                </Collapsible>
              </>
            )}
          </div>
        )}

        {/* ── Step 3: Vorschau ── */}
        {step === 3 && (
          <div className="space-y-4 py-2">
            {/* Context info */}
            <div className="rounded-md bg-muted/40 px-3 py-2.5 text-sm space-y-0.5">
              <div className="flex gap-1.5">
                <span className="text-muted-foreground">Zeitraum:</span>
                <span>
                  {gueltigVon ? formatDate(gueltigVon) : '—'}
                  {' – '}
                  {gueltigBis ? formatDate(gueltigBis) : 'offen'}
                </span>
              </div>
              {selectedCount > 0 && menge !== '' && (
                <div className="flex gap-1.5">
                  <span className="text-muted-foreground">Basis:</span>
                  <span>
                    {selectedCount} Transaktion{selectedCount !== 1 ? 'en' : ''}, Menge {menge}
                    {showAlt && altId && altZeitraum && (
                      <>
                        {' + '}
                        {formatDate(altZeitraum.gueltig_von)} –{' '}
                        {altZeitraum.gueltig_bis
                          ? formatDate(altZeitraum.gueltig_bis)
                          : 'offen'}{' '}
                        (Restmenge {altRestmenge})
                      </>
                    )}
                  </span>
                </div>
              )}
            </div>

            {/* Cost table */}
            <div className="rounded-md border overflow-hidden">
              <div className="bg-muted/50 px-3 py-2 flex justify-between text-xs font-medium text-muted-foreground uppercase tracking-wide">
                <span>Kostenkategorie</span>
                <span>Stückkosten</span>
              </div>
              <div className="divide-y">
                {kostenkategorien.map(k => (
                  <div key={k.id} className="flex items-center justify-between px-3 py-2 gap-4">
                    <span className="text-sm">{k.name}</span>
                    <div className="flex items-center gap-1.5 shrink-0">
                      <Input
                        type="number"
                        min="0"
                        step="0.01"
                        value={werte[k.id] ?? ''}
                        onChange={e =>
                          setWerte(prev => ({ ...prev, [k.id]: e.target.value }))
                        }
                        className="w-28 text-right h-8 text-sm"
                      />
                      <span className="text-sm text-muted-foreground">€</span>
                    </div>
                  </div>
                ))}
                <div className="flex items-center justify-between px-3 py-2.5 bg-muted/20">
                  <span className="text-sm font-semibold">Gesamt</span>
                  <span className="text-sm font-semibold">{formatEur(round2(totalWert))}</span>
                </div>
              </div>
            </div>

            {hasNegativeWert && (
              <p className="text-xs text-destructive">Alle Werte müssen ≥ 0 sein.</p>
            )}

            {saveError && (
              <Alert variant="destructive">
                <AlertDescription>{saveError}</AlertDescription>
              </Alert>
            )}
          </div>
        )}

        <DialogFooter>
          {step > 1 && (
            <Button
              variant="outline"
              onClick={() => setStep(s => (s - 1) as 1 | 2 | 3)}
              disabled={saving}
            >
              Zurück
            </Button>
          )}
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
            Abbrechen
          </Button>
          {step === 1 && (
            <Button onClick={() => setStep(2)} disabled={!step1Valid}>
              Weiter
            </Button>
          )}
          {step === 2 && (
            <Button
              onClick={goToStep3}
              disabled={!step2Valid || txLoading || transaktionen.length === 0}
            >
              Weiter
            </Button>
          )}
          {step === 3 && (
            <Button onClick={handleSave} disabled={!step3Valid || saving}>
              {saving ? 'Speichern…' : 'Speichern'}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
