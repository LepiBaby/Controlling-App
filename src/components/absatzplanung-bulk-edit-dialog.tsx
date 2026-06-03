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
import type { PlanungsWoche } from '@/hooks/use-absatzplanung'

export type BulkEditMethode =
  | 'pct-increase'
  | 'pct-decrease'
  | 'fixed-increase'
  | 'fixed-decrease'
  | 'weekly-pct-increase'
  | 'weekly-pct-decrease'
  | 'weekly-fixed-increase'
  | 'weekly-fixed-decrease'

const METHODE_LABELS: Record<BulkEditMethode, string> = {
  'pct-increase': 'Alle um X % erhöhen',
  'pct-decrease': 'Alle um X % senken',
  'fixed-increase': 'Alle um festen Betrag erhöhen',
  'fixed-decrease': 'Alle um festen Betrag senken',
  'weekly-pct-increase': 'Woche für Woche um X % steigen',
  'weekly-pct-decrease': 'Woche für Woche um X % sinken',
  'weekly-fixed-increase': 'Woche für Woche um festen Betrag steigen',
  'weekly-fixed-decrease': 'Woche für Woche um festen Betrag sinken',
}

export interface BulkEditCell {
  produktId: string
  plattformId: string
  kw: PlanungsWoche
  currentValue: number
  field: 'absatz' | 'vk'
}

interface Props {
  open: boolean
  onClose: () => void
  cells: BulkEditCell[] // ordered by kw
  cellType: 'absatz' | 'vk'
  onApply: (
    results: Array<{ produktId: string; plattformId: string; kw: PlanungsWoche; newValue: number }>,
  ) => void
}

function applyMethode(
  cells: BulkEditCell[],
  methode: BulkEditMethode,
  wert: number,
): Array<{ produktId: string; plattformId: string; kw: PlanungsWoche; newValue: number }> {
  // Sort cells by year+week for progressive methods
  const sorted = [...cells].sort(
    (a, b) => a.kw.year * 100 + a.kw.week - (b.kw.year * 100 + b.kw.week),
  )

  // Group by (produktId, plattformId) for progressive methods
  const groups = new Map<string, BulkEditCell[]>()
  for (const c of sorted) {
    const gk = `${c.produktId}:${c.plattformId}`
    if (!groups.has(gk)) groups.set(gk, [])
    groups.get(gk)!.push(c)
  }

  const result: Array<{
    produktId: string
    plattformId: string
    kw: PlanungsWoche
    newValue: number
  }> = []

  const clamp = (v: number) => Math.max(0, v)
  const round = (v: number) => Math.round(v * 100) / 100

  if (methode === 'pct-increase' || methode === 'pct-decrease') {
    const factor = methode === 'pct-increase' ? 1 + wert / 100 : 1 - wert / 100
    for (const c of cells) {
      result.push({
        produktId: c.produktId,
        plattformId: c.plattformId,
        kw: c.kw,
        newValue: clamp(round(c.currentValue * factor)),
      })
    }
  } else if (methode === 'fixed-increase' || methode === 'fixed-decrease') {
    const delta = methode === 'fixed-increase' ? wert : -wert
    for (const c of cells) {
      result.push({
        produktId: c.produktId,
        plattformId: c.plattformId,
        kw: c.kw,
        newValue: clamp(round(c.currentValue + delta)),
      })
    }
  } else {
    // Progressive methods: process group by group
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
        result.push({ produktId: c.produktId, plattformId: c.plattformId, kw: c.kw, newValue: newVal })
        prev = newVal
      }
    }
  }

  return result
}

export function AbsatzplanungBulkEditDialog({ open, onClose, cells, cellType, onApply }: Props) {
  const [methode, setMethode] = useState<BulkEditMethode>('pct-increase')
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
    // Reset state for next open
    setWertStr('')
    setMethode('pct-increase')
  }

  function handleClose() {
    onClose()
    setWertStr('')
    setMethode('pct-increase')
    setFehler(null)
  }

  const unitLabel = methode.includes('pct') ? '%' : (cellType === 'vk' ? '€' : 'Stk.')

  return (
    <Dialog open={open} onOpenChange={v => { if (!v) handleClose() }}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>
            {cells.length} {cellType === 'absatz' ? 'Absatz' : 'VK'}-Felder anpassen
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="space-y-1.5">
            <Label>Methode</Label>
            <Select value={methode} onValueChange={v => setMethode(v as BulkEditMethode)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {(Object.entries(METHODE_LABELS) as [BulkEditMethode, string][]).map(
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
              placeholder={`z. B. 10`}
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
