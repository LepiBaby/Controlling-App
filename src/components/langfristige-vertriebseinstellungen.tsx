'use client'

import { useMemo } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Button } from '@/components/ui/button'
import { useLangfristigeKpiKategorien } from '@/hooks/use-langfristige-kpi-kategorien'
import { LangfristigeVersandEinstellungenTabelle } from '@/components/langfristige-versand-einstellungen-tabelle'
import { LangfristigeLagerEinstellungenTabelle } from '@/components/langfristige-lager-einstellungen-tabelle'
import { LangfristigeRetourenEinstellungenTabelle } from '@/components/langfristige-retouren-einstellungen-tabelle'
import { LangfristigeErsatzteileKulanzEinstellungenTabelle } from '@/components/langfristige-ersatzteile-kulanz-einstellungen-tabelle'

// PROJ-78: Versionsgebundene Vertriebseinstellungen (Langfristige Planung).
// Produkte und Sales Plattformen stammen aus dem KPI-Modell DIESER Planversion.
// Versand/Lager/Ersatzteile nutzen die „zentrale Plattform" (erste Plattform nach
// Sortierung); Retouren hat „Allgemein" + je Plattform einen Reiter.

function Hinweis({ versionId, text }: { versionId: string; text: string }) {
  return (
    <div className="rounded-lg border bg-muted/30 p-8 text-center space-y-3">
      <p className="font-medium">Noch nicht vollständig konfiguriert</p>
      <p className="text-sm text-muted-foreground">{text}</p>
      <Link href={`/dashboard/langfristige-planung/${versionId}/kpi-modell-verwaltung`}>
        <Button variant="outline" size="sm" className="mt-2">
          Zur KPI-Modell Verwaltung
        </Button>
      </Link>
    </div>
  )
}

export function LangfristigeVertriebseinstellungen() {
  const params = useParams()
  const versionId = typeof params.versionId === 'string' ? params.versionId : ''

  const { categories: plattformen, loading: plattformenLoading } =
    useLangfristigeKpiKategorien(versionId, 'lp_sales_plattform')
  const { categories: produkte, loading: produkteLoading } =
    useLangfristigeKpiKategorien(versionId, 'lp_produkt')

  const sortedPlattformen = useMemo(
    () => plattformen.filter(p => p.level === 1).sort((a, b) => a.sort_order - b.sort_order),
    [plattformen],
  )

  const sortedProdukte = useMemo(
    () => produkte.filter(p => p.level === 1).sort((a, b) => a.sort_order - b.sort_order),
    [produkte],
  )

  const zentralePlattformId = sortedPlattformen[0]?.id ?? null

  if (plattformenLoading || produkteLoading) {
    return <div className="py-8 text-center text-sm text-muted-foreground">Laden…</div>
  }

  const keineProdukte = sortedProdukte.length === 0
  const keinePlattform = zentralePlattformId === null

  // Für Versand/Lager/Ersatzteile wird eine zentrale Plattform + Produkte benötigt.
  function produktReiterInhalt(
    tabelle: (plattformId: string) => React.ReactNode,
  ): React.ReactNode {
    if (keinePlattform) {
      return (
        <Hinweis
          versionId={versionId}
          text="Bitte zuerst in der KPI-Modell Verwaltung dieser Planversion eine Sales Plattform anlegen."
        />
      )
    }
    if (keineProdukte) {
      return (
        <Hinweis
          versionId={versionId}
          text="Bitte zuerst in der KPI-Modell Verwaltung dieser Planversion Produkte anlegen."
        />
      )
    }
    return tabelle(zentralePlattformId!)
  }

  return (
    <Tabs defaultValue="versand" className="space-y-6">
      <TabsList className="w-full h-auto flex-wrap">
        <TabsTrigger value="versand" className="flex-1">
          Versand-Einstellungen
        </TabsTrigger>
        <TabsTrigger value="lager" className="flex-1">
          Lager-Einstellungen
        </TabsTrigger>
        <TabsTrigger value="retouren" className="flex-1">
          Retoureneinstellungen
        </TabsTrigger>
        <TabsTrigger value="ersatzteile" className="flex-1">
          Ersatzteile/Kulanz-Einstellungen
        </TabsTrigger>
      </TabsList>

      <TabsContent value="versand" className="mt-0">
        {produktReiterInhalt(plattformId => (
          <LangfristigeVersandEinstellungenTabelle
            versionId={versionId}
            plattformId={plattformId}
            produkte={sortedProdukte}
          />
        ))}
      </TabsContent>

      <TabsContent value="lager" className="mt-0">
        {produktReiterInhalt(plattformId => (
          <LangfristigeLagerEinstellungenTabelle
            versionId={versionId}
            plattformId={plattformId}
            produkte={sortedProdukte}
          />
        ))}
      </TabsContent>

      <TabsContent value="retouren" className="mt-0">
        {keineProdukte ? (
          <Hinweis
            versionId={versionId}
            text="Bitte zuerst in der KPI-Modell Verwaltung dieser Planversion Produkte anlegen."
          />
        ) : (
          <LangfristigeRetourenEinstellungenTabelle
            versionId={versionId}
            plattformen={sortedPlattformen}
            produkte={sortedProdukte}
          />
        )}
      </TabsContent>

      <TabsContent value="ersatzteile" className="mt-0">
        {produktReiterInhalt(plattformId => (
          <LangfristigeErsatzteileKulanzEinstellungenTabelle
            versionId={versionId}
            plattformId={plattformId}
            produkte={sortedProdukte}
          />
        ))}
      </TabsContent>
    </Tabs>
  )
}
