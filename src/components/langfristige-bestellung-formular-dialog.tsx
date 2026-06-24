'use client'

import { useState, useEffect } from 'react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Loader2 } from 'lucide-react'

interface Produkt {
  id: string
  name: string
}

export interface ManuelleBestellungPayload {
  produkt_id: string
  bestelldatum: string | null
  produktionsstart_datum: string | null
  produktionsende_datum: string | null
  shippingdatum: string | null
  ankunftsdatum: string | null
  verfuegbarkeitsdatum: string | null
  menge_praktisch: number
  anzahl_20dc: number
  anzahl_40hq: number
  notizen: string | null
}

const DATUM_FELDER: Array<{ key: keyof DatumState; label: string }> = [
  { key: 'bestelldatum', label: 'Bestelldatum' },
  { key: 'produktionsstart_datum', label: 'Produktionsstart' },
  { key: 'produktionsende_datum', label: 'Produktionsende' },
  { key: 'shippingdatum', label: 'Shippingdatum' },
  { key: 'ankunftsdatum', label: 'Ankunftsdatum' },
  { key: 'verfuegbarkeitsdatum', label: 'Verfügbarkeitsdatum' },
]

interface DatumState {
  bestelldatum: string
  produktionsstart_datum: string
  produktionsende_datum: string
  shippingdatum: string
  ankunftsdatum: string
  verfuegbarkeitsdatum: string
}

const LEER_DATUM: DatumState = {
  bestelldatum: '',
  produktionsstart_datum: '',
  produktionsende_datum: '',
  shippingdatum: '',
  ankunftsdatum: '',
  verfuegbarkeitsdatum: '',
}

// Klassisches Eingabeformular zum manuellen Anlegen einer (bereits laufenden)
// Bestellung. Wird als manuelle Bestellung gespeichert und vom Bestelllauf als
// fixer Zugang berücksichtigt.
export function LangfristigeBestellungFormularDialog({
  open,
  onOpenChange,
  produkte,
  onSubmit,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  produkte: Produkt[]
  onSubmit: (payload: ManuelleBestellungPayload) => Promise<void>
}) {
  const [produktId, setProduktId] = useState<string>('')
  const [daten, setDaten] = useState<DatumState>(LEER_DATUM)
  const [menge, setMenge] = useState('')
  const [anzahl20dc, setAnzahl20dc] = useState('')
  const [anzahl40hq, setAnzahl40hq] = useState('')
  const [notizen, setNotizen] = useState('')
  const [speichert, setSpeichert] = useState(false)
  const [fehler, setFehler] = useState<string | null>(null)

  // Beim Öffnen Formular zurücksetzen.
  useEffect(() => {
    if (open) {
      setProduktId('')
      setDaten(LEER_DATUM)
      setMenge('')
      setAnzahl20dc('')
      setAnzahl40hq('')
      setNotizen('')
      setFehler(null)
    }
  }, [open])

  const mengeZahl = Math.max(0, Math.round(Number(menge) || 0))
  const kannSpeichern = produktId !== '' && menge !== '' && mengeZahl >= 0

  async function handleSpeichern() {
    if (!kannSpeichern) {
      setFehler('Bitte Produkt und Menge angeben.')
      return
    }
    setSpeichert(true)
    setFehler(null)
    try {
      await onSubmit({
        produkt_id: produktId,
        bestelldatum: daten.bestelldatum || null,
        produktionsstart_datum: daten.produktionsstart_datum || null,
        produktionsende_datum: daten.produktionsende_datum || null,
        shippingdatum: daten.shippingdatum || null,
        ankunftsdatum: daten.ankunftsdatum || null,
        verfuegbarkeitsdatum: daten.verfuegbarkeitsdatum || null,
        menge_praktisch: mengeZahl,
        anzahl_20dc: Math.max(0, Math.round(Number(anzahl20dc) || 0)),
        anzahl_40hq: Math.max(0, Math.round(Number(anzahl40hq) || 0)),
        notizen: notizen.trim() || null,
      })
      onOpenChange(false)
    } catch (err) {
      setFehler(err instanceof Error ? err.message : 'Anlegen fehlgeschlagen')
    } finally {
      setSpeichert(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[88vh] max-w-2xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Laufende Bestellung manuell hinzufügen</DialogTitle>
          <DialogDescription>
            Erfasse eine bereits laufende Bestellung. Sie wird als manuelle Bestellung gespeichert
            und im Bestelllauf als fixer Zugang berücksichtigt.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Produkt */}
          <div className="space-y-1">
            <Label className="text-xs">Produkt *</Label>
            <Select value={produktId} onValueChange={setProduktId}>
              <SelectTrigger>
                <SelectValue placeholder="Produkt wählen…" />
              </SelectTrigger>
              <SelectContent>
                {produkte.map((p) => (
                  <SelectItem key={p.id} value={p.id}>
                    {p.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Datumsfelder */}
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {DATUM_FELDER.map((f) => (
              <div key={f.key} className="space-y-1">
                <Label htmlFor={`f-${f.key}`} className="text-xs">
                  {f.label}
                </Label>
                <Input
                  id={`f-${f.key}`}
                  type="date"
                  value={daten[f.key]}
                  onChange={(e) => setDaten((curr) => ({ ...curr, [f.key]: e.target.value }))}
                />
              </div>
            ))}
          </div>

          {/* Menge + Container */}
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <div className="space-y-1">
              <Label htmlFor="f-menge" className="text-xs">
                Menge *
              </Label>
              <Input
                id="f-menge"
                type="number"
                min={0}
                value={menge}
                onChange={(e) => setMenge(e.target.value)}
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="f-40hq" className="text-xs">
                Anzahl 40HQ
              </Label>
              <Input
                id="f-40hq"
                type="number"
                min={0}
                value={anzahl40hq}
                onChange={(e) => setAnzahl40hq(e.target.value)}
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="f-20dc" className="text-xs">
                Anzahl 20DC
              </Label>
              <Input
                id="f-20dc"
                type="number"
                min={0}
                value={anzahl20dc}
                onChange={(e) => setAnzahl20dc(e.target.value)}
              />
            </div>
          </div>

          {/* Notizen */}
          <div className="space-y-1">
            <Label htmlFor="f-notizen" className="text-xs">
              Notizen
            </Label>
            <Textarea
              id="f-notizen"
              rows={2}
              value={notizen}
              onChange={(e) => setNotizen(e.target.value)}
              placeholder="Optional"
            />
          </div>

          {fehler && <p className="text-sm text-destructive">{fehler}</p>}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={speichert}>
            Abbrechen
          </Button>
          <Button onClick={handleSpeichern} disabled={!kannSpeichern || speichert} className="gap-2">
            {speichert && <Loader2 className="h-4 w-4 animate-spin" />}
            Bestellung anlegen
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
