'use client'

import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ReferenceLine,
} from 'recharts'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { LineChart as LineChartIcon } from 'lucide-react'
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

// ─── KPI-Kachel mit Ampel ─────────────────────────────────────────────────────

interface RatioCardProps {
  title: string
  value: string
  ampelColor: AmpelColor | null
  benchmark: string
  sub: string
  negative?: boolean
}

function RatioCard({ title, value, ampelColor, benchmark, sub, negative }: RatioCardProps) {
  return (
    <Card>
      <CardHeader className="pb-1 pt-4 px-4">
        <CardTitle className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
          {title}
        </CardTitle>
      </CardHeader>
      <CardContent className="pb-4 px-4 space-y-2">
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
        <p className="text-xs text-muted-foreground">{benchmark}</p>
        <p className="text-xs text-muted-foreground/70">{sub}</p>
      </CardContent>
    </Card>
  )
}

// ─── Chart-Farben ─────────────────────────────────────────────────────────────

const C = {
  cashRatio:    'hsl(217, 91%, 50%)',
  quickRatio:   'hsl(142, 76%, 36%)',
  currentRatio: 'hsl(262, 83%, 58%)',
  wc:           'hsl(217, 91%, 50%)',
}

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

// ─── Komponente ───────────────────────────────────────────────────────────────

interface Props {
  latest: VermoegenKPIs
  series: VermoegenKPIs[]
}

export function ReportingVermoegenLiquiditaet({ latest, series }: Props) {
  const hasSeries = series.length >= 2

  const chartDataRatios = series.map((s) => ({
    name: fmtDatumShort(s.datum),
    label: fmtDatumLang(s.datum),
    cashRatio:    s.cash_ratio,
    quickRatio:   s.quick_ratio,
    currentRatio: s.current_ratio,
  }))

  const chartDataWC = series.map((s) => ({
    name: fmtDatumShort(s.datum),
    label: fmtDatumLang(s.datum),
    wc: s.working_capital,
  }))

  const RATIO_LINES = [
    { key: 'cashRatio',    label: 'Cash Ratio',    color: C.cashRatio    },
    { key: 'quickRatio',   label: 'Quick Ratio',   color: C.quickRatio   },
    { key: 'currentRatio', label: 'Current Ratio', color: C.currentRatio },
  ] as const

  return (
    <div className="space-y-6 pt-4">
      {/* KPI-Kacheln */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <Card>
          <CardHeader className="pb-1 pt-4 px-4">
            <CardTitle className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
              Working Capital
            </CardTitle>
          </CardHeader>
          <CardContent className="pb-4 px-4">
            <p className={`text-2xl font-semibold tabular-nums ${latest.working_capital < 0 ? 'text-destructive' : ''}`}>
              {fmtEur(latest.working_capital)}
            </p>
            <p className="mt-1 text-xs text-muted-foreground">WK + Cash + Forderungen − Verbindlichkeiten</p>
          </CardContent>
        </Card>

        <RatioCard
          title="Cash Ratio (Grad 1)"
          value={fmtRatio(latest.cash_ratio)}
          ampelColor={ampel(latest.cash_ratio, 0.20, 0.10)}
          benchmark="Richtwert: ≥ 0,20"
          sub="Cash / (Verb. L&L + Verb. Sonst.)"
        />

        <RatioCard
          title="Quick Ratio (Grad 2)"
          value={fmtRatio(latest.quick_ratio)}
          ampelColor={ampel(latest.quick_ratio, 1.00, 0.70)}
          benchmark="Richtwert: ≥ 1,00"
          sub="(Cash + Forderungen) / Verb."
        />

        <RatioCard
          title="Current Ratio (Grad 3)"
          value={fmtRatio(latest.current_ratio)}
          ampelColor={ampel(latest.current_ratio, 2.00, 1.00)}
          benchmark="Richtwert: ≥ 2,00"
          sub="(Cash + Ford. + WK) / Verb."
        />
      </div>

      {/* Zeitreihen */}
      {hasSeries ? (
        <>
          {/* Liquiditätsgrade */}
          <div className="rounded-lg border p-4 space-y-3">
            <span className="text-sm font-medium">Liquiditätsgrade-Entwicklung</span>
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={chartDataRatios} margin={{ top: 4, right: 16, left: 4, bottom: 4 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="name" tick={{ fontSize: 11 }} tickLine={false} axisLine={{ stroke: 'hsl(var(--border))' }} />
                <YAxis
                  tickFormatter={(v) => v.toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  tick={{ fontSize: 11 }} tickLine={false} axisLine={false} width={56}
                />
                <Tooltip
                  content={({ active, payload, label }) => {
                    if (!active || !payload?.length) return null
                    const entry = payload[0]?.payload
                    return (
                      <div className="rounded-lg border bg-background p-2.5 shadow-md text-xs space-y-1 min-w-[220px]">
                        <p className="font-semibold border-b pb-1 mb-1.5">{entry?.label ?? label}</p>
                        {RATIO_LINES.map((line) => {
                          const p = payload.find((e) => e.dataKey === line.key)
                          const v = p?.value as number | null
                          return (
                            <div key={line.key} className="flex items-center gap-2">
                              <span className="h-2 w-2 rounded-full flex-shrink-0" style={{ background: line.color }} />
                              <span className="text-muted-foreground">{line.label}:</span>
                              <span className="ml-auto font-medium tabular-nums">
                                {v !== null && v !== undefined ? v.toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '—'}
                              </span>
                            </div>
                          )
                        })}
                      </div>
                    )
                  }}
                />
                {/* Gestrichelte Referenzlinien */}
                <ReferenceLine y={0.20} stroke={C.cashRatio}    strokeDasharray="4 4" strokeOpacity={0.6} />
                <ReferenceLine y={1.00} stroke={C.quickRatio}   strokeDasharray="4 4" strokeOpacity={0.6} />
                <ReferenceLine y={2.00} stroke={C.currentRatio} strokeDasharray="4 4" strokeOpacity={0.6} />
                <Legend
                  content={() => (
                    <div className="flex flex-wrap justify-center gap-x-5 gap-y-1 pt-2">
                      {RATIO_LINES.map((l) => (
                        <div key={l.key} className="flex items-center gap-1.5 text-xs">
                          <span className="inline-block h-0.5 w-5 rounded-full" style={{ background: l.color }} />
                          <span className="text-muted-foreground">{l.label}</span>
                        </div>
                      ))}
                    </div>
                  )}
                />
                {RATIO_LINES.map((line) => (
                  <Line key={line.key} type="linear" dataKey={line.key} stroke={line.color} strokeWidth={2} dot={false} activeDot={{ r: 4 }} connectNulls={false} />
                ))}
              </LineChart>
            </ResponsiveContainer>
          </div>

          {/* Working Capital */}
          <div className="rounded-lg border p-4 space-y-3">
            <span className="text-sm font-medium">Working Capital-Entwicklung</span>
            <ResponsiveContainer width="100%" height={220}>
              <LineChart data={chartDataWC} margin={{ top: 4, right: 16, left: 4, bottom: 4 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="name" tick={{ fontSize: 11 }} tickLine={false} axisLine={{ stroke: 'hsl(var(--border))' }} />
                <YAxis tickFormatter={fmtEurShort} tick={{ fontSize: 11 }} tickLine={false} axisLine={false} width={76} />
                <ReferenceLine y={0} stroke="hsl(var(--border))" strokeWidth={1.5} />
                <Tooltip
                  content={({ active, payload, label }) => {
                    if (!active || !payload?.length) return null
                    const entry = payload[0]?.payload
                    return (
                      <div className="rounded-lg border bg-background p-2.5 shadow-md text-xs min-w-[200px]">
                        <p className="font-semibold border-b pb-1 mb-1.5">{entry?.label ?? label}</p>
                        <div className="flex items-center gap-2">
                          <span className="h-2 w-2 rounded-full" style={{ background: C.wc }} />
                          <span className="text-muted-foreground">Working Capital:</span>
                          <span className="ml-auto font-medium tabular-nums">{fmtEur(payload[0]?.value as number)}</span>
                        </div>
                      </div>
                    )
                  }}
                />
                <Line type="linear" dataKey="wc" stroke={C.wc} strokeWidth={2} dot={false} activeDot={{ r: 4 }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </>
      ) : (
        <NoSeries />
      )}
    </div>
  )
}
