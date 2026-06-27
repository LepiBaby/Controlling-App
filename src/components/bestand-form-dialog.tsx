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
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { type KpiCategory } from '@/hooks/use-kpi-categories'
import {
  type BestandTransaktion,
  type BestandFormData,
  calcEndbestand,
} from '@/hooks/use-bestand-transaktionen'

interface Props {
  open: boolean
  onOpenChange: (open: boolean) => void
  transaktionToEdit: BestandTransaktion | null
  skuId: string
  produktId: string
  plattformen: KpiCategory[]
  existingTransaktionen: BestandTransaktion[]
  onSave: (data: BestandFormData) => Promise<void>
}

function getToday() {
  return new Date().toISOString().split('T')[0]
}

function isNonNegInt(val: string) {
  return val === '' || (/^\d+$/.test(val) && Number(val) >= 0)
}

export function BestandFormDialog({
  open,
  onOpenChange,
  transaktionToEdit,
  plattformen,
  existingTransaktionen,
  onSave,
}: Props) {
  const [datum, setDatum] = useState(getToday())
  const [anfangsbestand, setAnfangsbestand] = useState('')
  const [sendungen, setSendungen] = useState<Record<string, string>>({})
  const [sendungenManuell, setSendungenManuell] = useState('0')
  const [einlagerungen, setEinlagerungen] = useState('0')
  const [anpassungenPositiv, setAnpassungenPositiv] = useState('0')
  const [anpassungenNegativ, setAnpassungenNegativ] = useState('0')
  const [warenverluste, setWarenverluste] = useState('0')
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)

  useEffect(() => {
    if (!open) return
    setSaveError(null)

    if (transaktionToEdit) {
      setDatum(transaktionToEdit.datum)
      setAnfangsbestand(String(transaktionToEdit.anfangsbestand))
      setSendungenManuell(String(transaktionToEdit.sendungen_manuell))
      setEinlagerungen(String(transaktionToEdit.einlagerungen))
      setAnpassungenPositiv(String(transaktionToEdit.anpassungen_positiv))
      setAnpassungenNegativ(String(transaktionToEdit.anpassungen_negativ))
      setWarenverluste(String(transaktionToEdit.warenverluste))
      const s: Record<string, string> = {}
      transaktionToEdit.sendungen.forEach(sd => { s[sd.plattform_id] = String(sd.menge) })
      setSendungen(s)
    } else {
      setDatum(getToday())
      setSendungenManuell('0')
      setEinlagerungen('0')
      setAnpassungenPositiv('0')
      setAnpassungenNegativ('0')
      setWarenverluste('0')
      setSendungen({})
      // Auto-fill Anfangsbestand from most recent transaction's Endbestand
      const sorted = [...existingTransaktionen].sort((a, b) => b.datum.localeCompare(a.datum))
      if (sorted.length > 0) {
        setAnfangsbestand(String(calcEndbestand(sorted[0])))
      } else {
        setAnfangsbestand('')
      }
    }
  }, [open, transaktionToEdit, existingTransaktionen])

  const parsedAnfangsbestand = anfangsbestand === '' ? NaN : Number(anfangsbestand)
  const parsedSendungenManuell = Number(sendungenManuell) || 0
  const parsedEinlagerungen = Number(einlagerungen) || 0
  const parsedAnpassungenPositiv = Number(anpassungenPositiv) || 0
  const parsedAnpassungenNegativ = Number(anpassungenNegativ) || 0
  const parsedWarenverluste = Number(warenverluste) || 0

  const parsedSendungen = plattformen.map(p => ({
    plattform_id: p.id,
    menge: Number(sendungen[p.id]) || 0,
  }))

  const endbestand = isNaN(parsedAnfangsbestand)
    ? null
    : calcEndbestand({
        anfangsbestand: parsedAnfangsbestand,
        sendungen_manuell: parsedSendungenManuell,
        einlagerungen: parsedEinlagerungen,
        anpassungen_positiv: parsedAnpassungenPositiv,
        anpassungen_negativ: parsedAnpassungenNegativ,
        warenverluste: parsedWarenverluste,
        sendungen: parsedSendungen,
      })

  const isDupDatum =
    !transaktionToEdit &&
    existingTransaktionen.some(t => t.datum === datum)

  const isValid =
    !!datum &&
    anfangsbestand !== '' &&
    isNonNegInt(anfangsbestand) &&
    !isDupDatum &&
    isNonNegInt(sendungenManuell) &&
    isNonNegInt(einlagerungen) &&
    isNonNegInt(anpassungenPositiv) &&
    isNonNegInt(anpassungenNegativ) &&
    isNonNegInt(warenverluste) &&
    plattformen.every(p => isNonNegInt(sendungen[p.id] ?? '0'))

  const handleSave = async () => {
    if (!isValid) return
    setSaving(true)
    setSaveError(null)
    try {
      await onSave({
        datum,
        anfangsbestand: Number(anfangsbestand),
        sendungen_manuell: parsedSendungenManuell,
        einlagerungen: parsedEinlagerungen,
        anpassungen_positiv: parsedAnpassungenPositiv,
        anpassungen_negativ: parsedAnpassungenNegativ,
        warenverluste: parsedWarenverluste,
        // Nur Plattformen mit tatsächlicher Menge speichern. Sonst entstehen pro
        // Plattform 0-Zeilen, die später das Löschen der Plattform blockieren.
        sendungen: parsedSendungen.filter(s => s.menge > 0),
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
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>
            {transaktionToEdit ? 'Transaktion bearbeiten' : 'Neue Transaktion'}
          </DialogTitle>
        </DialogHeader>

        <div className="max-h-[65vh] overflow-y-auto pr-1 space-y-4 py-2">

          {/* Datum */}
          <div className="space-y-1.5">
            <Label htmlFor="datum">Datum *</Label>
            <Input
              id="datum"
              type="date"
              value={datum}
              onChange={e => setDatum(e.target.value)}
            />
            {isDupDatum && (
              <p className="text-xs text-destructive">
                Für dieses Datum existiert bereits ein Eintrag.
              </p>
            )}
          </div>

          {/* Anfangsbestand */}
          <div className="space-y-1.5">
            <Label htmlFor="anfangsbestand">Anfangsbestand *</Label>
            <Input
              id="anfangsbestand"
              type="number"
              min="0"
              step="1"
              placeholder="0"
              value={anfangsbestand}
              onChange={e => setAnfangsbestand(e.target.value)}
            />
            {anfangsbestand !== '' && !isNonNegInt(anfangsbestand) && (
              <p className="text-xs text-destructive">Wert muss eine ganze Zahl ≥ 0 sein.</p>
            )}
          </div>

          {/* Sendungen je Plattform */}
          {plattformen.length > 0 && (
            <div className="space-y-3">
              <p className="text-sm font-medium">Sendungen</p>
              {plattformen.map(p => (
                <div key={p.id} className="space-y-1.5">
                  <Label htmlFor={`sendung-${p.id}`}>{p.name}</Label>
                  <Input
                    id={`sendung-${p.id}`}
                    type="number"
                    min="0"
                    step="1"
                    placeholder="0"
                    value={sendungen[p.id] ?? '0'}
                    onChange={e => setSendungen(prev => ({ ...prev, [p.id]: e.target.value }))}
                  />
                  {!isNonNegInt(sendungen[p.id] ?? '0') && (
                    <p className="text-xs text-destructive">Wert muss eine ganze Zahl ≥ 0 sein.</p>
                  )}
                </div>
              ))}
            </div>
          )}

          {/* Sendungen Manuell */}
          <div className="space-y-1.5">
            <Label htmlFor="sendungen_manuell">Sendungen Manuell</Label>
            <Input
              id="sendungen_manuell"
              type="number"
              min="0"
              step="1"
              placeholder="0"
              value={sendungenManuell}
              onChange={e => setSendungenManuell(e.target.value)}
            />
          </div>

          {/* Einlagerungen */}
          <div className="space-y-1.5">
            <Label htmlFor="einlagerungen">Einlagerungen</Label>
            <Input
              id="einlagerungen"
              type="number"
              min="0"
              step="1"
              placeholder="0"
              value={einlagerungen}
              onChange={e => setEinlagerungen(e.target.value)}
            />
          </div>

          {/* Bestandsanpassungen */}
          <div className="space-y-3">
            <p className="text-sm font-medium">Bestandsanpassungen</p>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label htmlFor="anpassungen_positiv">Positiv (+)</Label>
                <Input
                  id="anpassungen_positiv"
                  type="number"
                  min="0"
                  step="1"
                  placeholder="0"
                  value={anpassungenPositiv}
                  onChange={e => setAnpassungenPositiv(e.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="anpassungen_negativ">Negativ (−)</Label>
                <Input
                  id="anpassungen_negativ"
                  type="number"
                  min="0"
                  step="1"
                  placeholder="0"
                  value={anpassungenNegativ}
                  onChange={e => setAnpassungenNegativ(e.target.value)}
                />
              </div>
            </div>
          </div>

          {/* Warenverluste */}
          <div className="space-y-1.5">
            <Label htmlFor="warenverluste">Warenverluste</Label>
            <Input
              id="warenverluste"
              type="number"
              min="0"
              step="1"
              placeholder="0"
              value={warenverluste}
              onChange={e => setWarenverluste(e.target.value)}
            />
          </div>

          {/* Endbestand (live berechnet) */}
          <div className="rounded-lg border bg-muted/40 p-3">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-muted-foreground">Endbestand</span>
              <span
                className={`text-xl font-bold tabular-nums ${
                  endbestand !== null && endbestand < 0 ? 'text-destructive' : ''
                }`}
              >
                {endbestand !== null ? endbestand : '—'}
              </span>
            </div>
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
