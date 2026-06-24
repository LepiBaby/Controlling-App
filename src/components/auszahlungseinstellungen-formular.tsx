'use client'

import { useState, useMemo } from 'react'
import { CalendarIcon, X } from 'lucide-react'
import { de } from 'date-fns/locale'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
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
import {
  useAuszahlungsMarketingGruppen,
} from '@/hooks/use-auszahlungs-marketing-gruppen'
import { MultiSelect } from '@/components/multi-select'
import { useToast } from '@/hooks/use-toast'

/** Montag der ISO-Woche (kw, jahr) als Date-Objekt */
function getMondayOfISOWeek(kw: number, jahr: number): Date {
  const jan4 = new Date(jahr, 0, 4)
  const dayOfWeek = jan4.getDay() || 7
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
  const { gruppen, loading: gruppenLoading, upsert: upsertGruppe, remove: removeGruppe } =
    useAuszahlungsMarketingGruppen(plattformId)
  const { categories: alleAusgabenKats, loading: katsLoading } = useKpiCategories('ausgaben_kosten')
  const { toast } = useToast()
  const [saving, setSaving] = useState(false)
  const [calendarOpen, setCalendarOpen] = useState(false)

  // Marketing-Untergruppen aus dem KPI-Modell
  const marketingUntergruppen = useMemo(() => {
    const parent = alleAusgabenKats.find(
      k => k.level === 1 && k.name.toLowerCase() === 'marketing'
    )
    if (!parent) return []
    return alleAusgabenKats
      .filter(k => k.level === 2 && k.parent_id === parent.id)
      .sort((a, b) => a.sort_order - b.sort_order)
  }, [alleAusgabenKats])

  // IDs der aktuell konfigurierten Marketing-Gruppen
  const selectedGruppenIds = useMemo(
    () => gruppen.map(g => g.kpi_kategorie_id),
    [gruppen]
  )

  // Nächste Auszahlungswoche: exakt die gespeicherte Basis-KW, automatisch
  // um einen Rhythmus vorgerückt sobald diese Woche in der Vergangenheit liegt.
  // verschiebung_wochen wird hier NICHT addiert — es wird nur im Backend für
  // die Umsatz-Zuordnung verwendet.
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

  // Montag der angezeigten KW — für Kalender-Markierung und Button-Text.
  const selectedDate = useMemo(() => {
    if (!displayedKw) return undefined
    return getMondayOfISOWeek(displayedKw.kw, displayedKw.jahr)
  }, [displayedKw])

  const current: AuszahlungsEinstellung = einstellung ?? {
    sales_plattform_id: plattformId,
    auszahlungsrhythmus: 'woechentlich',
    naechste_auszahlung_basis_kw: null,
    naechste_auszahlung_basis_jahr: null,
    verschiebung_wochen: 0,
    retouren_inkludiert: false,
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
    // Geklicktes Datum direkt als neue Basis speichern.
    // Angezeigte KW = diese Basis, automatisch vorgerückt wenn sie abgelaufen ist.
    const { kw, jahr } = getISOWeekAndYear(date)
    handleSave({
      naechste_auszahlung_basis_kw: kw,
      naechste_auszahlung_basis_jahr: jahr,
    })
  }

  async function handleMarketingGruppenChange(newIds: string[]) {
    const currentIds = selectedGruppenIds
    const added = newIds.filter(id => !currentIds.includes(id))
    const removed = currentIds.filter(id => !newIds.includes(id))

    for (const id of added) {
      try {
        await upsertGruppe(plattformId, id, true)
      } catch {
        toast({ title: 'Fehler', description: 'Marketing-Gruppe konnte nicht hinzugefügt werden.', variant: 'destructive' })
      }
    }
    for (const id of removed) {
      try {
        await removeGruppe(plattformId, id)
      } catch {
        toast({ title: 'Fehler', description: 'Marketing-Gruppe konnte nicht entfernt werden.', variant: 'destructive' })
      }
    }
  }

  if (loading || gruppenLoading || katsLoading) {
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
              defaultMonth={selectedDate}
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

      {/* Verschiebung */}
      <div className="flex items-center gap-6">
        <Label className="w-56 shrink-0 text-sm font-medium">Verschiebung / Zurückstellung</Label>
        <div className="flex items-center gap-2">
          <Input
            type="number"
            min={0}
            max={52}
            step={1}
            value={current.verschiebung_wochen}
            onChange={e => {
              const val = Math.max(0, Math.min(52, parseInt(e.target.value) || 0))
              handleSave({ verschiebung_wochen: val })
            }}
            disabled={saving}
            className="w-20"
            aria-label="Verschiebung in Wochen"
          />
          <span className="text-sm text-muted-foreground">Wochen</span>
        </div>
      </div>

      {/* Marketing */}
      <div className="flex items-start gap-6">
        <Label className="w-56 shrink-0 text-sm font-medium pt-2">Marketing</Label>
        {marketingUntergruppen.length === 0 ? (
          <p className="text-sm text-muted-foreground pt-2">
            Keine Marketing-Untergruppen im KPI-Modell gepflegt.{' '}
            <a href="/dashboard/kpi-modell" className="underline">
              Zum KPI-Modell
            </a>
          </p>
        ) : (
          <div className="flex items-start gap-6">
            {/* Auswahl-Dropdown */}
            <MultiSelect
              options={marketingUntergruppen.map(ug => ({ id: ug.id, name: ug.name }))}
              selected={selectedGruppenIds}
              onChange={handleMarketingGruppenChange}
              placeholder="Untergruppen wählen"
              className="w-48"
            />
            {/* Ausgewählte Gruppen mit X + Inkludiert-Checkbox */}
            {gruppen.length > 0 && (
              <div className="space-y-2">
                {gruppen.map(gruppe => {
                  const kat = marketingUntergruppen.find(ug => ug.id === gruppe.kpi_kategorie_id)
                  if (!kat) return null
                  return (
                    <div key={gruppe.kpi_kategorie_id} className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => handleMarketingGruppenChange(
                          selectedGruppenIds.filter(id => id !== gruppe.kpi_kategorie_id)
                        )}
                        className="text-muted-foreground hover:text-destructive shrink-0"
                        aria-label={`${kat.name} entfernen`}
                      >
                        <X className="size-3.5" />
                      </button>
                      <span className="text-sm truncate">{kat.name}</span>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        )}
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
