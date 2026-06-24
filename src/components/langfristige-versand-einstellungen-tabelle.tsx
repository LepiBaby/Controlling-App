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

// PROJ-78: Versand-Einstellungen einer Planversion (zentrale Plattform).

interface VersandEinstellung extends ProduktEinstellungBase {
  versandgebuehr_spediteur_euro_netto: number | null
  versandgebuehr_3pl_euro_netto: number | null
}

function makeEmpty(plattformId: string, produktId: string): VersandEinstellung {
  return {
    sales_plattform_id: plattformId,
    produkt_id: produktId,
    versandgebuehr_spediteur_euro_netto: null,
    versandgebuehr_3pl_euro_netto: null,
  }
}

function VersandZeile({
  produkt,
  plattformId,
  einstellung,
  onSave,
}: {
  produkt: KpiCategory
  plattformId: string
  einstellung: VersandEinstellung
  onSave: (patch: VersandEinstellung) => Promise<void>
}) {
  const { toast } = useToast()
  const [spediteurStr, setSpediteurStr] = useState(
    einstellung.versandgebuehr_spediteur_euro_netto !== null
      ? einstellung.versandgebuehr_spediteur_euro_netto.toString()
      : '',
  )
  const [tplStr, setTplStr] = useState(
    einstellung.versandgebuehr_3pl_euro_netto !== null
      ? einstellung.versandgebuehr_3pl_euro_netto.toString()
      : '',
  )
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    setSpediteurStr(
      einstellung.versandgebuehr_spediteur_euro_netto !== null
        ? einstellung.versandgebuehr_spediteur_euro_netto.toString()
        : '',
    )
  }, [einstellung.versandgebuehr_spediteur_euro_netto])

  useEffect(() => {
    setTplStr(
      einstellung.versandgebuehr_3pl_euro_netto !== null
        ? einstellung.versandgebuehr_3pl_euro_netto.toString()
        : '',
    )
  }, [einstellung.versandgebuehr_3pl_euro_netto])

  const spediteurNum =
    spediteurStr !== '' && !isNaN(parseFloat(spediteurStr)) ? parseFloat(spediteurStr) : null
  const tplNum = tplStr !== '' && !isNaN(parseFloat(tplStr)) ? parseFloat(tplStr) : null
  const summe = spediteurNum === null && tplNum === null ? null : (spediteurNum ?? 0) + (tplNum ?? 0)

  async function handleSave(newSpediteur: number | null, newTpl: number | null) {
    const prevSpediteur = spediteurStr
    const prevTpl = tplStr
    setSaving(true)
    try {
      await onSave({
        sales_plattform_id: plattformId,
        produkt_id: produkt.id,
        versandgebuehr_spediteur_euro_netto: newSpediteur,
        versandgebuehr_3pl_euro_netto: newTpl,
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
    if (parsed === einstellung.versandgebuehr_spediteur_euro_netto) return
    handleSave(parsed, einstellung.versandgebuehr_3pl_euro_netto)
  }

  function handleTplBlur() {
    const parsed = tplStr === '' ? null : parseFloat(tplStr)
    if (parsed !== null && (isNaN(parsed) || parsed < 0)) return
    if (parsed === einstellung.versandgebuehr_3pl_euro_netto) return
    handleSave(einstellung.versandgebuehr_spediteur_euro_netto, parsed)
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
          aria-label={`Versandkosten Spediteur für ${produkt.name}`}
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
          aria-label={`Versandkosten 3PL für ${produkt.name}`}
        />
      </TableCell>
      <TableCell className="text-muted-foreground tabular-nums">
        {summe !== null ? summe.toFixed(2) : '—'}
      </TableCell>
    </TableRow>
  )
}

export function LangfristigeVersandEinstellungenTabelle({
  versionId,
  plattformId,
  produkte,
}: {
  versionId: string
  plattformId: string
  produkte: KpiCategory[]
}) {
  const { loading, error, getEinstellung, upsert } =
    useLangfristigeVertriebProduktEinstellungen<VersandEinstellung>(
      versionId,
      'versand-einstellungen',
      plattformId,
      makeEmpty,
    )

  return (
    <div className="space-y-4">
      <LangfristigeGruppierungForm
        versionId={versionId}
        endpointSuffix="versand-plattform-einstellungen"
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
                <TableHead className="w-44">Produkt</TableHead>
                <TableHead className="w-40">Versandkosten Spediteur (€ netto)</TableHead>
                <TableHead className="w-36">Versandkosten 3PL (€ netto)</TableHead>
                <TableHead className="w-32">Versandkosten (€ netto)</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {produkte.map(produkt => (
                <VersandZeile
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
