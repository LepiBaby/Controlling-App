'use client'

import { useState, useEffect, useRef } from 'react'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  useLangfristigeVertriebGruppierung,
  GRUPPIERUNGEN,
  GRUPPIERUNG_LABELS,
  type LangfristigeGruppierung,
} from '@/hooks/use-langfristige-vertrieb-gruppierung'
import { useToast } from '@/hooks/use-toast'

// PROJ-78: Gemeinsame Einstellungszeile „Gruppierung + Zahlungsziel" für die
// langfristigen Vertriebs-Reiter. Nur Monatlich/Quartalsweise, ohne „Nächste
// Zahlungswoche". Für plattformgebundene Bereiche `plattformId` setzen; für die
// versionsweite Retouren-Allgemein-Einstellung `plattformId` weglassen.

export function LangfristigeGruppierungForm({
  versionId,
  endpointSuffix,
  plattformId,
}: {
  versionId: string
  endpointSuffix: string
  plattformId?: string
}) {
  const { einstellungen, loading, error, upsert } = useLangfristigeVertriebGruppierung(
    versionId,
    endpointSuffix,
    // undefined = versionsweit; ein String = plattformgebunden.
    plattformId === undefined ? undefined : plattformId,
  )
  const { toast } = useToast()
  const [zahlungszielStr, setZahlungszielStr] = useState('')
  const initializedRef = useRef(false)
  const feldId = plattformId ?? endpointSuffix

  useEffect(() => {
    if (!loading && !initializedRef.current) {
      initializedRef.current = true
      setZahlungszielStr(
        einstellungen.zahlungsziel_tage != null ? String(einstellungen.zahlungsziel_tage) : '',
      )
    }
  }, [loading, einstellungen.zahlungsziel_tage])

  async function handleGruppierungChange(value: string) {
    try {
      await upsert({ gruppierung: value as LangfristigeGruppierung })
    } catch {
      toast({
        title: 'Fehler',
        description: 'Einstellung konnte nicht gespeichert werden.',
        variant: 'destructive',
      })
    }
  }

  async function handleZahlungszielBlur() {
    const trimmed = zahlungszielStr.trim()
    const parsed = trimmed === '' ? null : Math.round(parseFloat(trimmed))
    if (parsed !== null && (isNaN(parsed) || parsed < 0)) return
    if (parsed === (einstellungen.zahlungsziel_tage ?? null)) return
    try {
      await upsert({ zahlungsziel_tage: parsed })
    } catch {
      setZahlungszielStr(
        einstellungen.zahlungsziel_tage != null ? String(einstellungen.zahlungsziel_tage) : '',
      )
      toast({
        title: 'Fehler',
        description: 'Einstellung konnte nicht gespeichert werden.',
        variant: 'destructive',
      })
    }
  }

  if (loading) {
    return <div className="text-sm text-muted-foreground py-2">Laden…</div>
  }

  if (error) {
    return (
      <div className="rounded-lg border border-destructive bg-destructive/10 p-3 text-sm text-destructive">
        {error}
      </div>
    )
  }

  return (
    <div className="rounded-lg border bg-muted/20 p-4">
      <div className="flex flex-wrap items-end gap-4">
        <div className="space-y-1.5">
          <Label htmlFor={`gruppierung-${feldId}`}>Gruppierung</Label>
          <Select value={einstellungen.gruppierung} onValueChange={handleGruppierungChange}>
            <SelectTrigger id={`gruppierung-${feldId}`} className="w-44">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {GRUPPIERUNGEN.map(g => (
                <SelectItem key={g} value={g}>
                  {GRUPPIERUNG_LABELS[g]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor={`zahlungsziel-${feldId}`}>Zahlungsziel (Tage)</Label>
          <Input
            id={`zahlungsziel-${feldId}`}
            type="number"
            min={0}
            step={1}
            value={zahlungszielStr}
            onChange={e => setZahlungszielStr(e.target.value)}
            onBlur={handleZahlungszielBlur}
            placeholder="—"
            className="w-44"
          />
        </div>
      </div>
    </div>
  )
}
