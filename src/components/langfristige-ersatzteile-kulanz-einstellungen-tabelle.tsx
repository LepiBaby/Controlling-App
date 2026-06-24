'use client'

import { useState, useEffect } from 'react'
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
import { LangfristigeGruppierungForm } from '@/components/langfristige-gruppierung-form'
import { useToast } from '@/hooks/use-toast'

// PROJ-78: Ersatzteile/Kulanz-Einstellungen einer Planversion (zentrale Plattform).

interface ErsatzteileEinstellung extends ProduktEinstellungBase {
  quote_prozent: number | null
  produktkosten_pro_stueck_euro_netto: number | null
  versandkosten_pro_stueck_euro_netto: number | null
}

function makeEmpty(plattformId: string, produktId: string): ErsatzteileEinstellung {
  return {
    sales_plattform_id: plattformId,
    produkt_id: produktId,
    quote_prozent: null,
    produktkosten_pro_stueck_euro_netto: null,
    versandkosten_pro_stueck_euro_netto: null,
  }
}

function ErsatzteileZeile({
  produkt,
  plattformId,
  einstellung,
  onSave,
}: {
  produkt: KpiCategory
  plattformId: string
  einstellung: ErsatzteileEinstellung
  onSave: (patch: ErsatzteileEinstellung) => Promise<void>
}) {
  const { toast } = useToast()
  const [quoteStr, setQuoteStr] = useState(
    einstellung.quote_prozent !== null ? einstellung.quote_prozent.toString() : '',
  )
  const [produktkostenStr, setProduktkostenStr] = useState(
    einstellung.produktkosten_pro_stueck_euro_netto !== null
      ? einstellung.produktkosten_pro_stueck_euro_netto.toString()
      : '',
  )
  const [versandkostenStr, setVersandkostenStr] = useState(
    einstellung.versandkosten_pro_stueck_euro_netto !== null
      ? einstellung.versandkosten_pro_stueck_euro_netto.toString()
      : '',
  )
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    setQuoteStr(einstellung.quote_prozent !== null ? einstellung.quote_prozent.toString() : '')
  }, [einstellung.quote_prozent])

  useEffect(() => {
    setProduktkostenStr(
      einstellung.produktkosten_pro_stueck_euro_netto !== null
        ? einstellung.produktkosten_pro_stueck_euro_netto.toString()
        : '',
    )
  }, [einstellung.produktkosten_pro_stueck_euro_netto])

  useEffect(() => {
    setVersandkostenStr(
      einstellung.versandkosten_pro_stueck_euro_netto !== null
        ? einstellung.versandkosten_pro_stueck_euro_netto.toString()
        : '',
    )
  }, [einstellung.versandkosten_pro_stueck_euro_netto])

  async function handleSave() {
    const quote = quoteStr === '' ? null : parseFloat(quoteStr)
    const produktkosten = produktkostenStr === '' ? null : parseFloat(produktkostenStr)
    const versandkosten = versandkostenStr === '' ? null : parseFloat(versandkostenStr)
    if (quote !== null && (isNaN(quote) || quote < 0 || quote > 100)) return
    if (produktkosten !== null && (isNaN(produktkosten) || produktkosten < 0)) return
    if (versandkosten !== null && (isNaN(versandkosten) || versandkosten < 0)) return

    setSaving(true)
    try {
      await onSave({
        sales_plattform_id: plattformId,
        produkt_id: produkt.id,
        quote_prozent: quote,
        produktkosten_pro_stueck_euro_netto: produktkosten,
        versandkosten_pro_stueck_euro_netto: versandkosten,
      })
    } catch {
      setQuoteStr(einstellung.quote_prozent !== null ? einstellung.quote_prozent.toString() : '')
      setProduktkostenStr(
        einstellung.produktkosten_pro_stueck_euro_netto !== null
          ? einstellung.produktkosten_pro_stueck_euro_netto.toString()
          : '',
      )
      setVersandkostenStr(
        einstellung.versandkosten_pro_stueck_euro_netto !== null
          ? einstellung.versandkosten_pro_stueck_euro_netto.toString()
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
          aria-label={`Ersatzteile/Kulanz-Quote für ${produkt.name}`}
        />
      </TableCell>
      <TableCell>
        <Input
          type="number"
          min={0}
          step={0.01}
          value={produktkostenStr}
          onChange={e => setProduktkostenStr(e.target.value)}
          onBlur={handleSave}
          className="w-36"
          disabled={saving}
          placeholder="—"
          aria-label={`Kulanzproduktkosten pro Stück für ${produkt.name}`}
        />
      </TableCell>
      <TableCell>
        <Input
          type="number"
          min={0}
          step={0.01}
          value={versandkostenStr}
          onChange={e => setVersandkostenStr(e.target.value)}
          onBlur={handleSave}
          className="w-36"
          disabled={saving}
          placeholder="—"
          aria-label={`Kulanzversandkosten pro Stück für ${produkt.name}`}
        />
      </TableCell>
    </TableRow>
  )
}

export function LangfristigeErsatzteileKulanzEinstellungenTabelle({
  versionId,
  plattformId,
  produkte,
}: {
  versionId: string
  plattformId: string
  produkte: KpiCategory[]
}) {
  const { loading, error, getEinstellung, upsert } =
    useLangfristigeVertriebProduktEinstellungen<ErsatzteileEinstellung>(
      versionId,
      'ersatzteile-kulanz-einstellungen',
      plattformId,
      makeEmpty,
    )

  return (
    <div className="space-y-4">
      <LangfristigeGruppierungForm
        versionId={versionId}
        endpointSuffix="ersatzteile-kulanz-plattform-einstellungen"
        plattformId={plattformId}
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
                <TableHead className="w-44">Kulanz-Quote (%)</TableHead>
                <TableHead className="w-48">Kulanzproduktkosten pro Stück (€ netto)</TableHead>
                <TableHead className="w-48">Kulanzversandkosten pro Stück (€ netto)</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {produkte.map(produkt => (
                <ErsatzteileZeile
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
      )}
    </div>
  )
}
