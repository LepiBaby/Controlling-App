'use client'

import { useState, useEffect, useMemo, useRef } from 'react'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Input } from '@/components/ui/input'
import { Checkbox } from '@/components/ui/checkbox'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import { useKpiCategories } from '@/hooks/use-kpi-categories'
import {
  useAuszahlungsEinstellungen,
  type AuszahlungsEinstellung,
  type Rhythmus,
  RHYTHMUS_VALUES,
  RHYTHMUS_LABELS,
  RHYTHMUS_WOCHEN,
  getCurrentISOWeekAndYear,
  calculateNextPayoutWeek,
} from '@/hooks/use-auszahlungs-einstellungen'
import { useToast } from '@/hooks/use-toast'

// --- Form für eine einzelne Plattform ---

function AuszahlungseinstellungenPlatformForm({ plattformId }: { plattformId: string }) {
  const { einstellung, loading, error, upsert } = useAuszahlungsEinstellungen(plattformId)
  const { toast } = useToast()
  const [saving, setSaving] = useState(false)

  // Lokaler State für KW/Jahr-Felder
  const [localKw, setLocalKw] = useState<string>('')
  const [localJahr, setLocalJahr] = useState<string>('')
  const [kwJahrError, setKwJahrError] = useState<string | null>(null)
  const containerFocusedRef = useRef(false)

  // Berechnete nächste Auszahlungswoche aus gespeicherter Basis + Rhythmus
  const displayedKw = useMemo(() => {
    if (
      !einstellung?.naechste_auszahlung_basis_kw ||
      !einstellung?.naechste_auszahlung_basis_jahr
    ) {
      return null
    }
    const now = getCurrentISOWeekAndYear()
    return calculateNextPayoutWeek(
      einstellung.naechste_auszahlung_basis_kw,
      einstellung.naechste_auszahlung_basis_jahr,
      RHYTHMUS_WOCHEN[einstellung.auszahlungsrhythmus],
      now.kw,
      now.jahr
    )
  }, [einstellung])

  // Sync lokale KW/Jahr-Felder wenn displayedKw sich ändert (Laden oder nach Speichern)
  useEffect(() => {
    if (!containerFocusedRef.current) {
      setLocalKw(displayedKw?.kw?.toString() ?? '')
      setLocalJahr(displayedKw?.jahr?.toString() ?? '')
    }
  }, [displayedKw])

  const current: AuszahlungsEinstellung = einstellung ?? {
    sales_plattform_id: plattformId,
    auszahlungsrhythmus: 'woechentlich',
    naechste_auszahlung_basis_kw: null,
    naechste_auszahlung_basis_jahr: null,
    retouren_inkludiert: false,
    marketing_inkludiert: false,
  }

  async function handleSave(patch: Partial<AuszahlungsEinstellung>) {
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

  async function handleKwJahrContainerBlur(e: React.FocusEvent<HTMLDivElement>) {
    // Focus bleibt im Container (z. B. von KW zu Jahr) → nicht speichern
    if (e.currentTarget.contains(e.relatedTarget as Node)) return
    containerFocusedRef.current = false
    await saveKwJahr()
  }

  async function saveKwJahr() {
    setKwJahrError(null)
    const kwStr = localKw.trim()
    const jahrStr = localJahr.trim()

    // Beide leer → Basis löschen
    if (!kwStr && !jahrStr) {
      await handleSave({
        naechste_auszahlung_basis_kw: null,
        naechste_auszahlung_basis_jahr: null,
      })
      return
    }

    // Beide müssen befüllt sein
    if (!kwStr || !jahrStr) {
      setKwJahrError('KW und Jahr müssen gemeinsam befüllt oder beide leer sein.')
      return
    }

    const kw = parseInt(kwStr, 10)
    const jahr = parseInt(jahrStr, 10)

    if (isNaN(kw) || kw < 1 || kw > 53) {
      setKwJahrError('Ungültige KW — erlaubt: 1 bis 53.')
      return
    }
    if (isNaN(jahr) || jahr < 2024) {
      setKwJahrError('Ungültiges Jahr — erlaubt: ab 2024.')
      return
    }

    await handleSave({
      naechste_auszahlung_basis_kw: kw,
      naechste_auszahlung_basis_jahr: jahr,
    })
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

  return (
    <div className={`rounded-lg border bg-card p-6 space-y-6 transition-opacity ${saving ? 'opacity-60' : ''}`}>
      {/* Auszahlungsrhythmus */}
      <div className="flex items-center gap-6">
        <Label className="w-56 shrink-0 text-sm font-medium">Auszahlungsrhythmus</Label>
        <Select
          value={current.auszahlungsrhythmus}
          onValueChange={v => handleSave({ auszahlungsrhythmus: v as Rhythmus })}
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

      {/* Nächste Auszahlungswoche */}
      <div className="flex flex-col gap-1.5">
        <div className="flex items-center gap-6">
          <Label className="w-56 shrink-0 text-sm font-medium">Nächste Auszahlungswoche</Label>
          <div
            className="flex items-center gap-2"
            onFocus={() => { containerFocusedRef.current = true }}
            onBlur={handleKwJahrContainerBlur}
          >
            <div className="flex items-center gap-1.5">
              <span className="text-sm text-muted-foreground">KW</span>
              <Input
                type="number"
                min={1}
                max={53}
                value={localKw}
                onChange={e => {
                  setLocalKw(e.target.value)
                  setKwJahrError(null)
                }}
                className="w-20"
                disabled={saving}
                placeholder="—"
                aria-label="Kalenderwoche"
              />
            </div>
            <span className="text-sm text-muted-foreground">/</span>
            <Input
              type="number"
              min={2024}
              value={localJahr}
              onChange={e => {
                setLocalJahr(e.target.value)
                setKwJahrError(null)
              }}
              className="w-24"
              disabled={saving}
              placeholder="—"
              aria-label="Jahr"
            />
          </div>
        </div>
        {kwJahrError && (
          <p className="ml-[248px] text-xs text-destructive">{kwJahrError}</p>
        )}
      </div>

      {/* Retouren */}
      <div className="flex items-center gap-6">
        <Label className="w-56 shrink-0 text-sm font-medium" htmlFor={`retouren-${plattformId}`}>
          Retouren
        </Label>
        <Checkbox
          id={`retouren-${plattformId}`}
          checked={current.retouren_inkludiert}
          onCheckedChange={v => handleSave({ retouren_inkludiert: Boolean(v) })}
          disabled={saving}
          aria-label="Retourenausgaben inkludiert"
        />
      </div>

      {/* Marketing */}
      <div className="flex items-center gap-6">
        <Label className="w-56 shrink-0 text-sm font-medium" htmlFor={`marketing-${plattformId}`}>
          Marketing
        </Label>
        <Checkbox
          id={`marketing-${plattformId}`}
          checked={current.marketing_inkludiert}
          onCheckedChange={v => handleSave({ marketing_inkludiert: Boolean(v) })}
          disabled={saving}
          aria-label="Marketingausgaben inkludiert"
        />
      </div>
    </div>
  )
}

// --- Hauptkomponente ---

export function AuszahlungseinstellungenFormular() {
  const { categories: plattformen, loading: plattformenLoading } =
    useKpiCategories('sales_plattformen')

  const sortedPlattformen = useMemo(
    () =>
      plattformen
        .filter(p => p.level === 1)
        .sort((a, b) => a.sort_order - b.sort_order),
    [plattformen]
  )

  if (plattformenLoading) {
    return <div className="py-8 text-center text-sm text-muted-foreground">Laden…</div>
  }

  if (sortedPlattformen.length === 0) {
    return (
      <div className="rounded-lg border bg-muted/30 p-8 text-center space-y-3">
        <p className="font-medium">Keine Sales-Plattformen definiert</p>
        <p className="text-sm text-muted-foreground">
          Bitte zuerst Sales-Plattformen im KPI-Modell anlegen, bevor Auszahlungseinstellungen
          gepflegt werden können.
        </p>
        <a href="/dashboard/kpi-modell">
          <Button variant="outline" size="sm" className="mt-2">
            Zum KPI-Modell
          </Button>
        </a>
      </div>
    )
  }

  return (
    <Tabs defaultValue={sortedPlattformen[0]?.id} className="space-y-4">
      <TabsList className="w-full h-auto">
        {sortedPlattformen.map(p => (
          <TabsTrigger key={p.id} value={p.id} className="flex-1">
            {p.name}
          </TabsTrigger>
        ))}
      </TabsList>
      {sortedPlattformen.map(p => (
        <TabsContent key={p.id} value={p.id} className="mt-0">
          <AuszahlungseinstellungenPlatformForm plattformId={p.id} />
        </TabsContent>
      ))}
    </Tabs>
  )
}
