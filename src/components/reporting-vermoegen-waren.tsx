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
} from 'recharts'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { LineChart as LineChartIcon } from 'lucide-react'
import type { VermoegenKPIs } from '@/hooks/use-reporting-vermoegen'

// ─── Formatierungs-Hilfsfunktionen ────────────────────────────────────────────

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

// ─── KPI-Kachel ───────────────────────────────────────────────────────────────

interface KpiCardProps {
  title: string
  value: string
  sub?: string
  negative?: boolean
}

function KpiCard({ title, value, sub, negative }: KpiCardProps) {
  return (
    <Card>
      <CardHeader className="pb-1 pt-4 px-4">
        <CardTitle className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
          {title}
        </CardTitle>
      </CardHeader>
      <CardContent className="pb-4 px-4">
        <p className={`text-2xl font-semibold tabular-nums ${negative ? 'text-destructive' : ''}`}>
          {value}
        </p>
        {sub && <p className="mt-1 text-xs text-muted-foreground">{sub}</p>}
      </CardContent>
    </Card>
  )
}

// ─── Chart-Farben ─────────────────────────────────────────────────────────────

const C = {
  lager:        'hsl(217, 91%, 50%)',
  transit:      'hsl(142, 76%, 36%)',
  warenkapital: 'hsl(262, 83%, 58%)',
  quote:        'hsl(38, 92%, 50%)',
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

// ─── Komponente ───────────────────────────────────────────────────────────────

interface Props {
  latest: VermoegenKPIs
  series: VermoegenKPIs[]
}

export function ReportingVermoegenWaren({ latest, series }: Props) {
  const hasSeries = series.length >= 2

  const chartDataWK = series.map((s) => ({
    name: fmtDatumShort(s.datum),
    label: fmtDatumLang(s.datum),
    lager: s.lager,
    transit: s.transit,
    warenkapital: s.warenkapital,
  }))

  const chartDataQuote = series.map((s) => ({
    name: fmtDatumShort(s.datum),
    label: fmtDatumLang(s.datum),
    quote: s.warenbindungsquote !== null ? s.warenbindungsquote * 100 : null,
  }))

  return (
    <div className="space-y-6 pt-4">
      {/* KPI-Kacheln */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
        <Card>
          <CardHeader className="pb-1 pt-4 px-4">
            <CardTitle className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
              Warenkapital
            </CardTitle>
          </CardHeader>
          <CardContent className="pb-4 px-4">
            <p className="text-2xl font-semibold tabular-nums">{fmtEur(latest.warenkapital)}</p>
            <p className="mt-1 text-xs text-muted-foreground">
              Lager: {fmtEur(latest.lager)}
            </p>
            <p className="text-xs text-muted-foreground">
              Transit: {fmtEur(latest.transit)}
            </p>
          </CardContent>
        </Card>

        <KpiCard
          title="Lager-Anteil"
          value={fmtPct(latest.lager_anteil)}
          sub="Lager / Warenkapital"
        />

        <KpiCard
          title="Warenkapitalbindung"
          value={fmtEur(latest.warenkapitalbindung)}
          sub="Warenkapital − Verb. L&L"
          negative={latest.warenkapitalbindung < 0}
        />

        <KpiCard
          title="Warenbindungsquote"
          value={fmtPct(latest.warenbindungsquote)}
          sub="Kapitalbindung / Netto-UV"
        />

        <KpiCard
          title="Lagerreichweite"
          value={fmtMonate(latest.lagerreichweite)}
          sub="Warenkapital / (Ø-Send. × Kosten)"
        />
      </div>

      {/* Zeitreihen */}
      {hasSeries ? (
        <>
          {/* Warenkapital-Entwicklung */}
          <div className="rounded-lg border p-4 space-y-3">
            <span className="text-sm font-medium">Warenkapital-Entwicklung</span>
            <ResponsiveContainer width="100%" height={280}>
              <LineChart data={chartDataWK} margin={{ top: 4, right: 16, left: 4, bottom: 4 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="name" tick={{ fontSize: 11 }} tickLine={false} axisLine={{ stroke: 'hsl(var(--border))' }} />
                <YAxis tickFormatter={fmtEurShort} tick={{ fontSize: 11 }} tickLine={false} axisLine={false} width={76} />
                <Tooltip
                  content={({ active, payload, label }) => {
                    if (!active || !payload?.length) return null
                    const entry = payload[0]?.payload
                    return (
                      <div className="rounded-lg border bg-background p-2.5 shadow-md text-xs space-y-1 min-w-[200px]">
                        <p className="font-semibold border-b pb-1 mb-1.5">{entry?.label ?? label}</p>
                        {[
                          { key: 'lager', label: 'Lager', color: C.lager },
                          { key: 'transit', label: 'Transit', color: C.transit },
                          { key: 'warenkapital', label: 'Warenkapital', color: C.warenkapital },
                        ].map((line) => {
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
                      </div>
                    )
                  }}
                />
                <Legend
                  content={() => (
                    <div className="flex flex-wrap justify-center gap-x-5 gap-y-1 pt-2">
                      {[
                        { label: 'Lager', color: C.lager },
                        { label: 'Transit', color: C.transit },
                        { label: 'Warenkapital', color: C.warenkapital },
                      ].map((l) => (
                        <div key={l.label} className="flex items-center gap-1.5 text-xs">
                          <span className="inline-block h-0.5 w-5 rounded-full" style={{ background: l.color }} />
                          <span className="text-muted-foreground">{l.label}</span>
                        </div>
                      ))}
                    </div>
                  )}
                />
                <Line type="linear" dataKey="lager"        stroke={C.lager}        strokeWidth={2} dot={false} activeDot={{ r: 4 }} />
                <Line type="linear" dataKey="transit"      stroke={C.transit}      strokeWidth={2} dot={false} activeDot={{ r: 4 }} />
                <Line type="linear" dataKey="warenkapital" stroke={C.warenkapital} strokeWidth={2} dot={false} activeDot={{ r: 4 }} />
              </LineChart>
            </ResponsiveContainer>
          </div>

          {/* Warenbindungsquote-Entwicklung */}
          <div className="rounded-lg border p-4 space-y-3">
            <span className="text-sm font-medium">Warenbindungsquote-Entwicklung</span>
            <ResponsiveContainer width="100%" height={220}>
              <LineChart data={chartDataQuote} margin={{ top: 4, right: 16, left: 4, bottom: 4 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="name" tick={{ fontSize: 11 }} tickLine={false} axisLine={{ stroke: 'hsl(var(--border))' }} />
                <YAxis
                  tickFormatter={(v) => `${v.toLocaleString('de-DE', { maximumFractionDigits: 1 })}%`}
                  tick={{ fontSize: 11 }} tickLine={false} axisLine={false} width={56}
                />
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
                          <span className="text-muted-foreground">Warenbindungsquote:</span>
                          <span className="ml-auto font-medium tabular-nums">
                            {v !== null ? `${v.toLocaleString('de-DE', { maximumFractionDigits: 1 })}%` : '—'}
                          </span>
                        </div>
                      </div>
                    )
                  }}
                />
                <Line type="linear" dataKey="quote" stroke={C.quote} strokeWidth={2} dot={false} activeDot={{ r: 4 }} connectNulls={false} />
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
