'use client'

import { useState, useMemo, useRef, useEffect } from 'react'
import { ChevronDown, ChevronRight, Pencil, Trash2, Check, X } from 'lucide-react'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { useKpiCategories, type KpiCategory } from '@/hooks/use-kpi-categories'
import { useLangfristigeKpiKategorien } from '@/hooks/use-langfristige-kpi-kategorien'
import {
  useProduktinformationenHersteller,
  type Hersteller,
} from '@/hooks/use-produktinformationen-hersteller'
import {
  useProduktinformationenMoq,
  type MoqEbene,
  type MoqEinstellung,
  type MoqSkuEinstellung,
} from '@/hooks/use-produktinformationen-moq'
import {
  useProduktinformationenContainer,
  berechneStueckvolumen,
  berechneMaxKapazitaet,
  type ContainerGlobal,
  type Containerkapazitaet,
} from '@/hooks/use-produktinformationen-container'
import {
  useProduktinformationenLieferzeit,
  berechneGesamtzeit,
  type Lieferzeit,
} from '@/hooks/use-produktinformationen-lieferzeit'
import {
  useProduktinformationenZahlungskonditionen,
  isProzentSummeGueltig,
  alleProzentGesetzt,
  type Zahlungskonditionen,
} from '@/hooks/use-produktinformationen-zahlungskonditionen'
import {
  useProduktinformationenProduktkosten,
  type KostenGlobal,
  type Produktkosten,
} from '@/hooks/use-produktinformationen-produktkosten'
import {
  useProduktinformationenBestandsverwaltung,
  type BestandsverwaltungEinstellung,
} from '@/hooks/use-produktinformationen-bestandsverwaltung'
import {
  useProduktinformationenAktuellerBestand,
  type AktuellerBestandEintrag,
} from '@/hooks/use-produktinformationen-aktueller-bestand'
import { useToast } from '@/hooks/use-toast'

// ─── shared helpers ──────────────────────────────────────────────────────────

// kpiHref zeigt auf die passende KPI-Modell-Seite: global (Kurzfristig) oder die
// KPI-Modell-Verwaltung der aktuellen Planversion (Langfristig, PROJ-77).
function EmptyHinweis({ kpiHref }: { kpiHref: string }) {
  return (
    <div className="py-10 text-center text-sm text-muted-foreground">
      Noch keine Produkte im KPI-Modell gepflegt.{' '}
      <a href={kpiHref} className="underline hover:text-foreground">
        Zum KPI-Modell
      </a>
    </div>
  )
}

function NumInput({
  value,
  onChange,
  onBlur,
  placeholder,
  min,
  step = 'any',
  className,
  readOnly,
}: {
  value: string
  onChange: (v: string) => void
  onBlur?: () => void
  placeholder?: string
  min?: number
  step?: string | number
  className?: string
  readOnly?: boolean
}) {
  return (
    <Input
      type="number"
      value={value}
      onChange={e => onChange(e.target.value)}
      onBlur={onBlur}
      placeholder={placeholder ?? '–'}
      min={min}
      step={step}
      className={`h-8 w-full text-right tabular-nums ${readOnly ? 'bg-muted/50 cursor-default' : ''} ${className ?? ''}`}
      readOnly={readOnly}
    />
  )
}

function ReadOnlyCell({ value, className }: { value: string | number | null; className?: string }) {
  return (
    <span className={`tabular-nums text-muted-foreground block ${className ?? 'text-right'}`}>
      {value ?? '–'}
    </span>
  )
}

// Gemeinsame Props aller Tab-Komponenten. versionId steuert die Datenquelle
// (undefined = global/Kurzfristig, gesetzt = versionsgebunden/Langfristig);
// kpiHref ist der Empty-State-Link zur passenden KPI-Modell-Seite.
interface TabProps {
  produkte: KpiCategory[]
  versionId?: string
  kpiHref: string
}

// ─── Tab 1: Hersteller ───────────────────────────────────────────────────────

function HerstellerZeile({
  produkt,
  hersteller,
  herstellerId,
  onAssign,
  onUnassign,
  onCreateAndAssign,
  onRenameHersteller,
  onDeleteHersteller,
}: {
  produkt: KpiCategory
  hersteller: Hersteller[]
  herstellerId: string | null
  onAssign: (herstellerId: string) => Promise<void>
  onUnassign: () => Promise<void>
  onCreateAndAssign: (name: string) => Promise<void>
  onRenameHersteller: (id: string, name: string) => Promise<void>
  onDeleteHersteller: (id: string) => Promise<void>
}) {
  const { toast } = useToast()
  const [open, setOpen] = useState(false)
  const [search, setSearch] = useState('')
  const [saving, setSaving] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editingName, setEditingName] = useState('')

  useEffect(() => {
    if (!open) {
      setEditingId(null)
      setEditingName('')
    }
  }, [open])

  const filtered = useMemo(
    () => hersteller.filter(h => h.name.toLowerCase().includes(search.toLowerCase())),
    [hersteller, search],
  )
  const exactMatch = useMemo(
    () => hersteller.some(h => h.name.toLowerCase() === search.trim().toLowerCase()),
    [hersteller, search],
  )
  const showCreate = search.trim().length > 0 && !exactMatch

  const selectedName = useMemo(
    () => hersteller.find(h => h.id === herstellerId)?.name ?? null,
    [hersteller, herstellerId],
  )

  async function handleSelect(id: string) {
    setOpen(false)
    setSearch('')
    setSaving(true)
    try {
      await onAssign(id)
    } catch {
      toast({ title: 'Hersteller konnte nicht zugeordnet werden.', variant: 'destructive' })
    } finally {
      setSaving(false)
    }
  }

  async function handleUnassign() {
    setOpen(false)
    setSearch('')
    setSaving(true)
    try {
      await onUnassign()
    } catch {
      toast({ title: 'Hersteller konnte nicht entfernt werden.', variant: 'destructive' })
    } finally {
      setSaving(false)
    }
  }

  async function handleCreate() {
    const name = search.trim()
    if (!name) return
    setOpen(false)
    setSearch('')
    setSaving(true)
    try {
      await onCreateAndAssign(name)
    } catch {
      toast({ title: 'Hersteller konnte nicht angelegt werden.', variant: 'destructive' })
    } finally {
      setSaving(false)
    }
  }

  async function handleRename(id: string) {
    const name = editingName.trim()
    if (!name) {
      setEditingId(null)
      setEditingName('')
      return
    }
    setSaving(true)
    try {
      await onRenameHersteller(id, name)
      setEditingId(null)
      setEditingName('')
    } catch {
      toast({ title: 'Hersteller konnte nicht umbenannt werden.', variant: 'destructive' })
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete(id: string, e: React.MouseEvent) {
    e.preventDefault()
    e.stopPropagation()
    setSaving(true)
    try {
      await onDeleteHersteller(id)
    } catch {
      toast({ title: 'Hersteller konnte nicht gelöscht werden.', variant: 'destructive' })
    } finally {
      setSaving(false)
    }
  }

  return (
    <TableRow>
      <TableCell className="font-medium">{produkt.name}</TableCell>
      <TableCell>
        <Popover open={open} onOpenChange={setOpen}>
          <PopoverTrigger asChild>
            <Button
              variant="outline"
              role="combobox"
              className="h-8 w-full max-w-xs justify-between font-normal"
              disabled={saving}
            >
              <span className="truncate">
                {saving ? 'Speichert…' : selectedName ?? 'Hersteller wählen oder anlegen'}
              </span>
              <ChevronDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-72 p-0" align="start">
            <Command shouldFilter={false}>
              <CommandInput
                placeholder="Suchen oder neu anlegen…"
                value={search}
                onValueChange={setSearch}
              />
              <CommandList>
                <CommandGroup>
                  {showCreate && (
                    <CommandItem
                      key="__create__"
                      value="__create__"
                      onSelect={handleCreate}
                      className="text-primary"
                    >
                      Neu erstellen: „{search.trim()}"
                    </CommandItem>
                  )}
                  {herstellerId !== null && search.trim().length === 0 && (
                    <CommandItem
                      key="__unassign__"
                      value="__unassign__"
                      onSelect={handleUnassign}
                      className="text-muted-foreground"
                    >
                      <X className="mr-2 h-3.5 w-3.5" />
                      Hersteller entfernen
                    </CommandItem>
                  )}
                  {filtered.map(h =>
                    editingId === h.id ? (
                      <CommandItem
                        key={h.id}
                        value={`__edit__${h.id}`}
                        onSelect={() => {}}
                        className="p-1"
                      >
                        <div
                          className="flex w-full items-center gap-1"
                          onMouseDown={e => e.stopPropagation()}
                          onClick={e => e.stopPropagation()}
                        >
                          <Input
                            value={editingName}
                            onChange={e => setEditingName(e.target.value)}
                            onKeyDown={e => {
                              if (e.key === 'Enter') handleRename(h.id)
                              if (e.key === 'Escape') { setEditingId(null); setEditingName('') }
                            }}
                            autoFocus
                            className="h-7 flex-1 text-sm"
                            onClick={e => e.stopPropagation()}
                          />
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-7 w-7 shrink-0 p-0 text-primary"
                            onMouseDown={e => e.stopPropagation()}
                            onClick={() => handleRename(h.id)}
                          >
                            <Check className="h-3.5 w-3.5" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-7 w-7 shrink-0 p-0"
                            onMouseDown={e => e.stopPropagation()}
                            onClick={() => { setEditingId(null); setEditingName('') }}
                          >
                            <X className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      </CommandItem>
                    ) : (
                      <CommandItem
                        key={h.id}
                        value={h.id}
                        onSelect={() => handleSelect(h.id)}
                        className="group flex items-center justify-between pr-1"
                      >
                        <span className="flex-1 truncate">{h.name}</span>
                        <div className="ml-2 flex shrink-0 items-center gap-0.5 opacity-0 group-hover:opacity-100">
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-6 w-6 p-0 text-muted-foreground hover:text-foreground"
                            onMouseDown={e => { e.preventDefault(); e.stopPropagation() }}
                            onClick={e => {
                              e.stopPropagation()
                              setEditingId(h.id)
                              setEditingName(h.name)
                            }}
                          >
                            <Pencil className="h-3 w-3" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-6 w-6 p-0 text-muted-foreground hover:text-destructive"
                            onMouseDown={e => { e.preventDefault(); e.stopPropagation() }}
                            onClick={e => handleDelete(h.id, e)}
                          >
                            <Trash2 className="h-3 w-3" />
                          </Button>
                        </div>
                      </CommandItem>
                    ),
                  )}
                </CommandGroup>
                {filtered.length === 0 && !showCreate && (
                  <CommandEmpty>Keine Hersteller gefunden.</CommandEmpty>
                )}
              </CommandList>
            </Command>
          </PopoverContent>
        </Popover>
      </TableCell>
    </TableRow>
  )
}

function HerstellerTab({ produkte, versionId, kpiHref }: TabProps) {
  const {
    hersteller,
    loading,
    error,
    getZuordnung,
    assignHersteller,
    createAndAssign,
    renameHersteller,
    deleteHersteller,
  } = useProduktinformationenHersteller(versionId)

  if (loading) return <p className="py-8 text-center text-sm text-muted-foreground">Lädt…</p>
  if (error) return <p className="py-8 text-center text-sm text-destructive">{error}</p>
  if (produkte.length === 0) return <EmptyHinweis kpiHref={kpiHref} />

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Produkt</TableHead>
          <TableHead>Hersteller</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {produkte.map(p => {
          const zuordnung = getZuordnung(p.id)
          return (
            <HerstellerZeile
              key={p.id}
              produkt={p}
              hersteller={hersteller}
              herstellerId={zuordnung?.hersteller_id ?? null}
              onAssign={id => assignHersteller(p.id, id)}
              onUnassign={() => assignHersteller(p.id, null)}
              onCreateAndAssign={name => createAndAssign(p.id, name)}
              onRenameHersteller={renameHersteller}
              onDeleteHersteller={deleteHersteller}
            />
          )
        })}
      </TableBody>
    </Table>
  )
}

// ─── Tab 2: MOQ ──────────────────────────────────────────────────────────────

function MoqZeile({
  produkt,
  skus,
  einstellung,
  moqSkus,
  onEbeneChange,
  onMoqChange,
  onSkuMoqChange,
}: {
  produkt: KpiCategory
  skus: KpiCategory[]
  einstellung: MoqEinstellung
  moqSkus: Record<string, MoqSkuEinstellung>
  onEbeneChange: (ebene: MoqEbene) => Promise<void>
  onMoqChange: (moq: number | null) => Promise<void>
  onSkuMoqChange: (skuId: string, moq: number | null) => Promise<void>
}) {
  const { toast } = useToast()
  const [expanded, setExpanded] = useState(false)
  const [moqStr, setMoqStr] = useState(einstellung.moq?.toString() ?? '')
  const [skuMoqStrs, setSkuMoqStrs] = useState<Record<string, string>>(
    Object.fromEntries(skus.map(s => [s.id, moqSkus[s.id]?.moq?.toString() ?? ''])),
  )
  const prevEbene = useRef(einstellung.ebene)

  if (prevEbene.current !== einstellung.ebene) {
    prevEbene.current = einstellung.ebene
    if (einstellung.ebene === 'produkt') setExpanded(false)
  }

  async function handleEbeneChange(val: string) {
    try {
      await onEbeneChange(val as MoqEbene)
    } catch {
      toast({ title: 'Ebene konnte nicht gespeichert werden.', variant: 'destructive' })
    }
  }

  async function handleMoqBlur() {
    const parsed = moqStr === '' ? null : parseInt(moqStr)
    if (parsed !== null && (isNaN(parsed) || parsed < 1)) return
    try {
      await onMoqChange(parsed)
    } catch {
      toast({ title: 'MOQ konnte nicht gespeichert werden.', variant: 'destructive' })
      setMoqStr(einstellung.moq?.toString() ?? '')
    }
  }

  async function handleSkuMoqBlur(skuId: string) {
    const str = skuMoqStrs[skuId] ?? ''
    const parsed = str === '' ? null : parseInt(str)
    if (parsed !== null && (isNaN(parsed) || parsed < 1)) return
    try {
      await onSkuMoqChange(skuId, parsed)
    } catch {
      toast({ title: 'MOQ konnte nicht gespeichert werden.', variant: 'destructive' })
      setSkuMoqStrs(prev => ({ ...prev, [skuId]: moqSkus[skuId]?.moq?.toString() ?? '' }))
    }
  }

  return (
    <>
      <TableRow>
        <TableCell className="font-medium">
          <div className="flex items-center gap-1">
            <div className="w-6 shrink-0">
              {einstellung.ebene === 'sku' && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-6 w-6 p-0 text-muted-foreground"
                  onClick={() => setExpanded(prev => !prev)}
                >
                  {expanded ? (
                    <ChevronDown className="h-4 w-4" />
                  ) : (
                    <ChevronRight className="h-4 w-4" />
                  )}
                </Button>
              )}
            </div>
            {produkt.name}
          </div>
        </TableCell>
        <TableCell>
          <RadioGroup
            value={einstellung.ebene}
            onValueChange={handleEbeneChange}
            className="flex gap-4"
          >
            <div className="flex items-center gap-1.5">
              <RadioGroupItem value="produkt" id={`ebene-produkt-${produkt.id}`} />
              <Label htmlFor={`ebene-produkt-${produkt.id}`} className="cursor-pointer font-normal">
                Produkt
              </Label>
            </div>
            <div className="flex items-center gap-1.5">
              <RadioGroupItem value="sku" id={`ebene-sku-${produkt.id}`} />
              <Label htmlFor={`ebene-sku-${produkt.id}`} className="cursor-pointer font-normal">
                SKU
              </Label>
            </div>
          </RadioGroup>
        </TableCell>
        <TableCell>
          {einstellung.ebene === 'produkt' && (
            <NumInput
              value={moqStr}
              onChange={setMoqStr}
              onBlur={handleMoqBlur}
              placeholder="MOQ"
              min={1}
              step={1}
              className="w-28"
            />
          )}
        </TableCell>
      </TableRow>
      {einstellung.ebene === 'sku' && expanded && skus.length === 0 && (
        <TableRow>
          <TableCell colSpan={3} className="py-2 pl-8 text-sm text-muted-foreground italic">
            Keine SKUs vorhanden.{' '}
            <a href="/dashboard/kpi-modell" className="underline hover:text-foreground">
              Im KPI-Modell anlegen
            </a>
          </TableCell>
        </TableRow>
      )}
      {einstellung.ebene === 'sku' && expanded && skus.map(sku => (
        <TableRow key={sku.id} className="bg-muted/20">
          <TableCell className="text-sm">
            <div className="flex items-center gap-1">
              <div className="w-6 shrink-0" />
              <span className="pl-2 text-muted-foreground">{sku.name}</span>
            </div>
          </TableCell>
          <TableCell />
          <TableCell>
            <NumInput
              value={skuMoqStrs[sku.id] ?? ''}
              onChange={v => setSkuMoqStrs(prev => ({ ...prev, [sku.id]: v }))}
              onBlur={() => handleSkuMoqBlur(sku.id)}
              placeholder="MOQ"
              min={1}
              step={1}
              className="w-28"
            />
          </TableCell>
        </TableRow>
      ))}
    </>
  )
}

// Vereinfachte MOQ-Zeile (PROJ-77): nur Produktebene, ein MOQ-Feld, keine SKUs.
function MoqSimpleZeile({
  produkt,
  einstellung,
  onMoqChange,
}: {
  produkt: KpiCategory
  einstellung: MoqEinstellung
  onMoqChange: (moq: number | null) => Promise<void>
}) {
  const { toast } = useToast()
  const [moqStr, setMoqStr] = useState(einstellung.moq?.toString() ?? '')

  async function handleBlur() {
    const parsed = moqStr === '' ? null : parseInt(moqStr)
    if (parsed !== null && (isNaN(parsed) || parsed < 1)) return
    try {
      await onMoqChange(parsed)
    } catch {
      toast({ title: 'MOQ konnte nicht gespeichert werden.', variant: 'destructive' })
      setMoqStr(einstellung.moq?.toString() ?? '')
    }
  }

  return (
    <TableRow>
      <TableCell className="font-medium">{produkt.name}</TableCell>
      <TableCell>
        <NumInput value={moqStr} onChange={setMoqStr} onBlur={handleBlur} placeholder="MOQ" min={1} step={1} className="w-28" />
      </TableCell>
    </TableRow>
  )
}

function MoqTab({
  produkte,
  skusByProdukt,
  versionId,
  kpiHref,
  simple = false,
}: TabProps & {
  skusByProdukt: Record<string, KpiCategory[]>
  simple?: boolean
}) {
  // Langfristig (simple) hat keine SKUs → SKU-Abruf überspringen.
  const { loading, error, getMoqEinstellung, getMoqSkuEinstellung, upsertMoq, upsertMoqSku } =
    useProduktinformationenMoq(versionId, !simple)

  if (loading) return <p className="py-8 text-center text-sm text-muted-foreground">Lädt…</p>
  if (error) return <p className="py-8 text-center text-sm text-destructive">{error}</p>
  if (produkte.length === 0) return <EmptyHinweis kpiHref={kpiHref} />

  if (simple) {
    return (
      <Table className="table-fixed">
        <TableHeader>
          <TableRow>
            <TableHead>Produkt</TableHead>
            <TableHead>MOQ</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {produkte.map(p => (
            <MoqSimpleZeile
              key={p.id}
              produkt={p}
              einstellung={getMoqEinstellung(p.id)}
              onMoqChange={async (moq) => {
                await upsertMoq({ produkt_id: p.id, ebene: 'produkt', moq })
              }}
            />
          ))}
        </TableBody>
      </Table>
    )
  }

  return (
    <Table className="table-fixed">
      <TableHeader>
        <TableRow>
          <TableHead>Produkt</TableHead>
          <TableHead>Ebene</TableHead>
          <TableHead>MOQ</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {produkte.map(p => {
          const einst = getMoqEinstellung(p.id)
          const skus = skusByProdukt[p.id] ?? []
          const moqSkus = Object.fromEntries(
            skus.map(s => [s.id, getMoqSkuEinstellung(s.id)]),
          )
          return (
            <MoqZeile
              key={p.id}
              produkt={p}
              skus={skus}
              einstellung={einst}
              moqSkus={moqSkus}
              onEbeneChange={async (newEbene) => {
                await upsertMoq({ produkt_id: p.id, ebene: newEbene, moq: newEbene === 'sku' ? null : einst.moq })
              }}
              onMoqChange={async (moq) => {
                await upsertMoq({ produkt_id: p.id, ebene: einst.ebene, moq })
              }}
              onSkuMoqChange={async (skuId, moq) => {
                await upsertMoqSku({ sku_id: skuId, moq })
              }}
            />
          )
        })}
      </TableBody>
    </Table>
  )
}

// ─── Tab 3: Containerkapazität ───────────────────────────────────────────────

function ContainerGlobalFormular({
  containerGlobal,
  upsertContainerGlobal,
}: {
  containerGlobal: ContainerGlobal
  upsertContainerGlobal: (patch: Partial<ContainerGlobal>) => Promise<void>
}) {
  const { toast } = useToast()
  const [v20, setV20] = useState(containerGlobal.volumen_20dc?.toString() ?? '')
  const [v40hq, setV40hq] = useState(containerGlobal.volumen_40hq?.toString() ?? '')

  async function handleBlur(field: '20dc' | '40hq', strVal: string) {
    const parsed = strVal === '' ? null : parseFloat(strVal)
    if (parsed !== null && (isNaN(parsed) || parsed < 0)) return
    try {
      await upsertContainerGlobal({ [`volumen_${field}`]: parsed })
    } catch {
      toast({ title: 'Volumen konnte nicht gespeichert werden.', variant: 'destructive' })
    }
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-sm font-medium">Container-Maximalvolumen (m³)</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="flex gap-6 flex-wrap">
          {([
            { label: '20DC', field: '20dc' as const, val: v20, set: setV20 },
            { label: '40HQ', field: '40hq' as const, val: v40hq, set: setV40hq },
          ] as const).map(({ label, field, val, set }) => (
            <div key={field} className="flex flex-col gap-1">
              <Label className="text-xs text-muted-foreground">{label}</Label>
              <NumInput
                value={val}
                onChange={set}
                onBlur={() => handleBlur(field, val)}
                placeholder="m³"
                min={0}
                step={0.0001}
                className="w-28"
              />
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  )
}

function ContainerkapazitaetZeile({
  produkt,
  kapazitaet,
  containerGlobal,
  upsertKapazitaet,
}: {
  produkt: KpiCategory
  kapazitaet: Containerkapazitaet
  containerGlobal: ContainerGlobal
  upsertKapazitaet: (patch: Omit<Containerkapazitaet, 'id'>) => Promise<void>
}) {
  const { toast } = useToast()
  const [l, setL] = useState(kapazitaet.laenge_cm?.toString() ?? '')
  const [b, setB] = useState(kapazitaet.breite_cm?.toString() ?? '')
  const [h, setH] = useState(kapazitaet.hoehe_cm?.toString() ?? '')

  const lNum = l === '' ? null : parseFloat(l)
  const bNum = b === '' ? null : parseFloat(b)
  const hNum = h === '' ? null : parseFloat(h)
  const stueck = berechneStueckvolumen(lNum, bNum, hNum)
  const max20 = berechneMaxKapazitaet(containerGlobal.volumen_20dc, stueck)
  const max40hq = berechneMaxKapazitaet(containerGlobal.volumen_40hq, stueck)

  async function handleBlur() {
    const lp = l === '' ? null : parseFloat(l)
    const bp = b === '' ? null : parseFloat(b)
    const hp = h === '' ? null : parseFloat(h)
    try {
      await upsertKapazitaet({ produkt_id: produkt.id, laenge_cm: lp, breite_cm: bp, hoehe_cm: hp })
    } catch {
      toast({ title: 'Paketmaße konnten nicht gespeichert werden.', variant: 'destructive' })
      setL(kapazitaet.laenge_cm?.toString() ?? '')
      setB(kapazitaet.breite_cm?.toString() ?? '')
      setH(kapazitaet.hoehe_cm?.toString() ?? '')
    }
  }

  return (
    <TableRow>
      <TableCell className="font-medium">{produkt.name}</TableCell>
      <TableCell><NumInput value={l} onChange={setL} onBlur={handleBlur} placeholder="cm" min={0} className="w-20" /></TableCell>
      <TableCell><NumInput value={b} onChange={setB} onBlur={handleBlur} placeholder="cm" min={0} className="w-20" /></TableCell>
      <TableCell><NumInput value={h} onChange={setH} onBlur={handleBlur} placeholder="cm" min={0} className="w-20" /></TableCell>
      <TableCell><ReadOnlyCell value={stueck != null ? (stueck / 1_000_000).toLocaleString('de-DE', { maximumFractionDigits: 6 }) : null} className="text-center" /></TableCell>
      <TableCell><ReadOnlyCell value={max20} className="text-center" /></TableCell>
      <TableCell><ReadOnlyCell value={max40hq} className="text-center" /></TableCell>
    </TableRow>
  )
}

function ContainerTab({ produkte, versionId, kpiHref }: TabProps) {
  const { containerGlobal, loading, error, getKapazitaet, upsertContainerGlobal, upsertKapazitaet } =
    useProduktinformationenContainer(versionId)

  if (loading) return <p className="py-8 text-center text-sm text-muted-foreground">Lädt…</p>
  if (error) return <p className="py-8 text-center text-sm text-destructive">{error}</p>

  return (
    <div className="space-y-6">
      <ContainerGlobalFormular
        containerGlobal={containerGlobal}
        upsertContainerGlobal={upsertContainerGlobal}
      />
      {produkte.length === 0 ? (
        <EmptyHinweis kpiHref={kpiHref} />
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Produkt</TableHead>
              <TableHead>Länge (cm)</TableHead>
              <TableHead>Breite (cm)</TableHead>
              <TableHead>Höhe (cm)</TableHead>
              <TableHead className="text-center">Stückvolumen (m³)</TableHead>
              <TableHead className="text-center">Max. 20DC</TableHead>
              <TableHead className="text-center">Max. 40HQ</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {produkte.map(p => (
              <ContainerkapazitaetZeile
                key={p.id}
                produkt={p}
                kapazitaet={getKapazitaet(p.id)}
                containerGlobal={containerGlobal}
                upsertKapazitaet={upsertKapazitaet}
              />
            ))}
          </TableBody>
        </Table>
      )}
    </div>
  )
}

// ─── Tab 4: Lieferzeit ───────────────────────────────────────────────────────

function LieferzeitZeile({
  produkt,
  lieferzeit,
  upsert,
}: {
  produkt: KpiCategory
  lieferzeit: Lieferzeit
  upsert: (patch: Omit<Lieferzeit, 'id'>) => Promise<void>
}) {
  const { toast } = useToast()
  const [puf, setPuf] = useState(lieferzeit.pufferzeit_tage?.toString() ?? '')
  const [prod, setProd] = useState(lieferzeit.produktionszeit_tage?.toString() ?? '')
  const [zwi, setZwi] = useState(lieferzeit.zwischenzeit_tage?.toString() ?? '')
  const [ship, setShip] = useState(lieferzeit.shipping_zeit_tage?.toString() ?? '')
  const [entl, setEntl] = useState(lieferzeit.entladungszeit_tage?.toString() ?? '')

  const pufNum = puf === '' ? null : parseInt(puf)
  const prodNum = prod === '' ? null : parseInt(prod)
  const zwiNum = zwi === '' ? null : parseInt(zwi)
  const shipNum = ship === '' ? null : parseInt(ship)
  const entlNum = entl === '' ? null : parseInt(entl)

  const gesamtzeit = berechneGesamtzeit({
    produkt_id: produkt.id,
    pufferzeit_tage: pufNum,
    produktionszeit_tage: prodNum,
    zwischenzeit_tage: zwiNum,
    shipping_zeit_tage: shipNum,
    entladungszeit_tage: entlNum,
  })

  async function handleBlur() {
    try {
      await upsert({
        produkt_id: produkt.id,
        pufferzeit_tage: pufNum,
        produktionszeit_tage: prodNum,
        zwischenzeit_tage: zwiNum,
        shipping_zeit_tage: shipNum,
        entladungszeit_tage: entlNum,
      })
    } catch {
      toast({ title: 'Lieferzeit konnte nicht gespeichert werden.', variant: 'destructive' })
      setPuf(lieferzeit.pufferzeit_tage?.toString() ?? '')
      setProd(lieferzeit.produktionszeit_tage?.toString() ?? '')
      setZwi(lieferzeit.zwischenzeit_tage?.toString() ?? '')
      setShip(lieferzeit.shipping_zeit_tage?.toString() ?? '')
      setEntl(lieferzeit.entladungszeit_tage?.toString() ?? '')
    }
  }

  return (
    <TableRow>
      <TableCell className="font-medium">{produkt.name}</TableCell>
      <TableCell><NumInput value={puf} onChange={setPuf} onBlur={handleBlur} placeholder="Tage" min={0} step={1} className="w-20" /></TableCell>
      <TableCell><NumInput value={prod} onChange={setProd} onBlur={handleBlur} placeholder="Tage" min={0} step={1} className="w-20" /></TableCell>
      <TableCell><NumInput value={zwi} onChange={setZwi} onBlur={handleBlur} placeholder="Tage" min={0} step={1} className="w-20" /></TableCell>
      <TableCell><NumInput value={ship} onChange={setShip} onBlur={handleBlur} placeholder="Tage" min={0} step={1} className="w-20" /></TableCell>
      <TableCell><NumInput value={entl} onChange={setEntl} onBlur={handleBlur} placeholder="Tage" min={0} step={1} className="w-20" /></TableCell>
      <TableCell><ReadOnlyCell value={gesamtzeit} /></TableCell>
    </TableRow>
  )
}

function LieferzeitTab({ produkte, versionId, kpiHref }: TabProps) {
  const { loading, error, getLieferzeit, upsert } = useProduktinformationenLieferzeit(versionId)

  if (loading) return <p className="py-8 text-center text-sm text-muted-foreground">Lädt…</p>
  if (error) return <p className="py-8 text-center text-sm text-destructive">{error}</p>
  if (produkte.length === 0) return <EmptyHinweis kpiHref={kpiHref} />

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Produkt</TableHead>
          <TableHead>Pufferzeit (Tage)</TableHead>
          <TableHead>Produktionszeit (Tage)</TableHead>
          <TableHead>Zwischenzeit (Tage)</TableHead>
          <TableHead>Shipping-Zeit (Tage)</TableHead>
          <TableHead>Entladungszeit (Tage)</TableHead>
          <TableHead>Gesamtzeit (Tage)</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {produkte.map(p => (
          <LieferzeitZeile key={p.id} produkt={p} lieferzeit={getLieferzeit(p.id)} upsert={upsert} />
        ))}
      </TableBody>
    </Table>
  )
}

// ─── Tab 5: Zahlungskonditionen ───────────────────────────────────────────────

function ZahlungskonditionenZeile({
  produkt,
  konditionen,
  upsert,
}: {
  produkt: KpiCategory
  konditionen: Zahlungskonditionen
  upsert: (patch: Omit<Zahlungskonditionen, 'id'>) => Promise<void>
}) {
  const { toast } = useToast()

  const [vorPct, setVorPct] = useState(konditionen.vor_produktion_pct?.toString() ?? '')
  const [nachPct, setNachPct] = useState(konditionen.nach_produktion_pct?.toString() ?? '')
  const [ankunftPct, setAnkunftPct] = useState(konditionen.nach_ankunft_pct?.toString() ?? '')
  const [vorTage, setVorTage] = useState(konditionen.zahlungsziel_vor_produktion_tage?.toString() ?? '')
  const [nachTage, setNachTage] = useState(konditionen.zahlungsziel_nach_produktion_tage?.toString() ?? '')
  const [ankunftTage, setAnkunftTage] = useState(konditionen.zahlungsziel_nach_ankunft_tage?.toString() ?? '')
  const [touched, setTouched] = useState(false)

  const vorNum = vorPct === '' ? null : parseFloat(vorPct)
  const nachNum = nachPct === '' ? null : parseFloat(nachPct)
  const ankunftNum = ankunftPct === '' ? null : parseFloat(ankunftPct)

  const alleGesetzt = alleProzentGesetzt(vorNum, nachNum, ankunftNum)
  const summeGueltig = isProzentSummeGueltig(vorNum, nachNum, ankunftNum)
  const showError = touched && alleGesetzt && !summeGueltig
  const showVorZiel = vorNum !== null
  const showNachZiel = nachNum !== null
  const showAnkunftZiel = ankunftNum !== null

  const summe = alleGesetzt ? (vorNum! + nachNum! + ankunftNum!) : null

  async function handleProzentBlur() {
    setTouched(true)
    if (!summeGueltig) return
    try {
      await upsert({
        produkt_id: produkt.id,
        vor_produktion_pct: vorNum,
        nach_produktion_pct: nachNum,
        nach_ankunft_pct: ankunftNum,
        zahlungsziel_vor_produktion_tage: konditionen.zahlungsziel_vor_produktion_tage,
        zahlungsziel_nach_produktion_tage: konditionen.zahlungsziel_nach_produktion_tage,
        zahlungsziel_nach_ankunft_tage: konditionen.zahlungsziel_nach_ankunft_tage,
      })
    } catch {
      toast({ title: 'Zahlungskonditionen konnten nicht gespeichert werden.', variant: 'destructive' })
    }
  }

  async function handleZahlungszielBlur() {
    const vtNum = vorTage === '' ? null : parseInt(vorTage)
    const ntNum = nachTage === '' ? null : parseInt(nachTage)
    const atNum = ankunftTage === '' ? null : parseInt(ankunftTage)
    try {
      await upsert({
        produkt_id: produkt.id,
        vor_produktion_pct: vorNum,
        nach_produktion_pct: nachNum,
        nach_ankunft_pct: ankunftNum,
        zahlungsziel_vor_produktion_tage: vtNum,
        zahlungsziel_nach_produktion_tage: ntNum,
        zahlungsziel_nach_ankunft_tage: atNum,
      })
    } catch {
      toast({ title: 'Zahlungsziel konnte nicht gespeichert werden.', variant: 'destructive' })
    }
  }

  return (
    <>
      <TableRow>
        <TableCell className="font-medium">{produkt.name}</TableCell>
        <TableCell>
          <NumInput value={vorPct} onChange={setVorPct} onBlur={handleProzentBlur} placeholder="%" min={0} className="w-20" />
        </TableCell>
        <TableCell>
          <NumInput value={nachPct} onChange={setNachPct} onBlur={handleProzentBlur} placeholder="%" min={0} className="w-20" />
        </TableCell>
        <TableCell>
          <NumInput value={ankunftPct} onChange={setAnkunftPct} onBlur={handleProzentBlur} placeholder="%" min={0} className="w-20" />
        </TableCell>
        <TableCell>
          {showVorZiel ? (
            <NumInput value={vorTage} onChange={setVorTage} onBlur={handleZahlungszielBlur} placeholder="Tage" min={0} step={1} className="w-20" />
          ) : <span className="text-muted-foreground">–</span>}
        </TableCell>
        <TableCell>
          {showNachZiel ? (
            <NumInput value={nachTage} onChange={setNachTage} onBlur={handleZahlungszielBlur} placeholder="Tage" min={0} step={1} className="w-20" />
          ) : <span className="text-muted-foreground">–</span>}
        </TableCell>
        <TableCell>
          {showAnkunftZiel ? (
            <NumInput value={ankunftTage} onChange={setAnkunftTage} onBlur={handleZahlungszielBlur} placeholder="Tage" min={0} step={1} className="w-20" />
          ) : <span className="text-muted-foreground">–</span>}
        </TableCell>
      </TableRow>
      {showError && (
        <TableRow>
          <TableCell />
          <TableCell colSpan={6} className="py-1 text-xs text-destructive">
            Die Summe muss 100 % ergeben (aktuell: {summe?.toFixed(2)} %)
          </TableCell>
        </TableRow>
      )}
    </>
  )
}

function ZahlungskonditionenTab({ produkte, versionId, kpiHref }: TabProps) {
  const { loading, error, getKonditionen, upsert } = useProduktinformationenZahlungskonditionen(versionId)

  if (loading) return <p className="py-8 text-center text-sm text-muted-foreground">Lädt…</p>
  if (error) return <p className="py-8 text-center text-sm text-destructive">{error}</p>
  if (produkte.length === 0) return <EmptyHinweis kpiHref={kpiHref} />

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Produkt</TableHead>
          <TableHead>Vor Produktion (%)</TableHead>
          <TableHead>Nach Produktion (%)</TableHead>
          <TableHead>Nach Ankunft (%)</TableHead>
          <TableHead><span className="block">Zahlungsziel</span><span className="block">Vor Produktion (Tage)</span></TableHead>
          <TableHead><span className="block">Zahlungsziel</span><span className="block">Nach Produktion (Tage)</span></TableHead>
          <TableHead><span className="block">Zahlungsziel</span><span className="block">Nach Ankunft (Tage)</span></TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {produkte.map(p => (
          <ZahlungskonditionenZeile key={p.id} produkt={p} konditionen={getKonditionen(p.id)} upsert={upsert} />
        ))}
      </TableBody>
    </Table>
  )
}

// ─── Tab 6: Produktkosten ─────────────────────────────────────────────────────

function ProduktkostenGlobalFormular({
  kostenGlobal,
  upsertKostenGlobal,
}: {
  kostenGlobal: KostenGlobal
  upsertKostenGlobal: (patch: Partial<KostenGlobal>) => Promise<void>
}) {
  const { toast } = useToast()

  type KostenFeld = keyof KostenGlobal
  const [vals, setVals] = useState<Record<string, string>>(() => {
    const init: Record<string, string> = {}
    Object.entries(kostenGlobal).forEach(([k, v]) => { init[k] = v?.toString() ?? '' })
    return init
  })

  async function handleBlur(field: KostenFeld) {
    const strVal = vals[field] ?? ''
    const parsed = strVal === '' ? null : parseFloat(strVal)
    if (parsed !== null && (isNaN(parsed) || parsed < 0)) return
    try {
      await upsertKostenGlobal({ [field]: parsed })
    } catch {
      toast({ title: 'Einstellung konnte nicht gespeichert werden.', variant: 'destructive' })
      setVals(prev => ({ ...prev, [field]: kostenGlobal[field]?.toString() ?? '' }))
    }
  }

  function field(key: KostenFeld, placeholder: string, className?: string) {
    return (
      <NumInput
        value={vals[key] ?? ''}
        onChange={v => setVals(prev => ({ ...prev, [key]: v }))}
        onBlur={() => handleBlur(key)}
        placeholder={placeholder}
        min={0}
        className={className ?? 'w-28'}
      />
    )
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-sm font-medium">Globale Kosten- und Zahlungsziel-Einstellungen</CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="space-y-2">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Shippingkosten (Netto)</p>
          <div className="flex gap-4 flex-wrap items-end">
            {[
              { key: 'shipping_kosten_20dc' as const, label: '20DC (€)' },
              { key: 'shipping_kosten_40hq' as const, label: '40HQ (€)' },
              { key: 'shipping_zahlungsziel_tage' as const, label: 'Zahlungsziel (Tage)' },
            ].map(({ key, label }) => (
              <div key={key} className="flex flex-col gap-1">
                <Label className="text-xs text-muted-foreground">{label}</Label>
                {field(key, label.includes('Tage') ? 'Tage' : '€')}
              </div>
            ))}
          </div>
        </div>

        <div className="space-y-2">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Inspektionskosten (Netto)</p>
          <div className="flex gap-4 flex-wrap items-end">
            {[
              { key: 'inspektion_kosten_20dc' as const, label: '20DC (€)' },
              { key: 'inspektion_kosten_40hq' as const, label: '40HQ (€)' },
              { key: 'inspektion_zahlungsziel_tage' as const, label: 'Zahlungsziel (Tage)' },
            ].map(({ key, label }) => (
              <div key={key} className="flex flex-col gap-1">
                <Label className="text-xs text-muted-foreground">{label}</Label>
                {field(key, label.includes('Tage') ? 'Tage' : '€')}
              </div>
            ))}
          </div>
        </div>

        <div className="space-y-2">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Einlagerungskosten (Netto)</p>
          <div className="flex gap-4 flex-wrap items-end">
            {[
              { key: 'einlagerung_kosten_20dc' as const, label: '20DC (€)' },
              { key: 'einlagerung_kosten_40hq' as const, label: '40HQ (€)' },
              { key: 'einlagerung_zahlungsziel_tage' as const, label: 'Zahlungsziel (Tage)' },
            ].map(({ key, label }) => (
              <div key={key} className="flex flex-col gap-1">
                <Label className="text-xs text-muted-foreground">{label}</Label>
                {field(key, label.includes('Tage') ? 'Tage' : '€')}
              </div>
            ))}
          </div>
        </div>

        <div className="space-y-2">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Zollkosten</p>
          <div className="flex flex-col gap-1">
            <Label className="text-xs text-muted-foreground">Zahlungsziel Zoll (Tage)</Label>
            {field('zoll_zahlungsziel_tage', 'Tage')}
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

function ProduktkostenZeile({
  produkt,
  produktkosten,
  upsertProduktkosten,
}: {
  produkt: KpiCategory
  produktkosten: Produktkosten
  upsertProduktkosten: (patch: Omit<Produktkosten, 'id'>) => Promise<void>
}) {
  const { toast } = useToast()
  const [waren, setWaren] = useState(produktkosten.warenkosten?.toString() ?? '')
  const [zoll, setZoll] = useState(produktkosten.zollsatz_pct?.toString() ?? '')

  async function handleBlur() {
    const warenNum = waren === '' ? null : parseFloat(waren)
    const zollNum = zoll === '' ? null : parseFloat(zoll)
    try {
      await upsertProduktkosten({ produkt_id: produkt.id, warenkosten: warenNum, zollsatz_pct: zollNum })
    } catch {
      toast({ title: 'Produktkosten konnten nicht gespeichert werden.', variant: 'destructive' })
      setWaren(produktkosten.warenkosten?.toString() ?? '')
      setZoll(produktkosten.zollsatz_pct?.toString() ?? '')
    }
  }

  return (
    <TableRow>
      <TableCell className="font-medium">{produkt.name}</TableCell>
      <TableCell><NumInput value={waren} onChange={setWaren} onBlur={handleBlur} placeholder="€" min={0} className="w-28" /></TableCell>
      <TableCell><NumInput value={zoll} onChange={setZoll} onBlur={handleBlur} placeholder="%" min={0} className="w-24" /></TableCell>
    </TableRow>
  )
}

function ProduktkostenTab({ produkte, versionId, kpiHref }: TabProps) {
  const { kostenGlobal, loading, error, getProduktkosten, upsertKostenGlobal, upsertProduktkosten } =
    useProduktinformationenProduktkosten(versionId)

  if (loading) return <p className="py-8 text-center text-sm text-muted-foreground">Lädt…</p>
  if (error) return <p className="py-8 text-center text-sm text-destructive">{error}</p>

  return (
    <div className="space-y-6">
      <ProduktkostenGlobalFormular
        kostenGlobal={kostenGlobal}
        upsertKostenGlobal={upsertKostenGlobal}
      />
      {produkte.length === 0 ? (
        <EmptyHinweis kpiHref={kpiHref} />
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Produkt</TableHead>
              <TableHead>Warenkosten (€)</TableHead>
              <TableHead>Zollsatz (%)</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {produkte.map(p => (
              <ProduktkostenZeile
                key={p.id}
                produkt={p}
                produktkosten={getProduktkosten(p.id)}
                upsertProduktkosten={upsertProduktkosten}
              />
            ))}
          </TableBody>
        </Table>
      )}
    </div>
  )
}

// ─── Tab 7: Bestandsverwaltung ─────────────────────────────────────────────────

function BestandsverwaltungZeile({
  produkt,
  einstellung,
  upsert,
  einheit,
}: {
  produkt: KpiCategory
  einstellung: BestandsverwaltungEinstellung
  upsert: (patch: Omit<BestandsverwaltungEinstellung, 'id'>) => Promise<void>
  einheit: string
}) {
  const { toast } = useToast()
  const [sicher, setSicher] = useState(einstellung.sicherheitsbestand?.toString() ?? '')
  const [ziel, setZiel] = useState(einstellung.zielreichweite_wochen?.toString() ?? '')

  async function handleBlur() {
    const sicherNum = sicher === '' ? null : parseFloat(sicher)
    const zielNum = ziel === '' ? null : parseFloat(ziel)
    try {
      await upsert({ produkt_id: produkt.id, sicherheitsbestand: sicherNum, zielreichweite_wochen: zielNum })
    } catch {
      toast({ title: 'Bestandseinstellungen konnten nicht gespeichert werden.', variant: 'destructive' })
      setSicher(einstellung.sicherheitsbestand?.toString() ?? '')
      setZiel(einstellung.zielreichweite_wochen?.toString() ?? '')
    }
  }

  return (
    <TableRow>
      <TableCell className="font-medium">{produkt.name}</TableCell>
      <TableCell><NumInput value={sicher} onChange={setSicher} onBlur={handleBlur} placeholder={einheit} min={0} className="w-28" /></TableCell>
      <TableCell><NumInput value={ziel} onChange={setZiel} onBlur={handleBlur} placeholder={einheit} min={0} className="w-28" /></TableCell>
    </TableRow>
  )
}

// einheit: Bestandsmengen werden Kurzfristig in Wochen, Langfristig in Monaten
// gepflegt (PROJ-77). Nur die Beschriftung ändert sich – das gespeicherte Feld
// (zielreichweite_wochen) bleibt gleich.
function BestandsverwaltungTab({ produkte, versionId, kpiHref, einheit = 'Wochen' }: TabProps & { einheit?: string }) {
  const { loading, error, getEinstellung, upsert } = useProduktinformationenBestandsverwaltung(versionId)

  if (loading) return <p className="py-8 text-center text-sm text-muted-foreground">Lädt…</p>
  if (error) return <p className="py-8 text-center text-sm text-destructive">{error}</p>
  if (produkte.length === 0) return <EmptyHinweis kpiHref={kpiHref} />

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Produkt</TableHead>
          <TableHead>Sicherheitsbestand ({einheit})</TableHead>
          <TableHead>Zielreichweite ({einheit})</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {produkte.map(p => (
          <BestandsverwaltungZeile key={p.id} produkt={p} einstellung={getEinstellung(p.id)} upsert={upsert} einheit={einheit} />
        ))}
      </TableBody>
    </Table>
  )
}

// ─── Tab 8: Aktueller Bestand ──────────────────────────────────────────────────

function AktuellerBestandZeile({
  produkt,
  eintrag,
  upsert,
}: {
  produkt: KpiCategory
  eintrag: AktuellerBestandEintrag
  upsert: (patch: Omit<AktuellerBestandEintrag, 'id'>) => Promise<void>
}) {
  const { toast } = useToast()
  const [bestand, setBestand] = useState(eintrag.bestand?.toString() ?? '')

  async function handleBlur() {
    const parsed = bestand === '' ? null : parseInt(bestand)
    if (parsed !== null && (isNaN(parsed) || parsed < 0)) return
    try {
      await upsert({ produkt_id: produkt.id, bestand: parsed })
    } catch {
      toast({ title: 'Bestand konnte nicht gespeichert werden.', variant: 'destructive' })
      setBestand(eintrag.bestand?.toString() ?? '')
    }
  }

  return (
    <TableRow>
      <TableCell className="font-medium">{produkt.name}</TableCell>
      <TableCell><NumInput value={bestand} onChange={setBestand} onBlur={handleBlur} placeholder="Stk." min={0} step={1} className="w-28" /></TableCell>
    </TableRow>
  )
}

function AktuellerBestandTab({ produkte, versionId, kpiHref }: TabProps) {
  const { loading, error, getEintrag, upsert } = useProduktinformationenAktuellerBestand(versionId)

  if (loading) return <p className="py-8 text-center text-sm text-muted-foreground">Lädt…</p>
  if (error) return <p className="py-8 text-center text-sm text-destructive">{error}</p>
  if (produkte.length === 0) return <EmptyHinweis kpiHref={kpiHref} />

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Produkt</TableHead>
          <TableHead>Aktueller Bestand (Stk.)</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {produkte.map(p => (
          <AktuellerBestandZeile key={p.id} produkt={p} eintrag={getEintrag(p.id)} upsert={upsert} />
        ))}
      </TableBody>
    </Table>
  )
}

// ─── Geteilte Tab-Leiste (präsentational) ─────────────────────────────────────

// Rendert die 7 Reiter. versionId & kpiHref werden an jeden Reiter durchgereicht;
// simpleMoq schaltet den MOQ-Reiter auf reine Produktebene (Langfristig, PROJ-77).
function ProduktinformationenTabsInner({
  produkte,
  skusByProdukt,
  versionId,
  kpiHref,
  simpleMoq = false,
  bestandEinheit = 'Wochen',
}: {
  produkte: KpiCategory[]
  skusByProdukt: Record<string, KpiCategory[]>
  versionId?: string
  kpiHref: string
  simpleMoq?: boolean
  bestandEinheit?: string
}) {
  return (
    <Tabs defaultValue="hersteller">
      <TabsList className="mb-6 flex flex-wrap h-auto gap-1 w-full">
        <TabsTrigger value="hersteller" className="flex-1">Hersteller</TabsTrigger>
        <TabsTrigger value="moq" className="flex-1">MOQ</TabsTrigger>
        <TabsTrigger value="containerkapazitaet" className="flex-1">Containerkapazität</TabsTrigger>
        <TabsTrigger value="lieferzeit" className="flex-1">Lieferzeit</TabsTrigger>
        <TabsTrigger value="zahlungskonditionen" className="flex-1">Zahlungskonditionen</TabsTrigger>
        <TabsTrigger value="produktkosten" className="flex-1">Produktkosten</TabsTrigger>
        <TabsTrigger value="bestandsverwaltung" className="flex-1">Bestandsverwaltung</TabsTrigger>
        <TabsTrigger value="aktueller-bestand" className="flex-1">Aktueller Bestand</TabsTrigger>
      </TabsList>

      <TabsContent value="hersteller">
        <HerstellerTab produkte={produkte} versionId={versionId} kpiHref={kpiHref} />
      </TabsContent>

      <TabsContent value="moq">
        <MoqTab produkte={produkte} skusByProdukt={skusByProdukt} versionId={versionId} kpiHref={kpiHref} simple={simpleMoq} />
      </TabsContent>

      <TabsContent value="containerkapazitaet">
        <ContainerTab produkte={produkte} versionId={versionId} kpiHref={kpiHref} />
      </TabsContent>

      <TabsContent value="lieferzeit">
        <LieferzeitTab produkte={produkte} versionId={versionId} kpiHref={kpiHref} />
      </TabsContent>

      <TabsContent value="zahlungskonditionen">
        <ZahlungskonditionenTab produkte={produkte} versionId={versionId} kpiHref={kpiHref} />
      </TabsContent>

      <TabsContent value="produktkosten">
        <ProduktkostenTab produkte={produkte} versionId={versionId} kpiHref={kpiHref} />
      </TabsContent>

      <TabsContent value="bestandsverwaltung">
        <BestandsverwaltungTab produkte={produkte} versionId={versionId} kpiHref={kpiHref} einheit={bestandEinheit} />
      </TabsContent>

      <TabsContent value="aktueller-bestand">
        <AktuellerBestandTab produkte={produkte} versionId={versionId} kpiHref={kpiHref} />
      </TabsContent>
    </Tabs>
  )
}

// ─── Global (Kurzfristige Planung, PROJ-59) ───────────────────────────────────

export function ProduktinformationenTabs() {
  const { categories, loading: katLoading } = useKpiCategories('produkte')

  const produkte = useMemo(
    () =>
      categories
        .filter(c => c.level === 1)
        .sort((a, b) => a.sort_order - b.sort_order),
    [categories],
  )

  const skusByProdukt = useMemo(() => {
    const map: Record<string, KpiCategory[]> = {}
    categories
      .filter(c => c.level === 2)
      .sort((a, b) => a.sort_order - b.sort_order)
      .forEach(sku => {
        if (sku.parent_id) {
          if (!map[sku.parent_id]) map[sku.parent_id] = []
          map[sku.parent_id].push(sku)
        }
      })
    return map
  }, [categories])

  if (katLoading) {
    return <p className="py-12 text-center text-sm text-muted-foreground">Lädt…</p>
  }

  return (
    <ProduktinformationenTabsInner
      produkte={produkte}
      skusByProdukt={skusByProdukt}
      kpiHref="/dashboard/kpi-modell"
    />
  )
}

// ─── Versionsgebunden (Langfristige Planung, PROJ-77) ─────────────────────────

// Produktquelle: die Produkte (art = 'lp_produkt') der aktuellen Planversion
// (flach, ohne SKUs). MOQ läuft daher im vereinfachten Produktebene-Modus.
export function LangfristigeProduktinformationenTabs({ versionId }: { versionId: string }) {
  const { categories, loading } = useLangfristigeKpiKategorien(versionId, 'lp_produkt')

  const produkte = useMemo(
    () =>
      categories
        .filter(c => c.level === 1)
        .sort((a, b) => a.sort_order - b.sort_order),
    [categories],
  )

  if (loading) {
    return <p className="py-12 text-center text-sm text-muted-foreground">Lädt…</p>
  }

  return (
    <ProduktinformationenTabsInner
      produkte={produkte}
      skusByProdukt={{}}
      versionId={versionId}
      kpiHref={`/dashboard/langfristige-planung/${versionId}/kpi-modell-verwaltung`}
      simpleMoq
      bestandEinheit="Monate"
    />
  )
}
