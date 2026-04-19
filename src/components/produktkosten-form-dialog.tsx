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
import { type ProduktkostenZeitraum, type ProduktkostenFormData } from '@/hooks/use-produktkosten'

interface Props {
  open: boolean
  onOpenChange: (open: boolean) => void
  zeitraumToEdit: ProduktkostenZeitraum | null
  produktId: string
  kostenkategorien: KpiCategory[]
  onSave: (data: ProduktkostenFormData) => Promise<void>
}

export function ProduktkostenFormDialog({
  open,
  onOpenChange,
  zeitraumToEdit,
  kostenkategorien,
  onSave,
}: Props) {
  const [gueltigVon, setGueltigVon] = useState('')
  const [gueltigBis, setGueltigBis] = useState('')
  const [werte, setWerte] = useState<Record<string, string>>({})
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)

  useEffect(() => {
    if (!open) return
    if (zeitraumToEdit) {
      setGueltigVon(zeitraumToEdit.gueltig_von)
      setGueltigBis(zeitraumToEdit.gueltig_bis ?? '')
      const initial: Record<string, string> = {}
      zeitraumToEdit.werte.forEach(w => {
        initial[w.kategorie_id] = String(w.wert)
      })
      setWerte(initial)
    } else {
      setGueltigVon('')
      setGueltigBis('')
      setWerte({})
    }
    setSaveError(null)
  }, [open, zeitraumToEdit])

  const datumValid = gueltigVon && (!gueltigBis || gueltigBis >= gueltigVon)
  const allWerteValid = kostenkategorien.every(k => {
    const v = werte[k.id]
    return v !== undefined && v !== '' && !isNaN(Number(v)) && Number(v) >= 0
  })
  const isValid = !!datumValid && allWerteValid

  const handleSave = async () => {
    if (!isValid) return
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
            {zeitraumToEdit ? 'Zeitraum bearbeiten' : 'Neuer Zeitraum'}
          </DialogTitle>
        </DialogHeader>

        <div className="max-h-[65vh] overflow-y-auto pr-1 space-y-4 py-2">
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
            <p className="text-xs text-destructive">
              Gültig bis muss nach Gültig von liegen.
            </p>
          )}

          {kostenkategorien.length > 0 && (
            <div className="space-y-3">
              <p className="text-sm font-medium">Kosten in €</p>
              {kostenkategorien.map(k => (
                <div key={k.id} className="space-y-1.5">
                  <Label htmlFor={`wert-${k.id}`}>{k.name} *</Label>
                  <Input
                    id={`wert-${k.id}`}
                    type="number"
                    min="0"
                    step="0.01"
                    placeholder="0.00"
                    value={werte[k.id] ?? ''}
                    onChange={e => setWerte(prev => ({ ...prev, [k.id]: e.target.value }))}
                  />
                  {werte[k.id] !== undefined && werte[k.id] !== '' && Number(werte[k.id]) < 0 && (
                    <p className="text-xs text-destructive">Wert darf nicht negativ sein.</p>
                  )}
                </div>
              ))}
            </div>
          )}

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
