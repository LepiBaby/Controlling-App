'use client'

import { useState, useEffect, useMemo } from 'react'
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
import { Label } from '@/components/ui/label'
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

  useEffect(() => {
    setLocalValue(
      einstellung.verkaufsgebuehr_prozent !== null
        ? einstellung.verkaufsgebuehr_prozent.toString()
        : ''
    )
  }, [einstellung.verkaufsgebuehr_prozent])

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
        description: 'Verkaufsgebühr konnte nicht für alle Produkte gespeichert werden.',
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
          placeholder="% für alle Produkte"
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

// --- Tabelle für eine Plattform ---

function PlattformTabelle({
  plattformId,
  produkte,
}: {
  plattformId: string
  produkte: KpiCategory[]
}) {
  const { loading, error, getEinstellung, upsert, batchUpsert } = useVerkaufsgebuehrEinstellungen(plattformId)

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
