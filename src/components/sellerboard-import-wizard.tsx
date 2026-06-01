'use client'

import { useRef, useState, useCallback, useMemo } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import { Label } from '@/components/ui/label'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { KpiCategory } from '@/hooks/use-kpi-categories'
import { parseSellerboardExcel, SellerboardParseResult } from '@/lib/sellerboard-parser'
import {
  calculateSellerboardRows,
  SellerboardImportRow,
  KPI_TYPE_LABELS,
} from '@/lib/sellerboard-calculator'

// ─── Types ───────────────────────────────────────────────────────────────────

interface ConflictItem {
  importRow: SellerboardImportRow
  existingId: string
  existingBetrag: number
  existingBeschreibung: string | null
  existingLeistungsdatum: string
  existingRelevanz: string | null
}

type ConflictDecision = 'keep_old' | 'keep_new' | 'keep_both'

interface Props {
  open: boolean
  onOpenChange: (open: boolean) => void
  ausgabenKategorien: KpiCategory[]
  umsatzKategorien: KpiCategory[]
  salesPlattformen: KpiCategory[]
  produkteKategorien: KpiCategory[]
  onImportDone: () => void
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

const EUR = new Intl.NumberFormat('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
const r2 = (n: number) => Math.round(n * 100) / 100

async function fetchAllPages(url: string, von: string, bis: string) {
  const results: Record<string, unknown>[] = []
  let page = 1
  while (true) {
    const res = await fetch(`${url}?von=${von}&bis=${bis}&page=${page}`)
    if (!res.ok) throw new Error(`Fehler beim Laden (${res.status})`)
    const data = await res.json()
    results.push(...(data.data ?? []))
    if (results.length >= (data.total ?? 0)) break
    page++
  }
  return results
}

// ─── Step indicator ───────────────────────────────────────────────────────────

function StepHeader({ step }: { step: 1 | 2 | 3 | 4 }) {
  const steps = ['Upload', 'Konfiguration', 'Vorschau', 'Import']
  return (
    <div className="flex items-center gap-1 text-xs text-muted-foreground">
      {steps.map((label, i) => (
        <span key={i} className="flex items-center gap-1">
          {i > 0 && <span className="mx-1">›</span>}
          <span className={i + 1 === step ? 'font-semibold text-foreground' : ''}>
            {i + 1}. {label}
          </span>
        </span>
      ))}
    </div>
  )
}

// ─── Main Wizard ──────────────────────────────────────────────────────────────

export function SellerboardImportWizard({
  open,
  onOpenChange,
  ausgabenKategorien,
  umsatzKategorien,
  salesPlattformen,
  produkteKategorien,
  onImportDone,
}: Props) {
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Step 1
  const [step, setStep] = useState<1 | 2 | 3 | 4>(1)
  const [parseResult, setParseResult] = useState<SellerboardParseResult | null>(null)
  const [uploading, setUploading] = useState(false)
  const [uploadError, setUploadError] = useState<string | null>(null)
  const [dragging, setDragging] = useState(false)

  // Step 2
  const [retourenkostenEntries, setRetourenkostenEntries] = useState<Record<string, Record<string, string>>>({})
  const [amazonFeePerMonth, setAmazonFeePerMonth] = useState<Record<string, string>>({})

  // Step 3
  const [importRows, setImportRows] = useState<SellerboardImportRow[]>([])
  const [showHidden, setShowHidden] = useState(false)

  // Step 4
  const [loadingConflicts, setLoadingConflicts] = useState(false)
  const [conflicts, setConflicts] = useState<ConflictItem[]>([])
  const [duplicates, setDuplicates] = useState<SellerboardImportRow[]>([])
  const [newTransactions, setNewTransactions] = useState<SellerboardImportRow[]>([])
  const [conflictDecisions, setConflictDecisions] = useState<Record<string, ConflictDecision>>({})
  const [conflictError, setConflictError] = useState<string | null>(null)
  const [importing, setImporting] = useState(false)
  const [importError, setImportError] = useState<string | null>(null)

  const reset = useCallback(() => {
    setStep(1)
    setParseResult(null)
    setUploading(false)
    setUploadError(null)
    setDragging(false)
    setRetourenkostenEntries({})
    setAmazonFeePerMonth({})
    setImportRows([])
    setShowHidden(false)
    setLoadingConflicts(false)
    setConflicts([])
    setDuplicates([])
    setNewTransactions([])
    setConflictDecisions({})
    setConflictError(null)
    setImporting(false)
    setImportError(null)
    if (fileInputRef.current) fileInputRef.current.value = ''
  }, [])

  const handleOpenChange = (val: boolean) => {
    if (!val) reset()
    onOpenChange(val)
  }

  // Unique products in the parse result
  const uniqueProducts = useMemo<{ productId: string; productName: string }[]>(() => {
    if (!parseResult) return []
    const map = new Map<string, { productId: string; productName: string }>()
    for (const row of parseResult.aggregatedRows) {
      if (!map.has(row.productId)) {
        map.set(row.productId, { productId: row.productId, productName: row.productName })
      }
    }
    return Array.from(map.values()).sort((a, b) => a.productName.localeCompare(b.productName))
  }, [parseResult])

  // Unique months in the parse result (YYYY-MM)
  const uniqueMonths = useMemo<{ monthKey: string; monthLabel: string }[]>(() => {
    if (!parseResult) return []
    const months = new Set(parseResult.aggregatedRows.map(r => r.date.slice(0, 7)))
    return Array.from(months).sort().map(m => {
      const [yyyy, mm] = m.split('-')
      const d = new Date(Number(yyyy), Number(mm) - 1, 1)
      return { monthKey: m, monthLabel: d.toLocaleDateString('de-DE', { month: 'long', year: 'numeric' }) }
    })
  }, [parseResult])

  // Visible / hidden counts for Step 3
  const { visibleRows, hiddenCount } = useMemo(() => {
    const hidden = importRows.filter(r => r.betragNetto === 0 && !r.hatWarnung)
    const visible = showHidden ? importRows : importRows.filter(r => r.betragNetto !== 0 || r.hatWarnung)
    return { visibleRows: visible, hiddenCount: hidden.length }
  }, [importRows, showHidden])

  const umsatzCount = useMemo(() => importRows.filter(r => r.rowType === 'umsatz' && r.betragNetto > 0).length, [importRows])
  const ausgabenCount = useMemo(() => importRows.filter(r => r.rowType === 'ausgaben' && r.betragNetto !== 0).length, [importRows])
  const errorCount = useMemo(() => importRows.filter(r => r.hatFehler && r.betragNetto !== 0).length, [importRows])
  const allValid = errorCount === 0 && importRows.some(r => r.betragNetto !== 0)

  // ── File processing ──────────────────────────────────────────────────────

  const processFile = useCallback(async (file: File) => {
    if (!file.name.endsWith('.xlsx')) {
      setUploadError('Bitte eine .xlsx-Datei hochladen.')
      return
    }
    setUploadError(null)
    setUploading(true)
    try {
      const buffer = await file.arrayBuffer()
      const result = parseSellerboardExcel(buffer, produkteKategorien)
      if (result.aggregatedRows.length === 0 && result.unknownSkus.length === 0) {
        setUploadError('Die Datei enthält keine verarbeitbaren Transaktionen.')
        setUploading(false)
        return
      }
      setParseResult(result)
      // Initialize month-based entries
      const months = [...new Set(result.aggregatedRows.map(r => r.date.slice(0, 7)))].sort()
      const productIds = [...new Set(result.aggregatedRows.map(r => r.productId))]
      const initRetourenkosten: Record<string, Record<string, string>> = {}
      const initFeePerMonth: Record<string, string> = {}
      for (const month of months) {
        initRetourenkosten[month] = {}
        for (const pid of productIds) initRetourenkosten[month][pid] = ''
        initFeePerMonth[month] = ''
      }
      setRetourenkostenEntries(initRetourenkosten)
      setAmazonFeePerMonth(initFeePerMonth)
      setStep(2)
    } catch (e) {
      setUploadError(e instanceof Error ? e.message : 'Fehler beim Verarbeiten der Datei.')
    } finally {
      setUploading(false)
    }
  }, [produkteKategorien])

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) processFile(file)
  }
  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    setDragging(false)
    const file = e.dataTransfer.files?.[0]
    if (file) processFile(file)
  }

  // ── Step 2 → 3: Calculate rows ───────────────────────────────────────────

  const handleGoToStep3 = () => {
    if (!parseResult) return
    const retourenkostenByMonth: Record<string, Record<string, number>> = {}
    for (const [monthKey, productMap] of Object.entries(retourenkostenEntries)) {
      retourenkostenByMonth[monthKey] = {}
      for (const [pid, val] of Object.entries(productMap)) {
        retourenkostenByMonth[monthKey][pid] = parseFloat(val) || 0
      }
    }
    const feeByMonth: Record<string, number> = {}
    for (const [monthKey, val] of Object.entries(amazonFeePerMonth)) {
      feeByMonth[monthKey] = parseFloat(val) || 0
    }
    const rows = calculateSellerboardRows({
      aggregatedRows: parseResult.aggregatedRows,
      retourenkostenByMonth,
      amazonFeePerMonth: feeByMonth,
      ausgabenKategorien,
      umsatzKategorien,
      salesPlattformen,
    })
    setImportRows(rows)
    setStep(3)
  }

  // ── Row editing (Step 3) ─────────────────────────────────────────────────

  const handleRowChange = (id: string, patch: Partial<SellerboardImportRow>) => {
    setImportRows(prev => prev.map(r => {
      if (r._id !== id) return r
      const updated = { ...r, ...patch }
      // Recalculate brutto/ust when netto changes
      if ('betragNetto' in patch && r.rowType === 'ausgaben') {
        const netto = patch.betragNetto ?? r.betragNetto
        updated.betragBrutto = r2(netto * 1.19)
        updated.ustBetrag = r2(netto * 0.19)
      }
      if ('betragNetto' in patch && r.rowType === 'umsatz') {
        updated.betragBrutto = patch.betragNetto ?? r.betragNetto
      }
      return updated
    }))
  }

  const handleRowDelete = (id: string) => {
    setImportRows(prev => prev.filter(r => r._id !== id))
  }

  // ── Step 3 → 4: Conflict detection ──────────────────────────────────────

  const handleGoToStep4 = useCallback(async () => {
    if (!parseResult?.dateRange) {
      setStep(4)
      setConflicts([])
      setDuplicates([])
      setNewTransactions(importRows.filter(r => r.betragNetto !== 0))
      return
    }
    setLoadingConflicts(true)
    setConflictError(null)
    setStep(4)
    try {
      const { von: rawVon, bis } = parseResult.dateRange
      // Extend von to include 1st of month (for Retourenkosten/Plattformgebühren rows)
      const firstOfMonth = rawVon.slice(0, 7) + '-01'
      const von = firstOfMonth < rawVon ? firstOfMonth : rawVon
      const [existingUmsatz, existingAusgaben] = await Promise.all([
        fetchAllPages('/api/umsatz-transaktionen', von, bis),
        fetchAllPages('/api/ausgaben-kosten-transaktionen', von, bis),
      ])

      const activeRows = importRows.filter(r => r.betragNetto !== 0)
      const foundConflicts: ConflictItem[] = []
      const foundDuplicates: SellerboardImportRow[] = []
      const foundNew: SellerboardImportRow[] = []
      const defaultDecisions: Record<string, ConflictDecision> = {}

      for (const row of activeRows) {
        const pool = row.rowType === 'umsatz' ? existingUmsatz : existingAusgaben
        const match = pool.find((e: Record<string, unknown>) =>
          e.leistungsdatum === row.leistungsdatum &&
          (e.kategorie_id ?? null) === (row.kategorieId || null) &&
          (e.gruppe_id ?? null) === (row.gruppeId ?? null) &&
          (e.untergruppe_id ?? null) === (row.untergruppeId ?? null) &&
          (e.produkt_id ?? null) === (row.produktId ?? null)
        ) as Record<string, unknown> | undefined

        if (match) {
          const existingBetragNetto = row.rowType === 'umsatz'
            ? Number(match.betrag ?? 0)
            : Number(match.betrag_brutto ?? 0) - Number(match.ust_betrag ?? 0)
          const identical = Math.abs(existingBetragNetto - row.betragNetto) < 0.005

          if (identical) {
            foundDuplicates.push(row)
            defaultDecisions[row._id] = 'keep_old'
          } else {
            foundConflicts.push({
              importRow: row,
              existingId: match.id as string,
              existingBetrag: existingBetragNetto,
              existingBeschreibung: (match.beschreibung as string) ?? null,
              existingLeistungsdatum: match.leistungsdatum as string,
              existingRelevanz: (match.relevanz as string) ?? null,
            })
            defaultDecisions[row._id] = 'keep_new'
          }
        } else {
          foundNew.push(row)
        }
      }

      setConflicts(foundConflicts)
      setDuplicates(foundDuplicates)
      setNewTransactions(foundNew)
      setConflictDecisions(defaultDecisions)
    } catch (e) {
      setConflictError(e instanceof Error ? e.message : 'Fehler bei der Konfliktprüfung.')
    } finally {
      setLoadingConflicts(false)
    }
  }, [importRows, parseResult])

  // ── Step 4: Import ───────────────────────────────────────────────────────

  const conflictById = useMemo(() => {
    const m = new Map<string, ConflictItem>()
    for (const c of conflicts) m.set(c.importRow._id, c)
    return m
  }, [conflicts])

  const allDecisionsMade = useMemo(() => {
    return conflicts.every(c => conflictDecisions[c.importRow._id] !== undefined)
  }, [conflicts, conflictDecisions])

  const handleImport = async () => {
    setImporting(true)
    setImportError(null)
    try {
      // Determine which rows to import and which to delete
      const activeRows = importRows.filter(r => r.betragNetto !== 0)
      const toImport = activeRows.filter(r => {
        const decision = conflictDecisions[r._id]
        return !decision || decision === 'keep_new' || decision === 'keep_both'
      })
      const toDelete = conflicts
        .filter(c => conflictDecisions[c.importRow._id] === 'keep_new')
        .map(c => ({ id: c.existingId, type: c.importRow.rowType }))

      // Delete old conflicting transactions
      await Promise.all(toDelete.map(({ id, type }) => {
        const url = type === 'umsatz'
          ? `/api/umsatz-transaktionen/${id}`
          : `/api/ausgaben-kosten-transaktionen/${id}`
        return fetch(url, { method: 'DELETE' })
      }))

      // Batch import Umsatz
      const umsatzRows = toImport.filter(r => r.rowType === 'umsatz')
      let umsatzSuccess = 0
      if (umsatzRows.length > 0) {
        const res = await fetch('/api/umsatz-transaktionen/batch', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(umsatzRows.map(r => ({
            leistungsdatum: r.leistungsdatum,
            betrag: r.betragNetto,
            kategorie_id: r.kategorieId,
            gruppe_id: r.gruppeId ?? null,
            untergruppe_id: r.untergruppeId ?? null,
            sales_plattform_id: r.salesPlattformId ?? null,
            produkt_id: r.produktId ?? null,
            beschreibung: r.beschreibung || null,
          }))),
        })
        if (!res.ok && res.status !== 207) {
          const d = await res.json().catch(() => ({}))
          throw new Error(d.error ?? `Umsatz-Import fehlgeschlagen (HTTP ${res.status})`)
        }
        const d = await res.json()
        umsatzSuccess = d.successCount ?? umsatzRows.length
      }

      // Batch import Ausgaben (skip zero-brutto rows, but allow negative = Gutschriften)
      const ausgabenRows = toImport.filter(r => r.rowType === 'ausgaben' && r.betragBrutto !== 0)
      let ausgabenSuccess = 0
      if (ausgabenRows.length > 0) {
        const res = await fetch('/api/ausgaben-kosten-transaktionen/batch', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(ausgabenRows.map(r => ({
            leistungsdatum: r.leistungsdatum,
            zahlungsdatum: r.zahlungsdatum || null,
            betrag_brutto: r.betragBrutto,
            ust_satz: '19',
            ust_betrag: r.ustBetrag,
            kategorie_id: r.kategorieId,
            gruppe_id: r.gruppeId ?? null,
            untergruppe_id: r.untergruppeId ?? null,
            sales_plattform_id: r.salesPlattformId ?? null,
            produkt_id: r.produktId ?? null,
            beschreibung: r.beschreibung || null,
            relevanz: 'rentabilitaet',
            abschreibung: null,
            import_source: 'sellerboard',
          }))),
        })
        if (!res.ok && res.status !== 207) {
          const d = await res.json().catch(() => ({}))
          throw new Error(d.error ?? `Ausgaben-Import fehlgeschlagen (HTTP ${res.status})`)
        }
        const d = await res.json()
        ausgabenSuccess = d.successCount ?? ausgabenRows.length
      }

      handleOpenChange(false)
      onImportDone()

      // Show result via toast via a custom event (parent will show it)
      window.dispatchEvent(new CustomEvent('sellerboard-import-done', {
        detail: { umsatzSuccess, ausgabenSuccess }
      }))
    } catch (e) {
      setImportError(e instanceof Error ? e.message : 'Import fehlgeschlagen.')
    } finally {
      setImporting(false)
    }
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Render
  // ─────────────────────────────────────────────────────────────────────────

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-[96vw] w-full h-[92vh] flex flex-col p-0 gap-0">

        {/* Header */}
        <DialogHeader className="px-6 pt-5 pb-4 border-b shrink-0 space-y-1">
          <DialogTitle className="text-base">Sellerboard Excel importieren</DialogTitle>
          <StepHeader step={step} />
        </DialogHeader>

        {/* Body */}
        <div className="flex-1 overflow-auto min-h-0 px-6 py-4">
          {step === 1 && <Step1Upload
            uploading={uploading}
            dragging={dragging}
            uploadError={uploadError}
            fileInputRef={fileInputRef}
            onFileInput={handleFileInput}
            onDrop={handleDrop}
            onDragOver={e => { e.preventDefault(); setDragging(true) }}
            onDragLeave={() => setDragging(false)}
          />}

          {step === 2 && parseResult && <Step2Config
            uniqueMonths={uniqueMonths}
            uniqueProducts={uniqueProducts}
            unknownSkus={parseResult.unknownSkus}
            retourenkostenEntries={retourenkostenEntries}
            amazonFeePerMonth={amazonFeePerMonth}
            onRetourenkostenChange={(monthKey, pid, val) =>
              setRetourenkostenEntries(prev => ({
                ...prev,
                [monthKey]: { ...prev[monthKey], [pid]: val },
              }))
            }
            onAmazonFeeChange={(monthKey, val) =>
              setAmazonFeePerMonth(prev => ({ ...prev, [monthKey]: val }))
            }
          />}

          {step === 3 && <Step3Preview
            visibleRows={visibleRows}
            hiddenCount={hiddenCount}
            showHidden={showHidden}
            onToggleHidden={() => setShowHidden(v => !v)}
            umsatzCount={umsatzCount}
            ausgabenCount={ausgabenCount}
            errorCount={errorCount}
            salesPlattformen={salesPlattformen}
            produkte={produkteKategorien.filter(c => c.level === 1)}
            ausgabenKategorien={ausgabenKategorien}
            umsatzKategorien={umsatzKategorien}
            onChange={handleRowChange}
            onDelete={handleRowDelete}
          />}

          {step === 4 && <Step4Conflicts
            loading={loadingConflicts}
            conflicts={conflicts}
            duplicates={duplicates}
            newTransactions={newTransactions}
            decisions={conflictDecisions}
            conflictError={conflictError}
            importError={importError}
            importing={importing}
            onDecisionChange={(id, decision) =>
              setConflictDecisions(prev => ({ ...prev, [id]: decision }))
            }
            onGlobalDecision={d => {
              const next: Record<string, ConflictDecision> = {}
              for (const c of conflicts) next[c.importRow._id] = d
              setConflictDecisions(next)
            }}
          />}
        </div>

        {/* Footer */}
        <div className="border-t px-6 py-4 shrink-0 flex items-center justify-between gap-4">
          <div>
            {step === 1 && (
              <p className="text-xs text-muted-foreground">
                Sellerboard Dashboard-Export (.xlsx) hochladen
              </p>
            )}
          </div>
          <div className="flex gap-2">
            {step === 1 && (
              <Button variant="outline" onClick={() => handleOpenChange(false)}>Abbrechen</Button>
            )}
            {step === 2 && (
              <>
                <Button variant="outline" onClick={() => setStep(1)}>Zurück</Button>
                <Button onClick={handleGoToStep3}>Weiter</Button>
              </>
            )}
            {step === 3 && (
              <>
                <Button variant="outline" onClick={() => setStep(2)}>Zurück</Button>
                <Button onClick={handleGoToStep4} disabled={!allValid}>
                  Weiter zu Schritt 4
                </Button>
              </>
            )}
            {step === 4 && (
              <>
                <Button variant="outline" onClick={() => setStep(3)} disabled={importing || loadingConflicts}>
                  Zurück
                </Button>
                <Button
                  onClick={handleImport}
                  disabled={importing || loadingConflicts || !allDecisionsMade || !!conflictError}
                >
                  {importing ? 'Importieren…' : 'Jetzt importieren'}
                </Button>
              </>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}

// ─── Step 1: Upload ──────────────────────────────────────────────────────────

function Step1Upload({
  uploading, dragging, uploadError, fileInputRef, onFileInput, onDrop, onDragOver, onDragLeave,
}: {
  uploading: boolean
  dragging: boolean
  uploadError: string | null
  fileInputRef: React.RefObject<HTMLInputElement | null>
  onFileInput: (e: React.ChangeEvent<HTMLInputElement>) => void
  onDrop: (e: React.DragEvent) => void
  onDragOver: (e: React.DragEvent) => void
  onDragLeave: () => void
}) {
  return (
    <div className="space-y-4 max-w-lg mx-auto pt-4">
      <p className="text-sm text-muted-foreground">
        Lade einen Sellerboard Dashboard-Export (<strong>Dashboard nach Produkt/Tag</strong>) als
        <strong> .xlsx</strong>-Datei hoch.
      </p>

      <div
        onDrop={onDrop}
        onDragOver={onDragOver}
        onDragLeave={onDragLeave}
        onClick={() => !uploading && fileInputRef.current?.click()}
        className={[
          'flex flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed px-6 py-12 text-center transition-colors',
          uploading ? 'cursor-default border-muted bg-muted/20' : 'cursor-pointer hover:border-primary hover:bg-muted/30',
          dragging ? 'border-primary bg-muted/30' : 'border-muted-foreground/30',
        ].join(' ')}
      >
        {uploading ? (
          <>
            <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
            <p className="text-sm text-muted-foreground">Datei wird verarbeitet…</p>
          </>
        ) : (
          <>
            <svg className="h-8 w-8 text-muted-foreground" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
            </svg>
            <p className="text-sm font-medium">{dragging ? 'Datei loslassen…' : 'Datei hier ablegen'}</p>
            <p className="text-xs text-muted-foreground">oder klicken um Datei auszuwählen</p>
          </>
        )}
      </div>

      <input ref={fileInputRef} type="file" accept=".xlsx" className="hidden" onChange={onFileInput} />

      {uploadError && (
        <Alert variant="destructive">
          <AlertDescription>{uploadError}</AlertDescription>
        </Alert>
      )}
    </div>
  )
}

// ─── Step 2: Config ───────────────────────────────────────────────────────────

function Step2Config({
  uniqueMonths, uniqueProducts, unknownSkus,
  retourenkostenEntries, amazonFeePerMonth,
  onRetourenkostenChange, onAmazonFeeChange,
}: {
  uniqueMonths: { monthKey: string; monthLabel: string }[]
  uniqueProducts: { productId: string; productName: string }[]
  unknownSkus: string[]
  retourenkostenEntries: Record<string, Record<string, string>>
  amazonFeePerMonth: Record<string, string>
  onRetourenkostenChange: (monthKey: string, productId: string, val: string) => void
  onAmazonFeeChange: (monthKey: string, val: string) => void
}) {
  return (
    <div className="space-y-6 pt-2 max-w-4xl mx-auto">
      {unknownSkus.length > 0 && (
        <Alert>
          <AlertDescription>
            <strong>{unknownSkus.length} SKU{unknownSkus.length > 1 ? 's' : ''} nicht im KPI-Modell gefunden</strong>
            {' '}und werden ignoriert: {unknownSkus.join(', ')}
          </AlertDescription>
        </Alert>
      )}

      {/* Retourenkosten matrix: months × products */}
      <div className="space-y-3">
        <div>
          <p className="text-sm font-medium">Retourenkosten (€ Netto)</p>
          <p className="text-xs text-muted-foreground mt-0.5">
            Pro Monat und Produkt eintragen. Leere Felder werden nicht importiert. Datum wird automatisch auf den 1. des Monats gesetzt.
          </p>
        </div>
        <div className="overflow-auto rounded border">
          <table className="text-xs border-collapse w-max min-w-full">
            <thead className="bg-muted/40 border-b">
              <tr>
                <th className="p-2 text-left font-medium text-muted-foreground whitespace-nowrap min-w-[120px]">Monat</th>
                {uniqueProducts.map(p => (
                  <th key={p.productId} className="p-2 text-left font-medium text-muted-foreground whitespace-nowrap min-w-[130px]">
                    {p.productName}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {uniqueMonths.map(({ monthKey, monthLabel }) => (
                <tr key={monthKey} className="border-b last:border-0 hover:bg-muted/10">
                  <td className="p-2 font-medium whitespace-nowrap">{monthLabel}</td>
                  {uniqueProducts.map(p => (
                    <td key={p.productId} className="p-2">
                      <div className="flex items-center gap-1">
                        <Input
                          type="number"
                          step="0.01"
                          min="0"
                          placeholder="–"
                          className="h-7 w-28 text-xs text-right"
                          value={retourenkostenEntries[monthKey]?.[p.productId] ?? ''}
                          onChange={e => onRetourenkostenChange(monthKey, p.productId, e.target.value)}
                        />
                        <span className="text-xs text-muted-foreground">€</span>
                      </div>
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Plattformgebühren per month */}
      <div className="border-t pt-4 space-y-3">
        <div>
          <p className="text-sm font-medium">Produktunabhängige Amazongebühren (optional)</p>
          <p className="text-xs text-muted-foreground mt-0.5">
            Wird als Ausgabe unter Operativ → Sales &amp; Marketing → Plattformgebühren importiert. Datum = 1. des Monats.
          </p>
        </div>
        <div className="space-y-2">
          {uniqueMonths.map(({ monthKey, monthLabel }) => (
            <div key={monthKey} className="flex items-center gap-3">
              <Label className="w-36 text-sm shrink-0">{monthLabel}</Label>
              <div className="flex items-center gap-1">
                <Input
                  type="number"
                  step="0.01"
                  min="0"
                  placeholder="–"
                  className="h-8 w-32 text-xs text-right"
                  value={amazonFeePerMonth[monthKey] ?? ''}
                  onChange={e => onAmazonFeeChange(monthKey, e.target.value)}
                />
                <span className="text-xs text-muted-foreground">€ Netto</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

// ─── Step 3: Preview Table ───────────────────────────────────────────────────

function formatDateDE(isoDate: string): string {
  const [yyyy, mm, dd] = isoDate.split('-')
  const d = new Date(Number(yyyy), Number(mm) - 1, Number(dd))
  return d.toLocaleDateString('de-DE', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })
}

function Step3Preview({
  visibleRows, hiddenCount, showHidden, onToggleHidden,
  umsatzCount, ausgabenCount, errorCount,
  salesPlattformen, produkte, ausgabenKategorien, umsatzKategorien,
  onChange, onDelete,
}: {
  visibleRows: SellerboardImportRow[]
  hiddenCount: number
  showHidden: boolean
  onToggleHidden: () => void
  umsatzCount: number
  ausgabenCount: number
  errorCount: number
  salesPlattformen: KpiCategory[]
  produkte: KpiCategory[]
  ausgabenKategorien: KpiCategory[]
  umsatzKategorien: KpiCategory[]
  onChange: (id: string, patch: Partial<SellerboardImportRow>) => void
  onDelete: (id: string) => void
}) {
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-4 text-sm">
        <div className="flex items-center gap-2 flex-wrap">
          <Badge variant="secondary">{umsatzCount} Umsatz</Badge>
          <Badge variant="secondary">{ausgabenCount} Ausgaben</Badge>
          {errorCount > 0 && <Badge variant="destructive">{errorCount} Fehler</Badge>}
        </div>
        {hiddenCount > 0 && (
          <button
            className="text-xs text-muted-foreground hover:text-foreground underline underline-offset-2"
            onClick={onToggleHidden}
          >
            {hiddenCount} Zeile{hiddenCount > 1 ? 'n' : ''} mit Wert 0 {showHidden ? 'ausblenden' : 'einblenden'}
          </button>
        )}
      </div>

      <div className="overflow-auto rounded border">
        <table className="w-full text-xs border-collapse">
          <thead className="sticky top-0 z-10 bg-background border-b">
            <tr>
              <th className="p-2 text-left font-medium text-muted-foreground whitespace-nowrap">Typ</th>
              <th className="p-2 text-left font-medium text-muted-foreground whitespace-nowrap min-w-[120px]">Leistungsdatum</th>
              <th className="p-2 text-left font-medium text-muted-foreground whitespace-nowrap min-w-[120px]">Zahlungsdatum</th>
              <th className="p-2 text-left font-medium text-muted-foreground whitespace-nowrap min-w-[130px]">Kategorie</th>
              <th className="p-2 text-left font-medium text-muted-foreground whitespace-nowrap min-w-[130px]">Gruppe</th>
              <th className="p-2 text-left font-medium text-muted-foreground whitespace-nowrap min-w-[130px]">Untergruppe</th>
              <th className="p-2 text-left font-medium text-muted-foreground whitespace-nowrap min-w-[130px]">Sales Plattform</th>
              <th className="p-2 text-left font-medium text-muted-foreground whitespace-nowrap min-w-[130px]">Produkt</th>
              <th className="p-2 text-left font-medium text-muted-foreground whitespace-nowrap min-w-[160px]">Beschreibung</th>
              <th className="p-2 text-right font-medium text-muted-foreground whitespace-nowrap min-w-[90px]">Netto (€)</th>
              <th className="p-2 text-right font-medium text-muted-foreground whitespace-nowrap min-w-[90px]">Brutto (€)</th>
              <th className="p-2 text-right font-medium text-muted-foreground whitespace-nowrap min-w-[80px]">USt (€)</th>
              <th className="p-2 text-left font-medium text-muted-foreground whitespace-nowrap min-w-[90px]">Relevanz</th>
              <th className="p-2 text-left font-medium text-muted-foreground whitespace-nowrap min-w-[100px]">Abschreibung</th>
              <th className="p-2 min-w-[36px]" />
            </tr>
          </thead>
          <tbody>
            {visibleRows.flatMap((row, idx) => {
              const showDateHeader = idx === 0 || row.leistungsdatum !== visibleRows[idx - 1].leistungsdatum
              const isError = row.hatFehler
              const isWarning = row.hatWarnung
              const rowClass = isError
                ? 'bg-destructive/5 border-b border-destructive/10'
                : isWarning
                  ? 'bg-amber-50 border-b border-amber-100'
                  : 'border-b hover:bg-muted/20'

              const level1 = (row.rowType === 'umsatz' ? umsatzKategorien : ausgabenKategorien).filter(c => c.level === 1)
              const level2 = ausgabenKategorien.filter(c => c.level === 2 && c.parent_id === row.kategorieId)
              const level3 = ausgabenKategorien.filter(c => c.level === 3 && c.parent_id === (row.gruppeId ?? ''))
              const selectedKat = level1.find(c => c.id === row.kategorieId)
              const canHaveSalesPlattform = row.rowType === 'umsatz' || (selectedKat?.sales_plattform_enabled ?? true)
              const canHaveProdukt = row.rowType === 'umsatz' || (selectedKat?.produkt_enabled ?? true)

              return [
                ...(showDateHeader ? [
                  <tr key={`date-${row.leistungsdatum}-${idx}`} className="bg-muted/50 border-b border-muted">
                    <td colSpan={15} className="px-3 py-2 font-semibold text-xs text-foreground tracking-wide">
                      {formatDateDE(row.leistungsdatum)}
                    </td>
                  </tr>
                ] : []),
                <tr key={row._id} className={rowClass} title={row.fehlerText ?? row.warnungText ?? undefined}>
                  <td className="p-2 whitespace-nowrap">
                    <Badge variant={row.rowType === 'umsatz' ? 'default' : 'outline'} className="text-[10px] py-0">
                      {row.rowType === 'umsatz' ? 'Umsatz' : 'Ausgaben'}
                    </Badge>
                  </td>
                  <td className="p-2">
                    <Input
                      type="date"
                      value={row.leistungsdatum}
                      onChange={e => onChange(row._id, { leistungsdatum: e.target.value })}
                      className="h-7 text-xs"
                    />
                  </td>
                  <td className="p-2">
                    {row.rowType === 'ausgaben' ? (
                      <Input
                        type="date"
                        value={row.zahlungsdatum}
                        onChange={e => onChange(row._id, { zahlungsdatum: e.target.value })}
                        className="h-7 text-xs"
                      />
                    ) : (
                      <span className="text-muted-foreground px-2">–</span>
                    )}
                  </td>
                  <td className="p-2">
                    <Select
                      value={row.kategorieId || '__none__'}
                      onValueChange={v => onChange(row._id, {
                        kategorieId: v === '__none__' ? '' : v,
                        gruppeId: null,
                        untergruppeId: null,
                      })}
                    >
                      <SelectTrigger className={`h-7 text-xs ${!row.kategorieId ? 'border-destructive' : ''}`}>
                        <SelectValue placeholder="–" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="__none__">–</SelectItem>
                        {level1.map(c => (
                          <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </td>
                  <td className="p-2">
                    {row.rowType === 'ausgaben' ? (
                      <Select
                        value={row.gruppeId ?? '__none__'}
                        onValueChange={v => onChange(row._id, {
                          gruppeId: v === '__none__' ? null : v,
                          untergruppeId: null,
                        })}
                      >
                        <SelectTrigger className="h-7 text-xs">
                          <SelectValue placeholder="–" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="__none__">–</SelectItem>
                          {level2.map(c => (
                            <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    ) : (
                      <span className="text-muted-foreground px-2">–</span>
                    )}
                  </td>
                  <td className="p-2">
                    {row.rowType === 'ausgaben' ? (
                      <Select
                        value={row.untergruppeId ?? '__none__'}
                        onValueChange={v => onChange(row._id, {
                          untergruppeId: v === '__none__' ? null : v,
                        })}
                      >
                        <SelectTrigger className="h-7 text-xs">
                          <SelectValue placeholder="–" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="__none__">–</SelectItem>
                          {level3.map(c => (
                            <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    ) : (
                      <span className="text-muted-foreground px-2">–</span>
                    )}
                  </td>
                  <td className="p-2">
                    {canHaveSalesPlattform ? (
                      <Select
                        value={row.salesPlattformId ?? '__none__'}
                        onValueChange={v => onChange(row._id, { salesPlattformId: v === '__none__' ? null : v })}
                      >
                        <SelectTrigger className="h-7 text-xs">
                          <SelectValue placeholder="–" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="__none__">–</SelectItem>
                          {salesPlattformen.map(p => (
                            <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    ) : (
                      <span className="text-muted-foreground px-2">–</span>
                    )}
                  </td>
                  <td className="p-2">
                    {canHaveProdukt ? (
                      <Select
                        value={row.produktId ?? '__none__'}
                        onValueChange={v => onChange(row._id, { produktId: v === '__none__' ? null : v })}
                      >
                        <SelectTrigger className="h-7 text-xs">
                          <SelectValue placeholder="–" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="__none__">–</SelectItem>
                          {produkte.map(p => (
                            <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    ) : (
                      <span className="text-muted-foreground px-2">–</span>
                    )}
                  </td>
                  <td className="p-2">
                    <Input
                      value={row.beschreibung}
                      onChange={e => onChange(row._id, { beschreibung: e.target.value })}
                      className="h-7 text-xs"
                      placeholder="–"
                    />
                  </td>
                  <td className="p-2">
                    <Input
                      type="number"
                      step="0.01"
                      min="0"
                      value={row.betragNetto || ''}
                      onChange={e => onChange(row._id, { betragNetto: parseFloat(e.target.value) || 0 })}
                      className="h-7 text-xs text-right"
                    />
                  </td>
                  <td className="p-2 text-right text-muted-foreground whitespace-nowrap">
                    {EUR.format(row.betragBrutto)}
                  </td>
                  <td className="p-2 text-right text-muted-foreground whitespace-nowrap">
                    {row.rowType === 'ausgaben' ? EUR.format(row.ustBetrag) : '–'}
                  </td>
                  <td className="p-2 text-muted-foreground whitespace-nowrap">
                    {row.rowType === 'ausgaben' ? 'Rentabilität' : '–'}
                  </td>
                  <td className="p-2 text-muted-foreground whitespace-nowrap">–</td>
                  <td className="p-2">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 text-muted-foreground hover:text-destructive"
                      onClick={() => onDelete(row._id)}
                    >
                      <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                          d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                    </Button>
                  </td>
                </tr>,
              ]
            })}
            {visibleRows.length === 0 && (
              <tr>
                <td colSpan={15} className="p-6 text-center text-muted-foreground text-xs">
                  Keine Zeilen vorhanden.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}

// ─── Step 4: Conflicts + Import ───────────────────────────────────────────────

function RowSummaryTable({ rows }: { rows: SellerboardImportRow[] }) {
  if (rows.length === 0) {
    return <p className="text-xs text-muted-foreground py-4 text-center">Keine Einträge.</p>
  }
  return (
    <div className="overflow-auto rounded border">
      <table className="w-full text-xs border-collapse">
        <thead className="bg-muted/40 border-b">
          <tr>
            <th className="p-2 text-left font-medium text-muted-foreground">Typ</th>
            <th className="p-2 text-left font-medium text-muted-foreground whitespace-nowrap">Datum</th>
            <th className="p-2 text-left font-medium text-muted-foreground">Beschreibung</th>
            <th className="p-2 text-right font-medium text-muted-foreground whitespace-nowrap">Netto (€)</th>
          </tr>
        </thead>
        <tbody>
          {rows.map(row => (
            <tr key={row._id} className="border-b last:border-0 hover:bg-muted/20">
              <td className="p-2">
                <Badge variant={row.rowType === 'umsatz' ? 'default' : 'outline'} className="text-[10px] py-0">
                  {row.rowType === 'umsatz' ? 'Umsatz' : 'Ausgaben'}
                </Badge>
              </td>
              <td className="p-2 whitespace-nowrap text-muted-foreground">
                {row.leistungsdatum.split('-').reverse().join('.')}
              </td>
              <td className="p-2 text-muted-foreground max-w-[260px] truncate">{row.beschreibung}</td>
              <td className="p-2 text-right tabular-nums">{EUR.format(row.betragNetto)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function Step4Conflicts({
  loading, conflicts, duplicates, newTransactions, decisions,
  conflictError, importError, importing,
  onDecisionChange, onGlobalDecision,
}: {
  loading: boolean
  conflicts: ConflictItem[]
  duplicates: SellerboardImportRow[]
  newTransactions: SellerboardImportRow[]
  decisions: Record<string, ConflictDecision>
  conflictError: string | null
  importError: string | null
  importing: boolean
  onDecisionChange: (id: string, decision: ConflictDecision) => void
  onGlobalDecision: (decision: ConflictDecision) => void
}) {
  if (loading) {
    return (
      <div className="flex items-center justify-center h-32 gap-3">
        <div className="h-5 w-5 animate-spin rounded-full border-2 border-primary border-t-transparent" />
        <span className="text-sm text-muted-foreground">Prüfe auf bestehende Transaktionen…</span>
      </div>
    )
  }

  if (conflictError) {
    return (
      <Alert variant="destructive">
        <AlertDescription>{conflictError}</AlertDescription>
      </Alert>
    )
  }

  return (
    <div className="space-y-4">
      <Tabs defaultValue={conflicts.length > 0 ? 'konflikte' : newTransactions.length > 0 ? 'neu' : 'duplikate'}>
        <TabsList className="w-full grid grid-cols-3">
          <TabsTrigger value="konflikte">
            Konflikte
            {conflicts.length > 0 && (
              <Badge variant="destructive" className="ml-1.5 text-[10px] py-0 px-1.5">{conflicts.length}</Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="duplikate">
            Duplikate
            {duplicates.length > 0 && (
              <Badge variant="secondary" className="ml-1.5 text-[10px] py-0 px-1.5">{duplicates.length}</Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="neu">
            Neue Transaktionen
            {newTransactions.length > 0 && (
              <Badge variant="secondary" className="ml-1.5 text-[10px] py-0 px-1.5">{newTransactions.length}</Badge>
            )}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="konflikte" className="mt-3">
          {conflicts.length === 0 ? (
            <p className="text-xs text-muted-foreground py-4 text-center">Keine Konflikte gefunden.</p>
          ) : (
            <>
              <div className="flex justify-end mb-2 gap-2">
                <Button variant="outline" size="sm" onClick={() => onGlobalDecision('keep_new')}>
                  Alle neuen übernehmen
                </Button>
                <Button variant="outline" size="sm" onClick={() => onGlobalDecision('keep_old')}>
                  Alle bestehenden behalten
                </Button>
                <Button variant="outline" size="sm" onClick={() => onGlobalDecision('keep_both')}>
                  Alle beide behalten
                </Button>
              </div>
              <div className="space-y-3">
                {conflicts.map(c => (
                  <div key={c.importRow._id} className="rounded-lg border p-3 space-y-2">
                    <div className="flex items-center gap-2 text-xs font-medium">
                      <Badge variant="outline" className="text-[10px]">
                        {c.importRow.rowType === 'umsatz' ? 'Umsatz' : 'Ausgaben'}
                      </Badge>
                      <span>{KPI_TYPE_LABELS[c.importRow.kpiType]}</span>
                      <span className="text-muted-foreground">–</span>
                      <span>{c.importRow.leistungsdatum.split('-').reverse().join('.')}</span>
                    </div>
                    <div className="grid grid-cols-2 gap-2 text-xs">
                      <div className="rounded bg-muted/40 p-2 space-y-0.5">
                        <p className="font-medium text-muted-foreground">Bestehend</p>
                        <p>{EUR.format(c.existingBetrag)} €</p>
                        {c.existingRelevanz && (
                          <p className="text-muted-foreground">{{ rentabilitaet: 'Rentabilität', liquiditaet: 'Liquidität', beides: 'Beides' }[c.existingRelevanz] ?? c.existingRelevanz}</p>
                        )}
                        {c.existingBeschreibung && (
                          <p className="text-muted-foreground truncate">{c.existingBeschreibung}</p>
                        )}
                      </div>
                      <div className="rounded bg-blue-50 p-2 space-y-0.5">
                        <p className="font-medium text-blue-600">Neu (Sellerboard)</p>
                        <p>{EUR.format(c.importRow.betragNetto)} €</p>
                        <p className="text-muted-foreground truncate">{c.importRow.beschreibung}</p>
                      </div>
                    </div>
                    <RadioGroup
                      value={decisions[c.importRow._id] ?? ''}
                      onValueChange={v => onDecisionChange(c.importRow._id, v as ConflictDecision)}
                      className="flex gap-4"
                    >
                      {[
                        { value: 'keep_old', label: 'Bestehende behalten' },
                        { value: 'keep_new', label: 'Neue übernehmen' },
                        { value: 'keep_both', label: 'Beide behalten' },
                      ].map(opt => (
                        <div key={opt.value} className="flex items-center gap-1.5">
                          <RadioGroupItem value={opt.value} id={`${c.importRow._id}-${opt.value}`} />
                          <Label htmlFor={`${c.importRow._id}-${opt.value}`} className="text-xs cursor-pointer">
                            {opt.label}
                          </Label>
                        </div>
                      ))}
                    </RadioGroup>
                  </div>
                ))}
              </div>
            </>
          )}
        </TabsContent>

        <TabsContent value="duplikate" className="mt-3">
          <p className="text-xs text-muted-foreground mb-3">
            Diese Transaktionen sind bereits mit identischem Betrag vorhanden und werden nicht importiert.
          </p>
          <RowSummaryTable rows={duplicates} />
        </TabsContent>

        <TabsContent value="neu" className="mt-3">
          <p className="text-xs text-muted-foreground mb-3">
            Diese Transaktionen sind neu und werden beim Import hinzugefügt.
          </p>
          <RowSummaryTable rows={newTransactions} />
        </TabsContent>
      </Tabs>

      {importError && (
        <Alert variant="destructive">
          <AlertDescription>{importError}</AlertDescription>
        </Alert>
      )}
    </div>
  )
}
