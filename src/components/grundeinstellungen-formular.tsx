'use client'

import { useState, useEffect } from 'react'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useGrundeinstellungen } from '@/hooks/use-grundeinstellungen'
import { useToast } from '@/hooks/use-toast'

export function GrundeinstellungenFormular() {
  const { planungshorizont, planungshorizontAbsatz, vergangenheitshorizont, loading, error, save, saveAbsatz, saveVergangenheit } = useGrundeinstellungen()
  const { toast } = useToast()

  const [allgemeinInput, setAllgemeinInput] = useState<string>('')
  const [absatzInput, setAbsatzInput] = useState<string>('')
  const [vergangenheitInput, setVergangenheitInput] = useState<string>('')
  const [allgemeinError, setAllgemeinError] = useState<string | null>(null)
  const [absatzError, setAbsatzError] = useState<string | null>(null)
  const [vergangenheitError, setVergangenheitError] = useState<string | null>(null)

  useEffect(() => {
    if (!loading) {
      setAllgemeinInput(String(planungshorizont))
      setAbsatzInput(planungshorizontAbsatz !== null ? String(planungshorizontAbsatz) : '')
      setVergangenheitInput(String(vergangenheitshorizont))
    }
  }, [loading, planungshorizont, planungshorizontAbsatz, vergangenheitshorizont])

  function validateWochen(raw: string): { valid: true; value: number } | { valid: false; message: string } {
    if (raw.trim() === '') {
      return { valid: false, message: 'Bitte eine ganze Zahl eingeben.' }
    }
    if (!/^-?\d+$/.test(raw.trim())) {
      return { valid: false, message: 'Bitte eine ganze Zahl eingeben.' }
    }
    const num = parseInt(raw.trim(), 10)
    if (num < 1 || num > 52) {
      return { valid: false, message: 'Bitte einen Wert zwischen 1 und 52 eingeben.' }
    }
    return { valid: true, value: num }
  }

  async function handleAllgemeinBlur() {
    const result = validateWochen(allgemeinInput)
    if (!result.valid) {
      setAllgemeinError(result.message)
      setAllgemeinInput(String(planungshorizont))
      return
    }
    setAllgemeinError(null)
    if (result.value === planungshorizont) return
    try {
      await save(result.value)
      toast({ title: 'Einstellung gespeichert.' })
    } catch {
      toast({ title: 'Fehler', description: 'Einstellung konnte nicht gespeichert werden.', variant: 'destructive' })
      setAllgemeinInput(String(planungshorizont))
    }
  }

  async function handleVergangenheitBlur() {
    const result = validateWochen(vergangenheitInput)
    if (!result.valid) {
      setVergangenheitError(result.message)
      setVergangenheitInput(String(vergangenheitshorizont))
      return
    }
    setVergangenheitError(null)
    if (result.value === vergangenheitshorizont) return
    try {
      await saveVergangenheit(result.value)
      toast({ title: 'Einstellung gespeichert.' })
    } catch {
      toast({ title: 'Fehler', description: 'Einstellung konnte nicht gespeichert werden.', variant: 'destructive' })
      setVergangenheitInput(String(vergangenheitshorizont))
    }
  }

  async function handleAbsatzBlur() {
    if (absatzInput.trim() === '') {
      if (planungshorizontAbsatz === null) return
      try {
        await saveAbsatz(null)
        toast({ title: 'Einstellung gespeichert.' })
      } catch {
        toast({ title: 'Fehler', description: 'Einstellung konnte nicht gespeichert werden.', variant: 'destructive' })
        setAbsatzInput(planungshorizontAbsatz !== null ? String(planungshorizontAbsatz) : '')
      }
      return
    }

    const result = validateWochen(absatzInput)
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
      toast({ title: 'Fehler', description: 'Einstellung konnte nicht gespeichert werden.', variant: 'destructive' })
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
        <h2 className="text-base font-semibold">Planungshorizont</h2>
        <div className="space-y-2">
          <Label htmlFor="planungshorizont-allgemein">Planungshorizont Allgemein (Kalenderwochen)</Label>
          <Input
            id="planungshorizont-allgemein"
            type="number"
            min={1}
            max={52}
            step={1}
            value={allgemeinInput}
            onChange={e => { setAllgemeinInput(e.target.value); setAllgemeinError(null) }}
            onBlur={handleAllgemeinBlur}
            className="w-32"
            aria-describedby={allgemeinError ? 'allgemein-error' : undefined}
          />
          {allgemeinError && (
            <p id="allgemein-error" className="text-sm text-destructive">{allgemeinError}</p>
          )}
        </div>
        <div className="space-y-2">
          <Label htmlFor="planungshorizont-absatz">Planungshorizont Absatz (Kalenderwochen)</Label>
          <Input
            id="planungshorizont-absatz"
            type="number"
            min={1}
            max={52}
            step={1}
            value={absatzInput}
            onChange={e => { setAbsatzInput(e.target.value); setAbsatzError(null) }}
            onBlur={handleAbsatzBlur}
            className="w-32"
            placeholder={String(planungshorizont)}
            aria-describedby={absatzError ? 'absatz-error' : undefined}
          />
          {absatzError && (
            <p id="absatz-error" className="text-sm text-destructive">{absatzError}</p>
          )}
        </div>
      </div>
      <div className="rounded-lg border bg-card p-6 space-y-4">
        <h2 className="text-base font-semibold">Vergangenheitshorizont</h2>
        <div className="space-y-2">
          <Label htmlFor="vergangenheitshorizont">Vergangenheitshorizont (Kalenderwochen)</Label>
          <Input
            id="vergangenheitshorizont"
            type="number"
            min={1}
            max={52}
            step={1}
            value={vergangenheitInput}
            onChange={e => { setVergangenheitInput(e.target.value); setVergangenheitError(null) }}
            onBlur={handleVergangenheitBlur}
            className="w-32"
            aria-describedby={vergangenheitError ? 'vergangenheit-error' : undefined}
          />
          {vergangenheitError && (
            <p id="vergangenheit-error" className="text-sm text-destructive">{vergangenheitError}</p>
          )}
        </div>
      </div>
    </div>
  )
}
