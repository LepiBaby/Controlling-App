'use client'

import { useState, useMemo } from 'react'
import { useParams } from 'next/navigation'
import { Label } from '@/components/ui/label'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { LangfristigeVersionShell } from '@/components/langfristige-version-shell'
import { LangfristigeUmsatzauswertungMatrix } from '@/components/langfristige-umsatzauswertung-matrix'
import { LangfristigeUmsatzauswertungChart } from '@/components/langfristige-umsatzauswertung-chart'
import { LangfristigeUmsatzauswertungAbsatztabelle } from '@/components/langfristige-umsatzauswertung-absatztabelle'
import {
  useLangfristigeUmsatzauswertung,
  applyZeitbasis,
  type UaAnzeigemodus,
  type UaZeitbasis,
} from '@/hooks/use-langfristige-umsatzauswertung'

function UmsatzauswertungInhalt({ versionId }: { versionId: string }) {
  const model = useLangfristigeUmsatzauswertung(versionId)
  const [anzeigemodus, setAnzeigemodus] = useState<UaAnzeigemodus>('absolut')
  const [zeitbasis, setZeitbasis] = useState<UaZeitbasis>('monat')

  const displayModel = useMemo(() => applyZeitbasis(model, zeitbasis), [model, zeitbasis])

  return (
    <div className="space-y-6">
      {/* Filter-Leiste */}
      <div className="flex flex-wrap items-end gap-4">
        <div className="space-y-1.5">
          <Label className="text-xs">Zeitbasis</Label>
          <Tabs value={zeitbasis} onValueChange={v => setZeitbasis(v as UaZeitbasis)}>
            <TabsList className="h-8">
              <TabsTrigger value="monat" className="text-xs px-3 h-6">Monat</TabsTrigger>
              <TabsTrigger value="jahr" className="text-xs px-3 h-6">Jahr</TabsTrigger>
            </TabsList>
          </Tabs>
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs">Ansicht</Label>
          <Tabs value={anzeigemodus} onValueChange={v => setAnzeigemodus(v as UaAnzeigemodus)}>
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

      {/* Liniendiagramm (Brutto-Umsatz + Netto-Umsatz) */}
      <LangfristigeUmsatzauswertungChart model={displayModel} anzeigemodus={anzeigemodus} />

      {/* Absatztabelle */}
      <LangfristigeUmsatzauswertungAbsatztabelle model={displayModel} />

      {/* Haupttabelle (Umsatz-Kaskade) */}
      <LangfristigeUmsatzauswertungMatrix model={displayModel} anzeigemodus={anzeigemodus} />
    </div>
  )
}

export default function LangfristigeUmsatzauswertungPage() {
  const params = useParams()
  const versionId = typeof params.versionId === 'string' ? params.versionId : ''

  return (
    <LangfristigeVersionShell seitenTitel="Umsatzauswertung" fullWidth>
      <UmsatzauswertungInhalt versionId={versionId} />
    </LangfristigeVersionShell>
  )
}
