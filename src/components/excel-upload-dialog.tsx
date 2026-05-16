'use client'

import { useRef, useState, useCallback } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { parseGetMyInvoicesExcel, ParseResult } from '@/lib/excel-parser'

interface ExcelUploadDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onParsed: (result: ParseResult) => void
}

export function ExcelUploadDialog({ open, onOpenChange, onParsed }: ExcelUploadDialogProps) {
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [dragging, setDragging] = useState(false)
  const [processing, setProcessing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [fileName, setFileName] = useState<string | null>(null)

  const reset = () => {
    setDragging(false)
    setProcessing(false)
    setError(null)
    setFileName(null)
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  const handleOpenChange = (val: boolean) => {
    if (!val) reset()
    onOpenChange(val)
  }

  const processFile = useCallback(async (file: File) => {
    if (!file.name.endsWith('.xlsx')) {
      setError('Bitte eine .xlsx-Datei hochladen (GetMyInvoices-Export).')
      return
    }
    setFileName(file.name)
    setError(null)
    setProcessing(true)
    try {
      const buffer = await file.arrayBuffer()
      const result = parseGetMyInvoicesExcel(buffer)
      if (result.rows.length === 0) {
        setError('Die Datei enthält keine verarbeitbaren Transaktionen.')
        setProcessing(false)
        return
      }
      onParsed(result)
      handleOpenChange(false)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Fehler beim Verarbeiten der Datei.')
      setProcessing(false)
    }
  }, [onParsed]) // eslint-disable-line react-hooks/exhaustive-deps

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

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault()
    setDragging(true)
  }

  const handleDragLeave = () => setDragging(false)

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Excel-Datei importieren</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <p className="text-sm text-muted-foreground">
            Lade eine aus GetMyInvoices exportierte <strong>.xlsx</strong>-Datei hoch.
          </p>

          {/* Drop zone */}
          <div
            onDrop={handleDrop}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onClick={() => !processing && fileInputRef.current?.click()}
            className={[
              'flex flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed px-6 py-10 text-center transition-colors',
              processing
                ? 'cursor-default border-muted bg-muted/20'
                : 'cursor-pointer hover:border-primary hover:bg-muted/30',
              dragging ? 'border-primary bg-muted/30' : 'border-muted-foreground/30',
            ].join(' ')}
          >
            {processing ? (
              <>
                <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
                <p className="text-sm text-muted-foreground">Datei wird verarbeitet…</p>
                {fileName && <p className="text-xs text-muted-foreground">{fileName}</p>}
              </>
            ) : (
              <>
                <svg className="h-8 w-8 text-muted-foreground" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                    d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                </svg>
                <p className="text-sm font-medium">
                  {dragging ? 'Datei loslassen…' : 'Datei hier ablegen'}
                </p>
                <p className="text-xs text-muted-foreground">
                  oder klicken um Datei auszuwählen
                </p>
              </>
            )}
          </div>

          <input
            ref={fileInputRef}
            type="file"
            accept=".xlsx"
            className="hidden"
            onChange={handleFileInput}
          />

          {error && (
            <Alert variant="destructive">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => handleOpenChange(false)} disabled={processing}>
            Abbrechen
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
