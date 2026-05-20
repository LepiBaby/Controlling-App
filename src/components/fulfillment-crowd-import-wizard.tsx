'use client'

import { useRef, useState, useCallback, useMemo } from 'react'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import { Label } from '@/components/ui/label'
import { KpiCategory } from '@/hooks/use-kpi-categories'
import { BestandTransaktion, calcEndbestand } from '@/hooks/use-bestand-transaktionen'
import { parseFulfillmentCrowdExcel } from '@/lib/fulfillment-crowd-parser'

// ─── Types ────────────────────────────────────────────────────────────────────

interface FcReviewEntry {
  _id: string
  skuCode: string
  skuId: string
  produktId: string
  datum: string
  anfangsbestand: number
  sendungen: { plattform_id: string; menge: number }[]
  sendungen_manuell: number
  einlagerungen: number
  anpassungen_positiv: number
  anpassungen_negativ: number
  warenverluste: number
}

interface DuplicateEntry {
  reviewEntry: FcReviewEntry
  existingId: string
  existingEndbestand: number
}

type DuplicateDecision = 'keep_old' | 'keep_new'

interface ProduktGroup {
  produktId: string
  produktName: string
  skuGroups: { skuCode: string; skuLabel: string; entries: FcReviewEntry[] }[]
}

interface Props {
  open: boolean
  onOpenChange: (open: boolean) => void
  skuCategories: KpiCategory[]        // type='produkte', level=2
  produkteCategories: KpiCategory[]   // type='produkte', level=1
  plattformCategories: KpiCategory[]  // type='sales_plattformen', level=1
  onImportDone: () => void
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function calcReviewEndbestand(e: FcReviewEntry): number {
  return calcEndbestand({
    anfangsbestand: e.anfangsbestand,
    einlagerungen: e.einlagerungen,
    anpassungen_positiv: e.anpassungen_positiv,
    anpassungen_negativ: e.anpassungen_negativ,
    warenverluste: e.warenverluste,
    sendungen_manuell: e.sendungen_manuell,
    sendungen: e.sendungen,
  })
}

function cascadeAnfangsbestand(entries: FcReviewEntry[], changedIdx: number): FcReviewEntry[] {
  const result = [...entries]
  const changedSku = result[changedIdx].skuCode
  let prev = calcReviewEndbestand(result[changedIdx])
  for (let i = changedIdx + 1; i < result.length; i++) {
    if (result[i].skuCode !== changedSku) break
    result[i] = { ...result[i], anfangsbestand: Math.max(0, prev) }
    prev = calcReviewEndbestand(result[i])
  }
  return result
}

function patchEntry(
  entries: FcReviewEntry[],
  id: string,
  patch: Partial<FcReviewEntry>,
): FcReviewEntry[] {
  const idx = entries.findIndex(e => e._id === id)
  if (idx === -1) return entries
  const updated = [...entries]
  updated[idx] = { ...updated[idx], ...patch }
  return cascadeAnfangsbestand(updated, idx)
}

function formatDate(iso: string): string {
  const [y, m, d] = iso.split('-')
  return `${d}.${m}.${y}`
}

// ─── Step indicator ───────────────────────────────────────────────────────────

function StepHeader({ step }: { step: 1 | 2 | 3 | 4 }) {
  const steps = ['Upload', 'Review', 'Duplikate', 'Abschluss']
  return (
    <div className="flex items-center gap-1 text-xs text-muted-foreground">
      {steps.map((label, i) => (
        <span key={i} className="flex items-center gap-1">
          {i > 0 && <span className="mx-1">›</span>}
          <span className={i + 1 === step ? 'font-semibold text-foreground' : ''}>{i + 1}. {label}</span>
        </span>
      ))}
    </div>
  )
}

// ─── Main Wizard ──────────────────────────────────────────────────────────────

export function FulfillmentCrowdImportWizard({
  open,
  onOpenChange,
  skuCategories,
  produkteCategories,
  plattformCategories,
  onImportDone,
}: Props) {
  const dispatchedInputRef = useRef<HTMLInputElement>(null)
  const stockInputRef = useRef<HTMLInputElement>(null)

  // Step 1
  const [step, setStep] = useState<1 | 2 | 3 | 4>(1)
  const [dispatchedFile, setDispatchedFile] = useState<File | null>(null)
  const [stockFile, setStockFile] = useState<File | null>(null)

  // Step 2
  const [processing, setProcessing] = useState(false)
  const [processError, setProcessError] = useState<string | null>(null)
  const [reviewEntries, setReviewEntries] = useState<FcReviewEntry[]>([])
  const [importedPlattformIds, setImportedPlattformIds] = useState<string[]>([])

  // Step 3
  const [checkingDuplicates, setCheckingDuplicates] = useState(false)
  const [duplicates, setDuplicates] = useState<DuplicateEntry[]>([])
  const [newEntries, setNewEntries] = useState<FcReviewEntry[]>([])
  const [duplicateDecisions, setDuplicateDecisions] = useState<Record<string, DuplicateDecision>>({})
  const [duplicateError, setDuplicateError] = useState<string | null>(null)

  // Step 4
  const [importing, setImporting] = useState(false)
  const [importError, setImportError] = useState<string | null>(null)
  const [importResult, setImportResult] = useState<{ imported: number; updated: number; skipped: number } | null>(null)

  const reset = useCallback(() => {
    setStep(1)
    setDispatchedFile(null)
    setStockFile(null)
    setProcessing(false)
    setProcessError(null)
    setReviewEntries([])
    setImportedPlattformIds([])
    setCheckingDuplicates(false)
    setDuplicates([])
    setNewEntries([])
    setDuplicateDecisions({})
    setDuplicateError(null)
    setImporting(false)
    setImportError(null)
    setImportResult(null)
    if (dispatchedInputRef.current) dispatchedInputRef.current.value = ''
    if (stockInputRef.current) stockInputRef.current.value = ''
  }, [])

  const handleOpenChange = (val: boolean) => {
    if (!val) reset()
    onOpenChange(val)
  }

  // ── Step 1 → 2: Process files ────────────────────────────────────────────

  const handleProcess = useCallback(async () => {
    if (!dispatchedFile || !stockFile) return
    setProcessing(true)
    setProcessError(null)
    try {
      const [dispBuf, stockBuf] = await Promise.all([
        dispatchedFile.arrayBuffer(),
        stockFile.arrayBuffer(),
      ])

      const { entries: rawEntries, unknownSkus, unknownChannels } = parseFulfillmentCrowdExcel(
        dispBuf,
        stockBuf,
        skuCategories,
        plattformCategories,
      )

      if (unknownSkus.length > 0) {
        setProcessError(
          `Import abgebrochen: ${unknownSkus.length} SKU-Code${unknownSkus.length > 1 ? 's' : ''} nicht im KPI-Modell gefunden: ${unknownSkus.join(', ')}`,
        )
        return
      }
      if (unknownChannels.length > 0) {
        setProcessError(
          `Import abgebrochen: ${unknownChannels.length} Channel${unknownChannels.length > 1 ? 's' : ''} konnte${unknownChannels.length > 1 ? 'n' : ''} keiner Plattform zugeordnet werden: ${unknownChannels.join(', ')}`,
        )
        return
      }
      if (rawEntries.length === 0) {
        setProcessError('Keine Daten in den Dateien gefunden.')
        return
      }

      // Build SKU map
      const skuMap = new Map<string, KpiCategory>()
      for (const sku of skuCategories) {
        if (sku.sku_code) skuMap.set(sku.sku_code.trim(), sku)
      }

      // Fetch existing transactions for each unique SKU (for anfangsbestand)
      const uniqueSkuCodes = [...new Set(rawEntries.map(e => e.skuCode))]
      const existingBySku = new Map<string, BestandTransaktion[]>()

      await Promise.all(
        uniqueSkuCodes.map(async (skuCode) => {
          const sku = skuMap.get(skuCode)!
          try {
            const res = await fetch(`/api/bestand-transaktionen?sku_id=${sku.id}`)
            const json = await res.json()
            existingBySku.set(sku.id, json.data ?? [])
          } catch {
            existingBySku.set(sku.id, [])
          }
        }),
      )

      // Collect platform IDs used in this import
      const usedPlatformIds = new Set<string>()
      for (const e of rawEntries) {
        for (const pid of Object.keys(e.sendungenByPlattformId)) {
          usedPlatformIds.add(pid)
        }
      }
      const orderedPlatformIds = plattformCategories
        .filter(p => usedPlatformIds.has(p.id))
        .sort((a, b) => a.sort_order - b.sort_order)
        .map(p => p.id)

      // Build review entries with chained anfangsbestand
      const built: FcReviewEntry[] = []
      let prevSkuCode = ''
      let prevEndbestand = 0

      for (const raw of rawEntries) {
        const sku = skuMap.get(raw.skuCode)!

        if (raw.skuCode !== prevSkuCode) {
          const existing = existingBySku.get(sku.id) ?? []
          // Find latest existing transaction strictly before the first import date for this SKU
          const lastBefore = existing
            .filter(t => t.datum < raw.datum)
            .sort((a, b) => b.datum.localeCompare(a.datum))[0]
          prevEndbestand = lastBefore ? calcEndbestand(lastBefore) : 0
          prevSkuCode = raw.skuCode
        }

        const sendungen = Object.entries(raw.sendungenByPlattformId).map(([plattform_id, menge]) => ({
          plattform_id,
          menge,
        }))

        const entry: FcReviewEntry = {
          _id: `${raw.skuCode}-${raw.datum}`,
          skuCode: raw.skuCode,
          skuId: sku.id,
          produktId: sku.parent_id ?? '',
          datum: raw.datum,
          anfangsbestand: Math.max(0, prevEndbestand),
          sendungen,
          sendungen_manuell: raw.sendungen_manuell,
          einlagerungen: raw.einlagerungen,
          anpassungen_positiv: raw.anpassungen_positiv,
          anpassungen_negativ: raw.anpassungen_negativ,
          warenverluste: raw.warenverluste,
        }

        prevEndbestand = calcReviewEndbestand(entry)
        built.push(entry)
      }

      setReviewEntries(built)
      setImportedPlattformIds(orderedPlatformIds)
      setStep(2)
    } catch (e) {
      setProcessError(e instanceof Error ? e.message : 'Fehler beim Verarbeiten der Dateien.')
    } finally {
      setProcessing(false)
    }
  }, [dispatchedFile, stockFile, skuCategories, plattformCategories])

  // ── Step 2: Review editing ───────────────────────────────────────────────

  const handleEntryChange = useCallback((id: string, patch: Partial<FcReviewEntry>) => {
    setReviewEntries(prev => patchEntry(prev, id, patch))
  }, [])

  const handleSendungChange = useCallback((id: string, plattformId: string, menge: number) => {
    setReviewEntries(prev => {
      const idx = prev.findIndex(e => e._id === id)
      if (idx === -1) return prev
      const entry = prev[idx]
      const existing = entry.sendungen.find(s => s.plattform_id === plattformId)
      const newSendungen = existing
        ? entry.sendungen.map(s => s.plattform_id === plattformId ? { ...s, menge } : s)
        : [...entry.sendungen, { plattform_id: plattformId, menge }]
      return patchEntry(prev, id, { sendungen: newSendungen })
    })
  }, [])

  // ── Step 2 → 3: Check duplicates ─────────────────────────────────────────

  const handleGoToStep3 = useCallback(async () => {
    setCheckingDuplicates(true)
    setDuplicateError(null)
    try {
      // Fetch existing transactions for each unique SKU
      const uniqueSkuIds = [...new Set(reviewEntries.map(e => e.skuId))]
      const existingBySku = new Map<string, BestandTransaktion[]>()

      await Promise.all(
        uniqueSkuIds.map(async (skuId) => {
          const res = await fetch(`/api/bestand-transaktionen?sku_id=${skuId}`)
          const json = await res.json()
          existingBySku.set(skuId, json.data ?? [])
        }),
      )

      const foundDuplicates: DuplicateEntry[] = []
      const foundNew: FcReviewEntry[] = []
      const defaultDecisions: Record<string, DuplicateDecision> = {}

      for (const entry of reviewEntries) {
        const existing = existingBySku.get(entry.skuId) ?? []
        const match = existing.find(t => t.datum === entry.datum)
        if (match) {
          foundDuplicates.push({
            reviewEntry: entry,
            existingId: match.id,
            existingEndbestand: calcEndbestand(match),
          })
          defaultDecisions[entry._id] = 'keep_old'
        } else {
          foundNew.push(entry)
        }
      }

      setDuplicates(foundDuplicates)
      setNewEntries(foundNew)
      setDuplicateDecisions(defaultDecisions)

      // Skip step 3 if no duplicates
      if (foundDuplicates.length === 0) {
        await runImport(foundNew, [], {})
      } else {
        setStep(3)
      }
    } catch (e) {
      setDuplicateError(e instanceof Error ? e.message : 'Fehler bei der Duplikatprüfung.')
      setStep(3)
    } finally {
      setCheckingDuplicates(false)
    }
  }, [reviewEntries]) // eslint-disable-line react-hooks/exhaustive-deps

  // ── Step 3/4: Import ──────────────────────────────────────────────────────

  const runImport = useCallback(async (
    toInsert: FcReviewEntry[],
    dupEntries: DuplicateEntry[],
    decisions: Record<string, DuplicateDecision>,
  ) => {
    setImporting(true)
    setImportError(null)
    let imported = 0, updated = 0, skipped = 0

    const toFormData = (e: FcReviewEntry) => ({
      sku_id: e.skuId,
      produkt_id: e.produktId,
      datum: e.datum,
      anfangsbestand: Math.max(0, Math.round(e.anfangsbestand)),
      einlagerungen: Math.max(0, Math.round(e.einlagerungen)),
      anpassungen_positiv: Math.max(0, Math.round(e.anpassungen_positiv)),
      anpassungen_negativ: Math.max(0, Math.round(e.anpassungen_negativ)),
      warenverluste: Math.max(0, Math.round(e.warenverluste)),
      sendungen_manuell: Math.max(0, Math.round(e.sendungen_manuell)),
      sendungen: e.sendungen.map(s => ({ plattform_id: s.plattform_id, menge: Math.max(0, Math.round(s.menge)) })),
    })

    try {
      // Insert new entries
      for (const entry of toInsert) {
        const res = await fetch('/api/bestand-transaktionen', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(toFormData(entry)),
        })
        if (res.ok || res.status === 201) {
          imported++
        } else {
          const d = await res.json().catch(() => ({}))
          throw new Error(d.error ?? `Fehler beim Importieren (${res.status})`)
        }
      }

      // Handle duplicates
      for (const dup of dupEntries) {
        const decision = decisions[dup.reviewEntry._id] ?? 'keep_old'
        if (decision === 'keep_new') {
          const res = await fetch(`/api/bestand-transaktionen/${dup.existingId}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(toFormData(dup.reviewEntry)),
          })
          if (res.ok) {
            updated++
          } else {
            const d = await res.json().catch(() => ({}))
            throw new Error(d.error ?? `Fehler beim Aktualisieren (${res.status})`)
          }
        } else {
          skipped++
        }
      }

      setImportResult({ imported, updated, skipped })
      setStep(4)
      onImportDone()
    } catch (e) {
      setImportError(e instanceof Error ? e.message : 'Import fehlgeschlagen.')
    } finally {
      setImporting(false)
    }
  }, [onImportDone])

  const handleImport = useCallback(() => {
    runImport(newEntries, duplicates, duplicateDecisions)
  }, [newEntries, duplicates, duplicateDecisions, runImport])

  // ── Derived ───────────────────────────────────────────────────────────────

  const produktGroups = useMemo<ProduktGroup[]>(() => {
    const map = new Map<string, ProduktGroup>()
    for (const entry of reviewEntries) {
      if (!map.has(entry.produktId)) {
        const p = produkteCategories.find(p => p.id === entry.produktId)
        map.set(entry.produktId, {
          produktId: entry.produktId,
          produktName: p?.name ?? entry.produktId,
          skuGroups: [],
        })
      }
      const pg = map.get(entry.produktId)!
      let sg = pg.skuGroups.find(s => s.skuCode === entry.skuCode)
      if (!sg) {
        const sku = skuCategories.find(s => s.id === entry.skuId)
        const skuLabel = sku?.sku_code ? `${sku.sku_code} – ${sku.name}` : (sku?.name ?? entry.skuCode)
        sg = { skuCode: entry.skuCode, skuLabel, entries: [] }
        pg.skuGroups.push(sg)
      }
      sg.entries.push(entry)
    }
    return [...map.values()].sort((a, b) => {
      const pa = produkteCategories.find(p => p.id === a.produktId)
      const pb = produkteCategories.find(p => p.id === b.produktId)
      return (pa?.sort_order ?? 0) - (pb?.sort_order ?? 0)
    })
  }, [reviewEntries, produkteCategories, skuCategories])

  const importedPlattformen = useMemo(
    () => plattformCategories.filter(p => importedPlattformIds.includes(p.id)),
    [plattformCategories, importedPlattformIds],
  )

  const allDuplicateDecisionsMade = useMemo(
    () => duplicates.every(d => duplicateDecisions[d.reviewEntry._id] !== undefined),
    [duplicates, duplicateDecisions],
  )

  // ─────────────────────────────────────────────────────────────────────────
  // Render
  // ─────────────────────────────────────────────────────────────────────────

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-[96vw] w-full h-[92vh] flex flex-col p-0 gap-0">

        <DialogHeader className="px-6 pt-5 pb-4 border-b shrink-0 space-y-1">
          <DialogTitle className="text-base">Fulfillment Crowd Excel importieren</DialogTitle>
          <StepHeader step={step} />
        </DialogHeader>

        <div className="flex-1 overflow-auto min-h-0 px-6 py-4">
          {step === 1 && (
            <Step1Upload
              dispatchedFile={dispatchedFile}
              stockFile={stockFile}
              processing={processing}
              processError={processError}
              dispatchedInputRef={dispatchedInputRef}
              stockInputRef={stockInputRef}
              onDispatchedChange={setDispatchedFile}
              onStockChange={setStockFile}
            />
          )}

          {step === 2 && (
            <Step2Review
              produktGroups={produktGroups}
              importedPlattformen={importedPlattformen}
              onEntryChange={handleEntryChange}
              onSendungChange={handleSendungChange}
            />
          )}

          {step === 3 && (
            <Step3Duplicates
              loading={checkingDuplicates}
              duplicates={duplicates}
              newEntries={newEntries}
              decisions={duplicateDecisions}
              error={duplicateError}
              importError={importError}
              importing={importing}
              onDecisionChange={(id, d) => setDuplicateDecisions(prev => ({ ...prev, [id]: d }))}
              onGlobalDecision={d => {
                const next: Record<string, DuplicateDecision> = {}
                for (const dup of duplicates) next[dup.reviewEntry._id] = d
                setDuplicateDecisions(next)
              }}
            />
          )}

          {step === 4 && importResult && (
            <Step4Done result={importResult} />
          )}
        </div>

        <div className="border-t px-6 py-4 shrink-0 flex items-center justify-between gap-4">
          <p className="text-xs text-muted-foreground">
            {step === 1 && 'Beide Dateien auswählen, dann „Weiter" klicken'}
            {step === 2 && (() => { const n = produktGroups.reduce((acc, pg) => acc + pg.skuGroups.length, 0); return `${reviewEntries.length} Einträge in ${n} SKU${n !== 1 ? 's' : ''}` })()}
          </p>
          <div className="flex gap-2">
            {step === 1 && (
              <>
                <Button variant="outline" onClick={() => handleOpenChange(false)}>Abbrechen</Button>
                <Button
                  onClick={handleProcess}
                  disabled={!dispatchedFile || !stockFile || processing}
                >
                  {processing ? 'Wird verarbeitet…' : 'Weiter'}
                </Button>
              </>
            )}
            {step === 2 && (
              <>
                <Button variant="outline" onClick={() => setStep(1)}>Zurück</Button>
                <Button onClick={handleGoToStep3} disabled={checkingDuplicates}>
                  {checkingDuplicates ? 'Prüfe Duplikate…' : 'Weiter'}
                </Button>
              </>
            )}
            {step === 3 && (
              <>
                <Button variant="outline" onClick={() => setStep(2)} disabled={importing}>Zurück</Button>
                <Button
                  onClick={handleImport}
                  disabled={importing || !allDuplicateDecisionsMade || !!duplicateError}
                >
                  {importing ? 'Importieren…' : 'Jetzt importieren'}
                </Button>
              </>
            )}
            {step === 4 && (
              <Button onClick={() => handleOpenChange(false)}>Schließen</Button>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}

// ─── Step 1: Upload ──────────────────────────────────────────────────────────

function FileDropArea({
  label,
  file,
  inputRef,
  onFileChange,
}: {
  label: string
  file: File | null
  inputRef: React.RefObject<HTMLInputElement | null>
  onFileChange: (f: File | null) => void
}) {
  const [dragging, setDragging] = useState(false)

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    setDragging(false)
    const f = e.dataTransfer.files?.[0]
    if (f?.name.endsWith('.xlsx')) onFileChange(f)
  }

  return (
    <div className="space-y-2">
      <p className="text-sm font-medium">{label}</p>
      <div
        onDrop={handleDrop}
        onDragOver={e => { e.preventDefault(); setDragging(true) }}
        onDragLeave={() => setDragging(false)}
        onClick={() => inputRef.current?.click()}
        className={[
          'flex flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed px-6 py-8 text-center transition-colors cursor-pointer',
          dragging ? 'border-primary bg-muted/30' : file ? 'border-green-500 bg-green-50' : 'border-muted-foreground/30 hover:border-primary hover:bg-muted/20',
        ].join(' ')}
      >
        {file ? (
          <>
            <svg className="h-6 w-6 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
            <p className="text-sm font-medium text-green-700">{file.name}</p>
            <p className="text-xs text-muted-foreground">Klicken zum Ersetzen</p>
          </>
        ) : (
          <>
            <svg className="h-7 w-7 text-muted-foreground" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
            </svg>
            <p className="text-sm">{dragging ? 'Datei loslassen…' : 'Datei hier ablegen oder klicken'}</p>
            <p className="text-xs text-muted-foreground">.xlsx</p>
          </>
        )}
      </div>
      <input
        ref={inputRef}
        type="file"
        accept=".xlsx"
        className="hidden"
        onChange={e => onFileChange(e.target.files?.[0] ?? null)}
      />
    </div>
  )
}

function Step1Upload({
  dispatchedFile, stockFile, processing, processError,
  dispatchedInputRef, stockInputRef, onDispatchedChange, onStockChange,
}: {
  dispatchedFile: File | null
  stockFile: File | null
  processing: boolean
  processError: string | null
  dispatchedInputRef: React.RefObject<HTMLInputElement | null>
  stockInputRef: React.RefObject<HTMLInputElement | null>
  onDispatchedChange: (f: File | null) => void
  onStockChange: (f: File | null) => void
}) {
  return (
    <div className="space-y-6 max-w-2xl mx-auto pt-2">
      <p className="text-sm text-muted-foreground">
        Lade die beiden Fulfillment-Crowd-Exporte hoch. Beide Dateien müssen im <strong>.xlsx</strong>-Format vorliegen.
      </p>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
        <FileDropArea
          label="Dispatched Orders Review"
          file={dispatchedFile}
          inputRef={dispatchedInputRef}
          onFileChange={onDispatchedChange}
        />
        <FileDropArea
          label="Stock Movement Report"
          file={stockFile}
          inputRef={stockInputRef}
          onFileChange={onStockChange}
        />
      </div>
      {processing && (
        <div className="flex items-center gap-3 text-sm text-muted-foreground">
          <div className="h-4 w-4 animate-spin rounded-full border-2 border-primary border-t-transparent" />
          Dateien werden verarbeitet…
        </div>
      )}
      {processError && (
        <Alert variant="destructive">
          <AlertDescription className="whitespace-pre-wrap">{processError}</AlertDescription>
        </Alert>
      )}
    </div>
  )
}

// ─── Step 2: Review ──────────────────────────────────────────────────────────

function Step2Review({
  produktGroups,
  importedPlattformen,
  onEntryChange,
  onSendungChange,
}: {
  produktGroups: ProduktGroup[]
  importedPlattformen: KpiCategory[]
  onEntryChange: (id: string, patch: Partial<FcReviewEntry>) => void
  onSendungChange: (id: string, plattformId: string, menge: number) => void
}) {
  if (produktGroups.length === 0) return null

  return (
    <div className="space-y-3">
      <p className="text-sm text-muted-foreground">
        Bitte die berechneten Werte prüfen und bei Bedarf anpassen. Der Endbestand wird automatisch berechnet.
      </p>
      <Tabs defaultValue={produktGroups[0].produktId}>
        <TabsList className="flex-wrap h-auto gap-1">
          {produktGroups.map(pg => (
            <TabsTrigger key={pg.produktId} value={pg.produktId}>
              {pg.produktName}
            </TabsTrigger>
          ))}
        </TabsList>
        {produktGroups.map(pg => (
          <TabsContent key={pg.produktId} value={pg.produktId} className="mt-4">
            {pg.skuGroups.length === 1 ? (
              <SkuReviewSection
                skuCode={pg.skuGroups[0].skuCode}
                skuLabel={pg.skuGroups[0].skuLabel}
                entries={pg.skuGroups[0].entries}
                importedPlattformen={importedPlattformen}
                onEntryChange={onEntryChange}
                onSendungChange={onSendungChange}
              />
            ) : (
              <Tabs defaultValue={pg.skuGroups[0].skuCode}>
                <TabsList className="flex-wrap h-auto gap-1">
                  {pg.skuGroups.map(sg => (
                    <TabsTrigger key={sg.skuCode} value={sg.skuCode}>
                      {sg.skuLabel}
                    </TabsTrigger>
                  ))}
                </TabsList>
                {pg.skuGroups.map(sg => (
                  <TabsContent key={sg.skuCode} value={sg.skuCode} className="mt-4">
                    <SkuReviewSection
                      skuCode={sg.skuCode}
                      skuLabel={sg.skuLabel}
                      entries={sg.entries}
                      importedPlattformen={importedPlattformen}
                      onEntryChange={onEntryChange}
                      onSendungChange={onSendungChange}
                    />
                  </TabsContent>
                ))}
              </Tabs>
            )}
          </TabsContent>
        ))}
      </Tabs>
    </div>
  )
}

function SkuReviewSection({
  skuCode,
  skuLabel,
  entries,
  importedPlattformen,
  onEntryChange,
  onSendungChange,
}: {
  skuCode: string
  skuLabel: string
  entries: FcReviewEntry[]
  importedPlattformen: KpiCategory[]
  onEntryChange: (id: string, patch: Partial<FcReviewEntry>) => void
  onSendungChange: (id: string, plattformId: string, menge: number) => void
}) {
  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <Badge variant="outline" className="font-mono text-xs">{skuLabel}</Badge>
        <span className="text-xs text-muted-foreground">{entries.length} Tag{entries.length !== 1 ? 'e' : ''}</span>
      </div>
      <div className="overflow-auto rounded border">
        <table className="w-full text-xs border-collapse">
          <thead className="sticky top-0 z-10 bg-background border-b">
            <tr>
              <th className="p-2 text-left font-medium text-muted-foreground whitespace-nowrap min-w-[90px]">Datum</th>
              <th className="p-2 text-right font-medium text-muted-foreground whitespace-nowrap min-w-[90px]">Anfang</th>
              {importedPlattformen.map(p => (
                <th key={p.id} className="p-2 text-right font-medium text-muted-foreground whitespace-nowrap min-w-[90px]">
                  {p.name}
                </th>
              ))}
              <th className="p-2 text-right font-medium text-muted-foreground whitespace-nowrap min-w-[80px]">Manuell</th>
              <th className="p-2 text-right font-medium text-muted-foreground whitespace-nowrap min-w-[80px]">Einlag.</th>
              <th className="p-2 text-right font-medium text-muted-foreground whitespace-nowrap min-w-[70px]">Anp.+</th>
              <th className="p-2 text-right font-medium text-muted-foreground whitespace-nowrap min-w-[70px]">Anp.−</th>
              <th className="p-2 text-right font-medium text-muted-foreground whitespace-nowrap min-w-[80px]">Verlust</th>
              <th className="p-2 text-right font-medium text-muted-foreground whitespace-nowrap min-w-[90px]">Endbestand</th>
            </tr>
          </thead>
          <tbody>
            {entries.map(entry => {
              const endbestand = calcReviewEndbestand(entry)
              return (
                <tr key={entry._id} className="border-b last:border-0 hover:bg-muted/10">
                  <td className="p-2 whitespace-nowrap font-medium">{formatDate(entry.datum)}</td>
                  <td className="p-1.5">
                    <Input
                      type="number"
                      min="0"
                      step="1"
                      value={entry.anfangsbestand}
                      onChange={e => onEntryChange(entry._id, { anfangsbestand: Math.max(0, parseInt(e.target.value) || 0) })}
                      className="h-7 w-full text-xs text-right"
                    />
                  </td>
                  {importedPlattformen.map(p => {
                    const s = entry.sendungen.find(s => s.plattform_id === p.id)
                    return (
                      <td key={p.id} className="p-1.5">
                        <Input
                          type="number"
                          min="0"
                          step="1"
                          value={s?.menge ?? 0}
                          onChange={e => onSendungChange(entry._id, p.id, Math.max(0, parseInt(e.target.value) || 0))}
                          className="h-7 w-full text-xs text-right"
                        />
                      </td>
                    )
                  })}
                  <td className="p-1.5">
                    <Input
                      type="number"
                      min="0"
                      step="1"
                      value={entry.sendungen_manuell}
                      onChange={e => onEntryChange(entry._id, { sendungen_manuell: Math.max(0, parseInt(e.target.value) || 0) })}
                      className="h-7 w-full text-xs text-right"
                    />
                  </td>
                  <td className="p-1.5">
                    <Input
                      type="number"
                      min="0"
                      step="1"
                      value={entry.einlagerungen}
                      onChange={e => onEntryChange(entry._id, { einlagerungen: Math.max(0, parseInt(e.target.value) || 0) })}
                      className="h-7 w-full text-xs text-right"
                    />
                  </td>
                  <td className="p-1.5">
                    <Input
                      type="number"
                      min="0"
                      step="1"
                      value={entry.anpassungen_positiv}
                      onChange={e => onEntryChange(entry._id, { anpassungen_positiv: Math.max(0, parseInt(e.target.value) || 0) })}
                      className="h-7 w-full text-xs text-right"
                    />
                  </td>
                  <td className="p-1.5">
                    <Input
                      type="number"
                      min="0"
                      step="1"
                      value={entry.anpassungen_negativ}
                      onChange={e => onEntryChange(entry._id, { anpassungen_negativ: Math.max(0, parseInt(e.target.value) || 0) })}
                      className="h-7 w-full text-xs text-right"
                    />
                  </td>
                  <td className="p-1.5">
                    <Input
                      type="number"
                      min="0"
                      step="1"
                      value={entry.warenverluste}
                      onChange={e => onEntryChange(entry._id, { warenverluste: Math.max(0, parseInt(e.target.value) || 0) })}
                      className="h-7 w-full text-xs text-right"
                    />
                  </td>
                  <td className={`p-2 text-right font-medium tabular-nums whitespace-nowrap ${endbestand < 0 ? 'text-destructive' : ''}`}>
                    {endbestand}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}

// ─── Step 3: Duplicates ───────────────────────────────────────────────────────

function Step3Duplicates({
  loading, duplicates, newEntries, decisions, error, importError, importing,
  onDecisionChange, onGlobalDecision,
}: {
  loading: boolean
  duplicates: DuplicateEntry[]
  newEntries: FcReviewEntry[]
  decisions: Record<string, DuplicateDecision>
  error: string | null
  importError: string | null
  importing: boolean
  onDecisionChange: (id: string, d: DuplicateDecision) => void
  onGlobalDecision: (d: DuplicateDecision) => void
}) {
  if (loading) {
    return (
      <div className="flex items-center justify-center h-32 gap-3">
        <div className="h-5 w-5 animate-spin rounded-full border-2 border-primary border-t-transparent" />
        <span className="text-sm text-muted-foreground">Prüfe auf bestehende Einträge…</span>
      </div>
    )
  }

  if (error) {
    return (
      <Alert variant="destructive">
        <AlertDescription>{error}</AlertDescription>
      </Alert>
    )
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3 text-sm">
        <Badge variant="secondary">{newEntries.length} neu</Badge>
        {duplicates.length > 0 && (
          <Badge variant="destructive">{duplicates.length} Duplikat{duplicates.length !== 1 ? 'e' : ''}</Badge>
        )}
      </div>

      {duplicates.length === 0 ? (
        <p className="text-sm text-muted-foreground py-4">
          Keine Duplikate gefunden. Klicke „Jetzt importieren" um alle {newEntries.length} Einträge zu speichern.
        </p>
      ) : (
        <div className="space-y-3">
          <div className="flex justify-end gap-2">
            <Button variant="outline" size="sm" onClick={() => onGlobalDecision('keep_new')}>
              Alle neuen übernehmen
            </Button>
            <Button variant="outline" size="sm" onClick={() => onGlobalDecision('keep_old')}>
              Alle alten behalten
            </Button>
          </div>
          <div className="overflow-auto rounded border">
            <table className="w-full text-xs border-collapse">
              <thead className="bg-muted/40 border-b">
                <tr>
                  <th className="p-2 text-left font-medium text-muted-foreground">SKU</th>
                  <th className="p-2 text-left font-medium text-muted-foreground whitespace-nowrap">Datum</th>
                  <th className="p-2 text-right font-medium text-muted-foreground whitespace-nowrap">Endbestand (alt)</th>
                  <th className="p-2 text-right font-medium text-muted-foreground whitespace-nowrap">Endbestand (neu)</th>
                  <th className="p-2 text-left font-medium text-muted-foreground min-w-[260px]">Entscheidung</th>
                </tr>
              </thead>
              <tbody>
                {duplicates.map(dup => (
                  <tr key={dup.reviewEntry._id} className="border-b last:border-0 hover:bg-muted/10">
                    <td className="p-2 font-mono whitespace-nowrap">{dup.reviewEntry.skuCode}</td>
                    <td className="p-2 whitespace-nowrap">{formatDate(dup.reviewEntry.datum)}</td>
                    <td className="p-2 text-right tabular-nums">{dup.existingEndbestand}</td>
                    <td className="p-2 text-right tabular-nums font-medium">{calcReviewEndbestand(dup.reviewEntry)}</td>
                    <td className="p-2">
                      <RadioGroup
                        value={decisions[dup.reviewEntry._id] ?? ''}
                        onValueChange={v => onDecisionChange(dup.reviewEntry._id, v as DuplicateDecision)}
                        className="flex gap-4"
                      >
                        {[
                          { value: 'keep_old', label: 'Alten behalten' },
                          { value: 'keep_new', label: 'Neuen übernehmen' },
                        ].map(opt => (
                          <div key={opt.value} className="flex items-center gap-1.5">
                            <RadioGroupItem value={opt.value} id={`${dup.reviewEntry._id}-${opt.value}`} />
                            <Label htmlFor={`${dup.reviewEntry._id}-${opt.value}`} className="text-xs cursor-pointer">
                              {opt.label}
                            </Label>
                          </div>
                        ))}
                      </RadioGroup>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {importError && (
        <Alert variant="destructive">
          <AlertDescription>{importError}</AlertDescription>
        </Alert>
      )}
    </div>
  )
}

// ─── Step 4: Done ─────────────────────────────────────────────────────────────

function Step4Done({ result }: { result: { imported: number; updated: number; skipped: number } }) {
  return (
    <div className="flex flex-col items-center justify-center h-48 gap-4 text-center">
      <div className="flex h-12 w-12 items-center justify-center rounded-full bg-green-100">
        <svg className="h-6 w-6 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
        </svg>
      </div>
      <div className="space-y-1">
        <p className="font-semibold text-lg">Import abgeschlossen</p>
        <p className="text-sm text-muted-foreground">
          {result.imported} importiert
          {result.updated > 0 && `, ${result.updated} aktualisiert`}
          {result.skipped > 0 && `, ${result.skipped} übersprungen`}
        </p>
      </div>
    </div>
  )
}
