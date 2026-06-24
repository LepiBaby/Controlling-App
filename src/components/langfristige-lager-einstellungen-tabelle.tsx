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
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import type { KpiCategory } from '@/hooks/use-kpi-categories'
import {
  useLangfristigeLagerEinstellungen,
  type LangfristigeLagerEinstellung,
} from '@/hooks/use-langfristige-lager-einstellungen'
import { LangfristigeGruppierungForm } from '@/components/langfristige-gruppierung-form'
import { useToast } from '@/hooks/use-toast'

// PROJ-78: Lager-Einstellungen einer Planversion (zentrale Plattform).
// Lagerkosten werden MONATLICH gepflegt (€/m³/Monat netto).

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
      await onBatch(plattformId, parsed, produkte.map(p => p.id))
      setWertStr('')
    } catch {
      toast({
        title: 'Fehler',
        description: 'Lagerkosten konnten nicht für alle Produkte gespeichert werden.',
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
          onKeyDown={e => {
            if (e.key === 'Enter' && !disabled) handleUebernehmen()
          }}
          placeholder="€/m³/Monat für alle Produkte"
          className="w-64"
          disabled={saving}
        />
      </div>
      <Button variant="secondary" onClick={handleUebernehmen} disabled={disabled}>
        Übernehmen
      </Button>
    </div>
  )
}

function LagerZeile({
  produkt,
  plattformId,
  einstellung,
  onSave,
}: {
  produkt: KpiCategory
  plattformId: string
  einstellung: LangfristigeLagerEinstellung
  onSave: (patch: LangfristigeLagerEinstellung) => Promise<void>
}) {
  const { toast } = useToast()
  const [wertStr, setWertStr] = useState(
    einstellung.lagerkosten_euro_m3_monat !== null
      ? einstellung.lagerkosten_euro_m3_monat.toString()
      : '',
  )
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    setWertStr(
      einstellung.lagerkosten_euro_m3_monat !== null
        ? einstellung.lagerkosten_euro_m3_monat.toString()
        : '',
    )
  }, [einstellung.lagerkosten_euro_m3_monat])

  async function handleBlur() {
    const parsed = wertStr === '' ? null : parseFloat(wertStr)
    if (parsed !== null && (isNaN(parsed) || parsed < 0)) return
    if (parsed === einstellung.lagerkosten_euro_m3_monat) return
    setSaving(true)
    try {
      await onSave({
        sales_plattform_id: plattformId,
        produkt_id: produkt.id,
        lagerkosten_euro_m3_monat: parsed,
      })
    } catch {
      setWertStr(
        einstellung.lagerkosten_euro_m3_monat !== null
          ? einstellung.lagerkosten_euro_m3_monat.toString()
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
          step={0.01}
          value={wertStr}
          onChange={e => setWertStr(e.target.value)}
          onBlur={handleBlur}
          className="w-36"
          disabled={saving}
          placeholder="—"
          aria-label={`Lagerkosten €/m³/Monat für ${produkt.name}`}
        />
      </TableCell>
    </TableRow>
  )
}

export function LangfristigeLagerEinstellungenTabelle({
  versionId,
  plattformId,
  produkte,
}: {
  versionId: string
  plattformId: string
  produkte: KpiCategory[]
}) {
  const { loading, error, getEinstellung, upsert, batchUpsert } =
    useLangfristigeLagerEinstellungen(versionId, plattformId)

  return (
    <div className="space-y-4">
      <LangfristigeGruppierungForm
        versionId={versionId}
        endpointSuffix="lager-plattform-einstellungen"
        plattformId={plattformId}
      />
      {loading ? (
        <div className="py-6 text-center text-sm text-muted-foreground">Laden…</div>
      ) : error ? (
        <div className="rounded-lg border border-destructive bg-destructive/10 p-4 text-sm text-destructive">
          {error}
        </div>
      ) : (
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
                  <TableHead className="w-64">Produkt</TableHead>
                  <TableHead className="w-48">Lagerkosten (€/m³/Monat netto)</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {produkte.map(produkt => (
                  <LagerZeile
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
      )}
    </div>
  )
}
