'use client'

import { useState, useMemo } from 'react'
import { useParams } from 'next/navigation'
import { Label } from '@/components/ui/label'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { LangfristigeVersionShell } from '@/components/langfristige-version-shell'
import { LangfristigeFinanzierungsausgabenAuswertungMatrix } from '@/components/langfristige-finanzierungsausgaben-auswertung-matrix'
import { LangfristigeFinanzierungsausgabenAuswertungChart } from '@/components/langfristige-finanzierungsausgaben-auswertung-chart'
import {
  useLangfristigeFinanzierungsausgabenAuswertung,
  applyZeitbasis,
  type FaAnzeigemodus,
  type FaZeitbasis,
} from '@/hooks/use-langfristige-finanzierungsausgaben-auswertung'

function FinanzierungsausgabenAuswertungInhalt({ versionId }: { versionId: string }) {
  const model = useLangfristigeFinanzierungsausgabenAuswertung(versionId)
  const [anzeigemodus, setAnzeigemodus] = useState<FaAnzeigemodus>('absolut')
  const [zeitbasis, setZeitbasis] = useState<FaZeitbasis>('monat')

  const displayModel = useMemo(() => applyZeitbasis(model, zeitbasis), [model, zeitbasis])

  return (
    <div className="space-y-6">
      {/* Filter-Leiste */}
      <div className="flex flex-wrap items-end gap-4">
        <div className="space-y-1.5">
          <Label className="text-xs">Zeitbasis</Label>
          <Tabs value={zeitbasis} onValueChange={v => setZeitbasis(v as FaZeitbasis)}>
            <TabsList className="h-8">
              <TabsTrigger value="monat" className="text-xs px-3 h-6">Monat</TabsTrigger>
              <TabsTrigger value="jahr" className="text-xs px-3 h-6">Jahr</TabsTrigger>
            </TabsList>
          </Tabs>
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs">Ansicht</Label>
          <Tabs value={anzeigemodus} onValueChange={v => setAnzeigemodus(v as FaAnzeigemodus)}>
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

      {/* Gestapeltes Diagramm (Gruppen → Gesamt) */}
      <LangfristigeFinanzierungsausgabenAuswertungChart model={displayModel} anzeigemodus={anzeigemodus} />

      {/* Haupttabelle (Gruppen → Untergruppen → Gesamt) */}
      <LangfristigeFinanzierungsausgabenAuswertungMatrix model={displayModel} anzeigemodus={anzeigemodus} />
    </div>
  )
}

export default function LangfristigeFinanzierungsausgabenAuswertungPage() {
  const params = useParams()
  const versionId = typeof params.versionId === 'string' ? params.versionId : ''

  return (
    <LangfristigeVersionShell seitenTitel="Finanzierungsausgaben-Auswertung" fullWidth>
      <FinanzierungsausgabenAuswertungInhalt versionId={versionId} />
    </LangfristigeVersionShell>
  )
}
