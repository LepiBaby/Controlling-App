'use client'

import { useState, useMemo, useEffect } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
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
import { useLangfristigeKpiKategorien } from '@/hooks/use-langfristige-kpi-kategorien'
import type { KpiCategory } from '@/hooks/use-kpi-categories'
import {
  useLangfristigeMarketingEinstellungen,
  makeDefaultEinstellung,
  type LangfristigeMarketingEinstellung,
  type Gruppierung,
  GRUPPIERUNG_VALUES,
  GRUPPIERUNG_LABELS,
  GRUPPIERUNG_HINWEISE,
} from '@/hooks/use-langfristige-marketing-einstellungen'
import { useToast } from '@/hooks/use-toast'

const KEINE_PLATTFORM = 'keine'

// --- Formular für einen einzelnen Marketingkanal ---

function KanalForm({
  versionId,
  marketingkanalId,
  plattformen,
}: {
  versionId: string
  marketingkanalId: string
  plattformen: KpiCategory[]
}) {
  const { einstellung, loading, error, upsert } =
    useLangfristigeMarketingEinstellungen(versionId, marketingkanalId)
  const { toast } = useToast()
  const [saving, setSaving] = useState(false)

  const current: LangfristigeMarketingEinstellung =
    einstellung ?? makeDefaultEinstellung(marketingkanalId)

  // Lokaler String-State für das Zahlungsziel: Auto-Save erst bei onBlur.
  const [zahlungszielStr, setZahlungszielStr] = useState(
    current.zahlungsziel_tage != null ? String(current.zahlungsziel_tage) : '',
  )

  // Bei (Neu-)Laden der gespeicherten Einstellung lokalen State angleichen.
  useEffect(() => {
    setZahlungszielStr(
      current.zahlungsziel_tage != null ? String(current.zahlungsziel_tage) : '',
    )
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [current.zahlungsziel_tage])

  async function handleSave(patch: Partial<LangfristigeMarketingEinstellung>) {
    setSaving(true)
    try {
      await upsert({ marketingkanal_id: marketingkanalId, ...patch })
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

  function handleZahlungszielBlur() {
    const trimmed = zahlungszielStr.trim()
    const parsed = trimmed === '' ? null : Math.round(parseFloat(trimmed))
    if (parsed !== null && (isNaN(parsed) || parsed < 0)) {
      // Ungültige Eingabe verwerfen, auf gespeicherten Wert zurücksetzen.
      setZahlungszielStr(
        current.zahlungsziel_tage != null ? String(current.zahlungsziel_tage) : '',
      )
      return
    }
    if (parsed === (current.zahlungsziel_tage ?? null)) return
    handleSave({ zahlungsziel_tage: parsed })
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
    <div
      className={`rounded-lg border bg-card p-6 space-y-6 transition-opacity ${saving ? 'opacity-60' : ''}`}
    >
      {/* Sales Plattform */}
      <div className="flex items-start gap-6">
        <Label
          htmlFor={`plattform-${marketingkanalId}`}
          className="w-56 shrink-0 pt-2 text-sm font-medium"
        >
          Sales Plattform
        </Label>
        <div className="space-y-1.5">
          <Select
            value={current.sales_plattform_id ?? KEINE_PLATTFORM}
            onValueChange={v =>
              handleSave({ sales_plattform_id: v === KEINE_PLATTFORM ? null : v })
            }
            disabled={saving}
          >
            <SelectTrigger id={`plattform-${marketingkanalId}`} className="w-48">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={KEINE_PLATTFORM}>Keine</SelectItem>
              {plattformen.map(p => (
                <SelectItem key={p.id} value={p.id}>
                  {p.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {plattformen.length === 0 && (
            <p className="text-xs text-muted-foreground">
              Keine Sales Plattformen gepflegt.{' '}
              <Link
                href={`/dashboard/langfristige-planung/${versionId}/kpi-modell-verwaltung`}
                className="underline"
              >
                Zur KPI-Modell Verwaltung
              </Link>
            </p>
          )}
        </div>
      </div>

      {/* Gruppierung */}
      <div className="flex items-start gap-6">
        <Label
          htmlFor={`gruppierung-${marketingkanalId}`}
          className="w-56 shrink-0 pt-2 text-sm font-medium"
        >
          Gruppierung
        </Label>
        <div className="space-y-1.5">
          <Select
            value={current.gruppierung}
            onValueChange={v => handleSave({ gruppierung: v as Gruppierung })}
            disabled={saving}
          >
            <SelectTrigger id={`gruppierung-${marketingkanalId}`} className="w-48">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {GRUPPIERUNG_VALUES.map(g => (
                <SelectItem key={g} value={g}>
                  {GRUPPIERUNG_LABELS[g]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <p className="text-xs text-muted-foreground">
            {GRUPPIERUNG_HINWEISE[current.gruppierung]}
          </p>
        </div>
      </div>

      {/* Zahlungsziel */}
      <div className="flex items-center gap-6">
        <Label
          htmlFor={`zahlungsziel-${marketingkanalId}`}
          className="w-56 shrink-0 text-sm font-medium"
        >
          Zahlungsziel (Tage)
        </Label>
        <Input
          id={`zahlungsziel-${marketingkanalId}`}
          type="number"
          min={0}
          step={1}
          value={zahlungszielStr}
          onChange={e => setZahlungszielStr(e.target.value)}
          onBlur={handleZahlungszielBlur}
          placeholder="—"
          disabled={saving}
          className="w-48"
        />
      </div>
    </div>
  )
}

// --- Hauptkomponente ---

export function LangfristigeMarketingEinstellungenFormular() {
  const params = useParams()
  const versionId = typeof params.versionId === 'string' ? params.versionId : ''

  const { categories: marketingkanaele, loading: marketingLoading } =
    useLangfristigeKpiKategorien(versionId, 'lp_marketingkanal')
  const { categories: plattformen, loading: plattformenLoading } =
    useLangfristigeKpiKategorien(versionId, 'lp_sales_plattform')

  const sortedKanaele = useMemo(
    () =>
      marketingkanaele
        .filter(k => k.level === 1)
        .sort((a, b) => a.sort_order - b.sort_order),
    [marketingkanaele],
  )

  const sortedPlattformen = useMemo(
    () =>
      plattformen
        .filter(p => p.level === 1)
        .sort((a, b) => a.sort_order - b.sort_order),
    [plattformen],
  )

  if (marketingLoading || plattformenLoading) {
    return <div className="py-8 text-center text-sm text-muted-foreground">Laden…</div>
  }

  if (sortedKanaele.length === 0) {
    return (
      <div className="rounded-lg border bg-muted/30 p-8 text-center space-y-3">
        <p className="font-medium">Keine Marketingkanäle definiert</p>
        <p className="text-sm text-muted-foreground">
          Bitte zuerst in der KPI-Modell Verwaltung dieser Planversion Marketingkanäle
          anlegen, bevor Marketing-Einstellungen gepflegt werden können.
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
    <Tabs defaultValue={sortedKanaele[0]?.id} className="space-y-4">
      <TabsList className="w-full h-auto flex-wrap">
        {sortedKanaele.map(k => (
          <TabsTrigger key={k.id} value={k.id} className="flex-1">
            {k.name}
          </TabsTrigger>
        ))}
      </TabsList>
      {sortedKanaele.map(k => (
        <TabsContent key={k.id} value={k.id} className="mt-0">
          <KanalForm
            versionId={versionId}
            marketingkanalId={k.id}
            plattformen={sortedPlattformen}
          />
        </TabsContent>
      ))}
    </Tabs>
  )
}
