'use client'

import { useState, useEffect, useRef, useMemo } from 'react'
import { CalendarIcon } from 'lucide-react'
import { de } from 'date-fns/locale'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Calendar } from '@/components/ui/calendar'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { useKpiCategories, type KpiCategory } from '@/hooks/use-kpi-categories'
import {
  useLagerausgabenEinstellungen,
  type LagerausgabenEinstellung,
} from '@/hooks/use-lagerausgaben-einstellungen'
import {
  useLagerausgabenPlattformEinstellungen,
  GRUPPIERUNGEN,
  GRUPPIERUNG_LABELS,
  GRUPPIERUNG_WOCHEN,
  type Gruppierung,
} from '@/hooks/use-lagerausgaben-plattform-einstellungen'
import {
  getCurrentISOWeekAndYear,
  calculateNextPayoutWeek,
} from '@/hooks/use-auszahlungs-einstellungen'
import { useToast } from '@/hooks/use-toast'

function getMondayOfISOWeek(kw: number, jahr: number): Date {
  const jan4 = new Date(jahr, 0, 4)
  const dayOfWeek = jan4.getDay() || 7
  const kw1Monday = new Date(jan4)
  kw1Monday.setDate(jan4.getDate() - (dayOfWeek - 1))
  const result = new Date(kw1Monday)
  result.setDate(kw1Monday.getDate() + (kw - 1) * 7)
  return result
}

function getISOWeekAndYear(date: Date): { kw: number; jahr: number } {
  const d = new Date(date)
  d.setHours(12, 0, 0, 0)
  d.setDate(d.getDate() + 4 - (d.getDay() || 7))
  const yearStart = new Date(d.getFullYear(), 0, 1)
  const kw = Math.ceil(((d.getTime() - yearStart.getTime()) / 86_400_000 + 1) / 7)
  return { kw, jahr: d.getFullYear() }
}

// --- Plattform-Einstellungsformular ---

function PlattformEinstellungenForm({ plattformId }: { plattformId: string }) {
  const { einstellungen, loading, error, upsert } =
    useLagerausgabenPlattformEinstellungen(plattformId)
  const { toast } = useToast()
  const [zahlungszielStr, setZahlungszielStr] = useState('')
  const [calendarOpen, setCalendarOpen] = useState(false)
  const initializedRef = useRef(false)

  useEffect(() => {
    if (!loading && !initializedRef.current) {
      initializedRef.current = true
      setZahlungszielStr(
        einstellungen.zahlungsziel_tage != null
          ? String(einstellungen.zahlungsziel_tage)
          : ''
      )
    }
  }, [loading, einstellungen.zahlungsziel_tage])

  const displayedKw = useMemo(() => {
    if (!einstellungen.naechste_zahlung_basis_kw || !einstellungen.naechste_zahlung_basis_jahr) {
      return null
    }
    const now = getCurrentISOWeekAndYear()
    return calculateNextPayoutWeek(
      einstellungen.naechste_zahlung_basis_kw,
      einstellungen.naechste_zahlung_basis_jahr,
      GRUPPIERUNG_WOCHEN[einstellungen.gruppierung],
      now.kw,
      now.jahr
    )
  }, [einstellungen])

  const selectedDate = useMemo(() => {
    if (!displayedKw) return undefined
    return getMondayOfISOWeek(displayedKw.kw, displayedKw.jahr)
  }, [displayedKw])

  async function handleGruppierungChange(value: string) {
    try {
      await upsert({ gruppierung: value as Gruppierung })
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
        einstellungen.zahlungsziel_tage != null
          ? String(einstellungen.zahlungsziel_tage)
          : ''
      )
      toast({
        title: 'Fehler',
        description: 'Einstellung konnte nicht gespeichert werden.',
        variant: 'destructive',
      })
    }
  }

  function handleDateSelect(date: Date | undefined) {
    setCalendarOpen(false)
    if (!date) {
      upsert({ naechste_zahlung_basis_kw: null, naechste_zahlung_basis_jahr: null }).catch(() =>
        toast({
          title: 'Fehler',
          description: 'Einstellung konnte nicht gespeichert werden.',
          variant: 'destructive',
        })
      )
      return
    }
    const { kw, jahr } = getISOWeekAndYear(date)
    upsert({ naechste_zahlung_basis_kw: kw, naechste_zahlung_basis_jahr: jahr }).catch(() =>
      toast({
        title: 'Fehler',
        description: 'Einstellung konnte nicht gespeichert werden.',
        variant: 'destructive',
      })
    )
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
          <Label htmlFor={`gruppierung-${plattformId}`}>Gruppierung</Label>
          <Select
            value={einstellungen.gruppierung}
            onValueChange={handleGruppierungChange}
          >
            <SelectTrigger id={`gruppierung-${plattformId}`} className="w-44">
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
          <Label htmlFor={`zahlungsziel-${plattformId}`}>Zahlungsziel (Tage)</Label>
          <Input
            id={`zahlungsziel-${plattformId}`}
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
        <div className="space-y-1.5">
          <div>
            <Label className="text-sm font-medium">Nächste Zahlungswoche</Label>
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
                className="w-44 justify-start gap-2 font-normal"
              >
                <CalendarIcon className="size-4 text-muted-foreground" />
                {selectedDate
                  ? selectedDate.toLocaleDateString('de-DE', {
                      day: '2-digit',
                      month: '2-digit',
                      year: 'numeric',
                    })
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
      </div>
    </div>
  )
}

// --- „Alle gleichsetzen"-Bereich ---

function AlleGleichsetzenBereich({
  plattformId,
  produkte,
  onBatch,
}: {
  plattformId: string
  produkte: KpiCategory[]
  onBatch: (plattformId: string, wert: number | null, produktIds: string[]) => Promise<void>
}) {
  const { toast } = useToast()
  const [wertStr, setWertStr] = useState('')
  const [saving, setSaving] = useState(false)

  async function handleUebernehmen() {
    const parsed = parseFloat(wertStr)
    if (isNaN(parsed) || parsed < 0) return
    setSaving(true)
    try {
      await onBatch(
        plattformId,
        parsed,
        produkte.map(p => p.id)
      )
      setWertStr('')
    } catch {
      toast({
        title: 'Fehler',
        description: 'Lagerkosten konnten nicht für alle Produkte gespeichert werden.',
        variant: 'destructive',
      })
    } finally {
      setSaving(false)
    }
  }

  const disabled = saving || wertStr.trim() === '' || produkte.length === 0

  return (
    <div className="flex items-end gap-3">
      <div className="space-y-1.5">
        <Label htmlFor={`alle-gleichsetzen-${plattformId}`} className="text-sm font-medium">
          Alle Produkte gleichsetzen
        </Label>
        <Input
          id={`alle-gleichsetzen-${plattformId}`}
          type="number"
          min={0}
          step={0.01}
          value={wertStr}
          onChange={e => setWertStr(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter' && !disabled) handleUebernehmen() }}
          placeholder="€/m³ für alle Produkte"
          className="w-56"
          disabled={saving}
        />
      </div>
      <Button
        variant="secondary"
        onClick={handleUebernehmen}
        disabled={disabled}
      >
        Übernehmen
      </Button>
    </div>
  )
}

// --- Einzelne Produktzeile ---

function LagerausgabenEinstellungZeile({
  produkt,
  plattformId,
  einstellung,
  onSave,
}: {
  produkt: KpiCategory
  plattformId: string
  einstellung: LagerausgabenEinstellung
  onSave: (patch: Omit<LagerausgabenEinstellung, 'id'>) => Promise<void>
}) {
  const { toast } = useToast()
  const [wertStr, setWertStr] = useState<string>(
    einstellung.lagerkosten_euro_m3 !== null
      ? einstellung.lagerkosten_euro_m3.toString()
      : ''
  )
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    setWertStr(
      einstellung.lagerkosten_euro_m3 !== null
        ? einstellung.lagerkosten_euro_m3.toString()
        : ''
    )
  }, [einstellung.lagerkosten_euro_m3])

  async function handleBlur() {
    const parsed = wertStr === '' ? null : parseFloat(wertStr)
    if (parsed !== null && (isNaN(parsed) || parsed < 0)) return
    if (parsed === einstellung.lagerkosten_euro_m3) return
    setSaving(true)
    try {
      await onSave({
        sales_plattform_id: plattformId,
        produkt_id: produkt.id,
        lagerkosten_euro_m3: parsed,
      })
    } catch {
      setWertStr(
        einstellung.lagerkosten_euro_m3 !== null
          ? einstellung.lagerkosten_euro_m3.toString()
          : ''
      )
      toast({
        title: 'Fehler',
        description: 'Einstellung konnte nicht gespeichert werden.',
        variant: 'destructive',
      })
    } finally {
      setSaving(false)
    }
  }

  return (
    <TableRow className={saving ? 'opacity-60' : ''}>
      <TableCell className="font-medium">{produkt.name}</TableCell>
      <TableCell>
        <Input
          type="number"
          min={0}
          step={0.01}
          value={wertStr}
          onChange={e => setWertStr(e.target.value)}
          onBlur={handleBlur}
          className="w-36"
          disabled={saving}
          placeholder="—"
          aria-label={`Lagerkosten €/m³ für ${produkt.name}`}
        />
      </TableCell>
    </TableRow>
  )
}

// --- Tabelle + Schnellpflege für eine Plattform ---

function PlattformTabelle({
  plattformId,
  produkte,
}: {
  plattformId: string
  produkte: KpiCategory[]
}) {
  const { loading, error, getEinstellung, upsert, batchUpsert } =
    useLagerausgabenEinstellungen(plattformId)

  if (loading) {
    return <div className="py-6 text-center text-sm text-muted-foreground">Laden…</div>
  }

  if (error) {
    return (
      <div className="rounded-lg border border-destructive bg-destructive/10 p-4 text-sm text-destructive">
        {error}
      </div>
    )
  }

  if (produkte.length === 0) {
    return (
      <div className="rounded-lg border bg-muted/30 p-8 text-center space-y-3">
        <p className="font-medium">Keine Produkte definiert</p>
        <p className="text-sm text-muted-foreground">
          Bitte zuerst Produkte im KPI-Modell anlegen, bevor Lagerkosten gepflegt werden können.
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
    <div className="space-y-3">
      <AlleGleichsetzenBereich
        plattformId={plattformId}
        produkte={produkte}
        onBatch={batchUpsert}
      />
      <div className="rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-64">Produkt</TableHead>
              <TableHead className="w-44">Lagerkosten (€/m³ netto)</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {produkte.map(produkt => (
              <LagerausgabenEinstellungZeile
                key={produkt.id}
                produkt={produkt}
                plattformId={plattformId}
                einstellung={getEinstellung(produkt.id)}
                onSave={upsert}
              />
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  )
}

// --- Hauptkomponente ---

export function LagerausgabenEinstellungenTabelle() {
  const { categories: plattformen, loading: plattformenLoading } =
    useKpiCategories('sales_plattformen')
  const { categories: alleProdukte, loading: produkteLoading } =
    useKpiCategories('produkte')

  const sortedPlattformen = useMemo(
    () =>
      plattformen
        .filter(p => p.level === 1)
        .sort((a, b) => a.sort_order - b.sort_order),
    [plattformen]
  )

  const sortedProdukte = useMemo(
    () =>
      alleProdukte
        .filter(p => p.level === 1)
        .sort((a, b) => a.sort_order - b.sort_order),
    [alleProdukte]
  )

  const loading = plattformenLoading || produkteLoading

  if (loading) {
    return <div className="py-8 text-center text-sm text-muted-foreground">Laden…</div>
  }

  if (sortedPlattformen.length === 0) {
    return (
      <div className="rounded-lg border bg-muted/30 p-8 text-center space-y-3">
        <p className="font-medium">Keine Sales-Plattformen definiert</p>
        <p className="text-sm text-muted-foreground">
          Bitte zuerst Sales-Plattformen im KPI-Modell anlegen, bevor Lagerkosten gepflegt
          werden können.
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
    <Tabs defaultValue={sortedPlattformen[0].id} className="space-y-4">
      <TabsList className="w-full h-auto">
        {sortedPlattformen.map(p => (
          <TabsTrigger key={p.id} value={p.id} className="flex-1">
            {p.name}
          </TabsTrigger>
        ))}
      </TabsList>

      {sortedPlattformen.map(p => (
        <TabsContent key={p.id} value={p.id} className="mt-0 space-y-4">
          <PlattformEinstellungenForm plattformId={p.id} />
          <PlattformTabelle plattformId={p.id} produkte={sortedProdukte} />
        </TabsContent>
      ))}
    </Tabs>
  )
}
