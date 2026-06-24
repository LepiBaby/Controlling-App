'use client'

import { useMemo } from 'react'
import {
  ResponsiveContainer, AreaChart, Area, LineChart, Line,
  XAxis, YAxis, CartesianGrid, Tooltip, ReferenceLine, Legend,
} from 'recharts'
import { Skeleton } from '@/components/ui/skeleton'
import {
  computeCascade,
  bruttoByColumn,
  UK_CHART_AREAS,
  type UkModel,
  type UkNode,
  type UkAnzeigemodus,
} from '@/hooks/use-langfristige-umsatzkosten-auswertung'

// PROJ-97: Diagramm der Umsatzkosten-Auswertung. Nutzervorgabe: gestapelte Bereiche,
// in denen Produktkosten + Vertriebskosten + Marketingkosten zusammen die gesamten
// Umsatzkosten bilden. In den Modi „Absolut" und „Prozentual" gestapelte Flächen
// (Stapelhöhe = Umsatzkosten gesamt); im Modus „Wachstum" stattdessen drei Linien
// (Wachstumsraten zu stapeln ist nicht sinnvoll). Kosten werden als positive
// Magnituden dargestellt, damit der Stapel nach oben wächst.

function formatAbsolutShort(value: number): string {
  const abs = Math.abs(value)
  if (abs >= 1_000_000) return `${(value / 1_000_000).toLocaleString('de-DE', { maximumFractionDigits: 1 })}M €`
  if (abs >= 1_000) return `${(value / 1_000).toLocaleString('de-DE', { maximumFractionDigits: 1 })}k €`
  return `${value.toLocaleString('de-DE', { maximumFractionDigits: 0 })} €`
}
function formatAbsolutFull(value: number): string {
  return new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR' }).format(value)
}
function formatProzent(value: number): string {
  return `${value.toLocaleString('de-DE', { minimumFractionDigits: 1, maximumFractionDigits: 1 })} %`
}
function formatWachstumTick(value: number): string {
  if (value === 0) return '0,0 %'
  const str = Math.abs(value).toLocaleString('de-DE', { minimumFractionDigits: 1, maximumFractionDigits: 1 })
  return value > 0 ? `+${str} %` : `−${str} %`
}
function calcWachstum(value: number, vorwert: number | undefined): number | 'n/a' | null {
  if (vorwert === undefined) return null
  if (vorwert === 0 && value === 0) return 0
  if (vorwert === 0) return 'n/a'
  return ((value - vorwert) / Math.abs(vorwert)) * 100
}

interface Props {
  model: UkModel
  anzeigemodus: UkAnzeigemodus
}

export function LangfristigeUmsatzkostenAuswertungChart({ model, anzeigemodus }: Props) {
  const { columns, lines, loading } = model

  const nodes = useMemo(() => computeCascade(lines, columns), [lines, columns])
  const nodeById = useMemo(() => new Map(nodes.map(n => [n.id, n])), [nodes])

  const bruttoBasis = useMemo(
    () => (anzeigemodus === 'prozentual' ? bruttoByColumn(model, columns) : null),
    [anzeigemodus, model, columns],
  )

  // Kostenmagnitude je Kostenart und Spalte (positive Höhe für den Stapel).
  const magnitude = (node: UkNode | undefined, key: string) => Math.abs(node?.values[key] ?? 0)

  const chartData = useMemo(() => {
    if (columns.length === 0) return []
    return columns.map((col, colIdx) => {
      const point: Record<string, string | number | undefined> = { name: col.label }
      for (const { id } of UK_CHART_AREAS) {
        const node = nodeById.get(id)
        const raw = magnitude(node, col.key)
        if (anzeigemodus === 'absolut') {
          point[id] = raw
        } else if (anzeigemodus === 'prozentual') {
          const basis = bruttoBasis?.[col.key] ?? 0
          point[id] = basis === 0 ? undefined : (raw / basis) * 100
        } else {
          const vorwert = colIdx > 0 ? magnitude(node, columns[colIdx - 1].key) : undefined
          const w = calcWachstum(raw, vorwert)
          point[id] = w === null || w === 'n/a' ? undefined : (w as number)
        }
      }
      return point
    })
  }, [columns, nodeById, anzeigemodus, bruttoBasis])

  const yAxisFormatter = (value: number) => {
    if (anzeigemodus === 'absolut') return formatAbsolutShort(value)
    if (anzeigemodus === 'prozentual') return formatProzent(value)
    return formatWachstumTick(value)
  }
  const formatTooltipValue = (value: number) => {
    if (anzeigemodus === 'absolut') return formatAbsolutFull(value)
    if (anzeigemodus === 'prozentual') return formatProzent(value)
    return formatWachstumTick(value)
  }
  const colorById = useMemo(() => new Map(UK_CHART_AREAS.map(l => [l.id, l.color])), [])

  const renderLegend = () => (
    <div className="flex flex-wrap justify-center gap-x-5 gap-y-1 pt-2">
      {UK_CHART_AREAS.map(l => (
        <div key={l.id} className="flex items-center gap-1.5 text-xs">
          <span className="inline-block h-2.5 w-2.5 rounded-sm flex-shrink-0" style={{ background: l.color }} />
          <span className="text-muted-foreground">{l.label}</span>
        </div>
      ))}
    </div>
  )

  if (loading) {
    return (
      <div className="rounded-lg border p-4 space-y-3">
        <Skeleton className="h-5 w-36" />
        <Skeleton className="h-[300px] w-full" />
      </div>
    )
  }
  if (columns.length === 0) return null

  const stacked = anzeigemodus !== 'wachstum'
  const titel = anzeigemodus === 'wachstum' ? 'Umsatzkosten — Wachstum' : 'Umsatzkosten — Zusammensetzung'

  return (
    <div className="rounded-lg border p-4 space-y-3">
      <span className="text-sm font-medium">{titel}</span>

      <ResponsiveContainer width="100%" height={300}>
        {stacked ? (
          <AreaChart data={chartData} margin={{ top: 4, right: 16, left: 4, bottom: 4 }}>
            <defs>
              {UK_CHART_AREAS.map(l => (
                <linearGradient key={l.id} id={`uk-grad-${l.id}`} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={l.color} stopOpacity={0.85} />
                  <stop offset="100%" stopColor={l.color} stopOpacity={0.55} />
                </linearGradient>
              ))}
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
            <XAxis dataKey="name" tick={{ fontSize: 11 }} tickLine={false} axisLine={{ stroke: 'hsl(var(--border))' }} />
            <YAxis tickFormatter={yAxisFormatter} tick={{ fontSize: 11 }} tickLine={false} axisLine={false} width={76} />
            <Tooltip
              content={({ active, payload, label }) => {
                if (!active || !payload?.length) return null
                const payloadMap = new Map((payload ?? []).map(e => [e.dataKey as string, e]))
                const entries = UK_CHART_AREAS.map(l => payloadMap.get(l.id)).filter((e): e is NonNullable<typeof e> => e != null && e.value != null)
                if (!entries.length) return null
                const gesamt = entries.reduce((s, e) => s + (e.value as number), 0)
                return (
                  <div className="rounded-lg border bg-background p-2.5 shadow-md text-xs space-y-1 min-w-[180px]">
                    <p className="font-semibold border-b pb-1 mb-1.5">{label}</p>
                    {entries.map(entry => (
                      <div key={entry.dataKey as string} className="flex items-center gap-2">
                        <span className="h-2 w-2 rounded-full flex-shrink-0" style={{ background: colorById.get(entry.dataKey as string) ?? entry.color }} />
                        <span className="text-muted-foreground truncate max-w-[120px]">{entry.name}:</span>
                        <span className="ml-auto font-medium tabular-nums">{formatTooltipValue(entry.value as number)}</span>
                      </div>
                    ))}
                    <div className="flex items-center gap-2 border-t pt-1 mt-1">
                      <span className="h-2 w-2 flex-shrink-0" />
                      <span className="font-medium">Umsatzkosten (Gesamt):</span>
                      <span className="ml-auto font-semibold tabular-nums">{formatTooltipValue(gesamt)}</span>
                    </div>
                  </div>
                )
              }}
            />
            <ReferenceLine y={0} stroke="hsl(var(--border))" strokeWidth={1.5} />
            <Legend content={renderLegend} />
            {UK_CHART_AREAS.map(l => (
              <Area
                key={l.id}
                type="linear"
                dataKey={l.id}
                name={l.label}
                stackId="kosten"
                stroke={l.color}
                strokeWidth={1.5}
                fill={`url(#uk-grad-${l.id})`}
                connectNulls={false}
              />
            ))}
          </AreaChart>
        ) : (
          <LineChart data={chartData} margin={{ top: 4, right: 16, left: 4, bottom: 4 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
            <XAxis dataKey="name" tick={{ fontSize: 11 }} tickLine={false} axisLine={{ stroke: 'hsl(var(--border))' }} />
            <YAxis tickFormatter={yAxisFormatter} tick={{ fontSize: 11 }} tickLine={false} axisLine={false} width={76} />
            <Tooltip
              content={({ active, payload, label }) => {
                if (!active || !payload?.length) return null
                const payloadMap = new Map((payload ?? []).map(e => [e.dataKey as string, e]))
                const entries = UK_CHART_AREAS.map(l => payloadMap.get(l.id)).filter((e): e is NonNullable<typeof e> => e != null && e.value != null)
                if (!entries.length) return null
                const gesamt = entries.reduce((s, e) => s + (e.value as number), 0)
                return (
                  <div className="rounded-lg border bg-background p-2.5 shadow-md text-xs space-y-1 min-w-[180px]">
                    <p className="font-semibold border-b pb-1 mb-1.5">{label}</p>
                    {entries.map(entry => (
                      <div key={entry.dataKey as string} className="flex items-center gap-2">
                        <span className="h-2 w-2 rounded-full flex-shrink-0" style={{ background: colorById.get(entry.dataKey as string) ?? entry.color }} />
                        <span className="text-muted-foreground truncate max-w-[120px]">{entry.name}:</span>
                        <span className="ml-auto font-medium tabular-nums">{formatTooltipValue(entry.value as number)}</span>
                      </div>
                    ))}
                    <div className="flex items-center gap-2 border-t pt-1 mt-1">
                      <span className="h-2 w-2 flex-shrink-0" />
                      <span className="font-medium">Umsatzkosten (Gesamt):</span>
                      <span className="ml-auto font-semibold tabular-nums">{formatTooltipValue(gesamt)}</span>
                    </div>
                  </div>
                )
              }}
            />
            <ReferenceLine y={0} stroke="hsl(var(--border))" strokeWidth={1.5} />
            <Legend content={renderLegend} />
            {UK_CHART_AREAS.map(l => (
              <Line
                key={l.id}
                type="linear"
                dataKey={l.id}
                name={l.label}
                stroke={l.color}
                strokeWidth={2}
                dot={false}
                activeDot={{ r: 4 }}
                connectNulls={false}
              />
            ))}
          </LineChart>
        )}
      </ResponsiveContainer>
    </div>
  )
}
