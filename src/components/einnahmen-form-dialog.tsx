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
import { EinnahmenTransaktion, EinnahmenTransaktionInput } from '@/hooks/use-einnahmen-transaktionen'

const TODAY = new Date().toISOString().split('T')[0]
const NONE = '__none__'

interface EinnahmenFormDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  transaktionToEdit: EinnahmenTransaktion | null
  einnahmenKategorien: KpiCategory[]
  salesPlattformen: KpiCategory[]
  produkte: KpiCategory[]
  onSave: (input: EinnahmenTransaktionInput) => Promise<void>
}

export function EinnahmenFormDialog({
  open,
  onOpenChange,
  transaktionToEdit,
  einnahmenKategorien,
  salesPlattformen,
  produkte,
  onSave,
}: EinnahmenFormDialogProps) {
  const [zahlungsdatum, setZahlungsdatum] = useState(TODAY)
  const [betrag, setBetrag] = useState('')
  const [kategorieId, setKategorieId] = useState<string | null>(null)
  const [gruppeId, setGruppeId] = useState<string | null>(null)
  const [untergruppeId, setUntergruppeId] = useState<string | null>(null)
  const [salesPlattformId, setSalesPlattformId] = useState<string | null>(null)
  const [produktId, setProduktId] = useState<string | null>(null)
  const [beschreibung, setBeschreibung] = useState('')
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)

  useEffect(() => {
    if (!open) return
    if (transaktionToEdit) {
      setZahlungsdatum(transaktionToEdit.zahlungsdatum)
      setBetrag(String(transaktionToEdit.betrag))
      setKategorieId(transaktionToEdit.kategorie_id)
      setGruppeId(transaktionToEdit.gruppe_id)
      setUntergruppeId(transaktionToEdit.untergruppe_id)
      setSalesPlattformId(transaktionToEdit.sales_plattform_id)
      setProduktId(transaktionToEdit.produkt_id)
      setBeschreibung(transaktionToEdit.beschreibung ?? '')
    } else {
      setZahlungsdatum(TODAY)
      setBetrag('')
      setKategorieId(null)
      setGruppeId(null)
      setUntergruppeId(null)
      setSalesPlattformId(null)
      setProduktId(null)
      setBeschreibung('')
    }
    setSaveError(null)
  }, [open, transaktionToEdit])

  const level1 = einnahmenKategorien.filter(c => c.level === 1)
  const selectedKategorie = einnahmenKategorien.find(c => c.id === kategorieId) ?? null
  const gruppen = einnahmenKategorien.filter(c => c.level === 2 && c.parent_id === kategorieId)
  const selectedGruppe = einnahmenKategorien.find(c => c.id === gruppeId) ?? null
  const untergruppen = einnahmenKategorien.filter(c => c.level === 3 && c.parent_id === gruppeId)

  const showGruppe = gruppen.length > 0
  const showUntergruppe = gruppeId !== null && untergruppen.length > 0
  const showSalesPlattform = selectedKategorie?.sales_plattform_enabled === true
  const showProdukte = selectedKategorie?.produkt_enabled === true

  const futureDateWarning = zahlungsdatum && new Date(zahlungsdatum + 'T00:00:00') > new Date()
  const isValid =
    !!zahlungsdatum &&
    !!betrag && Number(betrag) > 0 &&
    !!kategorieId &&
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
    if (!kategorieId || !zahlungsdatum || Number(betrag) <= 0) return
    setSaving(true)
    setSaveError(null)
    try {
      await onSave({
        zahlungsdatum,
        betrag: Number(betrag),
        kategorie_id: kategorieId,
        gruppe_id: gruppeId,
        untergruppe_id: untergruppeId,
        sales_plattform_id: salesPlattformId,
        produkt_id: produktId,
        beschreibung: beschreibung || null,
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

        <div className="space-y-4 py-2">
          {/* Zahlungsdatum */}
          <div className="space-y-1.5">
            <Label htmlFor="zahlungsdatum">Zahlungsdatum *</Label>
            <Input
              id="zahlungsdatum"
              type="date"
              value={zahlungsdatum}
              onChange={e => setZahlungsdatum(e.target.value)}
            />
            {futureDateWarning && (
              <p className="text-xs text-amber-600">Hinweis: Datum liegt in der Zukunft.</p>
            )}
          </div>

          {/* Betrag */}
          <div className="space-y-1.5">
            <Label htmlFor="betrag">Betrag in € *</Label>
            <Input
              id="betrag"
              type="number"
              min="0.01"
              step="0.01"
              placeholder="0.00"
              value={betrag}
              onChange={e => setBetrag(e.target.value)}
            />
            {betrag && Number(betrag) <= 0 && (
              <p className="text-xs text-destructive">Betrag muss größer als 0 sein.</p>
            )}
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
              <Select
                value={gruppeId ?? ''}
                onValueChange={handleGruppeChange}
              >
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
              <Select
                value={untergruppeId ?? ''}
                onValueChange={v => setUntergruppeId(v)}
              >
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
              <Select
                value={salesPlattformId ?? ''}
                onValueChange={v => setSalesPlattformId(v)}
              >
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
              <Select
                value={produktId ?? ''}
                onValueChange={v => setProduktId(v)}
              >
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
