'use client'

import { Fragment, useState } from 'react'
import { ChevronRight, ChevronDown } from 'lucide-react'
import { Skeleton } from '@/components/ui/skeleton'
import type { AbsatzData } from '@/hooks/use-reporting-absatz'

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

interface Props {
  data: AbsatzData | null
  loading: boolean
  hasDateRange: boolean
  displayPerioden: string[]
}

export function AbsatzTable({ data, loading, hasDateRange, displayPerioden }: Props) {
  const [gesamtExpanded, setGesamtExpanded] = useState(false)
  const [expandedProduktIds, setExpandedProduktIds] = useState<Set<string>>(new Set())

  if (!hasDateRange) return null

  const isExpandable = !!(data && data.produkte.length > 0)

  function toggleProdukt(id: string) {
    setExpandedProduktIds(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  return (
    <div className="space-y-2">
      <h3 className="text-sm font-medium text-muted-foreground">Absatz (Sendungen)</h3>

      {loading ? (
        <Skeleton className="h-12 w-full rounded-md" />
      ) : (
        <div className="overflow-x-auto rounded-md border">
          <table className="w-full text-sm border-collapse">
            <thead>
              <tr className="border-b bg-muted/40">
                <th className="sticky left-0 z-20 bg-muted/40 min-w-[260px] max-w-[340px] px-3 py-2.5 text-left font-medium text-muted-foreground">
                  Absatz
                </th>
                {displayPerioden.map(p => (
                  <th
                    key={p}
                    className="min-w-[130px] px-3 py-2.5 text-right font-medium text-muted-foreground whitespace-nowrap"
                  >
                    {formatPeriode(p)}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {/* Gesamtzeile */}
              <tr className="border-b last:border-b-0 hover:bg-muted/20">
                <td className="sticky left-0 z-10 bg-background px-3 py-2">
                  <div className="flex items-center gap-1">
                    {isExpandable ? (
                      <button
                        onClick={() => setGesamtExpanded(v => !v)}
                        className="flex-shrink-0 text-muted-foreground hover:text-foreground transition-colors"
                        aria-label={gesamtExpanded ? 'Einklappen' : 'Ausklappen'}
                      >
                        {gesamtExpanded
                          ? <ChevronDown className="h-3.5 w-3.5" />
                          : <ChevronRight className="h-3.5 w-3.5" />
                        }
                      </button>
                    ) : (
                      <span className="h-3.5 w-3.5 flex-shrink-0" />
                    )}
                    <span className="font-medium">Absatz gesamt</span>
                  </div>
                </td>
                {displayPerioden.map(p => (
                  <td key={p} className="px-3 py-2 text-right tabular-nums whitespace-nowrap font-medium">
                    {data ? (data.gesamt[p] ?? 0) : 0}
                  </td>
                ))}
              </tr>

              {/* Produkt-Zeilen */}
              {gesamtExpanded && data?.produkte.map(produkt => {
                const hasPlattformen = produkt.plattformen.length > 0
                const isProduktExpanded = expandedProduktIds.has(produkt.id)

                return (
                  <Fragment key={produkt.id}>
                    <tr className="border-b last:border-b-0 hover:bg-muted/20">
                      <td className="sticky left-0 z-10 bg-background px-3 py-2">
                        <div className="flex items-center gap-1" style={{ paddingLeft: '1.25rem' }}>
                          {hasPlattformen ? (
                            <button
                              onClick={() => toggleProdukt(produkt.id)}
                              className="flex-shrink-0 text-muted-foreground hover:text-foreground transition-colors"
                              aria-label={isProduktExpanded ? 'Einklappen' : 'Ausklappen'}
                            >
                              {isProduktExpanded
                                ? <ChevronDown className="h-3.5 w-3.5" />
                                : <ChevronRight className="h-3.5 w-3.5" />
                              }
                            </button>
                          ) : (
                            <span className="h-3.5 w-3.5 flex-shrink-0" />
                          )}
                          <span className="text-muted-foreground">{produkt.name}</span>
                        </div>
                      </td>
                      {displayPerioden.map(p => (
                        <td key={p} className="px-3 py-2 text-right text-muted-foreground tabular-nums whitespace-nowrap">
                          {produkt.values[p] ?? 0}
                        </td>
                      ))}
                    </tr>

                    {/* Plattform-Unterzeilen */}
                    {isProduktExpanded && produkt.plattformen.map(plt => (
                      <tr key={`${produkt.id}-${plt.id}`} className="border-b last:border-b-0 hover:bg-muted/20">
                        <td className="sticky left-0 z-10 bg-background px-3 py-2">
                          <div className="flex items-center gap-1" style={{ paddingLeft: '2.5rem' }}>
                            <span className="h-3.5 w-3.5 flex-shrink-0" />
                            <span className="text-muted-foreground/70 text-xs">{plt.name}</span>
                          </div>
                        </td>
                        {displayPerioden.map(p => (
                          <td key={p} className="px-3 py-2 text-right text-muted-foreground/70 tabular-nums whitespace-nowrap text-xs">
                            {plt.values[p] ?? 0}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </Fragment>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
