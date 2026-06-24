'use client'

import { useState, useMemo } from 'react'
import { useParams } from 'next/navigation'
import { Label } from '@/components/ui/label'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { LangfristigeVersionShell } from '@/components/langfristige-version-shell'
import { LangfristigeRentabilitaetsauswertungMatrix } from '@/components/langfristige-rentabilitaetsauswertung-matrix'
import { LangfristigeRentabilitaetsauswertungChart } from '@/components/langfristige-rentabilitaetsauswertung-chart'
import { LangfristigeRentabilitaetsauswertungAbsatztabelle } from '@/components/langfristige-rentabilitaetsauswertung-absatztabelle'
import {
  useLangfristigeRentabilitaetsauswertung,
  applyZeitbasis,
  RA_DEFAULT_CHART_IDS,
  type RaAnzeigemodus,
  type RaZeitbasis,
} from '@/hooks/use-langfristige-rentabilitaetsauswertung'

function RentabilitaetsauswertungInhalt({ versionId }: { versionId: string }) {
  const model = useLangfristigeRentabilitaetsauswertung(versionId)
  const [anzeigemodus, setAnzeigemodus] = useState<RaAnzeigemodus>('absolut')
  const [zeitbasis, setZeitbasis] = useState<RaZeitbasis>('monat')
  const [selectedIds, setSelectedIds] = useState<string[]>(RA_DEFAULT_CHART_IDS)

  const displayModel = useMemo(() => applyZeitbasis(model, zeitbasis), [model, zeitbasis])

  return (
    <div className="space-y-6">
      {/* Filter-Leiste */}
      <div className="flex flex-wrap items-end gap-4">
        <div className="space-y-1.5">
          <Label className="text-xs">Zeitbasis</Label>
          <Tabs value={zeitbasis} onValueChange={v => setZeitbasis(v as RaZeitbasis)}>
            <TabsList className="h-8">
              <TabsTrigger value="monat" className="text-xs px-3 h-6">Monat</TabsTrigger>
              <TabsTrigger value="jahr" className="text-xs px-3 h-6">Jahr</TabsTrigger>
            </TabsList>
          </Tabs>
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs">Ansicht</Label>
          <Tabs value={anzeigemodus} onValueChange={v => setAnzeigemodus(v as RaAnzeigemodus)}>
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

      {/* Liniendiagramm */}
      <LangfristigeRentabilitaetsauswertungChart
        model={displayModel}
        anzeigemodus={anzeigemodus}
        selectedIds={selectedIds}
        onSelectionChange={setSelectedIds}
      />

      {/* Absatztabelle */}
      <LangfristigeRentabilitaetsauswertungAbsatztabelle model={displayModel} />

      {/* Haupttabelle (GuV-Kaskade) */}
      <LangfristigeRentabilitaetsauswertungMatrix
        model={displayModel}
        anzeigemodus={anzeigemodus}
      />
    </div>
  )
}

export default function LangfristigeRentabilitaetsauswertungPage() {
  const params = useParams()
  const versionId = typeof params.versionId === 'string' ? params.versionId : ''

  return (
    <LangfristigeVersionShell seitenTitel="Rentabilitätsauswertung" fullWidth>
      <RentabilitaetsauswertungInhalt versionId={versionId} />
    </LangfristigeVersionShell>
  )
}
