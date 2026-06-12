'use client'

import { useState, useMemo } from 'react'
import { Pencil, Trash2, Plus, X, CalendarIcon } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Separator } from '@/components/ui/separator'
import {
  Table, TableBody, TableCell, TableFooter, TableHead, TableHeader, TableRow,
} from '@/components/ui/table'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Calendar } from '@/components/ui/calendar'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
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

// ─── Form State ───────────────────────────────────────────────────────────────

type FormState = { datum: string; kategorieId: string; betrag: string; begruendung: string }

const emptyForm = (): FormState => ({ datum: '', kategorieId: '', betrag: '', begruendung: '' })

function toFormState(k: BestellungKosten): FormState {
  return {
    datum: k.datum,
    kategorieId: k.kpi_kategorie_id ?? '',
    betrag: String(k.nettobetrag),
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

  const isFormBusy = adding || editingId !== null

  function startAdd() {
    setEditingId(null)
    setEditForm(emptyForm())
    setNewForm(emptyForm())
    setAdding(true)
  }

  function cancelAdd() {
    setAdding(false)
    setNewForm(emptyForm())
  }

  function startEdit(k: BestellungKosten) {
    setAdding(false)
    setNewForm(emptyForm())
    setEditingId(k.id)
    setEditForm(toFormState(k))
  }

  function cancelEdit() {
    setEditingId(null)
    setEditForm(emptyForm())
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

  async function submitEdit() {
    const betrag = validateForm(editForm)
    if (betrag === null || !editingId) return
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

  const gesamtbetrag = kosten.reduce((s, k) => s + k.nettobetrag, 0)
  const colCount = readOnly ? 4 : 5
  const canAdd = produktKinder.length > 0

  return (
    <>
      <Separator />
      <div>
        <p className="text-sm font-medium mb-3">Bestellkosten</p>

        {loading && (
          <p className="text-sm text-muted-foreground">Lade Bestellkosten…</p>
        )}
        {error && (
          <p className="text-sm text-destructive">{error}</p>
        )}

        {!loading && !error && (
          <div className="rounded-md border overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[130px]">Datum</TableHead>
                  <TableHead className="w-[150px]">Kategorie</TableHead>
                  <TableHead className="w-[130px] text-right">Nettobetrag</TableHead>
                  <TableHead>Begründung</TableHead>
                  {!readOnly && <TableHead className="w-[72px]" />}
                </TableRow>
              </TableHeader>

              <TableBody>
                {kosten.length === 0 && !adding && (
                  <TableRow>
                    <TableCell colSpan={colCount} className="text-center text-sm text-muted-foreground py-6">
                      Keine Bestellkosten vorhanden
                    </TableCell>
                  </TableRow>
                )}

                {kosten.map(k =>
                  editingId === k.id ? (
                    <TableRow key={k.id} className="bg-muted/30">
                      <TableCell>
                        <InlineDatePicker
                          value={editForm.datum}
                          onChange={v => setEditForm(f => ({ ...f, datum: v }))}
                        />
                      </TableCell>
                      <TableCell>
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
                      <TableCell>
                        <Input
                          type="number"
                          min="0"
                          step="0.01"
                          className="h-7 text-xs text-right"
                          value={editForm.betrag}
                          onChange={e => setEditForm(f => ({ ...f, betrag: e.target.value }))}
                        />
                      </TableCell>
                      <TableCell>
                        <Input
                          className="h-7 text-xs"
                          placeholder="Begründung (optional)"
                          value={editForm.begruendung}
                          onChange={e => setEditForm(f => ({ ...f, begruendung: e.target.value }))}
                        />
                      </TableCell>
                      <TableCell>
                        <div className="flex gap-0.5">
                          <Button
                            size="sm"
                            variant="default"
                            className="h-6 w-6 p-0 text-xs"
                            onClick={submitEdit}
                            disabled={saving}
                          >
                            ✓
                          </Button>
                          <Button
                            size="icon"
                            variant="ghost"
                            className="h-6 w-6"
                            onClick={cancelEdit}
                            disabled={saving}
                          >
                            <X className="h-3 w-3" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ) : (
                    <TableRow key={k.id}>
                      <TableCell className="text-sm">{fmtDate(k.datum)}</TableCell>
                      <TableCell className="text-sm">{k.kpi_kategorie_name ?? '—'}</TableCell>
                      <TableCell className="text-sm text-right tabular-nums">{fmtCurrency(k.nettobetrag)}</TableCell>
                      <TableCell className="text-sm text-muted-foreground">{k.begruendung || '—'}</TableCell>
                      {!readOnly && (
                        <TableCell>
                          <div className="flex gap-0.5">
                            <Button
                              size="icon"
                              variant="ghost"
                              className="h-6 w-6"
                              onClick={() => startEdit(k)}
                              disabled={isFormBusy}
                            >
                              <Pencil className="h-3 w-3" />
                            </Button>
                            <Button
                              size="icon"
                              variant="ghost"
                              className="h-6 w-6 text-destructive hover:text-destructive hover:bg-destructive/10"
                              onClick={() => setDeleteId(k.id)}
                              disabled={isFormBusy}
                            >
                              <Trash2 className="h-3 w-3" />
                            </Button>
                          </div>
                        </TableCell>
                      )}
                    </TableRow>
                  )
                )}

                {adding && (
                  <TableRow className="bg-muted/30">
                    <TableCell>
                      <InlineDatePicker
                        value={newForm.datum}
                        onChange={v => setNewForm(f => ({ ...f, datum: v }))}
                      />
                    </TableCell>
                    <TableCell>
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
                    <TableCell>
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
                    <TableCell>
                      <Input
                        className="h-7 text-xs"
                        placeholder="Begründung (optional)"
                        value={newForm.begruendung}
                        onChange={e => setNewForm(f => ({ ...f, begruendung: e.target.value }))}
                      />
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-0.5">
                        <Button
                          size="sm"
                          variant="default"
                          className="h-6 px-2 text-xs"
                          onClick={submitAdd}
                          disabled={saving}
                        >
                          +
                        </Button>
                        <Button
                          size="icon"
                          variant="ghost"
                          className="h-6 w-6"
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
                  <TableRow>
                    <TableCell colSpan={2} className="text-sm font-medium">Gesamt</TableCell>
                    <TableCell className="text-sm text-right font-semibold tabular-nums">
                      {fmtCurrency(gesamtbetrag)}
                    </TableCell>
                    <TableCell colSpan={readOnly ? 1 : 2} />
                  </TableRow>
                </TableFooter>
              )}
            </Table>
          </div>
        )}

        {!readOnly && !loading && !error && (
          <div className="mt-2">
            {canAdd ? (
              <Button
                variant="outline"
                size="sm"
                className="text-xs"
                onClick={startAdd}
                disabled={isFormBusy}
              >
                <Plus className="h-3 w-3 mr-1.5" />
                Kosteneintrag hinzufügen
              </Button>
            ) : (
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <span className="inline-block cursor-not-allowed">
                      <Button variant="outline" size="sm" className="text-xs pointer-events-none" disabled>
                        <Plus className="h-3 w-3 mr-1.5" />
                        Kosteneintrag hinzufügen
                      </Button>
                    </span>
                  </TooltipTrigger>
                  <TooltipContent>
                    Keine Kostenkategorien vorhanden. Bitte Unterkategorien unter &quot;Produkt&quot; im KPI-Modell anlegen.
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            )}
          </div>
        )}
      </div>

      <AlertDialog open={!!deleteId} onOpenChange={v => { if (!v) setDeleteId(null) }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Kosteneintrag löschen?</AlertDialogTitle>
            <AlertDialogDescription>
              Dieser Kosteneintrag wird dauerhaft gelöscht und kann nicht wiederhergestellt werden.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Abbrechen</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={executeDelete}
              disabled={saving}
            >
              {saving ? 'Löscht…' : 'Ja, löschen'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
