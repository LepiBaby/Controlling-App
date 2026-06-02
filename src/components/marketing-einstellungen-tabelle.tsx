'use client'

import { useState, useMemo, useEffect, useRef } from 'react'
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
import { useKpiCategories, type KpiCategory } from '@/hooks/use-kpi-categories'
import {
  useMarketingEinstellungen,
  type MarketingEinstellung,
  type Berechnungsart,
  BERECHNUNGSARTEN,
  BERECHNUNGSART_LABELS,
  isGewichtet,
} from '@/hooks/use-marketing-einstellungen'
import { useToast } from '@/hooks/use-toast'

// --- Einzelne Produktzeile ---

function MarketingEinstellungZeile({
  produkt,
  plattformId,
  einstellung,
  showGewichtungsSpalten,
  onSave,
  onBerechnungsartChange,
}: {
  produkt: KpiCategory
  plattformId: string
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
  const gewichtungGueltig = !gewichtetAktiv || summe === 100
  const gewichtungEingegeben = w1 !== '' || w2 !== '' || w3 !== ''

  async function handleBerechnungsartChange(art: Berechnungsart) {
    const prevArt = berechnungsart
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
        sales_plattform_id: plattformId,
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
        sales_plattform_id: plattformId,
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

// --- Tabelle für eine Plattform ---

function PlattformTabelle({
  plattformId,
  produkte,
}: {
  plattformId: string
  produkte: KpiCategory[]
}) {
  const { loading, error, getEinstellung, upsert } = useMarketingEinstellungen(plattformId)
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
    return (
      <div className="py-8 text-center text-sm text-muted-foreground">Laden…</div>
    )
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
              plattformId={plattformId}
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
          Bitte zuerst Sales-Plattformen im KPI-Modell anlegen, bevor Marketing-Einstellungen gepflegt werden können.
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
          <PlattformTabelle plattformId={p.id} produkte={sortedProdukte} />
        </TabsContent>
      ))}
    </Tabs>
  )
}
