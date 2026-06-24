'use client'

import { useMemo, useState, useRef, useEffect } from 'react'
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
import { cn } from '@/lib/utils'
import { Skeleton } from '@/components/ui/skeleton'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { ScrollArea, ScrollBar } from '@/components/ui/scroll-area'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  useLagerbestandVerlauf,
  skuColor,
  kwLabel,
  kwStartStr,
  type LagerbestandSku,
} from '@/hooks/use-lagerbestand-verlauf'

// Einheitliche Farbe für alle Hilfslinien (Kalk., SB, MB) in Legende und Chart
const SUPP_COLOR = 'hsl(215, 18%, 42%)'

// ─── Tooltip ──────────────────────────────────────────────────────────────────

interface TooltipProps {
  active?: boolean
  payload?: Array<{ dataKey: string; value: number | null; color: string }>
  label?: string
  activeSkus: LagerbestandSku[]
  totalSkus: number
  chartData: import('@/hooks/use-lagerbestand-verlauf').ChartPunkt[]
}

function ChartTooltip({ active, payload, label, activeSkus, totalSkus, chartData }: TooltipProps) {
  if (!active || !payload?.length) return null
  const map = new Map(payload.map(e => [e.dataKey, e.value]))
  const point = chartData.find(p => p.label === label)
  const startDate = point?.['start_date'] as string | undefined

  return (
    <div className="rounded-lg border bg-background p-2.5 shadow-md text-xs space-y-1 min-w-[180px]">
      <div className="border-b pb-1 mb-1.5">
        <p className="font-semibold">{label}</p>
        {startDate && <p className="text-muted-foreground">ab {startDate}</p>}
      </div>
      {activeSkus.map(sku => {
        const bestand = map.get(`bestand_${sku.sku_id}`)
        const sb = map.get(`sb_${sku.sku_id}`)
        const mb = map.get(`mb_${sku.sku_id}`)
        const absatz = point?.[`absatz_${sku.sku_id}`] as number | null | undefined
        const kalk = point?.[`kalk_${sku.sku_id}`] as number | null | undefined
        const ankunft = point?.[`ankunft_${sku.sku_id}`] as number | undefined
        const bestellungMenge = point?.[`bst_${sku.sku_id}`] as number | undefined
        const color = skuColor(sku.farbe_index, totalSkus, sku.sku_name)
        return (
          <div key={sku.sku_id} className="space-y-0.5">
            <div className="flex items-center gap-1.5 font-medium" style={{ color }}>
              <span className="inline-block h-0.5 w-4 rounded-full flex-shrink-0" style={{ background: color }} />
              {sku.sku_name}
            </div>
            <div className="pl-5.5 space-y-0.5 text-muted-foreground">
              {absatz != null && (
                <div className="flex justify-between gap-4">
                  <span>Absatz:</span>
                  <span className="tabular-nums">{absatz.toLocaleString('de-DE', { maximumFractionDigits: 2 })}</span>
                </div>
              )}
              {ankunft != null && ankunft > 0 && (
                <div className="flex justify-between gap-4">
                  <span>Einlagerung:</span>
                  <span className="tabular-nums text-foreground">{ankunft.toLocaleString('de-DE')}</span>
                </div>
              )}
              {bestand != null && (
                <div className="flex justify-between gap-4">
                  <span>Bestand:</span>
                  <span className="font-medium text-foreground tabular-nums">{bestand.toLocaleString('de-DE')}</span>
                </div>
              )}
              {bestellungMenge != null && bestellungMenge > 0 && (
                <div className="flex justify-between gap-4">
                  <span>Bestellmenge:</span>
                  <span className="tabular-nums text-foreground">{bestellungMenge.toLocaleString('de-DE')}</span>
                </div>
              )}
              {kalk != null && (
                <div className="flex justify-between gap-4">
                  <span>Kalk. Bst.:</span>
                  <span className="tabular-nums">{kalk.toLocaleString('de-DE')}</span>
                </div>
              )}
              {sb != null && (
                <div className="flex justify-between gap-4">
                  <span>Sicherh.-Bst.:</span>
                  <span className="tabular-nums">{sb.toLocaleString('de-DE')}</span>
                </div>
              )}
              {mb != null && (
                <div className="flex justify-between gap-4">
                  <span>Melde-Bst.:</span>
                  <span className="tabular-nums">{mb.toLocaleString('de-DE')}</span>
                </div>
              )}
            </div>
          </div>
        )
      })}
    </div>
  )
}

// ─── Legend ───────────────────────────────────────────────────────────────────

interface LegendProps {
  activeSkus: LagerbestandSku[]
  totalSkus: number
  hasSB: boolean
  hasMB: boolean
  hasKalk: boolean
}

function ChartLegend({ activeSkus, totalSkus, hasSB, hasMB, hasKalk }: LegendProps) {
  return (
    <div className="flex flex-wrap justify-center gap-x-5 gap-y-1 pt-2">
      {activeSkus.map(sku => (
        <div key={sku.sku_id} className="flex items-center gap-1.5 text-xs">
          <span
            className="inline-block h-0.5 w-5 rounded-full flex-shrink-0"
            style={{ background: skuColor(sku.farbe_index, totalSkus, sku.sku_name) }}
          />
          <span className="text-foreground font-medium">{sku.sku_name}</span>
        </div>
      ))}
      {hasKalk && activeSkus.length > 0 && (
        <div className="flex items-center gap-1.5 text-xs">
          <svg width="20" height="8" className="flex-shrink-0">
            <line x1="0" y1="4" x2="20" y2="4" stroke={SUPP_COLOR} strokeWidth="2" strokeDasharray="5 3" strokeLinecap="round" />
          </svg>
          <span className="text-muted-foreground">Kalk. Bestand</span>
        </div>
      )}
      {hasSB && activeSkus.length > 0 && (
        <div className="flex items-center gap-1.5 text-xs">
          <svg width="20" height="8" className="flex-shrink-0">
            <line x1="0" y1="4" x2="20" y2="4" stroke={SUPP_COLOR} strokeWidth="1.5" strokeDasharray="3 5" />
          </svg>
          <span className="text-muted-foreground">Sicherheitsbestand</span>
        </div>
      )}
      {hasMB && activeSkus.length > 0 && (
        <div className="flex items-center gap-1.5 text-xs">
          <svg width="20" height="8" className="flex-shrink-0">
            <line x1="0" y1="4" x2="20" y2="4" stroke={SUPP_COLOR} strokeWidth="1.5" strokeDasharray="10 5" />
          </svg>
          <span className="text-muted-foreground">Meldebestand</span>
        </div>
      )}
    </div>
  )
}

// ─── Main component ───────────────────────────────────────────────────────────

export function LagerbestandsDiagramm() {
  const {
    produkte,
    selectedProduktId,
    selectProdukt,
    aktiveSKUIds,
    toggleSku,
    data,
    isLoading,
    error,
    currentKWLabel,
    activeSkus,
    chartData,
  } = useLagerbestandVerlauf()

  const totalSkus = data?.skus.length ?? 1

  // Whether any SKU has SB / MB data
  const hasSB = useMemo(
    () => activeSkus.some(s => s.verlauf.some(p => p.sicherheitsbestand != null)),
    [activeSkus],
  )
  const hasMB = useMemo(
    () => activeSkus.some(s => s.verlauf.some(p => p.meldebestand != null)),
    [activeSkus],
  )
  const hasKalk = useMemo(
    () => activeSkus.some(s => s.verlauf.some(p => p.kalkulatorischer_bestand != null)),
    [activeSkus],
  )

  // Table rows: one per week
  const tableRows = useMemo(() => {
    if (!data) return []
    return data.wochen.map(w => {
      const label = kwLabel(w.kw, w.jahr)
      const skuData = activeSkus.map(sku => {
        const v = sku.verlauf.find(p => p.kw === w.kw && p.jahr === w.jahr)
        return {
          sku_id: sku.sku_id,
          absatz: v?.absatz ?? null,
          ankunft: v?.ankunft ?? 0,
          bestellung_menge: v?.bestellung_menge ?? 0,
          bestand_vorher: v?.bestand_vorher ?? 0,
          bestand_nachher: v?.bestand_nachher ?? 0,
          kalkulatorischer_bestand: v?.kalkulatorischer_bestand ?? null,
          sicherheitsbestand: v?.sicherheitsbestand ?? null,
          meldebestand: v?.meldebestand ?? null,
        }
      })
      const startDate = kwStartStr(w.kw, w.jahr)
      return { label, startDate, ist_prognose: w.ist_prognose, isCurrentKW: label === currentKWLabel, skuData }
    })
  }, [data, activeSkus, currentKWLabel])

  function fmt(n: number | null): string {
    if (n == null) return '—'
    return Math.round(n).toLocaleString('de-DE')
  }

  // ── Zellselektion ────────────────────────────────────────────────────────────
  const [selectedCells, setSelectedCells] = useState<Map<string, number>>(new Map())
  const isDragging = useRef(false)

  useEffect(() => {
    function onMouseDown(e: MouseEvent) {
      if (!(e.target as Element).closest('[data-betrag-selektion]')) {
        setSelectedCells(new Map())
      }
    }
    function onMouseUp() { isDragging.current = false }
    document.addEventListener('mousedown', onMouseDown)
    document.addEventListener('mouseup', onMouseUp)
    return () => {
      document.removeEventListener('mousedown', onMouseDown)
      document.removeEventListener('mouseup', onMouseUp)
    }
  }, [])

  function handleCellMouseDown(e: React.MouseEvent, key: string, value: number) {
    e.preventDefault()
    isDragging.current = true
    const multi = e.ctrlKey || e.metaKey
    setSelectedCells(prev => {
      if (prev.has(key)) {
        const next = new Map(prev)
        next.delete(key)
        return next
      }
      if (multi) return new Map([...prev, [key, value]])
      return new Map([[key, value]])
    })
  }

  function handleCellMouseEnter(key: string, value: number) {
    if (!isDragging.current) return
    setSelectedCells(prev => prev.has(key) ? prev : new Map([...prev, [key, value]]))
  }

  const selSumme = useMemo(
    () => Array.from(selectedCells.values()).reduce((a, b) => a + b, 0),
    [selectedCells],
  )

  return (
    <div className="space-y-4 mb-6" data-betrag-selektion="true">
      {/* ── Filter row ── */}
      <div className="flex flex-wrap items-center gap-3">
        <Select
          value={selectedProduktId ?? ''}
          onValueChange={v => selectProdukt(v || null)}
        >
          <SelectTrigger className="w-56">
            <SelectValue placeholder="Produkt wählen…" />
          </SelectTrigger>
          <SelectContent>
            {produkte.map(p => (
              <SelectItem key={p.id} value={p.id}>
                {p.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {/* SKU toggles — only shown once data is loaded */}
        {data && data.skus.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {data.skus.map(sku => {
              const active = aktiveSKUIds.has(sku.sku_id)
              const color = skuColor(sku.farbe_index, totalSkus, sku.sku_name)
              return (
                <Button
                  key={sku.sku_id}
                  variant={active ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => toggleSku(sku.sku_id)}
                  style={active ? { backgroundColor: color, borderColor: color } : { borderColor: color, color }}
                  className="h-7 text-xs gap-1.5"
                >
                  <span
                    className="inline-block h-2 w-2 rounded-full flex-shrink-0"
                    style={{ background: active ? 'white' : color }}
                  />
                  {sku.sku_name}
                </Button>
              )
            })}
          </div>
        )}
      </div>

      {/* ── Chart card ── */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium">Lagerbestandsverlauf</CardTitle>
        </CardHeader>
        <CardContent>
          {!selectedProduktId && (
            <div className="flex flex-col items-center justify-center h-64 gap-2 text-muted-foreground text-sm">
              <LineChartIcon className="h-8 w-8" />
              <span>Bitte wähle ein Produkt, um den Lagerbestandsverlauf anzuzeigen.</span>
            </div>
          )}

          {selectedProduktId && isLoading && (
            <div className="space-y-3">
              <Skeleton className="h-64 w-full" />
            </div>
          )}

          {selectedProduktId && error && (
            <div className="flex flex-col items-center justify-center h-64 gap-2 text-destructive text-sm">
              <span>Fehler beim Laden: {error}</span>
            </div>
          )}

          {selectedProduktId && !isLoading && !error && data && data.skus.length === 0 && (
            <div className="flex flex-col items-center justify-center h-64 gap-2 text-muted-foreground text-sm">
              <LineChartIcon className="h-8 w-8" />
              <span>Keine SKUs für dieses Produkt vorhanden.</span>
            </div>
          )}

          {selectedProduktId && !isLoading && !error && data && data.skus.length > 0 && (
            <ResponsiveContainer width="100%" height={320}>
              <LineChart data={chartData} margin={{ top: 4, right: 16, left: 4, bottom: 4 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis
                  dataKey="label"
                  tick={{ fontSize: 10 }}
                  tickLine={false}
                  axisLine={{ stroke: 'hsl(var(--border))' }}
                  interval="preserveStartEnd"
                />
                <YAxis
                  tick={{ fontSize: 11 }}
                  tickLine={false}
                  axisLine={false}
                  tickFormatter={v => v.toLocaleString('de-DE')}
                  width={60}
                  allowDecimals={false}
                />
                <Tooltip
                  content={({ active, payload, label }) => (
                    <ChartTooltip
                      active={active}
                      payload={payload as unknown as TooltipProps['payload']}
                      label={label as string}
                      activeSkus={activeSkus}
                      totalSkus={totalSkus}
                      chartData={chartData}
                    />
                  )}
                />
                <Legend
                  content={() => (
                    <ChartLegend
                      activeSkus={activeSkus}
                      totalSkus={totalSkus}
                      hasSB={hasSB}
                      hasMB={hasMB}
                      hasKalk={hasKalk}
                    />
                  )}
                />
                {/* "Heute" reference line */}
                <ReferenceLine
                  x={currentKWLabel}
                  stroke="hsl(var(--primary))"
                  strokeWidth={1.5}
                  strokeDasharray="4 2"
                  label={{ value: 'Heute', position: 'top', fontSize: 10, fill: 'hsl(var(--primary))' }}
                />

                {/* Lines per active SKU */}
                {activeSkus.map(sku => (
                  [
                    // Main bestand line
                    <Line
                      key={`bestand_${sku.sku_id}`}
                      type="linear"
                      dataKey={`bestand_${sku.sku_id}`}
                      name={sku.sku_name}
                      stroke={skuColor(sku.farbe_index, totalSkus, sku.sku_name)}
                      strokeWidth={2}
                      dot={false}
                      activeDot={{ r: 4 }}
                      connectNulls={false}
                    />,
                    // Kalkulatorischer Bestand: lange Striche, SKU-Farbe gedimmt
                    hasKalk && (
                      <Line
                        key={`kalk_${sku.sku_id}`}
                        type="linear"
                        dataKey={`kalk_${sku.sku_id}`}
                        name={`${sku.sku_name} – Kalk. Bestand`}
                        stroke={skuColor(sku.farbe_index, totalSkus, sku.sku_name)}
                        strokeWidth={2}
                        strokeDasharray="5 3"
                        strokeOpacity={0.7}
                        dot={false}
                        activeDot={false}
                        connectNulls={false}
                        legendType="none"
                      />
                    ),
                    // Sicherheitsbestand: kurze Striche, SKU-Farbe stärker gedimmt
                    hasSB && (
                      <Line
                        key={`sb_${sku.sku_id}`}
                        type="linear"
                        dataKey={`sb_${sku.sku_id}`}
                        name={`${sku.sku_name} – Sicherheitsbestand`}
                        stroke={skuColor(sku.farbe_index, totalSkus, sku.sku_name)}
                        strokeWidth={1.5}
                        strokeDasharray="3 5"
                        strokeOpacity={0.5}
                        dot={false}
                        activeDot={false}
                        connectNulls={false}
                        legendType="none"
                      />
                    ),
                    // Meldebestand: lange Striche, SKU-Farbe gedimmt
                    hasMB && (
                      <Line
                        key={`mb_${sku.sku_id}`}
                        type="linear"
                        dataKey={`mb_${sku.sku_id}`}
                        name={`${sku.sku_name} – Meldebestand`}
                        stroke={skuColor(sku.farbe_index, totalSkus, sku.sku_name)}
                        strokeWidth={1.5}
                        strokeDasharray="10 5"
                        strokeOpacity={0.65}
                        dot={false}
                        activeDot={false}
                        connectNulls={false}
                        legendType="none"
                      />
                    ),
                  ].filter(Boolean)
                ))}
              </LineChart>
            </ResponsiveContainer>
          )}
        </CardContent>
      </Card>

      {/* ── Detail table ── */}
      {selectedProduktId && !isLoading && !error && data && data.skus.length > 0 && activeSkus.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Wochendetails</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <ScrollArea className="w-full" type="always">
              <div className="min-w-max">
                <Table>
                  <TableHeader>
                    {/* Row 1: SKU group headers */}
                    <TableRow className="border-b">
                      <TableHead
                        rowSpan={2}
                        className="sticky left-0 z-20 bg-background border-r font-semibold min-w-[100px] align-middle"
                      >
                        KW
                      </TableHead>
                      {activeSkus.map(sku => (
                        <TableHead
                          key={sku.sku_id}
                          colSpan={8}
                          className="text-center border-r font-semibold"
                          style={{ color: skuColor(sku.farbe_index, totalSkus, sku.sku_name) }}
                        >
                          {sku.sku_name}
                        </TableHead>
                      ))}
                    </TableRow>
                    {/* Row 2: Column names */}
                    <TableRow className="border-b">
                      {activeSkus.map(sku => (
                        [
                          <TableHead key={`h-vorher-${sku.sku_id}`} className="text-right text-xs font-normal whitespace-nowrap min-w-[80px]">Bst. vorher</TableHead>,
                          <TableHead key={`h-absatz-${sku.sku_id}`} className="text-right text-xs font-normal whitespace-nowrap min-w-[70px]">Absatz</TableHead>,
                          <TableHead key={`h-ankunft-${sku.sku_id}`} className="text-right text-xs font-normal whitespace-nowrap min-w-[90px]">Einlagerung</TableHead>,
                          <TableHead key={`h-nachher-${sku.sku_id}`} className="text-right text-xs font-normal whitespace-nowrap min-w-[80px]">Bst. nachher</TableHead>,
                          <TableHead key={`h-bestellung-${sku.sku_id}`} className="text-right text-xs font-normal whitespace-nowrap min-w-[90px]">Bestellmenge</TableHead>,
                          <TableHead key={`h-kalk-${sku.sku_id}`} className="text-right text-xs font-normal whitespace-nowrap min-w-[80px]">Kalk. Bst.</TableHead>,
                          <TableHead key={`h-sb-${sku.sku_id}`} className="text-right text-xs font-normal whitespace-nowrap min-w-[90px]">Sicherh.-Bst.</TableHead>,
                          <TableHead key={`h-mb-${sku.sku_id}`} className="text-right text-xs font-normal whitespace-nowrap border-r min-w-[85px]">Melde-Bst.</TableHead>,
                        ]
                      ))}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {tableRows.map(row => (
                      <TableRow
                        key={row.label}
                        className={
                          row.isCurrentKW
                            ? 'font-semibold border-y-2 border-primary/40'
                            : row.ist_prognose
                              ? ''
                              : 'bg-muted/30'
                        }
                      >
                        <TableCell className="sticky left-0 z-10 bg-inherit border-r whitespace-nowrap">
                          <div className="text-xs font-mono">{row.label}</div>
                          <div className="text-xs text-muted-foreground">ab {row.startDate}</div>
                        </TableCell>
                        {row.skuData.map(sd => {
                          const sel = (col: string) => selectedCells.has(`${row.label}__${sd.sku_id}__${col}`)
                          const cellCls = (col: string, extra = '') =>
                            cn('text-right text-xs tabular-nums cursor-pointer select-none', extra,
                              sel(col) ? 'bg-blue-100 dark:bg-blue-900/40' : 'hover:bg-blue-50 dark:hover:bg-blue-950/20')
                          const md = (col: string, val: number) => (e: React.MouseEvent) =>
                            handleCellMouseDown(e, `${row.label}__${sd.sku_id}__${col}`, val)
                          const me = (col: string, val: number) => () =>
                            handleCellMouseEnter(`${row.label}__${sd.sku_id}__${col}`, val)
                          return [
                            <TableCell key={`vorher-${sd.sku_id}`} className={cellCls('vorher')} onMouseDown={md('vorher', sd.bestand_vorher)} onMouseEnter={me('vorher', sd.bestand_vorher)}>{fmt(sd.bestand_vorher)}</TableCell>,
                            <TableCell key={`absatz-${sd.sku_id}`} className={cellCls('absatz')} onMouseDown={md('absatz', sd.absatz ?? 0)} onMouseEnter={me('absatz', sd.absatz ?? 0)}>{sd.absatz == null ? '—' : sd.absatz.toLocaleString('de-DE', { maximumFractionDigits: 2 })}</TableCell>,
                            <TableCell key={`ankunft-${sd.sku_id}`} className={cellCls('ankunft')} onMouseDown={md('ankunft', sd.ankunft)} onMouseEnter={me('ankunft', sd.ankunft)}>{sd.ankunft > 0 ? sd.ankunft.toLocaleString('de-DE') : '—'}</TableCell>,
                            <TableCell key={`nachher-${sd.sku_id}`} className={cellCls('nachher')} onMouseDown={md('nachher', sd.bestand_nachher)} onMouseEnter={me('nachher', sd.bestand_nachher)}>{fmt(sd.bestand_nachher)}</TableCell>,
                            <TableCell key={`bestellung-${sd.sku_id}`} className={cellCls('bestellung')} onMouseDown={md('bestellung', sd.bestellung_menge)} onMouseEnter={me('bestellung', sd.bestellung_menge)}>{sd.bestellung_menge > 0 ? sd.bestellung_menge.toLocaleString('de-DE') : '—'}</TableCell>,
                            <TableCell key={`kalk-${sd.sku_id}`} className={cellCls('kalk', 'text-muted-foreground')} onMouseDown={md('kalk', sd.kalkulatorischer_bestand ?? 0)} onMouseEnter={me('kalk', sd.kalkulatorischer_bestand ?? 0)}>{fmt(sd.kalkulatorischer_bestand)}</TableCell>,
                            <TableCell key={`sb-${sd.sku_id}`} className={cellCls('sb')} onMouseDown={md('sb', sd.sicherheitsbestand ?? 0)} onMouseEnter={me('sb', sd.sicherheitsbestand ?? 0)}>{fmt(sd.sicherheitsbestand)}</TableCell>,
                            <TableCell key={`mb-${sd.sku_id}`} className={cellCls('mb', 'border-r')} onMouseDown={md('mb', sd.meldebestand ?? 0)} onMouseEnter={me('mb', sd.meldebestand ?? 0)}>{fmt(sd.meldebestand)}</TableCell>,
                          ]
                        })}
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
              <ScrollBar orientation="horizontal" />
            </ScrollArea>
          </CardContent>
        </Card>
      )}

      {/* ── Selektions-Badge ── */}
      {selectedCells.size > 0 && (
        <div
          data-betrag-selektion="true"
          className="fixed bottom-6 right-6 z-50 flex items-center gap-3 rounded-lg border bg-background px-4 py-2.5 shadow-lg text-sm"
        >
          <span className="text-muted-foreground">
            {selectedCells.size} Feld{selectedCells.size !== 1 ? 'er' : ''}
          </span>
          <div className="h-4 w-px bg-border" />
          <span className="font-semibold tabular-nums">
            Summe: {selSumme.toLocaleString('de-DE', { maximumFractionDigits: 2 })}
          </span>
          <button
            className="ml-1 text-muted-foreground hover:text-foreground"
            onClick={() => setSelectedCells(new Map())}
            aria-label="Auswahl aufheben"
          >
            ✕
          </button>
        </div>
      )}
    </div>
  )
}
