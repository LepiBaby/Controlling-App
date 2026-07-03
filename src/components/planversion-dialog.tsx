'use client'

import { useState, useEffect } from 'react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogFooter,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

const MAX_NAME_LENGTH = 100

interface PlanversionDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  mode: 'create' | 'rename'
  initialName?: string
  /** Soll den Namen speichern. Wirft bei Fehler (z.B. Duplikat) — message wird angezeigt. */
  onSubmit: (name: string) => Promise<void>
  /** Optionale Textüberschreibungen, damit derselbe Dialog auch für Ordner (PROJ-103) nutzbar ist. */
  texts?: {
    createTitle?: string
    renameTitle?: string
    createDescription?: string
    renameDescription?: string
    placeholder?: string
  }
}

const STANDARD_TEXTS: Required<NonNullable<PlanversionDialogProps['texts']>> = {
  createTitle: 'Neue Planversion',
  renameTitle: 'Planversion umbenennen',
  createDescription:
    'Vergib einen Namen. Die Daten der Version pflegst du anschließend in den einzelnen Seiten.',
  renameDescription: 'Ändere den Namen dieser Planversion.',
  placeholder: 'z.B. Basisszenario 2027–2030',
}

export function PlanversionDialog({
  open,
  onOpenChange,
  mode,
  initialName = '',
  onSubmit,
  texts,
}: PlanversionDialogProps) {
  const t = { ...STANDARD_TEXTS, ...texts }
  const [name, setName] = useState(initialName)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Bei jedem Öffnen Feld + Fehler zurücksetzen
  useEffect(() => {
    if (open) {
      setName(initialName)
      setError(null)
      setSaving(false)
    }
  }, [open, initialName])

  const trimmed = name.trim()
  const unveraendert = mode === 'rename' && trimmed === initialName.trim()
  const gueltig = trimmed.length >= 1 && trimmed.length <= MAX_NAME_LENGTH && !unveraendert

  async function handleSubmit() {
    if (!gueltig || saving) return
    setSaving(true)
    setError(null)
    try {
      await onSubmit(trimmed)
      onOpenChange(false)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Speichern fehlgeschlagen.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{mode === 'create' ? t.createTitle : t.renameTitle}</DialogTitle>
          <DialogDescription>
            {mode === 'create' ? t.createDescription : t.renameDescription}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-2 py-2">
          <Label htmlFor="planversion-name">Name</Label>
          <Input
            id="planversion-name"
            value={name}
            maxLength={MAX_NAME_LENGTH}
            autoFocus
            placeholder={t.placeholder}
            onChange={(e) => {
              setName(e.target.value)
              if (error) setError(null)
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault()
                handleSubmit()
              }
            }}
            aria-invalid={error ? true : undefined}
          />
          {error && <p className="text-sm text-destructive">{error}</p>}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
            Abbrechen
          </Button>
          <Button onClick={handleSubmit} disabled={!gueltig || saving}>
            {saving ? 'Speichern…' : mode === 'create' ? 'Erstellen' : 'Speichern'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
