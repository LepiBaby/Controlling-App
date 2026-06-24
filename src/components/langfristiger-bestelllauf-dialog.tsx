'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import { CalendarIcon, ChevronDown, ChevronRight, AlertTriangle, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Checkbox } from '@/components/ui/checkbox'
import { Separator } from '@/components/ui/separator'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import { Calendar } from '@/components/ui/calendar'
import { useToast } from '@/hooks/use-toast'
import {
  useLangfristigerBestelllauf,
  type NeuePlanbestellung,
  type PlanbestelllaufAenderung,
  type ProduktStammdaten,
} from '@/hooks/use-langfristiger-bestelllauf'
import { perContainerMengen } from '@/hooks/use-produktinformationen-container'
import { kaskadiereDaten, DATUM_KETTEN_FELDER, type DatumFelder, type LieferzeitIntervals } from '@/lib/datum-kaskade'
import { LangfristigerKonsolidierungsSchritt } from '@/components/langfristiger-konsolidierungs-schritt'
import { type WizardKonsolidierungsGruppe } from '@/components/konsolidierungs-schritt'

type EditierteNeueDaten = NonNullable<PlanbestelllaufAenderung['neue_daten']>

// ─── Inline DatePicker (Port aus planbestelllauf-wizard.tsx) ───────────────────

function DatePicker({ value, onChange, label }: {
  value: string | null
  onChange: (v: string | null) => void
  label: string
}) {
  const [open, setOpen] = useState(false)
  const date = value ? new Date(value + 'T00:00:00') : undefined
  return (
    <div className="space-y-1">
      <Label className="text-xs text-muted-foreground">{label}</Label>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button variant="outline" size="sm" className="w-full justify-start font-normal text-xs h-8">
            <CalendarIcon className="mr-1.5 h-3 w-3 opacity-50 shrink-0" />
            {date ? date.toLocaleDateString('de-DE') : <span className="text-muted-foreground">–</span>}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0" align="start">
          <Calendar
            mode="single"
            selected={date}
            onSelect={d => {
              onChange(d ? `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}` : null)
              setOpen(false)
            }}
          />
          {value && (
            <div className="border-t p-2">
              <Button variant="ghost" size="sm" className="w-full text-xs text-muted-foreground"
                onClick={() => { onChange(null); setOpen(false) }}>
                Datum entfernen
              </Button>
            </div>
          )}
        </PopoverContent>
      </Popover>
    </div>
  )
}

// ─── Step 1: Änderungsempfehlung (einzelne Bestellung) ────────────────────────

const AENDERUNG_BADGE_CONFIG: Record<string, { label: string; className: string }> = {
  bestelldatum: { label: 'Datum geändert', className: 'text-orange-600 border-orange-200 bg-orange-50' },
  menge: { label: 'Menge geändert', className: 'text-blue-600 border-blue-200 bg-blue-50' },
  bestelldatum_und_menge: { label: 'Datum & Menge', className: 'text-orange-600 border-orange-200 bg-orange-50' },
  kein_bedarf: { label: 'Wird gelöscht', className: 'text-red-600 border-red-200 bg-red-50' },
  keine_aenderung: { label: 'Unverändert', className: 'text-green-600 border-green-200 bg-green-50' },
  konsolidierung: { label: 'Konsolidierung', className: 'text-purple-600 border-purple-200 bg-purple-50' },
}

function AenderungItem({
  aenderung,
  neueDaten,
  akzeptiert,
  onToggle,
  onChange,
  lieferzeit,
  kapazitaet,
}: {
  aenderung: PlanbestelllaufAenderung
  neueDaten: EditierteNeueDaten
  akzeptiert: boolean
  onToggle: () => void
  onChange: (updated: EditierteNeueDaten) => void
  lieferzeit?: LieferzeitIntervals | null
  kapazitaet?: { max_40hq: number | null; max_20dc: number | null } | null
}) {
  const [open, setOpen] = useState(false)

  const gesamtmenge = (neueDaten.sku_mengen ?? []).reduce((s, m) => s + m.menge_praktisch, 0)

  const setDate = (field: keyof DatumFelder) => (v: string | null) => {
    if (!DATUM_KETTEN_FELDER.has(field)) {
      onChange({ ...neueDaten, [field]: v })
      return
    }
    const aktuell: DatumFelder = {
      bestelldatum: neueDaten.bestelldatum ?? null,
      produktionsstart_datum: neueDaten.produktionsstart_datum ?? null,
      produktionsende_datum: neueDaten.produktionsende_datum ?? null,
      shippingdatum: neueDaten.shippingdatum ?? null,
      ankunftsdatum: neueDaten.ankunftsdatum ?? null,
      verfuegbarkeitsdatum: neueDaten.verfuegbarkeitsdatum ?? null,
    }
    const kaskadiert = kaskadiereDaten(field, v, aktuell, lieferzeit ?? null)
    const patch = Object.fromEntries(Object.entries(kaskadiert).map(([k, val]) => [k, val ?? undefined]))
    onChange({ ...neueDaten, ...patch })
  }

  const setSkuMenge = (skuId: string, menge: number) =>
    onChange({
      ...neueDaten,
      sku_mengen: (neueDaten.sku_mengen ?? []).map(s =>
        s.sku_id === skuId ? { ...s, menge_praktisch: menge } : s
      ),
    })

  const fmt = (d: string | null | undefined) =>
    d ? new Date(d + 'T00:00:00').toLocaleDateString('de-DE') : '–'

  return (
    <Collapsible open={open} onOpenChange={setOpen}>
      <div className="rounded-md border">
        <div className="flex items-start gap-3 p-3">
          <div className="flex items-center gap-1 shrink-0 mt-0.5">
            <Checkbox
              checked={akzeptiert}
              onCheckedChange={onToggle}
              aria-label="Änderung übernehmen"
            />
            {aenderung.konsolidierungspartner && aenderung.konsolidierungspartner.length > 0 && (
              <TooltipProvider delayDuration={200}>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <span className="inline-flex items-center justify-center w-4 h-4 rounded-full bg-amber-100 border border-amber-400 text-amber-600 text-[10px] font-bold cursor-default shrink-0">!</span>
                  </TooltipTrigger>
                  <TooltipContent side="right" sideOffset={6} collisionPadding={16} className="max-w-[280px] text-xs space-y-1.5">
                    <p className="font-medium">War konsolidiert mit:</p>
                    {aenderung.konsolidierungspartner.map((p, i) => {
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
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-sm font-medium">{aenderung.produkt_namen.join(', ')}</span>
              {AENDERUNG_BADGE_CONFIG[aenderung.aenderungsart] && (
                <Badge variant="outline" className={`text-xs ${AENDERUNG_BADGE_CONFIG[aenderung.aenderungsart].className}`}>
                  {AENDERUNG_BADGE_CONFIG[aenderung.aenderungsart].label}
                </Badge>
              )}
              {neueDaten.sku_mengen && neueDaten.sku_mengen.length > 0 && (
                <Badge variant="secondary" className="text-xs tabular-nums">{gesamtmenge.toLocaleString('de-DE')} Stk.</Badge>
              )}
              {(() => {
                const cnt = neueDaten.container ?? []
                const hq = cnt.filter(c => c === '40HQ').length
                const dc = cnt.filter(c => c === '20DC').length
                if (hq === 0 && dc === 0) return null
                const parts = [hq > 0 && `${hq}× 40HQ`, dc > 0 && `${dc}× 20DC`].filter(Boolean).join(' + ')
                return <Badge variant="outline" className="text-xs font-mono">{parts}</Badge>
              })()}
              {aenderung.warnungen && aenderung.warnungen.length > 0 && (
                <Badge variant="outline" className="text-xs gap-1 text-amber-600 border-amber-200 bg-amber-50">
                  <AlertTriangle className="h-2.5 w-2.5" />
                  {aenderung.warnungen.length} Hinweis{aenderung.warnungen.length !== 1 ? 'e' : ''}
                </Badge>
              )}
            </div>
            <p className="mt-0.5 text-xs font-semibold">{aenderung.begruendung}</p>
            <div className="mt-1 flex flex-wrap gap-x-4 gap-y-0.5 text-xs text-muted-foreground">
              {neueDaten.bestelldatum && <span>Bestellt: <span className="text-foreground">{fmt(neueDaten.bestelldatum)}</span></span>}
              {neueDaten.produktionsende_datum && <span>Prod.ende: <span className="text-foreground">{fmt(neueDaten.produktionsende_datum)}</span></span>}
              {neueDaten.ankunftsdatum && <span>Ankunft: <span className="text-foreground">{fmt(neueDaten.ankunftsdatum)}</span></span>}
              {neueDaten.verfuegbarkeitsdatum && <span>Verfügbar: <span className="text-foreground">{fmt(neueDaten.verfuegbarkeitsdatum)}</span></span>}
            </div>
          </div>
          <CollapsibleTrigger asChild>
            <Button variant="ghost" size="sm" className="h-7 w-7 p-0 shrink-0">
              {open ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
            </Button>
          </CollapsibleTrigger>
        </div>

        <CollapsibleContent>
          <div className="border-t p-3 space-y-4 bg-muted/10">
            {aenderung.warnungen && aenderung.warnungen.length > 0 && (
              <div className="space-y-1">
                {aenderung.warnungen.map((w, i) => (
                  <div key={i} className="flex items-start gap-2 text-xs text-amber-600 bg-amber-50 border border-amber-100 rounded px-2 py-1.5">
                    <AlertTriangle className="h-3 w-3 mt-0.5 shrink-0" />
                    <span>{w}</span>
                  </div>
                ))}
              </div>
            )}

            <div>
              <p className="text-xs font-medium text-muted-foreground mb-2">Datumsfelder</p>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                {(
                  [
                    { field: 'bestelldatum' as keyof DatumFelder, label: 'Bestelldatum' },
                    { field: 'produktionsstart_datum' as keyof DatumFelder, label: 'Produktionsstart' },
                    { field: 'produktionsende_datum' as keyof DatumFelder, label: 'Produktionsende' },
                    { field: 'shippingdatum' as keyof DatumFelder, label: 'Shippingdatum' },
                    { field: 'ankunftsdatum' as keyof DatumFelder, label: 'Ankunftsdatum' },
                    { field: 'verfuegbarkeitsdatum' as keyof DatumFelder, label: 'Verfügbarkeitsdatum' },
                  ] as const
                ).map(({ field, label }) => {
                  const altWert = aenderung.alte_daten?.[field]
                  const neuWert = neueDaten[field] ?? null
                  const hatAenderung = altWert !== undefined && altWert !== neuWert
                  return (
                    <div key={field}>
                      <DatePicker label={label} value={neuWert} onChange={setDate(field)} />
                      {hatAenderung && (
                        <p className="text-[10px] text-red-400 line-through pl-1 mt-0.5 leading-tight">{fmt(altWert)}</p>
                      )}
                    </div>
                  )
                })}
              </div>
            </div>

            {neueDaten.sku_mengen && neueDaten.sku_mengen.length > 0 && (
              <div>
                {/* Produktebene: genau eine Zeile = das Produkt */}
                <p className="text-xs font-medium text-muted-foreground mb-2">Bestellmenge</p>
                <div className="rounded-md border overflow-hidden">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="border-b bg-muted/40">
                        <th className="px-2 py-1.5 text-left font-medium text-muted-foreground">Produkt</th>
                        <th className="px-2 py-1.5 text-right font-medium text-muted-foreground">Theoretisch</th>
                        <th className="px-2 py-1.5 text-right font-medium text-muted-foreground">Nach MOQ</th>
                        <th className="px-2 py-1.5 text-right font-medium text-muted-foreground">Praktisch</th>
                        <th className="px-2 py-1.5 text-left font-medium text-muted-foreground">Begründung</th>
                      </tr>
                    </thead>
                    <tbody>
                      {neueDaten.sku_mengen.map(s => {
                        const altSku = aenderung.alte_daten?.sku_mengen?.find(a => a.sku_id === s.sku_id)
                        const altMenge = altSku?.menge_praktisch
                        const altTheorMenge = altSku?.menge_theoretisch
                        const hatMengenAenderung = altMenge !== undefined && altMenge !== s.menge_praktisch
                        const hatMoqAenderung = s.menge_nach_moq != null && (
                          altSku == null || altSku.menge_nach_moq !== s.menge_nach_moq
                        )
                        const istAusgeschlossen = s.menge_praktisch === 0
                        return (
                          <tr key={s.sku_id} className={`border-b last:border-0 ${istAusgeschlossen ? 'opacity-50' : ''}`}>
                            <td className="px-2 py-1.5">
                              <div>{s.sku_name ?? s.sku_id}</div>
                            </td>
                            <td className="px-2 py-1.5 text-right tabular-nums text-muted-foreground">
                              <div className="flex flex-col items-end gap-0.5">
                                <span>{s.menge_theoretisch != null ? s.menge_theoretisch.toLocaleString('de-DE') : '—'}</span>
                                {altTheorMenge != null && (
                                  <span className="text-[10px] text-red-400 line-through tabular-nums">{altTheorMenge.toLocaleString('de-DE')}</span>
                                )}
                              </div>
                            </td>
                            <td className="px-2 py-1.5 text-right tabular-nums text-muted-foreground">
                              <div className="flex flex-col items-end gap-0.5">
                                <span>{s.menge_nach_moq != null ? s.menge_nach_moq.toLocaleString('de-DE') : '—'}</span>
                                {hatMoqAenderung && (
                                  <span className="text-[10px] text-red-400 line-through tabular-nums">
                                    {altSku?.menge_nach_moq != null ? altSku.menge_nach_moq.toLocaleString('de-DE') : '—'}
                                  </span>
                                )}
                              </div>
                            </td>
                            <td className="px-2 py-1.5 text-right">
                              <div className="flex items-center justify-end gap-1.5">
                                <Input
                                  type="number"
                                  min="0"
                                  className="w-20 h-6 text-right text-xs"
                                  value={s.menge_praktisch}
                                  onChange={e => setSkuMenge(s.sku_id, parseInt(e.target.value) || 0)}
                                />
                                {hatMengenAenderung && altMenge !== undefined && (
                                  <span className="text-[10px] text-red-400 line-through tabular-nums">{altMenge.toLocaleString('de-DE')}</span>
                                )}
                              </div>
                            </td>
                            <td className="px-2 py-1.5 text-muted-foreground max-w-[180px] truncate" title={s.begruendung_anpassung}>
                              {s.begruendung_anpassung || '—'}
                            </td>
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
                        <td />
                      </tr>
                    </tfoot>
                  </table>
                </div>
              </div>
            )}

            {(() => {
              const cnt = neueDaten.container ?? []
              const hq = cnt.filter(c => c === '40HQ').length
              const dc = cnt.filter(c => c === '20DC').length
              const total = (neueDaten.sku_mengen ?? []).reduce((s, m) => s + m.menge_praktisch, 0)
              const altCnt = aenderung.alte_daten?.container ?? []
              const altHq = altCnt.filter(c => c === '40HQ').length
              const altDc = altCnt.filter(c => c === '20DC').length
              const max40hq = kapazitaet?.max_40hq ?? null
              const max20dc = kapazitaet?.max_20dc ?? null
              const { hqAmounts, dcAmounts } = perContainerMengen(total, hq, dc, max40hq, max20dc)
              return (
                <div className="space-y-2">
                  <p className="text-xs font-medium text-muted-foreground">Container</p>
                  <div className="flex gap-4">
                    <div className="space-y-1">
                      <Label className="text-xs text-muted-foreground">
                        Anzahl 40HQ{max40hq !== null ? ` (max. ${max40hq.toLocaleString('de-DE')} Stk.)` : ''}
                      </Label>
                      <Input
                        type="number" min="0" className="w-20 h-7 text-xs"
                        value={hq}
                        onChange={e => {
                          const n = Math.max(0, parseInt(e.target.value) || 0)
                          onChange({ ...neueDaten, container: [...Array(n).fill('40HQ' as const), ...Array(dc).fill('20DC' as const)] })
                        }}
                      />
                      {altHq !== hq && <p className="text-[10px] text-red-400 line-through">{altHq}</p>}
                      {hqAmounts.map((a, i) => (
                        <p key={i} className="text-[10px] text-muted-foreground">
                          Container {i + 1}: {a.toLocaleString('de-DE')} Stk.{max40hq ? ` (${Math.round(a / max40hq * 100)} %)` : ''}
                        </p>
                      ))}
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs text-muted-foreground">
                        Anzahl 20DC{max20dc !== null ? ` (max. ${max20dc.toLocaleString('de-DE')} Stk.)` : ''}
                      </Label>
                      <Input
                        type="number" min="0" className="w-20 h-7 text-xs"
                        value={dc}
                        onChange={e => {
                          const n = Math.max(0, parseInt(e.target.value) || 0)
                          onChange({ ...neueDaten, container: [...Array(hq).fill('40HQ' as const), ...Array(n).fill('20DC' as const)] })
                        }}
                      />
                      {altDc !== dc && <p className="text-[10px] text-red-400 line-through">{altDc}</p>}
                      {dcAmounts.map((a, i) => (
                        <p key={i} className="text-[10px] text-muted-foreground">
                          Container {i + 1}: {a.toLocaleString('de-DE')} Stk.{max20dc ? ` (${Math.round(a / max20dc * 100)} %)` : ''}
                        </p>
                      ))}
                    </div>
                  </div>
                </div>
              )
            })()}
          </div>
        </CollapsibleContent>
      </div>
    </Collapsible>
  )
}

function KeinBedarfItem({
  aenderung,
  akzeptiert,
  onToggle,
}: {
  aenderung: PlanbestelllaufAenderung
  akzeptiert: boolean
  onToggle: () => void
}) {
  const fmt = (d: string | null | undefined) =>
    d ? new Date(d + 'T00:00:00').toLocaleDateString('de-DE') : '–'
  const totalMenge = aenderung.alte_daten?.sku_mengen?.reduce((s, m) => s + m.menge_praktisch, 0) ?? 0

  return (
    <div className="flex items-start gap-3 rounded-md border p-3 hover:bg-muted/30">
      <Checkbox checked={akzeptiert} onCheckedChange={onToggle} className="mt-0.5 shrink-0" aria-label="Löschen bestätigen" />
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-sm font-medium">{aenderung.produkt_namen.join(', ')}</span>
          <Badge variant="outline" className="text-xs text-red-600 border-red-200 bg-red-50">Wird gelöscht</Badge>
          {totalMenge > 0 && (
            <Badge variant="secondary" className="text-xs tabular-nums">{totalMenge.toLocaleString('de-DE')} Stk.</Badge>
          )}
          {(() => {
            const cnt = aenderung.alte_daten?.container ?? []
            const hq = cnt.filter(c => c === '40HQ').length
            const dc = cnt.filter(c => c === '20DC').length
            if (hq === 0 && dc === 0) return null
            const parts = [hq > 0 && `${hq}× 40HQ`, dc > 0 && `${dc}× 20DC`].filter(Boolean).join(' + ')
            return <Badge variant="outline" className="text-xs font-mono">{parts}</Badge>
          })()}
        </div>
        <p className="mt-0.5 text-xs text-muted-foreground">{aenderung.begruendung}</p>
        <div className="mt-1 flex flex-wrap gap-x-4 gap-y-0.5 text-xs text-muted-foreground">
          {aenderung.alte_daten?.bestelldatum && <span>Bestellt: <span className="text-foreground">{fmt(aenderung.alte_daten.bestelldatum)}</span></span>}
          {aenderung.alte_daten?.produktionsende_datum && <span>Prod.ende: <span className="text-foreground">{fmt(aenderung.alte_daten.produktionsende_datum)}</span></span>}
          {aenderung.alte_daten?.ankunftsdatum && <span>Ankunft: <span className="text-foreground">{fmt(aenderung.alte_daten.ankunftsdatum)}</span></span>}
          {aenderung.alte_daten?.verfuegbarkeitsdatum && <span>Verfügbar: <span className="text-foreground">{fmt(aenderung.alte_daten.verfuegbarkeitsdatum)}</span></span>}
        </div>
      </div>
    </div>
  )
}

function KeineAenderungItem({ aenderung }: { aenderung: PlanbestelllaufAenderung }) {
  const fmt = (d: string | null | undefined) =>
    d ? new Date(d + 'T00:00:00').toLocaleDateString('de-DE') : '–'
  const totalMenge = aenderung.alte_daten?.sku_mengen?.reduce((s, m) => s + m.menge_praktisch, 0) ?? 0

  return (
    <div className="flex items-start gap-3 rounded-md border border-dashed p-3 opacity-65">
      <div className="flex items-center gap-1 shrink-0 mt-0.5">
        <div className="w-4" />
        {aenderung.konsolidierungspartner && aenderung.konsolidierungspartner.length > 0 && (
          <TooltipProvider delayDuration={200}>
            <Tooltip>
              <TooltipTrigger asChild>
                <span className="inline-flex items-center justify-center w-4 h-4 rounded-full bg-amber-100 border border-amber-400 text-amber-600 text-[10px] font-bold cursor-default shrink-0">!</span>
              </TooltipTrigger>
              <TooltipContent side="right" sideOffset={6} collisionPadding={16} className="max-w-[280px] text-xs space-y-1.5">
                <p className="font-medium">War konsolidiert mit:</p>
                {aenderung.konsolidierungspartner.map((p, i) => {
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
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-sm font-medium">{aenderung.produkt_namen.join(', ')}</span>
          <Badge variant="outline" className="text-xs text-green-600 border-green-200 bg-green-50">Unverändert</Badge>
          {aenderung.herkunft === 'manuell' && (
            <Badge variant="outline" className="text-xs text-violet-600 border-violet-200 bg-violet-50">Erstbestellung</Badge>
          )}
          {totalMenge > 0 && (
            <Badge variant="secondary" className="text-xs tabular-nums">{totalMenge.toLocaleString('de-DE')} Stk.</Badge>
          )}
          {(() => {
            const cnt = aenderung.alte_daten?.container ?? []
            const hq = cnt.filter(c => c === '40HQ').length
            const dc = cnt.filter(c => c === '20DC').length
            if (hq === 0 && dc === 0) return null
            const parts = [hq > 0 && `${hq}× 40HQ`, dc > 0 && `${dc}× 20DC`].filter(Boolean).join(' + ')
            return <Badge variant="outline" className="text-xs font-mono">{parts}</Badge>
          })()}
        </div>
        <div className="mt-1 flex flex-wrap gap-x-4 gap-y-0.5 text-xs text-muted-foreground">
          {aenderung.alte_daten?.bestelldatum && <span>Bestellt: <span className="text-foreground">{fmt(aenderung.alte_daten.bestelldatum)}</span></span>}
          {aenderung.alte_daten?.produktionsende_datum && <span>Prod.ende: <span className="text-foreground">{fmt(aenderung.alte_daten.produktionsende_datum)}</span></span>}
          {aenderung.alte_daten?.ankunftsdatum && <span>Ankunft: <span className="text-foreground">{fmt(aenderung.alte_daten.ankunftsdatum)}</span></span>}
          {aenderung.alte_daten?.verfuegbarkeitsdatum && <span>Verfügbar: <span className="text-foreground">{fmt(aenderung.alte_daten.verfuegbarkeitsdatum)}</span></span>}
        </div>
      </div>
    </div>
  )
}

// ─── Step 1 ────────────────────────────────────────────────────────────────────

function Schritt1({
  aenderungen,
  akzeptiert,
  bearbeitetAenderungen,
  onToggle,
  onAenderungChange,
  getLieferzeit,
  getMaxKapazitaet,
  onWeiter,
}: {
  aenderungen: PlanbestelllaufAenderung[]
  akzeptiert: Set<string>
  bearbeitetAenderungen: Map<string, EditierteNeueDaten>
  onToggle: (id: string) => void
  onAenderungChange: (id: string, updated: EditierteNeueDaten) => void
  getLieferzeit: (produktId: string) => LieferzeitIntervals | null | undefined
  getMaxKapazitaet: (produktId: string) => { max_40hq: number | null; max_20dc: number | null }
  onWeiter: () => void
}) {
  if (aenderungen.length === 0) return null

  const selektierbare = aenderungen.filter(a => a.aenderungsart !== 'keine_aenderung')
  const unveraenderte = aenderungen.filter(a => a.aenderungsart === 'keine_aenderung')
  const ausgewaehlteCount = selektierbare.filter(a => akzeptiert.has(a.bestellung_id)).length

  return (
    <div className="space-y-4">
      {selektierbare.length > 0 && (
        <div className="flex items-center justify-between">
          <p className="text-xs text-muted-foreground">
            {ausgewaehlteCount} von {selektierbare.length} Empfehlung{selektierbare.length !== 1 ? 'en' : ''} ausgewählt
          </p>
          <div className="flex gap-2">
            <Button variant="ghost" size="sm" className="text-xs h-7"
              onClick={() => selektierbare.forEach(a => !akzeptiert.has(a.bestellung_id) && onToggle(a.bestellung_id))}>
              Alle wählen
            </Button>
            <Button variant="ghost" size="sm" className="text-xs h-7"
              onClick={() => selektierbare.forEach(a => akzeptiert.has(a.bestellung_id) && onToggle(a.bestellung_id))}>
              Keine
            </Button>
          </div>
        </div>
      )}
      <div className="space-y-2 pr-1">
        {selektierbare.map(a => {
          if (a.aenderungsart === 'kein_bedarf') {
            return (
              <KeinBedarfItem
                key={a.bestellung_id}
                aenderung={a}
                akzeptiert={akzeptiert.has(a.bestellung_id)}
                onToggle={() => onToggle(a.bestellung_id)}
              />
            )
          }
          const neueDaten = bearbeitetAenderungen.get(a.bestellung_id) ?? a.neue_daten
          if (!neueDaten) return null
          return (
            <AenderungItem
              key={a.bestellung_id}
              aenderung={a}
              neueDaten={neueDaten}
              akzeptiert={akzeptiert.has(a.bestellung_id)}
              onToggle={() => onToggle(a.bestellung_id)}
              onChange={updated => onAenderungChange(a.bestellung_id, updated)}
              lieferzeit={a.produkt_ids?.[0] ? getLieferzeit(a.produkt_ids[0]) : null}
              kapazitaet={a.produkt_ids?.[0] ? getMaxKapazitaet(a.produkt_ids[0]) : null}
            />
          )
        })}

        {unveraenderte.length > 0 && (
          <>
            {selektierbare.length > 0 && <Separator className="my-1" />}
            <p className="text-xs text-muted-foreground px-0.5 pb-0.5">
              Unverändert ({unveraenderte.length})
            </p>
            {unveraenderte.map(a => (
              <KeineAenderungItem key={a.bestellung_id} aenderung={a} />
            ))}
          </>
        )}
      </div>

      <div className="flex justify-end">
        <Button size="sm" onClick={onWeiter}>Weiter →</Button>
      </div>
    </div>
  )
}

// ─── Step 2: Neue Planbestellungen ────────────────────────────────────────────

function NeueBestellungItem({
  b,
  ausgewaehlt,
  onToggleAuswahl,
  onChange,
  lieferzeit,
  kapazitaet,
}: {
  b: NeuePlanbestellung
  ausgewaehlt: boolean
  onToggleAuswahl: () => void
  onChange: (updated: NeuePlanbestellung) => void
  lieferzeit?: LieferzeitIntervals | null
  kapazitaet?: { max_40hq: number | null; max_20dc: number | null } | null
}) {
  const [open, setOpen] = useState(false)

  const gesamtmenge = b.sku_mengen.reduce((s, m) => s + m.menge_praktisch, 0)

  const setDate = (field: keyof NeuePlanbestellung) => (v: string | null) => {
    if (!DATUM_KETTEN_FELDER.has(field as string)) {
      onChange({ ...b, [field]: v })
      return
    }
    const aktuell: DatumFelder = {
      bestelldatum: b.bestelldatum,
      produktionsstart_datum: b.produktionsstart_datum,
      produktionsende_datum: b.produktionsende_datum,
      shippingdatum: b.shippingdatum,
      ankunftsdatum: b.ankunftsdatum,
      verfuegbarkeitsdatum: b.verfuegbarkeitsdatum,
    }
    const kaskadiert = kaskadiereDaten(field as keyof DatumFelder, v, aktuell, lieferzeit ?? null)
    onChange({ ...b, ...kaskadiert })
  }

  const setSkuMenge = (skuId: string, menge: number) =>
    onChange({
      ...b,
      sku_mengen: b.sku_mengen.map(s => s.sku_id === skuId ? { ...s, menge_praktisch: menge } : s),
    })

  const fmt = (d: string | null) =>
    d ? new Date(d + 'T00:00:00').toLocaleDateString('de-DE') : '–'

  return (
    <Collapsible open={open} onOpenChange={setOpen}>
      <div className="rounded-md border">
        <div className="flex items-start gap-3 p-3">
          <Checkbox
            checked={ausgewaehlt}
            onCheckedChange={onToggleAuswahl}
            className="mt-0.5 shrink-0"
            aria-label="Bestellung auswählen"
          />
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-sm font-medium">{b.produkt_namen.join(', ')}</span>
              <Badge variant="secondary" className="text-xs tabular-nums">{gesamtmenge.toLocaleString('de-DE')} Stk.</Badge>
              {(() => {
                const cnt = b.container ?? []
                const hq = cnt.filter(c => c === '40HQ').length
                const dc = cnt.filter(c => c === '20DC').length
                if (hq === 0 && dc === 0) return null
                const parts = [hq > 0 && `${hq}× 40HQ`, dc > 0 && `${dc}× 20DC`].filter(Boolean).join(' + ')
                return <Badge variant="outline" className="text-xs font-mono">{parts}</Badge>
              })()}
              {b.warnungen.length > 0 && (
                <Badge variant="outline" className="text-xs gap-1 text-amber-600 border-amber-200 bg-amber-50">
                  <AlertTriangle className="h-2.5 w-2.5" />
                  {b.warnungen.length} Hinweis{b.warnungen.length !== 1 ? 'e' : ''}
                </Badge>
              )}
            </div>
            <div className="mt-1 flex flex-wrap gap-x-4 gap-y-0.5 text-xs text-muted-foreground">
              {b.bestelldatum && <span>Bestellt: <span className="text-foreground">{fmt(b.bestelldatum)}</span></span>}
              {b.produktionsende_datum && <span>Prod.ende: <span className="text-foreground">{fmt(b.produktionsende_datum)}</span></span>}
              {b.ankunftsdatum && <span>Ankunft: <span className="text-foreground">{fmt(b.ankunftsdatum)}</span></span>}
              {b.verfuegbarkeitsdatum && <span>Verfügbar: <span className="text-foreground">{fmt(b.verfuegbarkeitsdatum)}</span></span>}
            </div>
          </div>
          <CollapsibleTrigger asChild>
            <Button variant="ghost" size="sm" className="h-7 w-7 p-0 shrink-0">
              {open ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
            </Button>
          </CollapsibleTrigger>
        </div>

        <CollapsibleContent>
          <div className="border-t p-3 space-y-4 bg-muted/10">
            {b.warnungen.length > 0 && (
              <div className="space-y-1">
                {b.warnungen.map((w, i) => (
                  <div key={i} className="flex items-start gap-2 text-xs text-amber-600 bg-amber-50 border border-amber-100 rounded px-2 py-1.5">
                    <AlertTriangle className="h-3 w-3 mt-0.5 shrink-0" />
                    <span>{w}</span>
                  </div>
                ))}
              </div>
            )}

            <div>
              <p className="text-xs font-medium text-muted-foreground mb-2">Datumsfelder</p>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                <DatePicker label="Bestelldatum" value={b.bestelldatum} onChange={setDate('bestelldatum')} />
                <DatePicker label="Produktionsstart" value={b.produktionsstart_datum} onChange={setDate('produktionsstart_datum')} />
                <DatePicker label="Produktionsende" value={b.produktionsende_datum} onChange={setDate('produktionsende_datum')} />
                <DatePicker label="Shippingdatum" value={b.shippingdatum} onChange={setDate('shippingdatum')} />
                <DatePicker label="Ankunftsdatum" value={b.ankunftsdatum} onChange={setDate('ankunftsdatum')} />
                <DatePicker label="Verfügbarkeitsdatum" value={b.verfuegbarkeitsdatum} onChange={setDate('verfuegbarkeitsdatum')} />
              </div>
            </div>

            {b.sku_mengen.length > 0 && (
              <div>
                {/* Produktebene: genau eine Zeile = das Produkt */}
                <p className="text-xs font-medium text-muted-foreground mb-2">Bestellmenge</p>
                <div className="rounded-md border overflow-hidden">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="border-b bg-muted/40">
                        <th className="px-2 py-1.5 text-left font-medium text-muted-foreground">Produkt</th>
                        <th className="px-2 py-1.5 text-right font-medium text-muted-foreground">Theoretisch</th>
                        <th className="px-2 py-1.5 text-right font-medium text-muted-foreground">Nach MOQ</th>
                        <th className="px-2 py-1.5 text-right font-medium text-muted-foreground">Praktisch</th>
                        <th className="px-2 py-1.5 text-left font-medium text-muted-foreground">Begründung</th>
                      </tr>
                    </thead>
                    <tbody>
                      {b.sku_mengen.map(s => {
                        const istAusgeschlossen = s.menge_praktisch === 0
                        return (
                          <tr key={s.sku_id} className={`border-b last:border-0 ${istAusgeschlossen ? 'opacity-50' : ''}`}>
                            <td className="px-2 py-1.5">
                              <div>{s.sku_name}</div>
                            </td>
                            <td className="px-2 py-1.5 text-right tabular-nums text-muted-foreground">
                              {s.menge_theoretisch.toLocaleString('de-DE')}
                            </td>
                            <td className="px-2 py-1.5 text-right tabular-nums text-muted-foreground">
                              {s.menge_nach_moq.toLocaleString('de-DE')}
                            </td>
                            <td className="px-2 py-1.5 text-right">
                              <Input
                                type="number"
                                min="0"
                                className="w-20 h-6 text-right text-xs ml-auto"
                                value={s.menge_praktisch}
                                onChange={e => setSkuMenge(s.sku_id, parseInt(e.target.value) || 0)}
                              />
                            </td>
                            <td className="px-2 py-1.5 text-muted-foreground max-w-[180px] truncate" title={s.begruendung_anpassung}>
                              {s.begruendung_anpassung || '—'}
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                    <tfoot>
                      <tr className="border-t bg-muted/20">
                        <td className="px-2 py-1.5 font-medium" colSpan={3}>Gesamt</td>
                        <td className="px-2 py-1.5 text-right font-semibold tabular-nums">
                          {b.sku_mengen.reduce((sum, s) => sum + s.menge_praktisch, 0).toLocaleString('de-DE')}
                        </td>
                        <td />
                      </tr>
                    </tfoot>
                  </table>
                </div>
              </div>
            )}

            {(() => {
              const cnt = b.container ?? []
              const hq = cnt.filter(c => c === '40HQ').length
              const dc = cnt.filter(c => c === '20DC').length
              const max40hq = kapazitaet?.max_40hq ?? null
              const max20dc = kapazitaet?.max_20dc ?? null
              const { hqAmounts, dcAmounts } = perContainerMengen(gesamtmenge, hq, dc, max40hq, max20dc)
              return (
                <div className="space-y-2">
                  <p className="text-xs font-medium text-muted-foreground">Container</p>
                  <div className="flex gap-4">
                    <div className="space-y-1">
                      <Label className="text-xs text-muted-foreground">
                        Anzahl 40HQ{max40hq !== null ? ` (max. ${max40hq.toLocaleString('de-DE')} Stk.)` : ''}
                      </Label>
                      <Input
                        type="number" min="0" className="w-20 h-7 text-xs"
                        value={hq}
                        onChange={e => {
                          const n = Math.max(0, parseInt(e.target.value) || 0)
                          onChange({ ...b, container: [...Array(n).fill('40HQ' as const), ...Array(dc).fill('20DC' as const)] })
                        }}
                      />
                      {hqAmounts.map((a, i) => (
                        <p key={i} className="text-[10px] text-muted-foreground">
                          Container {i + 1}: {a.toLocaleString('de-DE')} Stk.{max40hq ? ` (${Math.round(a / max40hq * 100)} %)` : ''}
                        </p>
                      ))}
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs text-muted-foreground">
                        Anzahl 20DC{max20dc !== null ? ` (max. ${max20dc.toLocaleString('de-DE')} Stk.)` : ''}
                      </Label>
                      <Input
                        type="number" min="0" className="w-20 h-7 text-xs"
                        value={dc}
                        onChange={e => {
                          const n = Math.max(0, parseInt(e.target.value) || 0)
                          onChange({ ...b, container: [...Array(hq).fill('40HQ' as const), ...Array(n).fill('20DC' as const)] })
                        }}
                      />
                      {dcAmounts.map((a, i) => (
                        <p key={i} className="text-[10px] text-muted-foreground">
                          Container {i + 1}: {a.toLocaleString('de-DE')} Stk.{max20dc ? ` (${Math.round(a / max20dc * 100)} %)` : ''}
                        </p>
                      ))}
                    </div>
                  </div>
                </div>
              )
            })()}
          </div>
        </CollapsibleContent>
      </div>
    </Collapsible>
  )
}

// ─── Lieferzeit / Kapazität aus produkt_stammdaten (versionsgebunden) ──────────

function buildStammdatenHelpers(stammdaten: ProduktStammdaten[], containerGlobal: { volumen_20dc: number | null; volumen_40hq: number | null }) {
  const byId = new Map<string, ProduktStammdaten>()
  for (const s of stammdaten) byId.set(s.produkt_id, s)

  const getLieferzeit = (produktId: string): LieferzeitIntervals | null => {
    const s = byId.get(produktId)
    if (!s) return null
    return {
      pufferzeit_tage: s.pufferzeit_tage ?? null,
      produktionszeit_tage: s.produktionszeit_tage ?? null,
      zwischenzeit_tage: s.zwischenzeit_tage ?? null,
      shipping_zeit_tage: s.shipping_zeit_tage ?? null,
      entladungszeit_tage: s.entladungszeit_tage ?? null,
    }
  }

  const getMaxKapazitaet = (produktId: string): { max_40hq: number | null; max_20dc: number | null } => {
    const s = byId.get(produktId)
    if (!s) return { max_40hq: null, max_20dc: null }
    // Bevorzugt die vom Backend mitgelieferten max_*; falls nicht vorhanden, aus
    // Stückvolumen + globalem Containervolumen ableiten.
    const stueckCm3 = s.stueckvolumen_m3 != null ? s.stueckvolumen_m3 * 1_000_000 : null
    const ausVolumen = (containerVolM3: number | null): number | null => {
      if (containerVolM3 == null || stueckCm3 == null || containerVolM3 <= 0 || stueckCm3 <= 0) return null
      return Math.floor((containerVolM3 * 1_000_000) / stueckCm3)
    }
    return {
      max_40hq: s.max_40hq ?? ausVolumen(containerGlobal.volumen_40hq),
      max_20dc: s.max_20dc ?? ausVolumen(containerGlobal.volumen_20dc),
    }
  }

  return { getLieferzeit, getMaxKapazitaet }
}

// ─── Main Wizard ───────────────────────────────────────────────────────────────

interface LangfristigerBestelllaufDialogProps {
  versionId: string
  open: boolean
  onOpenChange: (v: boolean) => void
  onComplete: () => void
}

export function LangfristigerBestelllaufDialog({ versionId, open, onOpenChange, onComplete }: LangfristigerBestelllaufDialogProps) {
  const { toast } = useToast()
  const { loading, ergebnis, error, applying, ausfuehren, anwenden, reset } = useLangfristigerBestelllauf(versionId)

  const [step, setStep] = useState<0 | 1 | 2 | 3>(0)
  const [akzeptiert, setAkzeptiert] = useState<Set<string>>(new Set())
  const [ausgewaehlt, setAusgewaehlt] = useState<Set<string>>(new Set())
  const [bearbeitet, setBearbeitet] = useState<Map<string, NeuePlanbestellung>>(new Map())
  const [bearbeitetAenderungen, setBearbeitetAenderungen] = useState<Map<string, EditierteNeueDaten>>(new Map())
  const [konsolidierungsGruppen, setKonsolidierungsGruppen] = useState<WizardKonsolidierungsGruppe[]>([])
  const [bestehendeKonsolidierungsGruppenIds, setBestehendeKonsolidierungsGruppenIds] = useState<string[]>([])

  useEffect(() => {
    if (!open) return
    setStep(0)
    setAkzeptiert(new Set())
    setAusgewaehlt(new Set())
    setBearbeitet(new Map())
    setBearbeitetAenderungen(new Map())
    setKonsolidierungsGruppen([])
    reset()

    ausfuehren()
      .then(result => {
        setAkzeptiert(new Set(
          result.aenderungen_bestehende
            .filter(a => a.aenderungsart !== 'keine_aenderung')
            .map(a => a.bestellung_id)
        ))
        setAusgewaehlt(new Set(result.neue_planbestellungen.map(b => b.temp_id)))

        const bestellMap = new Map<string, NeuePlanbestellung>()
        result.neue_planbestellungen.forEach(b => bestellMap.set(b.temp_id, { ...b }))
        setBearbeitet(bestellMap)

        const aenderungenMap = new Map<string, EditierteNeueDaten>()
        result.aenderungen_bestehende.forEach(a => {
          if (a.neue_daten) aenderungenMap.set(a.bestellung_id, { ...a.neue_daten })
        })
        setBearbeitetAenderungen(aenderungenMap)

        // In der Langfristplanung gibt es keine „Bestehende Bestellungen"-Seite:
        // bestehende Bestellungen werden ignoriert/neu kalkuliert → direkt Schritt 2.
        setStep(2)
      })
      .catch(() => {})
  }, [open]) // eslint-disable-line react-hooks/exhaustive-deps

  const handleClose = useCallback(() => {
    if (applying) return
    reset()
    onOpenChange(false)
  }, [applying, reset, onOpenChange])

  const konsBasePath = `/api/langfristige-planung/${versionId}/bestellplanung/konsolidierung`

  const handleAnwenden = useCallback(async () => {
    const selectedOrders = Array.from(ausgewaehlt)
      .map(id => bearbeitet.get(id))
      .filter(Boolean) as NeuePlanbestellung[]

    const akzeptierteAenderungen = (ergebnis?.aenderungen_bestehende ?? [])
      .filter(a => akzeptiert.has(a.bestellung_id))
      .map(a => {
        const editiert = bearbeitetAenderungen.get(a.bestellung_id)
        return editiert ? { ...a, neue_daten: editiert } : a
      })

    try {
      // Step 1: Bestehende Konsolidierungen auflösen (Bestelldaten unverändert lassen)
      for (const gruppeId of bestehendeKonsolidierungsGruppenIds) {
        const res = await fetch(`${konsBasePath}/${gruppeId}?dissolve_only=true`, { method: 'DELETE' })
        if (!res.ok) throw new Error('Aufheben fehlgeschlagen')
      }

      // Step 2: Bestellungen speichern (Änderungen + neue Bestellungen)
      const tempToReal = await anwenden(akzeptierteAenderungen, selectedOrders)

      // Step 3: Konsolidierungsgruppen speichern (falls vorhanden)
      if (konsolidierungsGruppen.length > 0) {
        for (const gruppe of konsolidierungsGruppen) {
          const request = {
            bestellung_ids: gruppe.mitglieder_ids.map(id => tempToReal[id] ?? id),
            aenderungen: gruppe.ergebnisse.map(e => ({
              bestellung_id: tempToReal[e.bestellung_id] ?? e.bestellung_id,
              neue_daten: {
                bestelldatum: e.neues_bestelldatum,
                produktionsstart_datum: e.neues_produktionsstart_datum,
                produktionsende_datum: e.neues_produktionsende_datum,
                shippingdatum: e.neues_shippingdatum,
                ankunftsdatum: e.neues_ankunftsdatum,
                verfuegbarkeitsdatum: e.neues_verfuegbarkeitsdatum,
              },
              neue_sku_mengen: e.neue_sku_mengen.map(s => ({
                sku_id: s.sku_id,
                menge_praktisch: s.neue_menge_praktisch,
                begruendung_anpassung: s.begruendung_anpassung,
              })),
              container_anteil: e.container_anteil,
              snapshot_vor_konsolidierung: gruppe.snapshots[e.bestellung_id] ?? {
                bestelldatum: null,
                produktionsstart_datum: null,
                produktionsende_datum: null,
                shippingdatum: null,
                ankunftsdatum: null,
                verfuegbarkeitsdatum: null,
                anzahl_40hq: 0,
                anzahl_20dc: 0,
                sku_mengen: [],
              },
            })),
          }
          const res = await fetch(konsBasePath, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(request),
          })
          if (!res.ok) throw new Error('Konsolidierung fehlgeschlagen')
        }
      }

      const parts: string[] = []
      if (selectedOrders.length > 0) parts.push(`${selectedOrders.length} Planbestellung${selectedOrders.length !== 1 ? 'en' : ''} angelegt`)
      if (akzeptierteAenderungen.length > 0) parts.push(`${akzeptierteAenderungen.length} Änderung${akzeptierteAenderungen.length !== 1 ? 'en' : ''} übernommen`)
      if (konsolidierungsGruppen.length > 0) parts.push(`${konsolidierungsGruppen.length} Konsolidierung${konsolidierungsGruppen.length !== 1 ? 'en' : ''} gespeichert`)

      toast({ title: parts.length > 0 ? parts.join(', ') : 'Keine Änderungen' })
      onComplete()
      onOpenChange(false)
    } catch {
      toast({
        title: 'Fehler',
        description: 'Bestellungen konnten nicht angelegt werden.',
        variant: 'destructive',
      })
    }
  }, [ausgewaehlt, bearbeitet, akzeptiert, bearbeitetAenderungen, konsolidierungsGruppen, bestehendeKonsolidierungsGruppenIds, anwenden, konsBasePath, ergebnis, toast, onComplete, onOpenChange])

  const toggleAkzeptiert = (id: string) =>
    setAkzeptiert(prev => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })

  const toggleAusgewaehlt = (id: string) =>
    setAusgewaehlt(prev => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })

  const updateBestellung = (updated: NeuePlanbestellung) =>
    setBearbeitet(prev => new Map(prev).set(updated.temp_id, updated))

  const updateAenderung = (id: string, updated: EditierteNeueDaten) =>
    setBearbeitetAenderungen(prev => new Map(prev).set(id, updated))

  const neueBestellungen = ergebnis?.neue_planbestellungen ?? []
  // Neue Bestellungen nach Produkt gruppieren (ein Produkt kann mehrere
  // Bestellungen über den Horizont haben).
  const neueBestellungenGruppen = useMemo(() => {
    const gruppen = new Map<string, { pid: string; name: string; items: typeof neueBestellungen }>()
    for (const b of neueBestellungen) {
      const pid = b.produkt_ids[0] ?? '—'
      const name = b.produkt_namen[0] ?? 'Unbekanntes Produkt'
      if (!gruppen.has(pid)) gruppen.set(pid, { pid, name, items: [] })
      gruppen.get(pid)!.items.push(b)
    }
    return [...gruppen.values()]
  }, [neueBestellungen])
  const aenderungen = ergebnis?.aenderungen_bestehende ?? []
  const stammdaten: ProduktStammdaten[] = ergebnis?.produkt_stammdaten ?? []
  const containerGlobal = ergebnis?.container_global ?? { volumen_20dc: null, volumen_40hq: null }
  const selectedCount = ausgewaehlt.size

  const { getLieferzeit, getMaxKapazitaet } = useMemo(
    () => buildStammdatenHelpers(stammdaten, containerGlobal),
    [stammdaten, containerGlobal],
  )

  const getTitle = () => {
    if (step === 0) return 'Bestelllauf wird durchgeführt…'
    if (step === 2) return `Bestellungen (${neueBestellungen.length})`
    return 'Konsolidierung'
  }

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-4xl h-[92vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle>{getTitle()}</DialogTitle>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto py-2">
          {/* Step 0: Loading / Error */}
          {step === 0 && (
            <div className="flex flex-col items-center justify-center py-12 gap-4">
              {loading && (
                <>
                  <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                  <p className="text-sm text-muted-foreground">Algorithmus wird ausgeführt…</p>
                  <p className="text-xs text-muted-foreground">Absatzplanung und Produktinformationen dieser Planversion werden analysiert.</p>
                </>
              )}
              {error && (
                <div className="text-center space-y-2">
                  <AlertTriangle className="h-8 w-8 text-destructive mx-auto" />
                  <p className="text-sm font-medium text-destructive">Algorithmus fehlgeschlagen</p>
                  <p className="text-xs text-muted-foreground max-w-sm">{error}</p>
                  <Button size="sm" variant="outline" onClick={handleClose}>Schließen</Button>
                </div>
              )}
            </div>
          )}

          {/* Step 2: Bestellungen (bestehende werden ignoriert/neu kalkuliert) */}
          {step === 2 && (
            <div className="space-y-3">
              {neueBestellungen.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <p className="text-sm">Keine Bestellungen empfohlen.</p>
                  <p className="text-xs mt-1">Alle Bestellzeitpunkte liegen außerhalb des aktuellen Planungshorizonts oder der Bestand ist ausreichend.</p>
                </div>
              ) : (
                <>
                  <div className="flex items-center justify-between">
                    <p className="text-xs text-muted-foreground">
                      {selectedCount} von {neueBestellungen.length} ausgewählt
                    </p>
                    <div className="flex gap-2">
                      <Button variant="ghost" size="sm" className="text-xs h-7"
                        onClick={() => setAusgewaehlt(new Set(neueBestellungen.map(b => b.temp_id)))}>
                        Alle wählen
                      </Button>
                      <Button variant="ghost" size="sm" className="text-xs h-7"
                        onClick={() => setAusgewaehlt(new Set())}>
                        Keine
                      </Button>
                    </div>
                  </div>
                  <div className="space-y-4">
                    {neueBestellungenGruppen.map(gruppe => {
                      const gruppeTempIds = gruppe.items.map(b => b.temp_id)
                      const gewaehltImGruppe = gruppeTempIds.filter(id => ausgewaehlt.has(id)).length
                      return (
                        <div key={gruppe.pid} className="space-y-2">
                          <div className="flex items-center justify-between border-b pb-1">
                            <p className="text-sm font-semibold">{gruppe.name}</p>
                            <span className="text-xs text-muted-foreground tabular-nums">
                              {gewaehltImGruppe}/{gruppe.items.length} ausgewählt
                            </span>
                          </div>
                          {gruppe.items.map(b => (
                            <NeueBestellungItem
                              key={b.temp_id}
                              b={bearbeitet.get(b.temp_id) ?? b}
                              ausgewaehlt={ausgewaehlt.has(b.temp_id)}
                              onToggleAuswahl={() => toggleAusgewaehlt(b.temp_id)}
                              onChange={updateBestellung}
                              lieferzeit={b.produkt_ids[0] ? getLieferzeit(b.produkt_ids[0]) : null}
                              kapazitaet={b.produkt_ids[0] ? getMaxKapazitaet(b.produkt_ids[0]) : null}
                            />
                          ))}
                        </div>
                      )
                    })}
                  </div>
                </>
              )}
            </div>
          )}

          {/* Step 3 */}
          {step === 3 && (
            <LangfristigerKonsolidierungsSchritt
              versionId={versionId}
              neueBestellungen={neueBestellungen}
              ausgewaehlteNeueIds={ausgewaehlt}
              stammdaten={stammdaten}
              containerGlobal={containerGlobal}
              onGruppenChange={setKonsolidierungsGruppen}
              onBestehendeGruppenIds={setBestehendeKonsolidierungsGruppenIds}
            />
          )}
        </div>

        {/* Footer */}
        {(step === 2 || step === 3) && (
          <>
            <Separator />
            <DialogFooter className="pt-2 gap-2">
              <Button variant="outline" size="sm" onClick={handleClose} disabled={applying}>
                Abbrechen
              </Button>
              {step === 3 && (
                <Button variant="outline" size="sm" onClick={() => setStep(2)} disabled={applying}>
                  ← Zurück
                </Button>
              )}
              {step === 2 && (
                <Button size="sm" onClick={() => setStep(3)}>
                  Weiter zur Konsolidierung →
                </Button>
              )}
              {step === 3 && (
                <Button
                  size="sm"
                  onClick={handleAnwenden}
                  disabled={applying || (selectedCount === 0 && akzeptiert.size === 0 && konsolidierungsGruppen.length === 0)}
                >
                  {applying ? (
                    <><Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />Wird übernommen…</>
                  ) : (() => {
                    const parts: string[] = []
                    if (akzeptiert.size > 0) parts.push(`${akzeptiert.size} Änderung${akzeptiert.size !== 1 ? 'en' : ''}`)
                    if (selectedCount > 0) parts.push(`${selectedCount} Bestellung${selectedCount !== 1 ? 'en' : ''}`)
                    if (konsolidierungsGruppen.length > 0) parts.push(`${konsolidierungsGruppen.length} Konsolidierung${konsolidierungsGruppen.length !== 1 ? 'en' : ''}`)
                    return parts.length > 0 ? `${parts.join(' & ')} übernehmen` : 'Übernehmen'
                  })()}
                </Button>
              )}
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  )
}
