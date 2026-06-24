'use client'

import { useState, useEffect } from 'react'
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
import type { KpiCategory } from '@/hooks/use-kpi-categories'
import {
  useLangfristigeVertriebProduktEinstellungen,
  type ProduktEinstellungBase,
} from '@/hooks/use-langfristige-vertrieb-produkt-einstellungen'
import {
  useLangfristigeRetourenAllgemeinProduktEinstellungen,
  type LangfristigeRetourenAllgemeinProduktEinstellung,
} from '@/hooks/use-langfristige-retouren-allgemein-produkt-einstellungen'
import { LangfristigeGruppierungForm } from '@/components/langfristige-gruppierung-form'
import { useToast } from '@/hooks/use-toast'

// PROJ-78: Retoureneinstellungen einer Planversion.
// Allgemein: versionsweite Gruppierung + je Produkt MANUELLE Retourenquote (%) +
// Retourenhandling-Kosten. Je Plattform: Erstattung Verkaufsgebühr % + Rückversand.

// --- Allgemein-Produktzeile (manuelle Retourenquote + Handling) ---

function AllgemeinZeile({
  produkt,
  einstellung,
  onSave,
}: {
  produkt: KpiCategory
  einstellung: LangfristigeRetourenAllgemeinProduktEinstellung
  onSave: (patch: LangfristigeRetourenAllgemeinProduktEinstellung) => Promise<void>
}) {
  const { toast } = useToast()
  const [quoteStr, setQuoteStr] = useState(
    einstellung.retourenquote_prozent !== null ? einstellung.retourenquote_prozent.toString() : '',
  )
  const [handlingStr, setHandlingStr] = useState(
    einstellung.retourenhandling_kosten_euro_netto !== null
      ? einstellung.retourenhandling_kosten_euro_netto.toString()
      : '',
  )
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    setQuoteStr(
      einstellung.retourenquote_prozent !== null
        ? einstellung.retourenquote_prozent.toString()
        : '',
    )
  }, [einstellung.retourenquote_prozent])

  useEffect(() => {
    setHandlingStr(
      einstellung.retourenhandling_kosten_euro_netto !== null
        ? einstellung.retourenhandling_kosten_euro_netto.toString()
        : '',
    )
  }, [einstellung.retourenhandling_kosten_euro_netto])

  async function handleSave() {
    const quote = quoteStr === '' ? null : parseFloat(quoteStr)
    const handling = handlingStr === '' ? null : parseFloat(handlingStr)
    if (quote !== null && (isNaN(quote) || quote < 0 || quote > 100)) return
    if (handling !== null && (isNaN(handling) || handling < 0)) return

    setSaving(true)
    try {
      await onSave({
        produkt_id: produkt.id,
        retourenquote_prozent: quote,
        retourenhandling_kosten_euro_netto: handling,
      })
    } catch {
      setQuoteStr(
        einstellung.retourenquote_prozent !== null
          ? einstellung.retourenquote_prozent.toString()
          : '',
      )
      setHandlingStr(
        einstellung.retourenhandling_kosten_euro_netto !== null
          ? einstellung.retourenhandling_kosten_euro_netto.toString()
          : '',
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
          max={100}
          step={0.01}
          value={quoteStr}
          onChange={e => setQuoteStr(e.target.value)}
          onBlur={handleSave}
          className="w-36"
          disabled={saving}
          placeholder="—"
          aria-label={`Retourenquote für ${produkt.name}`}
        />
      </TableCell>
      <TableCell>
        <Input
          type="number"
          min={0}
          step={0.01}
          value={handlingStr}
          onChange={e => setHandlingStr(e.target.value)}
          onBlur={handleSave}
          className="w-36"
          disabled={saving}
          placeholder="—"
          aria-label={`Retourenhandling-Kosten für ${produkt.name}`}
        />
      </TableCell>
    </TableRow>
  )
}

function AllgemeinTab({
  versionId,
  produkte,
}: {
  versionId: string
  produkte: KpiCategory[]
}) {
  const { loading, error, getEinstellung, upsert } =
    useLangfristigeRetourenAllgemeinProduktEinstellungen(versionId)

  return (
    <div className="space-y-4">
      <LangfristigeGruppierungForm
        versionId={versionId}
        endpointSuffix="retouren-allgemein-einstellungen"
      />
      {loading ? (
        <div className="py-6 text-center text-sm text-muted-foreground">Laden…</div>
      ) : error ? (
        <div className="rounded-lg border border-destructive bg-destructive/10 p-4 text-sm text-destructive">
          {error}
        </div>
      ) : (
        <div className="rounded-lg border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-52">Produkt</TableHead>
                <TableHead className="w-44">Retourenquote (%)</TableHead>
                <TableHead className="w-44">Retourenhandling-Kosten (€ netto)</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {produkte.map(produkt => (
                <AllgemeinZeile
                  key={produkt.id}
                  produkt={produkt}
                  einstellung={getEinstellung(produkt.id)}
                  onSave={upsert}
                />
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  )
}

// --- Plattform-Produktzeile (Erstattung VkGeb. + Rückversand) ---

interface RetourenPlattformEinstellung extends ProduktEinstellungBase {
  erstattung_verkaufsgebuehr_prozent: number | null
  rueckversandkosten_euro_netto: number | null
}

function makeEmptyPlattform(plattformId: string, produktId: string): RetourenPlattformEinstellung {
  return {
    sales_plattform_id: plattformId,
    produkt_id: produktId,
    erstattung_verkaufsgebuehr_prozent: null,
    rueckversandkosten_euro_netto: null,
  }
}

function PlattformZeile({
  produkt,
  plattformId,
  einstellung,
  onSave,
}: {
  produkt: KpiCategory
  plattformId: string
  einstellung: RetourenPlattformEinstellung
  onSave: (patch: RetourenPlattformEinstellung) => Promise<void>
}) {
  const { toast } = useToast()
  const [erstattungStr, setErstattungStr] = useState(
    einstellung.erstattung_verkaufsgebuehr_prozent !== null
      ? einstellung.erstattung_verkaufsgebuehr_prozent.toString()
      : '',
  )
  const [rueckversandStr, setRueckversandStr] = useState(
    einstellung.rueckversandkosten_euro_netto !== null
      ? einstellung.rueckversandkosten_euro_netto.toString()
      : '',
  )
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    setErstattungStr(
      einstellung.erstattung_verkaufsgebuehr_prozent !== null
        ? einstellung.erstattung_verkaufsgebuehr_prozent.toString()
        : '',
    )
  }, [einstellung.erstattung_verkaufsgebuehr_prozent])

  useEffect(() => {
    setRueckversandStr(
      einstellung.rueckversandkosten_euro_netto !== null
        ? einstellung.rueckversandkosten_euro_netto.toString()
        : '',
    )
  }, [einstellung.rueckversandkosten_euro_netto])

  async function handleSave() {
    const erstattung = erstattungStr === '' ? null : parseFloat(erstattungStr)
    const rueckversand = rueckversandStr === '' ? null : parseFloat(rueckversandStr)
    if (erstattung !== null && (isNaN(erstattung) || erstattung < 0 || erstattung > 100)) return
    if (rueckversand !== null && (isNaN(rueckversand) || rueckversand < 0)) return

    setSaving(true)
    try {
      await onSave({
        sales_plattform_id: plattformId,
        produkt_id: produkt.id,
        erstattung_verkaufsgebuehr_prozent: erstattung,
        rueckversandkosten_euro_netto: rueckversand,
      })
    } catch {
      setErstattungStr(
        einstellung.erstattung_verkaufsgebuehr_prozent !== null
          ? einstellung.erstattung_verkaufsgebuehr_prozent.toString()
          : '',
      )
      setRueckversandStr(
        einstellung.rueckversandkosten_euro_netto !== null
          ? einstellung.rueckversandkosten_euro_netto.toString()
          : '',
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

function PlattformTab({
  versionId,
  plattformId,
  produkte,
}: {
  versionId: string
  plattformId: string
  produkte: KpiCategory[]
}) {
  const { loading, error, getEinstellung, upsert } =
    useLangfristigeVertriebProduktEinstellungen<RetourenPlattformEinstellung>(
      versionId,
      'retouren-einstellungen',
      plattformId,
      makeEmptyPlattform,
    )

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
            <PlattformZeile
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

export function LangfristigeRetourenEinstellungenTabelle({
  versionId,
  plattformen,
  produkte,
}: {
  versionId: string
  plattformen: KpiCategory[]
  produkte: KpiCategory[]
}) {
  return (
    <Tabs defaultValue="allgemein" className="space-y-4">
      <TabsList className="w-full h-auto flex-wrap">
        <TabsTrigger value="allgemein" className="flex-1">
          Allgemein
        </TabsTrigger>
        {plattformen.map(p => (
          <TabsTrigger key={p.id} value={p.id} className="flex-1">
            {p.name}
          </TabsTrigger>
        ))}
      </TabsList>

      <TabsContent value="allgemein" className="mt-0">
        <AllgemeinTab versionId={versionId} produkte={produkte} />
      </TabsContent>

      {plattformen.map(p => (
        <TabsContent key={p.id} value={p.id} className="mt-0">
          <PlattformTab versionId={versionId} plattformId={p.id} produkte={produkte} />
        </TabsContent>
      ))}
    </Tabs>
  )
}
