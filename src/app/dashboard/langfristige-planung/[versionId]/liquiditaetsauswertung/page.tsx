'use client'

import { useState, useMemo } from 'react'
import { useParams } from 'next/navigation'
import { Label } from '@/components/ui/label'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { LangfristigeVersionShell } from '@/components/langfristige-version-shell'
import { LangfristigeLiquiditaetsauswertungTabelle } from '@/components/langfristige-liquiditaetsauswertung-tabelle'
import { LangfristigeLiquiditaetsauswertungChart } from '@/components/langfristige-liquiditaetsauswertung-chart'
import {
  useLangfristigeLiquiditaetsauswertung,
  applyZeitbasisLiq,
  type LiqZeitbasis,
} from '@/hooks/use-langfristige-liquiditaetsauswertung'

function LiquiditaetsauswertungInhalt({ versionId }: { versionId: string }) {
  const data = useLangfristigeLiquiditaetsauswertung(versionId)
  const [zeitbasis, setZeitbasis] = useState<LiqZeitbasis>('monat')

  const aggregiert = useMemo(
    () => applyZeitbasisLiq({ columns: data.columns, rows: data.rows, expandableKeys: data.expandableKeys }, zeitbasis),
    [data.columns, data.rows, data.expandableKeys, zeitbasis],
  )
  const displayData = { ...data, ...aggregiert }

  return (
    <div className="space-y-4">
      {/* Zeitbasis-Umschalter */}
      <div className="flex flex-wrap items-end gap-4">
        <div className="space-y-1.5">
          <Label className="text-xs">Zeitbasis</Label>
          <Tabs value={zeitbasis} onValueChange={v => setZeitbasis(v as LiqZeitbasis)}>
            <TabsList className="h-8">
              <TabsTrigger value="monat" className="text-xs px-3 h-6">Monat</TabsTrigger>
              <TabsTrigger value="jahr" className="text-xs px-3 h-6">Jahr</TabsTrigger>
            </TabsList>
          </Tabs>
        </div>
      </div>

      {!data.error && !data.isEmpty && (
        <LangfristigeLiquiditaetsauswertungChart columns={displayData.columns} rows={displayData.rows} loading={data.loading} />
      )}
      <LangfristigeLiquiditaetsauswertungTabelle data={displayData} />
    </div>
  )
}

export default function LangfristigeLiquiditaetsauswertungPage() {
  const params = useParams()
  const versionId = typeof params.versionId === 'string' ? params.versionId : ''

  return (
    <LangfristigeVersionShell seitenTitel="Liquiditätsauswertung" fullWidth>
      <LiquiditaetsauswertungInhalt versionId={versionId} />
    </LangfristigeVersionShell>
  )
}
