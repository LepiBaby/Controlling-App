'use client'

import { useState, useMemo, useEffect, useRef } from 'react'
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
  useMarketingEinstellungen,
  type MarketingEinstellung,
  type Berechnungsart,
  BERECHNUNGSARTEN,
  BERECHNUNGSART_LABELS,
  isGewichtet,
} from '@/hooks/use-marketing-einstellungen'
import {
  useMarketingKategorieEinstellungen,
  GRUPPIERUNGEN,
  GRUPPIERUNG_LABELS,
  GRUPPIERUNG_WOCHEN,
  type Gruppierung,
} from '@/hooks/use-marketing-kategorie-einstellungen'
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

// --- Einstellungsformular je Untergruppe ---

function KategorieEinstellungenForm({ kategorieId }: { kategorieId: string }) {
  const { einstellung, loading, error, upsert } = useMarketingKategorieEinstellungen(kategorieId)
  const { categories: allePlattformen, loading: plattformenLoading } = useKpiCategories('sales_plattformen')
  const { toast } = useToast()
  const [zahlungszielStr, setZahlungszielStr] = useState('')
  const [calendarOpen, setCalendarOpen] = useState(false)
  const initializedRef = useRef(false)

  useEffect(() => {
    if (!loading && !initializedRef.current) {
      initializedRef.current = true
      setZahlungszielStr(
        einstellung.zahlungsziel_tage != null ? String(einstellung.zahlungsziel_tage) : ''
      )
    }
  }, [loading, einstellung.zahlungsziel_tage])

  const displayedKw = useMemo(() => {
    if (!einstellung.naechste_zahlung_basis_kw || !einstellung.naechste_zahlung_basis_jahr) {
      return null
    }
    const now = getCurrentISOWeekAndYear()
    return calculateNextPayoutWeek(
      einstellung.naechste_zahlung_basis_kw,
      einstellung.naechste_zahlung_basis_jahr,
      GRUPPIERUNG_WOCHEN[einstellung.gruppierung],
      now.kw,
      now.jahr
    )
  }, [einstellung])

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
    if (parsed === (einstellung.zahlungsziel_tage ?? null)) return
    try {
      await upsert({ zahlungsziel_tage: parsed })
    } catch {
      setZahlungszielStr(
        einstellung.zahlungsziel_tage != null ? String(einstellung.zahlungsziel_tage) : ''
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

  async function handlePlattformChange(value: string) {
    try {
      await upsert({ sales_plattform_id: value === 'keine' ? null : value })
    } catch {
      toast({ title: 'Fehler', description: 'Einstellung konnte nicht gespeichert werden.', variant: 'destructive' })
    }
  }

  if (loading || plattformenLoading) {
    return <div className="text-sm text-muted-foreground py-2">Laden…</div>
  }

  if (error) {
    return (
      <div className="rounded-lg border border-destructive bg-destructive/10 p-3 text-sm text-destructive">
        {error}
      </div>
    )
  }

  const sortedPlattformen = allePlattformen.slice().sort((a, b) => a.sort_order - b.sort_order)

  return (
    <div className="rounded-lg border bg-muted/20 p-4">
      <div className="flex flex-wrap items-end gap-4">
        <div className="space-y-1.5">
          <Label htmlFor={`plattform-${kategorieId}`}>Sales Plattform</Label>
          <Select
            value={einstellung.sales_plattform_id ?? 'keine'}
            onValueChange={handlePlattformChange}
          >
            <SelectTrigger id={`plattform-${kategorieId}`} className="w-44">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="keine">Keine</SelectItem>
              {sortedPlattformen.map(p => (
                <SelectItem key={p.id} value={p.id}>
                  {p.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor={`gruppierung-${kategorieId}`}>Gruppierung</Label>
          <Select value={einstellung.gruppierung} onValueChange={handleGruppierungChange}>
            <SelectTrigger id={`gruppierung-${kategorieId}`} className="w-44">
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
          <Label htmlFor={`zahlungsziel-${kategorieId}`}>Zahlungsziel (Tage)</Label>
          <Input
            id={`zahlungsziel-${kategorieId}`}
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

// --- Einzelne Produktzeile ---

function MarketingEinstellungZeile({
  produkt,
  kategorieId,
  einstellung,
  showGewichtungsSpalten,
  onSave,
  onBerechnungsartChange,
}: {
  produkt: KpiCategory
  kategorieId: string
  einstellung: MarketingEinstellung
  showGewichtungsSpalten: boolean
  onSave: (patch: Omit<MarketingEinstellung, 'id'>) => Promise<void>
  onBerechnungsartChange: (art: Berechnungsart) => void
}) {
  const { toast } = useToast()

  const [berechnungsart, setBerechnungsart] = useState<Berechnungsart>(einstellung.berechnungsart)
  const [w1, setW1] = useState(einstellung.gewichtung_erstes_drittel?.toString() ?? '')
  const [w2, setW2] = useState(einstellung.gewichtung_zweites_drittel?.toString() ?? '')
  const [w3, setW3] = useState(einstellung.gewichtung_drittes_drittel?.toString() ?? '')
  const [saving, setSaving] = useState(false)

  const gewichtetAktiv = isGewichtet(berechnungsart)

  const w1Num = parseInt(w1) || 0
  const w2Num = parseInt(w2) || 0
  const w3Num = parseInt(w3) || 0
  const summe = w1Num + w2Num + w3Num
  const gewichtungGueltig    = !gewichtetAktiv || summe === 100
  const gewichtungEingegeben = w1 !== '' || w2 !== '' || w3 !== ''

  async function handleBerechnungsartChange(art: Berechnungsart) {
    const prevArt       = berechnungsart
    const willBeGewichtet = isGewichtet(art)

    setBerechnungsart(art)
    onBerechnungsartChange(art)
    if (!willBeGewichtet) {
      setW1('')
      setW2('')
      setW3('')
    }

    setSaving(true)
    try {
      await onSave({
        kategorie_id: kategorieId,
        produkt_id: produkt.id,
        berechnungsart: art,
        gewichtung_erstes_drittel: null,
        gewichtung_zweites_drittel: null,
        gewichtung_drittes_drittel: null,
      })
    } catch {
      setBerechnungsart(prevArt)
      onBerechnungsartChange(prevArt)
      toast({
        title: 'Fehler',
        description: 'Einstellung konnte nicht gespeichert werden.',
        variant: 'destructive',
      })
    } finally {
      setSaving(false)
    }
  }

  async function handleWeightBlur() {
    if (!gewichtetAktiv || !gewichtungGueltig || !gewichtungEingegeben) return
    setSaving(true)
    try {
      await onSave({
        kategorie_id: kategorieId,
        produkt_id: produkt.id,
        berechnungsart,
        gewichtung_erstes_drittel: w1 !== '' ? parseInt(w1) : null,
        gewichtung_zweites_drittel: w2 !== '' ? parseInt(w2) : null,
        gewichtung_drittes_drittel: w3 !== '' ? parseInt(w3) : null,
      })
    } catch {
      toast({
        title: 'Fehler',
        description: 'Gewichtung konnte nicht gespeichert werden.',
        variant: 'destructive',
      })
    } finally {
      setSaving(false)
    }
  }

  return (
    <>
      <TableRow className={saving ? 'opacity-60' : ''}>
        <TableCell className="font-medium">{produkt.name}</TableCell>
        <TableCell>
          <Select
            value={berechnungsart}
            onValueChange={v => handleBerechnungsartChange(v as Berechnungsart)}
            disabled={saving}
          >
            <SelectTrigger className="w-64">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {BERECHNUNGSARTEN.map(art => (
                <SelectItem key={art} value={art}>
                  {BERECHNUNGSART_LABELS[art]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </TableCell>
        {showGewichtungsSpalten && (
          <TableCell>
            {gewichtetAktiv && (
              <Input
                type="number"
                min={0}
                max={100}
                step={1}
                value={w1}
                onChange={e => setW1(e.target.value)}
                onBlur={handleWeightBlur}
                className="w-20"
                disabled={saving}
                aria-label="Gewichtung 1. Drittel"
              />
            )}
          </TableCell>
        )}
        {showGewichtungsSpalten && (
          <TableCell>
            {gewichtetAktiv && (
              <Input
                type="number"
                min={0}
                max={100}
                step={1}
                value={w2}
                onChange={e => setW2(e.target.value)}
                onBlur={handleWeightBlur}
                className="w-20"
                disabled={saving}
                aria-label="Gewichtung 2. Drittel"
              />
            )}
          </TableCell>
        )}
        {showGewichtungsSpalten && (
          <TableCell>
            {gewichtetAktiv && (
              <Input
                type="number"
                min={0}
                max={100}
                step={1}
                value={w3}
                onChange={e => setW3(e.target.value)}
                onBlur={handleWeightBlur}
                className="w-20"
                disabled={saving}
                aria-label="Gewichtung 3. Drittel"
              />
            )}
          </TableCell>
        )}
      </TableRow>
      {gewichtetAktiv && gewichtungEingegeben && !gewichtungGueltig && (
        <TableRow className="hover:bg-transparent">
          <TableCell />
          <TableCell />
          {showGewichtungsSpalten && (
            <TableCell colSpan={3} className="pb-2 pt-0">
              <p className="text-xs text-destructive">
                Die Summe muss 100 % ergeben (aktuell: {summe} %)
              </p>
            </TableCell>
          )}
        </TableRow>
      )}
    </>
  )
}

// --- Produkt-Tabelle je Untergruppe ---

function ProduktTabelle({
  kategorieId,
  produkte,
}: {
  kategorieId: string
  produkte: KpiCategory[]
}) {
  const { loading, error, getEinstellung, upsert } = useMarketingEinstellungen(kategorieId)
  const [localArten, setLocalArten] = useState<Record<string, Berechnungsart>>({})
  const initializedRef = useRef(false)

  useEffect(() => {
    if (!loading && !initializedRef.current) {
      initializedRef.current = true
      const map: Record<string, Berechnungsart> = {}
      produkte.forEach(p => { map[p.id] = getEinstellung(p.id).berechnungsart })
      setLocalArten(map)
    }
  }, [loading, produkte, getEinstellung])

  const showGewichtungsSpalten = Object.values(localArten).some(isGewichtet)

  function handleRowBerechnungsartChange(produktId: string, art: Berechnungsart) {
    setLocalArten(prev => ({ ...prev, [produktId]: art }))
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

  if (produkte.length === 0) {
    return (
      <div className="rounded-lg border bg-muted/30 p-8 text-center space-y-3">
        <p className="font-medium">Keine Produkte definiert</p>
        <p className="text-sm text-muted-foreground">
          Bitte zuerst Produkte im KPI-Modell anlegen, bevor Marketing-Einstellungen gepflegt werden können.
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
    <div className="rounded-lg border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-48">Produkt</TableHead>
            <TableHead className="w-72">Berechnungsart</TableHead>
            {showGewichtungsSpalten && <TableHead className="w-24">1. Drittel %</TableHead>}
            {showGewichtungsSpalten && <TableHead className="w-24">2. Drittel %</TableHead>}
            {showGewichtungsSpalten && <TableHead className="w-24">3. Drittel %</TableHead>}
          </TableRow>
        </TableHeader>
        <TableBody>
          {produkte.map(produkt => (
            <MarketingEinstellungZeile
              key={produkt.id}
              produkt={produkt}
              kategorieId={kategorieId}
              einstellung={getEinstellung(produkt.id)}
              showGewichtungsSpalten={showGewichtungsSpalten}
              onSave={upsert}
              onBerechnungsartChange={art => handleRowBerechnungsartChange(produkt.id, art)}
            />
          ))}
        </TableBody>
      </Table>
    </div>
  )
}

// --- Hauptkomponente ---

export function MarketingEinstellungenTabelle() {
  const { categories: alleAusgabenKats, loading: katsLoading } =
    useKpiCategories('ausgaben_kosten')
  const { categories: alleProdukte, loading: produkteLoading } =
    useKpiCategories('produkte')

  const marketingUntergruppen = useMemo(() => {
    const parent = alleAusgabenKats.find(
      k => k.level === 1 && k.name.toLowerCase() === 'marketing'
    )
    if (!parent) return []
    return alleAusgabenKats
      .filter(k => k.level === 2 && k.parent_id === parent.id)
      .sort((a, b) => a.sort_order - b.sort_order)
  }, [alleAusgabenKats])

  const sortedProdukte = useMemo(
    () =>
      alleProdukte
        .filter(p => p.level === 1)
        .sort((a, b) => a.sort_order - b.sort_order),
    [alleProdukte]
  )

  const loading = katsLoading || produkteLoading

  if (loading) {
    return <div className="py-8 text-center text-sm text-muted-foreground">Laden…</div>
  }

  if (marketingUntergruppen.length === 0) {
    return (
      <div className="rounded-lg border bg-muted/30 p-8 text-center space-y-3">
        <p className="font-medium">Keine Marketing-Untergruppen gefunden</p>
        <p className="text-sm text-muted-foreground">
          Bitte im KPI-Modell unter der Kategorie „Marketing" (Ausgaben &amp; Kosten) mindestens eine Untergruppe anlegen.
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
    <Tabs defaultValue={marketingUntergruppen[0]?.id} className="space-y-4">
      <TabsList className="w-full h-auto">
        {marketingUntergruppen.map(ug => (
          <TabsTrigger key={ug.id} value={ug.id} className="flex-1">
            {ug.name}
          </TabsTrigger>
        ))}
      </TabsList>
      {marketingUntergruppen.map(ug => (
        <TabsContent key={ug.id} value={ug.id} className="mt-0 space-y-4">
          <KategorieEinstellungenForm kategorieId={ug.id} />
          <ProduktTabelle kategorieId={ug.id} produkte={sortedProdukte} />
        </TabsContent>
      ))}
    </Tabs>
  )
}
