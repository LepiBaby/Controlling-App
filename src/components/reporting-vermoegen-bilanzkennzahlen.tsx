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
import { Progress } from '@/components/ui/progress'
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

// ─── Chart-Farben ─────────────────────────────────────────────────────────────

const C = {
  ek:      'hsl(142, 76%, 36%)',
  fk:      'hsl(0, 84%, 50%)',
  quote:   'hsl(217, 91%, 50%)',
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

export function ReportingVermoegenBilanzkennzahlen({ latest, series }: Props) {
  const hasSeries = series.length >= 2

  const ekPct = latest.ek_quote !== null ? latest.ek_quote * 100 : null
  const ampelColor = ampelEkQuote(latest.ek_quote)

  const chartDataVerm = series.map((s) => ({
    name: fmtDatumShort(s.datum),
    label: fmtDatumLang(s.datum),
    ek: s.eigenkapital,
    fk: s.fremdkapital,
    gesamt: s.gesamtvermoegen,
    ekQuote: s.ek_quote !== null ? s.ek_quote * 100 : null,
  }))

  const VERM_LINES = [
    { key: 'ek', label: 'Eigenkapital', color: C.ek },
    { key: 'fk', label: 'Fremdkapital', color: C.fk },
  ] as const

  return (
    <div className="space-y-6 pt-4">
      {/* KPI-Kacheln */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6">
        {/* EK */}
        <Card>
          <CardHeader className="pb-1 pt-4 px-4">
            <CardTitle className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
              Eigenkapital
            </CardTitle>
          </CardHeader>
          <CardContent className="pb-4 px-4">
            <p className="text-2xl font-semibold tabular-nums">{fmtEur(latest.eigenkapital)}</p>
            <p className="mt-1 text-xs text-muted-foreground">WK + Ford. + Cash + Anlage</p>
          </CardContent>
        </Card>

        {/* FK */}
        <Card>
          <CardHeader className="pb-1 pt-4 px-4">
            <CardTitle className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
              Fremdkapital
            </CardTitle>
          </CardHeader>
          <CardContent className="pb-4 px-4">
            <p className="text-2xl font-semibold tabular-nums">{fmtEur(latest.fremdkapital)}</p>
            <p className="mt-1 text-xs text-muted-foreground">Verb. L&L + Sonst. + Darlehen</p>
          </CardContent>
        </Card>

        {/* Gesamtvermögen */}
        <Card>
          <CardHeader className="pb-1 pt-4 px-4">
            <CardTitle className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
              Gesamtvermögen
            </CardTitle>
          </CardHeader>
          <CardContent className="pb-4 px-4">
            <p className="text-2xl font-semibold tabular-nums">{fmtEur(latest.gesamtvermoegen)}</p>
            <p className="mt-1 text-xs text-muted-foreground">EK + FK</p>
          </CardContent>
        </Card>

        {/* EK-Quote */}
        <Card>
          <CardHeader className="pb-1 pt-4 px-4">
            <CardTitle className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
              EK-Quote
            </CardTitle>
          </CardHeader>
          <CardContent className="pb-4 px-4 space-y-2">
            <div className="flex items-baseline gap-2">
              <p className="text-2xl font-semibold tabular-nums">{fmtPct(latest.ek_quote)}</p>
              {ampelColor && (
                <Badge className={`text-xs px-1.5 py-0 h-5 ${AMPEL_CLASS[ampelColor]}`} variant="outline">
                  {AMPEL_LABEL[ampelColor]}
                </Badge>
              )}
            </div>
            <p className="text-xs text-muted-foreground">Richtwert: ≥ 30%</p>
            <p className="text-xs text-muted-foreground/70">EK / Gesamtvermögen</p>
          </CardContent>
        </Card>

        {/* FK-Quote */}
        <Card>
          <CardHeader className="pb-1 pt-4 px-4">
            <CardTitle className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
              FK-Quote
            </CardTitle>
          </CardHeader>
          <CardContent className="pb-4 px-4">
            <p className="text-2xl font-semibold tabular-nums">{fmtPct(latest.fk_quote)}</p>
            <p className="mt-1 text-xs text-muted-foreground">FK / Gesamtvermögen</p>
          </CardContent>
        </Card>

        {/* Cash-Quote */}
        <Card>
          <CardHeader className="pb-1 pt-4 px-4">
            <CardTitle className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
              Cash-Quote
            </CardTitle>
          </CardHeader>
          <CardContent className="pb-4 px-4">
            <p className="text-2xl font-semibold tabular-nums">{fmtPct(latest.cash_quote)}</p>
            <p className="mt-1 text-xs text-muted-foreground">Cash / Gesamtvermögen</p>
          </CardContent>
        </Card>
      </div>

      {/* EK/FK Progress-Bar */}
      {ekPct !== null && (
        <div className="rounded-lg border p-4 space-y-3">
          <span className="text-sm font-medium">Kapitalstruktur</span>
          <div className="space-y-1">
            <Progress value={ekPct} className="h-4" />
            <div className="flex justify-between text-xs text-muted-foreground">
              <span className="flex items-center gap-1.5">
                <span className="inline-block h-2.5 w-2.5 rounded-sm bg-green-500" />
                EK {fmtPct(latest.ek_quote)}
              </span>
              <span className="flex items-center gap-1.5">
                <span className="inline-block h-2.5 w-2.5 rounded-sm bg-red-500" />
                FK {fmtPct(latest.fk_quote)}
              </span>
            </div>
          </div>
        </div>
      )}

      {/* Zeitreihen */}
      {hasSeries ? (
        <>
          {/* Vermögensentwicklung EK/FK */}
          <div className="rounded-lg border p-4 space-y-3">
            <span className="text-sm font-medium">Vermögensentwicklung</span>
            <ResponsiveContainer width="100%" height={280}>
              <LineChart data={chartDataVerm} margin={{ top: 4, right: 16, left: 4, bottom: 4 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="name" tick={{ fontSize: 11 }} tickLine={false} axisLine={{ stroke: 'hsl(var(--border))' }} />
                <YAxis tickFormatter={fmtEurShort} tick={{ fontSize: 11 }} tickLine={false} axisLine={false} width={76} />
                <Tooltip
                  content={({ active, payload, label }) => {
                    if (!active || !payload?.length) return null
                    const entry = payload[0]?.payload
                    return (
                      <div className="rounded-lg border bg-background p-2.5 shadow-md text-xs space-y-1 min-w-[220px]">
                        <p className="font-semibold border-b pb-1 mb-1.5">{entry?.label ?? label}</p>
                        {VERM_LINES.map((line) => {
                          const p = payload.find((e) => e.dataKey === line.key)
                          if (!p) return null
                          return (
                            <div key={line.key} className="flex items-center gap-2">
                              <span className="h-2 w-2 rounded-full flex-shrink-0" style={{ background: line.color }} />
                              <span className="text-muted-foreground">{line.label}:</span>
                              <span className="ml-auto font-medium tabular-nums">{fmtEur(p.value as number)}</span>
                            </div>
                          )
                        })}
                        {entry?.gesamt !== undefined && (
                          <div className="flex items-center gap-2 border-t pt-1 mt-0.5">
                            <span className="text-muted-foreground">Gesamtvermögen:</span>
                            <span className="ml-auto font-medium tabular-nums">{fmtEur(entry.gesamt)}</span>
                          </div>
                        )}
                        {entry?.ekQuote !== null && entry?.ekQuote !== undefined && (
                          <div className="flex items-center gap-2">
                            <span className="text-muted-foreground">EK-Quote:</span>
                            <span className="ml-auto font-medium tabular-nums">
                              {`${(entry.ekQuote as number).toLocaleString('de-DE', { maximumFractionDigits: 1 })}%`}
                            </span>
                          </div>
                        )}
                      </div>
                    )
                  }}
                />
                <Legend
                  content={() => (
                    <div className="flex flex-wrap justify-center gap-x-5 gap-y-1 pt-2">
                      {VERM_LINES.map((l) => (
                        <div key={l.key} className="flex items-center gap-1.5 text-xs">
                          <span className="inline-block h-0.5 w-5 rounded-full" style={{ background: l.color }} />
                          <span className="text-muted-foreground">{l.label}</span>
                        </div>
                      ))}
                    </div>
                  )}
                />
                {VERM_LINES.map((line) => (
                  <Line key={line.key} type="linear" dataKey={line.key} stroke={line.color} strokeWidth={2} dot={false} activeDot={{ r: 4 }} />
                ))}
              </LineChart>
            </ResponsiveContainer>
          </div>

          {/* EK-Quote-Trend */}
          <div className="rounded-lg border p-4 space-y-3">
            <span className="text-sm font-medium">EK-Quote-Entwicklung</span>
            <ResponsiveContainer width="100%" height={220}>
              <LineChart data={chartDataVerm} margin={{ top: 4, right: 16, left: 4, bottom: 4 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="name" tick={{ fontSize: 11 }} tickLine={false} axisLine={{ stroke: 'hsl(var(--border))' }} />
                <YAxis
                  tickFormatter={(v) => `${v.toLocaleString('de-DE', { maximumFractionDigits: 0 })}%`}
                  tick={{ fontSize: 11 }} tickLine={false} axisLine={false} width={48}
                />
                {/* Referenzlinie bei 30% */}
                <ReferenceLine y={30} stroke={C.quote} strokeDasharray="4 4" strokeOpacity={0.7} label={{ value: '30%', position: 'insideTopRight', fontSize: 10, fill: C.quote }} />
                <Tooltip
                  content={({ active, payload, label }) => {
                    if (!active || !payload?.length) return null
                    const entry = payload[0]?.payload
                    const v = payload[0]?.value as number | null
                    return (
                      <div className="rounded-lg border bg-background p-2.5 shadow-md text-xs min-w-[180px]">
                        <p className="font-semibold border-b pb-1 mb-1.5">{entry?.label ?? label}</p>
                        <div className="flex items-center gap-2">
                          <span className="h-2 w-2 rounded-full" style={{ background: C.quote }} />
                          <span className="text-muted-foreground">EK-Quote:</span>
                          <span className="ml-auto font-medium tabular-nums">
                            {v !== null ? `${v.toLocaleString('de-DE', { maximumFractionDigits: 1 })}%` : '—'}
                          </span>
                        </div>
                      </div>
                    )
                  }}
                />
                <Line type="linear" dataKey="ekQuote" stroke={C.quote} strokeWidth={2} dot={false} activeDot={{ r: 4 }} connectNulls={false} />
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
