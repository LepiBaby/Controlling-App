'use client'

import { Fragment, useState, useMemo, useEffect } from 'react'
import { Scissors, Trash2, RotateCcw } from 'lucide-react'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { KpiCategory } from '@/hooks/use-kpi-categories'
import { ParsedExcelRow, ParseResult } from '@/lib/excel-parser'
import { AusgabenKostenTransaktion } from '@/hooks/use-ausgaben-kosten-transaktionen'

const EUR = new Intl.NumberFormat('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

type ConflictChoice = 'neu' | 'alt'

// ─── Types ────────────────────────────────────────────────────────────────────

export interface SubImportRow {
  _id: string
  leistungsdatum: string
  betrag_brutto: number
  ust_betrag: number
  ust_satz: string
  beschreibung: string
  kategorieId: string
  gruppeId: string
  untergruppeId: string
  salesPlattformId: string
  produktId: string
  relevanz: string
  zahlungsdatum: string
  abschreibung: string
  waehrung: string
  istFremdwaehrung: boolean
}

export interface ImportRow extends ParsedExcelRow {
  ust_satz: string
  kategorieId: string
  gruppeId: string
  untergruppeId: string
  salesPlattformId: string
  produktId: string
  relevanz: string
  zahlungsdatum: string
  abschreibung: string
  subRows: SubImportRow[]
}

interface ClassifiedRow {
  type: 'neu' | 'konflikt' | 'duplikat'
  importRow: ImportRow
  existingMatch?: AusgabenKostenTransaktion
}

type ColVis = {
  showGruppe: boolean
  showUntergruppe: boolean
  showSalesPlattform: boolean
  showProdukte: boolean
}

export interface AusgabenImportReviewDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  parseResult: ParseResult | null
  ausgabenKategorien: KpiCategory[]
  salesPlattformen: KpiCategory[]
  produkte: KpiCategory[]
  columnVisibility: ColVis
  onImport: (rows: ImportRow[]) => Promise<void>
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function computeUstBetrag(brutto: number, satz: string): number {
  if (satz === '100') return brutto
  if (satz === '19') return Math.round(brutto * 19 / 119 * 100) / 100
  if (satz === '7') return Math.round(brutto * 7 / 107 * 100) / 100
  return 0
}

function detectUstSatz(brutto: number, ust: number): string {
  if (brutto <= 0) return ''
  if (Math.abs(ust - brutto) < 0.01) return '100'
  if (Math.abs(ust - Math.round(brutto * 19 / 119 * 100) / 100) < 0.01) return '19'
  if (Math.abs(ust - Math.round(brutto * 7 / 107 * 100) / 100) < 0.01) return '7'
  if (Math.abs(ust) < 0.01) return '0'
  return 'individuell'
}

function normalizeStr(s: string | null | undefined): string {
  return s?.trim() ?? ''
}

function formatDate(iso: string): string {
  if (!iso) return '–'
  const [y, m, d] = iso.split('-')
  return `${d}.${m}.${y}`
}

function newSubId(): string {
  return `sub_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`
}

function createSubRow(parent: ImportRow, betrag_brutto: number, ust_betrag: number): SubImportRow {
  return {
    _id: newSubId(),
    leistungsdatum: parent.leistungsdatum,
    betrag_brutto,
    ust_betrag,
    ust_satz: detectUstSatz(betrag_brutto, ust_betrag),
    beschreibung: parent.beschreibung,
    kategorieId: parent.kategorieId,
    gruppeId: parent.gruppeId,
    untergruppeId: parent.untergruppeId,
    salesPlattformId: parent.salesPlattformId,
    produktId: parent.produktId,
    relevanz: parent.relevanz || 'beides',
    zahlungsdatum: parent.zahlungsdatum,
    abschreibung: parent.abschreibung,
    waehrung: parent.waehrung,
    istFremdwaehrung: parent.istFremdwaehrung,
  }
}

function initRows(parsed: ParsedExcelRow[]): ImportRow[] {
  return [...parsed]
    .sort((a, b) => a.leistungsdatum.localeCompare(b.leistungsdatum))
    .map(r => ({
      ...r,
      ust_satz: detectUstSatz(r.betrag_brutto, r.ust_betrag),
      kategorieId: '',
      gruppeId: '',
      untergruppeId: '',
      salesPlattformId: '',
      produktId: '',
      relevanz: 'beides',
      zahlungsdatum: '',
      abschreibung: '',
      subRows: [],
    }))
}

function checkFieldsComplete(
  row: { kategorieId: string; gruppeId: string; untergruppeId: string; salesPlattformId: string; produktId: string; relevanz: string; leistungsdatum: string; betrag_brutto: number; ust_betrag: number; ust_satz: string },
  kategorien: KpiCategory[],
  colVis: ColVis,
): boolean {
  if (!row.kategorieId || !row.relevanz) return false
  if (!row.leistungsdatum) return false
  if (row.betrag_brutto <= 0) return false
  if (!row.ust_satz) return false
  if (row.ust_betrag < 0 || (row.betrag_brutto > 0 && row.ust_betrag > row.betrag_brutto)) return false
  const selectedKat = kategorien.find(c => c.id === row.kategorieId)
  const gruppen = kategorien.filter(c => c.level === 2 && c.parent_id === row.kategorieId)
  if (colVis.showGruppe && gruppen.length > 0 && !row.gruppeId) return false
  const untergruppen = kategorien.filter(c => c.level === 3 && c.parent_id === row.gruppeId)
  if (colVis.showUntergruppe && row.gruppeId !== '' && untergruppen.length > 0 && !row.untergruppeId) return false
  if (colVis.showSalesPlattform && selectedKat?.sales_plattform_enabled === true && !row.salesPlattformId) return false
  if (colVis.showProdukte && selectedKat?.produkt_enabled === true && !row.produktId) return false
  return true
}

function isRowComplete(row: ImportRow, kategorien: KpiCategory[], colVis: ColVis): boolean {
  if (row.subRows.length > 0) {
    if (!row.subRows.every(s => checkFieldsComplete(s, kategorien, colVis))) return false
    const subSum = row.subRows.reduce((acc, s) => acc + s.betrag_brutto, 0)
    return Math.abs(subSum - row.betrag_brutto) < 0.01
  }
  return checkFieldsComplete(row, kategorien, colVis)
}

function isExactDuplicate(row: ImportRow, existing: AusgabenKostenTransaktion): boolean {
  return (
    (row.gruppeId || null) === existing.gruppe_id &&
    (row.untergruppeId || null) === existing.untergruppe_id &&
    (row.salesPlattformId || null) === existing.sales_plattform_id &&
    (row.produktId || null) === existing.produkt_id &&
    normalizeStr(row.beschreibung) === normalizeStr(existing.beschreibung) &&
    Math.abs(row.ust_betrag - existing.ust_betrag) < 0.01 &&
    row.relevanz === existing.relevanz &&
    (row.abschreibung || null) === existing.abschreibung
  )
}

function classifyRows(rows: ImportRow[], existing: AusgabenKostenTransaktion[]): ClassifiedRow[] {
  return rows.map(row => {
    const matches = existing.filter(e =>
      e.leistungsdatum === row.leistungsdatum &&
      e.kategorie_id === row.kategorieId &&
      Math.abs(e.betrag_brutto - row.betrag_brutto) < 0.01
    )
    if (matches.length === 0) return { type: 'neu' as const, importRow: row }
    const exactMatch = matches.find(e => isExactDuplicate(row, e))
    if (exactMatch) return { type: 'duplikat' as const, importRow: row, existingMatch: exactMatch }
    return { type: 'konflikt' as const, importRow: row, existingMatch: matches[0] }
  })
}

function flattenRows(rows: ImportRow[]): ImportRow[] {
  return rows.flatMap(row => {
    if (row.subRows.length > 0) {
      return row.subRows.map(sub => ({
        _id: sub._id,
        leistungsdatum: sub.leistungsdatum,
        beschreibung: sub.beschreibung,
        betrag_brutto: sub.betrag_brutto,
        ust_betrag: sub.ust_betrag,
        ust_satz: sub.ust_satz,
        waehrung: sub.waehrung,
        istFremdwaehrung: sub.istFremdwaehrung,
        hatFehler: false,
        kategorieId: sub.kategorieId,
        gruppeId: sub.gruppeId,
        untergruppeId: sub.untergruppeId,
        salesPlattformId: sub.salesPlattformId,
        produktId: sub.produktId,
        relevanz: sub.relevanz,
        zahlungsdatum: sub.zahlungsdatum,
        abschreibung: sub.abschreibung,
        subRows: [],
      } as ImportRow))
    }
    return [{ ...row, subRows: [] }]
  })
}

function getCategoryName(id: string | null | undefined, kategorien: KpiCategory[]): string {
  if (!id) return '–'
  return kategorien.find(c => c.id === id)?.name ?? '–'
}

const RELEVANZ_LABELS: Record<string, string> = {
  rentabilitaet: 'Rentabilität',
  liquiditaet: 'Liquidität',
  beides: 'Beides',
}

function getConflictDiffs(
  row: ImportRow,
  existing: AusgabenKostenTransaktion,
  kategorien: KpiCategory[],
  salesPlattformen: KpiCategory[],
  produkte: KpiCategory[],
): Array<{ label: string; altValue: string; neuValue: string }> {
  const diffs: Array<{ label: string; altValue: string; neuValue: string }> = []
  if ((row.gruppeId || null) !== existing.gruppe_id) diffs.push({ label: 'Gruppe', altValue: getCategoryName(existing.gruppe_id, kategorien), neuValue: getCategoryName(row.gruppeId, kategorien) })
  if ((row.untergruppeId || null) !== existing.untergruppe_id) diffs.push({ label: 'Untergruppe', altValue: getCategoryName(existing.untergruppe_id, kategorien), neuValue: getCategoryName(row.untergruppeId, kategorien) })
  if ((row.salesPlattformId || null) !== existing.sales_plattform_id) diffs.push({ label: 'Sales Plattform', altValue: getCategoryName(existing.sales_plattform_id, salesPlattformen), neuValue: getCategoryName(row.salesPlattformId, salesPlattformen) })
  if ((row.produktId || null) !== existing.produkt_id) diffs.push({ label: 'Produkt', altValue: getCategoryName(existing.produkt_id, produkte), neuValue: getCategoryName(row.produktId, produkte) })
  if (normalizeStr(row.beschreibung) !== normalizeStr(existing.beschreibung)) diffs.push({ label: 'Beschreibung', altValue: existing.beschreibung || '–', neuValue: row.beschreibung || '–' })
  if (Math.abs(row.ust_betrag - existing.ust_betrag) >= 0.01) diffs.push({ label: 'USt-Betrag', altValue: `${EUR.format(existing.ust_betrag)} €`, neuValue: `${EUR.format(row.ust_betrag)} €` })
  if (row.relevanz !== existing.relevanz) diffs.push({ label: 'Relevanz', altValue: RELEVANZ_LABELS[existing.relevanz] ?? existing.relevanz, neuValue: RELEVANZ_LABELS[row.relevanz] ?? row.relevanz })
  if ((row.abschreibung || null) !== existing.abschreibung) diffs.push({ label: 'Abschreibung', altValue: existing.abschreibung || '–', neuValue: row.abschreibung || '–' })
  return diffs
}

// ─── Column widths ─────────────────────────────────────────────────────────────
// Designed to fit within 96vw of a 1440px screen (≈1380px) with all 4 optional cols.
// Base (10 cols): ~955px. All 4 optional (4×100px): ~1355px < 1380px ✓

const W = {
  date:     'min-w-[128px] w-[128px]',  // Leistungsdatum / Zahlungsdatum (128px minimum for Windows date picker)
  kat:      'min-w-[118px] w-[118px]',  // Kategorie
  opt:      'min-w-[100px] w-[100px]',  // Gruppe / Untergruppe / SP / Produkt
  beschr:   'min-w-[108px]',            // Beschreibung
  brutto:   'min-w-[90px] w-[90px]',    // Brutto
  netto:    'min-w-[68px] w-[68px]',    // Netto (read-only)
  ust:      'min-w-[100px] w-[100px]',   // USt
  relevanz: 'min-w-[108px] w-[108px]',  // Relevanz
  abschr:   'min-w-[90px] w-[90px]',    // Abschreibung
  actions:  'min-w-[62px] w-[62px]',    // Action buttons
} as const

// ─── EditableRow ──────────────────────────────────────────────────────────────

type EditablePatch = Partial<{
  leistungsdatum: string; zahlungsdatum: string; betrag_brutto: number; ust_betrag: number; ust_satz: string
  beschreibung: string; kategorieId: string; gruppeId: string; untergruppeId: string
  salesPlattformId: string; produktId: string; relevanz: string; abschreibung: string
}>

interface EditableRowProps {
  data: SubImportRow | (ImportRow & { subRows?: never })
  kategorien: KpiCategory[]
  salesPlattformen: KpiCategory[]
  produkte: KpiCategory[]
  colVis: ColVis
  onChange: (patch: EditablePatch) => void
  onDelete: () => void
  onSplit?: () => void
  isSubRow?: boolean
}

function EditableRow({ data, kategorien, salesPlattformen, produkte, colVis, onChange, onDelete, onSplit, isSubRow = false }: EditableRowProps) {
  const level1 = kategorien.filter(c => c.level === 1)
  const selectedKat = kategorien.find(c => c.id === data.kategorieId) ?? null
  const gruppen = kategorien.filter(c => c.level === 2 && c.parent_id === data.kategorieId)
  const untergruppen = kategorien.filter(c => c.level === 3 && c.parent_id === data.gruppeId)

  const showGruppe = colVis.showGruppe && gruppen.length > 0
  const showUntergruppe = colVis.showUntergruppe && data.gruppeId !== '' && untergruppen.length > 0
  const showSalesPlattform = colVis.showSalesPlattform && selectedKat?.sales_plattform_enabled === true
  const showProdukte = colVis.showProdukte && selectedKat?.produkt_enabled === true

  const [ustIndividuellStr, setUstIndividuellStr] = useState(
    data.ust_satz === 'individuell' ? String(data.ust_betrag) : ''
  )

  const netto = Math.round((data.betrag_brutto - data.ust_betrag) * 100) / 100
  const bruttoError = data.betrag_brutto <= 0
  const ustIndividuellInvalid = data.ust_satz === 'individuell' && (data.ust_betrag < 0 || (data.betrag_brutto > 0 && data.ust_betrag > data.betrag_brutto))
  const dateError = !data.leistungsdatum

  const rowBg = isSubRow ? 'bg-blue-50/40 dark:bg-blue-950/20' : ((bruttoError || ustIndividuellInvalid || dateError || !data.ust_satz) ? 'bg-destructive/5' : '')
  const firstCellClass = isSubRow
    ? 'p-2 border-l-[3px] border-l-blue-400 pl-4'
    : 'p-2'

  const handleKategorieChange = (v: string) => {
    onChange({ kategorieId: v, gruppeId: '', untergruppeId: '', salesPlattformId: '', produktId: '' })
  }

  return (
    <tr className={`border-b last:border-0 ${rowBg}`}>
      {/* Leistungsdatum */}
      <td className={firstCellClass}>
        <Input type="date" value={data.leistungsdatum} onChange={e => onChange({ leistungsdatum: e.target.value })}
          className={`h-7 text-xs px-1.5 ${W.date} ${dateError ? 'border-destructive' : ''}`} />
        {dateError && <p className="text-[10px] text-destructive mt-0.5">Erforderlich</p>}
      </td>

      {/* Zahlungsdatum */}
      <td className="p-2">
        <Input type="date" value={data.zahlungsdatum} onChange={e => onChange({ zahlungsdatum: e.target.value })}
          className={`h-7 text-xs px-1.5 ${W.date}`} />
      </td>

      {/* Kategorie */}
      <td className="p-2">
        <Select value={data.kategorieId} onValueChange={handleKategorieChange}>
          <SelectTrigger className={`h-7 text-xs ${W.kat}`}><SelectValue placeholder="Wählen *" /></SelectTrigger>
          <SelectContent>{level1.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}</SelectContent>
        </Select>
      </td>

      {colVis.showGruppe && (
        <td className="p-2">
          {showGruppe ? (
            <Select value={data.gruppeId} onValueChange={v => onChange({ gruppeId: v, untergruppeId: '' })}>
              <SelectTrigger className={`h-7 text-xs ${W.opt}`}><SelectValue placeholder="Wählen *" /></SelectTrigger>
              <SelectContent>{gruppen.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}</SelectContent>
            </Select>
          ) : <span className="text-xs text-muted-foreground px-1">–</span>}
        </td>
      )}

      {colVis.showUntergruppe && (
        <td className="p-2">
          {showUntergruppe ? (
            <Select value={data.untergruppeId} onValueChange={v => onChange({ untergruppeId: v })}>
              <SelectTrigger className={`h-7 text-xs ${W.opt}`}><SelectValue placeholder="Wählen *" /></SelectTrigger>
              <SelectContent>{untergruppen.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}</SelectContent>
            </Select>
          ) : <span className="text-xs text-muted-foreground px-1">–</span>}
        </td>
      )}

      {colVis.showSalesPlattform && (
        <td className="p-2">
          {showSalesPlattform ? (
            <Select value={data.salesPlattformId} onValueChange={v => onChange({ salesPlattformId: v })}>
              <SelectTrigger className={`h-7 text-xs ${W.opt}`}><SelectValue placeholder="Wählen *" /></SelectTrigger>
              <SelectContent>
                {salesPlattformen.length === 0
                  ? <SelectItem value="__empty__" disabled>Keine</SelectItem>
                  : salesPlattformen.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
              </SelectContent>
            </Select>
          ) : <span className="text-xs text-muted-foreground px-1">–</span>}
        </td>
      )}

      {colVis.showProdukte && (
        <td className="p-2">
          {showProdukte ? (
            <Select value={data.produktId} onValueChange={v => onChange({ produktId: v })}>
              <SelectTrigger className={`h-7 text-xs ${W.opt}`}><SelectValue placeholder="Wählen *" /></SelectTrigger>
              <SelectContent>
                {produkte.length === 0
                  ? <SelectItem value="__empty__" disabled>Keine</SelectItem>
                  : produkte.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
              </SelectContent>
            </Select>
          ) : <span className="text-xs text-muted-foreground px-1">–</span>}
        </td>
      )}

      {/* Beschreibung */}
      <td className="p-2">
        <Input value={data.beschreibung} onChange={e => onChange({ beschreibung: e.target.value })}
          placeholder="–" className={`h-7 text-xs px-1.5 ${W.beschr}`} />
      </td>

      {/* Brutto */}
      <td className="p-2">
        <div className="flex items-center gap-0.5">
          {data.istFremdwaehrung && (
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <span className="inline-flex h-3.5 w-3.5 shrink-0 items-center justify-center rounded-full bg-amber-400 text-[9px] font-bold text-white cursor-help">!</span>
                </TooltipTrigger>
                <TooltipContent side="top" className="max-w-[200px] text-xs">
                  Fremdwährung ({data.waehrung}) — kein Wechselkurs
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          )}
          <Input type="number" step="0.01" min="0.01"
            value={data.betrag_brutto > 0 ? data.betrag_brutto : ''}
            onChange={e => { const v = parseFloat(e.target.value); onChange({ betrag_brutto: isNaN(v) ? 0 : Math.round(v * 100) / 100 }) }}
            className={`h-7 text-xs text-right px-1.5 ${W.brutto} ${bruttoError ? 'border-destructive' : ''}`} placeholder="0,00" />
        </div>
        {bruttoError && <p className="text-[10px] text-destructive mt-0.5">&gt; 0</p>}
      </td>

      {/* Netto */}
      <td className={`p-2 text-right ${W.netto}`}>
        <span className="text-xs text-muted-foreground">{EUR.format(netto)}</span>
      </td>

      {/* USt */}
      <td className="p-2">
        <div className="flex flex-col gap-1">
          <Select value={data.ust_satz} onValueChange={v => {
            if (v === 'individuell') {
              setUstIndividuellStr(String(data.ust_betrag))
              onChange({ ust_satz: v })
            } else {
              setUstIndividuellStr('')
              onChange({ ust_satz: v, ust_betrag: computeUstBetrag(data.betrag_brutto, v) })
            }
          }}>
            <SelectTrigger className={`h-7 text-xs ${W.ust}`}><SelectValue placeholder="Wählen *" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="100">100 %</SelectItem>
              <SelectItem value="19">19 %</SelectItem>
              <SelectItem value="7">7 %</SelectItem>
              <SelectItem value="0">0 %</SelectItem>
              <SelectItem value="individuell">Individuell</SelectItem>
            </SelectContent>
          </Select>
          {data.ust_satz === 'individuell' ? (
            <Input type="number" step="0.01" min="0" value={ustIndividuellStr}
              onChange={e => {
                setUstIndividuellStr(e.target.value)
                const v = parseFloat(e.target.value)
                onChange({ ust_betrag: isNaN(v) ? 0 : Math.round(v * 100) / 100 })
              }}
              className={`h-7 text-xs text-right px-1.5 ${W.ust} ${ustIndividuellInvalid ? 'border-destructive' : ''}`} placeholder="USt €" />
          ) : data.ust_satz && data.betrag_brutto > 0 && (
            <span className="text-[10px] text-muted-foreground text-right px-0.5">{EUR.format(data.ust_betrag)} €</span>
          )}
        </div>
        {ustIndividuellInvalid && data.betrag_brutto > 0 && (
          <p className="text-[10px] text-destructive mt-0.5">≥ Brutto</p>
        )}
      </td>

      {/* Relevanz */}
      <td className="p-2">
        <Select value={data.relevanz} onValueChange={v => onChange({ relevanz: v })}>
          <SelectTrigger className={`h-7 text-xs ${W.relevanz}`}><SelectValue placeholder="Wählen *" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="rentabilitaet">Rentabilität</SelectItem>
            <SelectItem value="liquiditaet">Liquidität</SelectItem>
            <SelectItem value="beides">Beides</SelectItem>
          </SelectContent>
        </Select>
      </td>

      {/* Abschreibung */}
      <td className="p-2">
        <Select value={data.abschreibung} onValueChange={v => onChange({ abschreibung: v })}>
          <SelectTrigger className={`h-7 text-xs ${W.abschr}`}><SelectValue placeholder="Keine" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="1_jahr">1 Jahr</SelectItem>
            <SelectItem value="3_jahre">3 Jahre</SelectItem>
            <SelectItem value="5_jahre">5 Jahre</SelectItem>
            <SelectItem value="7_jahre">7 Jahre</SelectItem>
            <SelectItem value="10_jahre">10 Jahre</SelectItem>
          </SelectContent>
        </Select>
      </td>

      {/* Actions */}
      <td className={`p-1 ${W.actions}`}>
        <div className="flex items-center justify-end">
          {onSplit && (
            <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-blue-600" onClick={onSplit} title="Betrag aufteilen">
              <Scissors className="h-3.5 w-3.5" />
            </Button>
          )}
          <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-destructive" onClick={onDelete}>
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
        </div>
      </td>
    </tr>
  )
}

// ─── SplitHeaderRow ───────────────────────────────────────────────────────────
// Top row of a split group: shows origin invoice info + action buttons.

function SplitHeaderRow({ row, index, colVis, onAddSplit, onUnsplit, onDelete }: {
  row: ImportRow; index: number; colVis: ColVis
  onAddSplit: (i: number) => void; onUnsplit: (i: number) => void; onDelete: (i: number) => void
}) {
  const varCols = (colVis.showGruppe ? 1 : 0) + (colVis.showUntergruppe ? 1 : 0) + (colVis.showSalesPlattform ? 1 : 0) + (colVis.showProdukte ? 1 : 0)
  const totalCols = 10 + varCols  // 10 fixed cols + variable

  return (
    <tr className="bg-blue-100/70 dark:bg-blue-950/50 border-b border-blue-200 dark:border-blue-900">
      <td colSpan={totalCols - 1} className="px-3 py-1.5 border-l-[3px] border-l-blue-500">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-xs font-semibold text-blue-800 dark:text-blue-300">{formatDate(row.leistungsdatum)}</span>
          {row.beschreibung && <span className="text-xs text-blue-700/70 dark:text-blue-400/70 truncate max-w-[200px]">{row.beschreibung}</span>}
          <Badge className="text-[10px] bg-blue-500/20 text-blue-800 dark:text-blue-300 border-blue-400 hover:bg-blue-500/30 px-1.5 py-0">
            Aufgeteilt in {row.subRows.length} Teile
          </Badge>
          <span className="text-[10px] text-blue-600/70 dark:text-blue-400/70 ml-1">Gesamtbetrag: {EUR.format(row.betrag_brutto)} €</span>
        </div>
      </td>
      <td className="p-1">
        <div className="flex items-center justify-end">
          <Button variant="ghost" size="icon" className="h-7 w-7 text-blue-600 hover:text-blue-800 hover:bg-blue-100" onClick={() => onAddSplit(index)} title="Weiteren Teil hinzufügen">
            <Scissors className="h-3.5 w-3.5" />
          </Button>
          <Button variant="ghost" size="icon" className="h-7 w-7 text-amber-600 hover:text-amber-800 hover:bg-amber-50" onClick={() => onUnsplit(index)} title="Aufteilung rückgängig machen">
            <RotateCcw className="h-3.5 w-3.5" />
          </Button>
          <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-destructive" onClick={() => onDelete(index)}>
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
        </div>
      </td>
    </tr>
  )
}

// ─── SplitTotalRow ────────────────────────────────────────────────────────────
// Bottom row of a split group: shows the parent brutto ALIGNED with the Brutto column.

function SplitTotalRow({ row, colVis }: { row: ImportRow; colVis: ColVis }) {
  const subSum = Math.round(row.subRows.reduce((acc, s) => acc + s.betrag_brutto, 0) * 100) / 100
  const sumOk = Math.abs(subSum - row.betrag_brutto) < 0.01
  const diff = Math.round(Math.abs(row.betrag_brutto - subSum) * 100) / 100
  // Columns before Brutto: Leistungsdatum + Zahlungsdatum + Kategorie + vars + Beschreibung = 4 + vars
  const varCols = (colVis.showGruppe ? 1 : 0) + (colVis.showUntergruppe ? 1 : 0) + (colVis.showSalesPlattform ? 1 : 0) + (colVis.showProdukte ? 1 : 0)
  const prebruttoCols = 4 + varCols

  return (
    <tr className="bg-blue-50/60 dark:bg-blue-950/30 border-b-2 border-b-blue-200 dark:border-b-blue-800">
      {/* Empty cells before Brutto column */}
      <td colSpan={prebruttoCols} className="border-l-[3px] border-l-blue-500" />
      {/* Brutto total — aligned with sub-row Brutto cells */}
      <td className="px-2 py-1.5">
        <div className="text-right">
          <div className="border-t-2 border-blue-400 dark:border-blue-600 pt-1">
            <span className={`text-xs font-bold ${sumOk ? 'text-blue-800 dark:text-blue-300' : 'text-destructive'}`}>
              = {EUR.format(row.betrag_brutto)} €
            </span>
          </div>
          {!sumOk && (
            <p className="text-[10px] text-destructive mt-0.5 whitespace-nowrap">
              Differenz: {EUR.format(diff)} €
            </p>
          )}
        </div>
      </td>
      {/* Empty Netto, USt, Relevanz, Abschreibung, Actions */}
      <td /><td /><td /><td /><td />
    </tr>
  )
}

// ─── ConflictCard ─────────────────────────────────────────────────────────────

function ConflictCard({ row, choice, kategorien, salesPlattformen, produkte, onChoiceChange }: {
  row: ClassifiedRow & { type: 'konflikt'; existingMatch: AusgabenKostenTransaktion }
  choice: ConflictChoice
  kategorien: KpiCategory[]
  salesPlattformen: KpiCategory[]
  produkte: KpiCategory[]
  onChoiceChange: (c: ConflictChoice) => void
}) {
  const diffs = getConflictDiffs(row.importRow, row.existingMatch, kategorien, salesPlattformen, produkte)
  return (
    <div className="border rounded-lg p-4 space-y-3">
      <div className="flex items-center gap-2 text-sm font-medium">
        <span>{formatDate(row.importRow.leistungsdatum)}</span>
        <span className="text-muted-foreground">·</span>
        <span>{getCategoryName(row.importRow.kategorieId, kategorien)}</span>
        <span className="text-muted-foreground">·</span>
        <span>{EUR.format(row.importRow.betrag_brutto)} €</span>
      </div>
      {diffs.length > 0 && (
        <table className="w-full text-xs border-collapse">
          <thead>
            <tr className="border-b">
              <th className="pb-1.5 text-left font-medium text-muted-foreground w-1/4">Feld</th>
              <th className="pb-1.5 text-left font-medium text-muted-foreground w-[37.5%]">Bestehend</th>
              <th className="pb-1.5 text-left font-medium w-[37.5%]">Import (Neu)</th>
            </tr>
          </thead>
          <tbody>
            {diffs.map(d => (
              <tr key={d.label} className="border-b last:border-0">
                <td className="py-1 text-muted-foreground">{d.label}</td>
                <td className="py-1">{d.altValue}</td>
                <td className="py-1 font-medium">{d.neuValue}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      <div className="flex rounded-md border overflow-hidden text-xs w-fit mt-1">
        <button
          onClick={() => onChoiceChange('alt')}
          className={`px-3 py-1.5 transition-colors border-r ${choice === 'alt' ? 'bg-muted font-semibold' : 'hover:bg-muted/50 text-muted-foreground'}`}
        >
          Bestehende beibehalten
        </button>
        <button
          onClick={() => onChoiceChange('neu')}
          className={`px-3 py-1.5 transition-colors ${choice === 'neu' ? 'bg-primary text-primary-foreground font-semibold' : 'hover:bg-muted/50 text-muted-foreground'}`}
        >
          Neue überschreiben
        </button>
      </div>
    </div>
  )
}

// ─── Main Dialog ──────────────────────────────────────────────────────────────

export function AusgabenImportReviewDialog({
  open, onOpenChange, parseResult, ausgabenKategorien, salesPlattformen, produkte, columnVisibility, onImport,
}: AusgabenImportReviewDialogProps) {
  const [rows, setRows] = useState<ImportRow[]>([])
  const [importing, setImporting] = useState(false)
  const [importError, setImportError] = useState<string | null>(null)
  const [step, setStep] = useState<'review' | 'conflict'>('review')
  const [classified, setClassified] = useState<ClassifiedRow[]>([])
  const [conflictChoices, setConflictChoices] = useState<Record<string, ConflictChoice>>({})
  const [checkingDuplicates, setCheckingDuplicates] = useState(false)

  useEffect(() => {
    if (parseResult) {
      setRows(initRows(parseResult.rows))
      setStep('review')
      setClassified([])
      setConflictChoices({})
      setImportError(null)
    }
  }, [parseResult])

  const completeCount = useMemo(
    () => rows.filter(r => isRowComplete(r, ausgabenKategorien, columnVisibility)).length,
    [rows, ausgabenKategorien, columnVisibility]
  )
  const allComplete = rows.length > 0 && completeCount === rows.length

  const handleChange = (index: number, patch: EditablePatch) => {
    setRows(prev => prev.map((r, i) => i === index ? { ...r, ...patch } : r))
  }
  const handleDelete = (index: number) => {
    setRows(prev => prev.filter((_, i) => i !== index))
  }
  const handleAddSplit = (index: number) => {
    setRows(prev => prev.map((row, i) => {
      if (i !== index) return row
      if (row.subRows.length === 0) {
        const b1 = Math.round(row.betrag_brutto / 2 * 100) / 100
        const b2 = Math.round((row.betrag_brutto - b1) * 100) / 100
        const u1 = Math.round(row.ust_betrag / 2 * 100) / 100
        const u2 = Math.round((row.ust_betrag - u1) * 100) / 100
        return { ...row, subRows: [createSubRow(row, b1, u1), createSubRow(row, b2, u2)] }
      }
      return { ...row, subRows: [...row.subRows, createSubRow(row, 0, 0)] }
    }))
  }
  const handleSubChange = (parentIndex: number, subIndex: number, patch: EditablePatch) => {
    setRows(prev => prev.map((row, i) => {
      if (i !== parentIndex) return row
      return { ...row, subRows: row.subRows.map((s, si) => si === subIndex ? { ...s, ...patch } : s) }
    }))
  }
  const handleDeleteSub = (parentIndex: number, subIndex: number) => {
    setRows(prev => prev.map((row, i) => {
      if (i !== parentIndex) return row
      return { ...row, subRows: row.subRows.filter((_, si) => si !== subIndex) }
    }))
  }
  const handleUnsplit = (index: number) => {
    setRows(prev => prev.map((row, i) => i === index ? { ...row, subRows: [] } : row))
  }

  const handleProceedToConflictCheck = async () => {
    setCheckingDuplicates(true)
    setImportError(null)
    try {
      const res = await fetch('/api/ausgaben-kosten-transaktionen?pageSize=0')
      if (!res.ok) throw new Error('Bestehende Transaktionen konnten nicht geladen werden.')
      const data = await res.json()
      const existing: AusgabenKostenTransaktion[] = data.data ?? []
      const flatRows = flattenRows(rows)
      const result = classifyRows(flatRows, existing)
      setClassified(result)
      const choices: Record<string, ConflictChoice> = {}
      result.filter(r => r.type === 'konflikt').forEach(r => { choices[r.importRow._id] = 'neu' })
      setConflictChoices(choices)
      setStep('conflict')
    } catch (e) {
      setImportError(e instanceof Error ? e.message : 'Fehler beim Laden der bestehenden Transaktionen.')
    } finally {
      setCheckingDuplicates(false)
    }
  }

  const handleFinalImport = async () => {
    const toImport = classified
      .filter(r => r.type === 'neu' || (r.type === 'konflikt' && conflictChoices[r.importRow._id] === 'neu'))
      .map(r => r.importRow)
    setImporting(true)
    setImportError(null)
    try {
      await onImport(toImport)
    } catch (e) {
      setImportError(e instanceof Error ? e.message : 'Fehler beim Importieren.')
      setImporting(false)
    }
  }

  const handleOpenChange = (val: boolean) => {
    if (!val) { setImportError(null); setStep('review') }
    onOpenChange(val)
  }

  const totalRows = parseResult?.rows.length ?? 0
  const skippedCount = parseResult?.skippedCount ?? 0
  const neuCount = classified.filter(r => r.type === 'neu').length
  const konfliktCount = classified.filter(r => r.type === 'konflikt').length
  const duplikatCount = classified.filter(r => r.type === 'duplikat').length
  const toImportCount = classified.filter(r =>
    r.type === 'neu' || (r.type === 'konflikt' && conflictChoices[r.importRow._id] === 'neu')
  ).length

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-[96vw] w-full h-[92vh] flex flex-col p-0 gap-0 overflow-hidden">

        {/* ── STEP 2: Review ─────────────────────────────────────────────────── */}
        {step === 'review' && (
          <>
            <DialogHeader className="px-5 pt-5 pb-3 border-b shrink-0">
              <div className="flex items-center justify-between gap-4 flex-wrap">
                <DialogTitle className="text-sm">
                  {totalRows} Transaktion{totalRows !== 1 ? 'en' : ''} aus Excel importieren
                </DialogTitle>
                <div className="flex items-center gap-2">
                  <Badge variant={allComplete ? 'default' : 'secondary'} className="text-xs">
                    {completeCount} / {rows.length} vollständig
                  </Badge>
                  {skippedCount > 0 && (
                    <Badge variant="outline" className="text-xs text-amber-600 border-amber-400">
                      {skippedCount} übersprungen
                    </Badge>
                  )}
                </div>
              </div>
              <p className="text-[11px] text-muted-foreground mt-0.5">
                Pflichtfelder: Kategorie, Relevanz
                {columnVisibility.showGruppe && ' + Gruppe'}
                {columnVisibility.showUntergruppe && ' + Untergruppe'}
                {columnVisibility.showSalesPlattform && ' + Sales Plattform'}
                {columnVisibility.showProdukte && ' + Produkt'}
                {' · '}
                <Scissors className="inline h-3 w-3 mb-0.5" /> = Betrag aufteilen
              </p>
            </DialogHeader>

            <div className="flex-1 overflow-auto min-h-0">
              {rows.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full gap-3 text-center px-6">
                  <p className="text-muted-foreground text-sm">Keine Transaktionen zum Importieren.</p>
                  <Button variant="outline" size="sm" onClick={() => handleOpenChange(false)}>Schließen</Button>
                </div>
              ) : (
                <table className="w-full text-sm border-collapse">
                  <thead className="sticky top-0 z-10 bg-background border-b">
                    <tr>
                      <th className={`p-2 text-left text-[11px] font-medium text-muted-foreground ${W.date}`}>Leistungsdatum</th>
                      <th className={`p-2 text-left text-[11px] font-medium text-muted-foreground ${W.date}`}>Zahldatum</th>
                      <th className={`p-2 text-left text-[11px] font-medium text-muted-foreground ${W.kat}`}>Kat. <span className="text-destructive">*</span></th>
                      {columnVisibility.showGruppe && <th className={`p-2 text-left text-[11px] font-medium text-muted-foreground ${W.opt}`}>Gruppe <span className="text-destructive">*</span></th>}
                      {columnVisibility.showUntergruppe && <th className={`p-2 text-left text-[11px] font-medium text-muted-foreground ${W.opt}`}>Untergr. <span className="text-destructive">*</span></th>}
                      {columnVisibility.showSalesPlattform && <th className={`p-2 text-left text-[11px] font-medium text-muted-foreground ${W.opt}`}>Plattform <span className="text-destructive">*</span></th>}
                      {columnVisibility.showProdukte && <th className={`p-2 text-left text-[11px] font-medium text-muted-foreground ${W.opt}`}>Produkt <span className="text-destructive">*</span></th>}
                      <th className={`p-2 text-left text-[11px] font-medium text-muted-foreground ${W.beschr}`}>Beschreibung</th>
                      <th className={`p-2 text-right text-[11px] font-medium text-muted-foreground ${W.brutto}`}>Brutto €</th>
                      <th className={`p-2 text-right text-[11px] font-medium text-muted-foreground ${W.netto}`}>Netto €</th>
                      <th className={`p-2 text-right text-[11px] font-medium text-muted-foreground ${W.ust}`}>USt €</th>
                      <th className={`p-2 text-left text-[11px] font-medium text-muted-foreground ${W.relevanz}`}>Relevanz <span className="text-destructive">*</span></th>
                      <th className={`p-2 text-left text-[11px] font-medium text-muted-foreground ${W.abschr}`}>Abschr.</th>
                      <th className={`p-2 ${W.actions}`} />
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((row, i) => (
                      <Fragment key={row._id}>
                        {row.subRows.length > 0 ? (
                          <>
                            <SplitHeaderRow row={row} index={i} colVis={columnVisibility} onAddSplit={handleAddSplit} onUnsplit={handleUnsplit} onDelete={handleDelete} />
                            {row.subRows.map((sub, si) => (
                              <EditableRow
                                key={sub._id}
                                data={sub}
                                kategorien={ausgabenKategorien}
                                salesPlattformen={salesPlattformen}
                                produkte={produkte}
                                colVis={columnVisibility}
                                onChange={patch => handleSubChange(i, si, patch)}
                                onDelete={() => handleDeleteSub(i, si)}
                                isSubRow
                              />
                            ))}
                            <SplitTotalRow row={row} colVis={columnVisibility} />
                          </>
                        ) : (
                          <EditableRow
                            data={row}
                            kategorien={ausgabenKategorien}
                            salesPlattformen={salesPlattformen}
                            produkte={produkte}
                            colVis={columnVisibility}
                            onChange={patch => handleChange(i, patch)}
                            onDelete={() => handleDelete(i)}
                            onSplit={() => handleAddSplit(i)}
                          />
                        )}
                      </Fragment>
                    ))}
                  </tbody>
                </table>
              )}
            </div>

            <div className="border-t px-5 py-3 shrink-0 space-y-2">
              {importError && <Alert variant="destructive"><AlertDescription className="text-xs">{importError}</AlertDescription></Alert>}
              <div className="flex items-center justify-between gap-4">
                <p className="text-xs text-muted-foreground">
                  {rows.length > 0 ? `${rows.length} Transaktion${rows.length !== 1 ? 'en' : ''} bereit` : ''}
                </p>
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" onClick={() => handleOpenChange(false)} disabled={checkingDuplicates}>Abbrechen</Button>
                  <Button size="sm" onClick={handleProceedToConflictCheck} disabled={!allComplete || checkingDuplicates || rows.length === 0}>
                    {checkingDuplicates ? 'Prüfen…' : 'Weiter →'}
                  </Button>
                </div>
              </div>
            </div>
          </>
        )}

        {/* ── STEP 3: Conflict Check ──────────────────────────────────────────── */}
        {step === 'conflict' && (
          <>
            <DialogHeader className="px-5 pt-5 pb-3 border-b shrink-0">
              <div className="flex items-center justify-between gap-4 flex-wrap">
                <DialogTitle className="text-sm">Duplikat-Prüfung</DialogTitle>
                <div className="flex items-center gap-2">
                  <Badge variant="default" className="text-xs">{neuCount} Neu</Badge>
                  {konfliktCount > 0 && <Badge variant="outline" className="text-xs text-amber-600 border-amber-400">{konfliktCount} Konflikte</Badge>}
                  {duplikatCount > 0 && <Badge variant="secondary" className="text-xs">{duplikatCount} Duplikate</Badge>}
                </div>
              </div>
              <p className="text-[11px] text-muted-foreground mt-0.5">Gleiche Kriterien: Datum + Kategorie + Bruttobetrag</p>
            </DialogHeader>

            <div className="flex-1 overflow-auto min-h-0 px-5 py-4 space-y-5">
              {neuCount > 0 && (
                <section>
                  <h3 className="text-xs font-semibold mb-2 flex items-center gap-2">
                    <span className="inline-block w-2 h-2 rounded-full bg-green-500" />
                    Neue Transaktionen ({neuCount}) — werden importiert
                  </h3>
                  <div className="border rounded-md overflow-hidden">
                    <table className="w-full text-xs border-collapse">
                      <thead className="bg-muted"><tr>
                        <th className="p-2 text-left font-medium">Datum</th>
                        <th className="p-2 text-left font-medium">Kategorie</th>
                        <th className="p-2 text-right font-medium">Brutto €</th>
                        <th className="p-2 text-left font-medium">Beschreibung</th>
                      </tr></thead>
                      <tbody>
                        {classified.filter(r => r.type === 'neu').map(r => (
                          <tr key={r.importRow._id} className="border-t">
                            <td className="p-2">{formatDate(r.importRow.leistungsdatum)}</td>
                            <td className="p-2">{getCategoryName(r.importRow.kategorieId, ausgabenKategorien)}</td>
                            <td className="p-2 text-right">{EUR.format(r.importRow.betrag_brutto)}</td>
                            <td className="p-2 text-muted-foreground">{r.importRow.beschreibung || '–'}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </section>
              )}

              {konfliktCount > 0 && (
                <section>
                  <h3 className="text-xs font-semibold mb-2 flex items-center gap-2">
                    <span className="inline-block w-2 h-2 rounded-full bg-amber-500" />
                    Konflikte ({konfliktCount}) — bitte Entscheidung treffen
                  </h3>
                  <div className="space-y-3">
                    {classified
                      .filter((r): r is ClassifiedRow & { type: 'konflikt'; existingMatch: AusgabenKostenTransaktion } =>
                        r.type === 'konflikt' && r.existingMatch !== undefined
                      )
                      .map(r => (
                        <ConflictCard
                          key={r.importRow._id}
                          row={r}
                          choice={conflictChoices[r.importRow._id] ?? 'neu'}
                          kategorien={ausgabenKategorien}
                          salesPlattformen={salesPlattformen}
                          produkte={produkte}
                          onChoiceChange={c => setConflictChoices(prev => ({ ...prev, [r.importRow._id]: c }))}
                        />
                      ))}
                  </div>
                </section>
              )}

              {duplikatCount > 0 && (
                <section>
                  <h3 className="text-xs font-semibold mb-2 flex items-center gap-2 text-muted-foreground">
                    <span className="inline-block w-2 h-2 rounded-full bg-muted-foreground" />
                    Duplikate ({duplikatCount}) — werden nicht importiert
                  </h3>
                  <div className="border rounded-md overflow-hidden opacity-60">
                    <table className="w-full text-xs border-collapse">
                      <thead className="bg-muted"><tr>
                        <th className="p-2 text-left font-medium">Datum</th>
                        <th className="p-2 text-left font-medium">Kategorie</th>
                        <th className="p-2 text-right font-medium">Brutto €</th>
                        <th className="p-2 text-left font-medium">Beschreibung</th>
                      </tr></thead>
                      <tbody>
                        {classified.filter(r => r.type === 'duplikat').map(r => (
                          <tr key={r.importRow._id} className="border-t">
                            <td className="p-2">{formatDate(r.importRow.leistungsdatum)}</td>
                            <td className="p-2">{getCategoryName(r.importRow.kategorieId, ausgabenKategorien)}</td>
                            <td className="p-2 text-right">{EUR.format(r.importRow.betrag_brutto)}</td>
                            <td className="p-2 text-muted-foreground">{r.importRow.beschreibung || '–'}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </section>
              )}

              {classified.length > 0 && neuCount === 0 && konfliktCount === 0 && (
                <div className="text-center py-8 text-muted-foreground text-sm">
                  Alle Transaktionen sind Duplikate — nichts wird importiert.
                </div>
              )}
            </div>

            <div className="border-t px-5 py-3 shrink-0 space-y-2">
              {importError && <Alert variant="destructive"><AlertDescription className="text-xs">{importError}</AlertDescription></Alert>}
              <div className="flex items-center justify-between gap-4">
                <p className="text-xs text-muted-foreground">
                  {toImportCount} Transaktion{toImportCount !== 1 ? 'en' : ''} werden importiert
                  {duplikatCount > 0 && ` · ${duplikatCount} Duplikat${duplikatCount !== 1 ? 'e' : ''} übersprungen`}
                </p>
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" onClick={() => { setStep('review'); setImportError(null) }} disabled={importing}>← Zurück</Button>
                  <Button variant="outline" size="sm" onClick={() => handleOpenChange(false)} disabled={importing}>Abbrechen</Button>
                  <Button size="sm" onClick={handleFinalImport} disabled={importing || toImportCount === 0}>
                    {importing ? 'Importieren…' : `${toImportCount} importieren`}
                  </Button>
                </div>
              </div>
            </div>
          </>
        )}

      </DialogContent>
    </Dialog>
  )
}
