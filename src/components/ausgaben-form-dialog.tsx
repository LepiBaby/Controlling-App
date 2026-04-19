'use client'

import { useState, useEffect } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { KpiCategory } from '@/hooks/use-kpi-categories'
import { AusgabenKostenTransaktion, AusgabenKostenTransaktionInput } from '@/hooks/use-ausgaben-kosten-transaktionen'

const TODAY = new Date().toISOString().split('T')[0]

function computeUstBetrag(brutto: number, ustSatz: string, individuell: string): number {
  if (ustSatz === '19') return Math.round(brutto * 19 / 119 * 100) / 100
  if (ustSatz === '7') return Math.round(brutto * 7 / 107 * 100) / 100
  if (ustSatz === 'individuell') return Number(individuell) || 0
  return 0
}

interface AusgabenFormDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  transaktionToEdit: AusgabenKostenTransaktion | null
  ausgabenKategorien: KpiCategory[]
  salesPlattformen: KpiCategory[]
  produkte: KpiCategory[]
  onSave: (input: AusgabenKostenTransaktionInput) => Promise<void>
}

export function AusgabenFormDialog({
  open,
  onOpenChange,
  transaktionToEdit,
  ausgabenKategorien,
  salesPlattformen,
  produkte,
  onSave,
}: AusgabenFormDialogProps) {
  const [leistungsdatum, setLeistungsdatum] = useState(TODAY)
  const [zahlungsdatum, setZahlungsdatum] = useState('')
  const [betragBrutto, setBetragBrutto] = useState('')
  const [ustSatz, setUstSatz] = useState('')
  const [ustBetragIndividuell, setUstBetragIndividuell] = useState('')
  const [kategorieId, setKategorieId] = useState<string | null>(null)
  const [gruppeId, setGruppeId] = useState<string | null>(null)
  const [untergruppeId, setUntergruppeId] = useState<string | null>(null)
  const [salesPlattformId, setSalesPlattformId] = useState<string | null>(null)
  const [produktId, setProduktId] = useState<string | null>(null)
  const [beschreibung, setBeschreibung] = useState('')
  const [rentabilitaet, setRentabilitaet] = useState('')
  const [abschreibung, setAbschreibung] = useState('')
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)

  useEffect(() => {
    if (!open) return
    if (transaktionToEdit) {
      setLeistungsdatum(transaktionToEdit.leistungsdatum)
      setZahlungsdatum(transaktionToEdit.zahlungsdatum ?? '')
      setBetragBrutto(String(transaktionToEdit.betrag_brutto))
      setUstSatz(transaktionToEdit.ust_satz)
      setUstBetragIndividuell(
        transaktionToEdit.ust_satz === 'individuell' ? String(transaktionToEdit.ust_betrag) : ''
      )
      setKategorieId(transaktionToEdit.kategorie_id)
      setGruppeId(transaktionToEdit.gruppe_id)
      setUntergruppeId(transaktionToEdit.untergruppe_id)
      setSalesPlattformId(transaktionToEdit.sales_plattform_id)
      setProduktId(transaktionToEdit.produkt_id)
      setBeschreibung(transaktionToEdit.beschreibung ?? '')
      setRentabilitaet(transaktionToEdit.relevant_fuer_rentabilitaet ?? '')
      setAbschreibung(transaktionToEdit.abschreibung ?? '')
    } else {
      setLeistungsdatum(TODAY)
      setZahlungsdatum('')
      setBetragBrutto('')
      setUstSatz('')
      setUstBetragIndividuell('')
      setKategorieId(null)
      setGruppeId(null)
      setUntergruppeId(null)
      setSalesPlattformId(null)
      setProduktId(null)
      setBeschreibung('')
      setRentabilitaet('')
      setAbschreibung('')
    }
    setSaveError(null)
  }, [open, transaktionToEdit])

  const level1 = ausgabenKategorien.filter(c => c.level === 1)
  const selectedKategorie = ausgabenKategorien.find(c => c.id === kategorieId) ?? null
  const gruppen = ausgabenKategorien.filter(c => c.level === 2 && c.parent_id === kategorieId)
  const untergruppen = ausgabenKategorien.filter(c => c.level === 3 && c.parent_id === gruppeId)

  const showGruppe = gruppen.length > 0
  const showUntergruppe = gruppeId !== null && untergruppen.length > 0
  const showSalesPlattform = selectedKategorie?.sales_plattform_enabled === true
  const showProdukte = selectedKategorie?.produkt_enabled === true

  const brutto = Number(betragBrutto) || 0
  const ustBetrag = computeUstBetrag(brutto, ustSatz, ustBetragIndividuell)
  const nettoPreview = brutto - ustBetrag

  const futureDateWarning = leistungsdatum && new Date(leistungsdatum + 'T00:00:00') > new Date()

  const individuellInvalid =
    ustSatz === 'individuell' &&
    (Number(ustBetragIndividuell) <= 0 || Number(ustBetragIndividuell) >= brutto)

  const isValid =
    !!leistungsdatum &&
    brutto > 0 &&
    !!ustSatz &&
    !!kategorieId &&
    (ustSatz !== 'individuell' || (Number(ustBetragIndividuell) > 0 && Number(ustBetragIndividuell) < brutto)) &&
    (!showGruppe || !!gruppeId) &&
    (!showUntergruppe || !!untergruppeId) &&
    (!showSalesPlattform || !!salesPlattformId) &&
    (!showProdukte || !!produktId)

  const handleKategorieChange = (value: string) => {
    setKategorieId(value)
    setGruppeId(null)
    setUntergruppeId(null)
    setSalesPlattformId(null)
    setProduktId(null)
  }

  const handleGruppeChange = (value: string) => {
    setGruppeId(value)
    setUntergruppeId(null)
  }

  const handleSave = async () => {
    if (!kategorieId || !leistungsdatum || brutto <= 0 || !ustSatz) return
    setSaving(true)
    setSaveError(null)
    try {
      await onSave({
        leistungsdatum,
        zahlungsdatum: zahlungsdatum || null,
        betrag_brutto: brutto,
        ust_satz: ustSatz,
        ust_betrag: ustBetrag,
        kategorie_id: kategorieId,
        gruppe_id: gruppeId,
        untergruppe_id: untergruppeId,
        sales_plattform_id: salesPlattformId,
        produkt_id: produktId,
        beschreibung: beschreibung || null,
        relevant_fuer_rentabilitaet: rentabilitaet || null,
        abschreibung: abschreibung || null,
      })
      onOpenChange(false)
    } catch (e) {
      setSaveError(e instanceof Error ? e.message : 'Fehler beim Speichern')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>
            {transaktionToEdit ? 'Transaktion bearbeiten' : 'Neue Transaktion'}
          </DialogTitle>
        </DialogHeader>

        <div className="max-h-[65vh] overflow-y-auto pr-1 space-y-4 py-2">
          {/* Leistungsdatum */}
          <div className="space-y-1.5">
            <Label htmlFor="leistungsdatum">Leistungsdatum *</Label>
            <Input
              id="leistungsdatum"
              type="date"
              value={leistungsdatum}
              onChange={e => setLeistungsdatum(e.target.value)}
            />
            {futureDateWarning && (
              <p className="text-xs text-amber-600">Hinweis: Datum liegt in der Zukunft.</p>
            )}
          </div>

          {/* Zahlungsdatum */}
          <div className="space-y-1.5">
            <Label htmlFor="zahlungsdatum">Zahlungsdatum</Label>
            <Input
              id="zahlungsdatum"
              type="date"
              value={zahlungsdatum}
              onChange={e => setZahlungsdatum(e.target.value)}
            />
          </div>

          {/* Kategorie */}
          <div className="space-y-1.5">
            <Label>Kategorie *</Label>
            <Select value={kategorieId ?? ''} onValueChange={handleKategorieChange}>
              <SelectTrigger>
                <SelectValue placeholder="Kategorie wählen…" />
              </SelectTrigger>
              <SelectContent>
                {level1.map(c => (
                  <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Gruppe */}
          {showGruppe && (
            <div className="space-y-1.5">
              <Label>Gruppe *</Label>
              <Select value={gruppeId ?? ''} onValueChange={handleGruppeChange}>
                <SelectTrigger>
                  <SelectValue placeholder="Gruppe wählen…" />
                </SelectTrigger>
                <SelectContent>
                  {gruppen.map(c => (
                    <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {/* Untergruppe */}
          {showUntergruppe && (
            <div className="space-y-1.5">
              <Label>Untergruppe *</Label>
              <Select value={untergruppeId ?? ''} onValueChange={v => setUntergruppeId(v)}>
                <SelectTrigger>
                  <SelectValue placeholder="Untergruppe wählen…" />
                </SelectTrigger>
                <SelectContent>
                  {untergruppen.map(c => (
                    <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {/* Sales Plattform */}
          {showSalesPlattform && (
            <div className="space-y-1.5">
              <Label>Sales Plattform *</Label>
              <Select value={salesPlattformId ?? ''} onValueChange={v => setSalesPlattformId(v)}>
                <SelectTrigger>
                  <SelectValue placeholder="Sales Plattform wählen…" />
                </SelectTrigger>
                <SelectContent>
                  {salesPlattformen.length === 0 ? (
                    <SelectItem value="__empty__" disabled>Keine Sales Plattformen definiert</SelectItem>
                  ) : (
                    salesPlattformen.map(c => (
                      <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                    ))
                  )}
                </SelectContent>
              </Select>
            </div>
          )}

          {/* Produkte */}
          {showProdukte && (
            <div className="space-y-1.5">
              <Label>Produkt *</Label>
              <Select value={produktId ?? ''} onValueChange={v => setProduktId(v)}>
                <SelectTrigger>
                  <SelectValue placeholder="Produkt wählen…" />
                </SelectTrigger>
                <SelectContent>
                  {produkte.length === 0 ? (
                    <SelectItem value="__empty__" disabled>Keine Produkte definiert</SelectItem>
                  ) : (
                    produkte.map(c => (
                      <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                    ))
                  )}
                </SelectContent>
              </Select>
            </div>
          )}

          {/* Beschreibung */}
          <div className="space-y-1.5">
            <Label htmlFor="beschreibung">Beschreibung</Label>
            <Textarea
              id="beschreibung"
              placeholder="Optionale Notiz…"
              rows={2}
              value={beschreibung}
              onChange={e => setBeschreibung(e.target.value)}
            />
          </div>

          {/* Bruttobetrag */}
          <div className="space-y-1.5">
            <Label htmlFor="betrag_brutto">Bruttobetrag in € *</Label>
            <Input
              id="betrag_brutto"
              type="number"
              min="0.01"
              step="0.01"
              placeholder="0.00"
              value={betragBrutto}
              onChange={e => setBetragBrutto(e.target.value)}
            />
            {betragBrutto && brutto <= 0 && (
              <p className="text-xs text-destructive">Bruttobetrag muss größer als 0 sein.</p>
            )}
          </div>

          {/* Umsatzsteuer */}
          <div className="space-y-1.5">
            <Label>Umsatzsteuer *</Label>
            <Select value={ustSatz} onValueChange={v => { setUstSatz(v); setUstBetragIndividuell('') }}>
              <SelectTrigger>
                <SelectValue placeholder="USt-Satz wählen…" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="19">19 %</SelectItem>
                <SelectItem value="7">7 %</SelectItem>
                <SelectItem value="0">0 %</SelectItem>
                <SelectItem value="individuell">Individuell</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* USt-Betrag: automatisch oder manuell */}
          {ustSatz && ustSatz !== 'individuell' && brutto > 0 && (
            <div className="rounded-md bg-muted/50 px-3 py-2 text-sm space-y-1">
              <div className="flex justify-between">
                <span className="text-muted-foreground">USt-Betrag:</span>
                <span>{new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR' }).format(ustBetrag)}</span>
              </div>
              <div className="flex justify-between font-medium">
                <span className="text-muted-foreground">Nettobetrag:</span>
                <span>{new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR' }).format(nettoPreview)}</span>
              </div>
            </div>
          )}

          {ustSatz === 'individuell' && (
            <div className="space-y-1.5">
              <Label htmlFor="ust_individuell">USt-Betrag in € *</Label>
              <Input
                id="ust_individuell"
                type="number"
                min="0.01"
                step="0.01"
                placeholder="0.00"
                value={ustBetragIndividuell}
                onChange={e => setUstBetragIndividuell(e.target.value)}
              />
              {individuellInvalid && ustBetragIndividuell && (
                <p className="text-xs text-destructive">
                  {Number(ustBetragIndividuell) >= brutto
                    ? 'USt-Betrag darf nicht größer oder gleich dem Bruttobetrag sein.'
                    : 'USt-Betrag muss größer als 0 sein.'}
                </p>
              )}
              {ustSatz === 'individuell' && brutto > 0 && Number(ustBetragIndividuell) > 0 && Number(ustBetragIndividuell) < brutto && (
                <div className="rounded-md bg-muted/50 px-3 py-2 text-sm flex justify-between font-medium">
                  <span className="text-muted-foreground">Nettobetrag:</span>
                  <span>{new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR' }).format(nettoPreview)}</span>
                </div>
              )}
            </div>
          )}

          {/* Relevant für Rentabilität */}
          <div className="space-y-1.5">
            <Label>Relevant für Rentabilität</Label>
            <Select value={rentabilitaet} onValueChange={setRentabilitaet}>
              <SelectTrigger>
                <SelectValue placeholder="Keine Angabe" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ja">Ja</SelectItem>
                <SelectItem value="nein">Nein</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Abschreibung */}
          <div className="space-y-1.5">
            <Label>Abschreibung</Label>
            <Select value={abschreibung} onValueChange={setAbschreibung}>
              <SelectTrigger>
                <SelectValue placeholder="Keine Angabe" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="3_jahre">3 Jahre</SelectItem>
                <SelectItem value="5_jahre">5 Jahre</SelectItem>
                <SelectItem value="7_jahre">7 Jahre</SelectItem>
                <SelectItem value="10_jahre">10 Jahre</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {saveError && (
            <Alert variant="destructive">
              <AlertDescription>{saveError}</AlertDescription>
            </Alert>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
            Abbrechen
          </Button>
          <Button onClick={handleSave} disabled={!isValid || saving}>
            {saving ? 'Speichern…' : 'Speichern'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
