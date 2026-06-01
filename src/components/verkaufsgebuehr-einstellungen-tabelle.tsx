'use client'

import { useState, useMemo } from 'react'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { useKpiCategories, type KpiCategory } from '@/hooks/use-kpi-categories'
import {
  useVerkaufsgebuehrEinstellungen,
  type VerkaufsgebuehrEinstellung,
} from '@/hooks/use-verkaufsgebuehr-einstellungen'
import { useToast } from '@/hooks/use-toast'

// --- Einzelne Produktzeile ---

function VerkaufsgebuehrEinstellungZeile({
  produkt,
  plattformId,
  einstellung,
  onSave,
}: {
  produkt: KpiCategory
  plattformId: string
  einstellung: VerkaufsgebuehrEinstellung
  onSave: (patch: Omit<VerkaufsgebuehrEinstellung, 'id'>) => Promise<void>
}) {
  const { toast } = useToast()
  const [localValue, setLocalValue] = useState<string>(
    einstellung.verkaufsgebuehr_prozent !== null
      ? einstellung.verkaufsgebuehr_prozent.toString()
      : ''
  )
  const [saving, setSaving] = useState(false)

  async function handleBlur() {
    const parsed = localValue === '' ? null : parseFloat(localValue)
    if (parsed !== null && (isNaN(parsed) || parsed < 0)) return

    const current = einstellung.verkaufsgebuehr_prozent
    const next = parsed

    if (current === next) return
    if (current === null && next === null) return

    const prevValue = localValue
    setSaving(true)
    try {
      await onSave({
        sales_plattform_id: plattformId,
        produkt_id: produkt.id,
        verkaufsgebuehr_prozent: next,
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
          className="w-32"
          disabled={saving}
          placeholder="—"
          aria-label={`Verkaufsgebühr für ${produkt.name}`}
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
  const { loading, error, getEinstellung, upsert } = useVerkaufsgebuehrEinstellungen(plattformId)

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
          Bitte zuerst Produkte im KPI-Modell anlegen, bevor Verkaufsgebühren gepflegt werden können.
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
            <TableHead className="w-40">Verkaufsgebühr (%)</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {produkte.map(produkt => (
            <VerkaufsgebuehrEinstellungZeile
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

export function VerkaufsgebuehrEinstellungenTabelle() {
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
          Bitte zuerst Sales-Plattformen im KPI-Modell anlegen, bevor Verkaufsgebühren gepflegt werden können.
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
