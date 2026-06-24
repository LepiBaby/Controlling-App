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

interface KachelPlattform {
  sales_plattform_id: string
  marketingkosten_pct: number
  berechnungsart: string
  sum_ausgaben_eur: number
  sum_umsatz_netto_eur: number
}

interface Kachel {
  produkt_id: string
  hauptwert: number
  plattformen: KachelPlattform[]
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatPct(v: number): string {
  return v.toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

function berechnungsartLabel(art: string): string {
  if (art.startsWith('mittelwert_')) return `Ø ${art.replace('mittelwert_', '')}T`
  if (art.startsWith('gewichtet_')) return `Gew. ${art.replace('gewichtet_', '')}T`
  return art
}

// ─── Component ────────────────────────────────────────────────────────────────

export function MarketingplanungKacheln() {
  const [kacheln, setKacheln] = useState<Kachel[]>([])
  const [produktNames, setProduktNames] = useState<Map<string, string>>(new Map())
  const [plattformNames, setPlattformNames] = useState<Map<string, string>>(new Map())
  const [loading, setLoading] = useState(true)
  const [expandedCards, setExpandedCards] = useState<Set<string>>(new Set())

  useEffect(() => {
    Promise.all([
      fetch('/api/marketing-planung/historisch').then(r => (r.ok ? r.json() : [])),
      fetch('/api/kpi-categories?type=produkte').then(r => (r.ok ? r.json() : [])),
      fetch('/api/kpi-categories?type=sales_plattformen').then(r => (r.ok ? r.json() : [])),
    ])
      .then(([histRaw, prodRaw, plattRaw]) => {
        const histData = (Array.isArray(histRaw) ? histRaw : []) as {
          produkt_id: string
          sales_plattform_id: string
          marketingkosten_pct: number
          sum_ausgaben_eur: number
          sum_umsatz_netto_eur: number
        }[]
        const allProdukte = (Array.isArray(prodRaw) ? prodRaw : []) as {
          id: string
          name: string
          level: number
        }[]
        const plattformen = (Array.isArray(plattRaw) ? plattRaw : []) as {
          id: string
          name: string
        }[]

        const produkte = allProdukte.filter(p => p.level === 1)

        const pnMap = new Map<string, string>()
        for (const p of produkte) pnMap.set(p.id, p.name)
        setProduktNames(pnMap)

        const plMap = new Map<string, string>()
        for (const p of plattformen) plMap.set(p.id, p.name)
        setPlattformNames(plMap)

        return Promise.all(
          plattformen.map(plt =>
            fetch(`/api/marketing-einstellungen?plattform_id=${plt.id}`).then(r =>
              r.ok ? r.json() : [],
            ),
          ),
        ).then(einstellArrays => {
          // Build berechnungsart map: "plattformId:produktId" → berechnungsart
          const artMap = new Map<string, string>()
          for (const list of einstellArrays) {
            for (const e of Array.isArray(list) ? list : (list?.data ?? [])) {
              if (e.berechnungsart && e.berechnungsart !== 'keine') {
                artMap.set(`${e.sales_plattform_id}:${e.produkt_id}`, e.berechnungsart)
              }
            }
          }

          // Group historisch data by produkt
          const byProdukt = new Map<string, KachelPlattform[]>()
          for (const h of histData) {
            const art = artMap.get(`${h.sales_plattform_id}:${h.produkt_id}`)
            if (!art) continue
            if (!byProdukt.has(h.produkt_id)) byProdukt.set(h.produkt_id, [])
            byProdukt.get(h.produkt_id)!.push({
              sales_plattform_id: h.sales_plattform_id,
              marketingkosten_pct: h.marketingkosten_pct,
              berechnungsart: art,
              sum_ausgaben_eur: h.sum_ausgaben_eur,
              sum_umsatz_netto_eur: h.sum_umsatz_netto_eur,
            })
          }

          // Build sorted kacheln
          // hauptwert = Σ(Marketingkosten €) / Σ(Netto-Umsatz €) × 100 — plattformübergreifend
          const produktOrder = produkte.map(p => p.id)
          const built: Kachel[] = []
          for (const [produktId, plattformenList] of byProdukt.entries()) {
            if (plattformenList.length === 0) continue
            const totalAusg  = plattformenList.reduce((s, p) => s + p.sum_ausgaben_eur, 0)
            const totalUmsatz = plattformenList.reduce((s, p) => s + p.sum_umsatz_netto_eur, 0)
            const hauptwert = totalUmsatz > 0
              ? Math.round((totalAusg / totalUmsatz) * 100 * 100) / 100
              : 0
            built.push({
              produkt_id: produktId,
              hauptwert,
              plattformen: plattformenList,
            })
          }
          built.sort(
            (a, b) =>
              produktOrder.indexOf(a.produkt_id) - produktOrder.indexOf(b.produkt_id),
          )
          setKacheln(built)
          setLoading(false)
        })
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
          <Skeleton key={i} className="h-36 w-full rounded-lg" />
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
          const hasMultiplePlattformen = k.plattformen.length > 1

          // Unique berechnungsarten → platform names for badges
          const artToPlattformen = new Map<string, string[]>()
          for (const plt of k.plattformen) {
            if (!artToPlattformen.has(plt.berechnungsart))
              artToPlattformen.set(plt.berechnungsart, [])
            artToPlattformen
              .get(plt.berechnungsart)!
              .push(plattformNames.get(plt.sales_plattform_id) ?? plt.sales_plattform_id)
          }
          const hasMultipleMethods = artToPlattformen.size > 1

          return (
            <Card key={k.produkt_id}>
              <CardHeader className="pb-1 pt-4 px-4">
                <div className="flex items-start justify-between gap-2">
                  <CardTitle
                    className="text-sm font-medium text-muted-foreground truncate"
                    title={produktName}
                  >
                    {produktName}
                  </CardTitle>
                  <div className="flex items-center gap-1 shrink-0 flex-wrap justify-end">
                    {Array.from(artToPlattformen.entries()).map(([art, plattNamen]) => (
                      <Tooltip key={art}>
                        <TooltipTrigger asChild>
                          <Badge
                            variant="secondary"
                            className="text-[10px] px-1.5 py-0 cursor-default"
                          >
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
                {/* Main value */}
                <div className="text-center py-1">
                  <div className="text-3xl font-bold tabular-nums leading-tight">
                    {formatPct(k.hauptwert)}&thinsp;%
                  </div>
                  {hasMultiplePlattformen && (
                    <div className="text-xs text-muted-foreground mt-0.5">
                      Ø aller Sales Channels
                    </div>
                  )}
                  {!hasMultiplePlattformen && (
                    <div className="text-xs text-muted-foreground mt-0.5">
                      {plattformNames.get(k.plattformen[0].sales_plattform_id) ??
                        k.plattformen[0].sales_plattform_id}
                    </div>
                  )}
                </div>

                {/* Sales channel breakdown — only when multiple platforms */}
                {hasMultiplePlattformen && (
                  <div className="border-t pt-2">
                    <button
                      type="button"
                      className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground w-full"
                      onClick={() => toggleCard(k.produkt_id)}
                    >
                      {isExpanded ? (
                        <ChevronDown className="h-3 w-3 shrink-0" />
                      ) : (
                        <ChevronRight className="h-3 w-3 shrink-0" />
                      )}
                      Nach Sales Channel
                    </button>

                    {isExpanded && (
                      <div className="mt-2 space-y-1.5">
                        {k.plattformen.map(p => (
                          <div
                            key={p.sales_plattform_id}
                            className="flex justify-between items-baseline text-xs"
                          >
                            <div className="flex items-center gap-1.5 min-w-0">
                              <span className="font-medium truncate">
                                {plattformNames.get(p.sales_plattform_id) ??
                                  p.sales_plattform_id}
                              </span>
                              {hasMultipleMethods && (
                                <Badge
                                  variant="outline"
                                  className="text-[9px] px-1 py-0 shrink-0 font-normal"
                                >
                                  {berechnungsartLabel(p.berechnungsart)}
                                </Badge>
                              )}
                            </div>
                            <span className="tabular-nums font-medium shrink-0 ml-1">
                              {formatPct(p.marketingkosten_pct)}&thinsp;%
                            </span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>
          )
        })}
      </div>
    </TooltipProvider>
  )
}
