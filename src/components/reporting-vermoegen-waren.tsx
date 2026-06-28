'use client'

import { useState } from 'react'
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RechartsTooltip,
  Legend,
} from 'recharts'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import { Info, LineChart as LineChartIcon } from 'lucide-react'
import type { VermoegenKPIs, ProduktDetail } from '@/hooks/use-reporting-vermoegen'

// ─── Formatierung ─────────────────────────────────────────────────────────────

function fmtEur(v: number): string {
  return new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR' }).format(v)
}

function fmtEurShort(v: number): string {
  const abs = Math.abs(v)
  if (abs >= 1_000_000) return `${(v / 1_000_000).toLocaleString('de-DE', { maximumFractionDigits: 1 })}M €`
  if (abs >= 1_000)     return `${(v / 1_000).toLocaleString('de-DE', { maximumFractionDigits: 1 })}k €`
  return `${v.toLocaleString('de-DE', { maximumFractionDigits: 0 })} €`
}

function fmtPct(v: number | null): string {
  if (v === null) return '—'
  return `${(v * 100).toLocaleString('de-DE', { maximumFractionDigits: 1 })}%`
}

function fmtMonate(v: number | null): string {
  if (v === null) return '—'
  return `${v.toLocaleString('de-DE', { maximumFractionDigits: 1 })} Monate`
}

function fmtDatumShort(datum: string): string {
  const [y, m, d] = datum.split('-')
  const mn = ['Jan','Feb','Mär','Apr','Mai','Jun','Jul','Aug','Sep','Okt','Nov','Dez']
  return `${parseInt(d)}.${mn[parseInt(m)-1]}.${y.slice(2)}`
}

function fmtDatumLang(datum: string): string {
  const [y, m, d] = datum.split('-')
  const mn = ['Januar','Februar','März','April','Mai','Juni','Juli','August','September','Oktober','November','Dezember']
  return `${parseInt(d)}. ${mn[parseInt(m)-1]} ${y}`
}

// ─── Farben ───────────────────────────────────────────────────────────────────

const C = {
  lager:        'hsl(217, 91%, 50%)',
  transit:      'hsl(142, 76%, 36%)',
  warenkapital: 'hsl(262, 83%, 58%)',
  bindung:      'hsl(38, 92%, 50%)',
  negativ:      'hsl(0, 84%, 50%)',
}

// ─── KPI-Kachel ───────────────────────────────────────────────────────────────

interface KpiCardProps {
  id: string
  title: string
  tooltip: string
  value: string
  negative?: boolean
  items?: { label: string; value: string }[]
  selected?: boolean
  onSelect: (id: string) => void
}

function KpiCard({ id, title, tooltip, value, negative, items, selected, onSelect }: KpiCardProps) {
  return (
    <Card
      onClick={() => onSelect(id)}
      className={`cursor-pointer transition-all ${selected ? 'ring-2 ring-primary shadow-sm' : 'hover:bg-muted/30'}`}
    >
      <CardHeader className="pb-1 pt-4 px-4">
        <CardTitle className="text-xs font-medium text-muted-foreground uppercase tracking-wide flex items-center gap-1">
          <span>{title}</span>
          <Tooltip>
            <TooltipTrigger asChild>
              <Info className="h-3 w-3 cursor-help flex-shrink-0" onClick={(e) => e.stopPropagation()} />
            </TooltipTrigger>
            <TooltipContent side="top" className="max-w-xs text-xs">
              {tooltip}
            </TooltipContent>
          </Tooltip>
        </CardTitle>
      </CardHeader>
      <CardContent className="pb-4 px-4">
        <p className={`text-2xl font-semibold tabular-nums ${negative ? 'text-destructive' : ''}`}>
          {value}
        </p>
        {items && items.length > 0 && (
          <div className="mt-2 space-y-0.5 text-xs text-muted-foreground border-t pt-1.5">
            {items.map((item) => (
              <div key={item.label} className="flex justify-between gap-2">
                <span>{item.label}</span>
                <span className="tabular-nums">{item.value}</span>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  )
}

// ─── Kein-Zeitreihen-Hinweis ──────────────────────────────────────────────────

function NoSeries() {
  return (
    <div className="rounded-lg border border-dashed p-4">
      <div className="flex flex-col items-center justify-center h-32 gap-2 text-muted-foreground text-sm">
        <LineChartIcon className="h-6 w-6" />
        Für Zeitreihen sind mindestens 2 Snapshots erforderlich.
      </div>
    </div>
  )
}

// ─── CSS-Balkendiagramm ───────────────────────────────────────────────────────

type BarSeg = { color: string; value: number; label?: string }
type BarRowDef = { name: string; segments: BarSeg[] }

function CssBarChart({
  rows,
  formatValue = fmtEur,
}: {
  rows: BarRowDef[]
  formatValue?: (v: number) => string
}) {
  const maxTotal = Math.max(
    ...rows.map((r) => r.segments.reduce((s, seg) => s + Math.max(seg.value, 0), 0)),
    1
  )
  return (
    <TooltipProvider delayDuration={200}>
      <div className="space-y-2.5">
        {rows.map((row) => {
          const segs = row.segments.filter((s) => s.value > 0)
          const total = row.segments.reduce((s, seg) => s + Math.max(seg.value, 0), 0)
          const widthPct = (total / maxTotal) * 100
          const hasMulti = segs.length > 1
          const barInner = (
            <div className="flex h-7 rounded-sm overflow-hidden" style={{ width: `${widthPct}%` }}>
              {segs.map((seg, i) => (
                <div key={i} style={{ width: `${(seg.value / total) * 100}%`, background: seg.color }} />
              ))}
            </div>
          )
          return (
            <div key={row.name} className="space-y-1">
              <div className="flex justify-between items-center text-xs">
                <span className="text-muted-foreground">{row.name}</span>
                <span className="tabular-nums font-medium">{formatValue(total)}</span>
              </div>
              {hasMulti ? (
                <Tooltip>
                  <TooltipTrigger className="w-full block text-left focus-visible:outline-none">
                    {barInner}
                  </TooltipTrigger>
                  <TooltipContent side="top" className="text-xs p-2.5 min-w-[180px]">
                    <p className="font-semibold border-b pb-1 mb-1">{row.name}</p>
                    {segs.map((seg, i) => (
                      <div key={i} className="flex items-center gap-2 py-0.5">
                        <span className="h-2 w-2 rounded-full flex-shrink-0" style={{ background: seg.color }} />
                        <span className="text-muted-foreground">{seg.label ?? `Teil ${i + 1}`}:</span>
                        <span className="ml-auto tabular-nums">{formatValue(seg.value)}</span>
                      </div>
                    ))}
                    <div className="flex gap-2 border-t pt-1 mt-1 font-semibold">
                      <span>Gesamt</span>
                      <span className="ml-auto tabular-nums">{formatValue(total)}</span>
                    </div>
                  </TooltipContent>
                </Tooltip>
              ) : (
                <div className="w-full">{barInner}</div>
              )}
            </div>
          )
        })}
      </div>
    </TooltipProvider>
  )
}

// ─── Detail-Ansichten ─────────────────────────────────────────────────────────

interface DetailProps {
  kpi: string
  latest: VermoegenKPIs
  series: VermoegenKPIs[]
  produkt_details: ProduktDetail[]
}

function WarenDetail({ kpi, latest, series, produkt_details }: DetailProps) {
  const hasSeries = series.length >= 2

  if (kpi === 'warenkapital') {
    const sorted = [...produkt_details].sort((a, b) => b.warenkapital - a.warenkapital)
    const rows = sorted.map((p) => ({
      name: p.name,
      segments: [
        { color: C.lager, value: p.lager, label: 'Lager' },
        { color: C.transit, value: p.transit, label: 'Transit' },
      ],
    }))
    const seriesData = series.map((s) => ({ name: fmtDatumShort(s.datum), label: fmtDatumLang(s.datum), lager: s.lager, transit: s.transit, warenkapital: s.warenkapital }))
    return (
      <div className="space-y-4">
        <div className="rounded-lg border p-4 space-y-3">
          <span className="text-sm font-medium">Warenkapital nach Produkt</span>
          <CssBarChart rows={rows} />
          <div className="flex justify-center gap-5 pt-1">
            {[{ label: 'Lager', color: C.lager }, { label: 'Transit', color: C.transit }].map((l) => (
              <div key={l.label} className="flex items-center gap-1.5 text-xs">
                <span className="inline-block h-3 w-3 rounded-sm" style={{ background: l.color }} />
                <span className="text-muted-foreground">{l.label}</span>
              </div>
            ))}
          </div>
        </div>
        {hasSeries ? (
          <div className="rounded-lg border p-4 space-y-3">
            <span className="text-sm font-medium">Warenkapital-Entwicklung</span>
            <ResponsiveContainer width="100%" height={220}>
              <AreaChart data={seriesData} margin={{ top: 4, right: 16, left: 4, bottom: 4 }}>
                <defs>
                  <linearGradient id="gradLagerD" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor={C.lager} stopOpacity={0.35} />
                    <stop offset="95%" stopColor={C.lager} stopOpacity={0.05} />
                  </linearGradient>
                  <linearGradient id="gradTransitD" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor={C.transit} stopOpacity={0.35} />
                    <stop offset="95%" stopColor={C.transit} stopOpacity={0.05} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="name" tick={{ fontSize: 11 }} tickLine={false} axisLine={{ stroke: 'hsl(var(--border))' }} />
                <YAxis tickFormatter={fmtEurShort} tick={{ fontSize: 11 }} tickLine={false} axisLine={false} width={72} />
                <RechartsTooltip content={({ active, payload, label }) => {
                  if (!active || !payload?.length) return null
                  const entry = payload[0]?.payload
                  const lager   = (payload.find((e) => e.dataKey === 'lager')?.value as number) ?? 0
                  const transit = (payload.find((e) => e.dataKey === 'transit')?.value as number) ?? 0
                  return (
                    <div className="rounded-lg border bg-background p-2.5 shadow-md text-xs space-y-1 min-w-[180px]">
                      <p className="font-semibold border-b pb-1 mb-1">{entry?.label ?? label}</p>
                      <div className="flex items-center gap-2"><span className="h-2 w-2 rounded-full flex-shrink-0" style={{ background: C.lager }} /><span className="text-muted-foreground">Lager:</span><span className="ml-auto font-medium tabular-nums">{fmtEur(lager)}</span></div>
                      <div className="flex items-center gap-2"><span className="h-2 w-2 rounded-full flex-shrink-0" style={{ background: C.transit }} /><span className="text-muted-foreground">Transit:</span><span className="ml-auto font-medium tabular-nums">{fmtEur(transit)}</span></div>
                      <div className="flex items-center gap-2 border-t pt-1 mt-0.5 font-medium"><span className="text-muted-foreground">Gesamt:</span><span className="ml-auto tabular-nums">{fmtEur(lager + transit)}</span></div>
                    </div>
                  )
                }} />
                <Legend content={() => (
                  <div className="flex justify-center gap-5 pt-2">
                    {[{ label: 'Lager', color: C.lager }, { label: 'Transit', color: C.transit }].map((l) => (
                      <div key={l.label} className="flex items-center gap-1.5 text-xs">
                        <span className="inline-block h-3 w-3 rounded-sm" style={{ background: l.color, opacity: 0.7 }} />
                        <span className="text-muted-foreground">{l.label}</span>
                      </div>
                    ))}
                  </div>
                )} />
                <Area type="linear" dataKey="lager"   stackId="a" stroke={C.lager}   strokeWidth={2} fill="url(#gradLagerD)"   dot={false} activeDot={{ r: 4 }} />
                <Area type="linear" dataKey="transit" stackId="a" stroke={C.transit} strokeWidth={2} fill="url(#gradTransitD)" dot={false} activeDot={{ r: 4 }} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        ) : <NoSeries />}
      </div>
    )
  }

  if (kpi === 'lager_anteil') {
    const rows = [
      { name: 'Lager', segments: [{ color: C.lager, value: latest.lager }] },
      { name: 'Transit', segments: [{ color: C.transit, value: latest.transit }] },
    ]
    const seriesData = series.map((s) => ({ name: fmtDatumShort(s.datum), label: fmtDatumLang(s.datum), value: s.lager_anteil !== null ? s.lager_anteil * 100 : null }))
    return (
      <div className="space-y-4">
        <div className="rounded-lg border p-4 space-y-3">
          <span className="text-sm font-medium">Zusammensetzung Warenkapital</span>
          <CssBarChart rows={rows} />
        </div>
        {hasSeries ? (
          <div className="rounded-lg border p-4 space-y-3">
            <span className="text-sm font-medium">Lager-Anteil-Entwicklung</span>
            <ResponsiveContainer width="100%" height={200}>
              <LineChart data={seriesData} margin={{ top: 4, right: 16, left: 4, bottom: 4 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="name" tick={{ fontSize: 11 }} tickLine={false} axisLine={{ stroke: 'hsl(var(--border))' }} />
                <YAxis tickFormatter={(v) => `${v.toLocaleString('de-DE', { maximumFractionDigits: 0 })}%`} tick={{ fontSize: 11 }} tickLine={false} axisLine={false} width={40} />
                <RechartsTooltip content={({ active, payload, label }) => {
                  if (!active || !payload?.length) return null
                  const entry = payload[0]?.payload
                  return <div className="rounded-lg border bg-background p-2.5 shadow-md text-xs min-w-[160px]"><p className="font-semibold border-b pb-1 mb-1">{entry?.label ?? label}</p><div className="flex items-center gap-2"><span className="text-muted-foreground">Lager-Anteil:</span><span className="ml-auto font-medium tabular-nums">{payload[0]?.value !== null ? `${(payload[0]?.value as number).toLocaleString('de-DE', { maximumFractionDigits: 1 })}%` : '—'}</span></div></div>
                }} />
                <Line type="linear" dataKey="value" stroke={C.lager} strokeWidth={2} dot={false} activeDot={{ r: 4 }} connectNulls={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        ) : <NoSeries />}
      </div>
    )
  }

  if (kpi === 'warenkapitalbindung') {
    const rows = [
      {
        name: 'Warenkapital',
        segments: [{ color: C.warenkapital, value: latest.warenkapital }],
      },
      {
        name: '= Bindung + Verb. L&L',
        segments: [
          { color: C.bindung, value: latest.warenkapitalbindung, label: 'Warenkapitalbindung' },
          { color: C.negativ, value: latest.verb_ll, label: 'Verb. L&L' },
        ],
      },
    ]
    const seriesData = series.map((s) => ({ name: fmtDatumShort(s.datum), label: fmtDatumLang(s.datum), value: s.warenkapitalbindung }))
    return (
      <div className="space-y-4">
        <div className="rounded-lg border p-4 space-y-3">
          <span className="text-sm font-medium">Komponenten der Warenkapitalbindung</span>
          <CssBarChart rows={rows} />
          <div className="flex flex-wrap justify-center gap-x-4 gap-y-1 pt-1">
            {[{ label: 'Warenkapital', color: C.warenkapital }, { label: 'Warenkapitalbindung', color: C.bindung }, { label: 'Verb. L&L', color: C.negativ }].map((l) => (
              <div key={l.label} className="flex items-center gap-1.5 text-xs">
                <span className="inline-block h-3 w-3 rounded-sm" style={{ background: l.color }} />
                <span className="text-muted-foreground">{l.label}</span>
              </div>
            ))}
          </div>
        </div>
        {hasSeries ? (
          <div className="rounded-lg border p-4 space-y-3">
            <span className="text-sm font-medium">Warenkapitalbindung-Entwicklung</span>
            <ResponsiveContainer width="100%" height={200}>
              <LineChart data={seriesData} margin={{ top: 4, right: 16, left: 4, bottom: 4 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="name" tick={{ fontSize: 11 }} tickLine={false} axisLine={{ stroke: 'hsl(var(--border))' }} />
                <YAxis tickFormatter={fmtEurShort} tick={{ fontSize: 11 }} tickLine={false} axisLine={false} width={72} />
                <RechartsTooltip content={({ active, payload, label }) => {
                  if (!active || !payload?.length) return null
                  const entry = payload[0]?.payload
                  return <div className="rounded-lg border bg-background p-2.5 shadow-md text-xs min-w-[200px]"><p className="font-semibold border-b pb-1 mb-1">{entry?.label ?? label}</p><div className="flex items-center gap-2"><span className="h-2 w-2 rounded-full" style={{ background: C.warenkapital }} /><span className="text-muted-foreground">Warenkapitalbindung:</span><span className="ml-auto font-medium tabular-nums">{fmtEur(payload[0]?.value as number)}</span></div></div>
                }} />
                <Line type="linear" dataKey="value" stroke={C.warenkapital} strokeWidth={2} dot={false} activeDot={{ r: 4 }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        ) : <NoSeries />}
      </div>
    )
  }

  if (kpi === 'warenbindungsquote') {
    const nettoUV = latest.warenkapital + latest.cash + latest.gesamt_forderungen - latest.verb_ll - latest.verb_sonstige
    const rows = [
      { name: 'Warenkapitalbindung',          segments: [{ color: C.bindung,      value: latest.warenkapitalbindung }] },
      { name: 'Working Capital',               segments: [{ color: C.lager,        value: nettoUV }] },
      { name: 'Umlaufvermögen', segments: [
        { color: C.warenkapital,           value: latest.warenkapital,        label: 'Warenkapital' },
        { color: 'hsl(198, 93%, 40%)',     value: latest.cash,                label: 'Cash' },
        { color: 'hsl(217, 71%, 65%)',     value: latest.gesamt_forderungen,  label: 'Forderungen' },
      ]},
      { name: 'Verbindlichkeiten', segments: [
        { color: C.negativ,                value: latest.verb_ll,             label: 'Verb. L&L' },
        { color: 'hsl(0, 65%, 38%)',       value: latest.verb_sonstige,       label: 'Verb. Sonst.' },
      ]},
    ]
    const seriesData = series.map((s) => ({ name: fmtDatumShort(s.datum), label: fmtDatumLang(s.datum), value: s.warenbindungsquote !== null ? s.warenbindungsquote * 100 : null }))
    return (
      <div className="space-y-4">
        <div className="rounded-lg border p-4 space-y-3">
          <span className="text-sm font-medium">Komponenten der Warenbindungsquote</span>
          <CssBarChart rows={rows} />
          <div className="flex flex-wrap justify-center gap-x-4 gap-y-1 pt-1">
            {[
              { label: 'Warenkapitalbindung',  color: C.bindung },
              { label: 'Working Capital',      color: C.lager },
              { label: 'Warenkapital',         color: C.warenkapital },
              { label: 'Cash',                 color: 'hsl(198,93%,40%)' },
              { label: 'Forderungen',          color: 'hsl(217,71%,65%)' },
              { label: 'Verb. L&L',            color: C.negativ },
              { label: 'Verb. Sonst.',         color: 'hsl(0,65%,38%)' },
            ].map((l) => (
              <div key={l.label} className="flex items-center gap-1.5 text-xs">
                <span className="inline-block h-3 w-3 rounded-sm" style={{ background: l.color }} />
                <span className="text-muted-foreground">{l.label}</span>
              </div>
            ))}
          </div>
        </div>
        {hasSeries ? (
          <div className="rounded-lg border p-4 space-y-3">
            <span className="text-sm font-medium">Warenbindungsquote-Entwicklung</span>
            <ResponsiveContainer width="100%" height={200}>
              <LineChart data={seriesData} margin={{ top: 4, right: 16, left: 4, bottom: 4 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="name" tick={{ fontSize: 11 }} tickLine={false} axisLine={{ stroke: 'hsl(var(--border))' }} />
                <YAxis tickFormatter={(v) => `${v.toLocaleString('de-DE', { maximumFractionDigits: 1 })}%`} tick={{ fontSize: 11 }} tickLine={false} axisLine={false} width={40} />
                <RechartsTooltip content={({ active, payload, label }) => {
                  if (!active || !payload?.length) return null
                  const entry = payload[0]?.payload
                  const v = payload[0]?.value as number | null
                  return <div className="rounded-lg border bg-background p-2.5 shadow-md text-xs min-w-[180px]"><p className="font-semibold border-b pb-1 mb-1">{entry?.label ?? label}</p><div className="flex items-center gap-2"><span className="text-muted-foreground">Warenbindungsquote:</span><span className="ml-auto font-medium tabular-nums">{v !== null ? `${v.toLocaleString('de-DE', { maximumFractionDigits: 1 })}%` : '—'}</span></div></div>
                }} />
                <Line type="linear" dataKey="value" stroke={C.bindung} strokeWidth={2} dot={false} activeDot={{ r: 4 }} connectNulls={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        ) : <NoSeries />}
      </div>
    )
  }

  if (kpi === 'lagerreichweite') {
    const withLR = produkt_details.filter((p) => p.lagerreichweite !== null).sort((a, b) => (b.lagerreichweite ?? 0) - (a.lagerreichweite ?? 0))
    const rows = withLR.map((p) => ({
      name: p.name,
      segments: [{ color: C.warenkapital, value: p.lagerreichweite ?? 0 }],
    }))
    const seriesData = series.map((s) => ({ name: fmtDatumShort(s.datum), label: fmtDatumLang(s.datum), value: s.lagerreichweite }))
    return (
      <div className="space-y-4">
        {rows.length > 0 && (
          <div className="rounded-lg border p-4 space-y-3">
            <span className="text-sm font-medium">Lagerreichweite nach Produkt (Monate)</span>
            <CssBarChart rows={rows} formatValue={fmtMonate} />
          </div>
        )}
        {hasSeries ? (
          <div className="rounded-lg border p-4 space-y-3">
            <span className="text-sm font-medium">Lagerreichweite-Entwicklung (gesamt)</span>
            <ResponsiveContainer width="100%" height={200}>
              <LineChart data={seriesData} margin={{ top: 4, right: 16, left: 4, bottom: 4 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="name" tick={{ fontSize: 11 }} tickLine={false} axisLine={{ stroke: 'hsl(var(--border))' }} />
                <YAxis tickFormatter={(v) => `${v.toLocaleString('de-DE', { maximumFractionDigits: 1 })} M`} tick={{ fontSize: 11 }} tickLine={false} axisLine={false} width={52} />
                <RechartsTooltip content={({ active, payload, label }) => {
                  if (!active || !payload?.length) return null
                  const entry = payload[0]?.payload
                  return <div className="rounded-lg border bg-background p-2.5 shadow-md text-xs min-w-[180px]"><p className="font-semibold border-b pb-1 mb-1">{entry?.label ?? label}</p><div className="flex items-center gap-2"><span className="text-muted-foreground">Lagerreichweite:</span><span className="ml-auto font-medium tabular-nums">{fmtMonate(payload[0]?.value as number | null)}</span></div></div>
                }} />
                <Line type="linear" dataKey="value" stroke={C.warenkapital} strokeWidth={2} dot={false} activeDot={{ r: 4 }} connectNulls={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        ) : <NoSeries />}
      </div>
    )
  }

  return null
}

// ─── Komponente ───────────────────────────────────────────────────────────────

interface Props {
  latest: VermoegenKPIs
  series: VermoegenKPIs[]
  produkt_details: ProduktDetail[]
}

export function ReportingVermoegenWaren({ latest, series, produkt_details }: Props) {
  const [selectedKpi, setSelectedKpi] = useState<string | null>(null)
  const hasSeries = series.length >= 2

  function handleSelect(id: string) {
    setSelectedKpi((prev) => (prev === id ? null : id))
  }

  const nettoUV = latest.warenkapital + latest.gesamt_forderungen + latest.cash - latest.verb_ll - latest.verb_sonstige

  const chartDataWK    = series.map((s) => ({ name: fmtDatumShort(s.datum), label: fmtDatumLang(s.datum), lager: s.lager, transit: s.transit, warenkapital: s.warenkapital }))
  const chartDataWKB   = series.map((s) => ({ name: fmtDatumShort(s.datum), label: fmtDatumLang(s.datum), value: s.warenkapitalbindung }))
  const chartDataQuote = series.map((s) => ({ name: fmtDatumShort(s.datum), label: fmtDatumLang(s.datum), quote: s.warenbindungsquote !== null ? s.warenbindungsquote * 100 : null }))

  return (
    <TooltipProvider>
      <div className="space-y-6 pt-4">
        {/* KPI-Kacheln */}
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
          <KpiCard
            id="warenkapital"
            title="Warenkapital"
            tooltip="Gesamtwert aller Waren. Lager + Transit."
            value={fmtEur(latest.warenkapital)}
            selected={selectedKpi === 'warenkapital'}
            onSelect={handleSelect}
            items={[
              { label: 'Lager', value: fmtEur(latest.lager) },
              { label: 'Transit', value: fmtEur(latest.transit) },
            ]}
          />
          <KpiCard
            id="lager_anteil"
            title="Lager-Anteil"
            tooltip="Anteil des Lagerbestands am Warenkapital. Lager ÷ Warenkapital."
            value={fmtPct(latest.lager_anteil)}
            selected={selectedKpi === 'lager_anteil'}
            onSelect={handleSelect}
            items={[
              { label: 'Lager', value: fmtEur(latest.lager) },
              { label: 'Warenkapital', value: fmtEur(latest.warenkapital) },
            ]}
          />
          <KpiCard
            id="warenkapitalbindung"
            title="Warenkapitalbindung"
            tooltip="Netto gebundenes Kapital in Waren nach Abzug der Lieferantenverbindlichkeiten. Warenkapital − Verbindlichkeiten L&L."
            value={fmtEur(latest.warenkapitalbindung)}
            negative={latest.warenkapitalbindung < 0}
            selected={selectedKpi === 'warenkapitalbindung'}
            onSelect={handleSelect}
            items={[
              { label: 'Warenkapital', value: fmtEur(latest.warenkapital) },
              { label: 'Verb. L&L', value: fmtEur(latest.verb_ll) },
            ]}
          />
          <KpiCard
            id="warenbindungsquote"
            title="Warenbindungsquote"
            tooltip="Anteil der Warenkapitalbindung am Working Capital. Warenkapitalbindung ÷ (Warenkapital + Forderungen + Cash − kurzfristige Verbindlichkeiten)."
            value={fmtPct(latest.warenbindungsquote)}
            selected={selectedKpi === 'warenbindungsquote'}
            onSelect={handleSelect}
            items={[
              { label: 'Warenkapitalbindung', value: fmtEur(latest.warenkapitalbindung) },
              { label: 'Working Capital', value: fmtEur(nettoUV) },
            ]}
          />
          <KpiCard
            id="lagerreichweite"
            title="Lagerreichweite"
            tooltip="Wie viele Monate der Warenbestand bei durchschnittlichem Absatz reicht. Je Produkt: Warenkapital ÷ (Ø-Monatssendungen × Produktkosten); der Gesamtwert ist der nach Warenkapital gewichtete Durchschnitt dieser Produkt-Reichweiten (Produkte ohne Absatz ausgeschlossen)."
            value={fmtMonate(latest.lagerreichweite)}
            selected={selectedKpi === 'lagerreichweite'}
            onSelect={handleSelect}
            items={[
              { label: 'Warenkapital', value: fmtEur(latest.warenkapital) },
              { label: 'Ø Monatssendungen', value: latest.avg_monatssendungen > 0 ? latest.avg_monatssendungen.toLocaleString('de-DE', { maximumFractionDigits: 1 }) : '—' },
            ]}
          />
        </div>

        {/* Detail oder globale Zeitreihen */}
        {selectedKpi ? (
          <WarenDetail kpi={selectedKpi} latest={latest} series={series} produkt_details={produkt_details} />
        ) : hasSeries ? (
          <>
            <div className="rounded-lg border p-4 space-y-3">
              <span className="text-sm font-medium">Warenkapital-Entwicklung</span>
              <ResponsiveContainer width="100%" height={280}>
                <AreaChart data={chartDataWK} margin={{ top: 4, right: 16, left: 4, bottom: 4 }}>
                  <defs>
                    <linearGradient id="gradLager" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor={C.lager} stopOpacity={0.35} />
                      <stop offset="95%" stopColor={C.lager} stopOpacity={0.05} />
                    </linearGradient>
                    <linearGradient id="gradTransit" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor={C.transit} stopOpacity={0.35} />
                      <stop offset="95%" stopColor={C.transit} stopOpacity={0.05} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="name" tick={{ fontSize: 11 }} tickLine={false} axisLine={{ stroke: 'hsl(var(--border))' }} />
                  <YAxis tickFormatter={fmtEurShort} tick={{ fontSize: 11 }} tickLine={false} axisLine={false} width={76} />
                  <RechartsTooltip content={({ active, payload, label }) => {
                    if (!active || !payload?.length) return null
                    const entry = payload[0]?.payload
                    const lager   = (payload.find((e) => e.dataKey === 'lager')?.value as number) ?? 0
                    const transit = (payload.find((e) => e.dataKey === 'transit')?.value as number) ?? 0
                    return (
                      <div className="rounded-lg border bg-background p-2.5 shadow-md text-xs space-y-1 min-w-[200px]">
                        <p className="font-semibold border-b pb-1 mb-1.5">{entry?.label ?? label}</p>
                        <div className="flex items-center gap-2"><span className="h-2 w-2 rounded-full flex-shrink-0" style={{ background: C.lager }} /><span className="text-muted-foreground">Lager:</span><span className="ml-auto font-medium tabular-nums">{fmtEur(lager)}</span></div>
                        <div className="flex items-center gap-2"><span className="h-2 w-2 rounded-full flex-shrink-0" style={{ background: C.transit }} /><span className="text-muted-foreground">Transit:</span><span className="ml-auto font-medium tabular-nums">{fmtEur(transit)}</span></div>
                        <div className="flex items-center gap-2 border-t pt-1 mt-0.5 font-medium"><span className="text-muted-foreground">Gesamt:</span><span className="ml-auto tabular-nums">{fmtEur(lager + transit)}</span></div>
                      </div>
                    )
                  }} />
                  <Legend content={() => (
                    <div className="flex flex-wrap justify-center gap-x-5 gap-y-1 pt-2">
                      {[{ label: 'Lager', color: C.lager }, { label: 'Transit', color: C.transit }].map((l) => (
                        <div key={l.label} className="flex items-center gap-1.5 text-xs">
                          <span className="inline-block h-3 w-3 rounded-sm" style={{ background: l.color, opacity: 0.7 }} />
                          <span className="text-muted-foreground">{l.label}</span>
                        </div>
                      ))}
                    </div>
                  )} />
                  <Area type="linear" dataKey="lager"   stackId="a" stroke={C.lager}   strokeWidth={2} fill="url(#gradLager)"   dot={false} activeDot={{ r: 4 }} />
                  <Area type="linear" dataKey="transit" stackId="a" stroke={C.transit} strokeWidth={2} fill="url(#gradTransit)" dot={false} activeDot={{ r: 4 }} />
                </AreaChart>
              </ResponsiveContainer>
            </div>
            <div className="rounded-lg border p-4 space-y-3">
              <span className="text-sm font-medium">Warenkapitalbindung-Entwicklung</span>
              <ResponsiveContainer width="100%" height={220}>
                <LineChart data={chartDataWKB} margin={{ top: 4, right: 16, left: 4, bottom: 4 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="name" tick={{ fontSize: 11 }} tickLine={false} axisLine={{ stroke: 'hsl(var(--border))' }} />
                  <YAxis tickFormatter={fmtEurShort} tick={{ fontSize: 11 }} tickLine={false} axisLine={false} width={76} />
                  <RechartsTooltip content={({ active, payload, label }) => {
                    if (!active || !payload?.length) return null
                    const entry = payload[0]?.payload
                    return <div className="rounded-lg border bg-background p-2.5 shadow-md text-xs min-w-[200px]"><p className="font-semibold border-b pb-1 mb-1.5">{entry?.label ?? label}</p><div className="flex items-center gap-2"><span className="h-2 w-2 rounded-full" style={{ background: C.warenkapital }} /><span className="text-muted-foreground">Warenkapitalbindung:</span><span className="ml-auto font-medium tabular-nums">{fmtEur(payload[0]?.value as number)}</span></div></div>
                  }} />
                  <Line type="linear" dataKey="value" stroke={C.warenkapital} strokeWidth={2} dot={false} activeDot={{ r: 4 }} />
                </LineChart>
              </ResponsiveContainer>
            </div>
            <div className="rounded-lg border p-4 space-y-3">
              <span className="text-sm font-medium">Warenbindungsquote-Entwicklung</span>
              <ResponsiveContainer width="100%" height={220}>
                <LineChart data={chartDataQuote} margin={{ top: 4, right: 16, left: 4, bottom: 4 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="name" tick={{ fontSize: 11 }} tickLine={false} axisLine={{ stroke: 'hsl(var(--border))' }} />
                  <YAxis tickFormatter={(v) => `${v.toLocaleString('de-DE', { maximumFractionDigits: 1 })}%`} tick={{ fontSize: 11 }} tickLine={false} axisLine={false} width={56} />
                  <RechartsTooltip content={({ active, payload, label }) => {
                    if (!active || !payload?.length) return null
                    const entry = payload[0]?.payload
                    const v = payload[0]?.value as number | null
                    return <div className="rounded-lg border bg-background p-2.5 shadow-md text-xs min-w-[180px]"><p className="font-semibold border-b pb-1 mb-1.5">{entry?.label ?? label}</p><div className="flex items-center gap-2"><span className="h-2 w-2 rounded-full" style={{ background: C.bindung }} /><span className="text-muted-foreground">Warenbindungsquote:</span><span className="ml-auto font-medium tabular-nums">{v !== null ? `${v.toLocaleString('de-DE', { maximumFractionDigits: 1 })}%` : '—'}</span></div></div>
                  }} />
                  <Line type="linear" dataKey="quote" stroke={C.bindung} strokeWidth={2} dot={false} activeDot={{ r: 4 }} connectNulls={false} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </>
        ) : (
          <NoSeries />
        )}
      </div>
    </TooltipProvider>
  )
}
