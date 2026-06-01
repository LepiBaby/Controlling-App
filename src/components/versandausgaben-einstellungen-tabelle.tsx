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
  useVersandausgabenPlattformEinstellungen,
  GRUPPIERUNGEN,
  GRUPPIERUNG_LABELS,
  type Gruppierung,
} from '@/hooks/use-versandausgaben-plattform-einstellungen'
import { useToast } from '@/hooks/use-toast'

// --- Plattform-Einstellungsformular (Gruppierung + Zahlungsziel) ---

function PlattformEinstellungenForm({ plattformId }: { plattformId: string }) {
  const { einstellungen, loading, error, upsert } =
    useVersandausgabenPlattformEinstellungen(plattformId)
  const { toast } = useToast()
  const [zahlungszielStr, setZahlungszielStr] = useState('')
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
      <div className="grid gap-4 sm:grid-cols-2 max-w-lg">
        <div className="space-y-1.5">
          <Label htmlFor={`gruppierung-${plattformId}`}>Gruppierung</Label>
          <Select
            value={einstellungen.gruppierung}
            onValueChange={handleGruppierungChange}
          >
            <SelectTrigger id={`gruppierung-${plattformId}`}>
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
            className="w-32"
          />
        </div>
      </div>
    </div>
  )
}

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
  const [spediteurStr, setSpediteurStr] = useState<string>(
    einstellung.versandgebuehr_spediteur !== null
      ? einstellung.versandgebuehr_spediteur.toString()
      : ''
  )
  const [tplStr, setTplStr] = useState<string>(
    einstellung.versandgebuehr_3pl !== null
      ? einstellung.versandgebuehr_3pl.toString()
      : ''
  )
  const [saving, setSaving] = useState(false)

  const spediteurNum =
    spediteurStr !== '' && !isNaN(parseFloat(spediteurStr)) ? parseFloat(spediteurStr) : null
  const tplNum =
    tplStr !== '' && !isNaN(parseFloat(tplStr)) ? parseFloat(tplStr) : null
  const summe =
    spediteurNum === null && tplNum === null
      ? null
      : (spediteurNum ?? 0) + (tplNum ?? 0)

  async function handleSave(
    newSpediteur: number | null,
    newTpl: number | null
  ) {
    const prevSpediteur = spediteurStr
    const prevTpl = tplStr
    setSaving(true)
    try {
      await onSave({
        sales_plattform_id: plattformId,
        produkt_id: produkt.id,
        versandgebuehr_spediteur: newSpediteur,
        versandgebuehr_3pl: newTpl,
      })
    } catch {
      setSpediteurStr(prevSpediteur)
      setTplStr(prevTpl)
      toast({
        title: 'Fehler',
        description: 'Einstellung konnte nicht gespeichert werden.',
        variant: 'destructive',
      })
    } finally {
      setSaving(false)
    }
  }

  function handleSpediteurBlur() {
    const parsed = spediteurStr === '' ? null : parseFloat(spediteurStr)
    if (parsed !== null && (isNaN(parsed) || parsed < 0)) return
    if (parsed === einstellung.versandgebuehr_spediteur) return
    handleSave(parsed, einstellung.versandgebuehr_3pl)
  }

  function handleTplBlur() {
    const parsed = tplStr === '' ? null : parseFloat(tplStr)
    if (parsed !== null && (isNaN(parsed) || parsed < 0)) return
    if (parsed === einstellung.versandgebuehr_3pl) return
    handleSave(einstellung.versandgebuehr_spediteur, parsed)
  }

  return (
    <TableRow className={saving ? 'opacity-60' : ''}>
      <TableCell className="font-medium">{produkt.name}</TableCell>
      <TableCell>
        <Input
          type="number"
          min={0}
          step={0.01}
          value={spediteurStr}
          onChange={e => setSpediteurStr(e.target.value)}
          onBlur={handleSpediteurBlur}
          className="w-32"
          disabled={saving}
          placeholder="—"
          aria-label={`Versandausgaben Spediteur für ${produkt.name}`}
        />
      </TableCell>
      <TableCell>
        <Input
          type="number"
          min={0}
          step={0.01}
          value={tplStr}
          onChange={e => setTplStr(e.target.value)}
          onBlur={handleTplBlur}
          className="w-32"
          disabled={saving}
          placeholder="—"
          aria-label={`Versandausgaben 3PL für ${produkt.name}`}
        />
      </TableCell>
      <TableCell className="text-muted-foreground tabular-nums">
        {summe !== null ? summe.toFixed(2) : '—'}
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
            <TableHead className="w-44">Produkt</TableHead>
            <TableHead className="w-40">Versandausgaben Spediteur (€ netto)</TableHead>
            <TableHead className="w-36">Versandausgaben 3PL (€ netto)</TableHead>
            <TableHead className="w-32">Versandausgaben (€ netto)</TableHead>
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

  if (sortedPlattformen.length === 0) {
    return (
      <div className="rounded-lg border bg-muted/30 p-8 text-center space-y-3">
        <p className="font-medium">Keine Sales-Plattformen definiert</p>
        <p className="text-sm text-muted-foreground">
          Bitte zuerst Sales-Plattformen im KPI-Modell anlegen, bevor Versandausgaben gepflegt
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
