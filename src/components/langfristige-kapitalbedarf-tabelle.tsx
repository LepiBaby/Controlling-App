'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import {
  ChevronRight, ChevronDown, ChevronUp, Plus, Trash2, RotateCcw, Dot,
} from 'lucide-react'
import { type KbfModel, type KbfRow, type Obergruppe } from '@/hooks/use-langfristige-kapitalbedarf-finanzierung'
import { BetragInput, BezeichnungInput, formatBetrag } from '@/components/langfristige-kbf-shared'

// PROJ-101 — Tabelle 1: Kapitalbedarf.
// Investitionen (Gesamtzeile read-only = Summe der Obergruppen; Obergruppen als
// Unterwerte einzeln überschreibbar), Betriebsmittelbedarf (überschreibbar),
// Liquiditätsreserve (manuell) + beliebige manuelle Zeilen; alle frei verschiebbar;
// unten die nicht editierbare Summe „Gesamtkapitalbedarf".

interface Props {
  model: KbfModel
}

export function LangfristigeKapitalbedarfTabelle({ model }: Props) {
  const {
    kapitalbedarfRows, investObergruppen, effektiv,
    gesamtkapitalbedarf, addRow, updateBetrag, rename, removeRow, resetOverride, moveRow, updateObergruppe,
  } = model

  const [investOffen, setInvestOffen] = useState(false)

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <h2 className="text-base font-semibold">Kapitalbedarf</h2>
        <Button variant="outline" size="sm" className="gap-1.5 text-xs" onClick={() => addRow('kapitalbedarf')}>
          <Plus className="h-3.5 w-3.5" /> Zeile hinzufügen
        </Button>
      </div>

      <div className="overflow-x-auto rounded-md border">
        <table className="w-full text-sm border-collapse">
          <thead>
            <tr className="border-b bg-muted/40">
              <th className="min-w-[280px] px-3 py-2.5 text-left font-medium text-muted-foreground">Bezeichnung</th>
              <th className="min-w-[160px] px-3 py-2.5 text-right font-medium text-muted-foreground">Betrag</th>
              <th className="w-[120px] px-3 py-2.5 text-right font-medium text-muted-foreground">Aktionen</th>
            </tr>
          </thead>
          <tbody>
            {kapitalbedarfRows.map((row, idx) => (
              <RowFragment
                key={row.id}
                row={row}
                idx={idx}
                count={kapitalbedarfRows.length}
                wert={effektiv(row)}
                investOffen={investOffen}
                onToggleInvest={() => setInvestOffen(o => !o)}
                onBetrag={(n) => updateBetrag(row.id, n)}
                onRename={(s) => rename(row.id, s)}
                onReset={() => resetOverride(row.id)}
                onRemove={() => removeRow(row.id)}
                onMove={(d) => moveRow(row.id, d)}
                obergruppen={row.zeilen_art === 'investitionen' && investOffen ? investObergruppen : []}
                onObergruppe={updateObergruppe}
              />
            ))}

            {/* Gesamtkapitalbedarf */}
            <tr className="bg-muted border-t-2 border-t-border">
              <td className="px-3 py-2.5 font-semibold">Gesamtkapitalbedarf</td>
              <td className="px-3 py-2.5 text-right font-bold tabular-nums">{formatBetrag(gesamtkapitalbedarf)}</td>
              <td className="px-3 py-2.5" />
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  )
}

// Kleiner Indikatorpunkt: blau = manuell überschrieben, grau = automatisch berechnet.
function Indikator({ overridden }: { overridden: boolean }) {
  return (
    <span
      title={overridden ? 'Manuell überschrieben' : 'Automatisch berechnet'}
      className={overridden ? 'text-blue-600' : 'text-muted-foreground/50'}
    >
      <Dot className="h-4 w-4" />
    </span>
  )
}

interface RowProps {
  row: KbfRow
  idx: number
  count: number
  wert: number
  investOffen: boolean
  onToggleInvest: () => void
  onBetrag: (n: number | null) => void
  onRename: (s: string) => void
  onReset: () => void
  onRemove: () => void
  onMove: (d: 'up' | 'down') => void
  obergruppen: Obergruppe[]
  onObergruppe: (quelleId: string, label: string, betrag: number | null) => void
}

function RowFragment(props: RowProps) {
  const {
    row, idx, count, wert, investOffen,
    onToggleInvest, onBetrag, onRename, onReset, onRemove, onMove, obergruppen, onObergruppe,
  } = props

  const istInvest = row.zeilen_art === 'investitionen'
  const istBetriebsmittel = row.zeilen_art === 'betriebsmittelbedarf'
  const istManuell = row.zeilen_art === 'manuell'
  const overridden = istBetriebsmittel && row.betrag !== null

  return (
    <>
      <tr className="border-b hover:bg-muted/20">
        <td className="px-3 py-1.5">
          <div className="flex items-center gap-1.5">
            {istInvest ? (
              <button
                onClick={onToggleInvest}
                className="flex-shrink-0 text-muted-foreground hover:text-foreground"
                aria-label={investOffen ? 'Einklappen' : 'Ausklappen'}
              >
                {investOffen ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
              </button>
            ) : (
              <span className="h-3.5 w-3.5 flex-shrink-0" />
            )}
            {istManuell ? (
              <BezeichnungInput key={`${row.id}:${row.bezeichnung}`} value={row.bezeichnung} onSave={onRename} className="font-medium" />
            ) : (
              // Gleiche Box wie das Eingabefeld (px-1 py-0.5), damit der Text exakt
              // gleich ausgerichtet ist und manuelle Zeilen nicht eingerückt wirken.
              <span className="font-medium px-1 py-0.5">{row.bezeichnung}</span>
            )}
          </div>
        </td>

        <td className="px-3 py-1.5">
          <div className="flex items-center justify-end">
            {istInvest ? (
              // Investitionen-Gesamtzeile ist NICHT editierbar (= Summe der Obergruppen),
              // wird aber optisch identisch zu den übrigen Werten dargestellt (kein Fettdruck,
              // gleiche Ausrichtung/Polsterung wie das Eingabefeld).
              <span className="w-full max-w-[150px] px-1 py-0.5 text-right tabular-nums">{formatBetrag(wert)}</span>
            ) : (
              // Alle übrigen Top-Level-Werte: effektiver Wert als echter Text, ohne Indikator,
              // ohne Placeholder-Unterschied — auto, überschrieben und manuell sehen gleich aus.
              <BetragInput value={wert} onSave={onBetrag} className="max-w-[150px]" />
            )}
          </div>
        </td>

        <td className="px-3 py-1.5">
          <div className="flex items-center justify-end gap-0.5">
            <Button variant="ghost" size="icon" className="h-6 w-6" disabled={idx === 0} onClick={() => onMove('up')} aria-label="Nach oben">
              <ChevronUp className="h-3.5 w-3.5" />
            </Button>
            <Button variant="ghost" size="icon" className="h-6 w-6" disabled={idx === count - 1} onClick={() => onMove('down')} aria-label="Nach unten">
              <ChevronDown className="h-3.5 w-3.5" />
            </Button>
            {overridden ? (
              <Button variant="ghost" size="icon" className="h-6 w-6 text-muted-foreground" onClick={onReset} aria-label="Auf Auto-Wert zurücksetzen" title="Auf berechneten Wert zurücksetzen">
                <RotateCcw className="h-3.5 w-3.5" />
              </Button>
            ) : istManuell ? (
              <Button variant="ghost" size="icon" className="h-6 w-6 text-destructive" onClick={onRemove} aria-label="Zeile löschen">
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            ) : (
              <span className="inline-block h-6 w-6" />
            )}
          </div>
        </td>
      </tr>

      {/* Drill-Down: Investitionen-Obergruppen (Unterwerte einzeln überschreibbar) */}
      {obergruppen.map(og => {
        const ogOverridden = og.override !== null
        return (
          <tr key={`${row.id}-og-${og.id}`} className="border-b bg-muted/10">
            <td className="px-3 py-1 pl-10 text-xs text-muted-foreground">{og.label}</td>
            <td className="px-3 py-1">
              <div className="flex items-center justify-end gap-1">
                <Indikator overridden={ogOverridden} />
                <BetragInput
                  value={og.override}
                  placeholder={formatBetrag(og.auto)}
                  onSave={(n) => onObergruppe(og.id, og.label, n)}
                  className="max-w-[150px] text-xs"
                />
              </div>
            </td>
            <td className="px-3 py-1">
              <div className="flex items-center justify-end">
                {ogOverridden ? (
                  <Button variant="ghost" size="icon" className="h-6 w-6 text-muted-foreground" onClick={() => onObergruppe(og.id, og.label, null)} aria-label="Auf Auto-Wert zurücksetzen" title="Auf berechneten Wert zurücksetzen">
                    <RotateCcw className="h-3.5 w-3.5" />
                  </Button>
                ) : (
                  <span className="inline-block h-6 w-6" />
                )}
              </div>
            </td>
          </tr>
        )
      })}
    </>
  )
}
