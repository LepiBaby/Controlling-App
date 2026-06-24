'use client'

import { useState, useMemo } from 'react'
import { useParams } from 'next/navigation'
import { Label } from '@/components/ui/label'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { LangfristigeVersionShell } from '@/components/langfristige-version-shell'
import { LangfristigeInvestitionsauswertungMatrix } from '@/components/langfristige-investitionsauswertung-matrix'
import { LangfristigeInvestitionsauswertungChart } from '@/components/langfristige-investitionsauswertung-chart'
import {
  useLangfristigeInvestitionsauswertung,
  applyIaZeitansicht,
  type IaZeitansicht,
} from '@/hooks/use-langfristige-investitionsauswertung'

function InvestitionsauswertungInhalt({ versionId }: { versionId: string }) {
  const model = useLangfristigeInvestitionsauswertung(versionId)
  const [zeitansicht, setZeitansicht] = useState<IaZeitansicht>('monatlich')

  const displayModel = useMemo(() => applyIaZeitansicht(model, zeitansicht), [model, zeitansicht])

  return (
    <div className="space-y-6">
      {/* Filter-Leiste */}
      <div className="flex flex-wrap items-end gap-4">
        <div className="space-y-1.5">
          <Label className="text-xs">Zeitansicht</Label>
          <Tabs value={zeitansicht} onValueChange={v => setZeitansicht(v as IaZeitansicht)}>
            <TabsList className="h-8">
              <TabsTrigger value="monatlich" className="text-xs px-3 h-6">Monatlich</TabsTrigger>
              <TabsTrigger value="gesamt" className="text-xs px-3 h-6">Gesamt</TabsTrigger>
            </TabsList>
          </Tabs>
        </div>
      </div>

      {model.error && (
        <div className="rounded-lg border border-destructive bg-destructive/10 p-4 text-sm text-destructive">
          {model.error}
        </div>
      )}

      {/* Diagramm: Obergruppen gestapelt */}
      <LangfristigeInvestitionsauswertungChart model={displayModel} zeitansicht={zeitansicht} />

      {/* Haupttabelle (Obergruppe → Untergruppe → Produkt + Gesamt) */}
      <LangfristigeInvestitionsauswertungMatrix model={displayModel} versionId={versionId} />
    </div>
  )
}

export default function LangfristigeInvestitionsauswertungPage() {
  const params = useParams()
  const versionId = typeof params.versionId === 'string' ? params.versionId : ''

  return (
    <LangfristigeVersionShell seitenTitel="Investitionsauswertung" fullWidth>
      <InvestitionsauswertungInhalt versionId={versionId} />
    </LangfristigeVersionShell>
  )
}
