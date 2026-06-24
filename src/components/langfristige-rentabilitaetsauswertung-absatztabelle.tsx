'use client'

import { useState } from 'react'
import { ChevronRight, ChevronDown } from 'lucide-react'
import { Skeleton } from '@/components/ui/skeleton'
import type { RaModel } from '@/hooks/use-langfristige-rentabilitaetsauswertung'

function formatMenge(value: number): string {
  return Math.round(value).toLocaleString('de-DE')
}

interface Props {
  model: RaModel
}

// PROJ-95: Absatztabelle (zwischen Diagramm und Haupttabelle) — analog PROJ-33.
// „Absatz gesamt" (aufklappbar → je Produkt), Monatsspalten, ganze Zahlen.
export function LangfristigeRentabilitaetsauswertungAbsatztabelle({ model }: Props) {
  const { columns, absatz, loading } = model
  const [expanded, setExpanded] = useState(false)

  if (loading) return <Skeleton className="h-24 w-full" />
  if (columns.length === 0) return null

  const produkte = absatz.produkte ?? []
  const expandable = produkte.length > 0

  return (
    <div className="overflow-x-auto rounded-md border">
      <table className="w-full text-sm border-collapse">
        <thead>
          <tr className="border-b bg-muted/40">
            <th className="sticky left-0 z-20 bg-muted/40 min-w-[260px] max-w-[340px] px-3 py-2 text-left font-medium text-muted-foreground">
              Absatz
            </th>
            {columns.map(c => (
              <th key={c.key} className="min-w-[130px] px-3 py-2 text-right font-medium text-muted-foreground whitespace-nowrap align-bottom">
                <div>{c.label}</div>
                {c.sublabel && <div className="text-[10px] font-normal text-muted-foreground/70">{c.sublabel}</div>}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          <tr className="border-b hover:bg-muted/20">
            <td className="sticky left-0 z-10 bg-background px-3 py-2">
              <div className="flex items-center gap-1">
                {expandable ? (
                  <button
                    onClick={() => setExpanded(v => !v)}
                    className="flex-shrink-0 text-muted-foreground hover:text-foreground transition-colors"
                    aria-label={expanded ? 'Einklappen' : 'Ausklappen'}
                  >
                    {expanded ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
                  </button>
                ) : (
                  <span className="h-3.5 w-3.5 flex-shrink-0" />
                )}
                <span className="font-medium">Absatz gesamt</span>
              </div>
            </td>
            {columns.map(c => (
              <td key={c.key} className="px-3 py-2 text-right tabular-nums whitespace-nowrap">
                {formatMenge(absatz.gesamt?.[c.key] ?? 0)}
              </td>
            ))}
          </tr>
          {expandable && expanded && produkte.map(p => (
            <tr key={p.id} className="border-b last:border-b-0 hover:bg-muted/20">
              <td className="sticky left-0 z-10 bg-background px-3 py-2">
                <div className="flex items-center gap-1" style={{ paddingLeft: '1.25rem' }}>
                  <span className="h-3.5 w-3.5 flex-shrink-0" />
                  <span className="text-muted-foreground text-xs">{p.label}</span>
                </div>
              </td>
              {columns.map(c => (
                <td key={c.key} className="px-3 py-2 text-right tabular-nums whitespace-nowrap text-xs">
                  {formatMenge(p.werte?.[c.key] ?? 0)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
