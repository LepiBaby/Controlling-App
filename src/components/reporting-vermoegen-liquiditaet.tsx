'use client'

import { useState } from 'react'
import {
  ResponsiveContainer,
  LineChart,
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

function fmtRatio(v: number | null): string {
  if (v === null) return '—'
  return v.toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
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

function ampel(v: number | null, greenMin: number, yellowMin: number): AmpelColor | null {
  if (v === null) return null
  if (v >= greenMin)  return 'green'
  if (v >= yellowMin) return 'yellow'
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
  negative?: boolean
  ampelColor?: AmpelColor | null
  benchmark?: string
  items?: { label: string; value: string }[]
  selected?: boolean
  onSelect: (id: string) => void
}

function KpiCard({ id, title, tooltip, value, negative, ampelColor, benchmark, items, selected, onSelect }: KpiCardProps) {
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
          <p className={`text-2xl font-semibold tabular-nums ${negative ? 'text-destructive' : ''}`}>
            {value}
          </p>
          {ampelColor && (
            <Badge className={`text-xs px-1.5 py-0 h-5 ${AMPEL_CLASS[ampelColor]}`} variant="outline">
              {AMPEL_LABEL[ampelColor]}
            </Badge>
          )}
        </div>
        {benchmark && <p className="text-xs text-muted-foreground">{benchmark}</p>}
        {items && items.length > 0 && (
          <div className="space-y-0.5 text-xs text-muted-foreground border-t pt-1.5 mt-1">
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

// ─── Farben ───────────────────────────────────────────────────────────────────

const C = {
  cashRatio:    'hsl(217, 91%, 50%)',
  quickRatio:   'hsl(142, 76%, 36%)',
  currentRatio: 'hsl(262, 83%, 58%)',
  wc:           'hsl(217, 91%, 50%)',
  negativ:      'hsl(0, 84%, 50%)',
}
const DARK_RED = 'hsl(0, 65%, 38%)'

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

function LiqDetail({ kpi, latest, series }: { kpi: string; latest: VermoegenKPIs; series: VermoegenKPIs[] }) {
  const hasSeries = series.length >= 2

  if (kpi === 'working_capital') {
    const seriesData = series.map((s) => ({ name: fmtDatumShort(s.datum), label: fmtDatumLang(s.datum), value: s.working_capital }))
    const wcRows: BarRowDef[] = [
      { name: 'Working Capital', segments: [{ color: C.wc, value: latest.working_capital }] },
      { name: 'Umlaufvermögen', segments: [
        { color: 'hsl(262, 83%, 58%)',   value: latest.warenkapital,       label: 'Warenkapital' },
        { color: 'hsl(198, 93%, 40%)',   value: latest.cash,               label: 'Cash' },
        { color: 'hsl(217, 71%, 65%)',   value: latest.gesamt_forderungen, label: 'Forderungen' },
      ]},
      { name: 'Verbindlichkeiten', segments: [
        { color: C.negativ,  value: latest.verb_ll,       label: 'Verb. L&L' },
        { color: DARK_RED,   value: latest.verb_sonstige, label: 'Verb. Sonst.' },
      ]},
    ]
    return (
      <div className="space-y-4">
        <div className="rounded-lg border p-4 space-y-3">
          <span className="text-sm font-medium">Komponenten des Working Capital</span>
          <CssBarChart rows={wcRows} />
          <div className="flex flex-wrap justify-center gap-x-4 gap-y-1 pt-1">
            {[
              { label: 'Working Capital',  color: C.wc },
              { label: 'Warenkapital',     color: 'hsl(262,83%,58%)' },
              { label: 'Cash',             color: 'hsl(198,93%,40%)' },
              { label: 'Forderungen',      color: 'hsl(217,71%,65%)' },
              { label: 'Verb. L&L',        color: C.negativ },
              { label: 'Verb. Sonst.',     color: DARK_RED },
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
            <span className="text-sm font-medium">Working Capital-Entwicklung</span>
            <ResponsiveContainer width="100%" height={200}>
              <LineChart data={seriesData} margin={{ top: 4, right: 16, left: 4, bottom: 4 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="name" tick={{ fontSize: 11 }} tickLine={false} axisLine={{ stroke: 'hsl(var(--border))' }} />
                <YAxis tickFormatter={fmtEurShort} tick={{ fontSize: 11 }} tickLine={false} axisLine={false} width={76} />
                <ReferenceLine y={0} stroke="hsl(var(--border))" strokeWidth={1.5} />
                <RechartsTooltip content={({ active, payload, label }) => {
                  if (!active || !payload?.length) return null
                  const entry = payload[0]?.payload
                  return <div className="rounded-lg border bg-background p-2.5 shadow-md text-xs min-w-[200px]"><p className="font-semibold border-b pb-1 mb-1">{entry?.label ?? label}</p><div className="flex items-center gap-2"><span className="text-muted-foreground">Working Capital:</span><span className="ml-auto font-medium tabular-nums">{fmtEur(payload[0]?.value as number)}</span></div></div>
                }} />
                <Line type="linear" dataKey="value" stroke={C.wc} strokeWidth={2} dot={false} activeDot={{ r: 4 }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        ) : <NoSeries />}
      </div>
    )
  }

  const ratioConfig: Record<string, { label: string; color: string; refY: number; numeratorLabel: string }> = {
    cash_ratio:    { label: 'Cash Ratio',    color: C.cashRatio,    refY: 0.70, numeratorLabel: 'Cashbestand' },
    quick_ratio:   { label: 'Quick Ratio',   color: C.quickRatio,   refY: 1.00, numeratorLabel: 'Cash + Forderungen' },
    current_ratio: { label: 'Current Ratio', color: C.currentRatio, refY: 2.00, numeratorLabel: 'Cash + Forderungen + Warenkapital' },
  }

  const cfg = ratioConfig[kpi]
  if (!cfg) return null

  const ratioValue = kpi === 'cash_ratio' ? latest.cash_ratio : kpi === 'quick_ratio' ? latest.quick_ratio : latest.current_ratio

  const numeratorSegs: BarSeg[] = kpi === 'cash_ratio'
    ? [{ color: C.cashRatio, value: latest.cash, label: 'Cashbestand' }]
    : kpi === 'quick_ratio'
    ? [{ color: C.cashRatio, value: latest.cash, label: 'Cash' }, { color: C.quickRatio, value: latest.gesamt_forderungen, label: 'Forderungen' }]
    : [{ color: C.cashRatio, value: latest.cash, label: 'Cash' }, { color: C.quickRatio, value: latest.gesamt_forderungen, label: 'Forderungen' }, { color: C.currentRatio, value: latest.warenkapital, label: 'Warenkapital' }]

  const ratioRows: BarRowDef[] = [
    { name: cfg.numeratorLabel, segments: numeratorSegs },
    { name: 'Verbindlichkeiten', segments: [
      { color: C.negativ, value: latest.verb_ll,       label: 'Verb. L&L' },
      { color: DARK_RED,  value: latest.verb_sonstige, label: 'Verb. Sonst.' },
    ]},
  ]

  const seriesData = series.map((s) => {
    const v = kpi === 'cash_ratio' ? s.cash_ratio : kpi === 'quick_ratio' ? s.quick_ratio : s.current_ratio
    return { name: fmtDatumShort(s.datum), label: fmtDatumLang(s.datum), value: v }
  })

  return (
    <div className="space-y-4">
      <div className="rounded-lg border p-4 space-y-3">
        <div className="flex items-center justify-between">
          <span className="text-sm font-medium">Zähler vs. Nenner — {cfg.label}</span>
          <span className="text-sm font-semibold tabular-nums">{fmtRatio(ratioValue)}</span>
        </div>
        <CssBarChart rows={ratioRows} />
      </div>
      {hasSeries ? (
        <div className="rounded-lg border p-4 space-y-3">
          <span className="text-sm font-medium">{cfg.label}-Entwicklung</span>
          <ResponsiveContainer width="100%" height={200}>
            <LineChart data={seriesData} margin={{ top: 4, right: 16, left: 4, bottom: 4 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis dataKey="name" tick={{ fontSize: 11 }} tickLine={false} axisLine={{ stroke: 'hsl(var(--border))' }} />
              <YAxis tickFormatter={(v) => v.toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} tick={{ fontSize: 11 }} tickLine={false} axisLine={false} width={52} />
              <ReferenceLine y={cfg.refY} stroke={cfg.color} strokeDasharray="4 4" strokeOpacity={0.7} label={{ value: cfg.refY.toLocaleString('de-DE', { minimumFractionDigits: 2 }), position: 'insideTopRight', fontSize: 10, fill: cfg.color }} />
              <RechartsTooltip content={({ active, payload, label }) => {
                if (!active || !payload?.length) return null
                const entry = payload[0]?.payload
                const v = payload[0]?.value as number | null
                const fmtR = (n: number) => n.toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
                return (
                  <div className="rounded-lg border bg-background p-2.5 shadow-md text-xs space-y-1 min-w-[200px]">
                    <p className="font-semibold border-b pb-1 mb-1">{entry?.label ?? label}</p>
                    <div className="flex items-center gap-2">
                      <span className="h-2 w-2 rounded-full flex-shrink-0" style={{ background: cfg.color }} />
                      <span className="text-muted-foreground">{cfg.label}:</span>
                      <span className="ml-auto font-medium tabular-nums">{v !== null && v !== undefined ? fmtR(v) : '—'}</span>
                    </div>
                    <div className="flex items-center gap-2 text-muted-foreground border-t pt-1">
                      <span>Richtwert:</span>
                      <span className="ml-auto tabular-nums">≥ {fmtR(cfg.refY)}</span>
                    </div>
                  </div>
                )
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

export function ReportingVermoegenLiquiditaet({ latest, series }: Props) {
  const [selectedKpi, setSelectedKpi] = useState<string | null>(null)
  const hasSeries = series.length >= 2

  function handleSelect(id: string) {
    setSelectedKpi((prev) => (prev === id ? null : id))
  }

  const gesamtVerbindlichkeiten = latest.verb_ll + latest.verb_sonstige
  const cashPlusFord = latest.cash + latest.gesamt_forderungen
  const cashFordWK   = latest.cash + latest.gesamt_forderungen + latest.warenkapital

  const chartDataRatios = series.map((s) => ({ name: fmtDatumShort(s.datum), label: fmtDatumLang(s.datum), cashRatio: s.cash_ratio, quickRatio: s.quick_ratio, currentRatio: s.current_ratio }))
  const chartDataWC = series.map((s) => ({ name: fmtDatumShort(s.datum), label: fmtDatumLang(s.datum), wc: s.working_capital }))

  const RATIO_LINES = [
    { key: 'cashRatio',    label: 'Cash Ratio',    grade: 1, color: C.cashRatio,    refY: 0.70 },
    { key: 'quickRatio',   label: 'Quick Ratio',   grade: 2, color: C.quickRatio,   refY: 1.00 },
    { key: 'currentRatio', label: 'Current Ratio', grade: 3, color: C.currentRatio, refY: 2.00 },
  ] as const

  return (
    <TooltipProvider>
      <div className="space-y-6 pt-4">
        {/* KPI-Kacheln */}
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          <KpiCard
            id="working_capital"
            title="Working Capital"
            tooltip="Kurzfristig verfügbare Liquidität. Warenkapital + Cash + Forderungen − Verbindlichkeiten. Positiv = Puffer vorhanden."
            value={fmtEur(latest.working_capital)}
            negative={latest.working_capital < 0}
            selected={selectedKpi === 'working_capital'}
            onSelect={handleSelect}
            items={[
              { label: 'Warenkapital', value: fmtEur(latest.warenkapital) },
              { label: 'Cashbestand', value: fmtEur(latest.cash) },
              { label: 'Forderungen', value: fmtEur(latest.gesamt_forderungen) },
              { label: 'Verb. L&L', value: `− ${fmtEur(latest.verb_ll)}` },
              { label: 'Verb. Sonst.', value: `− ${fmtEur(latest.verb_sonstige)}` },
            ]}
          />
          <KpiCard
            id="cash_ratio"
            title="Cash Ratio (Grad 1)"
            tooltip="Sofortige Liquiditätsfähigkeit. Anteil der kurzfristigen Verbindlichkeiten, die allein mit Cash gedeckt werden können. Cash ÷ (Verb. L&L + Verb. Sonst.). Richtwert: ≥ 0,70."
            value={fmtRatio(latest.cash_ratio)}
            ampelColor={ampel(latest.cash_ratio, 0.70, 0.50)}
            benchmark="Richtwert: ≥ 0,70"
            selected={selectedKpi === 'cash_ratio'}
            onSelect={handleSelect}
            items={[
              { label: 'Cashbestand', value: fmtEur(latest.cash) },
              { label: 'Verbindlichkeiten', value: fmtEur(gesamtVerbindlichkeiten) },
            ]}
          />
          <KpiCard
            id="quick_ratio"
            title="Quick Ratio (Grad 2)"
            tooltip="Liquiditätsdeckung mit liquiden Mitteln und Forderungen. (Cash + Forderungen) ÷ (Verb. L&L + Verb. Sonst.). Richtwert: ≥ 1,00."
            value={fmtRatio(latest.quick_ratio)}
            ampelColor={ampel(latest.quick_ratio, 1.00, 0.70)}
            benchmark="Richtwert: ≥ 1,00"
            selected={selectedKpi === 'quick_ratio'}
            onSelect={handleSelect}
            items={[
              { label: 'Cash + Forderungen', value: fmtEur(cashPlusFord) },
              { label: 'Verbindlichkeiten', value: fmtEur(gesamtVerbindlichkeiten) },
            ]}
          />
          <KpiCard
            id="current_ratio"
            title="Current Ratio (Grad 3)"
            tooltip="Vollständige kurzfristige Liquiditätsdeckung inkl. Warenbestand. (Cash + Forderungen + Warenkapital) ÷ (Verb. L&L + Verb. Sonst.). Richtwert: ≥ 2,00."
            value={fmtRatio(latest.current_ratio)}
            ampelColor={ampel(latest.current_ratio, 2.00, 1.00)}
            benchmark="Richtwert: ≥ 2,00"
            selected={selectedKpi === 'current_ratio'}
            onSelect={handleSelect}
            items={[
              { label: 'Cash + Forderungen + Warenkapital', value: fmtEur(cashFordWK) },
              { label: 'Verbindlichkeiten', value: fmtEur(gesamtVerbindlichkeiten) },
            ]}
          />
        </div>

        {/* Detail oder globale Zeitreihen */}
        {selectedKpi ? (
          <LiqDetail kpi={selectedKpi} latest={latest} series={series} />
        ) : hasSeries ? (
          <>
            <div className="rounded-lg border p-4 space-y-3">
              <span className="text-sm font-medium">Working Capital-Entwicklung</span>
              <ResponsiveContainer width="100%" height={220}>
                <LineChart data={chartDataWC} margin={{ top: 4, right: 16, left: 4, bottom: 4 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="name" tick={{ fontSize: 11 }} tickLine={false} axisLine={{ stroke: 'hsl(var(--border))' }} />
                  <YAxis tickFormatter={fmtEurShort} tick={{ fontSize: 11 }} tickLine={false} axisLine={false} width={76} />
                  <ReferenceLine y={0} stroke="hsl(var(--border))" strokeWidth={1.5} />
                  <RechartsTooltip content={({ active, payload, label }) => {
                    if (!active || !payload?.length) return null
                    const entry = payload[0]?.payload
                    return <div className="rounded-lg border bg-background p-2.5 shadow-md text-xs min-w-[200px]"><p className="font-semibold border-b pb-1 mb-1.5">{entry?.label ?? label}</p><div className="flex items-center gap-2"><span className="h-2 w-2 rounded-full" style={{ background: C.wc }} /><span className="text-muted-foreground">Working Capital:</span><span className="ml-auto font-medium tabular-nums">{fmtEur(payload[0]?.value as number)}</span></div></div>
                  }} />
                  <Line type="linear" dataKey="wc" stroke={C.wc} strokeWidth={2} dot={false} activeDot={{ r: 4 }} />
                </LineChart>
              </ResponsiveContainer>
            </div>
            <div className="rounded-lg border p-4 space-y-3">
              <span className="text-sm font-medium">Liquiditätsgrade-Entwicklung</span>
              <ResponsiveContainer width="100%" height={300}>
                <LineChart data={chartDataRatios} margin={{ top: 4, right: 16, left: 4, bottom: 4 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="name" tick={{ fontSize: 11 }} tickLine={false} axisLine={{ stroke: 'hsl(var(--border))' }} />
                  <YAxis tickFormatter={(v) => v.toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} tick={{ fontSize: 11 }} tickLine={false} axisLine={false} width={56} />
                  <RechartsTooltip content={({ active, payload, label }) => {
                    if (!active || !payload?.length) return null
                    const entry = payload[0]?.payload
                    const fmtR = (n: number) => n.toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
                    return (
                      <div className="rounded-lg border bg-background p-2.5 shadow-md text-xs space-y-1 min-w-[220px]">
                        <p className="font-semibold border-b pb-1 mb-1.5">{entry?.label ?? label}</p>
                        {RATIO_LINES.map((line) => {
                          const p = payload.find((e) => e.dataKey === line.key)
                          const v = p?.value as number | null
                          return (
                            <div key={line.key} className="flex items-center gap-2">
                              <span className="h-2 w-2 rounded-full flex-shrink-0" style={{ background: line.color }} />
                              <span className="text-muted-foreground">{line.label} ({line.grade}):</span>
                              <span className="ml-auto font-medium tabular-nums">{v !== null && v !== undefined ? fmtR(v) : '—'}</span>
                              <span className="text-muted-foreground tabular-nums">(≥ {fmtR(line.refY)})</span>
                            </div>
                          )
                        })}
                      </div>
                    )
                  }} />
                  <ReferenceLine y={0.70} stroke={C.cashRatio}    strokeDasharray="4 4" strokeOpacity={0.6} />
                  <ReferenceLine y={1.00} stroke={C.quickRatio}   strokeDasharray="4 4" strokeOpacity={0.6} />
                  <ReferenceLine y={2.00} stroke={C.currentRatio} strokeDasharray="4 4" strokeOpacity={0.6} />
                  <Legend content={() => (
                    <div className="flex flex-wrap justify-center gap-x-5 gap-y-1 pt-2">
                      {RATIO_LINES.map((l) => (
                        <div key={l.key} className="flex items-center gap-1.5 text-xs">
                          <span className="inline-block h-0.5 w-5 rounded-full" style={{ background: l.color }} />
                          <span className="text-muted-foreground">{l.label}</span>
                        </div>
                      ))}
                    </div>
                  )} />
                  {RATIO_LINES.map((line) => (
                    <Line key={line.key} type="linear" dataKey={line.key} stroke={line.color} strokeWidth={2} dot={false} activeDot={{ r: 4 }} connectNulls={false} />
                  ))}
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
