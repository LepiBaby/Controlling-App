'use client'

import { useState, useMemo } from 'react'
import { useParams } from 'next/navigation'
import { Label } from '@/components/ui/label'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { LangfristigeVersionShell } from '@/components/langfristige-version-shell'
import { LangfristigeUmsatzkostenAuswertungMatrix } from '@/components/langfristige-umsatzkosten-auswertung-matrix'
import { LangfristigeUmsatzkostenAuswertungChart } from '@/components/langfristige-umsatzkosten-auswertung-chart'
import {
  useLangfristigeUmsatzkostenAuswertung,
  applyZeitbasis,
  type UkAnzeigemodus,
  type UkZeitbasis,
} from '@/hooks/use-langfristige-umsatzkosten-auswertung'

function UmsatzkostenAuswertungInhalt({ versionId }: { versionId: string }) {
  const model = useLangfristigeUmsatzkostenAuswertung(versionId)
  const [anzeigemodus, setAnzeigemodus] = useState<UkAnzeigemodus>('absolut')
  const [zeitbasis, setZeitbasis] = useState<UkZeitbasis>('monat')

  const displayModel = useMemo(() => applyZeitbasis(model, zeitbasis), [model, zeitbasis])

  return (
    <div className="space-y-6">
      {/* Filter-Leiste */}
      <div className="flex flex-wrap items-end gap-4">
        <div className="space-y-1.5">
          <Label className="text-xs">Zeitbasis</Label>
          <Tabs value={zeitbasis} onValueChange={v => setZeitbasis(v as UkZeitbasis)}>
            <TabsList className="h-8">
              <TabsTrigger value="monat" className="text-xs px-3 h-6">Monat</TabsTrigger>
              <TabsTrigger value="jahr" className="text-xs px-3 h-6">Jahr</TabsTrigger>
            </TabsList>
          </Tabs>
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs">Ansicht</Label>
          <Tabs value={anzeigemodus} onValueChange={v => setAnzeigemodus(v as UkAnzeigemodus)}>
            <TabsList className="h-8">
              <TabsTrigger value="absolut" className="text-xs px-3 h-6">Absolut</TabsTrigger>
              <TabsTrigger value="prozentual" className="text-xs px-3 h-6">Prozentual</TabsTrigger>
              <TabsTrigger value="wachstum" className="text-xs px-3 h-6">Wachstum</TabsTrigger>
            </TabsList>
          </Tabs>
        </div>
      </div>

      {model.error && (
        <div className="rounded-lg border border-destructive bg-destructive/10 p-4 text-sm text-destructive">
          {model.error}
        </div>
      )}

      {/* Gestapeltes Diagramm (Produktkosten + Vertriebskosten + Marketingkosten) */}
      <LangfristigeUmsatzkostenAuswertungChart model={displayModel} anzeigemodus={anzeigemodus} />

      {/* Haupttabelle (Kosten-Kaskade + Summe) */}
      <LangfristigeUmsatzkostenAuswertungMatrix model={displayModel} anzeigemodus={anzeigemodus} />
    </div>
  )
}

export default function LangfristigeUmsatzkostenAuswertungPage() {
  const params = useParams()
  const versionId = typeof params.versionId === 'string' ? params.versionId : ''

  return (
    <LangfristigeVersionShell seitenTitel="Umsatzkosten-Auswertung" fullWidth>
      <UmsatzkostenAuswertungInhalt versionId={versionId} />
    </LangfristigeVersionShell>
  )
}
