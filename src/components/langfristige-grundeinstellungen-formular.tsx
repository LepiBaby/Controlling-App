'use client'

import { useState, useEffect } from 'react'
import { useParams } from 'next/navigation'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  useLangfristigeGrundeinstellungen,
  MIN_HORIZONT_MONATE,
  MAX_HORIZONT_MONATE,
} from '@/hooks/use-langfristige-grundeinstellungen'
import { useToast } from '@/hooks/use-toast'

const MONATSNAMEN = [
  'Januar',
  'Februar',
  'März',
  'April',
  'Mai',
  'Juni',
  'Juli',
  'August',
  'September',
  'Oktober',
  'November',
  'Dezember',
]

// Auswahlbereich für das Startjahr: einige Jahre zurück bis weit in die Zukunft,
// passend zur langfristigen Mehrjahresplanung (bis 10 Jahre Horizont).
function jahresOptionen(): number[] {
  const aktuell = new Date().getFullYear()
  const von = aktuell - 5
  const bis = aktuell + 20
  const jahre: number[] = []
  for (let j = von; j <= bis; j++) jahre.push(j)
  return jahre
}

function validateMonate(
  raw: string,
): { valid: true; value: number } | { valid: false; message: string } {
  if (raw.trim() === '') {
    return { valid: false, message: 'Bitte eine ganze Zahl eingeben.' }
  }
  if (!/^-?\d+$/.test(raw.trim())) {
    return { valid: false, message: 'Bitte eine ganze Zahl eingeben.' }
  }
  const num = parseInt(raw.trim(), 10)
  if (num < MIN_HORIZONT_MONATE || num > MAX_HORIZONT_MONATE) {
    return {
      valid: false,
      message: `Bitte einen Wert zwischen ${MIN_HORIZONT_MONATE} und ${MAX_HORIZONT_MONATE} eingeben.`,
    }
  }
  return { valid: true, value: num }
}

function validateBetrag(
  raw: string,
): { valid: true; value: number } | { valid: false; message: string } {
  // Leeres Feld bedeutet 0 (kein Startguthaben). Komma als Dezimaltrennzeichen erlauben.
  const normalized = raw.trim().replace(',', '.')
  if (normalized === '') {
    return { valid: true, value: 0 }
  }
  if (!/^-?\d+(\.\d+)?$/.test(normalized)) {
    return { valid: false, message: 'Bitte einen gültigen Betrag eingeben.' }
  }
  return { valid: true, value: parseFloat(normalized) }
}

export function LangfristigeGrundeinstellungenFormular() {
  const params = useParams()
  const versionId = typeof params.versionId === 'string' ? params.versionId : ''
  const {
    startmonatMonat,
    startmonatJahr,
    startkontostand,
    planungshorizont,
    planungshorizontAbsatz,
    loading,
    error,
    saveStartmonat,
    saveStartkontostand,
    savePlanungshorizont,
    saveAbsatz,
  } = useLangfristigeGrundeinstellungen(versionId)
  const { toast } = useToast()

  const [allgemeinInput, setAllgemeinInput] = useState<string>('')
  const [absatzInput, setAbsatzInput] = useState<string>('')
  const [kontostandInput, setKontostandInput] = useState<string>('')
  const [allgemeinError, setAllgemeinError] = useState<string | null>(null)
  const [absatzError, setAbsatzError] = useState<string | null>(null)
  const [kontostandError, setKontostandError] = useState<string | null>(null)

  useEffect(() => {
    if (!loading) {
      setAllgemeinInput(String(planungshorizont))
      setAbsatzInput(planungshorizontAbsatz !== null ? String(planungshorizontAbsatz) : '')
      setKontostandInput(String(startkontostand))
    }
  }, [loading, planungshorizont, planungshorizontAbsatz, startkontostand])

  async function handleMonatChange(value: string) {
    const monat = Number(value)
    if (monat === startmonatMonat) return
    try {
      await saveStartmonat(monat, startmonatJahr)
      toast({ title: 'Einstellung gespeichert.' })
    } catch {
      toast({
        title: 'Fehler',
        description: 'Einstellung konnte nicht gespeichert werden.',
        variant: 'destructive',
      })
    }
  }

  async function handleJahrChange(value: string) {
    const jahr = Number(value)
    if (jahr === startmonatJahr) return
    try {
      await saveStartmonat(startmonatMonat, jahr)
      toast({ title: 'Einstellung gespeichert.' })
    } catch {
      toast({
        title: 'Fehler',
        description: 'Einstellung konnte nicht gespeichert werden.',
        variant: 'destructive',
      })
    }
  }

  async function handleKontostandBlur() {
    const result = validateBetrag(kontostandInput)
    if (!result.valid) {
      setKontostandError(result.message)
      setKontostandInput(String(startkontostand))
      return
    }
    setKontostandError(null)
    if (result.value === startkontostand) {
      setKontostandInput(String(result.value))
      return
    }
    try {
      await saveStartkontostand(result.value)
      setKontostandInput(String(result.value))
      toast({ title: 'Einstellung gespeichert.' })
    } catch {
      toast({
        title: 'Fehler',
        description: 'Einstellung konnte nicht gespeichert werden.',
        variant: 'destructive',
      })
      setKontostandInput(String(startkontostand))
    }
  }

  async function handleAllgemeinBlur() {
    const result = validateMonate(allgemeinInput)
    if (!result.valid) {
      setAllgemeinError(result.message)
      setAllgemeinInput(String(planungshorizont))
      return
    }
    setAllgemeinError(null)
    if (result.value === planungshorizont) return
    try {
      await savePlanungshorizont(result.value)
      toast({ title: 'Einstellung gespeichert.' })
    } catch {
      toast({
        title: 'Fehler',
        description: 'Einstellung konnte nicht gespeichert werden.',
        variant: 'destructive',
      })
      setAllgemeinInput(String(planungshorizont))
    }
  }

  async function handleAbsatzBlur() {
    // Leeres Feld bedeutet "nicht gesetzt" -> es gilt der allgemeine Horizont
    if (absatzInput.trim() === '') {
      if (planungshorizontAbsatz === null) return
      try {
        await saveAbsatz(null)
        toast({ title: 'Einstellung gespeichert.' })
      } catch {
        toast({
          title: 'Fehler',
          description: 'Einstellung konnte nicht gespeichert werden.',
          variant: 'destructive',
        })
        setAbsatzInput(planungshorizontAbsatz !== null ? String(planungshorizontAbsatz) : '')
      }
      return
    }

    const result = validateMonate(absatzInput)
    if (!result.valid) {
      setAbsatzError(result.message)
      setAbsatzInput(planungshorizontAbsatz !== null ? String(planungshorizontAbsatz) : '')
      return
    }
    setAbsatzError(null)
    if (result.value === planungshorizontAbsatz) return
    try {
      await saveAbsatz(result.value)
      toast({ title: 'Einstellung gespeichert.' })
    } catch {
      toast({
        title: 'Fehler',
        description: 'Einstellung konnte nicht gespeichert werden.',
        variant: 'destructive',
      })
      setAbsatzInput(planungshorizontAbsatz !== null ? String(planungshorizontAbsatz) : '')
    }
  }

  if (loading) {
    return <div className="py-8 text-center text-sm text-muted-foreground">Laden…</div>
  }

  if (error) {
    return (
      <div className="rounded-lg border border-destructive bg-destructive/10 p-4 text-sm text-destructive">
        {error}
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="rounded-lg border bg-card p-6 space-y-4">
        <h2 className="text-base font-semibold">Startmonat</h2>
        <div className="flex flex-wrap gap-4">
          <div className="space-y-2">
            <Label htmlFor="startmonat-monat">Monat</Label>
            <Select value={String(startmonatMonat)} onValueChange={handleMonatChange}>
              <SelectTrigger id="startmonat-monat" className="w-40">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {MONATSNAMEN.map((name, idx) => (
                  <SelectItem key={idx + 1} value={String(idx + 1)}>
                    {name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="startmonat-jahr">Jahr</Label>
            <Select value={String(startmonatJahr)} onValueChange={handleJahrChange}>
              <SelectTrigger id="startmonat-jahr" className="w-32">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {jahresOptionen().map(jahr => (
                  <SelectItem key={jahr} value={String(jahr)}>
                    {jahr}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="startkontostand">Startkontostand (€)</Label>
            <Input
              id="startkontostand"
              type="number"
              step="0.01"
              value={kontostandInput}
              onChange={e => {
                setKontostandInput(e.target.value)
                setKontostandError(null)
              }}
              onBlur={handleKontostandBlur}
              className="w-40"
              aria-describedby={kontostandError ? 'kontostand-error' : undefined}
            />
            {kontostandError && (
              <p id="kontostand-error" className="text-sm text-destructive">
                {kontostandError}
              </p>
            )}
          </div>
        </div>
      </div>

      <div className="rounded-lg border bg-card p-6 space-y-4">
        <h2 className="text-base font-semibold">Planungshorizont</h2>
        <div className="space-y-2">
          <Label htmlFor="planungshorizont-allgemein">Planungshorizont Allgemein (Monate)</Label>
          <Input
            id="planungshorizont-allgemein"
            type="number"
            min={MIN_HORIZONT_MONATE}
            max={MAX_HORIZONT_MONATE}
            step={1}
            value={allgemeinInput}
            onChange={e => {
              setAllgemeinInput(e.target.value)
              setAllgemeinError(null)
            }}
            onBlur={handleAllgemeinBlur}
            className="w-32"
            aria-describedby={allgemeinError ? 'allgemein-error' : undefined}
          />
          {allgemeinError && (
            <p id="allgemein-error" className="text-sm text-destructive">
              {allgemeinError}
            </p>
          )}
        </div>
        <div className="space-y-2">
          <Label htmlFor="planungshorizont-absatz">Planungshorizont Absatz (Monate)</Label>
          <Input
            id="planungshorizont-absatz"
            type="number"
            min={MIN_HORIZONT_MONATE}
            max={MAX_HORIZONT_MONATE}
            step={1}
            value={absatzInput}
            onChange={e => {
              setAbsatzInput(e.target.value)
              setAbsatzError(null)
            }}
            onBlur={handleAbsatzBlur}
            className="w-32"
            placeholder={String(planungshorizont)}
            aria-describedby={absatzError ? 'absatz-error' : undefined}
          />
          {absatzError && (
            <p id="absatz-error" className="text-sm text-destructive">
              {absatzError}
            </p>
          )}
        </div>
      </div>
    </div>
  )
}
