'use client'

import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ReferenceLine,
  Legend,
} from 'recharts'
import { LineChart as LineChartIcon } from 'lucide-react'
import { Skeleton } from '@/components/ui/skeleton'
import type { ReportingLiquiditaetData } from '@/hooks/use-reporting-liquiditaet'

function formatPeriode(periode: string): string {
  if (periode.includes('-Q')) {
    const [year, q] = periode.split('-')
    return `${q} ${year}`
  }
  if (/^\d{4}-\d{2}$/.test(periode)) {
    const [year, month] = periode.split('-')
    const names = ['Jan', 'Feb', 'Mär', 'Apr', 'Mai', 'Jun', 'Jul', 'Aug', 'Sep', 'Okt', 'Nov', 'Dez']
    return `${names[parseInt(month, 10) - 1]} ${year}`
  }
  return periode
}

function formatShort(value: number): string {
  const abs = Math.abs(value)
  if (abs >= 1_000_000) {
    return `${(value / 1_000_000).toLocaleString('de-DE', { maximumFractionDigits: 1 })}M €`
  }
  if (abs >= 1_000) {
    return `${(value / 1_000).toLocaleString('de-DE', { maximumFractionDigits: 1 })}k €`
  }
  return `${value.toLocaleString('de-DE', { maximumFractionDigits: 0 })} €`
}

function formatFull(value: number): string {
  return new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR' }).format(value)
}

const LINES = [
  { key: 'einnahmen', label: 'Einnahmen', color: 'hsl(142, 76%, 36%)' },
  { key: 'ausgaben_abs', label: 'Ausgaben', color: 'hsl(0, 84%, 50%)' },
  { key: 'cashflow', label: 'Cashflow der Periode', color: 'hsl(217, 91%, 50%)' },
] as const

interface Props {
  data: ReportingLiquiditaetData | null
  loading: boolean
  hasDateRange: boolean
}

export function ReportingLiquiditaetChart({ data, loading, hasDateRange }: Props) {
  if (!hasDateRange) {
    return (
      <div className="rounded-lg border border-dashed p-4">
        <div className="flex flex-col items-center justify-center h-48 gap-2 text-muted-foreground text-sm">
          <LineChartIcon className="h-7 w-7" />
          Bitte Zeitraum auswählen, um das Diagramm zu laden.
        </div>
      </div>
    )
  }

  if (loading) {
    return (
      <div className="rounded-lg border p-4 space-y-3">
        <Skeleton className="h-5 w-32" />
        <Skeleton className="h-[300px] w-full" />
      </div>
    )
  }

  if (
    !data ||
    (data.einnahmen_kategorien.length === 0 && data.ausgaben_kategorien.length === 0)
  ) {
    return null
  }

  const chartData = data.perioden.map(p => ({
    name: formatPeriode(p),
    einnahmen: data.gesamt_einnahmen[p] ?? 0,
    ausgaben_abs: Math.abs(data.gesamt_ausgaben[p] ?? 0),
    cashflow: data.cashflow[p] ?? 0,
  }))

  return (
    <div className="rounded-lg border p-4 space-y-3">
      <span className="text-sm font-medium">Cashflow-Verlauf</span>

      <ResponsiveContainer width="100%" height={300}>
        <LineChart data={chartData} margin={{ top: 4, right: 16, left: 4, bottom: 4 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
          <XAxis
            dataKey="name"
            tick={{ fontSize: 11 }}
            tickLine={false}
            axisLine={{ stroke: 'hsl(var(--border))' }}
          />
          <YAxis
            tickFormatter={formatShort}
            tick={{ fontSize: 11 }}
            tickLine={false}
            axisLine={false}
            width={76}
          />
          <Tooltip
            content={({ active, payload, label }) => {
              if (!active || !payload?.length) return null
              return (
                <div className="rounded-lg border bg-background p-2.5 shadow-md text-xs space-y-1 min-w-[200px]">
                  <p className="font-semibold border-b pb-1 mb-1.5">{label}</p>
                  {LINES.map(line => {
                    const entry = payload.find(e => e.dataKey === line.key)
                    if (!entry || entry.value == null) return null
                    return (
                      <div key={line.key} className="flex items-center gap-2">
                        <span
                          className="h-2 w-2 rounded-full flex-shrink-0"
                          style={{ background: line.color }}
                        />
                        <span className="text-muted-foreground truncate max-w-[120px]">
                          {line.label}:
                        </span>
                        <span className="ml-auto font-medium tabular-nums">
                          {formatFull(entry.value as number)}
                        </span>
                      </div>
                    )
                  })}
                </div>
              )
            }}
          />
          <ReferenceLine y={0} stroke="hsl(var(--border))" strokeWidth={1.5} />
          <Legend
            content={() => (
              <div className="flex flex-wrap justify-center gap-x-5 gap-y-1 pt-2">
                {LINES.map(line => (
                  <div key={line.key} className="flex items-center gap-1.5 text-xs">
                    <span
                      className="inline-block h-0.5 w-5 rounded-full flex-shrink-0"
                      style={{ background: line.color }}
                    />
                    <span className="text-muted-foreground">{line.label}</span>
                  </div>
                ))}
              </div>
            )}
          />
          {LINES.map(line => (
            <Line
              key={line.key}
              type="linear"
              dataKey={line.key}
              name={line.label}
              stroke={line.color}
              strokeWidth={2}
              dot={false}
              activeDot={{ r: 4 }}
              connectNulls={false}
            />
          ))}
        </LineChart>
      </ResponsiveContainer>
    </div>
  )
}
