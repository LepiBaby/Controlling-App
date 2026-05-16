'use client'

import { useMemo } from 'react'
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
import { MultiSelect } from '@/components/multi-select'
import type {
  ReportingRentabilitaetData,
  ReportAnzeigemodus,
} from '@/hooks/use-reporting-rentabilitaet'
import { applyOhneInvestitionenFilter, calcWachstum } from '@/components/reporting-rentabilitaet-matrix'

// Regenbogenfarbe: Index 0 = Rot (oben im Regenbogen), letzter Index = Violett (unten)
// Helligkeit 45 % damit Gelb (60°) noch gut sichtbar ist
export function rainbowColor(index: number, total: number): string {
  const hue = total <= 1 ? 0 : Math.round((index / (total - 1)) * 270)
  return `hsl(${hue}, 80%, 45%)`
}

export function formatPeriode(periode: string): string {
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

export function formatAbsolutShort(value: number): string {
  const abs = Math.abs(value)
  if (abs >= 1_000_000) {
    return `${(value / 1_000_000).toLocaleString('de-DE', { maximumFractionDigits: 1 })}M €`
  }
  if (abs >= 1_000) {
    return `${(value / 1_000).toLocaleString('de-DE', { maximumFractionDigits: 1 })}k €`
  }
  return `${value.toLocaleString('de-DE', { maximumFractionDigits: 0 })} €`
}

function formatAbsolutFull(value: number): string {
  return new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR' }).format(value)
}

function formatProzent(value: number): string {
  return `${value.toLocaleString('de-DE', { minimumFractionDigits: 1, maximumFractionDigits: 1 })} %`
}

export function formatWachstumTick(value: number): string {
  if (value === 0) return '0,0 %'
  const str = Math.abs(value).toLocaleString('de-DE', { minimumFractionDigits: 1, maximumFractionDigits: 1 })
  return value > 0 ? `+${str} %` : `−${str} %`
}

interface Props {
  data: ReportingRentabilitaetData | null
  loading: boolean
  hasDateRange: boolean
  anzeigemodus: ReportAnzeigemodus
  displayPerioden: string[]
  ohneInvestitionen: boolean
  selectedPositionIds: string[]
  onSelectionChange: (ids: string[]) => void
  lockedSelection?: boolean
}

export function ReportingRentabilitaetChart({
  data,
  loading,
  hasDateRange,
  anzeigemodus,
  displayPerioden,
  ohneInvestitionen,
  selectedPositionIds,
  onSelectionChange,
  lockedSelection = false,
}: Props) {
  const effectiveData = useMemo(() => {
    if (!data) return null
    if (!ohneInvestitionen) return data
    return applyOhneInvestitionenFilter(data)
  }, [data, ohneInvestitionen])

  // Nur Summen-Positionen + Bruttoumsatz sind im Dropdown wählbar
  const eligibleIds = useMemo(() => {
    if (!effectiveData) return new Set<string>()
    return new Set(
      effectiveData.positionen
        .filter(pos => pos.type === 'summe' || pos.name.toLowerCase() === 'bruttoumsatz')
        .map(pos => pos.id),
    )
  }, [effectiveData])

  // Ausgewählte IDs in Kategoriereihenfolge (sort_order) sortiert, nur eligible
  // → steuert Reihenfolge der Lines → muss auch Legende + Tooltip folgen
  const sortedSelectedIds = useMemo(() => {
    if (!effectiveData) return []
    const order = new Map(effectiveData.positionen.map((p, i) => [p.id, i]))
    return [...selectedPositionIds]
      .filter(id => eligibleIds.has(id))
      .sort((a, b) => (order.get(a) ?? 9999) - (order.get(b) ?? 9999))
  }, [effectiveData, selectedPositionIds, eligibleIds])

  // Regenbogenfarbe je aktiver Position — verteilt sich immer gleichmäßig über Rot→Violett,
  // basierend auf Anzahl und Reihenfolge der aktuell ausgewählten Positionen.
  // Beim Hinzufügen/Entfernen werden alle Farben neu verteilt.
  const colorByPositionId = useMemo(() => {
    const map: Record<string, string> = {}
    const n = sortedSelectedIds.length
    sortedSelectedIds.forEach((posId, idx) => {
      map[posId] = rainbowColor(idx, n)
    })
    return map
  }, [sortedSelectedIds])

  // Dropdown-Optionen: nur eligible Positionen, in sort_order, mit Farbindikator für aktive
  const options = useMemo(() => {
    if (!effectiveData) return []
    return effectiveData.positionen
      .filter(pos => eligibleIds.has(pos.id))
      .map(pos => ({
        id: pos.id,
        name: pos.name,
        color: selectedPositionIds.includes(pos.id) ? colorByPositionId[pos.id] : undefined,
      }))
  }, [effectiveData, eligibleIds, selectedPositionIds, colorByPositionId])

  // Bruttoumsatz je Periode (für Prozentual-Modus)
  const bruttoumsatzByPeriode = useMemo(() => {
    if (!effectiveData || anzeigemodus !== 'prozentual') return null
    const result: Record<string, number> = {}
    for (const pos of effectiveData.positionen) {
      if (pos.type !== 'position') continue
      if (!pos.kategorien.every(k => k.kpi_type === 'umsatz')) continue
      for (const p of effectiveData.perioden) {
        result[p] = (result[p] ?? 0) + Math.max(0, pos.values[p] ?? 0)
      }
    }
    return result
  }, [effectiveData, anzeigemodus])

  // Chart-Datenpunkte aufbauen
  const chartData = useMemo(() => {
    if (!effectiveData || displayPerioden.length === 0) return []
    return displayPerioden.map(p => {
      const point: Record<string, string | number | undefined> = {
        name: formatPeriode(p),
      }
      for (const posId of sortedSelectedIds) {
        const pos = effectiveData.positionen.find(px => px.id === posId)
        if (!pos) { point[posId] = undefined; continue }
        const rawValue = pos.values[p] ?? 0

        if (anzeigemodus === 'absolut') {
          point[posId] = rawValue
        } else if (anzeigemodus === 'prozentual') {
          const basis = bruttoumsatzByPeriode?.[p] ?? 0
          point[posId] = basis === 0 ? undefined : (rawValue / basis) * 100
        } else {
          const allPerioden = effectiveData.perioden
          const pIdx = allPerioden.indexOf(p)
          const vorwert = pIdx > 0 ? (pos.values[allPerioden[pIdx - 1]] ?? 0) : undefined
          const w = calcWachstum(rawValue, vorwert)
          point[posId] = w === null || w === 'n/a' ? undefined : (w as number)
        }
      }
      return point
    })
  }, [effectiveData, displayPerioden, sortedSelectedIds, anzeigemodus, bruttoumsatzByPeriode])

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

  // --- Leerzustände ---

  if (!hasDateRange) {
    return (
      <div className="rounded-lg border border-dashed p-4">
        <div className="flex items-center justify-between mb-3">
          <span className="text-sm font-medium text-muted-foreground">KPI-Trend</span>
        </div>
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
        <div className="flex items-center justify-between">
          <Skeleton className="h-5 w-24" />
          <Skeleton className="h-8 w-48" />
        </div>
        <Skeleton className="h-[300px] w-full" />
      </div>
    )
  }

  if (!effectiveData || effectiveData.positionen.length === 0) {
    return null
  }

  return (
    <div className="rounded-lg border p-4 space-y-3">
      {/* Kopfzeile */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <span className="text-sm font-medium">KPI-Trend</span>
        {!lockedSelection && (
          <MultiSelect
            options={options}
            selected={selectedPositionIds.filter(id => eligibleIds.has(id))}
            onChange={onSelectionChange}
            placeholder="Positionen auswählen…"
            className="w-56"
          />
        )}
        {lockedSelection && sortedSelectedIds.length > 0 && (
          <span className="text-xs text-muted-foreground">
            {effectiveData?.positionen.find(p => p.id === sortedSelectedIds[0])?.name ?? ''}
          </span>
        )}
      </div>

      {/* Diagramm oder Leerzustand */}
      {sortedSelectedIds.length === 0 ? (
        <div className="flex flex-col items-center justify-center h-[300px] gap-2 text-muted-foreground text-sm">
          <LineChartIcon className="h-7 w-7" />
          Bitte Positionen im Dropdown auswählen.
        </div>
      ) : (
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
              tickFormatter={yAxisFormatter}
              tick={{ fontSize: 11 }}
              tickLine={false}
              axisLine={false}
              width={76}
            />

            {/* Tooltip: manuell nach sortedSelectedIds sortiert, unabhängig von payload-Reihenfolge */}
            <Tooltip
              content={({ active, payload, label }) => {
                if (!active || !payload?.length) return null
                const payloadMap = new Map(
                  (payload ?? []).map(e => [e.dataKey as string, e]),
                )
                const entries = sortedSelectedIds
                  .map(id => payloadMap.get(id))
                  .filter((e): e is NonNullable<typeof e> => e != null && e.value != null)
                if (!entries.length) return null
                return (
                  <div className="rounded-lg border bg-background p-2.5 shadow-md text-xs space-y-1 min-w-[160px]">
                    <p className="font-semibold border-b pb-1 mb-1.5">{label}</p>
                    {entries.map(entry => (
                      <div key={entry.dataKey as string} className="flex items-center gap-2">
                        <span
                          className="h-2 w-2 rounded-full flex-shrink-0"
                          style={{ background: colorByPositionId[entry.dataKey as string] ?? entry.color }}
                        />
                        <span className="text-muted-foreground truncate max-w-[110px]">
                          {entry.name}:
                        </span>
                        <span className="ml-auto font-medium tabular-nums">
                          {formatTooltipValue(entry.value as number)}
                        </span>
                      </div>
                    ))}
                  </div>
                )
              }}
            />

            <ReferenceLine y={0} stroke="hsl(var(--border))" strokeWidth={1.5} />

            {/* Legende: manuell nach sortedSelectedIds gerendert, unabhängig von Recharts-Sortierung */}
            <Legend
              content={() => (
                <div className="flex flex-wrap justify-center gap-x-5 gap-y-1 pt-2">
                  {sortedSelectedIds.map(posId => {
                    const pos = effectiveData.positionen.find(p => p.id === posId)
                    const color = colorByPositionId[posId]
                    return (
                      <div key={posId} className="flex items-center gap-1.5 text-xs">
                        <span
                          className="inline-block h-0.5 w-5 rounded-full flex-shrink-0"
                          style={{ background: color }}
                        />
                        <span className="text-muted-foreground">{pos?.name ?? posId}</span>
                      </div>
                    )
                  })}
                </div>
              )}
            />

            {sortedSelectedIds.map(posId => {
              const pos = effectiveData.positionen.find(p => p.id === posId)
              return (
                <Line
                  key={posId}
                  type="linear"
                  dataKey={posId}
                  name={pos?.name ?? posId}
                  stroke={colorByPositionId[posId] ?? '#888'}
                  strokeWidth={2}
                  dot={false}
                  activeDot={{ r: 4 }}
                  connectNulls={false}
                />
              )
            })}
          </LineChart>
        </ResponsiveContainer>
      )}
    </div>
  )
}
