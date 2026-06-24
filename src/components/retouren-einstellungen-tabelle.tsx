'use client'

import { useState, useEffect, useRef, useMemo } from 'react'
import { CalendarIcon, Info } from 'lucide-react'
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
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import { useKpiCategories, type KpiCategory } from '@/hooks/use-kpi-categories'
import {
  useRetourenEinstellungen,
  type RetourenEinstellung,
  BERECHNUNGSARTEN,
  BERECHNUNGSART_LABELS,
  type Berechnungsart,
} from '@/hooks/use-retouren-einstellungen'
import {
  useRetourenAllgemeinEinstellungen,
} from '@/hooks/use-retouren-allgemein-einstellungen'
import {
  useRetourenAllgemeinProduktEinstellungen,
} from '@/hooks/use-retouren-allgemein-produkt-einstellungen'
import {
  GRUPPIERUNGEN,
  GRUPPIERUNG_LABELS,
  GRUPPIERUNG_WOCHEN,
  type Gruppierung,
} from '@/hooks/use-retouren-plattform-einstellungen'
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

// --- Allgemein-Einstellungsformular (Gruppierung, Zahlungswoche, Zahlungsziel) ---

function AllgemeinEinstellungenForm() {
  const { einstellungen, loading, error, upsert } = useRetourenAllgemeinEinstellungen()
  const { toast } = useToast()
  const [zahlungszielStr, setZahlungszielStr] = useState('')
  const [calendarOpen, setCalendarOpen] = useState(false)
  const initializedRef = useRef(false)

  useEffect(() => {
    if (!loading && !initializedRef.current) {
      initializedRef.current = true
      setZahlungszielStr(
        einstellungen.zahlungsziel_tage != null ? String(einstellungen.zahlungsziel_tage) : ''
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
      toast({ title: 'Fehler', description: 'Einstellung konnte nicht gespeichert werden.', variant: 'destructive' })
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
        einstellungen.zahlungsziel_tage != null ? String(einstellungen.zahlungsziel_tage) : ''
      )
      toast({ title: 'Fehler', description: 'Einstellung konnte nicht gespeichert werden.', variant: 'destructive' })
    }
  }

  function handleDateSelect(date: Date | undefined) {
    setCalendarOpen(false)
    if (!date) {
      upsert({ naechste_zahlung_basis_kw: null, naechste_zahlung_basis_jahr: null }).catch(() =>
        toast({ title: 'Fehler', description: 'Einstellung konnte nicht gespeichert werden.', variant: 'destructive' })
      )
      return
    }
    const { kw, jahr } = getISOWeekAndYear(date)
    upsert({ naechste_zahlung_basis_kw: kw, naechste_zahlung_basis_jahr: jahr }).catch(() =>
      toast({ title: 'Fehler', description: 'Einstellung konnte nicht gespeichert werden.', variant: 'destructive' })
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
          <Label htmlFor="gruppierung-allgemein">Gruppierung</Label>
          <Select value={einstellungen.gruppierung} onValueChange={handleGruppierungChange}>
            <SelectTrigger id="gruppierung-allgemein" className="w-44">
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
              <Button variant="outline" className="w-44 justify-start gap-2 font-normal">
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

        <div className="space-y-1.5">
          <Label htmlFor="zahlungsziel-allgemein">Zahlungsziel (Tage)</Label>
          <Input
            id="zahlungsziel-allgemein"
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

// --- Allgemein-Produktzeile (Berechnungsart + Retourenhandlingkosten) ---

function AllgemeinProduktZeile({
  produkt,
  einstellung,
  onSave,
}: {
  produkt: KpiCategory
  einstellung: { produkt_id: string; berechnungsart: Berechnungsart; retourenhandling_kosten_euro_netto: number | null }
  onSave: (patch: { produkt_id: string; berechnungsart: Berechnungsart; retourenhandling_kosten_euro_netto: number | null }) => Promise<void>
}) {
  const { toast } = useToast()
  const [berechnungsart, setBerechnungsart] = useState<Berechnungsart>(einstellung.berechnungsart)
  const [handlingStr, setHandlingStr] = useState<string>(
    einstellung.retourenhandling_kosten_euro_netto !== null
      ? einstellung.retourenhandling_kosten_euro_netto.toString()
      : ''
  )
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    setBerechnungsart(einstellung.berechnungsart)
  }, [einstellung.berechnungsart])

  useEffect(() => {
    setHandlingStr(
      einstellung.retourenhandling_kosten_euro_netto !== null
        ? einstellung.retourenhandling_kosten_euro_netto.toString()
        : ''
    )
  }, [einstellung.retourenhandling_kosten_euro_netto])

  async function handleSave(overrides?: Partial<typeof einstellung>) {
    const handling = handlingStr === '' ? null : parseFloat(handlingStr)
    if (handling !== null && (isNaN(handling) || handling < 0)) return

    setSaving(true)
    try {
      await onSave({
        produkt_id: produkt.id,
        berechnungsart,
        retourenhandling_kosten_euro_netto: handling,
        ...overrides,
      })
    } catch {
      setBerechnungsart(einstellung.berechnungsart)
      setHandlingStr(
        einstellung.retourenhandling_kosten_euro_netto !== null
          ? einstellung.retourenhandling_kosten_euro_netto.toString()
          : ''
      )
      toast({ title: 'Fehler', description: 'Einstellung konnte nicht gespeichert werden.', variant: 'destructive' })
    } finally {
      setSaving(false)
    }
  }

  async function handleBerechnungsartChange(value: string) {
    const next = value as Berechnungsart
    setBerechnungsart(next)
    await handleSave({ berechnungsart: next })
  }

  return (
    <TableRow className={saving ? 'opacity-60' : ''}>
      <TableCell className="font-medium">{produkt.name}</TableCell>
      <TableCell>
        <Select value={berechnungsart} onValueChange={handleBerechnungsartChange} disabled={saving}>
          <SelectTrigger className="w-48" aria-label={`Berechnungsart für ${produkt.name}`}>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {BERECHNUNGSARTEN.map(b => (
              <SelectItem key={b} value={b}>
                {BERECHNUNGSART_LABELS[b]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </TableCell>
      <TableCell>
        <Input
          type="number"
          min={0}
          step={0.01}
          value={handlingStr}
          onChange={e => setHandlingStr(e.target.value)}
          onBlur={() => handleSave()}
          className="w-36"
          disabled={saving}
          placeholder="—"
          aria-label={`Retourenhandling-Kosten für ${produkt.name}`}
        />
      </TableCell>
    </TableRow>
  )
}

// --- Allgemein-Produkttabelle ---

function AllgemeinProduktTabelle({ produkte }: { produkte: KpiCategory[] }) {
  const { loading, error, getEinstellung, upsert } = useRetourenAllgemeinProduktEinstellungen()

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
          Bitte zuerst Produkte im KPI-Modell anlegen.
        </p>
        <a href="/dashboard/kpi-modell">
          <Button variant="outline" size="sm" className="mt-2">Zum KPI-Modell</Button>
        </a>
      </div>
    )
  }

  return (
    <div className="rounded-lg border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-52">Produkt</TableHead>
            <TableHead className="w-52">
              <div className="flex items-center gap-1.5">
                Berechnungsart Retourenquote
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Info className="size-3.5 text-muted-foreground cursor-help shrink-0" />
                    </TooltipTrigger>
                    <TooltipContent className="max-w-64 text-xs">
                      Die letzten 7 Tage werden vom Berechnungszeitraum ausgeblendet, da aktuelle Retouren häufig mit Verzögerung erfasst werden und die Quote sonst unterschätzt würde.
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              </div>
            </TableHead>
            <TableHead className="w-44">Retourenhandling-Kosten (€ netto)</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {produkte.map(produkt => (
            <AllgemeinProduktZeile
              key={produkt.id}
              produkt={produkt}
              einstellung={getEinstellung(produkt.id)}
              onSave={upsert}
            />
          ))}
        </TableBody>
      </Table>
    </div>
  )
}

// --- Plattform-Produktzeile (nur Erstattung VkGeb. + Rückversandkosten) ---

function PlattformProduktZeile({
  produkt,
  plattformId,
  einstellung,
  onSave,
}: {
  produkt: KpiCategory
  plattformId: string
  einstellung: RetourenEinstellung
  onSave: (patch: Omit<RetourenEinstellung, 'id'>) => Promise<void>
}) {
  const { toast } = useToast()
  const [rueckversandStr, setRueckversandStr] = useState<string>(
    einstellung.rueckversandkosten_euro_netto !== null
      ? einstellung.rueckversandkosten_euro_netto.toString()
      : ''
  )
  const [erstattungStr, setErstattungStr] = useState<string>(
    einstellung.erstattung_verkaufsgebuehr_prozent !== null
      ? einstellung.erstattung_verkaufsgebuehr_prozent.toString()
      : ''
  )
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    setRueckversandStr(
      einstellung.rueckversandkosten_euro_netto !== null
        ? einstellung.rueckversandkosten_euro_netto.toString()
        : ''
    )
  }, [einstellung.rueckversandkosten_euro_netto])

  useEffect(() => {
    setErstattungStr(
      einstellung.erstattung_verkaufsgebuehr_prozent !== null
        ? einstellung.erstattung_verkaufsgebuehr_prozent.toString()
        : ''
    )
  }, [einstellung.erstattung_verkaufsgebuehr_prozent])

  async function handleSave() {
    const rueckversand = rueckversandStr === '' ? null : parseFloat(rueckversandStr)
    const erstattung = erstattungStr === '' ? null : parseFloat(erstattungStr)
    if (rueckversand !== null && (isNaN(rueckversand) || rueckversand < 0)) return
    if (erstattung !== null && (isNaN(erstattung) || erstattung < 0 || erstattung > 100)) return

    setSaving(true)
    try {
      await onSave({
        sales_plattform_id: plattformId,
        produkt_id: produkt.id,
        berechnungsart: einstellung.berechnungsart,
        rueckversandkosten_euro_netto: rueckversand,
        retourenhandling_kosten_euro_netto: einstellung.retourenhandling_kosten_euro_netto,
        erstattung_verkaufsgebuehr_prozent: erstattung,
      })
    } catch {
      setRueckversandStr(
        einstellung.rueckversandkosten_euro_netto !== null
          ? einstellung.rueckversandkosten_euro_netto.toString()
          : ''
      )
      setErstattungStr(
        einstellung.erstattung_verkaufsgebuehr_prozent !== null
          ? einstellung.erstattung_verkaufsgebuehr_prozent.toString()
          : ''
      )
      toast({ title: 'Fehler', description: 'Einstellung konnte nicht gespeichert werden.', variant: 'destructive' })
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
          max={100}
          step={0.01}
          value={erstattungStr}
          onChange={e => setErstattungStr(e.target.value)}
          onBlur={handleSave}
          className="w-28"
          disabled={saving}
          placeholder="—"
          aria-label={`Erstattung Verkaufsgebühr für ${produkt.name}`}
        />
      </TableCell>
      <TableCell>
        <Input
          type="number"
          min={0}
          step={0.01}
          value={rueckversandStr}
          onChange={e => setRueckversandStr(e.target.value)}
          onBlur={handleSave}
          className="w-36"
          disabled={saving}
          placeholder="—"
          aria-label={`Rückversandkosten für ${produkt.name}`}
        />
      </TableCell>
    </TableRow>
  )
}

// --- Plattform-Tabelle (nur Erstattung VkGeb. + Rückversandkosten) ---

function PlattformTabelle({
  plattformId,
  produkte,
}: {
  plattformId: string
  produkte: KpiCategory[]
}) {
  const { loading, error, getEinstellung, upsert } = useRetourenEinstellungen(plattformId)

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
          Bitte zuerst Produkte im KPI-Modell anlegen, bevor Retoureneinstellungen gepflegt
          werden können.
        </p>
        <a href="/dashboard/kpi-modell">
          <Button variant="outline" size="sm" className="mt-2">Zum KPI-Modell</Button>
        </a>
      </div>
    )
  }

  return (
    <div className="rounded-lg border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-52">Produkt</TableHead>
            <TableHead className="w-36">Erstattung VkGeb. (%)</TableHead>
            <TableHead className="w-44">Rückversandkosten (€ netto)</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {produkte.map(produkt => (
            <PlattformProduktZeile
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
  )
}

// --- Hauptkomponente ---

export function RetourenEinstellungenTabelle() {
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

  return (
    <Tabs defaultValue="allgemein" className="space-y-4">
      <TabsList className="w-full h-auto">
        <TabsTrigger value="allgemein" className="flex-1">Allgemein</TabsTrigger>
        {sortedPlattformen.map(p => (
          <TabsTrigger key={p.id} value={p.id} className="flex-1">
            {p.name}
          </TabsTrigger>
        ))}
      </TabsList>

      {/* Allgemein-Tab */}
      <TabsContent value="allgemein" className="mt-0 space-y-4">
        <AllgemeinEinstellungenForm />
        <AllgemeinProduktTabelle produkte={sortedProdukte} />
      </TabsContent>

      {/* Plattform-Tabs */}
      {sortedPlattformen.map(p => (
        <TabsContent key={p.id} value={p.id} className="mt-0">
          <PlattformTabelle plattformId={p.id} produkte={sortedProdukte} />
        </TabsContent>
      ))}
    </Tabs>
  )
}
