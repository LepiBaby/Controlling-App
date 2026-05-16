'use client'

import { useState } from 'react'
import {
  ResponsiveContainer,
  LineChart,
  AreaChart,
  BarChart,
  Bar,
  Area,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RechartsTooltip,
  Legend,
  ReferenceLine,
} from 'recharts'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import { Info, LineChart as LineChartIcon } from 'lucide-react'
import type { VermoegenKPIs } from '@/hooks/use-reporting-vermoegen'

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

// ─── Ampel ────────────────────────────────────────────────────────────────────

type AmpelColor = 'green' | 'yellow' | 'red'

function ampelEkQuote(v: number | null): AmpelColor | null {
  if (v === null) return null
  if (v >= 0.30) return 'green'
  if (v >= 0.15) return 'yellow'
  return 'red'
}

const AMPEL_CLASS: Record<AmpelColor, string> = {
  green:  'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200',
  yellow: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200',
  red:    'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200',
}
const AMPEL_LABEL: Record<AmpelColor, string> = {
  green:  'Gut',
  yellow: 'Akzeptabel',
  red:    'Kritisch',
}

// ─── KPI-Kachel ───────────────────────────────────────────────────────────────

interface KpiCardProps {
  id: string
  title: string
  tooltip: string
  value: string
  sub?: string
  ampelColor?: AmpelColor | null
  items?: ({ label: string; value: string } | { separator: true })[]
  selected?: boolean
  onSelect: (id: string) => void
}

function KpiCard({ id, title, tooltip, value, sub, ampelColor, items, selected, onSelect }: KpiCardProps) {
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
      <CardContent className="pb-4 px-4 space-y-1">
        <div className="flex items-baseline gap-2">
          <p className="text-2xl font-semibold tabular-nums">{value}</p>
          {ampelColor && (
            <Badge className={`text-xs px-1.5 py-0 h-5 ${AMPEL_CLASS[ampelColor]}`} variant="outline">
              {AMPEL_LABEL[ampelColor]}
            </Badge>
          )}
        </div>
        {sub && <p className="text-xs text-muted-foreground">{sub}</p>}
        {items && items.length > 0 && (
          <div className="space-y-0.5 text-xs text-muted-foreground border-t pt-1.5 mt-1">
            {items.map((item, i) =>
              'separator' in item
                ? <hr key={i} className="border-dashed border-muted-foreground/30 my-1" />
                : (
                  <div key={item.label} className="flex justify-between gap-2">
                    <span>{item.label}</span>
                    <span className="tabular-nums">{item.value}</span>
                  </div>
                )
            )}
          </div>
        )}
      </CardContent>
    </Card>
  )
}

// ─── Farben ───────────────────────────────────────────────────────────────────

const C = {
  ek:     'hsl(142, 76%, 36%)',
  fk:     'hsl(0, 84%, 50%)',
  quote:  'hsl(217, 91%, 50%)',
  cash:   'hsl(38, 92%, 50%)',
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

// ─── Hilfs-Charts ─────────────────────────────────────────────────────────────

function HorizBar({ data }: { data: { name: string; value: number; fill: string }[] }) {
  const max = Math.max(...data.map((d) => Math.abs(d.value)), 1)
  return (
    <div className="space-y-3 py-1">
      {data.map((entry) => (
        <div key={entry.name} className="space-y-1.5">
          <div className="flex justify-between items-center text-xs">
            <span className="text-muted-foreground truncate mr-2">{entry.name}</span>
            <span className="tabular-nums font-medium flex-shrink-0">{fmtEur(entry.value)}</span>
          </div>
          <div className="w-full h-7 rounded-sm overflow-hidden bg-muted/30">
            <div
              className="h-full rounded-sm"
              style={{ width: `${(Math.abs(entry.value) / max) * 100}%`, background: entry.fill }}
            />
          </div>
        </div>
      ))}
    </div>
  )
}

function CssStackedBar({ segments, label }: {
  segments: { key: string; label: string; color: string; value: number }[]
  label: string
}) {
  const visible = segments.filter((s) => s.value > 0)
  const total = visible.reduce((s, c) => s + c.value, 0)
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <div className="flex w-full h-9 rounded-md overflow-hidden cursor-default">
          {visible.map((s) => (
            <div
              key={s.key}
              style={{ width: `${(s.value / total) * 100}%`, background: s.color }}
            />
          ))}
        </div>
      </TooltipTrigger>
      <TooltipContent side="top" className="text-xs p-2.5 min-w-[200px]">
        <p className="font-semibold border-b pb-1 mb-1">{label}</p>
        {visible.map((c) => (
          <div key={c.key} className="flex items-center gap-2 py-0.5">
            <span className="h-2 w-2 rounded-full flex-shrink-0" style={{ background: c.color }} />
            <span className="text-muted-foreground">{c.label}:</span>
            <span className="ml-auto tabular-nums">{fmtEur(c.value)}</span>
          </div>
        ))}
        <div className="flex gap-2 border-t pt-1 mt-1 font-semibold">
          <span>Gesamt</span><span className="ml-auto tabular-nums">{fmtEur(total)}</span>
        </div>
      </TooltipContent>
    </Tooltip>
  )
}

function SingleLine({ seriesData, color, label, formatter }: {
  seriesData: { name: string; label: string; value: number | null }[]
  color: string
  label: string
  formatter?: (v: number) => string
}) {
  const fmt = formatter ?? fmtEur
  return (
    <ResponsiveContainer width="100%" height={200}>
      <LineChart data={seriesData} margin={{ top: 4, right: 16, left: 4, bottom: 4 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
        <XAxis dataKey="name" tick={{ fontSize: 11 }} tickLine={false} axisLine={{ stroke: 'hsl(var(--border))' }} />
        <YAxis tickFormatter={formatter ?? fmtEurShort} tick={{ fontSize: 11 }} tickLine={false} axisLine={false} width={72} />
        <RechartsTooltip content={({ active, payload }) => {
          if (!active || !payload?.length) return null
          const entry = payload[0]?.payload
          const v = payload[0]?.value as number | null
          return <div className="rounded-lg border bg-background p-2.5 shadow-md text-xs min-w-[180px]"><p className="font-semibold border-b pb-1 mb-1">{entry?.label}</p><div className="flex items-center gap-2"><span className="text-muted-foreground">{label}:</span><span className="ml-auto font-medium tabular-nums">{v !== null && v !== undefined ? fmt(v) : '—'}</span></div></div>
        }} />
        <Line type="linear" dataKey="value" stroke={color} strokeWidth={2} dot={false} activeDot={{ r: 4 }} connectNulls={false} />
      </LineChart>
    </ResponsiveContainer>
  )
}

// ─── Detail-Ansichten ─────────────────────────────────────────────────────────

function BilanzDetail({ kpi, latest, series }: { kpi: string; latest: VermoegenKPIs; series: VermoegenKPIs[] }) {
  const hasSeries = series.length >= 2

  if (kpi === 'umlaufvermoegen') {
    const uvComps = [
      { key: 'cash',        label: 'Cashbestand',  color: 'hsl(38, 92%, 50%)',  value: latest.cash },
      { key: 'forderungen', label: 'Forderungen',  color: 'hsl(217, 71%, 65%)', value: latest.gesamt_forderungen },
      { key: 'waren',       label: 'Warenkapital', color: 'hsl(262, 83%, 58%)', value: latest.warenkapital },
    ]
    const seriesData = series.map((s) => ({
      name: fmtDatumShort(s.datum),
      label: fmtDatumLang(s.datum),
      cash: s.cash,
      forderungen: s.gesamt_forderungen,
      waren: s.warenkapital,
    }))
    const cashColor      = 'hsl(38, 92%, 50%)'
    const fordColor      = 'hsl(217, 71%, 65%)'
    const warenColor     = 'hsl(262, 83%, 58%)'
    const uvStackComps   = [
      { key: 'cash',       label: 'Cashbestand',  color: cashColor  },
      { key: 'forderungen',label: 'Forderungen',  color: fordColor  },
      { key: 'waren',      label: 'Warenkapital', color: warenColor },
    ] as const
    return (
      <div className="space-y-4">
        <div className="rounded-lg border p-4 space-y-3">
          <span className="text-sm font-medium">Umlaufvermögen-Komponenten</span>
          <CssStackedBar segments={uvComps} label="Umlaufvermögen" />
          <div className="flex flex-wrap gap-x-4 gap-y-1.5 pt-1">
            {uvComps.map((c) => (
              <div key={c.key} className="flex items-center gap-1.5 text-xs">
                <span className="h-2.5 w-2.5 rounded-sm flex-shrink-0" style={{ background: c.color }} />
                <span className="text-muted-foreground">{c.label}:</span>
                <span className="tabular-nums font-medium">{fmtEur(c.value)}</span>
              </div>
            ))}
          </div>
        </div>
        {hasSeries ? (
          <div className="rounded-lg border p-4 space-y-3">
            <span className="text-sm font-medium">Umlaufvermögen-Entwicklung</span>
            <ResponsiveContainer width="100%" height={220}>
              <AreaChart data={seriesData} margin={{ top: 4, right: 16, left: 4, bottom: 4 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="name" tick={{ fontSize: 11 }} tickLine={false} axisLine={{ stroke: 'hsl(var(--border))' }} />
                <YAxis tickFormatter={fmtEurShort} tick={{ fontSize: 11 }} tickLine={false} axisLine={false} width={72} />
                <RechartsTooltip content={({ active, payload, label }) => {
                  if (!active || !payload?.length) return null
                  const entry = payload[0]?.payload
                  const cashV  = (payload.find(p => p.dataKey === 'cash')?.value  as number) ?? 0
                  const fordV  = (payload.find(p => p.dataKey === 'forderungen')?.value as number) ?? 0
                  const warenV = (payload.find(p => p.dataKey === 'waren')?.value as number) ?? 0
                  return (
                    <div className="rounded-lg border bg-background p-2.5 shadow-md text-xs space-y-1 min-w-[200px]">
                      <p className="font-semibold border-b pb-1 mb-1">{entry?.label ?? label}</p>
                      <div className="flex items-center gap-2"><span className="h-2 w-2 rounded-full flex-shrink-0" style={{ background: cashColor }} /><span className="text-muted-foreground">Cashbestand:</span><span className="ml-auto font-medium tabular-nums">{fmtEur(cashV)}</span></div>
                      <div className="flex items-center gap-2"><span className="h-2 w-2 rounded-full flex-shrink-0" style={{ background: fordColor }} /><span className="text-muted-foreground">Forderungen:</span><span className="ml-auto font-medium tabular-nums">{fmtEur(fordV)}</span></div>
                      <div className="flex items-center gap-2"><span className="h-2 w-2 rounded-full flex-shrink-0" style={{ background: warenColor }} /><span className="text-muted-foreground">Warenkapital:</span><span className="ml-auto font-medium tabular-nums">{fmtEur(warenV)}</span></div>
                      <div className="flex items-center gap-2 border-t pt-1 font-semibold"><span>Gesamt:</span><span className="ml-auto tabular-nums">{fmtEur(cashV + fordV + warenV)}</span></div>
                    </div>
                  )
                }} />
                <Legend content={() => (
                  <div className="flex justify-center gap-5 pt-2">
                    {uvStackComps.map((c) => (
                      <div key={c.key} className="flex items-center gap-1.5 text-xs">
                        <span className="inline-block h-2.5 w-2.5 rounded-sm" style={{ background: c.color }} />
                        <span className="text-muted-foreground">{c.label}</span>
                      </div>
                    ))}
                  </div>
                )} />
                <Area type="linear" dataKey="cash"        stackId="uv" stroke={cashColor}  fill={cashColor}  fillOpacity={0.35} strokeWidth={2} dot={false} activeDot={{ r: 4 }} />
                <Area type="linear" dataKey="forderungen" stackId="uv" stroke={fordColor}  fill={fordColor}  fillOpacity={0.35} strokeWidth={2} dot={false} activeDot={{ r: 4 }} />
                <Area type="linear" dataKey="waren"       stackId="uv" stroke={warenColor} fill={warenColor} fillOpacity={0.35} strokeWidth={2} dot={false} activeDot={{ r: 4 }} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        ) : <NoSeries />}
      </div>
    )
  }

  if (kpi === 'anlagevermoegen') {
    const seriesData = series.map((s) => ({ name: fmtDatumShort(s.datum), label: fmtDatumLang(s.datum), value: s.anlagevermoegen }))
    return (
      <div className="space-y-4">
        {hasSeries ? <div className="rounded-lg border p-4 space-y-3"><span className="text-sm font-medium">Anlagevermögen-Entwicklung</span><SingleLine seriesData={seriesData} color={C.quote} label="Anlagevermögen" /></div> : <NoSeries />}
      </div>
    )
  }

  if (kpi === 'eigenkapital') {
    const gvColor = 'hsl(var(--muted-foreground))'
    const ekColor = C.ek
    const fkColor = C.fk
    const gvComps  = [{ key: 'gv', label: 'Gesamtvermögen', color: gvColor, value: latest.gesamtvermoegen }]
    const ekfkComps = [
      { key: 'ek', label: 'Eigenkapital', color: ekColor, value: latest.eigenkapital },
      { key: 'fk', label: 'Fremdkapital', color: fkColor, value: latest.fremdkapital },
    ]
    const seriesData = series.map((s) => ({ name: fmtDatumShort(s.datum), label: fmtDatumLang(s.datum), value: s.eigenkapital }))
    return (
      <div className="space-y-4">
        <div className="rounded-lg border p-4 space-y-4">
          <div className="space-y-3">
            <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Gesamtvermögen</span>
            <CssStackedBar segments={gvComps} label="Gesamtvermögen" />
            <div className="flex items-center gap-1.5 text-xs">
              <span className="h-2.5 w-2.5 rounded-sm flex-shrink-0" style={{ background: gvColor }} />
              <span className="text-muted-foreground">Gesamtvermögen:</span>
              <span className="tabular-nums font-medium">{fmtEur(latest.gesamtvermoegen)}</span>
            </div>
          </div>
          <div className="space-y-3">
            <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Eigen- & Fremdkapital</span>
            <CssStackedBar segments={ekfkComps} label="Passiva" />
            <div className="flex flex-wrap gap-x-4 gap-y-1.5">
              {ekfkComps.map((c) => (
                <div key={c.key} className="flex items-center gap-1.5 text-xs">
                  <span className="h-2.5 w-2.5 rounded-sm flex-shrink-0" style={{ background: c.color }} />
                  <span className="text-muted-foreground">{c.label}:</span>
                  <span className="tabular-nums font-medium">{fmtEur(c.value)}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
        {hasSeries ? <div className="rounded-lg border p-4 space-y-3"><span className="text-sm font-medium">Eigenkapital-Entwicklung</span><SingleLine seriesData={seriesData} color={ekColor} label="Eigenkapital" /></div> : <NoSeries />}
      </div>
    )
  }

  if (kpi === 'fremdkapital') {
    const fkComps = [
      { key: 'verb_ll',       label: 'Verb. L&L',      color: 'hsl(0, 84%, 50%)', value: latest.verb_ll },
      { key: 'verb_sonstige', label: 'Verb. Sonst.',   color: 'hsl(0, 84%, 62%)', value: latest.verb_sonstige },
      { key: 'darlehen',      label: 'Darlehen',       color: 'hsl(0, 84%, 74%)', value: latest.darlehen },
      ...(latest.steuerschulden > 0 ? [{ key: 'steuerschulden', label: 'Steuerschulden', color: 'hsl(0, 84%, 86%)', value: latest.steuerschulden }] : []),
    ]
    const seriesData = series.map((s) => ({
      name: fmtDatumShort(s.datum),
      label: fmtDatumLang(s.datum),
      verb_ll: s.verb_ll,
      verb_sonstige: s.verb_sonstige,
      darlehen: s.darlehen,
      steuerschulden: s.steuerschulden,
    }))
    const stackComps = [
      { key: 'verb_ll',       label: 'Verb. L&L',      color: 'hsl(0, 84%, 50%)' },
      { key: 'verb_sonstige', label: 'Verb. Sonst.',   color: 'hsl(0, 84%, 62%)' },
      { key: 'darlehen',      label: 'Darlehen',       color: 'hsl(0, 84%, 74%)' },
      { key: 'steuerschulden',label: 'Steuerschulden', color: 'hsl(0, 84%, 86%)' },
    ] as const
    return (
      <div className="space-y-4">
        <div className="rounded-lg border p-4 space-y-3">
          <span className="text-sm font-medium">Fremdkapital-Komponenten</span>
          <CssStackedBar segments={fkComps} label="Fremdkapital" />
          <div className="flex flex-wrap gap-x-4 gap-y-1.5 pt-1">
            {fkComps.filter((c) => c.value > 0).map((c) => (
              <div key={c.key} className="flex items-center gap-1.5 text-xs">
                <span className="h-2.5 w-2.5 rounded-sm flex-shrink-0" style={{ background: c.color }} />
                <span className="text-muted-foreground">{c.label}:</span>
                <span className="tabular-nums font-medium">{fmtEur(c.value)}</span>
              </div>
            ))}
          </div>
        </div>
        {hasSeries ? (
          <div className="rounded-lg border p-4 space-y-3">
            <span className="text-sm font-medium">Fremdkapital-Entwicklung</span>
            <ResponsiveContainer width="100%" height={220}>
              <AreaChart data={seriesData} margin={{ top: 4, right: 16, left: 4, bottom: 4 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="name" tick={{ fontSize: 11 }} tickLine={false} axisLine={{ stroke: 'hsl(var(--border))' }} />
                <YAxis tickFormatter={fmtEurShort} tick={{ fontSize: 11 }} tickLine={false} axisLine={false} width={72} />
                <RechartsTooltip content={({ active, payload, label }) => {
                  if (!active || !payload?.length) return null
                  const entry = payload[0]?.payload
                  const ll  = entry?.verb_ll ?? 0
                  const so  = entry?.verb_sonstige ?? 0
                  const da  = entry?.darlehen ?? 0
                  const st  = entry?.steuerschulden ?? 0
                  return (
                    <div className="rounded-lg border bg-background p-2.5 shadow-md text-xs space-y-1 min-w-[200px]">
                      <p className="font-semibold border-b pb-1 mb-1">{entry?.label ?? label}</p>
                      <div className="flex items-center gap-2"><span className="h-2 w-2 rounded-full flex-shrink-0" style={{ background: 'hsl(0, 84%, 50%)' }} /><span className="text-muted-foreground">Verb. L&L:</span><span className="ml-auto font-medium tabular-nums">{fmtEur(ll)}</span></div>
                      <div className="flex items-center gap-2"><span className="h-2 w-2 rounded-full flex-shrink-0" style={{ background: 'hsl(0, 84%, 62%)' }} /><span className="text-muted-foreground">Verb. Sonst.:</span><span className="ml-auto font-medium tabular-nums">{fmtEur(so)}</span></div>
                      <div className="flex items-center gap-2"><span className="h-2 w-2 rounded-full flex-shrink-0" style={{ background: 'hsl(0, 84%, 74%)' }} /><span className="text-muted-foreground">Darlehen:</span><span className="ml-auto font-medium tabular-nums">{fmtEur(da)}</span></div>
                      {st > 0 && <div className="flex items-center gap-2"><span className="h-2 w-2 rounded-full flex-shrink-0" style={{ background: 'hsl(0, 84%, 86%)' }} /><span className="text-muted-foreground">Steuerschulden:</span><span className="ml-auto font-medium tabular-nums">{fmtEur(st)}</span></div>}
                      <div className="flex items-center gap-2 border-t pt-1 font-semibold"><span>Gesamt:</span><span className="ml-auto tabular-nums">{fmtEur(ll + so + da + st)}</span></div>
                    </div>
                  )
                }} />
                <Legend content={() => (
                  <div className="flex flex-wrap justify-center gap-x-4 gap-y-1 pt-2">
                    {stackComps.map((c) => (
                      <div key={c.key} className="flex items-center gap-1.5 text-xs">
                        <span className="inline-block h-2.5 w-2.5 rounded-sm" style={{ background: c.color }} />
                        <span className="text-muted-foreground">{c.label}</span>
                      </div>
                    ))}
                  </div>
                )} />
                <Area type="linear" dataKey="verb_ll"        stackId="fk" stroke="hsl(0, 84%, 50%)" fill="hsl(0, 84%, 50%)" fillOpacity={0.35} strokeWidth={2} dot={false} activeDot={{ r: 4 }} />
                <Area type="linear" dataKey="verb_sonstige"  stackId="fk" stroke="hsl(0, 84%, 62%)" fill="hsl(0, 84%, 62%)" fillOpacity={0.35} strokeWidth={2} dot={false} activeDot={{ r: 4 }} />
                <Area type="linear" dataKey="darlehen"       stackId="fk" stroke="hsl(0, 84%, 74%)" fill="hsl(0, 84%, 74%)" fillOpacity={0.35} strokeWidth={2} dot={false} activeDot={{ r: 4 }} />
                <Area type="linear" dataKey="steuerschulden" stackId="fk" stroke="hsl(0, 84%, 86%)" fill="hsl(0, 84%, 86%)" fillOpacity={0.35} strokeWidth={2} dot={false} activeDot={{ r: 4 }} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        ) : <NoSeries />}
      </div>
    )
  }

  if (kpi === 'gesamtvermoegen') {
    const uvColor = 'hsl(262, 83%, 58%)'
    const avColor = C.quote
    const ekColor = C.ek
    const fkColor = C.fk
    const aktivaComps = [
      { key: 'uv', label: 'Umlaufvermögen', color: uvColor, value: latest.umlaufvermoegen },
      { key: 'av', label: 'Anlagevermögen', color: avColor, value: latest.anlagevermoegen },
    ]
    const passivaComps = [
      { key: 'ek', label: 'Eigenkapital',  color: ekColor, value: latest.eigenkapital },
      { key: 'fk', label: 'Fremdkapital',  color: fkColor, value: latest.fremdkapital },
    ]
    const seriesData = series.map((s) => ({
      name: fmtDatumShort(s.datum),
      label: fmtDatumLang(s.datum),
      uv: s.umlaufvermoegen,
      av: s.anlagevermoegen,
      ek: s.eigenkapital,
      fk: s.fremdkapital,
    }))
    return (
      <div className="space-y-4">
        <div className="rounded-lg border p-4 space-y-4">
          <div className="space-y-3">
            <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Aktiva</span>
            <CssStackedBar segments={aktivaComps} label="Aktiva" />
            <div className="flex flex-wrap gap-x-4 gap-y-1.5">
              {aktivaComps.map((c) => (
                <div key={c.key} className="flex items-center gap-1.5 text-xs">
                  <span className="h-2.5 w-2.5 rounded-sm flex-shrink-0" style={{ background: c.color }} />
                  <span className="text-muted-foreground">{c.label}:</span>
                  <span className="tabular-nums font-medium">{fmtEur(c.value)}</span>
                </div>
              ))}
            </div>
          </div>
          <hr className="border-dashed border-muted-foreground/30" />
          <div className="space-y-3">
            <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Passiva</span>
            <CssStackedBar segments={passivaComps} label="Passiva" />
            <div className="flex flex-wrap gap-x-4 gap-y-1.5">
              {passivaComps.map((c) => (
                <div key={c.key} className="flex items-center gap-1.5 text-xs">
                  <span className="h-2.5 w-2.5 rounded-sm flex-shrink-0" style={{ background: c.color }} />
                  <span className="text-muted-foreground">{c.label}:</span>
                  <span className="tabular-nums font-medium">{fmtEur(c.value)}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
        {hasSeries ? (
          <>
            <div className="rounded-lg border p-4 space-y-3">
              <span className="text-sm font-medium">Aktiva-Entwicklung</span>
              <ResponsiveContainer width="100%" height={220}>
                <AreaChart data={seriesData} margin={{ top: 4, right: 16, left: 4, bottom: 4 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="name" tick={{ fontSize: 11 }} tickLine={false} axisLine={{ stroke: 'hsl(var(--border))' }} />
                  <YAxis tickFormatter={fmtEurShort} tick={{ fontSize: 11 }} tickLine={false} axisLine={false} width={72} />
                  <RechartsTooltip content={({ active, payload, label }) => {
                    if (!active || !payload?.length) return null
                    const entry = payload[0]?.payload
                    const uvV = entry?.uv ?? 0
                    const avV = entry?.av ?? 0
                    return (
                      <div className="rounded-lg border bg-background p-2.5 shadow-md text-xs space-y-1 min-w-[200px]">
                        <p className="font-semibold border-b pb-1 mb-1">{entry?.label ?? label}</p>
                        <div className="flex items-center gap-2"><span className="h-2 w-2 rounded-full flex-shrink-0" style={{ background: uvColor }} /><span className="text-muted-foreground">Umlaufvermögen:</span><span className="ml-auto font-medium tabular-nums">{fmtEur(uvV)}</span></div>
                        <div className="flex items-center gap-2"><span className="h-2 w-2 rounded-full flex-shrink-0" style={{ background: avColor }} /><span className="text-muted-foreground">Anlagevermögen:</span><span className="ml-auto font-medium tabular-nums">{fmtEur(avV)}</span></div>
                        <div className="flex items-center gap-2 border-t pt-1 font-semibold"><span>Gesamt:</span><span className="ml-auto tabular-nums">{fmtEur(uvV + avV)}</span></div>
                      </div>
                    )
                  }} />
                  <Legend content={() => (
                    <div className="flex justify-center gap-5 pt-2">
                      {aktivaComps.map((c) => (
                        <div key={c.key} className="flex items-center gap-1.5 text-xs">
                          <span className="inline-block h-2.5 w-2.5 rounded-sm" style={{ background: c.color }} />
                          <span className="text-muted-foreground">{c.label}</span>
                        </div>
                      ))}
                    </div>
                  )} />
                  <Area type="linear" dataKey="uv" stackId="a" stroke={uvColor} fill={uvColor} fillOpacity={0.35} strokeWidth={2} dot={false} activeDot={{ r: 4 }} />
                  <Area type="linear" dataKey="av" stackId="a" stroke={avColor} fill={avColor} fillOpacity={0.35} strokeWidth={2} dot={false} activeDot={{ r: 4 }} />
                </AreaChart>
              </ResponsiveContainer>
            </div>
            <div className="rounded-lg border p-4 space-y-3">
              <span className="text-sm font-medium">Passiva-Entwicklung</span>
              <ResponsiveContainer width="100%" height={220}>
                <AreaChart data={seriesData} margin={{ top: 4, right: 16, left: 4, bottom: 4 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="name" tick={{ fontSize: 11 }} tickLine={false} axisLine={{ stroke: 'hsl(var(--border))' }} />
                  <YAxis tickFormatter={fmtEurShort} tick={{ fontSize: 11 }} tickLine={false} axisLine={false} width={72} />
                  <RechartsTooltip content={({ active, payload, label }) => {
                    if (!active || !payload?.length) return null
                    const entry = payload[0]?.payload
                    const ekV = entry?.ek ?? 0
                    const fkV = entry?.fk ?? 0
                    return (
                      <div className="rounded-lg border bg-background p-2.5 shadow-md text-xs space-y-1 min-w-[200px]">
                        <p className="font-semibold border-b pb-1 mb-1">{entry?.label ?? label}</p>
                        <div className="flex items-center gap-2"><span className="h-2 w-2 rounded-full flex-shrink-0" style={{ background: ekColor }} /><span className="text-muted-foreground">Eigenkapital:</span><span className="ml-auto font-medium tabular-nums">{fmtEur(ekV)}</span></div>
                        <div className="flex items-center gap-2"><span className="h-2 w-2 rounded-full flex-shrink-0" style={{ background: fkColor }} /><span className="text-muted-foreground">Fremdkapital:</span><span className="ml-auto font-medium tabular-nums">{fmtEur(fkV)}</span></div>
                        <div className="flex items-center gap-2 border-t pt-1 font-semibold"><span>Gesamt:</span><span className="ml-auto tabular-nums">{fmtEur(ekV + fkV)}</span></div>
                      </div>
                    )
                  }} />
                  <Legend content={() => (
                    <div className="flex justify-center gap-5 pt-2">
                      {passivaComps.map((c) => (
                        <div key={c.key} className="flex items-center gap-1.5 text-xs">
                          <span className="inline-block h-2.5 w-2.5 rounded-sm" style={{ background: c.color }} />
                          <span className="text-muted-foreground">{c.label}</span>
                        </div>
                      ))}
                    </div>
                  )} />
                  <Area type="linear" dataKey="ek" stackId="p" stroke={ekColor} fill={ekColor} fillOpacity={0.35} strokeWidth={2} dot={false} activeDot={{ r: 4 }} />
                  <Area type="linear" dataKey="fk" stackId="p" stroke={fkColor} fill={fkColor} fillOpacity={0.35} strokeWidth={2} dot={false} activeDot={{ r: 4 }} />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </>
        ) : <NoSeries />}
      </div>
    )
  }

  // Quote-KPIs: UV-Quote, EK-Quote, FK-Quote, Cash-Quote
  const quoteConfig: Record<string, { label: string; color: string; refY?: number; refLabel?: string; zaehlerLabel: string; zaehlerValue: number; seriesKey: keyof VermoegenKPIs; pctFmt: boolean }> = {
    uv_quote:   { label: 'UV-Quote',   color: 'hsl(262, 83%, 58%)',                zaehlerLabel: 'Umlaufvermögen', zaehlerValue: latest.umlaufvermoegen, seriesKey: 'uv_quote',   pctFmt: true },
    ek_quote:   { label: 'EK-Quote',   color: C.quote, refY: 30, refLabel: '30%',  zaehlerLabel: 'Eigenkapital',   zaehlerValue: latest.eigenkapital,    seriesKey: 'ek_quote',   pctFmt: true },
    fk_quote:   { label: 'FK-Quote',   color: C.fk,                                zaehlerLabel: 'Fremdkapital',   zaehlerValue: latest.fremdkapital,    seriesKey: 'fk_quote',   pctFmt: true },
    cash_quote: { label: 'Cash-Quote', color: C.cash,                              zaehlerLabel: 'Cashbestand',    zaehlerValue: latest.cash,            seriesKey: 'cash_quote', pctFmt: true },
  }

  const cfg = quoteConfig[kpi]
  if (!cfg) return null

  const compData = [
    { name: cfg.zaehlerLabel,  value: cfg.zaehlerValue,     fill: cfg.color },
    { name: 'Gesamtvermögen', value: latest.gesamtvermoegen, fill: 'hsl(var(--muted-foreground))' },
  ]
  const seriesData = series.map((s) => {
    const raw = s[cfg.seriesKey] as number | null
    return { name: fmtDatumShort(s.datum), label: fmtDatumLang(s.datum), value: raw !== null ? raw * 100 : null }
  })
  const pctFormatter = (v: number) => `${v.toLocaleString('de-DE', { maximumFractionDigits: 1 })}%`

  return (
    <div className="space-y-4">
      <div className="rounded-lg border p-4 space-y-3">
        <span className="text-sm font-medium">Zähler vs. Gesamtvermögen — {cfg.label}</span>
        <HorizBar data={compData} />
      </div>
      {hasSeries ? (
        <div className="rounded-lg border p-4 space-y-3">
          <span className="text-sm font-medium">{cfg.label}-Entwicklung</span>
          <ResponsiveContainer width="100%" height={200}>
            <LineChart data={seriesData} margin={{ top: 4, right: 16, left: 4, bottom: 4 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis dataKey="name" tick={{ fontSize: 11 }} tickLine={false} axisLine={{ stroke: 'hsl(var(--border))' }} />
              <YAxis tickFormatter={pctFormatter} tick={{ fontSize: 11 }} tickLine={false} axisLine={false} width={44} />
              {cfg.refY !== undefined && <ReferenceLine y={cfg.refY} stroke={cfg.color} strokeDasharray="4 4" strokeOpacity={0.7} label={{ value: cfg.refLabel, position: 'insideTopRight', fontSize: 10, fill: cfg.color }} />}
              <RechartsTooltip content={({ active, payload, label }) => {
                if (!active || !payload?.length) return null
                const entry = payload[0]?.payload
                const v = payload[0]?.value as number | null
                return <div className="rounded-lg border bg-background p-2.5 shadow-md text-xs min-w-[160px]"><p className="font-semibold border-b pb-1 mb-1">{entry?.label ?? label}</p><div className="flex items-center gap-2"><span className="text-muted-foreground">{cfg.label}:</span><span className="ml-auto font-medium tabular-nums">{v !== null && v !== undefined ? pctFormatter(v) : '—'}</span></div></div>
              }} />
              <Line type="linear" dataKey="value" stroke={cfg.color} strokeWidth={2} dot={false} activeDot={{ r: 4 }} connectNulls={false} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      ) : <NoSeries />}
    </div>
  )
}

// ─── Komponente ───────────────────────────────────────────────────────────────

interface Props {
  latest: VermoegenKPIs
  series: VermoegenKPIs[]
}

export function ReportingVermoegenBilanzkennzahlen({ latest, series }: Props) {
  const [selectedKpi, setSelectedKpi] = useState<string | null>(null)
  const hasSeries = series.length >= 2

  function handleSelect(id: string) {
    setSelectedKpi((prev) => (prev === id ? null : id))
  }

  const ampelColor = ampelEkQuote(latest.ek_quote)

  const chartDataVerm = series.map((s) => ({
    name: fmtDatumShort(s.datum),
    label: fmtDatumLang(s.datum),
    uv: s.umlaufvermoegen,
    av: s.anlagevermoegen,
    ek: s.eigenkapital,
    fk: s.fremdkapital,
    gesamt: s.gesamtvermoegen,
    cash: s.cash,
    forderungen: s.gesamt_forderungen,
    waren: s.warenkapital,
    ekQuote: s.ek_quote !== null ? s.ek_quote * 100 : null,
  }))


  const uv = Number.isFinite(latest.umlaufvermoegen)
    ? latest.umlaufvermoegen
    : Math.round((latest.warenkapital + latest.gesamt_forderungen + latest.cash) * 100) / 100
  const gv = Number.isFinite(latest.gesamtvermoegen)
    ? latest.gesamtvermoegen
    : Math.round((uv + latest.anlagevermoegen) * 100) / 100
  const ek = Number.isFinite(latest.eigenkapital)
    ? latest.eigenkapital
    : Math.round((gv - latest.fremdkapital) * 100) / 100

  return (
    <TooltipProvider>
      <div className="space-y-6 pt-4">
        {/* KPI-Kacheln Reihe 1: Vermögensstruktur */}
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
          <KpiCard
            id="umlaufvermoegen"
            title="Umlaufvermögen"
            tooltip="Summe aller kurzfristigen Vermögenswerte. Cashbestand + Forderungen + Warenkapital."
            value={fmtEur(uv)}
            selected={selectedKpi === 'umlaufvermoegen'}
            onSelect={handleSelect}
            items={[
              { label: 'Cashbestand', value: fmtEur(latest.cash) },
              { label: 'Forderungen', value: fmtEur(latest.gesamt_forderungen) },
              { label: 'Warenkapital', value: fmtEur(latest.warenkapital) },
            ]}
          />
          <KpiCard
            id="anlagevermoegen"
            title="Anlagevermögen"
            tooltip="Langfristig gebundene Vermögenswerte (abgeschriebener Buchwert)."
            value={fmtEur(latest.anlagevermoegen)}
            selected={selectedKpi === 'anlagevermoegen'}
            onSelect={handleSelect}
          />
          <KpiCard
            id="gesamtvermoegen"
            title="Gesamtvermögen"
            tooltip="Bilanzsumme (Aktiva-Seite). Umlaufvermögen + Anlagevermögen."
            value={fmtEur(gv)}
            selected={selectedKpi === 'gesamtvermoegen'}
            onSelect={handleSelect}
            items={[
              { label: 'Umlaufvermögen', value: fmtEur(uv) },
              { label: 'Anlagevermögen', value: fmtEur(latest.anlagevermoegen) },
              { separator: true as const },
              { label: 'Eigenkapital', value: fmtEur(ek) },
              { label: 'Fremdkapital', value: fmtEur(latest.fremdkapital) },
            ]}
          />
          <KpiCard
            id="eigenkapital"
            title="Eigenkapital"
            tooltip="Residualgröße der Passiva-Seite. Gesamtvermögen − Fremdkapital."
            value={fmtEur(ek)}
            selected={selectedKpi === 'eigenkapital'}
            onSelect={handleSelect}
            items={[
              { label: 'Gesamtvermögen', value: fmtEur(gv) },
              { label: '− Fremdkapital', value: fmtEur(latest.fremdkapital) },
            ]}
          />
          <KpiCard
            id="fremdkapital"
            title="Fremdkapital"
            tooltip="Summe aller Verbindlichkeiten. Verb. L&L + Verb. Sonst. + Darlehen + ggf. Steuerschulden."
            value={fmtEur(latest.fremdkapital)}
            selected={selectedKpi === 'fremdkapital'}
            onSelect={handleSelect}
            items={[
              { label: 'Verb. L&L', value: fmtEur(latest.verb_ll) },
              { label: 'Verb. Sonst.', value: fmtEur(latest.verb_sonstige) },
              { label: 'Darlehen', value: fmtEur(latest.darlehen) },
              ...(latest.steuerschulden > 0 ? [{ label: 'Steuerschulden', value: fmtEur(latest.steuerschulden) }] : []),
            ]}
          />
        </div>

        {/* KPI-Kacheln Reihe 2: Quoten */}
        <div className="grid grid-cols-3 gap-4">
          <KpiCard
            id="uv_quote"
            title="UV-Quote"
            tooltip="Anteil des Umlaufvermögens am Gesamtvermögen. UV ÷ Gesamtvermögen."
            value={fmtPct(latest.uv_quote)}
            selected={selectedKpi === 'uv_quote'}
            onSelect={handleSelect}
            items={[
              { label: 'Umlaufvermögen', value: fmtEur(latest.umlaufvermoegen) },
              { label: 'Gesamtvermögen', value: fmtEur(latest.gesamtvermoegen) },
            ]}
          />
          <KpiCard
            id="ek_quote"
            title="EK-Quote"
            tooltip="Eigenfinanzierungsgrad. Anteil des Eigenkapitals am Gesamtvermögen. EK ÷ Gesamtvermögen. Richtwert: ≥ 30%."
            value={fmtPct(latest.ek_quote)}
            sub="Richtwert: ≥ 30%"
            ampelColor={ampelColor}
            selected={selectedKpi === 'ek_quote'}
            onSelect={handleSelect}
            items={[
              { label: 'Eigenkapital', value: fmtEur(latest.eigenkapital) },
              { label: 'Gesamtvermögen', value: fmtEur(latest.gesamtvermoegen) },
            ]}
          />
          <KpiCard
            id="cash_quote"
            title="Cash-Quote"
            tooltip="Liquiditätsreserve im Verhältnis zur Bilanzsumme. Cash ÷ Gesamtvermögen."
            value={fmtPct(latest.cash_quote)}
            selected={selectedKpi === 'cash_quote'}
            onSelect={handleSelect}
            items={[
              { label: 'Cashbestand', value: fmtEur(latest.cash) },
              { label: 'Gesamtvermögen', value: fmtEur(latest.gesamtvermoegen) },
            ]}
          />
        </div>


        {/* Detail oder globale Zeitreihen */}
        {selectedKpi ? (
          <BilanzDetail kpi={selectedKpi} latest={latest} series={series} />
        ) : hasSeries ? (
          <>
            {/* 1. Aktiva-Entwicklung */}
            <div className="rounded-lg border p-4 space-y-3">
              <span className="text-sm font-medium">Aktiva-Entwicklung</span>
              <ResponsiveContainer width="100%" height={220}>
                <AreaChart data={chartDataVerm} margin={{ top: 4, right: 16, left: 4, bottom: 4 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="name" tick={{ fontSize: 11 }} tickLine={false} axisLine={{ stroke: 'hsl(var(--border))' }} />
                  <YAxis tickFormatter={fmtEurShort} tick={{ fontSize: 11 }} tickLine={false} axisLine={false} width={72} />
                  <RechartsTooltip content={({ active, payload }) => {
                    if (!active || !payload?.length) return null
                    const e = payload[0]?.payload
                    const uvV = e?.uv ?? 0; const avV = e?.av ?? 0
                    return <div className="rounded-lg border bg-background p-2.5 shadow-md text-xs space-y-1 min-w-[200px]"><p className="font-semibold border-b pb-1 mb-1">{e?.label}</p><div className="flex items-center gap-2"><span className="h-2 w-2 rounded-full flex-shrink-0" style={{ background: 'hsl(262, 83%, 58%)' }} /><span className="text-muted-foreground">Umlaufvermögen:</span><span className="ml-auto font-medium tabular-nums">{fmtEur(uvV)}</span></div><div className="flex items-center gap-2"><span className="h-2 w-2 rounded-full flex-shrink-0" style={{ background: C.quote }} /><span className="text-muted-foreground">Anlagevermögen:</span><span className="ml-auto font-medium tabular-nums">{fmtEur(avV)}</span></div><div className="flex items-center gap-2 border-t pt-1 font-semibold"><span>Gesamt:</span><span className="ml-auto tabular-nums">{fmtEur(uvV + avV)}</span></div></div>
                  }} />
                  <Legend content={() => <div className="flex justify-center gap-5 pt-2">{[{ label: 'Umlaufvermögen', color: 'hsl(262, 83%, 58%)' }, { label: 'Anlagevermögen', color: C.quote }].map((c) => <div key={c.label} className="flex items-center gap-1.5 text-xs"><span className="inline-block h-2.5 w-2.5 rounded-sm" style={{ background: c.color }} /><span className="text-muted-foreground">{c.label}</span></div>)}</div>} />
                  <Area type="linear" dataKey="uv" stackId="a" stroke="hsl(262, 83%, 58%)" fill="hsl(262, 83%, 58%)" fillOpacity={0.35} strokeWidth={2} dot={false} activeDot={{ r: 4 }} />
                  <Area type="linear" dataKey="av" stackId="a" stroke={C.quote} fill={C.quote} fillOpacity={0.35} strokeWidth={2} dot={false} activeDot={{ r: 4 }} />
                </AreaChart>
              </ResponsiveContainer>
            </div>

            {/* 2. Passiva-Entwicklung */}
            <div className="rounded-lg border p-4 space-y-3">
              <span className="text-sm font-medium">Passiva-Entwicklung</span>
              <ResponsiveContainer width="100%" height={220}>
                <AreaChart data={chartDataVerm} margin={{ top: 4, right: 16, left: 4, bottom: 4 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="name" tick={{ fontSize: 11 }} tickLine={false} axisLine={{ stroke: 'hsl(var(--border))' }} />
                  <YAxis tickFormatter={fmtEurShort} tick={{ fontSize: 11 }} tickLine={false} axisLine={false} width={72} />
                  <RechartsTooltip content={({ active, payload }) => {
                    if (!active || !payload?.length) return null
                    const e = payload[0]?.payload
                    const ekV = e?.ek ?? 0; const fkV = e?.fk ?? 0
                    return <div className="rounded-lg border bg-background p-2.5 shadow-md text-xs space-y-1 min-w-[200px]"><p className="font-semibold border-b pb-1 mb-1">{e?.label}</p><div className="flex items-center gap-2"><span className="h-2 w-2 rounded-full flex-shrink-0" style={{ background: C.ek }} /><span className="text-muted-foreground">Eigenkapital:</span><span className="ml-auto font-medium tabular-nums">{fmtEur(ekV)}</span></div><div className="flex items-center gap-2"><span className="h-2 w-2 rounded-full flex-shrink-0" style={{ background: C.fk }} /><span className="text-muted-foreground">Fremdkapital:</span><span className="ml-auto font-medium tabular-nums">{fmtEur(fkV)}</span></div><div className="flex items-center gap-2 border-t pt-1 font-semibold"><span>Gesamt:</span><span className="ml-auto tabular-nums">{fmtEur(ekV + fkV)}</span></div></div>
                  }} />
                  <Legend content={() => <div className="flex justify-center gap-5 pt-2">{[{ label: 'Eigenkapital', color: C.ek }, { label: 'Fremdkapital', color: C.fk }].map((c) => <div key={c.label} className="flex items-center gap-1.5 text-xs"><span className="inline-block h-2.5 w-2.5 rounded-sm" style={{ background: c.color }} /><span className="text-muted-foreground">{c.label}</span></div>)}</div>} />
                  <Area type="linear" dataKey="ek" stackId="p" stroke={C.ek} fill={C.ek} fillOpacity={0.35} strokeWidth={2} dot={false} activeDot={{ r: 4 }} />
                  <Area type="linear" dataKey="fk" stackId="p" stroke={C.fk} fill={C.fk} fillOpacity={0.35} strokeWidth={2} dot={false} activeDot={{ r: 4 }} />
                </AreaChart>
              </ResponsiveContainer>
            </div>

            {/* 3. Umlaufvermögen-Entwicklung */}
            <div className="rounded-lg border p-4 space-y-3">
              <span className="text-sm font-medium">Umlaufvermögen-Entwicklung</span>
              <ResponsiveContainer width="100%" height={220}>
                <AreaChart data={chartDataVerm} margin={{ top: 4, right: 16, left: 4, bottom: 4 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="name" tick={{ fontSize: 11 }} tickLine={false} axisLine={{ stroke: 'hsl(var(--border))' }} />
                  <YAxis tickFormatter={fmtEurShort} tick={{ fontSize: 11 }} tickLine={false} axisLine={false} width={72} />
                  <RechartsTooltip content={({ active, payload }) => {
                    if (!active || !payload?.length) return null
                    const e = payload[0]?.payload
                    const cV = e?.cash ?? 0; const fV = e?.forderungen ?? 0; const wV = e?.waren ?? 0
                    return <div className="rounded-lg border bg-background p-2.5 shadow-md text-xs space-y-1 min-w-[200px]"><p className="font-semibold border-b pb-1 mb-1">{e?.label}</p><div className="flex items-center gap-2"><span className="h-2 w-2 rounded-full flex-shrink-0" style={{ background: C.cash }} /><span className="text-muted-foreground">Cashbestand:</span><span className="ml-auto font-medium tabular-nums">{fmtEur(cV)}</span></div><div className="flex items-center gap-2"><span className="h-2 w-2 rounded-full flex-shrink-0" style={{ background: 'hsl(217, 71%, 65%)' }} /><span className="text-muted-foreground">Forderungen:</span><span className="ml-auto font-medium tabular-nums">{fmtEur(fV)}</span></div><div className="flex items-center gap-2"><span className="h-2 w-2 rounded-full flex-shrink-0" style={{ background: 'hsl(262, 83%, 58%)' }} /><span className="text-muted-foreground">Warenkapital:</span><span className="ml-auto font-medium tabular-nums">{fmtEur(wV)}</span></div><div className="flex items-center gap-2 border-t pt-1 font-semibold"><span>Gesamt:</span><span className="ml-auto tabular-nums">{fmtEur(cV + fV + wV)}</span></div></div>
                  }} />
                  <Legend content={() => <div className="flex justify-center gap-5 pt-2">{[{ label: 'Cashbestand', color: C.cash }, { label: 'Forderungen', color: 'hsl(217, 71%, 65%)' }, { label: 'Warenkapital', color: 'hsl(262, 83%, 58%)' }].map((c) => <div key={c.label} className="flex items-center gap-1.5 text-xs"><span className="inline-block h-2.5 w-2.5 rounded-sm" style={{ background: c.color }} /><span className="text-muted-foreground">{c.label}</span></div>)}</div>} />
                  <Area type="linear" dataKey="cash"       stackId="uv" stroke={C.cash} fill={C.cash} fillOpacity={0.35} strokeWidth={2} dot={false} activeDot={{ r: 4 }} />
                  <Area type="linear" dataKey="forderungen" stackId="uv" stroke="hsl(217, 71%, 65%)" fill="hsl(217, 71%, 65%)" fillOpacity={0.35} strokeWidth={2} dot={false} activeDot={{ r: 4 }} />
                  <Area type="linear" dataKey="waren"      stackId="uv" stroke="hsl(262, 83%, 58%)" fill="hsl(262, 83%, 58%)" fillOpacity={0.35} strokeWidth={2} dot={false} activeDot={{ r: 4 }} />
                </AreaChart>
              </ResponsiveContainer>
            </div>

            {/* 4. EK-Quote-Entwicklung */}
            <div className="rounded-lg border p-4 space-y-3">
              <span className="text-sm font-medium">EK-Quote-Entwicklung</span>
              <ResponsiveContainer width="100%" height={220}>
                <LineChart data={chartDataVerm} margin={{ top: 4, right: 16, left: 4, bottom: 4 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="name" tick={{ fontSize: 11 }} tickLine={false} axisLine={{ stroke: 'hsl(var(--border))' }} />
                  <YAxis tickFormatter={(v) => `${v.toLocaleString('de-DE', { maximumFractionDigits: 0 })}%`} tick={{ fontSize: 11 }} tickLine={false} axisLine={false} width={48} />
                  <ReferenceLine y={30} stroke={C.quote} strokeDasharray="4 4" strokeOpacity={0.7} label={{ value: '30%', position: 'insideTopRight', fontSize: 10, fill: C.quote }} />
                  <RechartsTooltip content={({ active, payload }) => {
                    if (!active || !payload?.length) return null
                    const e = payload[0]?.payload
                    const v = payload[0]?.value as number | null
                    return <div className="rounded-lg border bg-background p-2.5 shadow-md text-xs min-w-[180px]"><p className="font-semibold border-b pb-1 mb-1">{e?.label}</p><div className="flex items-center gap-2"><span className="h-2 w-2 rounded-full" style={{ background: C.quote }} /><span className="text-muted-foreground">EK-Quote:</span><span className="ml-auto font-medium tabular-nums">{v !== null ? `${v.toLocaleString('de-DE', { maximumFractionDigits: 1 })}%` : '—'}</span></div></div>
                  }} />
                  <Line type="linear" dataKey="ekQuote" stroke={C.quote} strokeWidth={2} dot={false} activeDot={{ r: 4 }} connectNulls={false} />
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
