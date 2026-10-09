'use client'

import { useEffect, useMemo, useState } from 'react'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { berechneTilgungsplan } from '@/lib/finanzierung-tilgungsplan'
import type {
  FinanzierungDarlehen,
  FinanzierungDarlehenInput,
  PlanungsMonat,
} from '@/hooks/use-finanzierungsausgaben-planung'

// PROJ-107: Dialog „Finanzierung hinzufügen/bearbeiten" der Finanzierungsausgaben Planung.
// Der Nutzer übernimmt entweder eine Fremdkapital-Position aus „Kapitalbedarf &
// Finanzierung" (Werte werden vorbelegt und bleiben anpassbar) oder legt die
// Finanzierung manuell an.

const MANUELL = '__manuell__'

interface KbfFremdkapital {
  id: string
  bereich: string
  bezeichnung: string
  betrag: number | null
  zinssatz: number | null
  laufzeit_jahre: number | null
  tilgungsfrei_jahre: number | null
}

interface FormState {
  quelle: string
  name: string
  betrag: string
  zinssatz: string
  laufzeit: string
  tilgungsfrei: string
  start: string // `${jahr}:${monat}`
}

function toInput(n: number | null | undefined): string {
  return n === null || n === undefined ? '' : String(n).replace('.', ',')
}

function parseNum(s: string): number | null {
  // DE-Format („100.000,50") und Punkt-Dezimal („4.5") akzeptieren.
  let t = s.trim().replace(/\s|€|%/g, '')
  if (t.includes(',')) t = t.replace(/\./g, '').replace(',', '.')
  else if (/^\d{1,3}(\.\d{3})+$/.test(t)) t = t.replace(/\./g, '')
  if (t === '') return null
  const n = Number(t)
  return Number.isFinite(n) ? n : null
}

function formatEuro(n: number): string {
  return n.toLocaleString('de-DE', { style: 'currency', currency: 'EUR' })
}

interface Props {
  open: boolean
  onOpenChange: (open: boolean) => void
  versionId: string
  monate: PlanungsMonat[]
  zinsenKategorieId: string
  tilgungKategorieId: string
  /** Gesetzt → Bearbeiten einer bestehenden Finanzierung. */
  bearbeiten?: FinanzierungDarlehen | null
  onSave: (input: FinanzierungDarlehenInput) => Promise<void>
}

export function FinanzierungHinzufuegenDialog({
  open,
  onOpenChange,
  versionId,
  monate,
  zinsenKategorieId,
  tilgungKategorieId,
  bearbeiten,
  onSave,
}: Props) {
  const [kbf, setKbf] = useState<KbfFremdkapital[]>([])
  const [kbfLoading, setKbfLoading] = useState(false)
  const [form, setForm] = useState<FormState>(leeresFormular(monate))
  const [fehler, setFehler] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  // Beim Öffnen: Formular initialisieren + Fremdkapital-Positionen laden.
  useEffect(() => {
    if (!open) return
    setFehler(null)
    setForm(
      bearbeiten
        ? {
            quelle: bearbeiten.quelle_kbf_id ?? MANUELL,
            name: bearbeiten.name,
            betrag: toInput(bearbeiten.betrag),
            zinssatz: toInput(bearbeiten.zinssatz),
            laufzeit: String(bearbeiten.laufzeit_monate),
            tilgungsfrei: String(bearbeiten.tilgungsfrei_monate),
            start: `${bearbeiten.start_jahr}:${bearbeiten.start_monat}`,
          }
        : leeresFormular(monate),
    )

    let aktiv = true
    setKbfLoading(true)
    fetch(`/api/langfristige-planung/${versionId}/kapitalbedarf-finanzierung`)
      .then(r => (r.ok ? r.json() : []))
      .then((rows: KbfFremdkapital[]) => {
        if (!aktiv) return
        const fk = (Array.isArray(rows) ? rows : []).filter(r => r.bereich === 'fremdkapital')
        setKbf(fk)
        // Herkunft existiert nicht mehr (gelöscht) → als manuell behandeln.
        setForm(f => (f.quelle !== MANUELL && !fk.some(k => k.id === f.quelle) ? { ...f, quelle: MANUELL } : f))
      })
      .catch(() => aktiv && setKbf([]))
      .finally(() => aktiv && setKbfLoading(false))
    return () => {
      aktiv = false
    }
  }, [open, bearbeiten, versionId, monate])

  function waehleQuelle(quelle: string) {
    if (quelle === MANUELL) {
      setForm(f => ({ ...f, quelle }))
      return
    }
    const k = kbf.find(r => r.id === quelle)
    if (!k) return
    // Laufzeit/Tilgungsfrei sind in „Kapitalbedarf & Finanzierung" in Jahren gepflegt.
    setForm(f => ({
      ...f,
      quelle,
      name: k.bezeichnung,
      betrag: toInput(k.betrag),
      zinssatz: toInput(k.zinssatz),
      laufzeit: k.laufzeit_jahre !== null ? String(k.laufzeit_jahre * 12) : '',
      tilgungsfrei: k.tilgungsfrei_jahre !== null ? String(k.tilgungsfrei_jahre * 12) : '0',
    }))
  }

  // Validierung + Vorschau
  const parsed = useMemo(() => {
    const betrag = parseNum(form.betrag)
    const zinssatz = parseNum(form.zinssatz) ?? 0
    const laufzeit = parseNum(form.laufzeit)
    const tilgungsfrei = parseNum(form.tilgungsfrei) ?? 0
    const [startJahr, startMonat] = form.start.split(':').map(Number)
    let error: string | null = null
    if (!form.name.trim()) error = 'Bitte einen Namen angeben.'
    else if (betrag === null || betrag <= 0) error = 'Bitte eine Finanzierungssumme > 0 angeben.'
    else if (zinssatz < 0 || zinssatz > 100) error = 'Der Zinssatz muss zwischen 0 und 100 % liegen.'
    else if (laufzeit === null || !Number.isInteger(laufzeit) || laufzeit < 1 || laufzeit > 1200)
      error = 'Bitte eine Laufzeit in ganzen Monaten (1–1200) angeben.'
    else if (!Number.isInteger(tilgungsfrei) || tilgungsfrei < 0 || tilgungsfrei >= laufzeit)
      error = 'Der tilgungsfreie Zeitraum muss kürzer als die Laufzeit sein.'
    else if (!startJahr || !startMonat) error = 'Bitte einen Startmonat wählen.'
    if (error) return { error, input: null, plan: null }
    const input: FinanzierungDarlehenInput = {
      quelle_kbf_id: form.quelle === MANUELL ? null : form.quelle,
      zinsen_kategorie_id: zinsenKategorieId,
      tilgung_kategorie_id: tilgungKategorieId,
      name: form.name.trim(),
      betrag: betrag!,
      zinssatz,
      laufzeit_monate: laufzeit!,
      tilgungsfrei_monate: tilgungsfrei,
      start_jahr: startJahr,
      start_monat: startMonat,
    }
    return { error: null, input, plan: berechneTilgungsplan(input) }
  }, [form, zinsenKategorieId, tilgungKategorieId])

  const vorschau = useMemo(() => {
    if (!parsed.plan) return null
    const ersteRate = parsed.plan.find(p => p.tilgung > 0)
    return {
      rate: ersteRate?.tilgung ?? 0,
      zinsenErsterMonat: parsed.plan[0]?.zinsen ?? 0,
      zinsenGesamt: parsed.plan.reduce((s, p) => s + p.zinsen, 0),
    }
  }, [parsed.plan])

  async function speichern() {
    if (!parsed.input) {
      setFehler(parsed.error)
      return
    }
    setSaving(true)
    setFehler(null)
    try {
      await onSave(parsed.input)
      onOpenChange(false)
    } catch (e) {
      setFehler(e instanceof Error ? e.message : 'Speichern fehlgeschlagen.')
    } finally {
      setSaving(false)
    }
  }

  const set = (key: keyof FormState) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm(f => ({ ...f, [key]: e.target.value }))

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{bearbeiten ? 'Finanzierung bearbeiten' : 'Finanzierung hinzufügen'}</DialogTitle>
          <DialogDescription>
            Aus „Kapitalbedarf &amp; Finanzierung" übernehmen oder manuell anlegen. Zinsen und Tilgung
            werden monatlich berechnet und als eigene Zeilen unter „Zinsen" und „Tilgung" angezeigt.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label>Finanzierung</Label>
            <Select value={form.quelle} onValueChange={waehleQuelle}>
              <SelectTrigger>
                <SelectValue placeholder="Auswählen …" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={MANUELL}>Manuell anlegen</SelectItem>
                {kbf.map(k => (
                  <SelectItem key={k.id} value={k.id}>
                    {k.bezeichnung}
                    {k.betrag !== null ? ` · ${formatEuro(Number(k.betrag))}` : ''}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {!kbfLoading && kbf.length === 0 && (
              <p className="text-xs text-muted-foreground">
                Auf der Seite „Kapitalbedarf &amp; Finanzierung" sind noch keine Fremdkapital-Positionen hinterlegt.
              </p>
            )}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="fin-name">Name</Label>
            <Input id="fin-name" value={form.name} onChange={set('name')} maxLength={100} />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="fin-betrag">Finanzierungssumme (€)</Label>
              <Input id="fin-betrag" inputMode="decimal" value={form.betrag} onChange={set('betrag')} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="fin-zins">Zinssatz (% p. a.)</Label>
              <Input id="fin-zins" inputMode="decimal" value={form.zinssatz} onChange={set('zinssatz')} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="fin-laufzeit">Laufzeit (Monate)</Label>
              <Input id="fin-laufzeit" inputMode="numeric" value={form.laufzeit} onChange={set('laufzeit')} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="fin-frei">Tilgungsfrei (Monate)</Label>
              <Input id="fin-frei" inputMode="numeric" value={form.tilgungsfrei} onChange={set('tilgungsfrei')} />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label>Startmonat</Label>
            <Select value={form.start} onValueChange={v => setForm(f => ({ ...f, start: v }))}>
              <SelectTrigger>
                <SelectValue placeholder="Startmonat wählen" />
              </SelectTrigger>
              <SelectContent className="max-h-72">
                {startOptionen(monate, form.start).map(o => (
                  <SelectItem key={o.value} value={o.value}>
                    {o.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {vorschau && (
            <div className="rounded-md bg-muted/50 px-3 py-2 text-xs text-muted-foreground space-y-0.5">
              <div>Monatliche Tilgung nach tilgungsfreier Zeit: <span className="font-medium text-foreground">{formatEuro(vorschau.rate)}</span></div>
              <div>Zinsen im ersten Monat: <span className="font-medium text-foreground">{formatEuro(vorschau.zinsenErsterMonat)}</span></div>
              <div>Zinsen über die gesamte Laufzeit: <span className="font-medium text-foreground">{formatEuro(vorschau.zinsenGesamt)}</span></div>
            </div>
          )}

          {fehler && <p className="text-sm text-destructive">{fehler}</p>}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
            Abbrechen
          </Button>
          <Button onClick={speichern} disabled={saving}>
            {saving ? 'Speichern …' : 'Speichern'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function leeresFormular(monate: PlanungsMonat[]): FormState {
  const start = monate[0] ? `${monate[0].year}:${monate[0].month}` : ''
  return { quelle: MANUELL, name: '', betrag: '', zinssatz: '', laufzeit: '', tilgungsfrei: '0', start }
}

// Startmonat-Auswahl = Monate des Planungshorizonts; ein (beim Bearbeiten) außerhalb
// liegender gespeicherter Startmonat bleibt wählbar.
function startOptionen(monate: PlanungsMonat[], aktuell: string) {
  const opts = monate.map(m => ({ value: `${m.year}:${m.month}`, label: m.label }))
  if (aktuell && !opts.some(o => o.value === aktuell)) {
    const [j, m] = aktuell.split(':').map(Number)
    const label = new Date(j, m - 1, 1).toLocaleDateString('de-DE', { month: 'short', year: 'numeric' })
    opts.unshift({ value: aktuell, label })
  }
  return opts
}
