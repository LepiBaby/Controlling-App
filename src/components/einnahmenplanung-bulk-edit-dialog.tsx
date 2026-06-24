'use client'

import { useState } from 'react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import type { PlanungsWoche } from '@/hooks/use-einnahmenplanung'

export type EinnahmenBulkEditMethode =
  | 'pct-increase'
  | 'pct-decrease'
  | 'fixed-increase'
  | 'fixed-decrease'
  | 'weekly-pct-increase'
  | 'weekly-pct-decrease'
  | 'weekly-fixed-increase'
  | 'weekly-fixed-decrease'

const METHODE_LABELS: Record<EinnahmenBulkEditMethode, string> = {
  'pct-increase': 'Einheitlich um % erhöhen',
  'pct-decrease': 'Einheitlich um % senken',
  'fixed-increase': 'Einheitlich um Betrag erhöhen',
  'fixed-decrease': 'Einheitlich um Betrag senken',
  'weekly-pct-increase': 'Wöchentlich um % steigen (kumulativ)',
  'weekly-pct-decrease': 'Wöchentlich um % sinken (kumulativ)',
  'weekly-fixed-increase': 'Wöchentlich um Betrag steigen (kumulativ)',
  'weekly-fixed-decrease': 'Wöchentlich um Betrag sinken (kumulativ)',
}

export interface EinnahmenBulkEditCell {
  kategorieId: string
  kw: PlanungsWoche
  currentValue: number
}

interface Props {
  open: boolean
  onClose: () => void
  cells: EinnahmenBulkEditCell[]
  onApply: (results: Array<{ kategorieId: string; kw: PlanungsWoche; newValue: number }>) => void
}

function applyMethode(
  cells: EinnahmenBulkEditCell[],
  methode: EinnahmenBulkEditMethode,
  wert: number,
): Array<{ kategorieId: string; kw: PlanungsWoche; newValue: number }> {
  const sorted = [...cells].sort(
    (a, b) => a.kw.year * 100 + a.kw.week - (b.kw.year * 100 + b.kw.week),
  )

  // Group by kategorieId for progressive methods
  const groups = new Map<string, EinnahmenBulkEditCell[]>()
  for (const c of sorted) {
    if (!groups.has(c.kategorieId)) groups.set(c.kategorieId, [])
    groups.get(c.kategorieId)!.push(c)
  }

  const result: Array<{ kategorieId: string; kw: PlanungsWoche; newValue: number }> = []
  const clamp = (v: number) => Math.max(0, v)
  const round = (v: number) => Math.round(v * 100) / 100

  if (methode === 'pct-increase' || methode === 'pct-decrease') {
    const factor = methode === 'pct-increase' ? 1 + wert / 100 : 1 - wert / 100
    for (const c of cells) {
      result.push({ kategorieId: c.kategorieId, kw: c.kw, newValue: clamp(round(c.currentValue * factor)) })
    }
  } else if (methode === 'fixed-increase' || methode === 'fixed-decrease') {
    const delta = methode === 'fixed-increase' ? wert : -wert
    for (const c of cells) {
      result.push({ kategorieId: c.kategorieId, kw: c.kw, newValue: clamp(round(c.currentValue + delta)) })
    }
  } else {
    // Progressive: process group by group
    for (const groupCells of groups.values()) {
      let prev = groupCells[0].currentValue
      for (let i = 0; i < groupCells.length; i++) {
        const c = groupCells[i]
        let newVal: number
        if (i === 0) {
          newVal = prev
        } else if (methode === 'weekly-pct-increase') {
          newVal = clamp(round(prev * (1 + wert / 100)))
        } else if (methode === 'weekly-pct-decrease') {
          newVal = clamp(round(prev * (1 - wert / 100)))
        } else if (methode === 'weekly-fixed-increase') {
          newVal = clamp(round(prev + wert))
        } else {
          newVal = clamp(round(prev - wert))
        }
        result.push({ kategorieId: c.kategorieId, kw: c.kw, newValue: newVal })
        prev = newVal
      }
    }
  }

  return result
}

export function EinnahmenplanungBulkEditDialog({ open, onClose, cells, onApply }: Props) {
  const [methode, setMethode] = useState<EinnahmenBulkEditMethode>('pct-increase')
  const [wertStr, setWertStr] = useState('')
  const [fehler, setFehler] = useState<string | null>(null)

  function handleApply() {
    const wert = parseFloat(wertStr)
    if (isNaN(wert) || wert < 0) {
      setFehler('Bitte einen gültigen Wert ≥ 0 eingeben.')
      return
    }
    setFehler(null)
    onApply(applyMethode(cells, methode, wert))
    onClose()
    setWertStr('')
    setMethode('pct-increase')
  }

  function handleClose() {
    onClose()
    setWertStr('')
    setMethode('pct-increase')
    setFehler(null)
  }

  const unitLabel = methode.includes('pct') ? '%' : '€'

  return (
    <Dialog open={open} onOpenChange={v => { if (!v) handleClose() }}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>{cells.length} Felder anpassen</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="space-y-1.5">
            <Label>Methode</Label>
            <Select value={methode} onValueChange={v => setMethode(v as EinnahmenBulkEditMethode)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {(Object.entries(METHODE_LABELS) as [EinnahmenBulkEditMethode, string][]).map(
                  ([key, label]) => (
                    <SelectItem key={key} value={key}>
                      {label}
                    </SelectItem>
                  ),
                )}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label>Wert ({unitLabel})</Label>
            <Input
              type="number"
              min="0"
              step="any"
              placeholder="z. B. 10"
              value={wertStr}
              onChange={e => { setWertStr(e.target.value); setFehler(null) }}
              onKeyDown={e => { if (e.key === 'Enter') handleApply() }}
            />
            {fehler && <p className="text-xs text-destructive">{fehler}</p>}
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={handleClose}>Abbrechen</Button>
          <Button onClick={handleApply} disabled={!wertStr}>Anwenden</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
