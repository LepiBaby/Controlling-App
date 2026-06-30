'use client'

import { useState } from 'react'
import { AlertTriangle, ChevronRight, ChevronDown } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Progress } from '@/components/ui/progress'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible'
import { perContainerMengen } from '@/hooks/use-produktinformationen-container'
import type { Bestellung, KonsolidierungsPartner } from '@/hooks/use-bestellungen'
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
  produktionsstartDatum: string | null
  produktionsendeDatum: string | null
  shippingdatum: string | null
  ankunftsdatum: string | null
  verfuegbarkeitsdatum: string | null
  gesamtmenge: number
  anzahl_40hq: number
  anzahl_20dc: number
  container_anteil: Record<string, number> | null
  konsolidierungsgruppe_id: string | null
  konsolidierungspartner: KonsolidierungsPartner[]
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
        const rounded = Math.round(v * 100) / 100
        return `${rounded % 1 === 0 ? rounded : rounded.toFixed(2)}× ${art}`
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

// ─── Inline detail content (matches AenderungItem layout exactly) ────────────

function DetailInhalt({ karte, volumen_20dc_m3, volumen_40hq_m3, onMengeChange }: {
  karte: KarteData
  volumen_20dc_m3: number | null
  volumen_40hq_m3: number | null
  onMengeChange?: (skuId: string, neueMenge: number) => void
}) {
  const b = karte.bestellungData
  const n = karte.neueBestellungData

  const fmt = (d: string | null | undefined) =>
    d ? new Date(d + 'T00:00:00').toLocaleDateString('de-DE') : '–'

  const warnungen = n?.warnungen ?? []
  const skuMengen = b?.sku_mengen ?? n?.sku_mengen ?? []
  const gesamtmenge = skuMengen.reduce((s, m) => s + m.menge_praktisch, 0)

  const bestelldatum         = karte.bestelldatum
  const produktionsstart     = karte.produktionsstartDatum
  const produktionsende      = karte.produktionsendeDatum
  const shippingdatum        = karte.shippingdatum
  const ankunftsdatum        = karte.ankunftsdatum
  const verfuegbarkeitsdatum = karte.verfuegbarkeitsdatum

  const hq = b?.anzahl_40hq ?? (n?.container?.filter(c => c === '40HQ').length ?? 0)
  const dc = b?.anzahl_20dc ?? (n?.container?.filter(c => c === '20DC').length ?? 0)

  return (
    <div className="border-t p-3 space-y-4 bg-muted/10">
      {warnungen.length > 0 && (
        <div className="space-y-1">
          {warnungen.map((w, i) => (
            <div key={i} className="flex items-start gap-2 text-xs text-amber-600 bg-amber-50 border border-amber-100 rounded px-2 py-1.5">
              <AlertTriangle className="h-3 w-3 mt-0.5 shrink-0" />
              <span>{w}</span>
            </div>
          ))}
        </div>
      )}

      <div>
        <p className="text-xs font-medium text-muted-foreground mb-2">Datumsfelder</p>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-x-4 gap-y-1.5 text-xs">
          {[
            { label: 'Bestelldatum',       value: bestelldatum },
            { label: 'Produktionsstart',   value: produktionsstart },
            { label: 'Produktionsende',    value: produktionsende },
            { label: 'Shippingdatum',      value: shippingdatum },
            { label: 'Ankunftsdatum',      value: ankunftsdatum },
            { label: 'Verfügbarkeitsdatum', value: verfuegbarkeitsdatum },
          ].map(({ label, value }) => (
            <div key={label}>
              <p className="text-muted-foreground">{label}</p>
              <p className="font-medium">{fmt(value)}</p>
            </div>
          ))}
        </div>
      </div>

      {skuMengen.length > 0 && (
        <div>
          <p className="text-xs font-medium text-muted-foreground mb-2">Bestellmengen je SKU</p>
          <div className="rounded-md border overflow-hidden">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b bg-muted/40">
                  <th className="px-2 py-1.5 text-left font-medium text-muted-foreground">SKU</th>
                  <th className="px-2 py-1.5 text-right font-medium text-muted-foreground">Theoretisch</th>
                  <th className="px-2 py-1.5 text-right font-medium text-muted-foreground">Nach MOQ</th>
                  <th className="px-2 py-1.5 text-right font-medium text-muted-foreground">Praktisch</th>
                  {karte.konsolidierungsErgebnis && (
                    <th className="px-2 py-1.5 text-right font-medium text-blue-600">Konsolidierung</th>
                  )}
                  <th className="px-2 py-1.5 text-left font-medium text-muted-foreground">Begründung</th>
                </tr>
              </thead>
              <tbody>
                {skuMengen.map(s => {
                  const konsMenge = karte.konsolidierungsErgebnis?.neue_sku_mengen.find(e => e.sku_id === s.sku_id)?.neue_menge_praktisch
                  return (
                    <tr key={s.sku_id} className={`border-b last:border-0 ${s.menge_praktisch === 0 ? 'opacity-50' : ''}`}>
                      <td className="px-2 py-1.5">
                        <div>{s.sku_name ?? s.sku_id}</div>
                        {s.is_trigger && <div className="text-[10px] text-blue-500 leading-tight">Trigger-SKU</div>}
                      </td>
                      <td className="px-2 py-1.5 text-right tabular-nums text-muted-foreground">
                        {s.menge_theoretisch != null ? s.menge_theoretisch.toLocaleString('de-DE') : '—'}
                      </td>
                      <td className="px-2 py-1.5 text-right tabular-nums text-muted-foreground">
                        {s.menge_nach_moq != null ? s.menge_nach_moq.toLocaleString('de-DE') : '—'}
                      </td>
                      <td className="px-2 py-1.5 text-right tabular-nums font-medium">
                        {s.menge_praktisch.toLocaleString('de-DE')}
                      </td>
                      {karte.konsolidierungsErgebnis && (
                        <td className="px-2 py-1.5 text-right">
                          {onMengeChange && konsMenge != null ? (
                            <input
                              type="number"
                              min={0}
                              step={1}
                              value={konsMenge}
                              onChange={(e) => onMengeChange(s.sku_id, Math.max(0, parseInt(e.target.value, 10) || 0))}
                              className="w-20 text-right tabular-nums font-semibold text-blue-600 bg-transparent border-b border-blue-200 focus:outline-none focus:border-blue-500 px-0.5"
                            />
                          ) : (
                            <span className="tabular-nums font-semibold text-blue-600">
                              {konsMenge != null ? konsMenge.toLocaleString('de-DE') : '—'}
                            </span>
                          )}
                        </td>
                      )}
                      {(() => {
                        const beg = karte.konsolidierungsErgebnis
                          ? (karte.konsolidierungsErgebnis.neue_sku_mengen.find(e => e.sku_id === s.sku_id)?.begruendung_anpassung ?? s.begruendung_anpassung)
                          : s.begruendung_anpassung
                        return (
                          <td className="px-2 py-1.5 text-muted-foreground max-w-[180px] truncate" title={beg ?? undefined}>
                            {beg || '—'}
                          </td>
                        )
                      })()}
                    </tr>
                  )
                })}
              </tbody>
              <tfoot>
                <tr className="border-t bg-muted/20">
                  <td className="px-2 py-1.5 font-medium" colSpan={3}>Gesamt</td>
                  <td className="px-2 py-1.5 text-right font-semibold tabular-nums">
                    {gesamtmenge.toLocaleString('de-DE')}
                  </td>
                  {karte.konsolidierungsErgebnis && (
                    <td className="px-2 py-1.5 text-right font-semibold tabular-nums text-blue-600">
                      {karte.konsolidierungsErgebnis.neue_sku_mengen
                        .reduce((sum, e) => sum + e.neue_menge_praktisch, 0)
                        .toLocaleString('de-DE')}
                    </td>
                  )}
                  <td />
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
      )}

      {(() => {
        const ers = karte.konsolidierungsErgebnis
        if (ers) {
          const stv = karte.stueckvolumen_m3
          const max40hq = stv && volumen_40hq_m3 ? Math.floor(volumen_40hq_m3 / stv) : null
          const max20dc = stv && volumen_20dc_m3 ? Math.floor(volumen_20dc_m3 / stv) : null
          const newTotal = ers.neue_sku_mengen.reduce((s, e) => s + e.neue_menge_praktisch, 0)
          const anz40hq = ers.volle_40hq + ers.rest_container.filter(c => c === '40HQ').length
          const anz20dc = ers.rest_container.filter(c => c === '20DC').length
          const { hqAmounts, dcAmounts } = perContainerMengen(newTotal, anz40hq, anz20dc, max40hq, max20dc)
          const hasAny = anz40hq > 0 || anz20dc > 0
          if (!hasAny) return null
          return (
            <div>
              <p className="text-xs font-medium text-muted-foreground mb-1.5">Container (nach Konsolidierung)</p>
              <div className="flex gap-6">
                {anz40hq > 0 && (
                  <div className="space-y-0.5">
                    <p className="text-xs text-muted-foreground">{anz40hq}× 40HQ{max40hq != null ? ` (max. ${max40hq.toLocaleString('de-DE')} Stk.)` : ''}</p>
                    {hqAmounts.map((a, i) => (
                      <p key={i} className="text-[11px] text-blue-600">
                        Container {i + 1}: {a.toLocaleString('de-DE')} Stk.{max40hq ? ` (${Math.round(a / max40hq * 100)} %)` : ''}
                      </p>
                    ))}
                  </div>
                )}
                {anz20dc > 0 && (
                  <div className="space-y-0.5">
                    <p className="text-xs text-muted-foreground">{anz20dc}× 20DC{max20dc != null ? ` (max. ${max20dc.toLocaleString('de-DE')} Stk.)` : ''}</p>
                    {dcAmounts.map((a, i) => (
                      <p key={i} className="text-[11px] text-blue-600">
                        Container {i + 1}: {a.toLocaleString('de-DE')} Stk.{max20dc ? ` (${Math.round(a / max20dc * 100)} %)` : ''}
                      </p>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )
        }
        if (hq > 0 || dc > 0) {
          const stv = karte.stueckvolumen_m3
          const max40hq = stv && volumen_40hq_m3 ? Math.floor(volumen_40hq_m3 / stv) : null
          const max20dc = stv && volumen_20dc_m3 ? Math.floor(volumen_20dc_m3 / stv) : null
          const { hqAmounts, dcAmounts } = perContainerMengen(gesamtmenge, hq, dc, max40hq, max20dc)
          return (
            <div>
              <p className="text-xs font-medium text-muted-foreground mb-1.5">Container</p>
              <div className="flex gap-6">
                {hq > 0 && (
                  <div className="space-y-0.5">
                    <p className="text-xs text-muted-foreground">{hq}× 40HQ{max40hq != null ? ` (max. ${max40hq.toLocaleString('de-DE')} Stk.)` : ''}</p>
                    {hqAmounts.map((a, i) => (
                      <p key={i} className="text-[11px] text-muted-foreground">
                        Container {i + 1}: {a.toLocaleString('de-DE')} Stk.{max40hq ? ` (${Math.round(a / max40hq * 100)} %)` : ''}
                      </p>
                    ))}
                  </div>
                )}
                {dc > 0 && (
                  <div className="space-y-0.5">
                    <p className="text-xs text-muted-foreground">{dc}× 20DC{max20dc != null ? ` (max. ${max20dc.toLocaleString('de-DE')} Stk.)` : ''}</p>
                    {dcAmounts.map((a, i) => (
                      <p key={i} className="text-[11px] text-muted-foreground">
                        Container {i + 1}: {a.toLocaleString('de-DE')} Stk.{max20dc ? ` (${Math.round(a / max20dc * 100)} %)` : ''}
                      </p>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )
        }
        return null
      })()}
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
  onMengeChange?: (skuId: string, neueMenge: number) => void
}

export function KonsolidierungsKarte({
  karte,
  ausgewaehlt,
  onToggle,
  volumen_20dc_m3,
  volumen_40hq_m3,
  isInGruppe = false,
  gruppefarbe,
  onMengeChange,
}: KonsolidierungsKarteProps) {
  const [expanded, setExpanded] = useState(false)

  const fmt = (d: string | null) => {
    if (!d) return '—'
    const [y, m, day] = d.split('-')
    return `${day}.${m}.${y}`
  }

  const hatVorherige = karte.konsolidierungspartner.length > 0
  const hatDetails = !!(karte.bestellungData || karte.neueBestellungData)

  const borderClass = isInGruppe && gruppefarbe
    ? `border-l-4 ${gruppefarbe}`
    : ''

  // Obere Container-Auslastung: nach einer Konsolidierung mit der (ggf. angepassten)
  // Konsolidierungsmenge rechnen, sonst mit der MOQ-Menge. So spiegelt die Prozentanzeige
  // oben auf der Karte Mengenänderungen aus der Konsolidierung sofort wider.
  const stueckvolumen = karte.stueckvolumen_m3 ?? 0
  const auslastungVolumen = karte.konsolidierungsErgebnis
    ? karte.konsolidierungsErgebnis.neue_sku_mengen.reduce((s, e) => s + e.neue_menge_praktisch, 0) * stueckvolumen
    : karte.volumen_moq_m3
  const auslastungLabel = karte.konsolidierungsErgebnis
    ? 'Containerverteilung nach Konsolidierungsmenge'
    : 'Containerverteilung nach MOQ-Menge'

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
                      <span className="inline-flex items-center justify-center w-4 h-4 rounded-full bg-amber-100 border border-amber-400 text-amber-600 text-[10px] font-bold cursor-default shrink-0">!</span>
                    </TooltipTrigger>
                    <TooltipContent side="right" sideOffset={6} collisionPadding={16} className="max-w-[280px] text-xs space-y-1.5">
                      <p className="font-medium">War konsolidiert mit:</p>
                      {karte.konsolidierungspartner.map((p, i) => {
                        const containerLabel = (() => {
                          if (p.container_anteil && Object.keys(p.container_anteil).length > 0) {
                            const parts = Object.entries(p.container_anteil)
                              .filter(([, v]) => v > 0)
                              .map(([art, v]) => { const r = Math.round(v * 100) / 100; return `${r % 1 === 0 ? r : r.toFixed(2)}× ${art}` })
                              .join(' + ')
                            return parts || null
                          }
                          const hq = p.anzahl_40hq ?? 0; const dc = p.anzahl_20dc ?? 0
                          if (hq === 0 && dc === 0) return null
                          return [hq > 0 && `${hq}× 40HQ`, dc > 0 && `${dc}× 20DC`].filter(Boolean).join(' + ')
                        })()
                        return (
                          <div key={i} className="flex items-center justify-between gap-3">
                            <span className="truncate">{p.produkt_namen.join(', ') || 'Weitere Bestellung'}</span>
                            <div className="flex items-center gap-1 shrink-0">
                              {p.bestelldatum && (
                                <span className="text-muted-foreground tabular-nums">
                                  {new Date(p.bestelldatum + 'T00:00:00').toLocaleDateString('de-DE')}
                                </span>
                              )}
                              {containerLabel && (
                                <Badge variant="outline" className="text-[10px] font-mono h-4 px-1">{containerLabel}</Badge>
                              )}
                            </div>
                          </div>
                        )
                      })}
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              )}
            </div>

            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-1.5 flex-wrap">
                <span className="text-sm font-medium truncate">{karte.produktNamen.join(', ')}</span>
                <Badge variant="secondary" className="text-xs tabular-nums shrink-0">
                  {(karte.konsolidierungsErgebnis
                    ? karte.konsolidierungsErgebnis.neue_sku_mengen.reduce((s, e) => s + e.neue_menge_praktisch, 0)
                    : karte.gesamtmenge
                  ).toLocaleString('de-DE')} Stk.
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
                    <Badge variant="secondary" className="text-xs h-5 px-1.5 rounded font-bold text-foreground">
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

          {/* Container utilization — nach Konsolidierung mit Konsolidierungsmenge, sonst MOQ-Menge */}
          <div className="pl-6">
            <ContainerAuslastung
              volumen_m3={auslastungVolumen}
              volumen_20dc_m3={volumen_20dc_m3}
              volumen_40hq_m3={volumen_40hq_m3}
              label={auslastungLabel}
            />
          </div>
        </div>

        <CollapsibleContent>
          <DetailInhalt karte={karte} volumen_20dc_m3={volumen_20dc_m3} volumen_40hq_m3={volumen_40hq_m3} onMengeChange={onMengeChange} />
        </CollapsibleContent>
      </div>
    </Collapsible>
  )
}
