'use client'

import { useMemo } from 'react'
import {
  ResponsiveContainer, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ReferenceLine, Legend,
} from 'recharts'
import { Skeleton } from '@/components/ui/skeleton'
import {
  computeCascade,
  bruttoByColumn,
  UA_CHART_LINES,
  type UaModel,
  type UaNode,
  type UaAnzeigemodus,
} from '@/hooks/use-langfristige-umsatzauswertung'

// PROJ-96: Liniendiagramm der Umsatzauswertung — fest Brutto-Umsatz + Netto-Umsatz.
// Stil exakt wie das Diagramm der Rentabilitätsauswertung (PROJ-95), aber ohne
// Mehrfachauswahl (die beiden Linien sind vorgegeben).

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
  model: UaModel
  anzeigemodus: UaAnzeigemodus
}

export function LangfristigeUmsatzauswertungChart({ model, anzeigemodus }: Props) {
  const { columns, lines, loading } = model

  const nodes = useMemo(() => computeCascade(lines, columns), [lines, columns])
  const nodeById = useMemo(() => new Map(nodes.map(n => [n.id, n])), [nodes])

  const bruttoBasis = useMemo(
    () => (anzeigemodus === 'prozentual' ? bruttoByColumn(nodes, columns) : null),
    [anzeigemodus, nodes, columns],
  )

  const chartData = useMemo(() => {
    if (columns.length === 0) return []
    return columns.map((col, colIdx) => {
      const point: Record<string, string | number | undefined> = { name: col.label }
      for (const { id } of UA_CHART_LINES) {
        const node = nodeById.get(id) as UaNode | undefined
        if (!node) { point[id] = undefined; continue }
        const raw = node.values[col.key] ?? 0
        if (anzeigemodus === 'absolut') {
          point[id] = raw
        } else if (anzeigemodus === 'prozentual') {
          const basis = bruttoBasis?.[col.key] ?? 0
          point[id] = basis === 0 ? undefined : (raw / basis) * 100
        } else {
          const vorwert = colIdx > 0 ? (node.values[columns[colIdx - 1].key] ?? 0) : undefined
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
  const labelById = useMemo(() => new Map(UA_CHART_LINES.map(l => [l.id, l.label])), [])
  const colorById = useMemo(() => new Map(UA_CHART_LINES.map(l => [l.id, l.color])), [])

  if (loading) {
    return (
      <div className="rounded-lg border p-4 space-y-3">
        <Skeleton className="h-5 w-28" />
        <Skeleton className="h-[300px] w-full" />
      </div>
    )
  }
  if (columns.length === 0) return null

  return (
    <div className="rounded-lg border p-4 space-y-3">
      <span className="text-sm font-medium">Umsatz-Trend</span>

      <ResponsiveContainer width="100%" height={300}>
        <LineChart data={chartData} margin={{ top: 4, right: 16, left: 4, bottom: 4 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
          <XAxis dataKey="name" tick={{ fontSize: 11 }} tickLine={false} axisLine={{ stroke: 'hsl(var(--border))' }} />
          <YAxis tickFormatter={yAxisFormatter} tick={{ fontSize: 11 }} tickLine={false} axisLine={false} width={76} />
          <Tooltip
            content={({ active, payload, label }) => {
              if (!active || !payload?.length) return null
              const payloadMap = new Map((payload ?? []).map(e => [e.dataKey as string, e]))
              const entries = UA_CHART_LINES.map(l => payloadMap.get(l.id)).filter((e): e is NonNullable<typeof e> => e != null && e.value != null)
              if (!entries.length) return null
              return (
                <div className="rounded-lg border bg-background p-2.5 shadow-md text-xs space-y-1 min-w-[160px]">
                  <p className="font-semibold border-b pb-1 mb-1.5">{label}</p>
                  {entries.map(entry => (
                    <div key={entry.dataKey as string} className="flex items-center gap-2">
                      <span className="h-2 w-2 rounded-full flex-shrink-0" style={{ background: colorById.get(entry.dataKey as string) ?? entry.color }} />
                      <span className="text-muted-foreground truncate max-w-[110px]">{entry.name}:</span>
                      <span className="ml-auto font-medium tabular-nums">{formatTooltipValue(entry.value as number)}</span>
                    </div>
                  ))}
                </div>
              )
            }}
          />
          <ReferenceLine y={0} stroke="hsl(var(--border))" strokeWidth={1.5} />
          <Legend
            content={() => (
              <div className="flex flex-wrap justify-center gap-x-5 gap-y-1 pt-2">
                {UA_CHART_LINES.map(l => (
                  <div key={l.id} className="flex items-center gap-1.5 text-xs">
                    <span className="inline-block h-0.5 w-5 rounded-full flex-shrink-0" style={{ background: l.color }} />
                    <span className="text-muted-foreground">{l.label}</span>
                  </div>
                ))}
              </div>
            )}
          />
          {UA_CHART_LINES.map(l => (
            <Line
              key={l.id}
              type="linear"
              dataKey={l.id}
              name={labelById.get(l.id) ?? l.id}
              stroke={l.color}
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
