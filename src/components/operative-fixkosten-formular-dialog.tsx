'use client'

import { useState, useEffect, useMemo, useCallback } from 'react'
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'
import { Alert, AlertDescription } from '@/components/ui/alert'
import type { KpiCategory } from '@/hooks/use-kpi-categories'
import {
  type OperativeFixkostenEintrag,
  type OperativeFixkostenInput,
  type Zahlungsfrequenz,
  type ZeitpunktImMonat,
  type UstSatz,
  MONAT_LABELS,
  UST_SATZ_LABELS,
  getKalenderwoche,
} from '@/hooks/use-operative-fixkosten'

const Q1 = [1, 2, 3]
const Q2 = [4, 5, 6]
const Q3 = [7, 8, 9]
const Q4 = [10, 11, 12]

const EUR = new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR' })

interface Props {
  open: boolean
  onOpenChange: (open: boolean) => void
  eintragToEdit: OperativeFixkostenEintrag | null
  gruppen: KpiCategory[]
  allKategorien: KpiCategory[]
  onSave: (input: OperativeFixkostenInput) => Promise<void>
}

export function OperativeFixkostenFormularDialog({
  open,
  onOpenChange,
  eintragToEdit,
  gruppen,
  allKategorien,
  onSave,
}: Props) {
  const [kategorieId, setKategorieId] = useState('')
  const [untergruppeId, setUntergruppeId] = useState('')
  const [name, setName] = useState('')
  const [frequenz, setFrequenz] = useState<Zahlungsfrequenz>('monatlich')
  const [monatJaehrlich, setMonatJaehrlich] = useState<string>('')
  const [monatQ1, setMonatQ1] = useState<string>('')
  const [monatQ2, setMonatQ2] = useState<string>('')
  const [monatQ3, setMonatQ3] = useState<string>('')
  const [monatQ4, setMonatQ4] = useState<string>('')
  const [zeitpunkt, setZeitpunkt] = useState<ZeitpunktImMonat>('anfang')
  const [betragNetto, setBetragNetto] = useState('')
  const [ustSatz, setUstSatz] = useState<UstSatz>('19')
  const [ustBetragIndividuell, setUstBetragIndividuell] = useState('')
  const [zahlungszielTage, setZahlungszielTage] = useState('')
  const [aktiv, setAktiv] = useState(true)
  const [aktivVon, setAktivVon] = useState('')
  const [aktivBis, setAktivBis] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!open) return
    if (eintragToEdit) {
      setKategorieId(eintragToEdit.kategorie_id)
      setUntergruppeId(eintragToEdit.untergruppe_id ?? '')
      setName(eintragToEdit.name)
      setFrequenz(eintragToEdit.zahlungsfrequenz)
      setBetragNetto(String(eintragToEdit.betrag_netto))
      setUstSatz(eintragToEdit.ust_satz)
      setUstBetragIndividuell(
        eintragToEdit.ust_satz === 'individuell' ? String(eintragToEdit.ust_betrag) : ''
      )
      setZeitpunkt(eintragToEdit.zeitpunkt_im_monat)
      setZahlungszielTage(eintragToEdit.zahlungsziel_tage != null ? String(eintragToEdit.zahlungsziel_tage) : '')
      setAktiv(eintragToEdit.aktiv)
      setAktivVon(eintragToEdit.aktiv_von ?? '')
      setAktivBis(eintragToEdit.aktiv_bis ?? '')

      const m = eintragToEdit.faelligkeits_monate
      if (eintragToEdit.zahlungsfrequenz === 'jaehrlich') {
        setMonatJaehrlich(m[0] ? String(m[0]) : '')
        setMonatQ1(''); setMonatQ2(''); setMonatQ3(''); setMonatQ4('')
      } else if (eintragToEdit.zahlungsfrequenz === 'quartalsweise') {
        setMonatJaehrlich('')
        setMonatQ1(String(m.find(x => Q1.includes(x)) ?? ''))
        setMonatQ2(String(m.find(x => Q2.includes(x)) ?? ''))
        setMonatQ3(String(m.find(x => Q3.includes(x)) ?? ''))
        setMonatQ4(String(m.find(x => Q4.includes(x)) ?? ''))
      } else {
        setMonatJaehrlich(''); setMonatQ1(''); setMonatQ2(''); setMonatQ3(''); setMonatQ4('')
      }
    } else {
      setKategorieId('')
      setUntergruppeId('')
      setName('')
      setFrequenz('monatlich')
      setMonatJaehrlich('')
      setMonatQ1(''); setMonatQ2(''); setMonatQ3(''); setMonatQ4('')
      setZeitpunkt('anfang')
      setZahlungszielTage('')
      setBetragNetto('')
      setUstSatz('19')
      setUstBetragIndividuell('')
      setAktiv(true)
      setAktivVon('')
      setAktivBis('')
    }
    setError(null)
  }, [open, eintragToEdit])

  const untergruppen = useMemo(
    () => allKategorien.filter(c => c.parent_id === kategorieId && c.level === 3),
    [allKategorien, kategorieId],
  )

  const handleGruppeChange = useCallback((val: string) => {
    setKategorieId(val)
    setUntergruppeId('')
  }, [])

  function handleFrequenzChange(val: Zahlungsfrequenz) {
    setFrequenz(val)
    setMonatJaehrlich('')
    setMonatQ1(''); setMonatQ2(''); setMonatQ3(''); setMonatQ4('')
  }

  // Berechnungen für Vorschau
  const netto = Number(betragNetto) || 0
  const ustBetrag = useMemo(() => {
    if (ustSatz === '19') return Math.round(netto * 0.19 * 100) / 100
    if (ustSatz === '7') return Math.round(netto * 0.07 * 100) / 100
    if (ustSatz === 'individuell') return Math.max(0, Number(ustBetragIndividuell) || 0)
    return 0
  }, [netto, ustSatz, ustBetragIndividuell])
  const brutto = Math.round((netto + ustBetrag) * 100) / 100

  function buildFaelligkeitsMonate(): number[] {
    if (frequenz === 'monatlich') return []
    if (frequenz === 'jaehrlich') return monatJaehrlich ? [Number(monatJaehrlich)] : []
    const monate: number[] = []
    if (monatQ1) monate.push(Number(monatQ1))
    if (monatQ2) monate.push(Number(monatQ2))
    if (monatQ3) monate.push(Number(monatQ3))
    if (monatQ4) monate.push(Number(monatQ4))
    return monate
  }

  function validate(): string | null {
    if (!kategorieId) return 'Bitte eine Gruppe auswählen.'
    if (untergruppen.length > 0 && !untergruppeId) return 'Bitte eine Untergruppe auswählen.'
    if (!name.trim()) return 'Bitte einen Namen eingeben.'
    if (!betragNetto || netto < 0.01) return 'Bitte einen Nettobetrag von mindestens 0,01 € eingeben.'
    if (netto > 10_000_000) return 'Nettobetrag darf maximal 10.000.000 € betragen.'
    if (ustSatz === 'individuell' && (Number(ustBetragIndividuell) <= 0))
      return 'Bitte einen individuellen USt-Betrag > 0 eingeben.'
    if (frequenz === 'jaehrlich' && !monatJaehrlich) return 'Bitte den Fälligkeitsmonat auswählen.'
    if (frequenz === 'quartalsweise' && (!monatQ1 || !monatQ2 || !monatQ3 || !monatQ4))
      return 'Bitte für jedes Quartal einen Monat auswählen.'
    if (aktivVon && aktivBis && aktivVon > aktivBis)
      return 'Das „Aktiv bis"-Datum darf nicht vor dem „Aktiv von"-Datum liegen.'
    return null
  }

  async function handleSave() {
    const err = validate()
    if (err) { setError(err); return }
    setSaving(true)
    setError(null)
    try {
      await onSave({
        kategorie_id: kategorieId,
        untergruppe_id: untergruppeId || null,
        name: name.trim(),
        zahlungsfrequenz: frequenz,
        faelligkeits_monate: buildFaelligkeitsMonate(),
        zeitpunkt_im_monat: zeitpunkt,
        zahlungsziel_tage: zahlungszielTage !== '' ? Number(zahlungszielTage) : null,
        betrag_netto: netto,
        ust_satz: ustSatz,
        ust_betrag_individuell: ustSatz === 'individuell' ? Number(ustBetragIndividuell) : 0,
        aktiv,
        aktiv_von: aktivVon || null,
        aktiv_bis: aktivBis || null,
      })
      onOpenChange(false)
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Unbekannter Fehler.')
    } finally {
      setSaving(false)
    }
  }

  const isEdit = !!eintragToEdit

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{isEdit ? 'Fixkosten bearbeiten' : 'Fixkosten anlegen'}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {/* Gruppe */}
          <div className="space-y-1">
            <Label>Gruppe <span className="text-destructive">*</span></Label>
            {gruppen.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                Keine Gruppen gefunden. Bitte zuerst die Kategorie „Operativ" im KPI-Modell anlegen.
              </p>
            ) : (
              <Select value={kategorieId} onValueChange={handleGruppeChange}>
                <SelectTrigger>
                  <SelectValue placeholder="Gruppe wählen…" />
                </SelectTrigger>
                <SelectContent>
                  {gruppen.map(k => (
                    <SelectItem key={k.id} value={k.id}>{k.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>

          {/* Untergruppe */}
          {kategorieId && untergruppen.length > 0 && (
            <div className="space-y-1">
              <Label>Untergruppe <span className="text-destructive">*</span></Label>
              <Select value={untergruppeId} onValueChange={setUntergruppeId}>
                <SelectTrigger>
                  <SelectValue placeholder="Untergruppe wählen…" />
                </SelectTrigger>
                <SelectContent>
                  {untergruppen.map(k => (
                    <SelectItem key={k.id} value={k.id}>{k.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {/* Name */}
          <div className="space-y-1">
            <Label>Name <span className="text-destructive">*</span></Label>
            <Input
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="z. B. Miete Lager"
              maxLength={100}
            />
          </div>

          {/* Zahlungsfrequenz */}
          <div className="space-y-1">
            <Label>Zahlungsfrequenz <span className="text-destructive">*</span></Label>
            <Select value={frequenz} onValueChange={v => handleFrequenzChange(v as Zahlungsfrequenz)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="monatlich">Monatlich</SelectItem>
                <SelectItem value="quartalsweise">Quartalsweise</SelectItem>
                <SelectItem value="jaehrlich">Jährlich</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Fälligkeitsmonat — Jährlich */}
          {frequenz === 'jaehrlich' && (
            <div className="space-y-1">
              <Label>Fälligkeitsmonat <span className="text-destructive">*</span></Label>
              <Select value={monatJaehrlich} onValueChange={setMonatJaehrlich}>
                <SelectTrigger><SelectValue placeholder="Monat wählen…" /></SelectTrigger>
                <SelectContent>
                  {Object.entries(MONAT_LABELS).map(([num, label]) => (
                    <SelectItem key={num} value={num}>{label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {/* Fälligkeitsmonate — Quartalsweise */}
          {frequenz === 'quartalsweise' && (
            <div className="space-y-2">
              <Label>Fälligkeitsmonate je Quartal <span className="text-destructive">*</span></Label>
              <div className="grid grid-cols-2 gap-2">
                {[
                  { label: 'Q1 (Jan–Mär)', monate: Q1, value: monatQ1, set: setMonatQ1 },
                  { label: 'Q2 (Apr–Jun)', monate: Q2, value: monatQ2, set: setMonatQ2 },
                  { label: 'Q3 (Jul–Sep)', monate: Q3, value: monatQ3, set: setMonatQ3 },
                  { label: 'Q4 (Okt–Dez)', monate: Q4, value: monatQ4, set: setMonatQ4 },
                ].map(({ label, monate, value, set }) => (
                  <div key={label} className="space-y-1">
                    <span className="text-xs text-muted-foreground">{label}</span>
                    <Select value={value} onValueChange={set}>
                      <SelectTrigger><SelectValue placeholder="Monat…" /></SelectTrigger>
                      <SelectContent>
                        {monate.map(m => (
                          <SelectItem key={m} value={String(m)}>{MONAT_LABELS[m]}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Zeitpunkt im Monat */}
          <div className="space-y-1">
            <Label>Zeitpunkt im Monat <span className="text-destructive">*</span></Label>
            <Select value={zeitpunkt} onValueChange={v => setZeitpunkt(v as ZeitpunktImMonat)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="anfang">Anfang</SelectItem>
                <SelectItem value="mitte">Mitte</SelectItem>
                <SelectItem value="ende">Ende</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Zahlungsziel */}
          <div className="space-y-1">
            <Label>Zahlungsziel (Tage)</Label>
            <Input
              type="number"
              min="0"
              max="365"
              step="1"
              value={zahlungszielTage}
              onChange={e => setZahlungszielTage(e.target.value)}
              placeholder="z. B. 30"
            />
            <p className="text-xs text-muted-foreground">Optional – Zahlungsziel in Tagen ab Rechnungsdatum</p>
          </div>

          {/* Nettobetrag + USt */}
          <div className="space-y-3">
            <div className="space-y-1">
              <Label>Nettobetrag (€) <span className="text-destructive">*</span></Label>
              <Input
                type="number"
                min="0.01"
                max="10000000"
                step="0.01"
                value={betragNetto}
                onChange={e => setBetragNetto(e.target.value)}
                placeholder="0,00"
              />
            </div>

            <div className="space-y-1">
              <Label>Umsatzsteuer <span className="text-destructive">*</span></Label>
              <Select value={ustSatz} onValueChange={v => { setUstSatz(v as UstSatz); setUstBetragIndividuell('') }}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {(Object.entries(UST_SATZ_LABELS) as [UstSatz, string][]).map(([val, label]) => (
                    <SelectItem key={val} value={val}>{label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Individueller USt-Betrag */}
            {ustSatz === 'individuell' && (
              <div className="space-y-1">
                <Label>USt-Betrag individuell (€) <span className="text-destructive">*</span></Label>
                <Input
                  type="number"
                  min="0.01"
                  step="0.01"
                  value={ustBetragIndividuell}
                  onChange={e => setUstBetragIndividuell(e.target.value)}
                  placeholder="0,00"
                />
              </div>
            )}

            {/* Brutto-Vorschau */}
            {netto > 0 && (
              <div className="rounded-md bg-muted px-3 py-2 text-sm flex justify-between">
                <span className="text-muted-foreground">Bruttobetrag (berechnet)</span>
                <span className="font-medium tabular-nums">{EUR.format(brutto)}</span>
              </div>
            )}
          </div>

          {/* Aktiv-Zeitraum (KW) */}
          <div className="space-y-2">
            <Label>Aktiv-Zeitraum (optional)</Label>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <span className="text-xs text-muted-foreground">Von</span>
                <Input
                  type="date"
                  value={aktivVon}
                  onChange={e => setAktivVon(e.target.value)}
                />
                {aktivVon && (
                  <p className="text-xs text-muted-foreground">{getKalenderwoche(aktivVon)}</p>
                )}
              </div>
              <div className="space-y-1">
                <span className="text-xs text-muted-foreground">Bis</span>
                <Input
                  type="date"
                  value={aktivBis}
                  onChange={e => setAktivBis(e.target.value)}
                />
                {aktivBis && (
                  <p className="text-xs text-muted-foreground">{getKalenderwoche(aktivBis)}</p>
                )}
              </div>
            </div>
            <p className="text-xs text-muted-foreground">
              Leer lassen = unbegrenzt aktiv
            </p>
          </div>

          {/* Aktiv */}
          <div className="flex items-center gap-3">
            <Switch id="aktiv" checked={aktiv} onCheckedChange={setAktiv} />
            <Label htmlFor="aktiv">Aktiv</Label>
          </div>

          {error && (
            <Alert variant="destructive">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
            Abbrechen
          </Button>
          <Button onClick={handleSave} disabled={saving || gruppen.length === 0}>
            {saving ? 'Speichert…' : isEdit ? 'Speichern' : 'Anlegen'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
