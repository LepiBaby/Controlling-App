'use client'

import { useState, useEffect } from 'react'
import { CalendarIcon, Loader2, Info, PackagePlus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Separator } from '@/components/ui/separator'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'
import { Calendar } from '@/components/ui/calendar'
import { useToast } from '@/hooks/use-toast'
import type { Bestellung } from '@/hooks/use-bestellungen'
import { berechneStueckvolumen, berechneMaxKapazitaet, perContainerMengen } from '@/hooks/use-produktinformationen-container'
import { format, parseISO } from 'date-fns'
import { de } from 'date-fns/locale'

// ─── Types ────────────────────────────────────────────────────────────────────

interface LieferzeitDaten {
  zwischenzeit_tage: number | null
  produktionszeit_tage: number | null
  shipping_zeit_tage: number | null
  entladungszeit_tage: number | null
}

interface ProduktMitSkus {
  id: string
  name: string
  sort_order: number
  skus: Array<{ id: string; name: string; sort_order: number }>
}

interface ContainerKapazitaet {
  produkt_id: string
  laenge_cm: number | null
  breite_cm: number | null
  hoehe_cm: number | null
}

interface StammdatenState {
  produkte: ProduktMitSkus[]
  gesamtProdukteAnzahl: number
  lieferzeitByProduktId: Map<string, LieferzeitDaten>
  moqByProduktId: Map<string, { ebene: 'produkt' | 'sku'; moq: number | null }>
  moqSkuBySkuId: Map<string, number>
  herstellerByProduktId: Map<string, string | null>
  planBestellungen: Bestellung[]
  containerGlobal: { volumen_20dc: number | null; volumen_40hq: number | null }
  containerKapazitaeten: ContainerKapazitaet[]
}

const DATE_FIELDS = [
  'bestelldatum',
  'produktionsstartDatum',
  'produktionsendeDatum',
  'shippingdatum',
  'ankunftsdatum',
  'verfuegbarkeitsdatum',
] as const
type DateFieldKey = typeof DATE_FIELDS[number]

// ─── Helpers ──────────────────────────────────────────────────────────────────

function addDays(dateStr: string, days: number): string {
  const d = new Date(dateStr + 'T00:00:00')
  d.setDate(d.getDate() + days)
  return d.toISOString().split('T')[0]
}

function getToday(): string {
  return new Date().toISOString().split('T')[0]
}

function formatDatum(d: string | null): string {
  if (!d) return 'Datum wählen'
  try {
    return format(parseISO(d), 'dd.MM.yyyy', { locale: de })
  } catch {
    return d
  }
}

function computeAllDates(
  bestelldatum: string,
  lz: LieferzeitDaten,
): Record<DateFieldKey, string> {
  const pstart = addDays(bestelldatum, lz.zwischenzeit_tage ?? 0)
  const pende = addDays(pstart, lz.produktionszeit_tage ?? 0)
  const shipping = pende
  const ankunft = addDays(shipping, lz.shipping_zeit_tage ?? 0)
  const verfuegbar = addDays(ankunft, lz.entladungszeit_tage ?? 0)
  return {
    bestelldatum,
    produktionsstartDatum: pstart,
    produktionsendeDatum: pende,
    shippingdatum: shipping,
    ankunftsdatum: ankunft,
    verfuegbarkeitsdatum: verfuegbar,
  }
}

// Cascade downstream fields when a field changes.
// Fields in manualFlags are skipped (kept as-is), but their value is used as new base.
// If a manual field has no value, cascade stops.
function cascadeFrom(
  changedField: DateFieldKey,
  newValue: string | null,
  currentDates: Record<DateFieldKey, string | null>,
  manualFlags: Set<DateFieldKey>,
  lz: LieferzeitDaten | null,
): Partial<Record<DateFieldKey, string | null>> {
  if (!lz) return {}
  const updates: Partial<Record<DateFieldKey, string | null>> = {}
  const fieldIndex = DATE_FIELDS.indexOf(changedField)
  let prevValue: string | null = newValue

  for (let i = fieldIndex + 1; i < DATE_FIELDS.length; i++) {
    const field = DATE_FIELDS[i]

    if (manualFlags.has(field)) {
      prevValue = currentDates[field]
      if (!prevValue) break
      continue
    }

    if (!prevValue) {
      updates[field] = null
      continue
    }

    let computed: string | null = null
    switch (field) {
      case 'produktionsstartDatum':
        computed = addDays(prevValue, lz.zwischenzeit_tage ?? 0)
        break
      case 'produktionsendeDatum':
        computed = addDays(prevValue, lz.produktionszeit_tage ?? 0)
        break
      case 'shippingdatum':
        computed = prevValue
        break
      case 'ankunftsdatum':
        computed = addDays(prevValue, lz.shipping_zeit_tage ?? 0)
        break
      case 'verfuegbarkeitsdatum':
        computed = addDays(prevValue, lz.entladungszeit_tage ?? 0)
        break
    }

    updates[field] = computed
    prevValue = computed
  }

  return updates
}

// ─── DatePicker ───────────────────────────────────────────────────────────────

function DatePicker({
  value,
  onChange,
  label,
  required,
}: {
  value: string | null
  onChange: (v: string | null) => void
  label: string
  required?: boolean
}) {
  const [open, setOpen] = useState(false)
  const date = value ? new Date(value + 'T00:00:00') : undefined

  return (
    <div className="space-y-1.5">
      <Label className="text-xs text-muted-foreground">
        {label}
        {required && <span className="text-destructive ml-0.5">*</span>}
      </Label>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            size="sm"
            className="w-full justify-start font-normal text-xs h-9"
          >
            <CalendarIcon className="mr-1.5 h-3.5 w-3.5 opacity-50 shrink-0" />
            {value ? (
              <span>{formatDatum(value)}</span>
            ) : (
              <span className="text-muted-foreground">Datum wählen</span>
            )}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0" align="start">
          <Calendar
            mode="single"
            selected={date}
            onSelect={(d) => {
              onChange(d ? d.toISOString().split('T')[0] : null)
              setOpen(false)
            }}
          />
          {value && (
            <div className="border-t p-2">
              <Button
                variant="ghost"
                size="sm"
                className="w-full text-xs text-muted-foreground"
                onClick={() => {
                  onChange(null)
                  setOpen(false)
                }}
              >
                Datum entfernen
              </Button>
            </div>
          )}
        </PopoverContent>
      </Popover>
    </div>
  )
}

// ─── Main Dialog ──────────────────────────────────────────────────────────────

interface ErstplanbestellungDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onCreated: () => void
}

export function ErstplanbestellungDialog({
  open,
  onOpenChange,
  onCreated,
}: ErstplanbestellungDialogProps) {
  const { toast } = useToast()

  // Stammdaten
  const [stammdaten, setStammdaten] = useState<StammdatenState | null>(null)
  const [stammdatenLoading, setStammdatenLoading] = useState(false)

  // Form
  const [selectedProduktId, setSelectedProduktId] = useState('')
  const [dates, setDates] = useState<Record<DateFieldKey, string | null>>({
    bestelldatum: getToday(),
    produktionsstartDatum: null,
    produktionsendeDatum: null,
    shippingdatum: null,
    ankunftsdatum: null,
    verfuegbarkeitsdatum: null,
  })
  const [manualFlags, setManualFlags] = useState<Set<DateFieldKey>>(new Set())
  const [skuMengen, setSkuMengen] = useState<Array<{ skuId: string; skuName: string; menge: number | '' }>>([])
  const [anzahl40hq, setAnzahl40hq] = useState(0)
  const [anzahl20dc, setAnzahl20dc] = useState(0)
  const [notizen, setNotizen] = useState('')
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [submitting, setSubmitting] = useState(false)

  // Load stammdaten once when dialog opens
  useEffect(() => {
    if (!open) return
    setStammdatenLoading(true)

    Promise.all([
      fetch('/api/kpi-categories?type=produkte').then((r) => r.json()),
      fetch('/api/produktinformationen/lieferzeit').then((r) => r.json()),
      fetch('/api/produktinformationen/moq').then((r) => r.json()),
      fetch('/api/produktinformationen/moq-sku').then((r) => r.json()),
      fetch('/api/produktinformationen/hersteller-zuordnung').then((r) => r.json()),
      fetch('/api/bestellplanung/bestellungen?status=plan').then((r) => r.json()),
      fetch('/api/bestellplanung/bestellungen?status=laufend').then((r) => r.json()),
      fetch('/api/bestellplanung/bestellungen?status=abgeschlossen').then((r) => r.json()),
      fetch('/api/produktinformationen/container-global').then((r) => r.json()),
      fetch('/api/produktinformationen/containerkapazitaet').then((r) => r.json()),
    ])
      .then(([cats, lieferzeiten, moqs, moqSkus, herstellerZ, planBest, laufendBest, abgeschlossenBest, containerGlobal, containerKapazitaeten]) => {
        const allCats = cats as Array<{
          id: string
          name: string
          level: number
          sort_order: number
          parent_id: string | null
        }>
        const level1 = allCats.filter((c) => c.level === 1).sort((a, b) => a.sort_order - b.sort_order)
        const level2 = allCats.filter((c) => c.level === 2)

        const alleBestellungen = [
          ...(planBest as Bestellung[]),
          ...(laufendBest as Bestellung[]),
          ...(abgeschlossenBest as Bestellung[]),
        ]
        const produktIdsWithBestellungen = new Set<string>(
          alleBestellungen.flatMap((b) => b.produkte.map((p) => p.produkt_id)),
        )

        const produkte: ProduktMitSkus[] = level1.filter((p) => !produktIdsWithBestellungen.has(p.id)).map((p) => ({
          id: p.id,
          name: p.name,
          sort_order: p.sort_order,
          skus: level2
            .filter((s) => s.parent_id === p.id)
            .sort((a, b) => a.sort_order - b.sort_order),
        }))

        const lieferzeitByProduktId = new Map<string, LieferzeitDaten>(
          (lieferzeiten as Array<{ produkt_id: string } & LieferzeitDaten>).map((l) => [
            l.produkt_id,
            l,
          ]),
        )
        const moqByProduktId = new Map(
          (moqs as Array<{ produkt_id: string; ebene: 'produkt' | 'sku'; moq: number | null }>).map(
            (m) => [m.produkt_id, m],
          ),
        )
        const moqSkuBySkuId = new Map(
          (moqSkus as Array<{ sku_id: string; moq: number | null }>)
            .filter((m) => m.moq != null)
            .map((m) => [m.sku_id, m.moq as number]),
        )
        const herstellerByProduktId = new Map(
          (herstellerZ as Array<{ produkt_id: string; hersteller_id: string | null }>).map((h) => [
            h.produkt_id,
            h.hersteller_id,
          ]),
        )

        setStammdaten({
          produkte,
          gesamtProdukteAnzahl: level1.length,
          lieferzeitByProduktId,
          moqByProduktId,
          moqSkuBySkuId,
          herstellerByProduktId,
          planBestellungen: planBest as Bestellung[],
          containerGlobal: (containerGlobal as { volumen_20dc: number | null; volumen_40hq: number | null }) ?? { volumen_20dc: null, volumen_40hq: null },
          containerKapazitaeten: (containerKapazitaeten as ContainerKapazitaet[]) ?? [],
        })
      })
      .catch(() => {
        toast({ title: 'Stammdaten konnten nicht geladen werden', variant: 'destructive' })
      })
      .finally(() => setStammdatenLoading(false))
  }, [open]) // eslint-disable-line react-hooks/exhaustive-deps

  // Reset form when dialog closes
  useEffect(() => {
    if (!open) {
      setSelectedProduktId('')
      setDates({
        bestelldatum: getToday(),
        produktionsstartDatum: null,
        produktionsendeDatum: null,
        shippingdatum: null,
        ankunftsdatum: null,
        verfuegbarkeitsdatum: null,
      })
      setManualFlags(new Set())
      setSkuMengen([])
      setAnzahl40hq(0)
      setAnzahl20dc(0)
      setNotizen('')
      setErrors({})
    }
  }, [open])

  function handleProduktChange(produktId: string) {
    setSelectedProduktId(produktId)
    setErrors({})

    if (!stammdaten) return

    const produkt = stammdaten.produkte.find((p) => p.id === produktId)
    if (!produkt) return

    // SKU-Mengen mit MOQ vorausfüllen
    const moqInfo = stammdaten.moqByProduktId.get(produktId)
    const newSkuMengen = produkt.skus.map((sku) => {
      let menge: number | '' = ''
      if (moqInfo?.ebene === 'sku') {
        menge = stammdaten.moqSkuBySkuId.get(sku.id) ?? ''
      } else if (moqInfo?.ebene === 'produkt' && moqInfo.moq) {
        menge = moqInfo.moq
      }
      return { skuId: sku.id, skuName: sku.name, menge }
    })
    setSkuMengen(newSkuMengen)

    // Datumsfelder aus Stammdaten berechnen (alle manual flags zurücksetzen)
    const lz = stammdaten.lieferzeitByProduktId.get(produktId)
    const today = dates.bestelldatum ?? getToday()
    setManualFlags(new Set())

    if (lz) {
      const computed = computeAllDates(today, lz)
      setDates({
        bestelldatum: today,
        produktionsstartDatum: computed.produktionsstartDatum,
        produktionsendeDatum: computed.produktionsendeDatum,
        shippingdatum: computed.shippingdatum,
        ankunftsdatum: computed.ankunftsdatum,
        verfuegbarkeitsdatum: computed.verfuegbarkeitsdatum,
      })
    } else {
      setDates((prev) => ({
        ...prev,
        produktionsstartDatum: null,
        produktionsendeDatum: null,
        shippingdatum: null,
        ankunftsdatum: null,
        verfuegbarkeitsdatum: null,
      }))
    }
  }

  function handleDateChange(field: DateFieldKey, newValue: string | null) {
    // bestelldatum is always the root — don't mark it as manual
    const newManualFlags = new Set(manualFlags)
    if (field !== 'bestelldatum') {
      if (newValue) {
        newManualFlags.add(field)
      } else {
        newManualFlags.delete(field) // clearing resets to auto-calc
      }
    }

    const lz = selectedProduktId
      ? (stammdaten?.lieferzeitByProduktId.get(selectedProduktId) ?? null)
      : null
    const newDates: Record<DateFieldKey, string | null> = { ...dates, [field]: newValue }

    if (newValue && lz) {
      const downstream = cascadeFrom(field, newValue, dates, newManualFlags, lz)
      Object.assign(newDates, downstream)
    }

    setDates(newDates)
    setManualFlags(newManualFlags)
    if (field === 'bestelldatum') setErrors((prev) => ({ ...prev, bestelldatum: '' }))
  }

  function validate(): boolean {
    const newErrors: Record<string, string> = {}

    if (!selectedProduktId) {
      newErrors.produkt = 'Bitte ein Produkt auswählen'
    }
    if (!dates.bestelldatum) {
      newErrors.bestelldatum = 'Bestelldatum ist Pflicht'
    }
    if (selectedProduktId) {
      const produkt = stammdaten?.produkte.find((p) => p.id === selectedProduktId)
      if (produkt && produkt.skus.length === 0) {
        newErrors.skuMengen =
          'Dieses Produkt hat keine SKUs. Bitte zuerst SKUs im KPI-Modell anlegen.'
      } else if (skuMengen.length > 0) {
        const hasPositive = skuMengen.some((s) => typeof s.menge === 'number' && s.menge > 0)
        if (!hasPositive) {
          newErrors.skuMengen = 'Mindestens eine SKU-Menge muss größer als 0 sein'
        }
      }
    }
    if (anzahl40hq === 0 && anzahl20dc === 0) {
      newErrors.container = 'Mindestens ein Container muss angegeben werden'
    }
    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  async function handleSubmit() {
    if (!validate()) return

    setSubmitting(true)
    try {
      const body = {
        status: 'plan',
        herkunft: 'manuell',
        anzahl_40hq: anzahl40hq,
        anzahl_20dc: anzahl20dc,
        bestelldatum: dates.bestelldatum,
        produktionsstart_datum: dates.produktionsstartDatum,
        produktionsende_datum: dates.produktionsendeDatum,
        shippingdatum: dates.shippingdatum,
        ankunftsdatum: dates.ankunftsdatum,
        verfuegbarkeitsdatum: dates.verfuegbarkeitsdatum,
        notizen: notizen.trim() || null,
        produkt_ids: [selectedProduktId],
        sku_mengen: skuMengen
          .filter((s) => typeof s.menge === 'number' && s.menge >= 0)
          .map((s) => ({
            sku_id: s.skuId,
            menge_theoretisch: null,
            menge_praktisch: typeof s.menge === 'number' ? s.menge : 0,
          })),
      }

      const res = await fetch('/api/bestellplanung/bestellungen', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })

      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error(
          typeof err.error === 'string' ? err.error : 'Erstellen fehlgeschlagen',
        )
      }

      toast({ title: 'Erstplanbestellung wurde angelegt' })
      onCreated()
      onOpenChange(false)
    } catch (err) {
      toast({
        title: 'Fehler beim Anlegen',
        description: err instanceof Error ? err.message : undefined,
        variant: 'destructive',
      })
    } finally {
      setSubmitting(false)
    }
  }

  // ─── Derived ─────────────────────────────────────────────────────────────────

  const selectedProdukt = stammdaten?.produkte.find((p) => p.id === selectedProduktId)
  const selectedLieferzeit = selectedProduktId
    ? stammdaten?.lieferzeitByProduktId.get(selectedProduktId)
    : null
  const hasLieferzeit = !!selectedLieferzeit

  const selectedHerstellerId = selectedProduktId
    ? (stammdaten?.herstellerByProduktId.get(selectedProduktId) ?? null)
    : null

  const gesamtmenge = skuMengen.reduce((sum, s) => sum + (typeof s.menge === 'number' ? s.menge : 0), 0)

  const selectedKapazitaet = selectedProduktId
    ? (stammdaten?.containerKapazitaeten.find((k) => k.produkt_id === selectedProduktId) ?? null)
    : null
  const stueckvolumen = selectedKapazitaet
    ? berechneStueckvolumen(selectedKapazitaet.laenge_cm, selectedKapazitaet.breite_cm, selectedKapazitaet.hoehe_cm)
    : null
  const max40hq = stammdaten && stueckvolumen !== null
    ? berechneMaxKapazitaet(stammdaten.containerGlobal.volumen_40hq, stueckvolumen)
    : null
  const max20dc = stammdaten && stueckvolumen !== null
    ? berechneMaxKapazitaet(stammdaten.containerGlobal.volumen_20dc, stueckvolumen)
    : null
  const { hqAmounts, dcAmounts } = perContainerMengen(gesamtmenge, anzahl40hq, anzahl20dc, max40hq, max20dc)

  // ─── Render ───────────────────────────────────────────────────────────────────

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <PackagePlus className="h-5 w-5" />
            Erstplanbestellung anlegen
          </DialogTitle>
        </DialogHeader>

        {stammdatenLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <div className="space-y-6 py-2">
            {/* Produkt */}
            <div className="space-y-1.5">
              <Label>
                Produkt <span className="text-destructive">*</span>
              </Label>
              <Select value={selectedProduktId} onValueChange={handleProduktChange}>
                <SelectTrigger className={errors.produkt ? 'border-destructive' : ''}>
                  <SelectValue placeholder="Produkt auswählen…" />
                </SelectTrigger>
                <SelectContent>
                  {(stammdaten?.produkte ?? []).length === 0 ? (
                    <div className="py-3 px-4 text-sm text-muted-foreground">
                      {(stammdaten?.gesamtProdukteAnzahl ?? 0) > 0
                        ? 'Für alle Produkte existiert bereits eine Bestellung'
                        : 'Keine Produkte vorhanden'}
                    </div>
                  ) : (
                    (stammdaten?.produkte ?? []).map((p) => (
                      <SelectItem key={p.id} value={p.id}>
                        {p.name}
                      </SelectItem>
                    ))
                  )}
                </SelectContent>
              </Select>
              {errors.produkt && <p className="text-xs text-destructive">{errors.produkt}</p>}
            </div>

            {selectedProduktId && (
              <>
                <Separator />

                {/* Lieferzeit-Hinweis */}
                {!hasLieferzeit && (
                  <div className="flex items-start gap-2 rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
                    <Info className="h-4 w-4 mt-0.5 shrink-0" />
                    <span>
                      Keine Lieferzeit-Stammdaten vorhanden — bitte alle Datumsfelder manuell
                      eingeben.{' '}
                      <a
                        href="/dashboard/kurzfristige-planung/produktinformationen"
                        className="underline hover:no-underline"
                      >
                        Zu Produktinformationen → Lieferzeit
                      </a>
                    </span>
                  </div>
                )}

                {/* Datumsfelder */}
                <div className="space-y-2">
                  <Label className="text-sm font-medium">Datumsfelder</Label>
                  <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                    <DatePicker
                      label="Bestelldatum"
                      value={dates.bestelldatum}
                      onChange={(v) => handleDateChange('bestelldatum', v)}
                      required
                    />
                    <DatePicker
                      label="Produktionsstart"
                      value={dates.produktionsstartDatum}
                      onChange={(v) => handleDateChange('produktionsstartDatum', v)}
                    />
                    <DatePicker
                      label="Produktionsende"
                      value={dates.produktionsendeDatum}
                      onChange={(v) => handleDateChange('produktionsendeDatum', v)}
                    />
                    <DatePicker
                      label="Shippingdatum"
                      value={dates.shippingdatum}
                      onChange={(v) => handleDateChange('shippingdatum', v)}
                    />
                    <DatePicker
                      label="Ankunftsdatum"
                      value={dates.ankunftsdatum}
                      onChange={(v) => handleDateChange('ankunftsdatum', v)}
                    />
                    <DatePicker
                      label="Verfügbar ab"
                      value={dates.verfuegbarkeitsdatum}
                      onChange={(v) => handleDateChange('verfuegbarkeitsdatum', v)}
                    />
                  </div>
                  {errors.bestelldatum && (
                    <p className="text-xs text-destructive">{errors.bestelldatum}</p>
                  )}
                </div>

                <Separator />

                {/* SKU-Mengen */}
                <div className="space-y-2">
                  <Label className="text-sm font-medium">Bestellmengen je SKU</Label>
                  {selectedProdukt && selectedProdukt.skus.length === 0 ? (
                    <p className="text-sm text-destructive">
                      Dieses Produkt hat keine SKUs. Bitte zuerst SKUs im KPI-Modell anlegen.
                    </p>
                  ) : (
                    <div className="rounded-md border overflow-hidden">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="border-b bg-muted/30">
                            <th className="px-3 py-2 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                              SKU
                            </th>
                            <th className="px-3 py-2 text-right text-xs font-semibold uppercase tracking-wider text-muted-foreground w-28">
                              Menge
                            </th>
                          </tr>
                        </thead>
                        <tbody>
                          {skuMengen.map((s, i) => (
                            <tr key={s.skuId} className="border-b last:border-0">
                              <td className="px-3 py-2 font-medium">{s.skuName}</td>
                              <td className="px-3 py-2">
                                <Input
                                  type="number"
                                  min={0}
                                  step={1}
                                  value={s.menge}
                                  onChange={(e) => {
                                    const raw = e.target.value
                                    const val = raw === '' ? '' : parseInt(raw, 10)
                                    setSkuMengen((prev) =>
                                      prev.map((item, idx) =>
                                        idx === i
                                          ? {
                                              ...item,
                                              menge:
                                                typeof val === 'number' && !isNaN(val) ? val : '',
                                            }
                                          : item,
                                      ),
                                    )
                                    setErrors((prev) => ({ ...prev, skuMengen: '' }))
                                  }}
                                  className="h-8 text-right w-24 ml-auto"
                                  placeholder="0"
                                />
                              </td>
                            </tr>
                          ))}
                        </tbody>
                        <tfoot>
                          <tr className="border-t bg-muted/30">
                            <td className="px-3 py-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                              Gesamt
                            </td>
                            <td className="px-3 py-2 text-right text-sm font-semibold tabular-nums">
                              {skuMengen
                                .reduce((sum, s) => sum + (typeof s.menge === 'number' ? s.menge : 0), 0)
                                .toLocaleString('de-DE')}{' '}
                              Stk.
                            </td>
                          </tr>
                        </tfoot>
                      </table>
                    </div>
                  )}
                  {errors.skuMengen && (
                    <p className="text-xs text-destructive">{errors.skuMengen}</p>
                  )}
                </div>

                {/* Container */}
                <div className="space-y-2">
                  <Label className="text-sm font-medium">
                    Container <span className="text-destructive">*</span>
                  </Label>
                  <div className="flex gap-6">
                    <div className="space-y-1">
                      <Label className="text-xs text-muted-foreground">
                        Anzahl 40HQ{max40hq !== null ? ` (max. ${max40hq.toLocaleString('de-DE')} Stk.)` : ''}
                      </Label>
                      <Input
                        type="number"
                        min={0}
                        className="w-20 h-8 text-xs"
                        value={anzahl40hq}
                        onChange={(e) => {
                          setAnzahl40hq(Math.max(0, parseInt(e.target.value) || 0))
                          setErrors((prev) => ({ ...prev, container: '' }))
                        }}
                      />
                      {hqAmounts.map((a, i) => (
                        <p key={i} className="text-xs text-muted-foreground">
                          Container {i + 1}: {a.toLocaleString('de-DE')} Stk.{max40hq ? ` (${Math.round((a / max40hq) * 100)} %)` : ''}
                        </p>
                      ))}
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs text-muted-foreground">
                        Anzahl 20DC{max20dc !== null ? ` (max. ${max20dc.toLocaleString('de-DE')} Stk.)` : ''}
                      </Label>
                      <Input
                        type="number"
                        min={0}
                        className="w-20 h-8 text-xs"
                        value={anzahl20dc}
                        onChange={(e) => {
                          setAnzahl20dc(Math.max(0, parseInt(e.target.value) || 0))
                          setErrors((prev) => ({ ...prev, container: '' }))
                        }}
                      />
                      {dcAmounts.map((a, i) => (
                        <p key={i} className="text-xs text-muted-foreground">
                          Container {i + 1}: {a.toLocaleString('de-DE')} Stk.{max20dc ? ` (${Math.round((a / max20dc) * 100)} %)` : ''}
                        </p>
                      ))}
                    </div>
                  </div>
                  {errors.container && (
                    <p className="text-xs text-destructive">{errors.container}</p>
                  )}
                </div>

                <Separator />

                {/* Notizen */}
                <div className="space-y-1.5">
                  <Label className="text-sm font-medium">Notizen (optional)</Label>
                  <Textarea
                    value={notizen}
                    onChange={(e) => setNotizen(e.target.value)}
                    placeholder="Optionale Notizen zur Bestellung…"
                    className="resize-none"
                    rows={3}
                  />
                </div>
              </>
            )}
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Abbrechen
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={!selectedProduktId || submitting || stammdatenLoading}
          >
            {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Erstplanbestellung anlegen
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
