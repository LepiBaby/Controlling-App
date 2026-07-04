'use client'

import { useState, useMemo } from 'react'
import { useParams } from 'next/navigation'
import { Label } from '@/components/ui/label'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { MultiSelect } from '@/components/multi-select'
import { LangfristigeVersionShell } from '@/components/langfristige-version-shell'
import { LangfristigeRentabilitaetsauswertungMatrix } from '@/components/langfristige-rentabilitaetsauswertung-matrix'
import { LangfristigeRentabilitaetsauswertungChart } from '@/components/langfristige-rentabilitaetsauswertung-chart'
import { LangfristigeRentabilitaetsauswertungAbsatztabelle } from '@/components/langfristige-rentabilitaetsauswertung-absatztabelle'
import {
  useLangfristigeRentabilitaetsauswertung,
  applyZeitbasis,
  applyProduktFilter,
  collectProdukte,
  DB3_CASCADE,
  DB3_DEFAULT_CHART_IDS,
  type RaAnzeigemodus,
  type RaZeitbasis,
} from '@/hooks/use-langfristige-rentabilitaetsauswertung'

// PROJ-106: Deckungsbeitragsauswertung — 1:1 wie die Rentabilitätsauswertung (PROJ-95),
// aber nur bis DB III (Kaskade abgeschnitten) und mit zusätzlichem Produktfilter.
// Datenquelle, Hook und alle Anzeige-Bausteine werden geteilt; die Unterschiede sind
// rein clientseitig (Kaskaden-Cutoff über DB3_CASCADE, Produktfilter über applyProduktFilter).
function DeckungsbeitragsauswertungInhalt({ versionId }: { versionId: string }) {
  const model = useLangfristigeRentabilitaetsauswertung(versionId)
  const [anzeigemodus, setAnzeigemodus] = useState<RaAnzeigemodus>('absolut')
  const [zeitbasis, setZeitbasis] = useState<RaZeitbasis>('monat')
  const [selectedIds, setSelectedIds] = useState<string[]>(DB3_DEFAULT_CHART_IDS)
  const [selectedProdukte, setSelectedProdukte] = useState<string[]>([])

  const produktOptionen = useMemo(() => collectProdukte(model), [model])
  const filteredModel = useMemo(() => applyProduktFilter(model, selectedProdukte), [model, selectedProdukte])
  const displayModel = useMemo(() => applyZeitbasis(filteredModel, zeitbasis), [filteredModel, zeitbasis])

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
        <div className="space-y-1.5">
          <Label className="text-xs">Produkte</Label>
          <MultiSelect
            options={produktOptionen.map(p => ({ id: p.id, name: p.label }))}
            selected={selectedProdukte}
            onChange={setSelectedProdukte}
            placeholder="Alle Produkte"
            className="w-52"
          />
        </div>
        {selectedProdukte.length > 0 && (
          <button
            onClick={() => setSelectedProdukte([])}
            className="h-8 text-xs text-muted-foreground hover:text-foreground underline underline-offset-2"
          >
            Filter zurücksetzen ({selectedProdukte.length})
          </button>
        )}
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
        cascade={DB3_CASCADE}
        title="Deckungsbeitrags-Trend"
      />

      {/* Absatztabelle */}
      <LangfristigeRentabilitaetsauswertungAbsatztabelle model={displayModel} />

      {/* Haupttabelle (Deckungsbeitrags-Kaskade bis DB III) */}
      <LangfristigeRentabilitaetsauswertungMatrix
        model={displayModel}
        anzeigemodus={anzeigemodus}
        cascade={DB3_CASCADE}
      />
    </div>
  )
}

export default function LangfristigeDeckungsbeitragsauswertungPage() {
  const params = useParams()
  const versionId = typeof params.versionId === 'string' ? params.versionId : ''

  return (
    <LangfristigeVersionShell seitenTitel="Deckungsbeitragsauswertung" fullWidth>
      <DeckungsbeitragsauswertungInhalt versionId={versionId} />
    </LangfristigeVersionShell>
  )
}
