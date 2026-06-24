'use client'

import { useState } from 'react'
import {
  ResponsiveContainer, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ReferenceLine, Legend,
} from 'recharts'
import { LineChart as LineChartIcon } from 'lucide-react'
import { Skeleton } from '@/components/ui/skeleton'
import type { AuswertungColumn, AuswertungRow } from '@/hooks/use-liquiditaetsauswertung'

function formatShort(value: number): string {
  const abs = Math.abs(value)
  if (abs >= 1_000_000) return `${(value / 1_000_000).toLocaleString('de-DE', { maximumFractionDigits: 1 })}M €`
  if (abs >= 1_000) return `${(value / 1_000).toLocaleString('de-DE', { maximumFractionDigits: 1 })}k €`
  return `${value.toLocaleString('de-DE', { maximumFractionDigits: 0 })} €`
}
function formatFull(value: number): string {
  return new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR' }).format(value)
}

const LINES = [
  { key: 'einnahmen',   label: 'Einnahmen',           color: 'hsl(142, 76%, 36%)' },
  { key: 'ausgaben_abs', label: 'Ausgaben',           color: 'hsl(0, 84%, 50%)'   },
  { key: 'cashflow',    label: 'Cashflow der Periode', color: 'hsl(217, 91%, 50%)' },
  { key: 'kontostand',  label: 'Kontostand',          color: 'hsl(270, 70%, 55%)' },
] as const

type LineKey = typeof LINES[number]['key']

interface Props {
  columns: AuswertungColumn[]
  rows: AuswertungRow[]
  loading: boolean
}

export function LiquiditaetsauswertungChart({ columns, rows, loading }: Props) {
  const [visibleLines, setVisibleLines] = useState<Set<LineKey>>(() => new Set(LINES.map(l => l.key)))

  function toggleLine(key: LineKey) {
    setVisibleLines(prev => {
      const next = new Set(prev)
      if (next.has(key)) { if (next.size === 1) return prev; next.delete(key) }
      else next.add(key)
      return next
    })
  }

  if (loading) {
    return (
      <div className="rounded-lg border p-4 space-y-3">
        <Skeleton className="h-5 w-32" />
        <Skeleton className="h-[300px] w-full" />
      </div>
    )
  }

  if (columns.length === 0 || rows.length === 0) {
    return (
      <div className="rounded-lg border border-dashed p-4">
        <div className="flex flex-col items-center justify-center h-48 gap-2 text-muted-foreground text-sm">
          <LineChartIcon className="h-7 w-7" />
          Keine Daten für das Diagramm vorhanden.
        </div>
      </div>
    )
  }

  const einnahmenRow = rows.find(r => r.kind === 'gesamt-einnahmen')
  const ausgabenRow = rows.find(r => r.kind === 'gesamt-ausgaben')
  const cashflowRow = rows.find(r => r.kind === 'cashflow')
  const kontostandRow = rows.find(r => r.kind === 'kontostand')

  const chartData = columns.map(col => ({
    name: `${col.label} ${col.subLabel}`,
    einnahmen: einnahmenRow?.cells[col.key]?.value ?? 0,
    ausgaben_abs: Math.abs(ausgabenRow?.cells[col.key]?.value ?? 0),
    cashflow: cashflowRow?.cells[col.key]?.value ?? 0,
    kontostand: kontostandRow?.cells[col.key]?.value ?? 0,
  }))

  return (
    <div className="rounded-lg border p-4 space-y-3">
      <span className="text-sm font-medium">Cashflow-Verlauf</span>
      <ResponsiveContainer width="100%" height={300}>
        <LineChart data={chartData} margin={{ top: 4, right: 16, left: 4, bottom: 4 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
          <XAxis dataKey="name" tick={{ fontSize: 11 }} tickLine={false} axisLine={{ stroke: 'hsl(var(--border))' }} />
          <YAxis tickFormatter={formatShort} tick={{ fontSize: 11 }} tickLine={false} axisLine={false} width={76} />
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
                        <span className="h-2 w-2 rounded-full flex-shrink-0" style={{ background: line.color }} />
                        <span className="text-muted-foreground truncate max-w-[120px]">{line.label}:</span>
                        <span className="ml-auto font-medium tabular-nums">{formatFull(entry.value as number)}</span>
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
              <div className="flex flex-wrap justify-center gap-2 pt-3">
                {LINES.map(line => {
                  const active = visibleLines.has(line.key)
                  return (
                    <button key={line.key} type="button" onClick={() => toggleLine(line.key)}
                      className="flex items-center gap-2 rounded-full border px-3 py-1 text-xs font-medium transition-all cursor-pointer select-none"
                      style={active
                        ? { borderColor: line.color, backgroundColor: line.color + '18', color: line.color }
                        : { borderColor: 'hsl(var(--border))', backgroundColor: 'transparent', color: 'hsl(var(--muted-foreground))' }}>
                      <span className="inline-block h-[3px] w-4 rounded-full flex-shrink-0 transition-opacity"
                        style={{ backgroundColor: active ? line.color : 'hsl(var(--muted-foreground))', opacity: active ? 1 : 0.4 }} />
                      {line.label}
                    </button>
                  )
                })}
              </div>
            )}
          />
          {LINES.map(line =>
            visibleLines.has(line.key) ? (
              <Line key={line.key} type="linear" dataKey={line.key} name={line.label}
                stroke={line.color} strokeWidth={2} dot={false} activeDot={{ r: 4 }} connectNulls={false} />
            ) : (
              <Line key={line.key} type="linear" dataKey={line.key} name={line.label}
                stroke="transparent" strokeWidth={0} dot={false} activeDot={false} legendType="none" />
            )
          )}
        </LineChart>
      </ResponsiveContainer>
    </div>
  )
}
