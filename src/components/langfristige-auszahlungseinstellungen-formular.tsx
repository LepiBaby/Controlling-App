'use client'

import { useState, useMemo, useEffect } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import { X } from 'lucide-react'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { MultiSelect } from '@/components/multi-select'
import { useLangfristigeKpiKategorien } from '@/hooks/use-langfristige-kpi-kategorien'
import type { KpiCategory } from '@/hooks/use-kpi-categories'
import {
  useLangfristigeAuszahlungsEinstellungen,
  makeDefaultEinstellung,
  type LangfristigeAuszahlungsEinstellung,
  type LangfristigerRhythmus,
  RHYTHMUS_VALUES,
  RHYTHMUS_LABELS,
  MIN_VERSCHIEBUNG_MONATE,
  MAX_VERSCHIEBUNG_MONATE,
} from '@/hooks/use-langfristige-auszahlungs-einstellungen'
import { useToast } from '@/hooks/use-toast'

const MONATSNAMEN = [
  'Januar', 'Februar', 'März', 'April', 'Mai', 'Juni',
  'Juli', 'August', 'September', 'Oktober', 'November', 'Dezember',
]

// Auswahlbereich für das Ankerjahr: passend zur Mehrjahresplanung.
function jahresOptionen(): number[] {
  const aktuell = new Date().getFullYear()
  const jahre: number[] = []
  for (let j = aktuell - 5; j <= aktuell + 20; j++) jahre.push(j)
  return jahre
}

// --- Formular für eine einzelne Plattform ---

function PlatformForm({
  versionId,
  plattformId,
  marketingkanaele,
}: {
  versionId: string
  plattformId: string
  marketingkanaele: KpiCategory[]
}) {
  const { einstellung, loading, error, upsert } =
    useLangfristigeAuszahlungsEinstellungen(versionId, plattformId)
  const { toast } = useToast()
  const [saving, setSaving] = useState(false)

  const current: LangfristigeAuszahlungsEinstellung =
    einstellung ?? makeDefaultEinstellung(plattformId)

  // Lokaler State für die Anker-Auswahl: erlaubt eine Teilauswahl (nur Monat ODER
  // nur Jahr), ohne dass das Select sofort auf den gespeicherten Wert zurückspringt.
  // Gespeichert wird erst, wenn beide gesetzt (oder beide geleert) sind.
  const [lokalMonat, setLokalMonat] = useState<number | null>(current.erster_auszahlung_monat)
  const [lokalJahr, setLokalJahr] = useState<number | null>(current.erster_auszahlung_jahr)

  // Bei (Neu-)Laden der gespeicherten Einstellung lokalen State angleichen.
  useEffect(() => {
    setLokalMonat(current.erster_auszahlung_monat)
    setLokalJahr(current.erster_auszahlung_jahr)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [current.erster_auszahlung_monat, current.erster_auszahlung_jahr])

  async function handleSave(patch: Partial<LangfristigeAuszahlungsEinstellung>) {
    setSaving(true)
    try {
      await upsert({ sales_plattform_id: plattformId, ...patch })
    } catch {
      toast({
        title: 'Fehler',
        description: 'Einstellung konnte nicht gespeichert werden.',
        variant: 'destructive',
      })
    } finally {
      setSaving(false)
    }
  }

  // Anker: Monat + Jahr müssen gemeinsam gesetzt oder beide leer sein.
  // Teilauswahl wird im lokalen State gehalten; gespeichert wird erst, wenn
  // beide gesetzt (oder beide geleert) sind.
  function handleAnkerChange(monat: number | null, jahr: number | null) {
    setLokalMonat(monat)
    setLokalJahr(jahr)
    if (monat !== null && jahr !== null) {
      handleSave({ erster_auszahlung_monat: monat, erster_auszahlung_jahr: jahr })
    } else if (monat === null && jahr === null) {
      handleSave({ erster_auszahlung_monat: null, erster_auszahlung_jahr: null })
    }
    // Genau eines gesetzt: nur lokaler State, noch kein Speichern (Both-or-Neither-Regel).
  }

  if (loading) {
    return <div className="py-8 text-center text-sm text-muted-foreground">Laden…</div>
  }

  if (error) {
    return (
      <div className="rounded-lg border border-destructive bg-destructive/10 p-4 text-sm text-destructive">
        {error}
      </div>
    )
  }

  const ankerMonat = lokalMonat
  const ankerJahr = lokalJahr
  const ankerGesetzt = ankerMonat !== null || ankerJahr !== null

  return (
    <div className={`rounded-lg border bg-card p-6 space-y-6 transition-opacity ${saving ? 'opacity-60' : ''}`}>
      {/* Auszahlungsrhythmus */}
      <div className="flex items-center gap-6">
        <Label className="w-56 shrink-0 text-sm font-medium">Auszahlungsrhythmus</Label>
        <Select
          value={current.auszahlungsrhythmus}
          onValueChange={v => handleSave({ auszahlungsrhythmus: v as LangfristigerRhythmus })}
          disabled={saving}
        >
          <SelectTrigger className="w-48">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {RHYTHMUS_VALUES.map(r => (
              <SelectItem key={r} value={r}>
                {RHYTHMUS_LABELS[r]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Erster Auszahlungsmonat (Ankermonat) */}
      <div className="flex items-start gap-6">
        <div className="w-56 shrink-0 pt-2">
          <Label className="text-sm font-medium">Erster Auszahlungsmonat</Label>
        </div>
        <div className="flex items-center gap-2">
          <Select
            value={ankerMonat !== null ? String(ankerMonat) : ''}
            onValueChange={v => handleAnkerChange(Number(v), ankerJahr)}
            disabled={saving}
          >
            <SelectTrigger className="w-36">
              <SelectValue placeholder="Monat" />
            </SelectTrigger>
            <SelectContent>
              {MONATSNAMEN.map((name, idx) => (
                <SelectItem key={idx + 1} value={String(idx + 1)}>
                  {name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select
            value={ankerJahr !== null ? String(ankerJahr) : ''}
            onValueChange={v => handleAnkerChange(ankerMonat, Number(v))}
            disabled={saving}
          >
            <SelectTrigger className="w-28">
              <SelectValue placeholder="Jahr" />
            </SelectTrigger>
            <SelectContent>
              {jahresOptionen().map(jahr => (
                <SelectItem key={jahr} value={String(jahr)}>
                  {jahr}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {ankerGesetzt && (
            <Button
              variant="ghost"
              size="sm"
              className="text-muted-foreground"
              disabled={saving}
              onClick={() => handleAnkerChange(null, null)}
            >
              Zurücksetzen
            </Button>
          )}
        </div>
      </div>

      {/* Verschiebung / Zurückstellung */}
      <div className="flex items-center gap-6">
        <Label className="w-56 shrink-0 text-sm font-medium">Verschiebung / Zurückstellung</Label>
        <div className="flex items-center gap-2">
          <Input
            type="number"
            min={MIN_VERSCHIEBUNG_MONATE}
            max={MAX_VERSCHIEBUNG_MONATE}
            step={1}
            value={current.verschiebung_monate}
            onChange={e => {
              const val = Math.max(
                MIN_VERSCHIEBUNG_MONATE,
                Math.min(MAX_VERSCHIEBUNG_MONATE, parseInt(e.target.value) || 0),
              )
              handleSave({ verschiebung_monate: val })
            }}
            disabled={saving}
            className="w-20"
            aria-label="Verschiebung in Monaten"
          />
          <span className="text-sm text-muted-foreground">Monate</span>
        </div>
      </div>

      {/* Marketing */}
      <div className="flex items-start gap-6">
        <Label className="w-56 shrink-0 text-sm font-medium pt-2">Marketing</Label>
        {marketingkanaele.length === 0 ? (
          <p className="text-sm text-muted-foreground pt-2">
            Keine Marketingkanäle im KPI-Modell dieser Version gepflegt.{' '}
            <Link
              href={`/dashboard/langfristige-planung/${versionId}/kpi-modell-verwaltung`}
              className="underline"
            >
              Zur KPI-Modell Verwaltung
            </Link>
          </p>
        ) : (
          <div className="flex items-start gap-6">
            <MultiSelect
              options={marketingkanaele.map(k => ({ id: k.id, name: k.name }))}
              selected={current.marketingkanal_ids}
              onChange={ids => handleSave({ marketingkanal_ids: ids })}
              placeholder="Kanäle wählen"
              className="w-48"
            />
            {current.marketingkanal_ids.length > 0 && (
              <div className="space-y-2">
                {current.marketingkanal_ids.map(id => {
                  const kat = marketingkanaele.find(k => k.id === id)
                  if (!kat) return null
                  return (
                    <div key={id} className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() =>
                          handleSave({
                            marketingkanal_ids: current.marketingkanal_ids.filter(x => x !== id),
                          })
                        }
                        className="text-muted-foreground hover:text-destructive shrink-0"
                        aria-label={`${kat.name} entfernen`}
                      >
                        <X className="size-3.5" />
                      </button>
                      <span className="text-sm truncate">{kat.name}</span>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

// --- Hauptkomponente ---

export function LangfristigeAuszahlungseinstellungenFormular() {
  const params = useParams()
  const versionId = typeof params.versionId === 'string' ? params.versionId : ''

  const { categories: plattformen, loading: plattformenLoading } =
    useLangfristigeKpiKategorien(versionId, 'lp_sales_plattform')
  const { categories: marketingkanaele, loading: marketingLoading } =
    useLangfristigeKpiKategorien(versionId, 'lp_marketingkanal')

  const sortedPlattformen = useMemo(
    () =>
      plattformen
        .filter(p => p.level === 1)
        .sort((a, b) => a.sort_order - b.sort_order),
    [plattformen],
  )

  const sortedKanaele = useMemo(
    () =>
      marketingkanaele
        .filter(k => k.level === 1)
        .sort((a, b) => a.sort_order - b.sort_order),
    [marketingkanaele],
  )

  if (plattformenLoading || marketingLoading) {
    return <div className="py-8 text-center text-sm text-muted-foreground">Laden…</div>
  }

  if (sortedPlattformen.length === 0) {
    return (
      <div className="rounded-lg border bg-muted/30 p-8 text-center space-y-3">
        <p className="font-medium">Keine Sales Plattformen definiert</p>
        <p className="text-sm text-muted-foreground">
          Bitte zuerst in der KPI-Modell Verwaltung dieser Planversion Sales Plattformen
          anlegen, bevor Auszahlungseinstellungen gepflegt werden können.
        </p>
        <Link href={`/dashboard/langfristige-planung/${versionId}/kpi-modell-verwaltung`}>
          <Button variant="outline" size="sm" className="mt-2">
            Zur KPI-Modell Verwaltung
          </Button>
        </Link>
      </div>
    )
  }

  return (
    <Tabs defaultValue={sortedPlattformen[0]?.id} className="space-y-4">
      <TabsList className="w-full h-auto flex-wrap">
        {sortedPlattformen.map(p => (
          <TabsTrigger key={p.id} value={p.id} className="flex-1">
            {p.name}
          </TabsTrigger>
        ))}
      </TabsList>
      {sortedPlattformen.map(p => (
        <TabsContent key={p.id} value={p.id} className="mt-0">
          <PlatformForm
            versionId={versionId}
            plattformId={p.id}
            marketingkanaele={sortedKanaele}
          />
        </TabsContent>
      ))}
    </Tabs>
  )
}
