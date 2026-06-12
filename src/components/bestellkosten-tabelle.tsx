'use client'

import { useState, useMemo } from 'react'
import { Plus, X, CalendarIcon, Pencil, Trash2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Separator } from '@/components/ui/separator'
import {
  Table, TableBody, TableCell, TableFooter, TableHead, TableHeader, TableRow,
} from '@/components/ui/table'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Calendar } from '@/components/ui/calendar'
import {
  Tooltip, TooltipContent, TooltipProvider, TooltipTrigger,
} from '@/components/ui/tooltip'
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { useToast } from '@/hooks/use-toast'
import { useBestellungKosten } from '@/hooks/use-bestellung-kosten'
import type { BestellungKosten } from '@/hooks/use-bestellung-kosten'
import { useKpiCategories } from '@/hooks/use-kpi-categories'

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmtDate(d: string): string {
  const [y, m, day] = d.split('-')
  return `${day}.${m}.${y}`
}

function fmtCurrency(n: number): string {
  return new Intl.NumberFormat('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n) + ' €'
}

// ─── Inline DatePicker ────────────────────────────────────────────────────────

function InlineDatePicker({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const [open, setOpen] = useState(false)
  const date = value ? new Date(value + 'T12:00:00') : undefined

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="outline" size="sm" className="h-7 w-full justify-start px-2 text-xs font-normal">
          <CalendarIcon className="mr-1 h-3 w-3 opacity-50 shrink-0" />
          {date ? fmtDate(value) : <span className="text-muted-foreground">Datum…</span>}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0" align="start">
        <Calendar
          mode="single"
          selected={date}
          onSelect={d => {
            if (d) {
              const pad = (n: number) => String(n).padStart(2, '0')
              onChange(`${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`)
            }
            setOpen(false)
          }}
        />
      </PopoverContent>
    </Popover>
  )
}

// ─── ModusBadge ───────────────────────────────────────────────────────────────

function ModusBadge({
  istAutomatisch, disabled, toggling, onClick,
}: {
  istAutomatisch: boolean
  disabled: boolean
  toggling: boolean
  onClick: () => void
}) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          onClick={onClick}
          disabled={disabled || toggling}
          className={cn(
            'text-[10px] px-1.5 py-0.5 rounded-full font-medium whitespace-nowrap transition-colors',
            istAutomatisch
              ? 'bg-sky-100 text-sky-700 hover:bg-amber-100 hover:text-amber-700'
              : 'bg-amber-100 text-amber-700 hover:bg-sky-100 hover:text-sky-700',
            (disabled || toggling) && 'pointer-events-none opacity-50',
          )}
        >
          {istAutomatisch ? 'Auto' : 'Manuell'}
        </button>
      </TooltipTrigger>
      <TooltipContent side="right" className="text-xs">
        {istAutomatisch
          ? 'Automatisch — klicken um auf manuell umzustellen'
          : 'Manuell — klicken um zurück auf automatisch zu setzen'}
      </TooltipContent>
    </Tooltip>
  )
}

// ─── Form State ───────────────────────────────────────────────────────────────

type FormState = { datum: string; kategorieId: string; betrag: string; begruendung: string }

const emptyForm = (): FormState => ({ datum: '', kategorieId: '', betrag: '', begruendung: '' })

function toFormState(k: BestellungKosten): FormState {
  return {
    datum: k.datum,
    kategorieId: k.kpi_kategorie_id ?? '',
    betrag: k.nettobetrag.toString(),
    begruendung: k.begruendung ?? '',
  }
}

// ─── Main Component ───────────────────────────────────────────────────────────

interface Props {
  bestellungId: string
  readOnly: boolean
}

export function BestellkostenTabelle({ bestellungId, readOnly }: Props) {
  const { toast } = useToast()
  const { kosten, loading, error, add, update, remove } = useBestellungKosten(bestellungId)
  const { categories } = useKpiCategories('ausgaben_kosten')

  const produktKinder = useMemo(() => {
    const produkt = categories.find(c => c.parent_id === null && c.name.toLowerCase().trim() === 'produkt')
    if (!produkt) return []
    return categories
      .filter(c => c.parent_id === produkt.id)
      .sort((a, b) => a.sort_order - b.sort_order)
  }, [categories])

  const [adding, setAdding] = useState(false)
  const [newForm, setNewForm] = useState<FormState>(emptyForm())
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editForm, setEditForm] = useState<FormState>(emptyForm())
  const [deleteId, setDeleteId] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [togglingId, setTogglingId] = useState<string | null>(null)

  const isFormBusy = adding || editingId !== null

  // ─── Add handlers ───────────────────────────────────────────────────────────

  function startAdd() {
    setNewForm(emptyForm())
    setAdding(true)
  }

  function cancelAdd() {
    setAdding(false)
    setNewForm(emptyForm())
  }

  function validateForm(form: FormState): number | null {
    if (!form.datum) { toast({ title: 'Datum fehlt', variant: 'destructive' }); return null }
    if (!form.kategorieId) { toast({ title: 'Kategorie fehlt', variant: 'destructive' }); return null }
    if (!form.betrag) { toast({ title: 'Nettobetrag fehlt', variant: 'destructive' }); return null }
    const betrag = parseFloat(form.betrag.replace(',', '.'))
    if (isNaN(betrag) || betrag < 0) { toast({ title: 'Ungültiger Betrag', variant: 'destructive' }); return null }
    return betrag
  }

  async function submitAdd() {
    const betrag = validateForm(newForm)
    if (betrag === null) return
    setSaving(true)
    try {
      await add({
        kpi_kategorie_id: newForm.kategorieId || null,
        datum: newForm.datum,
        nettobetrag: betrag,
        begruendung: newForm.begruendung || null,
      })
      cancelAdd()
    } catch {
      toast({ title: 'Fehler beim Speichern', variant: 'destructive' })
    } finally {
      setSaving(false)
    }
  }

  // ─── Edit handlers ──────────────────────────────────────────────────────────

  function startEdit(k: BestellungKosten) {
    setEditingId(k.id)
    setEditForm(toFormState(k))
  }

  function cancelEdit() {
    setEditingId(null)
    setEditForm(emptyForm())
  }

  async function submitEdit() {
    if (!editingId) return
    const betrag = validateForm(editForm)
    if (betrag === null) return
    setSaving(true)
    try {
      await update(editingId, {
        kpi_kategorie_id: editForm.kategorieId || null,
        datum: editForm.datum,
        nettobetrag: betrag,
        begruendung: editForm.begruendung || null,
      })
      cancelEdit()
    } catch {
      toast({ title: 'Fehler beim Speichern', variant: 'destructive' })
    } finally {
      setSaving(false)
    }
  }

  // ─── Delete handlers ─────────────────────────────────────────────────────────

  async function executeDelete() {
    if (!deleteId) return
    setSaving(true)
    try {
      await remove(deleteId)
      setDeleteId(null)
    } catch {
      toast({ title: 'Fehler beim Löschen', variant: 'destructive' })
    } finally {
      setSaving(false)
    }
  }

  // ─── Toggle handler ──────────────────────────────────────────────────────────

  async function toggleModus(k: BestellungKosten) {
    if (readOnly || togglingId) return
    setTogglingId(k.id)
    try {
      await update(k.id, { ist_automatisch: !k.ist_automatisch })
    } catch {
      toast({ title: 'Fehler beim Umschalten', variant: 'destructive' })
    } finally {
      setTogglingId(null)
    }
  }

  const gesamtbetrag = kosten.reduce((s, k) => s + k.nettobetrag, 0)
  const canAdd = produktKinder.length > 0

  return (
    <TooltipProvider>
      <>
        <Separator />
        <div>
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-2">Bestellkosten</p>

          {loading && (
            <p className="text-xs text-muted-foreground">Lade…</p>
          )}
          {error && (
            <p className="text-xs text-destructive">{error}</p>
          )}

          {!loading && !error && (
            <div className="rounded-md border overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="h-8">
                    <TableHead className="w-[72px] text-xs py-1.5">Modus</TableHead>
                    <TableHead className="w-[110px] text-xs py-1.5">Datum</TableHead>
                    <TableHead className="w-[140px] text-xs py-1.5">Kategorie</TableHead>
                    <TableHead className="w-[120px] text-xs py-1.5 text-right">Nettobetrag</TableHead>
                    <TableHead className="text-xs py-1.5">Begründung</TableHead>
                  </TableRow>
                </TableHeader>

                <TableBody>
                  {kosten.length === 0 && !adding && (
                    <TableRow>
                      <TableCell colSpan={5} className="text-center text-xs text-muted-foreground py-4">
                        Keine Bestellkosten vorhanden
                      </TableCell>
                    </TableRow>
                  )}

                  {kosten.map(k => {
                    if (!readOnly && editingId === k.id) {
                      return (
                        <TableRow key={k.id} className="bg-muted/30">
                          <TableCell className="py-1">
                            <span className="text-[10px] px-1.5 py-0.5 rounded-full font-medium bg-amber-100 text-amber-700">
                              Manuell
                            </span>
                          </TableCell>
                          <TableCell className="py-1">
                            <InlineDatePicker
                              value={editForm.datum}
                              onChange={v => setEditForm(f => ({ ...f, datum: v }))}
                            />
                          </TableCell>
                          <TableCell className="py-1">
                            <Select
                              value={editForm.kategorieId}
                              onValueChange={v => setEditForm(f => ({ ...f, kategorieId: v }))}
                            >
                              <SelectTrigger className="h-7 text-xs">
                                <SelectValue placeholder="Kategorie…" />
                              </SelectTrigger>
                              <SelectContent>
                                {produktKinder.map(cat => (
                                  <SelectItem key={cat.id} value={cat.id}>{cat.name}</SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </TableCell>
                          <TableCell className="py-1">
                            <Input
                              type="number"
                              min="0"
                              step="0.01"
                              className="h-7 text-xs text-right"
                              placeholder="0.00"
                              value={editForm.betrag}
                              onChange={e => setEditForm(f => ({ ...f, betrag: e.target.value }))}
                            />
                          </TableCell>
                          <TableCell className="py-1">
                            <div className="flex gap-1">
                              <Input
                                className="h-7 text-xs flex-1"
                                placeholder="Begründung (optional)"
                                value={editForm.begruendung}
                                onChange={e => setEditForm(f => ({ ...f, begruendung: e.target.value }))}
                              />
                              <Button
                                size="sm"
                                variant="default"
                                className="h-7 px-2 text-xs shrink-0"
                                onClick={submitEdit}
                                disabled={saving}
                              >
                                ✓
                              </Button>
                              <Button
                                size="icon"
                                variant="ghost"
                                className="h-7 w-7 shrink-0"
                                onClick={cancelEdit}
                                disabled={saving}
                              >
                                <X className="h-3 w-3" />
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      )
                    }

                    return (
                      <TableRow key={k.id} className="h-8 group">
                        <TableCell className="py-1">
                          {!readOnly ? (
                            <ModusBadge
                              istAutomatisch={k.ist_automatisch}
                              disabled={readOnly || isFormBusy}
                              toggling={togglingId === k.id}
                              onClick={() => toggleModus(k)}
                            />
                          ) : (
                            <span className={cn(
                              'text-[10px] px-1.5 py-0.5 rounded-full font-medium',
                              k.ist_automatisch ? 'bg-sky-100 text-sky-700' : 'bg-amber-100 text-amber-700',
                            )}>
                              {k.ist_automatisch ? 'Auto' : 'Manuell'}
                            </span>
                          )}
                        </TableCell>
                        <TableCell className="text-xs py-1">{fmtDate(k.datum)}</TableCell>
                        <TableCell className="text-xs py-1">{k.kpi_kategorie_name ?? '—'}</TableCell>
                        <TableCell className="text-xs py-1 text-right tabular-nums">{fmtCurrency(k.nettobetrag)}</TableCell>
                        <TableCell className="text-xs py-1 text-muted-foreground relative">
                          <span className={cn(!readOnly && !k.ist_automatisch && 'pr-14')}>{k.begruendung || '—'}</span>
                          {!readOnly && !k.ist_automatisch && (
                            <div className={cn(
                              'absolute right-1 inset-y-0 flex items-center gap-0.5',
                              'opacity-0 group-hover:opacity-100 transition-opacity',
                              isFormBusy && 'pointer-events-none',
                            )}>
                              <Button
                                size="icon"
                                variant="ghost"
                                className="h-6 w-6 text-muted-foreground hover:text-foreground"
                                onClick={() => startEdit(k)}
                                disabled={isFormBusy}
                              >
                                <Pencil className="h-3 w-3" />
                              </Button>
                              <Button
                                size="icon"
                                variant="ghost"
                                className="h-6 w-6 text-muted-foreground hover:text-destructive"
                                onClick={() => setDeleteId(k.id)}
                                disabled={isFormBusy}
                              >
                                <Trash2 className="h-3 w-3" />
                              </Button>
                            </div>
                          )}
                        </TableCell>
                      </TableRow>
                    )
                  })}

                  {adding && (
                    <TableRow className="bg-muted/30">
                      <TableCell className="py-1">
                        <span className="text-[10px] px-1.5 py-0.5 rounded-full font-medium bg-amber-100 text-amber-700">
                          Manuell
                        </span>
                      </TableCell>
                      <TableCell className="py-1">
                        <InlineDatePicker
                          value={newForm.datum}
                          onChange={v => setNewForm(f => ({ ...f, datum: v }))}
                        />
                      </TableCell>
                      <TableCell className="py-1">
                        <Select
                          value={newForm.kategorieId}
                          onValueChange={v => setNewForm(f => ({ ...f, kategorieId: v }))}
                        >
                          <SelectTrigger className="h-7 text-xs">
                            <SelectValue placeholder="Kategorie…" />
                          </SelectTrigger>
                          <SelectContent>
                            {produktKinder.map(cat => (
                              <SelectItem key={cat.id} value={cat.id}>{cat.name}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </TableCell>
                      <TableCell className="py-1">
                        <Input
                          type="number"
                          min="0"
                          step="0.01"
                          className="h-7 text-xs text-right"
                          placeholder="0.00"
                          value={newForm.betrag}
                          onChange={e => setNewForm(f => ({ ...f, betrag: e.target.value }))}
                        />
                      </TableCell>
                      <TableCell className="py-1">
                        <div className="flex gap-1">
                          <Input
                            className="h-7 text-xs flex-1"
                            placeholder="Begründung (optional)"
                            value={newForm.begruendung}
                            onChange={e => setNewForm(f => ({ ...f, begruendung: e.target.value }))}
                          />
                          <Button
                            size="sm"
                            variant="default"
                            className="h-7 px-2 text-xs shrink-0"
                            onClick={submitAdd}
                            disabled={saving}
                          >
                            +
                          </Button>
                          <Button
                            size="icon"
                            variant="ghost"
                            className="h-7 w-7 shrink-0"
                            onClick={cancelAdd}
                            disabled={saving}
                          >
                            <X className="h-3 w-3" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>

                {kosten.length > 0 && (
                  <TableFooter>
                    <TableRow className="h-8">
                      <TableCell colSpan={3} className="text-xs font-medium py-1">Gesamt</TableCell>
                      <TableCell className="text-xs py-1 text-right font-semibold tabular-nums">
                        {fmtCurrency(gesamtbetrag)}
                      </TableCell>
                      <TableCell className="py-1" />
                    </TableRow>
                  </TableFooter>
                )}
              </Table>
            </div>
          )}

          {!readOnly && !loading && !error && (
            <div className="mt-1.5">
              {canAdd ? (
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 text-xs text-muted-foreground hover:text-foreground px-1"
                  onClick={startAdd}
                  disabled={isFormBusy}
                >
                  <Plus className="h-3 w-3 mr-1" />
                  Eintrag hinzufügen
                </Button>
              ) : (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <span className="inline-block cursor-not-allowed">
                      <Button variant="ghost" size="sm" className="h-7 text-xs text-muted-foreground px-1 pointer-events-none" disabled>
                        <Plus className="h-3 w-3 mr-1" />
                        Eintrag hinzufügen
                      </Button>
                    </span>
                  </TooltipTrigger>
                  <TooltipContent>
                    Keine Kostenkategorien vorhanden. Bitte Unterkategorien unter &quot;Produkt&quot; im KPI-Modell anlegen.
                  </TooltipContent>
                </Tooltip>
              )}
            </div>
          )}
        </div>

        <AlertDialog open={deleteId !== null} onOpenChange={open => { if (!open) setDeleteId(null) }}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Eintrag löschen?</AlertDialogTitle>
              <AlertDialogDescription>
                Dieser manuelle Kosteneintrag wird unwiderruflich gelöscht.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel disabled={saving}>Abbrechen</AlertDialogCancel>
              <AlertDialogAction
                onClick={executeDelete}
                disabled={saving}
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              >
                Löschen
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </>
    </TooltipProvider>
  )
}
