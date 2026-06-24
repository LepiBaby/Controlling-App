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
import type { PlanungsWoche } from '@/hooks/use-marketingplanung'

export type MktBulkEditMethode =
  | 'set-fixed'
  | 'pct-increase'
  | 'pct-decrease'
  | 'fixed-increase'
  | 'fixed-decrease'
  | 'weekly-pct-increase'
  | 'weekly-pct-decrease'
  | 'weekly-fixed-increase'
  | 'weekly-fixed-decrease'

const METHODE_LABELS: Record<MktBulkEditMethode, string> = {
  'set-fixed': 'Einheitlich auf % setzen',
  'pct-increase': 'Einheitlich um % erhöhen',
  'pct-decrease': 'Einheitlich um % senken',
  'fixed-increase': 'Einheitlich um %-Punkte erhöhen',
  'fixed-decrease': 'Einheitlich um %-Punkte senken',
  'weekly-pct-increase': 'Wöchentlich um % steigen (kumulativ)',
  'weekly-pct-decrease': 'Wöchentlich um % sinken (kumulativ)',
  'weekly-fixed-increase': 'Wöchentlich um %-Punkte steigen (kumulativ)',
  'weekly-fixed-decrease': 'Wöchentlich um %-Punkte sinken (kumulativ)',
}

export interface MktBulkEditCell {
  produktId: string
  kategorieId: string
  kw: PlanungsWoche
  currentValue: number
}

export interface MktBulkEditResult {
  produktId: string
  kategorieId: string
  kw: PlanungsWoche
  newValue: number
}

interface Props {
  open: boolean
  onClose: () => void
  cells: MktBulkEditCell[]
  onApply: (results: MktBulkEditResult[]) => void
}

function clampPct(v: number): number {
  return Math.min(100, Math.max(0, v))
}

function round2(v: number): number {
  return Math.round(v * 100) / 100
}

function applyMethode(
  cells: MktBulkEditCell[],
  methode: MktBulkEditMethode,
  wert: number,
): MktBulkEditResult[] {
  const sorted = [...cells].sort(
    (a, b) => a.kw.year * 100 + a.kw.week - (b.kw.year * 100 + b.kw.week),
  )

  // Group by (produktId, kategorieId) for progressive methods
  const groups = new Map<string, MktBulkEditCell[]>()
  for (const c of sorted) {
    const gk = `${c.produktId}:${c.kategorieId}`
    if (!groups.has(gk)) groups.set(gk, [])
    groups.get(gk)!.push(c)
  }

  const result: MktBulkEditResult[] = []

  if (methode === 'set-fixed') {
    for (const c of cells) {
      result.push({ produktId: c.produktId, kategorieId: c.kategorieId, kw: c.kw, newValue: clampPct(round2(wert)) })
    }
  } else if (methode === 'pct-increase' || methode === 'pct-decrease') {
    const factor = methode === 'pct-increase' ? 1 + wert / 100 : 1 - wert / 100
    for (const c of cells) {
      result.push({ produktId: c.produktId, kategorieId: c.kategorieId, kw: c.kw, newValue: clampPct(round2(c.currentValue * factor)) })
    }
  } else if (methode === 'fixed-increase' || methode === 'fixed-decrease') {
    const delta = methode === 'fixed-increase' ? wert : -wert
    for (const c of cells) {
      result.push({ produktId: c.produktId, kategorieId: c.kategorieId, kw: c.kw, newValue: clampPct(round2(c.currentValue + delta)) })
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
          newVal = clampPct(round2(prev * (1 + wert / 100)))
        } else if (methode === 'weekly-pct-decrease') {
          newVal = clampPct(round2(prev * (1 - wert / 100)))
        } else if (methode === 'weekly-fixed-increase') {
          newVal = clampPct(round2(prev + wert))
        } else {
          newVal = clampPct(round2(prev - wert))
        }
        result.push({ produktId: c.produktId, kategorieId: c.kategorieId, kw: c.kw, newValue: newVal })
        prev = newVal
      }
    }
  }

  return result
}

export function MarketingplanungBulkEditDialog({ open, onClose, cells, onApply }: Props) {
  const [methode, setMethode] = useState<MktBulkEditMethode>('fixed-increase')
  const [wertStr, setWertStr] = useState('')
  const [fehler, setFehler] = useState<string | null>(null)

  function handleApply() {
    const wert = parseFloat(wertStr)
    if (isNaN(wert) || wert < 0) {
      setFehler('Bitte einen gültigen Wert ≥ 0 eingeben.')
      return
    }
    setFehler(null)
    const results = applyMethode(cells, methode, wert)
    onApply(results)
    onClose()
    setWertStr('')
    setMethode('fixed-increase')
  }

  function handleClose() {
    onClose()
    setWertStr('')
    setMethode('fixed-increase')
    setFehler(null)
  }

  const unitLabel = methode === 'set-fixed'
    ? '%'
    : methode.includes('pct')
    ? '%'
    : '%-Punkte'

  return (
    <Dialog open={open} onOpenChange={v => { if (!v) handleClose() }}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>{cells.length} Marketingkosten-%-Felder anpassen</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="space-y-1.5">
            <Label>Methode</Label>
            <Select value={methode} onValueChange={v => setMethode(v as MktBulkEditMethode)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {(Object.entries(METHODE_LABELS) as [MktBulkEditMethode, string][]).map(
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
              placeholder="z. B. 2.5"
              value={wertStr}
              onChange={e => {
                setWertStr(e.target.value)
                setFehler(null)
              }}
              onKeyDown={e => { if (e.key === 'Enter') handleApply() }}
            />
            {fehler && <p className="text-xs text-destructive">{fehler}</p>}
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={handleClose}>
            Abbrechen
          </Button>
          <Button onClick={handleApply} disabled={!wertStr}>
            Anwenden
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
