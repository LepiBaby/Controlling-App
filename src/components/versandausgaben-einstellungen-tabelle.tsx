'use client'

import { useState, useEffect, useRef, useMemo } from 'react'
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
import { useKpiCategories, type KpiCategory } from '@/hooks/use-kpi-categories'
import {
  useVersandausgabenEinstellungen,
  type VersandausgabenEinstellung,
} from '@/hooks/use-versandausgaben-einstellungen'
import {
  useVersandausgabenAllgemeinEinstellungen,
  GRUPPIERUNGEN,
  GRUPPIERUNG_LABELS,
  type Gruppierung,
} from '@/hooks/use-versandausgaben-allgemein-einstellungen'
import { useToast } from '@/hooks/use-toast'

// --- Einzelne Produktzeile ---

function VersandausgabenEinstellungZeile({
  produkt,
  plattformId,
  einstellung,
  onSave,
}: {
  produkt: KpiCategory
  plattformId: string
  einstellung: VersandausgabenEinstellung
  onSave: (patch: Omit<VersandausgabenEinstellung, 'id'>) => Promise<void>
}) {
  const { toast } = useToast()
  const [localValue, setLocalValue] = useState<string>(
    einstellung.versandgebuehr_euro_netto !== null
      ? einstellung.versandgebuehr_euro_netto.toString()
      : ''
  )
  const [saving, setSaving] = useState(false)

  async function handleBlur() {
    const parsed = localValue === '' ? null : parseFloat(localValue)
    if (parsed !== null && (isNaN(parsed) || parsed < 0)) return

    const current = einstellung.versandgebuehr_euro_netto
    const next = parsed

    if (current === next) return
    if (current === null && next === null) return

    const prevValue = localValue
    setSaving(true)
    try {
      await onSave({
        sales_plattform_id: plattformId,
        produkt_id: produkt.id,
        versandgebuehr_euro_netto: next,
      })
    } catch {
      setLocalValue(prevValue)
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
          value={localValue}
          onChange={e => setLocalValue(e.target.value)}
          onBlur={handleBlur}
          className="w-36"
          disabled={saving}
          placeholder="—"
          aria-label={`Versandgebühr für ${produkt.name}`}
        />
      </TableCell>
    </TableRow>
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
  const { loading, error, getEinstellung, upsert } =
    useVersandausgabenEinstellungen(plattformId)

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
          Bitte zuerst Produkte im KPI-Modell anlegen, bevor Versandgebühren gepflegt werden können.
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
            <TableHead className="w-44">Versandgebühr (€ netto)</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {produkte.map(produkt => (
            <VersandausgabenEinstellungZeile
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

// --- Allgemein-Formular ---

function AllgemeinForm() {
  const { einstellungen, loading, error, upsert } = useVersandausgabenAllgemeinEinstellungen()
  const { toast } = useToast()
  const [zahlungszielStr, setZahlungszielStr] = useState('')
  const initializedRef = useRef(false)

  useEffect(() => {
    if (!loading && !initializedRef.current) {
      initializedRef.current = true
      setZahlungszielStr(
        einstellungen.zahlungsziel_tage !== null
          ? String(einstellungen.zahlungsziel_tage)
          : ''
      )
    }
  }, [loading, einstellungen.zahlungsziel_tage])

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

    if (parsed === einstellungen.zahlungsziel_tage) return

    try {
      await upsert({ zahlungsziel_tage: parsed })
    } catch {
      setZahlungszielStr(
        einstellungen.zahlungsziel_tage !== null
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
    <div className="rounded-lg border p-6">
      <div className="grid gap-6 sm:grid-cols-2 max-w-lg">
        <div className="space-y-2">
          <Label htmlFor="gruppierung">Gruppierung</Label>
          <Select
            value={einstellungen.gruppierung}
            onValueChange={handleGruppierungChange}
          >
            <SelectTrigger id="gruppierung">
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
        <div className="space-y-2">
          <Label htmlFor="zahlungsziel">Zahlungsziel (Tage)</Label>
          <Input
            id="zahlungsziel"
            type="number"
            min={0}
            step={1}
            value={zahlungszielStr}
            onChange={e => setZahlungszielStr(e.target.value)}
            onBlur={handleZahlungszielBlur}
            placeholder="—"
            className="w-32"
          />
        </div>
      </div>
    </div>
  )
}

// --- Hauptkomponente ---

export function VersandausgabenEinstellungenTabelle() {
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

  const defaultTab = sortedPlattformen.length > 0 ? sortedPlattformen[0].id : 'allgemein'

  return (
    <Tabs defaultValue={defaultTab} className="space-y-4">
      <TabsList className="w-full h-auto">
        {sortedPlattformen.map(p => (
          <TabsTrigger key={p.id} value={p.id} className="flex-1">
            {p.name}
          </TabsTrigger>
        ))}
        <TabsTrigger value="allgemein" className="flex-1">
          Allgemein
        </TabsTrigger>
      </TabsList>

      {sortedPlattformen.map(p => (
        <TabsContent key={p.id} value={p.id} className="mt-0">
          <PlattformTabelle plattformId={p.id} produkte={sortedProdukte} />
        </TabsContent>
      ))}

      <TabsContent value="allgemein" className="mt-0">
        <AllgemeinForm />
      </TabsContent>
    </Tabs>
  )
}
