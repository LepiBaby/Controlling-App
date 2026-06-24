'use client'

import { useMemo } from 'react'
import {
  ResponsiveContainer, ComposedChart, Area, Line, XAxis, YAxis, CartesianGrid, Tooltip, ReferenceLine, Legend,
} from 'recharts'
import { Skeleton } from '@/components/ui/skeleton'
import {
  computeCascade,
  gruppenNodes,
  bruttoByColumn,
  type FaModel,
  type FaAnzeigemodus,
} from '@/hooks/use-langfristige-finanzierungsausgaben-auswertung'

// PROJ-100: Gestapeltes Diagramm der Finanzierungsausgaben-Auswertung. Je L1-Gruppe eine
// gestapelte Fläche; die übereinandergestapelten Gruppen ergeben zusammen die
// „Finanzierungsausgaben (Gesamt)". Im Wachstums-Modus ist Stapeln sinnlos → dann Linien.

const PALETTE = [
  'hsl(221, 83%, 53%)',
  'hsl(142, 71%, 38%)',
  'hsl(0, 72%, 51%)',
  'hsl(38, 92%, 50%)',
  'hsl(271, 76%, 53%)',
  'hsl(192, 82%, 41%)',
  'hsl(331, 73%, 51%)',
  'hsl(96, 59%, 40%)',
  'hsl(48, 89%, 45%)',
  'hsl(252, 60%, 57%)',
  'hsl(16, 80%, 50%)',
  'hsl(210, 18%, 45%)',
]

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
  model: FaModel
  anzeigemodus: FaAnzeigemodus
}

export function LangfristigeFinanzierungsausgabenAuswertungChart({ model, anzeigemodus }: Props) {
  const { columns, finanzierung, brutto, loading } = model

  const nodes = useMemo(() => computeCascade(finanzierung, columns), [finanzierung, columns])
  const gruppen = useMemo(() => gruppenNodes(nodes), [nodes])
  const series = useMemo(
    () => gruppen.map((g, i) => ({ id: g.id, label: g.label, color: PALETTE[i % PALETTE.length] })),
    [gruppen],
  )

  const bruttoBasis = useMemo(
    () => (anzeigemodus === 'prozentual' ? bruttoByColumn(brutto, columns) : null),
    [anzeigemodus, brutto, columns],
  )

  const chartData = useMemo(() => {
    if (columns.length === 0) return []
    return columns.map((col, colIdx) => {
      const point: Record<string, string | number | undefined> = { name: col.label }
      for (const g of gruppen) {
        // Im Diagramm werden Kosten als POSITIVE Magnitude dargestellt (die Tabelle behält
        // das negative/rote Vorzeichen). Werte sind intern signiert (Kosten negativ) → Betrag.
        const raw = Math.abs(g.values[col.key] ?? 0)
        if (anzeigemodus === 'absolut') {
          point[g.id] = raw
        } else if (anzeigemodus === 'prozentual') {
          const basis = bruttoBasis?.[col.key] ?? 0
          point[g.id] = basis === 0 ? undefined : (raw / basis) * 100
        } else {
          const vorwert = colIdx > 0 ? Math.abs(g.values[columns[colIdx - 1].key] ?? 0) : undefined
          const w = calcWachstum(raw, vorwert)
          point[g.id] = w === null || w === 'n/a' ? undefined : (w as number)
        }
      }
      return point
    })
  }, [columns, gruppen, anzeigemodus, bruttoBasis])

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
  const labelById = useMemo(() => new Map(series.map(s => [s.id, s.label])), [series])
  const colorById = useMemo(() => new Map(series.map(s => [s.id, s.color])), [series])

  const gestapelt = anzeigemodus !== 'wachstum'
  const titel = anzeigemodus === 'wachstum' ? 'Finanzierungsausgaben — Wachstum je Gruppe' : 'Finanzierungsausgaben — Zusammensetzung'

  if (loading) {
    return (
      <div className="rounded-lg border p-4 space-y-3">
        <Skeleton className="h-5 w-44" />
        <Skeleton className="h-[300px] w-full" />
      </div>
    )
  }
  if (columns.length === 0 || series.length === 0) return null

  return (
    <div className="rounded-lg border p-4 space-y-3">
      <span className="text-sm font-medium">{titel}</span>

      <ResponsiveContainer width="100%" height={300}>
        <ComposedChart data={chartData} margin={{ top: 4, right: 16, left: 4, bottom: 4 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
          <XAxis dataKey="name" tick={{ fontSize: 11 }} tickLine={false} axisLine={{ stroke: 'hsl(var(--border))' }} />
          <YAxis tickFormatter={yAxisFormatter} tick={{ fontSize: 11 }} tickLine={false} axisLine={false} width={76} />
          <Tooltip
            content={({ active, payload, label }) => {
              if (!active || !payload?.length) return null
              const entries = payload.filter(e => e != null && e.value != null)
              if (!entries.length) return null
              const sum = entries.reduce((a, e) => a + (e.value as number), 0)
              return (
                <div className="rounded-lg border bg-background p-2.5 shadow-md text-xs space-y-1 min-w-[180px]">
                  <p className="font-semibold border-b pb-1 mb-1.5">{label}</p>
                  {entries.map(entry => (
                    <div key={entry.dataKey as string} className="flex items-center gap-2">
                      <span className="h-2 w-2 rounded-full flex-shrink-0" style={{ background: colorById.get(entry.dataKey as string) ?? (entry.color as string) }} />
                      <span className="text-muted-foreground truncate max-w-[120px]">{labelById.get(entry.dataKey as string) ?? entry.name}:</span>
                      <span className="ml-auto font-medium tabular-nums">{formatTooltipValue(entry.value as number)}</span>
                    </div>
                  ))}
                  {gestapelt && entries.length > 1 && (
                    <div className="flex items-center gap-2 border-t pt-1 mt-1">
                      <span className="h-2 w-2 flex-shrink-0" />
                      <span className="text-muted-foreground">Gesamt:</span>
                      <span className="ml-auto font-semibold tabular-nums">{formatTooltipValue(sum)}</span>
                    </div>
                  )}
                </div>
              )
            }}
          />
          <ReferenceLine y={0} stroke="hsl(var(--border))" strokeWidth={1.5} />
          <Legend
            content={() => (
              <div className="flex flex-wrap justify-center gap-x-5 gap-y-1 pt-2">
                {series.map(s => (
                  <div key={s.id} className="flex items-center gap-1.5 text-xs">
                    <span className="inline-block h-2 w-3 rounded-sm flex-shrink-0" style={{ background: s.color }} />
                    <span className="text-muted-foreground">{s.label}</span>
                  </div>
                ))}
              </div>
            )}
          />
          {gestapelt
            ? series.map(s => (
                <Area
                  key={s.id}
                  type="linear"
                  dataKey={s.id}
                  name={s.label}
                  stackId="finanzierung"
                  stroke={s.color}
                  fill={s.color}
                  fillOpacity={0.55}
                  strokeWidth={1.5}
                  connectNulls={false}
                  isAnimationActive={false}
                />
              ))
            : series.map(s => (
                <Line
                  key={s.id}
                  type="linear"
                  dataKey={s.id}
                  name={s.label}
                  stroke={s.color}
                  strokeWidth={2}
                  dot={false}
                  activeDot={{ r: 4 }}
                  connectNulls={false}
                  isAnimationActive={false}
                />
              ))}
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  )
}
