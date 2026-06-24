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
import type { PlanungsMonat } from '@/hooks/use-langfristige-absatzplanung'

// PROJ-85: Massen-Anpassung für die langfristige Marketing-Planung. Funktional wie
// der Absatzplanung-Dialog, aber auf Marketingkosten-%-Zellen — die Ergebnisse
// werden auf 0–100 % gekappt (Marketingkosten > 100 % sind nicht sinnvoll).

export type BulkEditMethode =
  | 'set-fixed'
  | 'pct-increase'
  | 'pct-decrease'
  | 'fixed-increase'
  | 'fixed-decrease'
  | 'monthly-pct-increase'
  | 'monthly-pct-decrease'
  | 'monthly-fixed-increase'
  | 'monthly-fixed-decrease'

const METHODE_LABELS: Record<BulkEditMethode, string> = {
  'set-fixed': 'Einheitlich auf Wert setzen',
  'pct-increase': 'Einheitlich um % erhöhen',
  'pct-decrease': 'Einheitlich um % senken',
  'fixed-increase': 'Einheitlich um Wert erhöhen',
  'fixed-decrease': 'Einheitlich um Wert senken',
  'monthly-pct-increase': 'Monat für Monat um % steigen (kumulativ)',
  'monthly-pct-decrease': 'Monat für Monat um % sinken (kumulativ)',
  'monthly-fixed-increase': 'Monat für Monat um Wert steigen (kumulativ)',
  'monthly-fixed-decrease': 'Monat für Monat um Wert sinken (kumulativ)',
}

export interface BulkEditCell {
  kanalId: string
  produktId: string
  monat: PlanungsMonat
  currentValue: number
}

export interface BulkEditResult {
  kanalId: string
  produktId: string
  monat: PlanungsMonat
  newValue: number
}

interface Props {
  open: boolean
  onClose: () => void
  cells: BulkEditCell[]
  onApply: (results: BulkEditResult[]) => void
}

function monatRank(m: PlanungsMonat): number {
  return m.year * 12 + m.month
}

function applyMethode(
  cells: BulkEditCell[],
  methode: BulkEditMethode,
  wert: number,
): BulkEditResult[] {
  const sorted = [...cells].sort((a, b) => monatRank(a.monat) - monatRank(b.monat))

  // Gruppierung je (Kanal, Produkt) für progressive Methoden
  const groups = new Map<string, BulkEditCell[]>()
  for (const c of sorted) {
    const gk = `${c.kanalId}:${c.produktId}`
    if (!groups.has(gk)) groups.set(gk, [])
    groups.get(gk)!.push(c)
  }

  const result: BulkEditResult[] = []
  // Marketingkosten % immer auf 0–100 kappen.
  const clamp = (v: number) => Math.min(100, Math.max(0, v))
  const round = (v: number) => Math.round(v * 100) / 100

  if (methode === 'set-fixed') {
    for (const c of cells) {
      result.push({ kanalId: c.kanalId, produktId: c.produktId, monat: c.monat, newValue: clamp(round(wert)) })
    }
  } else if (methode === 'pct-increase' || methode === 'pct-decrease') {
    const factor = methode === 'pct-increase' ? 1 + wert / 100 : 1 - wert / 100
    for (const c of cells) {
      result.push({ kanalId: c.kanalId, produktId: c.produktId, monat: c.monat, newValue: clamp(round(c.currentValue * factor)) })
    }
  } else if (methode === 'fixed-increase' || methode === 'fixed-decrease') {
    const delta = methode === 'fixed-increase' ? wert : -wert
    for (const c of cells) {
      result.push({ kanalId: c.kanalId, produktId: c.produktId, monat: c.monat, newValue: clamp(round(c.currentValue + delta)) })
    }
  } else {
    // Progressive Methoden: Gruppe für Gruppe
    for (const groupCells of groups.values()) {
      let prev = groupCells[0].currentValue
      for (let i = 0; i < groupCells.length; i++) {
        const c = groupCells[i]
        let newVal: number
        if (i === 0) {
          newVal = clamp(round(prev))
        } else if (methode === 'monthly-pct-increase') {
          newVal = clamp(round(prev * (1 + wert / 100)))
        } else if (methode === 'monthly-pct-decrease') {
          newVal = clamp(round(prev * (1 - wert / 100)))
        } else if (methode === 'monthly-fixed-increase') {
          newVal = clamp(round(prev + wert))
        } else {
          newVal = clamp(round(prev - wert))
        }
        result.push({ kanalId: c.kanalId, produktId: c.produktId, monat: c.monat, newValue: newVal })
        prev = newVal
      }
    }
  }

  return result
}

export function LangfristigeMarketingplanungBulkEditDialog({ open, onClose, cells, onApply }: Props) {
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
    setWertStr('')
    setMethode('pct-increase')
  }

  function handleClose() {
    onClose()
    setWertStr('')
    setMethode('pct-increase')
    setFehler(null)
  }

  // "set-fixed" und die festen Methoden arbeiten in Prozentpunkten, die %-Methoden in %.
  const unitLabel = methode.includes('pct') ? '%' : '%-Punkte'

  return (
    <Dialog open={open} onOpenChange={v => { if (!v) handleClose() }}>
      <DialogContent className="max-w-sm" data-betrag-selektion="true">
        <DialogHeader>
          <DialogTitle>{cells.length} Marketingkosten-%-Felder anpassen</DialogTitle>
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
              placeholder="z. B. 10"
              value={wertStr}
              onChange={e => {
                setWertStr(e.target.value)
                setFehler(null)
              }}
              onKeyDown={e => { if (e.key === 'Enter') handleApply() }}
            />
            {fehler && <p className="text-xs text-destructive">{fehler}</p>}
            <p className="text-xs text-muted-foreground">Ergebnisse werden auf 0–100 % begrenzt.</p>
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
