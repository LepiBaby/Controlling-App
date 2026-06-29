'use client'

import { useState, useEffect } from 'react'
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

interface KachelProdukt {
  produkt_id: string
  marketingkosten_pct: number
  berechnungsart: string
  sum_ausgaben_eur: number
  sum_umsatz_netto_eur: number
}

interface Kachel {
  kategorie_id: string
  plattform_id: string | null
  hauptwert: number
  produkte: KachelProdukt[]
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
  const [kanalNames, setKanalNames] = useState<Map<string, string>>(new Map())
  const [plattformNames, setPlattformNames] = useState<Map<string, string>>(new Map())
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    Promise.all([
      fetch('/api/marketing-planung/historisch').then(r => (r.ok ? r.json() : [])),
      fetch('/api/kpi-categories?type=produkte').then(r => (r.ok ? r.json() : [])),
      fetch('/api/kpi-categories?type=ausgaben_kosten').then(r => (r.ok ? r.json() : [])),
      fetch('/api/kpi-categories?type=sales_plattformen').then(r => (r.ok ? r.json() : [])),
    ])
      .then(([histRaw, prodRaw, ausgabenRaw, plattRaw]) => {
        const histData = (Array.isArray(histRaw) ? histRaw : []) as {
          produkt_id: string
          kategorie_id: string
          marketingkosten_pct: number
          sum_ausgaben_eur: number
          sum_umsatz_netto_eur: number
        }[]
        const allProdukte = (Array.isArray(prodRaw) ? prodRaw : []) as {
          id: string
          name: string
          level: number
        }[]
        const ausgabenKats = (Array.isArray(ausgabenRaw) ? ausgabenRaw : []) as {
          id: string
          name: string
          level: number
          parent_id: string | null
        }[]
        const plattformen = (Array.isArray(plattRaw) ? plattRaw : []) as {
          id: string
          name: string
        }[]

        const produkte = allProdukte.filter(p => p.level === 1)

        // Marketingkanäle = level-2 Untergruppen der "Marketing" ausgaben_kosten-Kategorie
        const marketingParent = ausgabenKats.find(
          k => k.level === 1 && k.name.toLowerCase() === 'marketing',
        )
        const kanaele = marketingParent
          ? ausgabenKats.filter(k => k.level === 2 && k.parent_id === marketingParent.id)
          : []

        const pnMap = new Map<string, string>()
        for (const p of produkte) pnMap.set(p.id, p.name)
        setProduktNames(pnMap)

        const knMap = new Map<string, string>()
        for (const k of kanaele) knMap.set(k.id, k.name)
        setKanalNames(knMap)

        const plMap = new Map<string, string>()
        for (const p of plattformen) plMap.set(p.id, p.name)
        setPlattformNames(plMap)

        // Pro Kanal: Berechnungsarten je Produkt + zugeordnete Sales-Plattform laden
        return Promise.all(
          kanaele.map(k =>
            Promise.all([
              fetch(`/api/marketing-einstellungen?kategorie_id=${k.id}`).then(r =>
                r.ok ? r.json() : [],
              ),
              fetch(`/api/marketing-kategorie-einstellungen?kategorie_id=${k.id}`).then(r =>
                r.ok ? r.json() : null,
              ),
            ]),
          ),
        ).then(perKanal => {
          // berechnungsart map: "kategorieId:produktId" → berechnungsart
          const artMap = new Map<string, string>()
          // kanal → sales_plattform_id
          const plattformMap = new Map<string, string | null>()

          kanaele.forEach((k, i) => {
            const [einstRaw, katEinstRaw] = perKanal[i]
            const einstList = Array.isArray(einstRaw) ? einstRaw : (einstRaw?.data ?? [])
            for (const e of einstList) {
              if (e.berechnungsart && e.berechnungsart !== 'keine') {
                artMap.set(`${k.id}:${e.produkt_id}`, e.berechnungsart)
              }
            }
            plattformMap.set(k.id, katEinstRaw?.sales_plattform_id ?? null)
          })

          // Historisch-Zeilen nach Kanal gruppieren
          const byKanal = new Map<string, KachelProdukt[]>()
          for (const h of histData) {
            const art = artMap.get(`${h.kategorie_id}:${h.produkt_id}`)
            if (!art) continue
            if (!byKanal.has(h.kategorie_id)) byKanal.set(h.kategorie_id, [])
            byKanal.get(h.kategorie_id)!.push({
              produkt_id: h.produkt_id,
              marketingkosten_pct: h.marketingkosten_pct,
              berechnungsart: art,
              sum_ausgaben_eur: h.sum_ausgaben_eur,
              sum_umsatz_netto_eur: h.sum_umsatz_netto_eur,
            })
          }

          const produktOrder = produkte.map(p => p.id)
          const kanalOrder = kanaele.map(k => k.id)
          const built: Kachel[] = []
          for (const [kategorieId, produkteList] of byKanal.entries()) {
            if (produkteList.length === 0) continue
            produkteList.sort(
              (a, b) =>
                produktOrder.indexOf(a.produkt_id) - produktOrder.indexOf(b.produkt_id),
            )
            // hauptwert = Σ(Marketingkosten €) / Σ(Netto-Umsatz €) × 100 — produktübergreifend
            const totalAusg = produkteList.reduce((s, p) => s + p.sum_ausgaben_eur, 0)
            const totalUmsatz = produkteList.reduce((s, p) => s + p.sum_umsatz_netto_eur, 0)
            const hauptwert = totalUmsatz > 0
              ? Math.round((totalAusg / totalUmsatz) * 100 * 100) / 100
              : 0
            built.push({
              kategorie_id: kategorieId,
              plattform_id: plattformMap.get(kategorieId) ?? null,
              hauptwert,
              produkte: produkteList,
            })
          }
          built.sort(
            (a, b) =>
              kanalOrder.indexOf(a.kategorie_id) - kanalOrder.indexOf(b.kategorie_id),
          )
          setKacheln(built)
          setLoading(false)
        })
      })
      .catch(() => setLoading(false))
  }, [])

  if (loading) {
    return (
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-40 w-full rounded-lg" />
        ))}
      </div>
    )
  }

  if (kacheln.length === 0) return null

  return (
    <TooltipProvider delayDuration={200}>
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
        {kacheln.map(k => {
          const kanalName = kanalNames.get(k.kategorie_id) ?? k.kategorie_id
          const plattformName = k.plattform_id
            ? (plattformNames.get(k.plattform_id) ?? null)
            : null

          // Unique berechnungsarten → Produktnamen für Header-Badges
          const artToProdukte = new Map<string, string[]>()
          for (const prd of k.produkte) {
            if (!artToProdukte.has(prd.berechnungsart))
              artToProdukte.set(prd.berechnungsart, [])
            artToProdukte
              .get(prd.berechnungsart)!
              .push(produktNames.get(prd.produkt_id) ?? prd.produkt_id)
          }
          const hasMultipleMethods = artToProdukte.size > 1

          return (
            <Card key={k.kategorie_id}>
              <CardHeader className="pb-1 pt-4 px-4">
                <div className="flex items-start justify-between gap-2">
                  <CardTitle
                    className="text-sm font-medium text-muted-foreground truncate"
                    title={kanalName}
                  >
                    {kanalName}
                  </CardTitle>
                  <div className="flex items-center gap-1 shrink-0 flex-wrap justify-end">
                    {plattformName && (
                      <Badge
                        variant="outline"
                        className="text-[10px] px-1.5 py-0 font-normal"
                      >
                        {plattformName}
                      </Badge>
                    )}
                    {Array.from(artToProdukte.entries()).map(([art, prdNamen]) => (
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
                          <p className="text-xs">{prdNamen.join(', ')}</p>
                        </TooltipContent>
                      </Tooltip>
                    ))}
                  </div>
                </div>
              </CardHeader>

              <CardContent className="px-4 pb-4 space-y-3">
                {/* Hauptwert — aktueller % über alle Produkte */}
                <div className="text-center py-1">
                  <div className="text-3xl font-bold tabular-nums leading-tight">
                    {formatPct(k.hauptwert)}&thinsp;%
                  </div>
                  <div className="text-xs text-muted-foreground mt-0.5">
                    Ø aller Produkte
                  </div>
                </div>

                {/* Produkt-Aufschlüsselung */}
                {k.produkte.length > 0 && (
                  <div className="border-t pt-2 space-y-1.5">
                    {k.produkte.map(prd => (
                      <div
                        key={prd.produkt_id}
                        className="flex justify-between items-baseline text-xs"
                      >
                        <div className="flex items-center gap-1.5 min-w-0">
                          <span className="font-medium truncate">
                            {produktNames.get(prd.produkt_id) ?? prd.produkt_id}
                          </span>
                          {hasMultipleMethods && (
                            <Badge
                              variant="outline"
                              className="text-[9px] px-1 py-0 shrink-0 font-normal"
                            >
                              {berechnungsartLabel(prd.berechnungsart)}
                            </Badge>
                          )}
                        </div>
                        <span className="tabular-nums font-medium shrink-0 ml-1">
                          {formatPct(prd.marketingkosten_pct)}&thinsp;%
                        </span>
                      </div>
                    ))}
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
