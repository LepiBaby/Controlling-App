'use client'

import { useState, useMemo, useEffect, useRef, useCallback } from 'react'
import { ChevronDown, ChevronRight } from 'lucide-react'
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
import {
  useProduktinformationenHersteller,
  type Hersteller,
} from '@/hooks/use-produktinformationen-hersteller'
import {
  useProduktinformationenMoq,
  type MoqEbene,
} from '@/hooks/use-produktinformationen-moq'
import {
  useProduktinformationenContainer,
  berechneStueckvolumen,
  berechneMaxKapazitaet,
} from '@/hooks/use-produktinformationen-container'
import {
  useProduktinformationenLieferzeit,
  berechneGesamtzeit,
} from '@/hooks/use-produktinformationen-lieferzeit'
import {
  useProduktinformationenZahlungskonditionen,
  isProzentSummeGueltig,
  alleProzentGesetzt,
} from '@/hooks/use-produktinformationen-zahlungskonditionen'
import { useProduktinformationenProduktkosten } from '@/hooks/use-produktinformationen-produktkosten'
import { useProduktinformationenBestandsverwaltung } from '@/hooks/use-produktinformationen-bestandsverwaltung'
import { useToast } from '@/hooks/use-toast'

// ─── shared helpers ──────────────────────────────────────────────────────────

function EmptyHinweis() {
  return (
    <div className="py-10 text-center text-sm text-muted-foreground">
      Noch keine Produkte im KPI-Modell gepflegt.{' '}
      <a href="/dashboard/kpi-modell" className="underline hover:text-foreground">
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

function ReadOnlyCell({ value }: { value: string | number | null }) {
  return (
    <span className="tabular-nums text-muted-foreground text-right block">
      {value ?? '–'}
    </span>
  )
}

// ─── Tab 1: Hersteller ───────────────────────────────────────────────────────

function HerstellerZeile({
  produkt,
  hersteller,
  herstellerId,
  onAssign,
  onCreateAndAssign,
}: {
  produkt: KpiCategory
  hersteller: Hersteller[]
  herstellerId: string | null
  onAssign: (herstellerId: string) => Promise<void>
  onCreateAndAssign: (name: string) => Promise<void>
}) {
  const { toast } = useToast()
  const [open, setOpen] = useState(false)
  const [search, setSearch] = useState('')
  const [saving, setSaving] = useState(false)

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
                  {filtered.map(h => (
                    <CommandItem key={h.id} value={h.id} onSelect={() => handleSelect(h.id)}>
                      {h.name}
                    </CommandItem>
                  ))}
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

function HerstellerTab({ produkte }: { produkte: KpiCategory[] }) {
  const { hersteller, loading, error, getZuordnung, assignHersteller, createAndAssign } =
    useProduktinformationenHersteller()

  if (loading) return <p className="py-8 text-center text-sm text-muted-foreground">Lädt…</p>
  if (error) return <p className="py-8 text-center text-sm text-destructive">{error}</p>
  if (produkte.length === 0) return <EmptyHinweis />

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
              onCreateAndAssign={name => createAndAssign(p.id, name)}
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
  ebene,
  moq,
  moqSkus,
  onEbeneChange,
  onMoqChange,
  onSkuMoqChange,
}: {
  produkt: KpiCategory
  skus: KpiCategory[]
  ebene: MoqEbene
  moq: number | null
  moqSkus: Record<string, number | null>
  onEbeneChange: (ebene: MoqEbene) => Promise<void>
  onMoqChange: (moq: number | null) => Promise<void>
  onSkuMoqChange: (skuId: string, moq: number | null) => Promise<void>
}) {
  const { toast } = useToast()
  const [expanded, setExpanded] = useState(false)
  const [moqStr, setMoqStr] = useState(moq?.toString() ?? '')
  const [skuMoqStrs, setSkuMoqStrs] = useState<Record<string, string>>(
    Object.fromEntries(skus.map(s => [s.id, moqSkus[s.id]?.toString() ?? ''])),
  )
  const prevEbene = useRef(ebene)

  useEffect(() => {
    if (prevEbene.current !== ebene) {
      prevEbene.current = ebene
      if (ebene === 'produkt') setExpanded(false)
    }
  }, [ebene])

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
      setMoqStr(moq?.toString() ?? '')
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
      const sku = skus.find(s => s.id === skuId)
      if (sku) setSkuMoqStrs(prev => ({ ...prev, [skuId]: moqSkus[skuId]?.toString() ?? '' }))
    }
  }

  return (
    <>
      <TableRow>
        <TableCell className="font-medium">{produkt.name}</TableCell>
        <TableCell>
          <RadioGroup
            value={ebene}
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
          {ebene === 'produkt' ? (
            <NumInput
              value={moqStr}
              onChange={setMoqStr}
              onBlur={handleMoqBlur}
              placeholder="MOQ"
              min={1}
              step={1}
              className="w-28"
            />
          ) : (
            <Button
              variant="ghost"
              size="sm"
              className="h-8 gap-1 text-muted-foreground"
              onClick={() => setExpanded(prev => !prev)}
            >
              {expanded ? (
                <ChevronDown className="h-4 w-4" />
              ) : (
                <ChevronRight className="h-4 w-4" />
              )}
              {skus.length} SKU{skus.length !== 1 ? 's' : ''}
            </Button>
          )}
        </TableCell>
      </TableRow>
      {ebene === 'sku' && expanded && skus.length === 0 && (
        <TableRow>
          <TableCell />
          <TableCell colSpan={2} className="py-2 pl-8 text-sm text-muted-foreground italic">
            Keine SKUs vorhanden.{' '}
            <a href="/dashboard/kpi-modell" className="underline hover:text-foreground">
              Im KPI-Modell anlegen
            </a>
          </TableCell>
        </TableRow>
      )}
      {ebene === 'sku' && expanded && skus.map(sku => (
        <TableRow key={sku.id} className="bg-muted/20">
          <TableCell className="pl-8 text-sm text-muted-foreground" />
          <TableCell className="pl-8 text-sm">{sku.name}</TableCell>
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

function MoqTab({
  produkte,
  skusByProdukt,
}: {
  produkte: KpiCategory[]
  skusByProdukt: Record<string, KpiCategory[]>
}) {
  const { loading, error, getMoqEinstellung, getMoqSkuEinstellung, upsertMoq, upsertMoqSku } =
    useProduktinformationenMoq()

  if (loading) return <p className="py-8 text-center text-sm text-muted-foreground">Lädt…</p>
  if (error) return <p className="py-8 text-center text-sm text-destructive">{error}</p>
  if (produkte.length === 0) return <EmptyHinweis />

  return (
    <Table>
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
            skus.map(s => [s.id, getMoqSkuEinstellung(s.id).moq]),
          )
          return (
            <MoqZeile
              key={p.id}
              produkt={p}
              skus={skus}
              ebene={einst.ebene}
              moq={einst.moq}
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

function ContainerGlobalFormular() {
  const { containerGlobal, upsertContainerGlobal } = useProduktinformationenContainer()
  const { toast } = useToast()
  const [v20, setV20] = useState(containerGlobal.volumen_20dc_m3?.toString() ?? '')
  const [v40, setV40] = useState(containerGlobal.volumen_40dc_m3?.toString() ?? '')
  const [v40hq, setV40hq] = useState(containerGlobal.volumen_40hq_m3?.toString() ?? '')
  const initialized = useRef(false)

  useEffect(() => {
    if (!initialized.current) {
      setV20(containerGlobal.volumen_20dc_m3?.toString() ?? '')
      setV40(containerGlobal.volumen_40dc_m3?.toString() ?? '')
      setV40hq(containerGlobal.volumen_40hq_m3?.toString() ?? '')
      initialized.current = true
    }
  }, [containerGlobal])

  async function handleBlur(field: '20dc' | '40dc' | '40hq', strVal: string) {
    const parsed = strVal === '' ? null : parseFloat(strVal)
    if (parsed !== null && (isNaN(parsed) || parsed < 0)) return
    try {
      await upsertContainerGlobal({
        [`volumen_${field}_m3`]: parsed,
      })
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
            { label: '40DC', field: '40dc' as const, val: v40, set: setV40 },
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
  containerGlobal,
}: {
  produkt: KpiCategory
  containerGlobal: { volumen_20dc_m3: number | null; volumen_40dc_m3: number | null; volumen_40hq_m3: number | null }
}) {
  const { getKapazitaet, upsertKapazitaet } = useProduktinformationenContainer()
  const { toast } = useToast()
  const kap = getKapazitaet(produkt.id)
  const [l, setL] = useState(kap.laenge_cm?.toString() ?? '')
  const [b, setB] = useState(kap.breite_cm?.toString() ?? '')
  const [h, setH] = useState(kap.hoehe_cm?.toString() ?? '')
  const initialized = useRef(false)

  useEffect(() => {
    if (!initialized.current) {
      setL(kap.laenge_cm?.toString() ?? '')
      setB(kap.breite_cm?.toString() ?? '')
      setH(kap.hoehe_cm?.toString() ?? '')
      initialized.current = true
    }
  }, [kap.laenge_cm, kap.breite_cm, kap.hoehe_cm])

  const lNum = l === '' ? null : parseFloat(l)
  const bNum = b === '' ? null : parseFloat(b)
  const hNum = h === '' ? null : parseFloat(h)
  const stueck = berechneStueckvolumen(lNum, bNum, hNum)
  const max20 = berechneMaxKapazitaet(containerGlobal.volumen_20dc_m3, stueck)
  const max40 = berechneMaxKapazitaet(containerGlobal.volumen_40dc_m3, stueck)
  const max40hq = berechneMaxKapazitaet(containerGlobal.volumen_40hq_m3, stueck)

  async function handleBlur() {
    const lp = l === '' ? null : parseFloat(l)
    const bp = b === '' ? null : parseFloat(b)
    const hp = h === '' ? null : parseFloat(h)
    try {
      await upsertKapazitaet({ produkt_id: produkt.id, laenge_cm: lp, breite_cm: bp, hoehe_cm: hp })
    } catch {
      toast({ title: 'Paketmaße konnten nicht gespeichert werden.', variant: 'destructive' })
      setL(kap.laenge_cm?.toString() ?? '')
      setB(kap.breite_cm?.toString() ?? '')
      setH(kap.hoehe_cm?.toString() ?? '')
    }
  }

  return (
    <TableRow>
      <TableCell className="font-medium">{produkt.name}</TableCell>
      <TableCell><NumInput value={l} onChange={setL} onBlur={handleBlur} placeholder="cm" min={0} className="w-20" /></TableCell>
      <TableCell><NumInput value={b} onChange={setB} onBlur={handleBlur} placeholder="cm" min={0} className="w-20" /></TableCell>
      <TableCell><NumInput value={h} onChange={setH} onBlur={handleBlur} placeholder="cm" min={0} className="w-20" /></TableCell>
      <TableCell><ReadOnlyCell value={stueck != null ? stueck.toLocaleString('de-DE') : null} /></TableCell>
      <TableCell><ReadOnlyCell value={max20} /></TableCell>
      <TableCell><ReadOnlyCell value={max40} /></TableCell>
      <TableCell><ReadOnlyCell value={max40hq} /></TableCell>
    </TableRow>
  )
}

function ContainerTab({ produkte }: { produkte: KpiCategory[] }) {
  const { containerGlobal, loading, error } = useProduktinformationenContainer()

  if (loading) return <p className="py-8 text-center text-sm text-muted-foreground">Lädt…</p>
  if (error) return <p className="py-8 text-center text-sm text-destructive">{error}</p>

  return (
    <div className="space-y-6">
      <ContainerGlobalFormular />
      {produkte.length === 0 ? (
        <EmptyHinweis />
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Produkt</TableHead>
              <TableHead>Länge (cm)</TableHead>
              <TableHead>Breite (cm)</TableHead>
              <TableHead>Höhe (cm)</TableHead>
              <TableHead>Stückvolumen (cm³)</TableHead>
              <TableHead>Max. 20DC</TableHead>
              <TableHead>Max. 40DC</TableHead>
              <TableHead>Max. 40HQ</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {produkte.map(p => (
              <ContainerkapazitaetZeile key={p.id} produkt={p} containerGlobal={containerGlobal} />
            ))}
          </TableBody>
        </Table>
      )}
    </div>
  )
}

// ─── Tab 4: Lieferzeit ───────────────────────────────────────────────────────

function LieferzeitZeile({ produkt }: { produkt: KpiCategory }) {
  const { getLieferzeit, upsert } = useProduktinformationenLieferzeit()
  const { toast } = useToast()
  const lz = getLieferzeit(produkt.id)
  const [prod, setProd] = useState(lz.produktionszeit_tage?.toString() ?? '')
  const [zwi, setZwi] = useState(lz.zwischenzeit_tage?.toString() ?? '')
  const [ship, setShip] = useState(lz.shipping_zeit_tage?.toString() ?? '')
  const [entl, setEntl] = useState(lz.entladungszeit_tage?.toString() ?? '')
  const initialized = useRef(false)

  useEffect(() => {
    if (!initialized.current) {
      setProd(lz.produktionszeit_tage?.toString() ?? '')
      setZwi(lz.zwischenzeit_tage?.toString() ?? '')
      setShip(lz.shipping_zeit_tage?.toString() ?? '')
      setEntl(lz.entladungszeit_tage?.toString() ?? '')
      initialized.current = true
    }
  }, [lz.produktionszeit_tage, lz.zwischenzeit_tage, lz.shipping_zeit_tage, lz.entladungszeit_tage])

  const prodNum = prod === '' ? null : parseInt(prod)
  const zwiNum = zwi === '' ? null : parseInt(zwi)
  const shipNum = ship === '' ? null : parseInt(ship)
  const entlNum = entl === '' ? null : parseInt(entl)

  const gesamtzeit = berechneGesamtzeit({
    produkt_id: produkt.id,
    produktionszeit_tage: prodNum,
    zwischenzeit_tage: zwiNum,
    shipping_zeit_tage: shipNum,
    entladungszeit_tage: entlNum,
  })

  async function handleBlur() {
    try {
      await upsert({
        produkt_id: produkt.id,
        produktionszeit_tage: prodNum,
        zwischenzeit_tage: zwiNum,
        shipping_zeit_tage: shipNum,
        entladungszeit_tage: entlNum,
      })
    } catch {
      toast({ title: 'Lieferzeit konnte nicht gespeichert werden.', variant: 'destructive' })
      setProd(lz.produktionszeit_tage?.toString() ?? '')
      setZwi(lz.zwischenzeit_tage?.toString() ?? '')
      setShip(lz.shipping_zeit_tage?.toString() ?? '')
      setEntl(lz.entladungszeit_tage?.toString() ?? '')
    }
  }

  return (
    <TableRow>
      <TableCell className="font-medium">{produkt.name}</TableCell>
      <TableCell><NumInput value={prod} onChange={setProd} onBlur={handleBlur} placeholder="Tage" min={0} step={1} className="w-20" /></TableCell>
      <TableCell><NumInput value={zwi} onChange={setZwi} onBlur={handleBlur} placeholder="Tage" min={0} step={1} className="w-20" /></TableCell>
      <TableCell><NumInput value={ship} onChange={setShip} onBlur={handleBlur} placeholder="Tage" min={0} step={1} className="w-20" /></TableCell>
      <TableCell><NumInput value={entl} onChange={setEntl} onBlur={handleBlur} placeholder="Tage" min={0} step={1} className="w-20" /></TableCell>
      <TableCell><ReadOnlyCell value={gesamtzeit} /></TableCell>
    </TableRow>
  )
}

function LieferzeitTab({ produkte }: { produkte: KpiCategory[] }) {
  const { loading, error } = useProduktinformationenLieferzeit()

  if (loading) return <p className="py-8 text-center text-sm text-muted-foreground">Lädt…</p>
  if (error) return <p className="py-8 text-center text-sm text-destructive">{error}</p>
  if (produkte.length === 0) return <EmptyHinweis />

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Produkt</TableHead>
          <TableHead>Produktionszeit (Tage)</TableHead>
          <TableHead>Zwischenzeit (Tage)</TableHead>
          <TableHead>Shipping-Zeit (Tage)</TableHead>
          <TableHead>Entladungszeit (Tage)</TableHead>
          <TableHead>Gesamtzeit (Tage)</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {produkte.map(p => <LieferzeitZeile key={p.id} produkt={p} />)}
      </TableBody>
    </Table>
  )
}

// ─── Tab 5: Zahlungskonditionen ───────────────────────────────────────────────

function ZahlungskonditionenZeile({ produkt }: { produkt: KpiCategory }) {
  const { getKonditionen, upsert } = useProduktinformationenZahlungskonditionen()
  const { toast } = useToast()
  const k = getKonditionen(produkt.id)

  const [vorPct, setVorPct] = useState(k.vor_produktion_prozent?.toString() ?? '')
  const [nachPct, setNachPct] = useState(k.nach_produktion_prozent?.toString() ?? '')
  const [ankunftPct, setAnkunftPct] = useState(k.nach_ankunft_prozent?.toString() ?? '')
  const [vorTage, setVorTage] = useState(k.zahlungsziel_vor_produktion_tage?.toString() ?? '')
  const [nachTage, setNachTage] = useState(k.zahlungsziel_nach_produktion_tage?.toString() ?? '')
  const [ankunftTage, setAnkunftTage] = useState(k.zahlungsziel_nach_ankunft_tage?.toString() ?? '')
  const [touched, setTouched] = useState(false)
  const initialized = useRef(false)

  useEffect(() => {
    if (!initialized.current) {
      setVorPct(k.vor_produktion_prozent?.toString() ?? '')
      setNachPct(k.nach_produktion_prozent?.toString() ?? '')
      setAnkunftPct(k.nach_ankunft_prozent?.toString() ?? '')
      setVorTage(k.zahlungsziel_vor_produktion_tage?.toString() ?? '')
      setNachTage(k.zahlungsziel_nach_produktion_tage?.toString() ?? '')
      setAnkunftTage(k.zahlungsziel_nach_ankunft_tage?.toString() ?? '')
      initialized.current = true
    }
  }, [k])

  const vorNum = vorPct === '' ? null : parseFloat(vorPct)
  const nachNum = nachPct === '' ? null : parseFloat(nachPct)
  const ankunftNum = ankunftPct === '' ? null : parseFloat(ankunftPct)

  const alleGesetzt = alleProzentGesetzt(vorNum, nachNum, ankunftNum)
  const summeGueltig = isProzentSummeGueltig(vorNum, nachNum, ankunftNum)
  const showError = touched && alleGesetzt && !summeGueltig
  const showZahlungsziele = alleGesetzt && summeGueltig

  const summe = alleGesetzt ? (vorNum! + nachNum! + ankunftNum!) : null

  async function handleProzentBlur() {
    setTouched(true)
    if (!summeGueltig) return
    try {
      await upsert({
        produkt_id: produkt.id,
        vor_produktion_prozent: vorNum,
        nach_produktion_prozent: nachNum,
        nach_ankunft_prozent: ankunftNum,
        zahlungsziel_vor_produktion_tage: k.zahlungsziel_vor_produktion_tage,
        zahlungsziel_nach_produktion_tage: k.zahlungsziel_nach_produktion_tage,
        zahlungsziel_nach_ankunft_tage: k.zahlungsziel_nach_ankunft_tage,
      })
    } catch {
      toast({ title: 'Zahlungskonditionen konnten nicht gespeichert werden.', variant: 'destructive' })
    }
  }

  async function handleZahlungszielBlur() {
    if (!summeGueltig) return
    const vtNum = vorTage === '' ? null : parseInt(vorTage)
    const ntNum = nachTage === '' ? null : parseInt(nachTage)
    const atNum = ankunftTage === '' ? null : parseInt(ankunftTage)
    try {
      await upsert({
        produkt_id: produkt.id,
        vor_produktion_prozent: vorNum,
        nach_produktion_prozent: nachNum,
        nach_ankunft_prozent: ankunftNum,
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
          {showZahlungsziele ? (
            <NumInput value={vorTage} onChange={setVorTage} onBlur={handleZahlungszielBlur} placeholder="Tage" min={0} step={1} className="w-20" />
          ) : <span className="text-muted-foreground">–</span>}
        </TableCell>
        <TableCell>
          {showZahlungsziele ? (
            <NumInput value={nachTage} onChange={setNachTage} onBlur={handleZahlungszielBlur} placeholder="Tage" min={0} step={1} className="w-20" />
          ) : <span className="text-muted-foreground">–</span>}
        </TableCell>
        <TableCell>
          {showZahlungsziele ? (
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

function ZahlungskonditionenTab({ produkte }: { produkte: KpiCategory[] }) {
  const { loading, error } = useProduktinformationenZahlungskonditionen()

  if (loading) return <p className="py-8 text-center text-sm text-muted-foreground">Lädt…</p>
  if (error) return <p className="py-8 text-center text-sm text-destructive">{error}</p>
  if (produkte.length === 0) return <EmptyHinweis />

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Produkt</TableHead>
          <TableHead>Vor Produktion (%)</TableHead>
          <TableHead>Nach Produktion (%)</TableHead>
          <TableHead>Nach Ankunft (%)</TableHead>
          <TableHead>ZZ Vor Produktion (Tage)</TableHead>
          <TableHead>ZZ Nach Produktion (Tage)</TableHead>
          <TableHead>ZZ Nach Ankunft (Tage)</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {produkte.map(p => <ZahlungskonditionenZeile key={p.id} produkt={p} />)}
      </TableBody>
    </Table>
  )
}

// ─── Tab 6: Produktkosten ─────────────────────────────────────────────────────

function ProduktkostenGlobalFormular() {
  const { kostenGlobal, upsertKostenGlobal } = useProduktinformationenProduktkosten()
  const { toast } = useToast()

  type KostenFeld = keyof typeof kostenGlobal
  const [vals, setVals] = useState<Record<string, string>>({})
  const initialized = useRef(false)

  useEffect(() => {
    if (!initialized.current && kostenGlobal) {
      const init: Record<string, string> = {}
      Object.entries(kostenGlobal).forEach(([k, v]) => {
        init[k] = v?.toString() ?? ''
      })
      setVals(init)
      initialized.current = true
    }
  }, [kostenGlobal])

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
        {/* Shipping */}
        <div className="space-y-2">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Shippingkosten (Netto)</p>
          <div className="flex gap-4 flex-wrap items-end">
            {[
              { key: 'shipping_kosten_20dc' as const, label: '20DC (€)' },
              { key: 'shipping_kosten_40dc' as const, label: '40DC (€)' },
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

        {/* Inspektion */}
        <div className="space-y-2">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Inspektionskosten (Netto)</p>
          <div className="flex gap-4 flex-wrap items-end">
            {[
              { key: 'inspektion_kosten_20dc' as const, label: '20DC (€)' },
              { key: 'inspektion_kosten_40dc' as const, label: '40DC (€)' },
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

        {/* Einlagerung */}
        <div className="space-y-2">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Einlagerungskosten (Netto)</p>
          <div className="flex gap-4 flex-wrap items-end">
            {[
              { key: 'einlagerung_kosten_20dc' as const, label: '20DC (€)' },
              { key: 'einlagerung_kosten_40dc' as const, label: '40DC (€)' },
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

        {/* Zoll */}
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

function ProduktkostenZeile({ produkt }: { produkt: KpiCategory }) {
  const { getProduktkosten, upsertProduktkosten } = useProduktinformationenProduktkosten()
  const { toast } = useToast()
  const pk = getProduktkosten(produkt.id)
  const [waren, setWaren] = useState(pk.warenkosten?.toString() ?? '')
  const [zoll, setZoll] = useState(pk.zollsatz_prozent?.toString() ?? '')
  const initialized = useRef(false)

  useEffect(() => {
    if (!initialized.current) {
      setWaren(pk.warenkosten?.toString() ?? '')
      setZoll(pk.zollsatz_prozent?.toString() ?? '')
      initialized.current = true
    }
  }, [pk.warenkosten, pk.zollsatz_prozent])

  async function handleBlur() {
    const warenNum = waren === '' ? null : parseFloat(waren)
    const zollNum = zoll === '' ? null : parseFloat(zoll)
    try {
      await upsertProduktkosten({ produkt_id: produkt.id, warenkosten: warenNum, zollsatz_prozent: zollNum })
    } catch {
      toast({ title: 'Produktkosten konnten nicht gespeichert werden.', variant: 'destructive' })
      setWaren(pk.warenkosten?.toString() ?? '')
      setZoll(pk.zollsatz_prozent?.toString() ?? '')
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

function ProduktkostenTab({ produkte }: { produkte: KpiCategory[] }) {
  const { loading, error } = useProduktinformationenProduktkosten()

  if (loading) return <p className="py-8 text-center text-sm text-muted-foreground">Lädt…</p>
  if (error) return <p className="py-8 text-center text-sm text-destructive">{error}</p>

  return (
    <div className="space-y-6">
      <ProduktkostenGlobalFormular />
      {produkte.length === 0 ? (
        <EmptyHinweis />
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
            {produkte.map(p => <ProduktkostenZeile key={p.id} produkt={p} />)}
          </TableBody>
        </Table>
      )}
    </div>
  )
}

// ─── Tab 7: Bestandsverwaltung ─────────────────────────────────────────────────

function BestandsverwaltungZeile({ produkt }: { produkt: KpiCategory }) {
  const { getEinstellung, upsert } = useProduktinformationenBestandsverwaltung()
  const { toast } = useToast()
  const e = getEinstellung(produkt.id)
  const [sicher, setSicher] = useState(e.sicherheitsbestand?.toString() ?? '')
  const [ziel, setZiel] = useState(e.zielreichweite_monate?.toString() ?? '')
  const initialized = useRef(false)

  useEffect(() => {
    if (!initialized.current) {
      setSicher(e.sicherheitsbestand?.toString() ?? '')
      setZiel(e.zielreichweite_monate?.toString() ?? '')
      initialized.current = true
    }
  }, [e.sicherheitsbestand, e.zielreichweite_monate])

  async function handleBlur() {
    const sicherNum = sicher === '' ? null : parseInt(sicher)
    const zielNum = ziel === '' ? null : parseFloat(ziel)
    try {
      await upsert({ produkt_id: produkt.id, sicherheitsbestand: sicherNum, zielreichweite_monate: zielNum })
    } catch {
      toast({ title: 'Bestandseinstellungen konnten nicht gespeichert werden.', variant: 'destructive' })
      setSicher(e.sicherheitsbestand?.toString() ?? '')
      setZiel(e.zielreichweite_monate?.toString() ?? '')
    }
  }

  return (
    <TableRow>
      <TableCell className="font-medium">{produkt.name}</TableCell>
      <TableCell><NumInput value={sicher} onChange={setSicher} onBlur={handleBlur} placeholder="Stk." min={0} step={1} className="w-28" /></TableCell>
      <TableCell><NumInput value={ziel} onChange={setZiel} onBlur={handleBlur} placeholder="Monate" min={0} className="w-28" /></TableCell>
    </TableRow>
  )
}

function BestandsverwaltungTab({ produkte }: { produkte: KpiCategory[] }) {
  const { loading, error } = useProduktinformationenBestandsverwaltung()

  if (loading) return <p className="py-8 text-center text-sm text-muted-foreground">Lädt…</p>
  if (error) return <p className="py-8 text-center text-sm text-destructive">{error}</p>
  if (produkte.length === 0) return <EmptyHinweis />

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Produkt</TableHead>
          <TableHead>Sicherheitsbestand (Stk.)</TableHead>
          <TableHead>Zielreichweite (Monate)</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {produkte.map(p => <BestandsverwaltungZeile key={p.id} produkt={p} />)}
      </TableBody>
    </Table>
  )
}

// ─── Main exported component ──────────────────────────────────────────────────

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
    <Tabs defaultValue="hersteller">
      <TabsList className="mb-6 flex flex-wrap h-auto gap-1">
        <TabsTrigger value="hersteller">Hersteller</TabsTrigger>
        <TabsTrigger value="moq">MOQ</TabsTrigger>
        <TabsTrigger value="containerkapazitaet">Containerkapazität</TabsTrigger>
        <TabsTrigger value="lieferzeit">Lieferzeit</TabsTrigger>
        <TabsTrigger value="zahlungskonditionen">Zahlungskonditionen</TabsTrigger>
        <TabsTrigger value="produktkosten">Produktkosten</TabsTrigger>
        <TabsTrigger value="bestandsverwaltung">Bestandsverwaltung</TabsTrigger>
      </TabsList>

      <TabsContent value="hersteller">
        <HerstellerTab produkte={produkte} />
      </TabsContent>

      <TabsContent value="moq">
        <MoqTab produkte={produkte} skusByProdukt={skusByProdukt} />
      </TabsContent>

      <TabsContent value="containerkapazitaet">
        <ContainerTab produkte={produkte} />
      </TabsContent>

      <TabsContent value="lieferzeit">
        <LieferzeitTab produkte={produkte} />
      </TabsContent>

      <TabsContent value="zahlungskonditionen">
        <ZahlungskonditionenTab produkte={produkte} />
      </TabsContent>

      <TabsContent value="produktkosten">
        <ProduktkostenTab produkte={produkte} />
      </TabsContent>

      <TabsContent value="bestandsverwaltung">
        <BestandsverwaltungTab produkte={produkte} />
      </TabsContent>
    </Tabs>
  )
}
