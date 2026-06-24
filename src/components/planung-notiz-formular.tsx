'use client'

import { useState, useEffect } from 'react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Textarea } from '@/components/ui/textarea'
import { Button } from '@/components/ui/button'

interface PlanungNotizFormularProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  cellLabel: string
  currentNotiz: string | null
  onSave: (text: string) => void
  onDelete: () => void
}

export function PlanungNotizFormular({
  open,
  onOpenChange,
  cellLabel,
  currentNotiz,
  onSave,
  onDelete,
}: PlanungNotizFormularProps) {
  const [text, setText] = useState(currentNotiz ?? '')
  const [confirmDelete, setConfirmDelete] = useState(false)

  useEffect(() => {
    if (open) {
      setText(currentNotiz ?? '')
      setConfirmDelete(false)
    }
  }, [open, currentNotiz])

  function handleSave() {
    onSave(text)
    onOpenChange(false)
  }

  function handleDelete() {
    if (!confirmDelete) { setConfirmDelete(true); return }
    onDelete()
    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md" data-betrag-selektion="true">
        <DialogHeader>
          <DialogTitle className="text-sm font-medium leading-snug">
            {currentNotiz ? 'Notiz bearbeiten' : 'Notiz hinzufügen'}
            <span className="block text-xs font-normal text-muted-foreground mt-0.5">
              {cellLabel}
            </span>
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <Textarea
            value={text}
            onChange={e => setText(e.target.value)}
            placeholder="Notiz eingeben…"
            rows={4}
            className="resize-none"
            autoFocus
            onKeyDown={e => {
              if (e.key === 'Escape') onOpenChange(false)
            }}
          />

          <div className="flex items-center justify-between gap-2">
            <div>
              {currentNotiz && (
                confirmDelete ? (
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-destructive">Wirklich löschen?</span>
                    <Button
                      variant="destructive"
                      size="sm"
                      onClick={handleDelete}
                    >
                      Ja, löschen
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setConfirmDelete(false)}
                    >
                      Abbrechen
                    </Button>
                  </div>
                ) : (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-destructive hover:text-destructive hover:bg-destructive/10"
                    onClick={handleDelete}
                  >
                    Notiz löschen
                  </Button>
                )
              )}
            </div>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={() => onOpenChange(false)}>
                Abbrechen
              </Button>
              <Button size="sm" onClick={handleSave}>
                Speichern
              </Button>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
