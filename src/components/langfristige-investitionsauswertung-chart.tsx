'use client'

import { useMemo } from 'react'
import {
  ResponsiveContainer, AreaChart, Area, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
} from 'recharts'
import { BarChart2 } from 'lucide-react'
import { Skeleton } from '@/components/ui/skeleton'
import type { IaModel, IaZeitansicht } from '@/hooks/use-langfristige-investitionsauswertung'

function rainbowColor(index: number, total: number): string {
  const hue = total <= 1 ? 210 : Math.round((index / (total - 1)) * 270)
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

function TooltipBody({
  label, items, total, colorById,
}: {
  label?: string
  items: { id: string; name: string; value: number }[]
  total: number
  colorById: Record<string, string>
}) {
  return (
    <div className="rounded-lg border bg-background p-2.5 shadow-md text-xs space-y-1 min-w-[180px]">
      <p className="font-semibold border-b pb-1 mb-1.5">{label}</p>
      {items.map(item => (
        <div key={item.id} className="flex items-center gap-2">
          <span className="h-2 w-2 rounded-full flex-shrink-0" style={{ background: colorById[item.id] }} />
          <span className="text-muted-foreground truncate max-w-[120px]">{item.name}:</span>
          <span className="ml-auto font-medium tabular-nums">{formatAbsolutFull(item.value)}</span>
        </div>
      ))}
      <div className="flex items-center gap-2 border-t pt-1 mt-1">
        <span className="font-semibold">Gesamt:</span>
        <span className="ml-auto font-semibold tabular-nums">{formatAbsolutFull(total)}</span>
      </div>
    </div>
  )
}

interface Props {
  model: IaModel
  zeitansicht: IaZeitansicht
}

export function LangfristigeInvestitionsauswertungChart({ model, zeitansicht }: Props) {
  const { columns, serien, loading } = model

  const colorById = useMemo(() => {
    const map: Record<string, string> = {}
    serien.forEach((s, idx) => { map[s.id] = rainbowColor(idx, serien.length) })
    return map
  }, [serien])

  const chartData = useMemo(() => {
    return columns.map(col => {
      const point: Record<string, string | number> = { name: col.sublabel ? `${col.label}` : col.label }
      for (const s of serien) point[s.id] = s.values[col.key] ?? 0
      return point
    })
  }, [columns, serien])

  // Hat überhaupt eine Serie einen Wert ≠ 0?
  const hasValues = useMemo(
    () => serien.some(s => columns.some(c => (s.values[c.key] ?? 0) !== 0)),
    [serien, columns],
  )

  if (loading) {
    return (
      <div className="rounded-lg border p-4 space-y-3">
        <Skeleton className="h-5 w-32" />
        <Skeleton className="h-[300px] w-full" />
      </div>
    )
  }
  if (columns.length === 0 || serien.length === 0) return null

  const legend = (
    <div className="flex flex-wrap justify-center gap-x-5 gap-y-1 pt-2">
      {serien.map(s => (
        <div key={s.id} className="flex items-center gap-1.5 text-xs">
          <span className="inline-block h-2.5 w-2.5 rounded-sm flex-shrink-0" style={{ background: colorById[s.id] }} />
          <span className="text-muted-foreground">{s.label}</span>
        </div>
      ))}
    </div>
  )

  return (
    <div className="rounded-lg border p-4 space-y-3">
      <span className="text-sm font-medium">Investitionen nach Obergruppe</span>

      {!hasValues ? (
        <div className="flex flex-col items-center justify-center h-[300px] gap-2 text-muted-foreground text-sm">
          <BarChart2 className="h-7 w-7" />
          Keine Investitionswerte im Planungszeitraum.
        </div>
      ) : (
        <>
          <ResponsiveContainer width="100%" height={300}>
            {zeitansicht === 'gesamt' ? (
              <BarChart data={chartData} margin={{ top: 4, right: 16, left: 4, bottom: 4 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="name" tick={{ fontSize: 11 }} tickLine={false} axisLine={{ stroke: 'hsl(var(--border))' }} />
                <YAxis tickFormatter={formatAbsolutShort} tick={{ fontSize: 11 }} tickLine={false} axisLine={false} width={76} />
                <Tooltip
                  content={({ active, payload, label }) => {
                    if (!active || !payload?.length) return null
                    const items = payload
                      .filter(e => e.value != null && (e.value as number) !== 0)
                      .map(e => ({ id: String(e.dataKey), name: String(e.name), value: e.value as number }))
                    const total = payload.reduce((a, e) => a + ((e.value as number) ?? 0), 0)
                    return <TooltipBody label={label as string} items={items} total={total} colorById={colorById} />
                  }}
                />
                {serien.map(s => (
                  <Bar key={s.id} dataKey={s.id} name={s.label} stackId="all" fill={colorById[s.id]} maxBarSize={120} />
                ))}
              </BarChart>
            ) : (
              <AreaChart data={chartData} margin={{ top: 4, right: 16, left: 4, bottom: 4 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="name" tick={{ fontSize: 11 }} tickLine={false} axisLine={{ stroke: 'hsl(var(--border))' }} />
                <YAxis tickFormatter={formatAbsolutShort} tick={{ fontSize: 11 }} tickLine={false} axisLine={false} width={76} />
                <Tooltip
                  content={({ active, payload, label }) => {
                    if (!active || !payload?.length) return null
                    const items = payload
                      .filter(e => e.value != null && (e.value as number) !== 0)
                      .map(e => ({ id: String(e.dataKey), name: String(e.name), value: e.value as number }))
                    const total = payload.reduce((a, e) => a + ((e.value as number) ?? 0), 0)
                    return <TooltipBody label={label as string} items={items} total={total} colorById={colorById} />
                  }}
                />
                {serien.map(s => (
                  <Area
                    key={s.id}
                    type="linear"
                    dataKey={s.id}
                    name={s.label}
                    stackId="all"
                    stroke={colorById[s.id]}
                    fill={colorById[s.id]}
                    fillOpacity={0.55}
                    strokeWidth={1.5}
                  />
                ))}
              </AreaChart>
            )}
          </ResponsiveContainer>
          {legend}
        </>
      )}
    </div>
  )
}
