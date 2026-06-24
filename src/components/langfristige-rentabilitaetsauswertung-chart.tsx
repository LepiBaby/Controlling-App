'use client'

import { useMemo } from 'react'
import {
  ResponsiveContainer, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ReferenceLine, Legend,
} from 'recharts'
import { LineChart as LineChartIcon } from 'lucide-react'
import { Skeleton } from '@/components/ui/skeleton'
import { MultiSelect } from '@/components/multi-select'
import {
  computeCascade,
  bruttoByMonth,
  type RaModel,
  type RaNode,
  type RaAnzeigemodus,
} from '@/hooks/use-langfristige-rentabilitaetsauswertung'

function rainbowColor(index: number, total: number): string {
  const hue = total <= 1 ? 0 : Math.round((index / (total - 1)) * 270)
  return `hsl(${hue}, 80%, 45%)`
}

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
  model: RaModel
  anzeigemodus: RaAnzeigemodus
  selectedIds: string[]
  onSelectionChange: (ids: string[]) => void
}

export function LangfristigeRentabilitaetsauswertungChart({
  model, anzeigemodus, selectedIds, onSelectionChange,
}: Props) {
  const { columns, lines, loading } = model

  const nodes = useMemo(() => computeCascade(lines, columns), [lines, columns])

  // Wählbar: Zwischensummen + Brutto-Umsatz (analog Rentabilitätsreport).
  const eligible = useMemo(() => {
    const out: { id: string; label: string; node: RaNode }[] = []
    for (const n of nodes) {
      if (n.kind === 'subtotal' || n.isBrutto) out.push({ id: n.id, label: n.label, node: n })
    }
    return out
  }, [nodes])
  const eligibleIds = useMemo(() => new Set(eligible.map(e => e.id)), [eligible])
  const nodeById = useMemo(() => new Map(eligible.map(e => [e.id, e.node])), [eligible])
  const labelById = useMemo(() => new Map(eligible.map(e => [e.id, e.label])), [eligible])

  const order = useMemo(() => new Map(eligible.map((e, i) => [e.id, i])), [eligible])
  const sortedSelectedIds = useMemo(
    () => [...selectedIds].filter(id => eligibleIds.has(id)).sort((a, b) => (order.get(a) ?? 9999) - (order.get(b) ?? 9999)),
    [selectedIds, eligibleIds, order],
  )

  const colorById = useMemo(() => {
    const map: Record<string, string> = {}
    sortedSelectedIds.forEach((id, idx) => { map[id] = rainbowColor(idx, sortedSelectedIds.length) })
    return map
  }, [sortedSelectedIds])

  const options = useMemo(
    () => eligible.map(e => ({ id: e.id, name: e.label, color: selectedIds.includes(e.id) ? colorById[e.id] : undefined })),
    [eligible, selectedIds, colorById],
  )

  const bruttoBasis = useMemo(
    () => (anzeigemodus === 'prozentual' ? bruttoByMonth(nodes, columns) : null),
    [anzeigemodus, nodes, columns],
  )

  const chartData = useMemo(() => {
    if (columns.length === 0) return []
    return columns.map((col, colIdx) => {
      const point: Record<string, string | number | undefined> = { name: col.label }
      for (const id of sortedSelectedIds) {
        const node = nodeById.get(id)
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
  }, [columns, sortedSelectedIds, nodeById, anzeigemodus, bruttoBasis])

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

  if (loading) {
    return (
      <div className="rounded-lg border p-4 space-y-3">
        <div className="flex items-center justify-between">
          <Skeleton className="h-5 w-24" />
          <Skeleton className="h-8 w-48" />
        </div>
        <Skeleton className="h-[300px] w-full" />
      </div>
    )
  }
  if (columns.length === 0) return null

  return (
    <div className="rounded-lg border p-4 space-y-3">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <span className="text-sm font-medium">Rentabilitäts-Trend</span>
        <MultiSelect
          options={options}
          selected={selectedIds.filter(id => eligibleIds.has(id))}
          onChange={onSelectionChange}
          placeholder="Kennzahlen auswählen…"
          className="w-56"
        />
      </div>

      {sortedSelectedIds.length === 0 ? (
        <div className="flex flex-col items-center justify-center h-[300px] gap-2 text-muted-foreground text-sm">
          <LineChartIcon className="h-7 w-7" />
          Bitte Kennzahlen im Dropdown auswählen.
        </div>
      ) : (
        <ResponsiveContainer width="100%" height={300}>
          <LineChart data={chartData} margin={{ top: 4, right: 16, left: 4, bottom: 4 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
            <XAxis dataKey="name" tick={{ fontSize: 11 }} tickLine={false} axisLine={{ stroke: 'hsl(var(--border))' }} />
            <YAxis tickFormatter={yAxisFormatter} tick={{ fontSize: 11 }} tickLine={false} axisLine={false} width={76} />
            <Tooltip
              content={({ active, payload, label }) => {
                if (!active || !payload?.length) return null
                const payloadMap = new Map((payload ?? []).map(e => [e.dataKey as string, e]))
                const entries = sortedSelectedIds.map(id => payloadMap.get(id)).filter((e): e is NonNullable<typeof e> => e != null && e.value != null)
                if (!entries.length) return null
                return (
                  <div className="rounded-lg border bg-background p-2.5 shadow-md text-xs space-y-1 min-w-[160px]">
                    <p className="font-semibold border-b pb-1 mb-1.5">{label}</p>
                    {entries.map(entry => (
                      <div key={entry.dataKey as string} className="flex items-center gap-2">
                        <span className="h-2 w-2 rounded-full flex-shrink-0" style={{ background: colorById[entry.dataKey as string] ?? entry.color }} />
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
                  {sortedSelectedIds.map(id => (
                    <div key={id} className="flex items-center gap-1.5 text-xs">
                      <span className="inline-block h-0.5 w-5 rounded-full flex-shrink-0" style={{ background: colorById[id] }} />
                      <span className="text-muted-foreground">{labelById.get(id) ?? id}</span>
                    </div>
                  ))}
                </div>
              )}
            />
            {sortedSelectedIds.map(id => (
              <Line
                key={id}
                type="linear"
                dataKey={id}
                name={labelById.get(id) ?? id}
                stroke={colorById[id] ?? '#888'}
                strokeWidth={2}
                dot={false}
                activeDot={{ r: 4 }}
                connectNulls={false}
              />
            ))}
          </LineChart>
        </ResponsiveContainer>
      )}
    </div>
  )
}
