'use client'

import { useState, useMemo } from 'react'
import { CalendarIcon } from 'lucide-react'
import { de } from 'date-fns/locale'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Checkbox } from '@/components/ui/checkbox'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import { Calendar } from '@/components/ui/calendar'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { useKpiCategories } from '@/hooks/use-kpi-categories'
import {
  useAuszahlungsEinstellungen,
  type AuszahlungsEinstellung,
  type Rhythmus,
  RHYTHMUS_VALUES,
  RHYTHMUS_LABELS,
  RHYTHMUS_WOCHEN,
  getCurrentISOWeekAndYear,
  calculateNextPayoutWeek,
} from '@/hooks/use-auszahlungs-einstellungen'
import { useToast } from '@/hooks/use-toast'

/** Montag der ISO-Woche (kw, jahr) als Date-Objekt */
function getMondayOfISOWeek(kw: number, jahr: number): Date {
  const jan4 = new Date(jahr, 0, 4) // 4. Jan liegt immer in KW1
  const dayOfWeek = jan4.getDay() || 7 // Mo=1 … So=7
  const kw1Monday = new Date(jan4)
  kw1Monday.setDate(jan4.getDate() - (dayOfWeek - 1))
  const result = new Date(kw1Monday)
  result.setDate(kw1Monday.getDate() + (kw - 1) * 7)
  return result
}

/** ISO-Woche + Jahr aus einem Date ableiten */
function getISOWeekAndYear(date: Date): { kw: number; jahr: number } {
  const d = new Date(date)
  d.setHours(12, 0, 0, 0)
  d.setDate(d.getDate() + 4 - (d.getDay() || 7))
  const yearStart = new Date(d.getFullYear(), 0, 1)
  const kw = Math.ceil(((d.getTime() - yearStart.getTime()) / 86_400_000 + 1) / 7)
  return { kw, jahr: d.getFullYear() }
}

// --- Form für eine einzelne Plattform ---

function AuszahlungseinstellungenPlatformForm({ plattformId }: { plattformId: string }) {
  const { einstellung, loading, error, upsert } = useAuszahlungsEinstellungen(plattformId)
  const { toast } = useToast()
  const [saving, setSaving] = useState(false)
  const [calendarOpen, setCalendarOpen] = useState(false)

  // Berechnete nächste Auszahlungswoche aus gespeicherter Basis + Rhythmus
  const displayedKw = useMemo(() => {
    if (
      !einstellung?.naechste_auszahlung_basis_kw ||
      !einstellung?.naechste_auszahlung_basis_jahr
    ) {
      return null
    }
    const now = getCurrentISOWeekAndYear()
    return calculateNextPayoutWeek(
      einstellung.naechste_auszahlung_basis_kw,
      einstellung.naechste_auszahlung_basis_jahr,
      RHYTHMUS_WOCHEN[einstellung.auszahlungsrhythmus],
      now.kw,
      now.jahr
    )
  }, [einstellung])

  // Das ausgewählte Datum für den Kalender (Montag der angezeigten KW)
  const selectedDate = useMemo(() => {
    if (!displayedKw) return undefined
    return getMondayOfISOWeek(displayedKw.kw, displayedKw.jahr)
  }, [displayedKw])

  const current: AuszahlungsEinstellung = einstellung ?? {
    sales_plattform_id: plattformId,
    auszahlungsrhythmus: 'woechentlich',
    naechste_auszahlung_basis_kw: null,
    naechste_auszahlung_basis_jahr: null,
    retouren_inkludiert: false,
    marketing_inkludiert: false,
  }

  async function handleSave(patch: Partial<AuszahlungsEinstellung>) {
    setSaving(true)
    try {
      await upsert({ sales_plattform_id: plattformId, ...patch })
    } catch {
      toast({
        title: 'Fehler',
        description: 'Einstellung konnte nicht gespeichert werden.',
        variant: 'destructive',
      })
    } finally {
      setSaving(false)
    }
  }

  function handleDateSelect(date: Date | undefined) {
    setCalendarOpen(false)
    if (!date) {
      handleSave({
        naechste_auszahlung_basis_kw: null,
        naechste_auszahlung_basis_jahr: null,
      })
      return
    }
    const { kw, jahr } = getISOWeekAndYear(date)
    handleSave({
      naechste_auszahlung_basis_kw: kw,
      naechste_auszahlung_basis_jahr: jahr,
    })
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
    <div className={`rounded-lg border bg-card p-6 space-y-6 transition-opacity ${saving ? 'opacity-60' : ''}`}>
      {/* Auszahlungsrhythmus */}
      <div className="flex items-center gap-6">
        <Label className="w-56 shrink-0 text-sm font-medium">Auszahlungsrhythmus</Label>
        <Select
          value={current.auszahlungsrhythmus}
          onValueChange={v => handleSave({ auszahlungsrhythmus: v as Rhythmus })}
          disabled={saving}
        >
          <SelectTrigger className="w-48">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {RHYTHMUS_VALUES.map(r => (
              <SelectItem key={r} value={r}>
                {RHYTHMUS_LABELS[r]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Nächste Auszahlungswoche */}
      <div className="flex items-center gap-6">
        <div className="w-56 shrink-0">
          <Label className="text-sm font-medium">Nächste Auszahlungswoche</Label>
          {displayedKw && (
            <p className="mt-0.5 text-xs text-muted-foreground">
              KW {displayedKw.kw} / {displayedKw.jahr}
            </p>
          )}
        </div>
        <Popover open={calendarOpen} onOpenChange={setCalendarOpen}>
          <PopoverTrigger asChild>
            <Button
              variant="outline"
              disabled={saving}
              className="w-48 justify-start gap-2 font-normal"
            >
              <CalendarIcon className="size-4 text-muted-foreground" />
              {selectedDate
                ? selectedDate.toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' })
                : <span className="text-muted-foreground">Datum wählen</span>
              }
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0" align="start">
            <Calendar
              mode="single"
              selected={selectedDate}
              onSelect={handleDateSelect}
              locale={de}
              showWeekNumber
            />
            {selectedDate && (
              <div className="border-t p-2">
                <Button
                  variant="ghost"
                  size="sm"
                  className="w-full text-muted-foreground"
                  onClick={() => handleDateSelect(undefined)}
                >
                  Auswahl löschen
                </Button>
              </div>
            )}
          </PopoverContent>
        </Popover>
      </div>

      {/* Retouren */}
      <div className="flex items-center gap-6">
        <Label className="w-56 shrink-0 text-sm font-medium" htmlFor={`retouren-${plattformId}`}>
          Retouren
        </Label>
        <Checkbox
          id={`retouren-${plattformId}`}
          checked={current.retouren_inkludiert}
          onCheckedChange={v => handleSave({ retouren_inkludiert: Boolean(v) })}
          disabled={saving}
          aria-label="Retourenausgaben inkludiert"
        />
      </div>

      {/* Marketing */}
      <div className="flex items-center gap-6">
        <Label className="w-56 shrink-0 text-sm font-medium" htmlFor={`marketing-${plattformId}`}>
          Marketing
        </Label>
        <Checkbox
          id={`marketing-${plattformId}`}
          checked={current.marketing_inkludiert}
          onCheckedChange={v => handleSave({ marketing_inkludiert: Boolean(v) })}
          disabled={saving}
          aria-label="Marketingausgaben inkludiert"
        />
      </div>
    </div>
  )
}

// --- Hauptkomponente ---

export function AuszahlungseinstellungenFormular() {
  const { categories: plattformen, loading: plattformenLoading } =
    useKpiCategories('sales_plattformen')

  const sortedPlattformen = useMemo(
    () =>
      plattformen
        .filter(p => p.level === 1)
        .sort((a, b) => a.sort_order - b.sort_order),
    [plattformen]
  )

  if (plattformenLoading) {
    return <div className="py-8 text-center text-sm text-muted-foreground">Laden…</div>
  }

  if (sortedPlattformen.length === 0) {
    return (
      <div className="rounded-lg border bg-muted/30 p-8 text-center space-y-3">
        <p className="font-medium">Keine Sales-Plattformen definiert</p>
        <p className="text-sm text-muted-foreground">
          Bitte zuerst Sales-Plattformen im KPI-Modell anlegen, bevor Auszahlungseinstellungen
          gepflegt werden können.
        </p>
        <a href="/dashboard/kpi-modell">
          <Button variant="outline" size="sm" className="mt-2">
            Zum KPI-Modell
          </Button>
        </a>
      </div>
    )
  }

  return (
    <Tabs defaultValue={sortedPlattformen[0]?.id} className="space-y-4">
      <TabsList className="w-full h-auto">
        {sortedPlattformen.map(p => (
          <TabsTrigger key={p.id} value={p.id} className="flex-1">
            {p.name}
          </TabsTrigger>
        ))}
      </TabsList>
      {sortedPlattformen.map(p => (
        <TabsContent key={p.id} value={p.id} className="mt-0">
          <AuszahlungseinstellungenPlatformForm plattformId={p.id} />
        </TabsContent>
      ))}
    </Tabs>
  )
}
