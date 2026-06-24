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
import { useLangfristigerLagerbestandVerlauf, type VerlaufMonat } from '@/hooks/use-langfristiger-lagerbestand-verlauf'

const LINE_COLOR = 'hsl(221, 83%, 53%)'
const SUPP_COLOR = 'hsl(215, 18%, 42%)'

interface Produkt {
  id: string
  name: string
}

// ─── Tooltip ──────────────────────────────────────────────────────────────────

interface TooltipPayload {
  active?: boolean
  label?: string
  monate: VerlaufMonat[]
}

function ChartTooltip({ active, label, monate }: TooltipPayload) {
  if (!active) return null
  const point = monate.find((m) => m.label === label)
  if (!point) return null

  const row = (name: string, value: number | null) =>
    value == null ? null : (
      <div className="flex justify-between gap-4">
        <span>{name}:</span>
        <span className="tabular-nums text-foreground">
          {Math.round(value).toLocaleString('de-DE')}
        </span>
      </div>
    )

  return (
    <div className="rounded-lg border bg-background p-2.5 shadow-md text-xs space-y-1 min-w-[180px]">
      <p className="font-semibold border-b pb-1 mb-1.5">{label}</p>
      <div className="space-y-0.5 text-muted-foreground">
        {row('Bestand vorher', point.bestand_vorher)}
        {point.ankunft > 0 ? row('Einlagerung', point.ankunft) : null}
        {row('Absatz', point.absatz)}
        {row('Bestand nachher', point.bestand_nachher)}
        {point.bestellmenge > 0 ? row('Bestellmenge', point.bestellmenge) : null}
        {row('Kalk. Bestand', point.kalkulatorischer_bestand)}
        {row('Sicherh.-Bst.', point.sicherheitsbestand)}
        {row('Melde-Bst.', point.meldebestand)}
      </div>
    </div>
  )
}

// ─── Legend ───────────────────────────────────────────────────────────────────

function ChartLegend({ hasSB, hasMB }: { hasSB: boolean; hasMB: boolean }) {
  return (
    <div className="flex flex-wrap justify-center gap-x-5 gap-y-1 pt-2">
      <div className="flex items-center gap-1.5 text-xs">
        <span className="inline-block h-0.5 w-5 rounded-full" style={{ background: LINE_COLOR }} />
        <span className="text-foreground font-medium">Lagerbestand</span>
      </div>
      <div className="flex items-center gap-1.5 text-xs">
        <svg width="20" height="8" className="flex-shrink-0">
          <line x1="0" y1="4" x2="20" y2="4" stroke={LINE_COLOR} strokeWidth="2" strokeDasharray="5 3" strokeOpacity={0.7} />
        </svg>
        <span className="text-muted-foreground">Kalk. Bestand</span>
      </div>
      {hasSB && (
        <div className="flex items-center gap-1.5 text-xs">
          <svg width="20" height="8" className="flex-shrink-0">
            <line x1="0" y1="4" x2="20" y2="4" stroke={SUPP_COLOR} strokeWidth="1.5" strokeDasharray="3 5" />
          </svg>
          <span className="text-muted-foreground">Sicherheitsbestand</span>
        </div>
      )}
      {hasMB && (
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

export function LangfristigesLagerbestandsdiagramm({
  versionId,
  produkte,
  selectedProduktId,
  onSelectProdukt,
}: {
  versionId: string
  produkte: Produkt[]
  selectedProduktId: string | null
  onSelectProdukt: (id: string | null) => void
}) {
  const { data, isLoading, error } = useLangfristigerLagerbestandVerlauf(versionId, selectedProduktId)

  const monate = data?.monate ?? []
  const hasSB = useMemo(() => monate.some((m) => m.sicherheitsbestand != null), [monate])
  const hasMB = useMemo(() => monate.some((m) => m.meldebestand != null), [monate])
  const startLabel = data?.start_label ?? null

  function fmt(n: number | null): string {
    if (n == null) return '—'
    return Math.round(n).toLocaleString('de-DE')
  }

  return (
    <div className="space-y-4 mb-6">
      {/* ── Produkt-Auswahl (oben links) ── */}
      <div className="flex flex-wrap items-center gap-3">
        <Select value={selectedProduktId ?? ''} onValueChange={(v) => onSelectProdukt(v || null)}>
          <SelectTrigger className="w-56">
            <SelectValue placeholder="Produkt wählen…" />
          </SelectTrigger>
          <SelectContent>
            {produkte.map((p) => (
              <SelectItem key={p.id} value={p.id}>
                {p.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
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

          {selectedProduktId && !isLoading && !error && data && monate.length === 0 && (
            <div className="flex flex-col items-center justify-center h-64 gap-2 text-muted-foreground text-sm">
              <LineChartIcon className="h-8 w-8" />
              <span>{data.hinweis ?? 'Keine Verlaufsdaten für dieses Produkt vorhanden.'}</span>
            </div>
          )}

          {selectedProduktId && !isLoading && !error && data && monate.length > 0 && (
            <>
              {data.hinweis && (
                <p className="mb-2 text-xs text-amber-600">{data.hinweis}</p>
              )}
              <ResponsiveContainer width="100%" height={320}>
                <LineChart data={monate} margin={{ top: 4, right: 16, left: 4, bottom: 4 }}>
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
                    tickFormatter={(v) => v.toLocaleString('de-DE')}
                    width={60}
                    allowDecimals={false}
                  />
                  <Tooltip
                    content={({ active, label }) => (
                      <ChartTooltip active={active} label={label as string} monate={monate} />
                    )}
                  />
                  <Legend content={() => <ChartLegend hasSB={hasSB} hasMB={hasMB} />} />
                  {startLabel && (
                    <ReferenceLine
                      x={startLabel}
                      stroke="hsl(var(--primary))"
                      strokeWidth={1.5}
                      strokeDasharray="4 2"
                      label={{ value: 'Start', position: 'top', fontSize: 10, fill: 'hsl(var(--primary))' }}
                    />
                  )}
                  <Line
                    type="linear"
                    dataKey="bestand_nachher"
                    name="Lagerbestand"
                    stroke={LINE_COLOR}
                    strokeWidth={2}
                    dot={false}
                    activeDot={{ r: 4 }}
                    connectNulls={false}
                  />
                  <Line
                    type="linear"
                    dataKey="kalkulatorischer_bestand"
                    name="Kalk. Bestand"
                    stroke={LINE_COLOR}
                    strokeWidth={2}
                    strokeDasharray="5 3"
                    strokeOpacity={0.7}
                    dot={false}
                    activeDot={false}
                    connectNulls
                    legendType="none"
                  />
                  {hasSB && (
                    <Line
                      type="linear"
                      dataKey="sicherheitsbestand"
                      name="Sicherheitsbestand"
                      stroke={SUPP_COLOR}
                      strokeWidth={1.5}
                      strokeDasharray="3 5"
                      strokeOpacity={0.6}
                      dot={false}
                      activeDot={false}
                      connectNulls
                      legendType="none"
                    />
                  )}
                  {hasMB && (
                    <Line
                      type="linear"
                      dataKey="meldebestand"
                      name="Meldebestand"
                      stroke={SUPP_COLOR}
                      strokeWidth={1.5}
                      strokeDasharray="10 5"
                      strokeOpacity={0.7}
                      dot={false}
                      activeDot={false}
                      connectNulls
                      legendType="none"
                    />
                  )}
                </LineChart>
              </ResponsiveContainer>
            </>
          )}
        </CardContent>
      </Card>

      {/* ── Monatsdetails ── */}
      {selectedProduktId && !isLoading && !error && data && monate.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Monatsdetails</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <ScrollArea className="w-full" type="always">
              <div className="min-w-max">
                <Table>
                  <TableHeader>
                    <TableRow className="border-b">
                      <TableHead className="sticky left-0 z-10 bg-background border-r font-semibold min-w-[100px]">
                        Monat
                      </TableHead>
                      <TableHead className="text-right text-xs font-normal min-w-[90px]">Bestand vorher</TableHead>
                      <TableHead className="text-right text-xs font-normal min-w-[90px]">Einlagerung</TableHead>
                      <TableHead className="text-right text-xs font-normal min-w-[70px]">Absatz</TableHead>
                      <TableHead className="text-right text-xs font-normal min-w-[90px]">Bestand nachher</TableHead>
                      <TableHead className="text-right text-xs font-normal min-w-[90px]">Bestellmenge</TableHead>
                      <TableHead className="text-right text-xs font-normal min-w-[90px]">Kalk. Bestand</TableHead>
                      <TableHead className="text-right text-xs font-normal min-w-[90px]">Sicherh.-Bst.</TableHead>
                      <TableHead className="text-right text-xs font-normal min-w-[85px]">Melde-Bst.</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {monate.map((m) => (
                      <TableRow
                        key={m.label}
                        className={m.ist_start ? 'font-semibold border-y-2 border-primary/40' : ''}
                      >
                        <TableCell className="sticky left-0 z-10 bg-inherit border-r whitespace-nowrap text-xs font-mono">
                          {m.label}
                        </TableCell>
                        <TableCell className="text-right text-xs tabular-nums">{fmt(m.bestand_vorher)}</TableCell>
                        <TableCell className="text-right text-xs tabular-nums">
                          {m.ankunft > 0 ? m.ankunft.toLocaleString('de-DE') : '—'}
                        </TableCell>
                        <TableCell className="text-right text-xs tabular-nums">
                          {m.absatz.toLocaleString('de-DE', { maximumFractionDigits: 2 })}
                        </TableCell>
                        <TableCell className="text-right text-xs tabular-nums">{fmt(m.bestand_nachher)}</TableCell>
                        <TableCell className="text-right text-xs tabular-nums">
                          {m.bestellmenge > 0 ? m.bestellmenge.toLocaleString('de-DE') : '—'}
                        </TableCell>
                        <TableCell className="text-right text-xs tabular-nums text-muted-foreground">
                          {fmt(m.kalkulatorischer_bestand)}
                        </TableCell>
                        <TableCell className="text-right text-xs tabular-nums text-muted-foreground">
                          {fmt(m.sicherheitsbestand)}
                        </TableCell>
                        <TableCell className="text-right text-xs tabular-nums text-muted-foreground">
                          {fmt(m.meldebestand)}
                        </TableCell>
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
    </div>
  )
}
