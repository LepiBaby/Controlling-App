'use client'

import { useState } from 'react'
import { AlertTriangle, ChevronRight, ChevronDown } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Progress } from '@/components/ui/progress'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible'
import type { Bestellung } from '@/hooks/use-bestellungen'
import type { NeuePlanbestellung } from '@/hooks/use-planbestelllauf'
import type { KonsolidierungsBestellungErgebnis } from '@/lib/konsolidierungs-algorithmus'

// ─── Types ────────────────────────────────────────────────────────────────────

/** Unified view — represents either a saved plan order or a neue (unsaved) plan order */
export interface KarteData {
  id: string // bestellung_id or temp_id
  isTemp: boolean
  produktNamen: string[]
  herkunft: 'algorithmus' | 'manuell' | null
  herstellerId: string | null
  herstellerName: string | null
  bestelldatum: string | null
  produktionsendeDatum: string | null
  shippingdatum: string | null
  verfuegbarkeitsdatum: string | null
  gesamtmenge: number
  anzahl_40hq: number
  anzahl_20dc: number
  container_anteil: Record<string, number> | null
  konsolidierungsgruppe_id: string | null
  konsolidierungspartner: Array<{ bestellung_id: string; produkt_namen: string[] }>
  stueckvolumen_m3: number | null
  volumen_m3: number
  volumen_moq_m3: number
  // Merged from Konsolidierungsergebnis when consolidation has been applied in UI
  konsolidierungsErgebnis?: KonsolidierungsBestellungErgebnis | null
  // Only set for saved orders
  bestellungData?: Bestellung | null
  // Only set for temp (neue) orders
  neueBestellungData?: NeuePlanbestellung | null
}

// ─── Container utilization display ───────────────────────────────────────────

function ContainerAuslastung({
  volumen_m3,
  volumen_20dc_m3,
  volumen_40hq_m3,
  label,
}: {
  volumen_m3: number
  volumen_20dc_m3: number | null
  volumen_40hq_m3: number | null
  label?: string
}) {
  if (volumen_20dc_m3 == null || volumen_40hq_m3 == null || volumen_20dc_m3 <= 0 || volumen_40hq_m3 <= 0) {
    return (
      <div className="text-xs text-muted-foreground opacity-60">Volumen unbekannt</div>
    )
  }

  if (volumen_m3 <= 0) {
    return <div className="text-xs text-muted-foreground">0 m³</div>
  }

  const volle_40hq = Math.floor(volumen_m3 / volumen_40hq_m3)
  const rest_m3 = volumen_m3 - volle_40hq * volumen_40hq_m3

  const bars: React.ReactNode[] = []

  for (let i = 0; i < volle_40hq; i++) {
    bars.push(
      <div key={`hq-${i}`} className="flex items-center gap-1.5">
        <Progress value={100} className="h-2 flex-1" />
        <span className="text-xs text-muted-foreground w-20 shrink-0">100% (40HQ)</span>
      </div>
    )
  }

  if (rest_m3 > 0 || volle_40hq === 0) {
    if (rest_m3 < volumen_20dc_m3) {
      const pct = Math.round((rest_m3 / volumen_20dc_m3) * 100)
      bars.push(
        <div key="rest" className="flex items-center gap-1.5">
          <Progress value={pct} className="h-2 flex-1" />
          <span className="text-xs text-muted-foreground w-20 shrink-0">{pct}% (20DC)</span>
        </div>
      )
    } else {
      const pct = Math.round((rest_m3 / volumen_40hq_m3) * 100)
      bars.push(
        <div key="rest" className="flex items-center gap-1.5">
          <Progress value={Math.min(pct, 100)} className="h-2 flex-1" />
          <span className="text-xs text-muted-foreground w-20 shrink-0">{pct}% (40HQ)</span>
        </div>
      )
    }
  }

  return (
    <div className="space-y-1">
      {label && <p className="text-xs text-muted-foreground/70 italic">{label}</p>}
      {bars}
    </div>
  )
}

// ─── Container-Badge ──────────────────────────────────────────────────────────

function ContainerBadge({ karte }: { karte: KarteData }) {
  const anteil = karte.konsolidierungsErgebnis?.container_anteil ?? karte.container_anteil

  if (anteil && Object.keys(anteil).length > 0) {
    const parts = Object.entries(anteil)
      .filter(([, v]) => v > 0)
      .map(([art, v]) => {
        const rounded = Math.round(v * 10) / 10
        return `${rounded % 1 === 0 ? rounded : rounded.toFixed(1)}× ${art}`
      })
      .join(' + ')
    if (parts) return <Badge variant="outline" className="text-xs font-mono shrink-0">{parts}</Badge>
  }

  const hq = karte.anzahl_40hq ?? 0
  const dc = karte.anzahl_20dc ?? 0
  if (hq === 0 && dc === 0) return null
  const parts = [hq > 0 && `${hq}× 40HQ`, dc > 0 && `${dc}× 20DC`].filter(Boolean).join(' + ')
  return <Badge variant="outline" className="text-xs font-mono shrink-0">{parts}</Badge>
}

// ─── Inline detail content ────────────────────────────────────────────────────

function DetailInhalt({ karte }: { karte: KarteData }) {
  const skuMengen = karte.bestellungData?.sku_mengen ?? karte.neueBestellungData?.sku_mengen ?? []
  const warnungen = karte.neueBestellungData?.warnungen ?? []
  const notizen = karte.bestellungData?.notizen ?? null

  if (skuMengen.length === 0 && warnungen.length === 0 && !notizen) return null

  return (
    <div className="border-t px-3 pb-3 pt-2 bg-muted/10 space-y-2">
      {skuMengen.length > 0 && (
        <div className="space-y-1">
          {skuMengen.map(s => (
            <div key={s.sku_id} className="flex items-center justify-between text-xs">
              <span className="text-muted-foreground truncate">{s.sku_name}</span>
              <div className="flex items-center gap-3 shrink-0 ml-2 tabular-nums">
                {s.menge_nach_moq != null && (
                  <span className="text-muted-foreground">MOQ: {s.menge_nach_moq.toLocaleString('de-DE')}</span>
                )}
                <span className="font-medium">{s.menge_praktisch.toLocaleString('de-DE')} Stk.</span>
              </div>
            </div>
          ))}
        </div>
      )}

      {notizen && (
        <p className="text-xs text-muted-foreground italic">{notizen}</p>
      )}

      {warnungen.length > 0 && (
        <div className="space-y-0.5">
          {warnungen.map((w, i) => (
            <p key={i} className="text-xs text-amber-600 flex items-start gap-1">
              <AlertTriangle className="h-3 w-3 mt-0.5 shrink-0" />
              {w}
            </p>
          ))}
        </div>
      )}
    </div>
  )
}

// ─── Karte ────────────────────────────────────────────────────────────────────

interface KonsolidierungsKarteProps {
  karte: KarteData
  ausgewaehlt: boolean
  onToggle: () => void
  volumen_20dc_m3: number | null
  volumen_40hq_m3: number | null
  isInGruppe?: boolean
  gruppefarbe?: string
}

export function KonsolidierungsKarte({
  karte,
  ausgewaehlt,
  onToggle,
  volumen_20dc_m3,
  volumen_40hq_m3,
  isInGruppe = false,
  gruppefarbe,
}: KonsolidierungsKarteProps) {
  const [expanded, setExpanded] = useState(false)

  const fmt = (d: string | null) => {
    if (!d) return '—'
    const [y, m, day] = d.split('-')
    return `${day}.${m}.${y}`
  }

  const hatVorherige = karte.konsolidierungspartner.length > 0
  const hatDetails = (karte.bestellungData?.sku_mengen.length ?? 0) > 0
    || (karte.neueBestellungData?.sku_mengen.length ?? 0) > 0
    || !!karte.bestellungData?.notizen
    || (karte.neueBestellungData?.warnungen.length ?? 0) > 0

  const borderClass = isInGruppe && gruppefarbe
    ? `border-l-4 ${gruppefarbe}`
    : ''

  return (
    <Collapsible open={expanded} onOpenChange={setExpanded}>
      <div className={`rounded-md border bg-card transition-colors ${borderClass}`}>
        <div className="p-3 space-y-2">
          {/* Header row */}
          <div className="flex items-start gap-2">
            <div className="flex items-center gap-1.5 shrink-0" onClick={(e) => e.stopPropagation()}>
              <Checkbox
                checked={ausgewaehlt}
                onCheckedChange={onToggle}
                aria-label="Bestellung für Konsolidierung wählen"
              />
              {hatVorherige && (
                <TooltipProvider delayDuration={200}>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <span className="text-amber-500 cursor-default text-xs font-bold leading-none">!</span>
                    </TooltipTrigger>
                    <TooltipContent side="top" className="max-w-xs text-xs">
                      <p className="font-medium mb-1">War konsolidiert mit:</p>
                      {karte.konsolidierungspartner.map((p, i) => (
                        <p key={i}>{p.produkt_namen.join(', ')}</p>
                      ))}
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              )}
            </div>

            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-1.5 flex-wrap">
                <span className="text-sm font-medium truncate">{karte.produktNamen.join(', ')}</span>
                <Badge variant="secondary" className="text-xs tabular-nums shrink-0">
                  {karte.gesamtmenge.toLocaleString('de-DE')} Stk.
                </Badge>
                <ContainerBadge karte={karte} />
                {karte.herkunft === 'manuell' && (
                  <Badge variant="outline" className="text-xs shrink-0">Erstbestellung</Badge>
                )}
              </div>

              {/* Dates */}
              <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs text-muted-foreground">
                {karte.bestelldatum && (
                  <span>Bestellt: <span className="text-foreground">{fmt(karte.bestelldatum)}</span></span>
                )}
                {karte.produktionsendeDatum && (
                  <span className="inline-flex items-center gap-1 text-primary font-semibold">
                    Prod.ende:
                    <Badge className="text-xs h-5 px-1.5 rounded font-bold">
                      {fmt(karte.produktionsendeDatum)}
                    </Badge>
                  </span>
                )}
                {karte.shippingdatum && (
                  <span>Versand: <span className="text-foreground">{fmt(karte.shippingdatum)}</span></span>
                )}
                {karte.verfuegbarkeitsdatum && (
                  <span>Verfügbar: <span className="text-foreground">{fmt(karte.verfuegbarkeitsdatum)}</span></span>
                )}
                {!karte.produktionsendeDatum && (
                  <span className="flex items-center gap-1 text-amber-600">
                    <AlertTriangle className="h-3 w-3" />
                    Prod.ende fehlt
                  </span>
                )}
              </div>
            </div>

            {hatDetails && (
              <CollapsibleTrigger asChild>
                <Button variant="ghost" size="sm" className="h-7 w-7 p-0 shrink-0">
                  {expanded
                    ? <ChevronDown className="h-4 w-4" />
                    : <ChevronRight className="h-4 w-4" />
                  }
                </Button>
              </CollapsibleTrigger>
            )}
          </div>

          {/* Container utilization (MOQ-based) */}
          <div className="pl-6">
            <ContainerAuslastung
              volumen_m3={karte.volumen_moq_m3}
              volumen_20dc_m3={volumen_20dc_m3}
              volumen_40hq_m3={volumen_40hq_m3}
              label="Containerverteilung nach MOQ-Menge"
            />
          </div>
        </div>

        <CollapsibleContent>
          <DetailInhalt karte={karte} />
        </CollapsibleContent>
      </div>
    </Collapsible>
  )
}
