'use client'

import { useState, useEffect } from 'react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'

interface Produkt {
  id: string
  name: string
}

interface Props {
  open: boolean
  onOpenChange: (open: boolean) => void
  produkte: Produkt[]
  onConfirm: (selectedProduktIds: string[]) => void
  isLoading?: boolean
}

export function HistorischRefreshDialog({
  open,
  onOpenChange,
  produkte,
  onConfirm,
  isLoading = false,
}: Props) {
  const [selected, setSelected] = useState<Set<string>>(new Set())

  useEffect(() => {
    if (open) {
      setSelected(new Set())
    }
  }, [open])

  const allSelected = produkte.length > 0 && selected.size === produkte.length

  function toggle(id: string) {
    setSelected(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  function toggleAll() {
    if (allSelected) setSelected(new Set())
    else setSelected(new Set(produkte.map(p => p.id)))
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Historische Werte aktualisieren</DialogTitle>
        </DialogHeader>

        <p className="text-sm text-muted-foreground -mt-1">
          Für welche Produkte sollen die historischen Werte aktualisiert werden?
        </p>

        <div className="space-y-1 max-h-72 overflow-y-auto">
          <div
            className="flex items-center gap-2.5 rounded px-2 py-1.5 hover:bg-muted/50 cursor-pointer select-none border-b pb-2 mb-1"
            onClick={toggleAll}
          >
            <Checkbox
              checked={allSelected}
              tabIndex={-1}
              style={{ pointerEvents: 'none' }}
            />
            <span className="text-sm font-medium">Alle auswählen</span>
          </div>

          {produkte.map(p => (
            <div
              key={p.id}
              className="flex items-center gap-2.5 rounded px-2 py-1.5 hover:bg-muted/50 cursor-pointer select-none"
              onClick={() => toggle(p.id)}
            >
              <Checkbox
                checked={selected.has(p.id)}
                tabIndex={-1}
                style={{ pointerEvents: 'none' }}
              />
              <span className="text-sm">{p.name}</span>
            </div>
          ))}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isLoading}>
            Abbrechen
          </Button>
          <Button
            onClick={() => onConfirm(Array.from(selected))}
            disabled={isLoading || selected.size === 0}
          >
            {isLoading ? 'Wird aktualisiert…' : 'Aktualisieren'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
