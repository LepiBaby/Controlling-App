'use client'

import { useState, useEffect } from 'react'
import { ChevronDown, ChevronRight } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { Badge } from '@/components/ui/badge'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'

// ─── Types ────────────────────────────────────────────────────────────────────

interface KachelSku {
  sku_id: string
  tagesdurchschnitt: number
}

interface KachelPlattform {
  sales_plattform_id: string
  hauptwert: number
  berechnungsart: string
  skus: KachelSku[]
}

interface Kachel {
  produkt_id: string
  hauptwert: number
  skus: KachelSku[]
  plattformen: KachelPlattform[]
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatNum(v: number): string {
  return v.toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

function toWeekly(v: number): number {
  return Math.round(v * 7 * 100) / 100
}

function berechnungsartLabel(art: string): string {
  if (art.startsWith('mittelwert_')) return `Ø ${art.replace('mittelwert_', '')}T`
  if (art.startsWith('gewichtet_')) return `Gew. ${art.replace('gewichtet_', '')}T`
  return art
}

function shortSkuName(skuName: string, produktName: string): string {
  if (skuName.startsWith(produktName + ' ')) return skuName.slice(produktName.length + 1)
  return skuName
}

// ─── Component ────────────────────────────────────────────────────────────────

export function AbsatzplanungKacheln() {
  const [kacheln, setKacheln] = useState<Kachel[]>([])
  const [skuNames, setSkuNames] = useState<Map<string, string>>(new Map())
  const [produktNames, setProduktNames] = useState<Map<string, string>>(new Map())
  const [plattformNames, setPlattformNames] = useState<Map<string, string>>(new Map())
  const [loading, setLoading] = useState(true)
  const [expandedCards, setExpandedCards] = useState<Set<string>>(new Set())

  useEffect(() => {
    Promise.all([
      fetch('/api/absatz-planung/kacheln').then(r => (r.ok ? r.json() : { data: [] })),
      fetch('/api/kpi-categories?type=produkte').then(r => (r.ok ? r.json() : [])),
      fetch('/api/kpi-categories?type=sales_plattformen').then(r => (r.ok ? r.json() : [])),
    ])
      .then(([kachelData, produkte, plattformen]) => {
        const allProdukte = Array.isArray(produkte) ? produkte : []

        const produktOrder: string[] = allProdukte
          .filter((p: { level: number }) => p.level === 1)
          .map((p: { id: string }) => p.id)
        const sorted = [...(kachelData?.data ?? [])].sort(
          (a: Kachel, b: Kachel) => produktOrder.indexOf(a.produkt_id) - produktOrder.indexOf(b.produkt_id),
        )
        setKacheln(sorted)

        const pnMap = new Map<string, string>()
        const snMap = new Map<string, string>()
        for (const p of allProdukte) {
          if (p.level === 1) pnMap.set(p.id, p.name)
          if (p.level === 2) snMap.set(p.id, p.name)
        }
        setProduktNames(pnMap)
        setSkuNames(snMap)

        const plMap = new Map<string, string>()
        for (const p of Array.isArray(plattformen) ? plattformen : []) {
          plMap.set(p.id, p.name)
        }
        setPlattformNames(plMap)
        setLoading(false)
      })
      .catch(() => setLoading(false))
  }, [])

  function toggleCard(produktId: string) {
    setExpandedCards(prev => {
      const next = new Set(prev)
      if (next.has(produktId)) next.delete(produktId)
      else next.add(produktId)
      return next
    })
  }

  if (loading) {
    return (
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-44 w-full rounded-lg" />
        ))}
      </div>
    )
  }

  if (kacheln.length === 0) return null

  return (
    <TooltipProvider delayDuration={200}>
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
        {kacheln.map(k => {
          const isExpanded = expandedCards.has(k.produkt_id)
          const produktName = produktNames.get(k.produkt_id) ?? k.produkt_id

          // Build: unique berechnungsart → plattform names for header badges
          const artToPlattformen = new Map<string, string[]>()
          for (const plt of k.plattformen) {
            if (!artToPlattformen.has(plt.berechnungsart)) artToPlattformen.set(plt.berechnungsart, [])
            artToPlattformen.get(plt.berechnungsart)!.push(
              plattformNames.get(plt.sales_plattform_id) ?? plt.sales_plattform_id,
            )
          }
          const hasMultipleMethods = artToPlattformen.size > 1

          return (
            <Card key={k.produkt_id}>
              <CardHeader className="pb-1 pt-4 px-4">
                <div className="flex items-start justify-between gap-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground truncate" title={produktName}>
                    {produktName}
                  </CardTitle>
                  <div className="flex items-center gap-1 shrink-0 flex-wrap justify-end">
                    {Array.from(artToPlattformen.entries()).map(([art, plattNamen]) => (
                      <Tooltip key={art}>
                        <TooltipTrigger asChild>
                          <Badge variant="secondary" className="text-[10px] px-1.5 py-0 cursor-default">
                            {berechnungsartLabel(art)}
                          </Badge>
                        </TooltipTrigger>
                        <TooltipContent side="bottom">
                          <p className="text-xs">{plattNamen.join(', ')}</p>
                        </TooltipContent>
                      </Tooltip>
                    ))}
                  </div>
                </div>
              </CardHeader>

              <CardContent className="px-4 pb-4 space-y-3">
                {/* Main value — weekly + daily */}
                <div className="text-center py-1">
                  <div className="text-3xl font-bold tabular-nums leading-tight">
                    {formatNum(toWeekly(k.hauptwert))}
                  </div>
                  <div className="text-xs text-muted-foreground mt-0.5">/ Woche</div>
                  <div className="text-sm tabular-nums text-muted-foreground mt-1">
                    {formatNum(k.hauptwert)}
                    <span className="text-xs ml-1">/ Tag</span>
                  </div>
                </div>

                {/* SKU breakdown — horizontal grid */}
                {k.skus.length > 0 && (
                  <div
                    className="grid gap-0.5 text-center border-t pt-2.5"
                    style={{ gridTemplateColumns: `repeat(${k.skus.length}, minmax(0, 1fr))` }}
                  >
                    {k.skus.map(sku => (
                      <div key={sku.sku_id}>
                        <div className="text-[10px] text-muted-foreground truncate" title={skuNames.get(sku.sku_id)}>
                          {shortSkuName(skuNames.get(sku.sku_id) ?? sku.sku_id, produktName)}
                        </div>
                        <div className="text-xs tabular-nums font-medium mt-0.5">
                          {formatNum(toWeekly(sku.tagesdurchschnitt))}
                        </div>
                        <div className="text-[10px] tabular-nums text-muted-foreground">
                          {formatNum(sku.tagesdurchschnitt)}
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {/* Platform breakdown */}
                <div className="border-t pt-2">
                  <button
                    type="button"
                    className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground w-full"
                    onClick={() => toggleCard(k.produkt_id)}
                  >
                    {isExpanded
                      ? <ChevronDown className="h-3 w-3 shrink-0" />
                      : <ChevronRight className="h-3 w-3 shrink-0" />}
                    Nach Plattform
                  </button>

                  {isExpanded && (
                    <div className="mt-2 space-y-2.5">
                      {k.plattformen.map(p => (
                        <div key={p.sales_plattform_id}>
                          <div className="flex justify-between items-baseline text-xs mb-1">
                            <div className="flex items-center gap-1.5 min-w-0">
                              <span className="font-medium truncate">
                                {plattformNames.get(p.sales_plattform_id) ?? p.sales_plattform_id}
                              </span>
                              {hasMultipleMethods && (
                                <Badge variant="outline" className="text-[9px] px-1 py-0 shrink-0 font-normal">
                                  {berechnungsartLabel(p.berechnungsart)}
                                </Badge>
                              )}
                            </div>
                            <span className="tabular-nums font-medium shrink-0 ml-1">
                              {formatNum(toWeekly(p.hauptwert))}
                            </span>
                          </div>
                          {p.skus.length > 0 && (
                            <div
                              className="grid gap-0.5 text-center mt-1 pl-1"
                              style={{ gridTemplateColumns: `repeat(${p.skus.length}, minmax(0, 1fr))` }}
                            >
                              {p.skus.map(sku => (
                                <div key={sku.sku_id}>
                                  <div className="text-[9px] text-muted-foreground truncate" title={skuNames.get(sku.sku_id)}>
                                    {shortSkuName(skuNames.get(sku.sku_id) ?? sku.sku_id, produktName)}
                                  </div>
                                  <div className="text-[10px] tabular-nums font-medium">
                                    {formatNum(toWeekly(sku.tagesdurchschnitt))}
                                  </div>
                                  <div className="text-[9px] tabular-nums text-muted-foreground">
                                    {formatNum(sku.tagesdurchschnitt)}
                                  </div>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          )
        })}
      </div>
    </TooltipProvider>
  )
}
