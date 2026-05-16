'use client'

import { useState, useMemo, useEffect } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { KpiCategory } from '@/hooks/use-kpi-categories'
import { ParsedExcelRow, ParseResult } from '@/lib/excel-parser'

const EUR = new Intl.NumberFormat('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

export interface ImportRow extends ParsedExcelRow {
  kategorieId: string
  gruppeId: string
  untergruppeId: string
  salesPlattformId: string
  produktId: string
  relevanz: string
  zahlungsdatum: string
  abschreibung: string
}

export interface AusgabenImportReviewDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  parseResult: ParseResult | null
  ausgabenKategorien: KpiCategory[]
  salesPlattformen: KpiCategory[]
  produkte: KpiCategory[]
  columnVisibility: {
    showGruppe: boolean
    showUntergruppe: boolean
    showSalesPlattform: boolean
    showProdukte: boolean
  }
  onImport: (rows: ImportRow[]) => Promise<void>
}

function initRows(parsed: ParsedExcelRow[]): ImportRow[] {
  return parsed.map(r => ({
    ...r,
    kategorieId: '',
    gruppeId: '',
    untergruppeId: '',
    salesPlattformId: '',
    produktId: '',
    relevanz: '',
    zahlungsdatum: '',
    abschreibung: '',
  }))
}

function isRowComplete(
  row: ImportRow,
  kategorien: KpiCategory[],
  colVis: AusgabenImportReviewDialogProps['columnVisibility'],
): boolean {
  if (!row.kategorieId || !row.relevanz) return false
  if (row.hatFehler) return false

  const selectedKat = kategorien.find(c => c.id === row.kategorieId)
  const gruppen = kategorien.filter(c => c.level === 2 && c.parent_id === row.kategorieId)
  const showGruppe = colVis.showGruppe && gruppen.length > 0
  if (showGruppe && !row.gruppeId) return false

  const untergruppen = kategorien.filter(c => c.level === 3 && c.parent_id === row.gruppeId)
  const showUntergruppe = colVis.showUntergruppe && row.gruppeId !== '' && untergruppen.length > 0
  if (showUntergruppe && !row.untergruppeId) return false

  const showSalesPlattform = colVis.showSalesPlattform && selectedKat?.sales_plattform_enabled === true
  if (showSalesPlattform && !row.salesPlattformId) return false

  const showProdukte = colVis.showProdukte && selectedKat?.produkt_enabled === true
  if (showProdukte && !row.produktId) return false

  return true
}

interface RowCellsProps {
  row: ImportRow
  index: number
  kategorien: KpiCategory[]
  salesPlattformen: KpiCategory[]
  produkte: KpiCategory[]
  colVis: AusgabenImportReviewDialogProps['columnVisibility']
  onChange: (index: number, patch: Partial<ImportRow>) => void
  onDelete: (index: number) => void
}

function RowCells({ row, index, kategorien, salesPlattformen, produkte, colVis, onChange, onDelete }: RowCellsProps) {
  const level1 = kategorien.filter(c => c.level === 1)
  const selectedKat = kategorien.find(c => c.id === row.kategorieId) ?? null
  const gruppen = kategorien.filter(c => c.level === 2 && c.parent_id === row.kategorieId)
  const untergruppen = kategorien.filter(c => c.level === 3 && c.parent_id === row.gruppeId)

  const showGruppe = colVis.showGruppe && gruppen.length > 0
  const showUntergruppe = colVis.showUntergruppe && row.gruppeId !== '' && untergruppen.length > 0
  const showSalesPlattform = colVis.showSalesPlattform && selectedKat?.sales_plattform_enabled === true
  const showProdukte = colVis.showProdukte && selectedKat?.produkt_enabled === true

  const netto = Math.round((row.betrag_brutto - row.ust_betrag) * 100) / 100

  const handleKategorieChange = (v: string) => {
    onChange(index, { kategorieId: v, gruppeId: '', untergruppeId: '', salesPlattformId: '', produktId: '' })
  }
  const handleGruppeChange = (v: string) => {
    onChange(index, { gruppeId: v, untergruppeId: '' })
  }

  const rowClass = row.hatFehler ? 'bg-destructive/5' : ''

  return (
    <tr className={`border-b last:border-0 ${rowClass}`}>
      {/* Leistungsdatum */}
      <td className="p-2 min-w-[130px]">
        <Input
          type="date"
          value={row.leistungsdatum}
          onChange={e => onChange(index, { leistungsdatum: e.target.value })}
          className="h-8 text-xs"
        />
      </td>

      {/* Beschreibung */}
      <td className="p-2 min-w-[160px]">
        <Input
          value={row.beschreibung}
          onChange={e => onChange(index, { beschreibung: e.target.value })}
          placeholder="–"
          className="h-8 text-xs"
        />
      </td>

      {/* Bruttobetrag + Währungswarnung */}
      <td className="p-2 min-w-[110px] text-right">
        <div className="flex items-center justify-end gap-1">
          {row.istFremdwaehrung && (
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <span className="inline-flex h-4 w-4 items-center justify-center rounded-full bg-amber-400 text-[10px] font-bold text-white cursor-help">!</span>
                </TooltipTrigger>
                <TooltipContent side="top" className="max-w-[220px] text-xs">
                  Betrag aus Fremdwährung ({row.waehrung}) — kein Wechselkurs angewandt. Bitte Betrag manuell prüfen.
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          )}
          {row.hatFehler ? (
            <span className="text-xs text-destructive font-medium">{EUR.format(row.betrag_brutto)}</span>
          ) : (
            <span className="text-xs">{EUR.format(row.betrag_brutto)}</span>
          )}
        </div>
        {row.hatFehler && row.betrag_brutto <= 0 && (
          <p className="text-[10px] text-destructive mt-0.5 text-right">Betrag muss &gt; 0 sein</p>
        )}
        {row.hatFehler && row.betrag_brutto > 0 && row.ust_betrag >= row.betrag_brutto && (
          <p className="text-[10px] text-destructive mt-0.5 text-right">USt ≥ Brutto</p>
        )}
      </td>

      {/* USt-Betrag */}
      <td className="p-2 min-w-[90px] text-right">
        <span className="text-xs">{EUR.format(row.ust_betrag)}</span>
      </td>

      {/* Netto */}
      <td className="p-2 min-w-[90px] text-right">
        <span className="text-xs text-muted-foreground">{EUR.format(netto)}</span>
      </td>

      {/* Kategorie */}
      <td className="p-2 min-w-[160px]">
        <Select value={row.kategorieId} onValueChange={handleKategorieChange}>
          <SelectTrigger className="h-8 text-xs">
            <SelectValue placeholder="Wählen *" />
          </SelectTrigger>
          <SelectContent>
            {level1.map(c => (
              <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </td>

      {/* Gruppe */}
      {colVis.showGruppe && (
        <td className="p-2 min-w-[150px]">
          {showGruppe ? (
            <Select value={row.gruppeId} onValueChange={handleGruppeChange}>
              <SelectTrigger className="h-8 text-xs">
                <SelectValue placeholder="Wählen *" />
              </SelectTrigger>
              <SelectContent>
                {gruppen.map(c => (
                  <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          ) : (
            <span className="text-xs text-muted-foreground px-2">–</span>
          )}
        </td>
      )}

      {/* Untergruppe */}
      {colVis.showUntergruppe && (
        <td className="p-2 min-w-[150px]">
          {showUntergruppe ? (
            <Select value={row.untergruppeId} onValueChange={v => onChange(index, { untergruppeId: v })}>
              <SelectTrigger className="h-8 text-xs">
                <SelectValue placeholder="Wählen *" />
              </SelectTrigger>
              <SelectContent>
                {untergruppen.map(c => (
                  <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          ) : (
            <span className="text-xs text-muted-foreground px-2">–</span>
          )}
        </td>
      )}

      {/* Sales Plattform */}
      {colVis.showSalesPlattform && (
        <td className="p-2 min-w-[150px]">
          {showSalesPlattform ? (
            <Select value={row.salesPlattformId} onValueChange={v => onChange(index, { salesPlattformId: v })}>
              <SelectTrigger className="h-8 text-xs">
                <SelectValue placeholder="Wählen *" />
              </SelectTrigger>
              <SelectContent>
                {salesPlattformen.length === 0 ? (
                  <SelectItem value="__empty__" disabled>Keine defin.</SelectItem>
                ) : (
                  salesPlattformen.map(c => (
                    <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                  ))
                )}
              </SelectContent>
            </Select>
          ) : (
            <span className="text-xs text-muted-foreground px-2">–</span>
          )}
        </td>
      )}

      {/* Produkt */}
      {colVis.showProdukte && (
        <td className="p-2 min-w-[150px]">
          {showProdukte ? (
            <Select value={row.produktId} onValueChange={v => onChange(index, { produktId: v })}>
              <SelectTrigger className="h-8 text-xs">
                <SelectValue placeholder="Wählen *" />
              </SelectTrigger>
              <SelectContent>
                {produkte.length === 0 ? (
                  <SelectItem value="__empty__" disabled>Keine defin.</SelectItem>
                ) : (
                  produkte.map(c => (
                    <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                  ))
                )}
              </SelectContent>
            </Select>
          ) : (
            <span className="text-xs text-muted-foreground px-2">–</span>
          )}
        </td>
      )}

      {/* Relevanz */}
      <td className="p-2 min-w-[145px]">
        <Select value={row.relevanz} onValueChange={v => onChange(index, { relevanz: v })}>
          <SelectTrigger className="h-8 text-xs">
            <SelectValue placeholder="Wählen *" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="rentabilitaet">Rentabilität</SelectItem>
            <SelectItem value="liquiditaet">Liquidität</SelectItem>
            <SelectItem value="beides">Beides</SelectItem>
          </SelectContent>
        </Select>
      </td>

      {/* Zahlungsdatum (optional) */}
      <td className="p-2 min-w-[130px]">
        <Input
          type="date"
          value={row.zahlungsdatum}
          onChange={e => onChange(index, { zahlungsdatum: e.target.value })}
          className="h-8 text-xs"
        />
      </td>

      {/* Abschreibung (optional) */}
      <td className="p-2 min-w-[130px]">
        <Select value={row.abschreibung} onValueChange={v => onChange(index, { abschreibung: v })}>
          <SelectTrigger className="h-8 text-xs">
            <SelectValue placeholder="Keine" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="3_jahre">3 Jahre</SelectItem>
            <SelectItem value="5_jahre">5 Jahre</SelectItem>
            <SelectItem value="7_jahre">7 Jahre</SelectItem>
            <SelectItem value="10_jahre">10 Jahre</SelectItem>
          </SelectContent>
        </Select>
      </td>

      {/* Löschen */}
      <td className="p-2 min-w-[44px]">
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8 text-muted-foreground hover:text-destructive"
          onClick={() => onDelete(index)}
          aria-label="Zeile entfernen"
        >
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
              d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
          </svg>
        </Button>
      </td>
    </tr>
  )
}

export function AusgabenImportReviewDialog({
  open,
  onOpenChange,
  parseResult,
  ausgabenKategorien,
  salesPlattformen,
  produkte,
  columnVisibility,
  onImport,
}: AusgabenImportReviewDialogProps) {
  const [rows, setRows] = useState<ImportRow[]>([])
  const [importing, setImporting] = useState(false)
  const [importError, setImportError] = useState<string | null>(null)

  useEffect(() => {
    if (parseResult) setRows(initRows(parseResult.rows))
  }, [parseResult])

  const completeCount = useMemo(
    () => rows.filter(r => isRowComplete(r, ausgabenKategorien, columnVisibility)).length,
    [rows, ausgabenKategorien, columnVisibility]
  )
  const allComplete = rows.length > 0 && completeCount === rows.length

  const handleChange = (index: number, patch: Partial<ImportRow>) => {
    setRows(prev => prev.map((r, i) => i === index ? { ...r, ...patch } : r))
  }

  const handleDelete = (index: number) => {
    setRows(prev => prev.filter((_, i) => i !== index))
  }

  const handleImport = async () => {
    setImporting(true)
    setImportError(null)
    try {
      await onImport(rows)
    } catch (e) {
      setImportError(e instanceof Error ? e.message : 'Fehler beim Importieren.')
      setImporting(false)
    }
  }

  const handleOpenChange = (val: boolean) => {
    if (!val) {
      setImportError(null)
    }
    onOpenChange(val)
  }

  const totalRows = parseResult?.rows.length ?? 0
  const skippedCount = parseResult?.skippedCount ?? 0

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-[96vw] w-full h-[92vh] flex flex-col p-0 gap-0">
        <DialogHeader className="px-6 pt-6 pb-4 border-b shrink-0">
          <div className="flex items-center justify-between gap-4 flex-wrap">
            <DialogTitle className="text-base">
              {totalRows} Transaktion{totalRows !== 1 ? 'en' : ''} aus Excel importieren
            </DialogTitle>
            <div className="flex items-center gap-2 text-sm">
              <Badge variant={allComplete ? 'default' : 'secondary'}>
                {completeCount} / {rows.length} vollständig
              </Badge>
              {skippedCount > 0 && (
                <Badge variant="outline" className="text-amber-600 border-amber-400">
                  {skippedCount} übersprungen
                </Badge>
              )}
            </div>
          </div>
          <p className="text-xs text-muted-foreground mt-1">
            Pflichtfelder: Kategorie, Relevanz
            {columnVisibility.showGruppe && ' + Gruppe (wenn vorhanden)'}
            {columnVisibility.showUntergruppe && ' + Untergruppe (wenn vorhanden)'}
            {columnVisibility.showSalesPlattform && ' + Sales Plattform (wenn aktiv)'}
            {columnVisibility.showProdukte && ' + Produkt (wenn aktiv)'}
          </p>
        </DialogHeader>

        {/* Scrollable table area */}
        <div className="flex-1 overflow-auto min-h-0">
          {rows.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full gap-3 text-center px-6">
              <p className="text-muted-foreground">Keine Transaktionen zum Importieren.</p>
              <Button variant="outline" size="sm" onClick={() => handleOpenChange(false)}>
                Schließen
              </Button>
            </div>
          ) : (
            <table className="w-full text-sm border-collapse">
              <thead className="sticky top-0 z-10 bg-background border-b">
                <tr>
                  <th className="p-2 text-left text-xs font-medium text-muted-foreground min-w-[130px]">Leistungsdatum</th>
                  <th className="p-2 text-left text-xs font-medium text-muted-foreground min-w-[160px]">Beschreibung</th>
                  <th className="p-2 text-right text-xs font-medium text-muted-foreground min-w-[110px]">Brutto (€)</th>
                  <th className="p-2 text-right text-xs font-medium text-muted-foreground min-w-[90px]">USt (€)</th>
                  <th className="p-2 text-right text-xs font-medium text-muted-foreground min-w-[90px]">Netto (€)</th>
                  <th className="p-2 text-left text-xs font-medium text-muted-foreground min-w-[160px]">
                    Kategorie <span className="text-destructive">*</span>
                  </th>
                  {columnVisibility.showGruppe && (
                    <th className="p-2 text-left text-xs font-medium text-muted-foreground min-w-[150px]">
                      Gruppe <span className="text-destructive">*</span>
                    </th>
                  )}
                  {columnVisibility.showUntergruppe && (
                    <th className="p-2 text-left text-xs font-medium text-muted-foreground min-w-[150px]">
                      Untergruppe <span className="text-destructive">*</span>
                    </th>
                  )}
                  {columnVisibility.showSalesPlattform && (
                    <th className="p-2 text-left text-xs font-medium text-muted-foreground min-w-[150px]">
                      Sales Plattform <span className="text-destructive">*</span>
                    </th>
                  )}
                  {columnVisibility.showProdukte && (
                    <th className="p-2 text-left text-xs font-medium text-muted-foreground min-w-[150px]">
                      Produkt <span className="text-destructive">*</span>
                    </th>
                  )}
                  <th className="p-2 text-left text-xs font-medium text-muted-foreground min-w-[145px]">
                    Relevanz <span className="text-destructive">*</span>
                  </th>
                  <th className="p-2 text-left text-xs font-medium text-muted-foreground min-w-[130px]">Zahlungsdatum</th>
                  <th className="p-2 text-left text-xs font-medium text-muted-foreground min-w-[130px]">Abschreibung</th>
                  <th className="p-2 min-w-[44px]" />
                </tr>
              </thead>
              <tbody>
                {rows.map((row, i) => (
                  <RowCells
                    key={row._id}
                    row={row}
                    index={i}
                    kategorien={ausgabenKategorien}
                    salesPlattformen={salesPlattformen}
                    produkte={produkte}
                    colVis={columnVisibility}
                    onChange={handleChange}
                    onDelete={handleDelete}
                  />
                ))}
              </tbody>
            </table>
          )}
        </div>

        {/* Footer */}
        <div className="border-t px-6 py-4 shrink-0 space-y-3">
          {importError && (
            <Alert variant="destructive">
              <AlertDescription>{importError}</AlertDescription>
            </Alert>
          )}
          <div className="flex items-center justify-between gap-4">
            <p className="text-xs text-muted-foreground">
              {rows.length > 0
                ? `${rows.length} Transaktion${rows.length !== 1 ? 'en' : ''} werden importiert`
                : ''}
            </p>
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => handleOpenChange(false)} disabled={importing}>
                Abbrechen
              </Button>
              <Button
                onClick={handleImport}
                disabled={!allComplete || importing || rows.length === 0}
              >
                {importing ? 'Importieren…' : `Alle ${rows.length} importieren`}
              </Button>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
