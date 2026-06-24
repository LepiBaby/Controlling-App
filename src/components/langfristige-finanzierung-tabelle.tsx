'use client'

import { Button } from '@/components/ui/button'
import { ChevronUp, ChevronDown, Plus, Trash2, CheckCircle2, AlertTriangle } from 'lucide-react'
import { type KbfModel, type KbfRow } from '@/hooks/use-langfristige-kapitalbedarf-finanzierung'
import { BetragInput, BezeichnungInput, ZahlInput, formatBetrag } from '@/components/langfristige-kbf-shared'

// PROJ-101 — Tabelle 2: Finanzierung.
// EINE zusammenhängende Tabelle mit zwei Abschnitten (Eigenkapital, Fremdkapital).
// Beide „Position hinzufügen"-Buttons stehen oben in der Kopfzeile. FK-Zeilen führen
// zusätzlich Zinssatz/Laufzeit/Tilgungsfrei (rein informativ). Abschluss: „Summe
// Eigen- & Fremdkapital" + Abgleich gegen den Gesamtkapitalbedarf (Warnung, nicht blockierend).

interface Props {
  model: KbfModel
}

// Anzahl Spalten der Tabelle (für colSpan der Abschnitts-/Summenzeilen).
const COLS = 6

export function LangfristigeFinanzierungTabelle({ model }: Props) {
  const {
    eigenkapitalRows, fremdkapitalRows,
    summeEigenkapital, summeFremdkapital, summeEkFk, gesamtkapitalbedarf, differenz,
    addRow, updateBetrag, rename, updateFkDetail, removeRow, moveRow,
  } = model

  const stimmt = Math.abs(differenz) < 0.005

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-base font-semibold">Finanzierung</h2>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" size="sm" className="gap-1.5 text-xs" onClick={() => addRow('eigenkapital')}>
            <Plus className="h-3.5 w-3.5" /> Eigenkapital-Position hinzufügen
          </Button>
          <Button variant="outline" size="sm" className="gap-1.5 text-xs" onClick={() => addRow('fremdkapital')}>
            <Plus className="h-3.5 w-3.5" /> Fremdkapital-Position hinzufügen
          </Button>
        </div>
      </div>

      <div className="overflow-x-auto rounded-md border">
        <table className="w-full text-sm border-collapse">
          <thead>
            <tr className="border-b bg-muted/40">
              <th className="min-w-[240px] px-3 py-2.5 text-left font-medium text-muted-foreground">Bezeichnung</th>
              <th className="min-w-[150px] px-3 py-2.5 text-right font-medium text-muted-foreground">Betrag</th>
              <th className="min-w-[100px] px-3 py-2.5 text-right font-medium text-muted-foreground">Zinssatz</th>
              <th className="min-w-[110px] px-3 py-2.5 text-right font-medium text-muted-foreground">Laufzeit</th>
              <th className="min-w-[120px] px-3 py-2.5 text-right font-medium text-muted-foreground">Tilgungsfrei</th>
              <th className="w-[100px] px-3 py-2.5 text-right font-medium text-muted-foreground">Aktionen</th>
            </tr>
          </thead>
          <tbody>
            {/* EIGENKAPITAL */}
            {eigenkapitalRows.length === 0 && (
              <tr className="border-b"><td colSpan={COLS} className="px-3 py-2 text-center text-xs text-muted-foreground">Noch keine Eigenkapital-Positionen.</td></tr>
            )}
            {eigenkapitalRows.map((row, idx) => (
              <EkZeile
                key={row.id}
                row={row}
                idx={idx}
                count={eigenkapitalRows.length}
                onBetrag={(n) => updateBetrag(row.id, n)}
                onRename={(s) => rename(row.id, s)}
                onRemove={() => removeRow(row.id)}
                onMove={(d) => moveRow(row.id, d)}
              />
            ))}
            <tr className="border-b bg-muted/50">
              <td className="px-3 py-2 font-semibold">Summe Eigenkapital</td>
              <td className="px-3 py-2 text-right font-semibold tabular-nums">{formatBetrag(summeEigenkapital)}</td>
              <td colSpan={COLS - 2} className="px-3 py-2" />
            </tr>

            {/* FREMDKAPITAL */}
            {fremdkapitalRows.length === 0 && (
              <tr className="border-b"><td colSpan={COLS} className="px-3 py-2 text-center text-xs text-muted-foreground">Noch keine Fremdkapital-Positionen.</td></tr>
            )}
            {fremdkapitalRows.map((row, idx) => (
              <FkZeile
                key={row.id}
                row={row}
                idx={idx}
                count={fremdkapitalRows.length}
                onBetrag={(n) => updateBetrag(row.id, n)}
                onRename={(s) => rename(row.id, s)}
                onFk={(field, n) => updateFkDetail(row.id, field, n)}
                onRemove={() => removeRow(row.id)}
                onMove={(d) => moveRow(row.id, d)}
              />
            ))}
            <tr className="border-b bg-muted/50">
              <td className="px-3 py-2 font-semibold">Summe Fremdkapital</td>
              <td className="px-3 py-2 text-right font-semibold tabular-nums">{formatBetrag(summeFremdkapital)}</td>
              <td colSpan={COLS - 2} className="px-3 py-2" />
            </tr>

            {/* Summe Eigen- & Fremdkapital */}
            <tr className="bg-muted border-t-2 border-t-border">
              <td className="px-3 py-2.5 font-semibold">Summe Eigen- &amp; Fremdkapital</td>
              <td className="px-3 py-2.5 text-right font-bold tabular-nums">{formatBetrag(summeEkFk)}</td>
              <td colSpan={COLS - 2} className="px-3 py-2.5" />
            </tr>
          </tbody>
        </table>
      </div>

      {/* Abgleich gegen den Gesamtkapitalbedarf (nicht blockierend) */}
      <div
        className={[
          'flex items-center gap-2 rounded-md border px-4 py-2.5 text-sm',
          stimmt
            ? 'border-emerald-300 bg-emerald-50 text-emerald-700 dark:border-emerald-900 dark:bg-emerald-950/30 dark:text-emerald-400'
            : 'border-destructive bg-destructive/10 text-destructive',
        ].join(' ')}
      >
        {stimmt ? <CheckCircle2 className="h-4 w-4 flex-shrink-0" /> : <AlertTriangle className="h-4 w-4 flex-shrink-0" />}
        {stimmt ? (
          <span>Finanzierung stimmt mit dem Gesamtkapitalbedarf überein ({formatBetrag(gesamtkapitalbedarf)}).</span>
        ) : (
          <span>
            Finanzierung weicht vom Gesamtkapitalbedarf ab: Summe Eigen- &amp; Fremdkapital {formatBetrag(summeEkFk)} vs.
            Gesamtkapitalbedarf {formatBetrag(gesamtkapitalbedarf)} — Differenz {formatBetrag(differenz)}.
          </span>
        )}
      </div>
    </div>
  )
}

interface ZeileProps {
  row: KbfRow
  idx: number
  count: number
  onBetrag: (n: number | null) => void
  onRename: (s: string) => void
  onRemove: () => void
  onMove: (d: 'up' | 'down') => void
}

function MoveDeleteCell({ idx, count, onMove, onRemove }: { idx: number; count: number; onMove: (d: 'up' | 'down') => void; onRemove: () => void }) {
  return (
    <td className="px-3 py-1.5">
      <div className="flex items-center justify-end gap-0.5">
        <Button variant="ghost" size="icon" className="h-6 w-6" disabled={idx === 0} onClick={() => onMove('up')} aria-label="Nach oben">
          <ChevronUp className="h-3.5 w-3.5" />
        </Button>
        <Button variant="ghost" size="icon" className="h-6 w-6" disabled={idx === count - 1} onClick={() => onMove('down')} aria-label="Nach unten">
          <ChevronDown className="h-3.5 w-3.5" />
        </Button>
        <Button variant="ghost" size="icon" className="h-6 w-6 text-destructive" onClick={onRemove} aria-label="Position löschen">
          <Trash2 className="h-3.5 w-3.5" />
        </Button>
      </div>
    </td>
  )
}

function EkZeile({ row, idx, count, onBetrag, onRename, onRemove, onMove }: ZeileProps) {
  return (
    <tr className="border-b hover:bg-muted/20">
      <td className="px-3 py-1.5">
        <BezeichnungInput key={`${row.id}:${row.bezeichnung}`} value={row.bezeichnung} onSave={onRename} />
      </td>
      <td className="px-3 py-1.5">
        <BetragInput value={row.betrag} onSave={onBetrag} placeholder="0,00 €" className="max-w-[150px]" />
      </td>
      {/* Zinssatz/Laufzeit/Tilgungsfrei gelten nur für Fremdkapital → leer */}
      <td className="px-3 py-1.5 text-right text-muted-foreground/40">–</td>
      <td className="px-3 py-1.5 text-right text-muted-foreground/40">–</td>
      <td className="px-3 py-1.5 text-right text-muted-foreground/40">–</td>
      <MoveDeleteCell idx={idx} count={count} onMove={onMove} onRemove={onRemove} />
    </tr>
  )
}

function FkZeile({
  row, idx, count, onBetrag, onRename, onFk, onRemove, onMove,
}: ZeileProps & { onFk: (field: 'zinssatz' | 'laufzeit_jahre' | 'tilgungsfrei_jahre', n: number | null) => void }) {
  return (
    <tr className="border-b hover:bg-muted/20">
      <td className="px-3 py-1.5">
        <BezeichnungInput key={`${row.id}:${row.bezeichnung}`} value={row.bezeichnung} onSave={onRename} />
      </td>
      <td className="px-3 py-1.5">
        <BetragInput value={row.betrag} onSave={onBetrag} placeholder="0,00 €" className="max-w-[150px]" />
      </td>
      <td className="px-3 py-1.5">
        <ZahlInput value={row.zinssatz} onSave={(n) => onFk('zinssatz', n)} suffix="%" placeholder="–" className="max-w-[90px]" />
      </td>
      <td className="px-3 py-1.5">
        <ZahlInput value={row.laufzeit_jahre} onSave={(n) => onFk('laufzeit_jahre', n)} suffix="Jahre" suffixSingular="Jahr" integer placeholder="–" className="max-w-[100px]" />
      </td>
      <td className="px-3 py-1.5">
        <ZahlInput value={row.tilgungsfrei_jahre} onSave={(n) => onFk('tilgungsfrei_jahre', n)} suffix="Jahre" suffixSingular="Jahr" integer placeholder="–" className="max-w-[110px]" />
      </td>
      <MoveDeleteCell idx={idx} count={count} onMove={onMove} onRemove={onRemove} />
    </tr>
  )
}
